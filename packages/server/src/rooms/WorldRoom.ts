import { Client, Room, ServerError } from 'colyseus';
import { StateView } from '@colyseus/schema';
import {
  BASE_PLAYER_HP, ChunkStore, COMBO, INTEREST_RADIUS, MAX_REWIND_TICKS, MSG,
  NAME_MAX, PROJECTILE_DAMAGE, PROJECTILE_RADIUS, PROJECTILE_RANGE, PROJECTILE_SPEED, CHUNK_SIZE, TICK_DT,
  TICK_MS, TILE_DEFS, PlayerState, ProjectileState, WorldState, chunkOf, encodeAck, encodeDiff, inArc, isNight,
  maxHpForLevel, newPlayerSim, rewindPosition, sanitizeCmd, segmentHitsCircle, stepPlayer, xpForLevel, T, buildingAt,
  type ChunkDiff, type FxMsg, type InputBatch, type InputCmd, type PlayerSim, type PosSample, type Stack,
  type WelcomeMsg, type ChunkReq, type WorldObj, type TalkMsg, type GiftMsg, type ShopMsg, type DialogueChatMsg,
  type DevMsg, type UseMsg, type OpenMsg, type InvMoveMsg, type InvTrashMsg, type EquipMsg, type CraftMsg, type ExperimentMsg,
  type ForgePreviewMsg, type ForgeStartMsg, type RhythmDoneMsg, type FishHookMsg, type ChestMsg, type ShelterMsg, type NpcState,
  type SpellState,
} from '@eigenlands/shared';
import { verifyToken } from '../auth/token';
import { createEnemy, enemyDamage, stepEnemy, type Enemy, type EnemyKind } from '../game/enemies';
import { TokenBucket } from '../rate';
import type { RoomApi } from '../systems/api';
import type { ServerClock } from '../systems/clock';
import { handleChest, handleOpen, handleShelter } from '../systems/containers';
import { handleCraft, handleExperiment } from '../systems/crafting';
import { dailyRollover, refreshCrop, rollShelter } from '../systems/farming';
import { handleHook, tickFishing } from '../systems/fishing';
import { handleForgePreview, handleForgeStart, handleRhythmDone } from '../systems/forging';
import { addSkillXp, giveStacks } from '../systems/helpers';
import { handleEquip, handleInvMove, handleInvTrash } from '../systems/inventory';
import { ObjectManager } from '../systems/objects';
import { loadPlayerData, serializePlayerData } from '../systems/profile';
import { handleUse } from '../systems/tools';
import { handleDev } from '../systems/dev';
import type { PlayerRef, VillageHost, VillageSystem } from '../systems/types';
import { createVillage } from '../systems/village';
import { ServerPlayer } from './player';
import { runtime, worldClock } from './runtime';

interface Projectile {
  state: ProjectileState;
  x: number; y: number; dx: number; dy: number; travelled: number; owner: string;
}

interface Respawn { x: number; y: number; restore: number; at: number }

/** Live server metrics for /metrics (telemetry hook; one world room per process in Phase 1). */
export const metrics = { players: 0, enemies: 0, tickMsAvg: 0, tickMsMax: 0, ticks: 0, overBudget: 0 };

const SPAWN = { x: 0.5, y: 4.5 };
const MAX_QUEUE = 24;
const MAX_ENEMIES = 48;
const MAX_FAUNA = 16;
const key = (cx: number, cy: number) => `${cx},${cy}`;

export class WorldRoom extends Room<WorldState> implements RoomApi {
  maxClients = 100;
  state = new WorldState();

  seed = 0;
  store!: ChunkStore;
  wclock!: ServerClock;
  objects!: ObjectManager;
  village!: VillageSystem;
  players = new Map<string, ServerPlayer>();
  enemies = new Map<string, Enemy>();
  projectiles = new Map<string, Projectile>();
  wet = new Set<string>();
  nodeHp = new Map<string, { hp: number; last: number }>();
  bugCooldown = new Set<string>();
  private respawns = new Map<string, Respawn>();
  private respawnDirty = new Map<string, Respawn>();
  private respawnGone = new Map<string, { x: number; y: number }>();
  private loaded = new Set<string>();
  private loading = new Map<string, Promise<void>>();
  private dirtyChunks = new Set<string>();
  protected byAccount = new Map<string, ServerPlayer>();
  private spawnTimer = 0;
  private autosaveTimer = 0;
  private projSeq = 0;
  private processedDay = 0;
  private secondT = 0;
  /** injectable for deterministic tests */
  rand: () => number = Math.random;

  async onCreate(): Promise<void> {
    const rt = runtime();
    this.seed = rt.config.worldSeed;
    this.wclock = worldClock();
    this.store = new ChunkStore(this.seed, 512);
    this.objects = new ObjectManager({ store: this.store, seed: this.seed, players: this.players });
    this.processedDay = this.wclock.day();
    this.setPatchRate(TICK_MS);
    this.setSimulationInterval(() => this.tick(), TICK_MS);

    const host: VillageHost = {
      seed: this.seed, store: this.store, state: this.state, clock: this.wclock, rand: () => this.rand(),
      players: () => this.players.values() as Iterable<PlayerRef>,
      loadBlob: (k) => rt.repo.getBlob(k), saveBlob: (k, v) => rt.repo.putBlob(k, v),
    };
    this.village = this.makeVillage(host);
    await this.village.init();

    this.onMessage(MSG.INPUT, (client, msg: InputBatch) => this.onInput(client, msg));
    this.onMessage(MSG.CHUNK_REQ, (client, msg: ChunkReq) => { void this.onChunkReq(client, msg); });
    this.onMessage(MSG.PING, (client, msg: { t: number }) => {
      client.send(MSG.PONG, { t: typeof msg?.t === 'number' ? msg.t : 0, st: this.wclock.now() });
    });

    type Bucket = 'useBucket' | 'craftBucket' | 'socialBucket' | 'openBucket' | 'invBucket';
    const on = <M>(type: string, bucket: Bucket, fn: (p: ServerPlayer, msg: M) => void | Promise<void>) => {
      this.onMessage(type, (client, msg: M) => {
        const p = this.players.get(client.sessionId);
        if (!p || !p[bucket].take() || !this.hookAccepts(p, msg)) return; // unknown player, over the rate limit or not this shard's tile: drop silently
        try {
          const r = fn(p, msg);
          if (r instanceof Promise) r.catch((e) => console.error(`${type} failed`, e));
        } catch (e) { console.error(`${type} failed`, e); }
      });
    };
    on<DevMsg>(MSG.DEV, 'invBucket', (p, m) => handleDev(this, p, m));
    on<UseMsg>(MSG.USE, 'useBucket', (p, m) => handleUse(this, p, m));
    on<OpenMsg>(MSG.OPEN, 'openBucket', (p, m) => handleOpen(this, p, m));
    on<InvMoveMsg>(MSG.INV_MOVE, 'invBucket', (p, m) => handleInvMove(p, m));
    on<InvTrashMsg>(MSG.INV_TRASH, 'invBucket', (p, m) => handleInvTrash(p, m));
    on<EquipMsg>(MSG.EQUIP, 'invBucket', (p, m) => handleEquip(p, m));
    on<CraftMsg>(MSG.CRAFT, 'craftBucket', (p, m) => handleCraft(this, p, m));
    on<ExperimentMsg>(MSG.EXPERIMENT, 'craftBucket', (p, m) => handleExperiment(this, p, m));
    on<ForgePreviewMsg>(MSG.FORGE_PREVIEW, 'craftBucket', (p, m) => handleForgePreview(p, m));
    on<ForgeStartMsg>(MSG.FORGE_START, 'craftBucket', (p, m) => handleForgeStart(this, p, m));
    on<RhythmDoneMsg>(MSG.RHYTHM_DONE, 'craftBucket', (p, m) => handleRhythmDone(this, p, m));
    on<FishHookMsg>(MSG.FISH_HOOK, 'craftBucket', (p, m) => handleHook(this, p, m));
    on<ChestMsg>(MSG.CHEST, 'openBucket', (p, m) => handleChest(this, p, m));
    on<ShelterMsg>(MSG.SHELTER, 'openBucket', (p, m) => handleShelter(this, p, m));
    on<TalkMsg>(MSG.TALK, 'socialBucket', (p, m) => {
      if (!this.npcNear(p, m?.npcId)) return;
      const d = this.village.talk(p, m.npcId);
      if (d) p.client.send(MSG.DIALOGUE, d);
    });
    on<GiftMsg>(MSG.GIFT, 'socialBucket', (p, m) => {
      if (!this.npcNear(p, m?.npcId)) return;
      const d = this.village.gift(p, m.npcId, m.slot);
      if (d) p.client.send(MSG.DIALOGUE, d);
    });
    on<ShopMsg>(MSG.SHOP, 'socialBucket', (p, m) => {
      if (!this.npcNear(p, m?.npcId)) return;
      const v = this.village.shop(p, m);
      if (v) p.client.send(MSG.SHOP_VIEW, v);
    });
    on<DialogueChatMsg>(MSG.DIALOGUE_CHAT, 'socialBucket', async (p, m) => {
      if (!this.npcNear(p, m?.npcId)) return;
      const d = await this.village.chat(p, m);
      if (d) p.client.send(MSG.DIALOGUE, d);
    });
  }

  /** NPCs can only be addressed from nearby. */
  private npcNear(p: ServerPlayer, id: unknown): boolean {
    if (typeof id !== 'string') return false;
    const n = this.village.npc(id) as NpcState | undefined;
    return !!n && Math.hypot(n.x - p.sim.x, n.y - p.sim.y) <= 7;
  }

  async onAuth(_client: Client, options: { token?: string }): Promise<{ accountId: string }> {
    const rt = runtime();
    const id = verifyToken(options?.token, rt.config.sessionSecret);
    if (!id || !(await rt.repo.getAccount(id))) throw new ServerError(401, 'unauthorized');
    return { accountId: id };
  }

  async onJoin(client: Client, options: { name?: string }, auth: { accountId: string }): Promise<void> {
    const rt = runtime();
    const accountId = auth.accountId;

    // one live session per account
    const prev = this.byAccount.get(accountId);
    if (prev) {
      prev.client.send(MSG.NOTICE, { text: 'Signed in from another place.' });
      prev.client.leave(4001);
      await this.removePlayer(prev, false);
    }

    let ch = await rt.repo.getCharacter(accountId);
    if (!ch) {
      const name = sanitizeName(options?.name) || `Wanderer${Math.floor(this.rand() * 9000 + 1000)}`;
      ch = await rt.repo.createCharacter(accountId, name, SPAWN.x, SPAWN.y);
    }
    await this.ensureAround(chunkOf(Math.floor(ch.x)), chunkOf(Math.floor(ch.y)), 1);

    const data = loadPlayerData(ch.data, this.wclock.season(), this.wclock.now());
    const st = new PlayerState();
    st.id = client.sessionId; st.name = ch.name; st.x = ch.x; st.y = ch.y; st.look = data.equip.outfit;
    const p = new ServerPlayer(
      client, accountId, st, newPlayerSim(ch.x, ch.y), ch.name, 0, 0, ch.level, ch.xp, new StateView(), data,
    );
    p.maxHp = maxHpForLevel(ch.level, BASE_PLAYER_HP) + p.stats.hpBonus;
    p.hp = Math.min(ch.hp > 0 ? ch.hp : p.maxHp, p.maxHp);
    st.hp = p.hp; st.maxHp = p.maxHp; st.level = p.level;
    client.view = p.view;
    this.players.set(client.sessionId, p);
    this.byAccount.set(accountId, p);
    this.state.players.set(client.sessionId, st);
    p.view.add(st);
    p.inView.add(st.id);
    await rt.presence.set(accountId, client.sessionId);

    const welcome: WelcomeMsg = {
      seed: rt.config.worldSeed, serverNow: this.wclock.now(), playerId: client.sessionId, name: ch.name,
      tickRate: Math.round(1000 / TICK_MS),
      features: { aiDialogue: process.env.AI_DIALOGUE === '1' && !!process.env.ANTHROPIC_API_KEY },
    };
    client.send(MSG.WELCOME, welcome);
    p.sendFullProfile();
  }

  async onLeave(client: Client): Promise<void> {
    const p = this.players.get(client.sessionId);
    if (p) await this.removePlayer(p, true);
  }

  async onDispose(): Promise<void> {
    try {
      await this.flushAll();
      await Promise.all([...this.players.values()].map((p) => this.savePlayer(p)));
      await this.village.dispose();
    } catch (e) { console.error('dispose failed', e); }
  }

  // ───────────────────────── helpers ─────────────────────────

  protected async removePlayer(p: ServerPlayer, save: boolean): Promise<void> {
    if (this.players.get(p.client.sessionId) !== p) return;
    this.players.delete(p.client.sessionId);
    if (this.byAccount.get(p.accountId) === p) this.byAccount.delete(p.accountId);
    this.state.players.delete(p.client.sessionId);
    const rt = runtime();
    await rt.presence.clear(p.accountId, p.client.sessionId).catch(() => {});
    if (save) await this.savePlayer(p).catch((e) => console.error('save failed', e));
  }

  protected async savePlayer(p: ServerPlayer): Promise<void> {
    await runtime().repo.saveCharacter({
      accountId: p.accountId, x: p.sim.x, y: p.sim.y, hp: Math.max(1, p.hp), level: p.level, xp: p.xp,
      data: serializePlayerData(p.data),
    });
  }

  ensureChunk(cx: number, cy: number): Promise<void> {
    const k = key(cx, cy);
    if (this.loaded.has(k)) return Promise.resolve();
    let pr = this.loading.get(k);
    if (!pr) {
      pr = this.loadChunk(cx, cy).then(() => { this.loaded.add(k); this.loading.delete(k); }).catch((e) => { this.loading.delete(k); throw e; });
      this.loading.set(k, pr);
    }
    return pr;
  }

  /** Diff + objects + respawns, then lazy catch-up for time that passed while nobody was here. */
  private async loadChunk(cx: number, cy: number): Promise<void> {
    const repo = runtime().repo;
    const [chunk, objs, resp] = await Promise.all([
      repo.loadChunk(this.seed, cx, cy), repo.loadObjects(this.seed, cx, cy), repo.loadRespawns(this.seed, cx, cy),
    ]);
    const today = this.wclock.day();
    // edits made while loading take precedence
    const merged: ChunkDiff = new Map([...chunk.diff, ...this.store.get(cx, cy).diff]);
    let changed = false;
    for (const [idx, t] of merged) {
      if (t !== T.TILLED_WET) continue;
      if (chunk.day === null || chunk.day < today) { merged.set(idx, T.TILLED); changed = true; } // soil dried overnight
      else this.wet.add(`${cx * CHUNK_SIZE + (idx % CHUNK_SIZE)},${cy * CHUNK_SIZE + Math.floor(idx / CHUNK_SIZE)}`);
    }
    this.store.applyDiff(cx, cy, merged);
    if (changed) this.dirtyChunks.add(key(cx, cy));
    this.objects.load(objs);
    for (const o of this.objects.inChunk(cx, cy)) {
      let touched = false;
      if (o.kind === 'crop') touched = refreshCrop(this, o, today);
      else if (o.kind === 'shelter') touched = rollShelter(o, today);
      if (touched) this.objects.update(o);
    }
    const now = this.wclock.now();
    for (const r of resp) {
      if (r.at <= now) this.applyRespawn(r); else this.respawns.set(`${r.x},${r.y}`, r);
    }
  }

  private async ensureAround(cx: number, cy: number, r: number): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) jobs.push(this.ensureChunk(x, y));
    await Promise.all(jobs);
  }

  private async flushChunks(): Promise<void> {
    if (!this.dirtyChunks.size) return;
    const batch = [...this.dirtyChunks];
    this.dirtyChunks.clear();
    const diffs = batch.map((k) => {
      const [cx, cy] = k.split(',').map(Number) as [number, number];
      return { cx, cy, diff: this.store.get(cx, cy).diff };
    });
    try {
      await runtime().repo.saveChunkDiffs(this.seed, diffs, this.wclock.day());
    } catch (e) {
      batch.forEach((k) => this.dirtyChunks.add(k)); // retry next time; never lose edits
      throw e;
    }
  }

  private async flushRespawns(): Promise<void> {
    if (!this.respawnDirty.size && !this.respawnGone.size) return;
    const ups = [...this.respawnDirty.values()], dels = [...this.respawnGone.values()];
    this.respawnDirty.clear(); this.respawnGone.clear();
    try { await runtime().repo.saveRespawns(this.seed, ups, dels); } catch (e) {
      for (const r of ups) this.respawnDirty.set(`${r.x},${r.y}`, r);
      throw e;
    }
  }

  private async flushAll(): Promise<void> {
    await this.flushChunks();
    await this.objects.flush(runtime().repo);
    await this.flushRespawns();
  }

  /** Change a tile (persisted in the chunk diff) and tell nearby players. */
  setTile(x: number, y: number, tile: number): void {
    const { cx, cy } = this.store.setTile(x, y, tile);
    this.dirtyChunks.add(key(cx, cy));
    for (const q of this.nearby(x, y, (INTEREST_RADIUS + 1) * CHUNK_SIZE)) q.client.send(MSG.TILE, { tx: x, ty: y, tile });
    this.hookTileChanged(x, y, tile);
  }

  scheduleRespawn(x: number, y: number, restore: number, atMs: number): void {
    const r = { x, y, restore, at: atMs };
    this.respawns.set(`${x},${y}`, r);
    this.respawnDirty.set(`${x},${y}`, r);
    this.respawnGone.delete(`${x},${y}`);
  }

  private applyRespawn(r: Respawn): void {
    const k = `${r.x},${r.y}`;
    this.respawns.delete(k);
    this.respawnDirty.delete(k);
    this.respawnGone.set(k, { x: r.x, y: r.y });
    const cur = this.store.getTile(r.x, r.y);
    if (this.store.objectAt(r.x, r.y) || cur === T.TILLED || cur === T.TILLED_WET || cur === T.FENCE || cur === r.restore) return;
    this.setTile(r.x, r.y, r.restore);
  }

  nearby(x: number, y: number, radius: number): ServerPlayer[] {
    const out: ServerPlayer[] = [];
    for (const p of this.players.values()) if (Math.hypot(p.sim.x - x, p.sim.y - y) <= radius) out.push(p);
    return out;
  }

  /** Broadcast an effect to nearby players. `exceptId` skips the originator, who already predicted it locally. */
  fx(msg: FxMsg, exceptId?: string, radius = (INTEREST_RADIUS + 0.5) * CHUNK_SIZE): void {
    for (const p of this.nearby(msg.x, msg.y, radius)) if (p.client.sessionId !== exceptId) p.client.send(MSG.FX, msg);
  }

  // ───────────────────────── messages ─────────────────────────

  private onInput(client: Client, msg: InputBatch): void {
    const p = this.players.get(client.sessionId);
    if (!p || !msg || !Array.isArray(msg.cmds)) return;
    for (const raw of msg.cmds.slice(0, 6)) {
      if (!p.inputBucket.take()) return; // flooding: drop the rest
      const cmd = sanitizeCmd(raw);
      if (cmd.seq <= p.lastSeq) continue;
      if (p.queue.length >= MAX_QUEUE) p.queue.shift();
      p.queue.push(cmd);
    }
  }

  protected async onChunkReq(client: Client, msg: ChunkReq): Promise<void> {
    const p = this.players.get(client.sessionId);
    if (!p || !Number.isInteger(msg?.cx) || !Number.isInteger(msg?.cy)) return;
    if (!p.chunkBucket.take()) return;
    const pcx = chunkOf(Math.floor(p.sim.x)), pcy = chunkOf(Math.floor(p.sim.y));
    if (Math.abs(msg.cx - pcx) > INTEREST_RADIUS + 1 || Math.abs(msg.cy - pcy) > INTEREST_RADIUS + 1) return;
    await this.ensureChunk(msg.cx, msg.cy);
    const objs: WorldObj[] = [...this.store.townObjectsIn(msg.cx, msg.cy), ...this.objects.inChunk(msg.cx, msg.cy)];
    client.send(MSG.CHUNK, { cx: msg.cx, cy: msg.cy, diff: encodeDiff(this.store.get(msg.cx, msg.cy).diff), objs });
  }

  // ───────────────────────── simulation ─────────────────────────

  /** Spawn an enemy (also used by the ambient spawner and by tests). */
  spawnEnemy(kind: EnemyKind, x: number, y: number, night = isNight(this.wclock.now())): Enemy {
    const e = createEnemy(kind, x, y, night);
    this.enemies.set(e.id, e);
    this.state.enemies.set(e.id, e.state);
    return e;
  }

  tick(): void {
    const t0 = performance.now();
    this.tickInner();
    const ms = performance.now() - t0;
    metrics.ticks++;
    metrics.players = this.players.size;
    metrics.enemies = this.enemies.size;
    metrics.tickMsAvg = metrics.tickMsAvg * 0.98 + ms * 0.02;
    metrics.tickMsMax = Math.max(ms, metrics.tickMsMax * 0.999);
    if (ms > TICK_MS) metrics.overBudget++;
  }

  private tickInner(): void {
    this.state.tick++;
    const tick = this.state.tick;
    const now = this.wclock.now();
    this.state.serverTime = now;
    const solid = this.store.solidAt;

    for (const p of this.players.values()) this.stepPlayerTick(p, tick, solid);

    const targets = [...this.players.values()].map((p) => ({ id: p.client.sessionId, x: p.sim.x, y: p.sim.y, alive: p.deadT <= 0 }));
    for (const e of this.enemies.values()) {
      stepEnemy(e, TICK_DT, tick, targets, solid, this.rand, {
        telegraph: (en) => this.fx({ kind: 'telegraph', x: en.x, y: en.y, v: en.def.windup, id: en.id }),
        strike: (en, x, y, r) => this.enemyStrike(en, x, y, r),
      });
    }
    this.stepProjectiles();

    this.spawnTimer -= TICK_DT;
    if (this.spawnTimer <= 0) { this.spawnTimer = 1; if (runtime().ambientSpawns) { this.ambientSpawn(now); this.ambientFauna(now); } this.despawnFar(); }

    // Phase 2: world clock, village, per-second upkeep, profile sync
    const day = this.wclock.day();
    if (day > this.processedDay) { this.processedDay = day; dailyRollover(this, day); this.village.onNewDay(day); }
    this.village.tick(tick);
    this.secondT += TICK_DT;
    if (this.secondT >= 1) { this.secondT -= 1; this.secondly(now); }
    tickFishing(this, Date.now());
    for (const p of this.players.values()) {
      p.maxHp = maxHpForLevel(p.level, BASE_PLAYER_HP) + p.stats.hpBonus;
      if (p.hp > p.maxHp) p.hp = p.maxHp;
      p.flushProfile();
    }

    this.hookTick(now);
    this.updateViews();

    this.autosaveTimer += TICK_DT * 1000;
    if (this.autosaveTimer >= runtime().config.autosaveMs) {
      this.autosaveTimer = 0;
      void this.autosave();
    }
  }

  private async autosave(): Promise<void> {
    try {
      await this.flushAll();
      await Promise.all([...this.players.values()].map((p) => this.savePlayer(p)));
    } catch (e) { console.error('autosave failed', e); }
  }

  /** Once per second: respawn timers, buff expiry and regeneration. */
  private secondly(now: number): void {
    for (const r of [...this.respawns.values()]) if (r.at <= now) this.applyRespawn(r);
    for (const p of this.players.values()) {
      let changed = false;
      for (const [k, b] of Object.entries(p.data.buffs)) if (b.until <= now) { delete p.data.buffs[k]; changed = true; }
      if (changed) p.dirty('buffs');
      const regen = p.data.buffs.regen;
      if (regen && p.deadT <= 0 && p.hp < p.maxHp) {
        p.regenT += 1;
        if (p.regenT >= 5) { p.regenT = 0; p.hp = Math.min(p.maxHp, p.hp + Math.round(regen.power * 4)); }
      }
    }
    for (const [k, c] of this.nodeHp) if (Date.now() - c.last > 90_000) this.nodeHp.delete(k);
  }

  private stepPlayerTick(p: ServerPlayer, tick: number, solid: (x: number, y: number) => boolean): void {
    p.invuln = Math.max(0, p.invuln - TICK_DT);
    if (p.deadT > 0) {
      p.deadT -= TICK_DT;
      if (p.deadT <= 0) this.respawn(p);
    }
    // catch up gently if the queue backs up
    const n = p.queue.length > 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const cmd = p.queue.shift();
      if (!cmd) break;
      p.lastSeq = cmd.seq;
      if (p.deadT > 0) continue;
      const ev = stepPlayer(p.sim, cmd, solid);
      if (ev.dashed) this.fx({ kind: 'dash', x: p.sim.x, y: p.sim.y, dx: p.sim.faceX, dy: p.sim.faceY }, p.client.sessionId);
      if (ev.attacked) this.resolveMelee(p, cmd, ev.combo, tick);
      if (ev.skill) this.spawnProjectile(p);
    }
    p.history.push({ tick, x: p.sim.x, y: p.sim.y });
    if (p.history.length > 12) p.history.shift();

    const s = p.state;
    s.x = p.sim.x; s.y = p.sim.y; s.faceX = p.sim.faceX; s.faceY = p.sim.faceY;
    s.hp = p.hp; s.maxHp = p.maxHp; s.level = p.level; s.xp = p.xp; s.ack = p.lastSeq; s.look = p.data.equip.outfit;
    p.client.send(MSG.ACK, encodeAck({ seq: p.lastSeq, tick, sim: p.sim }));
    s.flags = (p.sim.dashT > 0 ? 1 : 0) | (p.sim.atkCd > 0.12 ? 2 : 0) | (p.deadT > 0 ? 4 : 0);
  }

  private resolveMelee(p: ServerPlayer, cmd: InputCmd, combo: number, tick: number): void {
    const hit = COMBO[combo]!;
    const rewindTick = Math.min(tick, Math.max(cmd.viewTick, tick - MAX_REWIND_TICKS));
    this.fx({ kind: 'swing', x: p.sim.x, y: p.sim.y, dx: p.sim.faceX, dy: p.sim.faceY, v: combo }, p.client.sessionId);
    for (const e of [...this.enemies.values()]) {
      const pos = rewindPosition(e.history, rewindTick) ?? { x: e.x, y: e.y };
      if (!inArc(p.sim.x, p.sim.y, p.sim.faceX, p.sim.faceY, hit, { x: pos.x, y: pos.y, r: e.def.radius })) continue;
      this.damageEnemy(e, this.outgoing(p, hit.damage), p, p.sim.faceX, p.sim.faceY, hit.knockback);
    }
  }

  /** weapon/ring attack bonus and the Might buff */
  private outgoing(p: ServerPlayer, base: number): number {
    const might = p.data.buffs.might;
    return Math.max(1, Math.round((base + p.stats.atkBonus) * (1 + (might && might.until > this.wclock.now() ? might.power : 0))));
  }

  private spawnProjectile(p: ServerPlayer): void {
    const id = `p${++this.projSeq}`;
    const st = new ProjectileState();
    st.id = id; st.x = p.sim.x; st.y = p.sim.y; st.owner = p.client.sessionId;
    const pr: Projectile = { state: st, x: p.sim.x, y: p.sim.y, dx: p.sim.faceX, dy: p.sim.faceY, travelled: 0, owner: p.client.sessionId };
    this.projectiles.set(id, pr);
    this.state.projectiles.set(id, st);
    this.fx({ kind: 'shot', x: p.sim.x, y: p.sim.y, dx: pr.dx, dy: pr.dy }, p.client.sessionId);
  }

  private stepProjectiles(): void {
    for (const pr of [...this.projectiles.values()]) {
      const step = PROJECTILE_SPEED * TICK_DT;
      const nx = pr.x + pr.dx * step, ny = pr.y + pr.dy * step;
      let done = this.store.solidAt(Math.floor(nx), Math.floor(ny)) || pr.travelled + step > PROJECTILE_RANGE;
      if (!done) {
        for (const e of this.enemies.values()) {
          if (segmentHitsCircle(pr.x, pr.y, nx, ny, PROJECTILE_RADIUS, { x: e.x, y: e.y, r: e.def.radius })) {
            const owner = this.players.get(pr.owner) ?? null;
            this.damageEnemy(e, owner ? this.outgoing(owner, PROJECTILE_DAMAGE) : PROJECTILE_DAMAGE, owner, pr.dx, pr.dy, 3);
            done = true;
            break;
          }
        }
      }
      if (done) {
        this.projectiles.delete(pr.state.id);
        this.state.projectiles.delete(pr.state.id);
        continue;
      }
      pr.x = nx; pr.y = ny; pr.travelled += step;
      pr.state.x = nx; pr.state.y = ny;
    }
  }

  protected damageEnemy(e: Enemy, dmg: number, by: ServerPlayer | null, dx: number, dy: number, kb: number): void {
    e.hp -= dmg;
    e.state.hp = Math.max(0, e.hp);
    e.kx += dx * kb * e.resist; e.ky += dy * kb * e.resist;
    if (by) e.lastHitBy = by.client.sessionId;
    // being hit interrupts a windup (reward for aggression), except mid-leap
    if (e.mode === 'windup') { e.mode = 'recover'; e.t = 0.4; e.state.tele = 0; }
    this.fx({ kind: 'hit', x: e.x, y: e.y, v: dmg, id: e.id });
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    this.enemies.delete(e.id);
    this.state.enemies.delete(e.id);
    this.fx({ kind: 'die', x: e.x, y: e.y, id: e.id });
    const killer = e.lastHitBy ? this.players.get(e.lastHitBy) : undefined;
    if (killer) {
      this.giveXp(killer, Math.round(e.def.xp * (e.night ? 1.5 : 1)));
      for (const d of e.def.drops ?? []) {
        if (d.max <= 0 || this.rand() >= d.chance * (1 + 0.15 * killer.stats.luck)) continue;
        const stack: Stack = { id: d.item, n: d.min + Math.floor(this.rand() * (d.max - d.min + 1)) };
        if (!giveStacks(killer, [stack])) killer.toast('Your pack is full.', 'bad');
      }
      if (e.def.passive) addSkillXp(killer, 'foraging', e.def.xp);
    }
    this.hookKilled(e, killer);
  }

  protected giveXp(p: ServerPlayer, xp: number): void {
    p.xp += xp;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      p.maxHp = maxHpForLevel(p.level, BASE_PLAYER_HP);
      p.hp = p.maxHp;
      this.fx({ kind: 'levelup', x: p.sim.x, y: p.sim.y, v: p.level, id: p.client.sessionId });
    }
  }

  private enemyStrike(e: Enemy, x: number, y: number, radius: number): void {
    for (const p of this.players.values()) {
      if (p.deadT > 0 || p.invuln > 0 || p.sim.dashT > 0) continue; // dash grants i-frames
      const d = Math.hypot(p.sim.x - x, p.sim.y - y);
      if (d > radius + 0.3) continue;
      const ward = p.data.buffs.ward;
      const dmg = this.hookIncomingDamage(p, Math.max(1, Math.round(enemyDamage(e) * (1 - (ward && ward.until > this.wclock.now() ? ward.power : 0)))), e);
      if (dmg <= 0) continue; // dodged or absorbed by a Phase 3 ability
      p.hp = Math.max(0, p.hp - dmg);
      p.invuln = 0.5;
      const nx = (p.sim.x - x) / (d || 1), ny = (p.sim.y - y) / (d || 1);
      p.sim.x += nx * 0.3; p.sim.y += ny * 0.3; // small shove (server authoritative; client reconciles)
      this.fx({ kind: 'hurt', x: p.sim.x, y: p.sim.y, v: dmg, id: p.client.sessionId });
      if (p.hp <= 0) {
        p.deadT = 3;
        p.queue.length = 0;
        this.fx({ kind: 'die', x: p.sim.x, y: p.sim.y, id: p.client.sessionId });
      }
    }
  }

  private respawn(p: ServerPlayer): void {
    p.sim = newPlayerSim(SPAWN.x, SPAWN.y);
    p.hp = p.maxHp;
    p.invuln = 2;
  }

  private ambientSpawn(now: number): void {
    if ([...this.enemies.values()].filter((e) => !e.def.passive).length >= MAX_ENEMIES) return;
    const night = isNight(now);
    for (const p of this.players.values()) {
      if (p.deadT > 0) continue;
      let near = 0;
      for (const e of this.enemies.values()) if (!e.def.passive && Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 32) near++;
      if (near >= (night ? 8 : 4)) continue;
      for (let tries = 0; tries < 6; tries++) {
        const a = this.rand() * Math.PI * 2;
        const d = 14 + this.rand() * 8;
        const x = Math.floor(p.sim.x + Math.cos(a) * d), y = Math.floor(p.sim.y + Math.sin(a) * d);
        if (Math.hypot(x, y) < 12) continue; // safe zone around the spawn shrine
        const t = this.store.getTile(x, y);
        if (TILE_DEFS[t]?.solid || t === T.TORCH) continue;
        const kind = this.rand() < (night ? 0.5 : 0.3) ? 'hopper' : 'slime';
        this.spawnEnemy(kind, x + 0.5, y + 0.5, night);
        break;
      }
    }
  }

  /** Daytime rabbits (anywhere on turf) and deer (in groves) wander in near players. */
  private ambientFauna(now: number): void {
    if (isNight(now)) return;
    let total = 0;
    for (const e of this.enemies.values()) if (e.def.passive) total++;
    if (total >= MAX_FAUNA) return;
    for (const p of this.players.values()) {
      if (p.deadT > 0) continue;
      let near = 0;
      for (const e of this.enemies.values()) if (e.def.passive && Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 40) near++;
      if (near >= 3) continue;
      for (let tries = 0; tries < 6; tries++) {
        const a = this.rand() * Math.PI * 2, d = 16 + this.rand() * 10;
        const x = Math.floor(p.sim.x + Math.cos(a) * d), y = Math.floor(p.sim.y + Math.sin(a) * d);
        if (Math.hypot(x, y) < 12 || buildingAt(this.seed, x, y)) continue;
        const t = this.store.getTile(x, y);
        if (t !== T.GRASS && t !== T.GRASS_TALL && t !== T.FLOWERS) continue;
        let trees = 0;
        for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (this.store.getTile(x + dx, y + dy) === T.TREE) trees++;
        this.spawnEnemy(trees >= 6 && this.rand() < 0.5 ? 'deer' : 'rabbit', x + 0.5, y + 0.5, false);
        break;
      }
    }
  }

  private despawnFar(): void {
    for (const e of [...this.enemies.values()]) {
      let close = false;
      for (const p of this.players.values()) if (Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 48) { close = true; break; }
      if (!close) { this.enemies.delete(e.id); this.state.enemies.delete(e.id); }
    }
  }

  // ───────────────────────── extension hooks (overridden by GameRoom, Phase 3/4) ─────────────────────────
  protected makeVillage(host: VillageHost): VillageSystem { return createVillage(host); }
  protected hookAccepts(_p: ServerPlayer, _msg: unknown): boolean { return true; }
  protected hookTileChanged(_x: number, _y: number, _tile: number): void {}
  protected hookTick(_now: number): void {}
  protected hookViewEntities(_push: (id: string, x: number, y: number, st: SpellState) => void): void {}
  protected hookKilled(_e: Enemy, _killer: ServerPlayer | undefined): void {}
  protected hookIncomingDamage(_p: ServerPlayer, dmg: number, _e: Enemy): number { return dmg; }

  /** Interest management: each client only receives entities within INTEREST_RADIUS chunks. */
  private updateViews(): void {
    const ents: Array<{ id: string; cx: number; cy: number; st: PlayerState | Enemy['state'] | ProjectileState | NpcState | SpellState }> = [];
    for (const p of this.players.values()) ents.push({ id: p.client.sessionId, cx: chunkOf(Math.floor(p.sim.x)), cy: chunkOf(Math.floor(p.sim.y)), st: p.state });
    for (const e of this.enemies.values()) ents.push({ id: e.id, cx: chunkOf(Math.floor(e.x)), cy: chunkOf(Math.floor(e.y)), st: e.state });
    for (const pr of this.projectiles.values()) ents.push({ id: pr.state.id, cx: chunkOf(Math.floor(pr.x)), cy: chunkOf(Math.floor(pr.y)), st: pr.state });
    this.state.npcs.forEach((n, id) => ents.push({ id: `npc:${id}`, cx: chunkOf(Math.floor(n.x)), cy: chunkOf(Math.floor(n.y)), st: n }));
    this.hookViewEntities((id, x, y, st) => ents.push({ id, cx: chunkOf(Math.floor(x)), cy: chunkOf(Math.floor(y)), st }));
    const alive = new Set(ents.map((e) => e.id));
    for (const p of this.players.values()) {
      const pcx = chunkOf(Math.floor(p.sim.x)), pcy = chunkOf(Math.floor(p.sim.y));
      for (const e of ents) {
        const inRange = e.id === p.client.sessionId
          || (Math.abs(e.cx - pcx) <= INTEREST_RADIUS && Math.abs(e.cy - pcy) <= INTEREST_RADIUS);
        const has = p.inView.has(e.id);
        if (inRange && !has) { p.view.add(e.st); p.inView.add(e.id); }
        else if (!inRange && has) { p.view.remove(e.st); p.inView.delete(e.id); }
      }
      for (const id of p.inView) if (!alive.has(id)) p.inView.delete(id);
    }
  }
}

/** Test/admin helper used by integration tests. */
export function giveTo(room: WorldRoom, sessionId: string, stack: Stack): boolean {
  const p = room.players.get(sessionId);
  return !!p && giveStacks(p, [stack], false);
}

export function sanitizeName(n: unknown): string {
  if (typeof n !== 'string') return '';
  return n.replace(/[^\p{L}\p{N} _'-]/gu, '').trim().slice(0, NAME_MAX);
}

