import { Client, Room, ServerError } from 'colyseus';
import { StateView } from '@colyseus/schema';
import {
  ATK, BASE_PLAYER_HP, ChunkStore, COMBO, CHARGE_MIN, DASH_CHARGES, ELITE, ELITE_XP_MULT, ENEMY_DEFS, INTEREST_RADIUS, MAX_REWIND_TICKS, MSG,
  NAME_MAX, ORB_RADIUS, ORB_RANGE, ORB_SPEED, ORB_SPREAD, PLAYER_RADIUS, PROJECTILE_DAMAGE, PROJECTILE_RADIUS, PROJECTILE_RANGE,
  PROJECTILE_SPEED, CHUNK_SIZE, REFLECT_DAMAGE, REFLECT_SPEED_MULT, SKILL_POISE, SLAM_POISE, SLIP_SLOW_RADIUS, SLIP_SLOW_TIME, SLIP_TIME,
  BOMB_FUSE, BOMB_RADIUS, CRIT_MULT, moveBody, TICK_DT, enemyScale, eliteChance, hasIframes, heavyHit, isPerfectDodge, pickSpawn, resolveHit, rollCrit,
  shapeHits, slamDamage, spawnBudget, type StepEvents, type StrikeShape,
  TICK_MS, TILE_DEFS, PlayerState, ProjectileState, WorldState, chunkOf, encodeAck, encodeDiff, inArc, isNight,
  maxHpForLevel, newPlayerSim, rewindPosition, sanitizeCmd, segmentHitsCircle, stepPlayer, xpForLevel, T, buildingAt,
  type ChunkDiff, type FxMsg, type InputBatch, type InputCmd, type PlayerSim, type PosSample, type Stack,
  type WelcomeMsg, type ChunkReq, type WorldObj, type TalkMsg, type GiftMsg, type ShopMsg, type DialogueChatMsg,
  type DevMsg, type UseMsg, type OpenMsg, type InvMoveMsg, type InvTrashMsg, type EquipMsg, type CraftMsg, type ExperimentMsg,
  type ForgePreviewMsg, type ForgeStartMsg, type RhythmDoneMsg, type FishHookMsg, type ChestMsg, type ShelterMsg, type NpcState,
  type SpellState,
} from '@eigenlands/shared';
import { verifyToken } from '../auth/token';
import { createEnemy, enemyDamage, stepEnemies, type Enemy, type EnemyKind, type SpawnOpts } from '../game/enemies';
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
  team: 'player' | 'enemy';
  speed: number; range: number; radius: number;
  /** fixed damage (enemy orbs, reflected orbs); player bolts compute theirs on impact */
  dmg: number;
  history: PosSample[];
  /** tick an enemy orb ended: kept a few ticks so lagged players can still be hit by what they saw */
  endTick: number;
  /** players that dodged it */
  passed: Set<string>;
  src: Enemy | null;
}

/** An enemy strike waiting to be resolved against players whose view lags behind (defender-favouring lag compensation). */
interface PendingStrike {
  e: Enemy; shape: StrikeShape; dmg: number; weight: number; tick: number;
  waiting: Set<string>;
  /** players already hit/dodged by this attack (charges sweep many ticks) */
  dedupe: Set<string> | null;
}

/** Combat options for a hit on an enemy. Abilities (hitEnemy) pass none: weight 0, poise from damage. */
export interface HitOpts { weight?: number; poise?: number; crit?: boolean; counter?: boolean }

const RESPAWN_TIME = 3;

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
  private strikes: PendingStrike[] = [];
  private bombs: Array<{ e: Enemy; x: number; y: number; t: number }> = [];
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
    on<DevMsg>(MSG.DEV, 'invBucket', (p, m) => (m?.cmd === 'spawn' ? this.devSpawn(p, m) : handleDev(this, p, m)));
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
  spawnEnemy(kind: EnemyKind, x: number, y: number, night = isNight(this.wclock.now()), opts: SpawnOpts = {}): Enemy {
    const e = createEnemy(kind, x, y, night, opts);
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
    this.resolveStrikes(tick);

    const targets = [...this.players.values()].map((p) => ({ id: p.client.sessionId, x: p.sim.x, y: p.sim.y, alive: p.deadT <= 0 }));
    stepEnemies(this.enemies.values(), TICK_DT, tick, targets, solid, this.rand, {
      telegraph: (en) => this.fx({ kind: 'telegraph', x: en.x, y: en.y, v: en.t, w: en.atk, id: en.id }),
      strike: (en, x, y, r, mult) => this.enemyStrike(en, x, y, r, mult),
      lane: (en, ax, ay, bx, by, w) => this.queueStrike(en, { kind: 'lane', ax, ay, bx, by, w }, enemyDamage(en), 2, en.chargeHits),
      fire: (en, dx, dy) => this.fireOrbs(en, dx, dy),
      slam: (en, sp) => this.wallSlam(en, sp),
      crash: (en) => { this.fx({ kind: 'crash', x: en.x, y: en.y, id: en.id, dx: en.aimX, dy: en.aimY }); this.fx({ kind: 'stagger', x: en.x, y: en.y, id: en.id }); },
    });
    this.stepBombs();
    this.stepProjectiles(tick);

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
      // how far behind the server this client's view was (bounded; bogus values mean "no compensation")
      const lag = tick - cmd.viewTick;
      p.viewLag = cmd.viewTick > 0 && lag > 0 && lag <= MAX_REWIND_TICKS ? lag : 0;
      p.lastViewTick = p.viewLag > 0 ? cmd.viewTick : tick;
      const ev = stepPlayer(p.sim, cmd, solid);
      if (ev.dashed) {
        p.dashTick = tick;
        this.fx({ kind: 'dash', x: p.sim.x, y: p.sim.y, dx: p.sim.faceX, dy: p.sim.faceY, id: p.id }, p.client.sessionId);
      }
      if (ev.attacked) this.resolveMelee(p, cmd, ev, tick);
      if (ev.skill) this.spawnProjectile(p);
    }
    p.history.push({ tick, x: p.sim.x, y: p.sim.y });
    if (p.history.length > 12) p.history.shift();

    const s = p.state;
    s.x = p.sim.x; s.y = p.sim.y; s.faceX = p.sim.faceX; s.faceY = p.sim.faceY;
    s.hp = p.hp; s.maxHp = p.maxHp; s.level = p.level; s.xp = p.xp; s.ack = p.lastSeq; s.look = p.data.equip.outfit;
    p.client.send(MSG.ACK, encodeAck({ seq: p.lastSeq, tick, sim: p.sim }));
    const sim = p.sim;
    s.flags = (sim.dashT > 0 ? 1 : 0) | (sim.atkCd > 0.12 ? 2 : 0) | (p.deadT > 0 ? 4 : 0)
      | (sim.hold && sim.charge > 0 ? 8 : 0) | (sim.hold && sim.charge >= CHARGE_MIN ? 16 : 0) | (sim.slipT > 0 ? 32 : 0) | (sim.ifrT > 0 ? 64 : 0);
  }

  /** Light combo hits and charged heavies; lag-compensated against what the attacker saw. Also bats enemy orbs back. */
  private resolveMelee(p: ServerPlayer, cmd: InputCmd, ev: StepEvents, tick: number): void {
    const hit = ev.heavy ? heavyHit(ev.level) : COMBO[ev.combo]!;
    const rewindTick = Math.min(tick, Math.max(cmd.viewTick, tick - MAX_REWIND_TICKS));
    const fx = p.sim.faceX, fy = p.sim.faceY;
    if (ev.heavy) this.fx({ kind: 'heavy', x: p.sim.x, y: p.sim.y, dx: fx, dy: fy, v: ev.level, id: p.id }, p.client.sessionId);
    else this.fx({ kind: 'swing', x: p.sim.x, y: p.sim.y, dx: fx, dy: fy, v: ev.combo, id: p.id }, p.client.sessionId);
    for (const e of [...this.enemies.values()]) {
      const pos = rewindPosition(e.history, rewindTick) ?? { x: e.x, y: e.y };
      if (!inArc(p.sim.x, p.sim.y, fx, fy, hit, { x: pos.x, y: pos.y, r: e.def.radius })) continue;
      const crit = rollCrit(this.rand(), p.stats.luck, ev.counter, true);
      this.damageEnemy(e, this.outgoing(p, hit.damage), p, fx, fy, hit.knockback, { weight: hit.weight, poise: hit.poise, crit, counter: ev.counter });
    }
    for (const pr of [...this.projectiles.values()]) {
      if (pr.team !== 'enemy' || pr.endTick) continue;
      const pos = rewindPosition(pr.history, rewindTick) ?? { x: pr.x, y: pr.y };
      if (inArc(p.sim.x, p.sim.y, fx, fy, hit, { x: pos.x, y: pos.y, r: pr.radius + 0.15 })) this.reflect(pr, p);
    }
  }

  /** weapon/ring attack bonus and the Might buff */
  private outgoing(p: ServerPlayer, base: number): number {
    const might = p.data.buffs.might;
    return Math.max(1, Math.round((base + p.stats.atkBonus) * (1 + (might && might.until > this.wclock.now() ? might.power : 0))));
  }

  private addProjectile(o: Omit<Projectile, 'state' | 'travelled' | 'history' | 'endTick' | 'passed'>, kind: number): Projectile {
    const id = `p${++this.projSeq}`;
    const st = new ProjectileState();
    st.id = id; st.x = o.x; st.y = o.y; st.owner = o.owner; st.kind = kind;
    const pr: Projectile = { ...o, state: st, travelled: 0, history: [{ tick: this.state.tick, x: o.x, y: o.y }], endTick: 0, passed: new Set() };
    this.projectiles.set(id, pr);
    this.state.projectiles.set(id, st);
    return pr;
  }

  private spawnProjectile(p: ServerPlayer): void {
    const pr = this.addProjectile({
      x: p.sim.x, y: p.sim.y, dx: p.sim.faceX, dy: p.sim.faceY, owner: p.client.sessionId, team: 'player',
      speed: PROJECTILE_SPEED, range: PROJECTILE_RANGE, radius: PROJECTILE_RADIUS, dmg: 0, src: null,
    }, 0);
    this.fx({ kind: 'shot', x: p.sim.x, y: p.sim.y, dx: pr.dx, dy: pr.dy }, p.client.sessionId);
  }

  /** Phase Wisp attack: one slow orb (a fan of three at night). */
  private fireOrbs(e: Enemy, dx: number, dy: number): void {
    const angles = e.night ? [-ORB_SPREAD, 0, ORB_SPREAD] : [0];
    for (const a of angles) {
      const c = Math.cos(a), s = Math.sin(a);
      const ux = dx * c - dy * s, uy = dx * s + dy * c;
      this.addProjectile({
        x: e.x + ux * 0.4, y: e.y + uy * 0.4, dx: ux, dy: uy, owner: e.id, team: 'enemy',
        speed: ORB_SPEED, range: ORB_RANGE, radius: ORB_RADIUS, dmg: enemyDamage(e), src: e,
      }, 1);
    }
    this.fx({ kind: 'orb', x: e.x, y: e.y, dx, dy, id: e.id });
  }

  /** A melee swing batted an orb back: it now flies where the player faces, faster and harder. */
  private reflect(pr: Projectile, p: ServerPlayer): void {
    pr.team = 'player'; pr.owner = p.id; pr.state.owner = p.id; pr.state.kind = 2;
    pr.dx = p.sim.faceX; pr.dy = p.sim.faceY;
    pr.speed = ORB_SPEED * REFLECT_SPEED_MULT; pr.range = ORB_RANGE; pr.travelled = 0;
    pr.dmg = this.outgoing(p, REFLECT_DAMAGE);
    pr.history = [{ tick: this.state.tick, x: pr.x, y: pr.y }];
    this.fx({ kind: 'reflect', x: pr.x, y: pr.y, dx: pr.dx, dy: pr.dy, id: p.id });
  }

  private removeProjectile(pr: Projectile): void {
    this.projectiles.delete(pr.state.id);
    this.state.projectiles.delete(pr.state.id);
  }

  private stepProjectiles(tick = this.state.tick): void {
    for (const pr of [...this.projectiles.values()]) {
      if (pr.endTick) {
        if (tick - pr.endTick > MAX_REWIND_TICKS) this.projectiles.delete(pr.state.id);
        continue;
      }
      const step = pr.speed * TICK_DT;
      const nx = pr.x + pr.dx * step, ny = pr.y + pr.dy * step;
      let done = this.store.solidAt(Math.floor(nx), Math.floor(ny)) || pr.travelled + step > pr.range;
      if (!done && pr.team === 'player') {
        for (const e of this.enemies.values()) {
          if (segmentHitsCircle(pr.x, pr.y, nx, ny, pr.radius, { x: e.x, y: e.y, r: e.def.radius })) {
            const owner = this.players.get(pr.owner) ?? null;
            const reflected = pr.state.kind === 2;
            const dmg = reflected ? pr.dmg : owner ? this.outgoing(owner, PROJECTILE_DAMAGE) : PROJECTILE_DAMAGE;
            this.damageEnemy(e, dmg, owner, pr.dx, pr.dy, reflected ? 5 : 3, { weight: reflected ? 1 : 0, poise: reflected ? 20 : SKILL_POISE });
            done = true;
            break;
          }
        }
      }
      if (done) {
        if (pr.team === 'enemy') { pr.endTick = tick; this.state.projectiles.delete(pr.state.id); } else this.removeProjectile(pr);
        continue;
      }
      pr.x = nx; pr.y = ny; pr.travelled += step;
      pr.state.x = nx; pr.state.y = ny;
      pr.history.push({ tick, x: nx, y: ny });
      if (pr.history.length > 16) pr.history.shift();
    }
    // enemy orbs vs players: each player is tested against the orb where THEY saw it (defender lag compensation)
    for (const pr of [...this.projectiles.values()]) {
      if (pr.team !== 'enemy') continue;
      for (const p of this.players.values()) {
        if (p.deadT > 0 || pr.passed.has(p.id)) continue;
        const rt = tick - p.viewLag;
        if (pr.endTick && rt > pr.endTick) continue;
        const b = pr.history.find((h) => h.tick === rt);
        if (!b) continue;
        const a = pr.history.find((h) => h.tick === rt - 1) ?? b;
        if (!segmentHitsCircle(a.x, a.y, b.x, b.y, pr.radius, { x: p.sim.x, y: p.sim.y, r: PLAYER_RADIUS })) continue;
        if (hasIframes(p.sim)) { if (isPerfectDodge(p.sim)) this.perfectDodge(p); pr.passed.add(p.id); continue; }
        if (p.invuln > 0) continue;
        if (pr.src) this.hurtPlayer(p, pr.dmg, pr.src, 1, pr.dx, pr.dy);
        this.removeProjectile(pr);
        break;
      }
    }
  }

  protected damageEnemy(e: Enemy, dmg: number, by: ServerPlayer | null, dx: number, dy: number, kb: number, o: HitOpts = {}): void {
    if (!this.enemies.has(e.id) || e.hp <= 0) return;
    const weight = o.weight ?? 0;
    const crit = !!o.crit;
    const staggered = e.mode === 'stagger';
    const r = e.def.passive
      ? { damage: Math.max(1, Math.round(dmg * (crit ? CRIT_MULT : 1))), poise: 0, knockback: kb, flinch: false }
      : resolveHit(e.def, { damage: dmg, poise: o.poise ?? Math.round(dmg * 0.4), knockback: kb, weight }, { crit, staggered, counter: o.counter });
    e.hp -= r.damage;
    e.state.hp = Math.max(0, e.hp);
    const res = staggered ? Math.min(1, e.resist * 2.5) : e.resist;
    e.kx += dx * r.knockback * res; e.ky += dy * r.knockback * res;
    if (by) e.lastHitBy = by.client.sessionId;
    let broke = false;
    if (!e.def.passive && r.poise > 0) {
      e.poise -= r.poise; e.poiseT = 0;
      if (e.poise <= 0 && !staggered) { broke = true; this.staggerEnemy(e); }
    }
    if (!broke && r.flinch && !e.def.passive && !staggered) e.flinchT = Math.max(e.flinchT, 0.12);
    this.fx({ kind: 'hit', x: e.x, y: e.y, v: r.damage, id: e.id, w: weight, c: crit ? 1 : 0, s: broke ? 1 : 0, by: by?.id, dx, dy });
    if (e.hp <= 0) this.killEnemy(e, weight);
  }

  /** Poise broken: interrupts any windup/charge; the enemy takes extra damage for a moment. */
  private staggerEnemy(e: Enemy): void {
    e.mode = 'stagger';
    e.t = e.def.staggerTime ?? 0.7;
    e.atk = ATK.NONE;
    e.state.tele = 0;
    e.poise = 0;
    this.fx({ kind: 'stagger', x: e.x, y: e.y, id: e.id });
  }

  /** Knocked into a wall hard enough: bonus damage and poise damage, credited to the last attacker. */
  private wallSlam(e: Enemy, speed: number): void {
    const bonus = slamDamage(speed);
    this.fx({ kind: 'slam', x: e.x, y: e.y, v: bonus, id: e.id });
    this.damageEnemy(e, bonus, e.lastHitBy ? this.players.get(e.lastHitBy) ?? null : null, 0, 0, 0, { weight: 1, poise: SLAM_POISE });
  }

  private killEnemy(e: Enemy, weight = 0): void {
    this.enemies.delete(e.id);
    this.state.enemies.delete(e.id);
    this.fx({ kind: 'die', x: e.x, y: e.y, id: e.id, v: e.def.kind, w: weight });
    const killer = e.lastHitBy ? this.players.get(e.lastHitBy) : undefined;
    if (killer) {
      const xp = e.def.xp * (e.night ? 1.5 : 1) * (e.elite ? ELITE_XP_MULT : 1) * enemyScale(e.level).xp;
      this.giveXp(killer, Math.round(xp));
      const rolls = e.elite ? 2 : 1;
      for (let i = 0; i < rolls; i++) {
        for (const d of e.def.drops ?? []) {
          if (d.max <= 0 || this.rand() >= d.chance * (1 + 0.15 * killer.stats.luck)) continue;
          const stack: Stack = { id: d.item, n: d.min + Math.floor(this.rand() * (d.max - d.min + 1)) };
          if (!giveStacks(killer, [stack])) killer.toast('Your pack is full.', 'bad');
        }
      }
      if (e.def.passive) addSkillXp(killer, 'foraging', e.def.xp);
    }
    // night slimes decohere into a pair of Static Mites
    if (e.night && e.def.kind === ENEMY_DEFS.slime.kind) {
      for (const s of [-1, 1]) {
        const x = e.x + s * 0.45, y = e.y + 0.2;
        if (!this.store.solidAt(Math.floor(x), Math.floor(y))) { const m = this.spawnEnemy('mite', x, y, true, { level: e.level }); m.cd = 0.8; }
      }
    }
    if (e.elite & ELITE.VOLATILE) {
      this.bombs.push({ e, x: e.x, y: e.y, t: BOMB_FUSE });
      this.fx({ kind: 'bomb', x: e.x, y: e.y, v: BOMB_FUSE, w: BOMB_RADIUS, id: e.id });
    }
    this.hookKilled(e, killer);
  }

  private stepBombs(): void {
    if (!this.bombs.length) return;
    for (const b of this.bombs) {
      b.t -= TICK_DT;
      if (b.t <= 0) {
        this.queueStrike(b.e, { kind: 'circle', x: b.x, y: b.y, r: BOMB_RADIUS }, enemyDamage(b.e, 1.2), 2, null);
        this.fx({ kind: 'blast', x: b.x, y: b.y, v: BOMB_RADIUS });
      }
    }
    this.bombs = this.bombs.filter((b) => b.t > 0);
  }

  protected giveXp(p: ServerPlayer, xp: number): void {
    p.xp += xp;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      p.maxHp = maxHpForLevel(p.level, BASE_PLAYER_HP) + p.stats.hpBonus;
      p.hp = p.maxHp;
      this.fx({ kind: 'levelup', x: p.sim.x, y: p.sim.y, v: p.level, id: p.client.sessionId });
    }
  }

  /** A circular enemy strike (bite, slam, shockwave). */
  private enemyStrike(e: Enemy, x: number, y: number, radius: number, mult = 1): void {
    const heavy = e.def.kind === ENEMY_DEFS.brute.kind;
    if (radius >= 1.5) this.fx({ kind: 'blast', x, y, v: radius, id: e.id });
    this.queueStrike(e, { kind: 'circle', x, y, r: radius }, enemyDamage(e, mult), heavy ? 2 : 1, null);
  }

  /**
   * Lag compensation for defenders: a strike lands on a player when THEY see it land (their input's viewTick reaches the
   * strike tick), bounded by MAX_REWIND_TICKS. Players without valid view info are resolved immediately.
   */
  private queueStrike(e: Enemy, shape: StrikeShape, dmg: number, weight: number, dedupe: Set<string> | null): void {
    const st: PendingStrike = { e, shape, dmg, weight, tick: this.state.tick, waiting: new Set(), dedupe };
    const cx = shape.kind === 'circle' ? shape.x : (shape.ax + shape.bx) / 2, cy = shape.kind === 'circle' ? shape.y : (shape.ay + shape.by) / 2;
    const reach = shape.kind === 'circle' ? shape.r : Math.hypot(shape.bx - shape.ax, shape.by - shape.ay) / 2 + shape.w;
    for (const p of this.players.values()) {
      if (p.deadT > 0 || Math.hypot(p.sim.x - cx, p.sim.y - cy) > reach + 4) continue;
      if (p.viewLag <= 0) this.applyStrike(st, p); else st.waiting.add(p.id);
    }
    if (st.waiting.size) this.strikes.push(st);
  }

  private resolveStrikes(tick: number): void {
    if (!this.strikes.length) return;
    for (const st of this.strikes) {
      for (const id of [...st.waiting]) {
        const p = this.players.get(id);
        if (!p) { st.waiting.delete(id); continue; }
        if (p.lastViewTick >= st.tick || tick - st.tick >= MAX_REWIND_TICKS || p.viewLag <= 0) { st.waiting.delete(id); this.applyStrike(st, p); }
      }
    }
    this.strikes = this.strikes.filter((s) => s.waiting.size > 0);
  }

  private applyStrike(st: PendingStrike, p: ServerPlayer): void {
    if (p.deadT > 0 || st.dedupe?.has(p.id)) return;
    if (!shapeHits(st.shape, { x: p.sim.x, y: p.sim.y, r: PLAYER_RADIUS })) return;
    if (hasIframes(p.sim)) { // dodged
      if (isPerfectDodge(p.sim)) this.perfectDodge(p);
      st.dedupe?.add(p.id);
      return;
    }
    if (p.invuln > 0) return;
    let nx: number, ny: number;
    if (st.shape.kind === 'circle') { nx = p.sim.x - st.shape.x; ny = p.sim.y - st.shape.y; } else {
      const s = st.shape; const vx = s.bx - s.ax, vy = s.by - s.ay;
      nx = -vy; ny = vx;
      if (nx * (p.sim.x - s.ax) + ny * (p.sim.y - s.ay) < 0) { nx = -nx; ny = -ny; }
    }
    if (this.hurtPlayer(p, st.dmg, st.e, st.weight, nx, ny)) st.dedupe?.add(p.id);
  }

  /** Apply an enemy hit to a player (ward buff, Phase 3 hook, shove, death). Returns whether damage was dealt. */
  private hurtPlayer(p: ServerPlayer, raw: number, e: Enemy, weight: number, dirX: number, dirY: number): boolean {
    const ward = p.data.buffs.ward;
    const dmg = this.hookIncomingDamage(p, Math.max(1, Math.round(raw * (1 - (ward && ward.until > this.wclock.now() ? ward.power : 0)))), e);
    if (dmg <= 0) return false; // dodged or absorbed by a Phase 3 ability
    p.hp = Math.max(0, p.hp - dmg);
    p.invuln = 0.5;
    const l = Math.hypot(dirX, dirY) || 1;
    const shove = weight >= 2 ? 0.6 : 0.3;
    moveBody(p.sim, (dirX / l) * shove, (dirY / l) * shove, PLAYER_RADIUS, this.store.solidAt); // server authoritative; the client reconciles
    p.sim.charge = 0;
    this.fx({ kind: 'hurt', x: p.sim.x, y: p.sim.y, v: dmg, id: p.client.sessionId, w: weight });
    if (p.hp <= 0) {
      p.deadT = RESPAWN_TIME;
      p.queue.length = 0;
      this.fx({ kind: 'die', x: p.sim.x, y: p.sim.y, id: p.client.sessionId, by: String(e.def.kind) });
    }
    return true;
  }

  /** Dashed through a strike in the first frames of the dash: phase slip. */
  private perfectDodge(p: ServerPlayer): void {
    if (p.slipTick === p.dashTick) return; // one per dash
    p.slipTick = p.dashTick;
    p.sim.slipT = SLIP_TIME;
    p.sim.dashN = Math.min(DASH_CHARGES, p.sim.dashN + 1);
    if (p.sim.dashN >= DASH_CHARGES) p.sim.dashCd = 0;
    p.invuln = Math.max(p.invuln, 0.35);
    for (const e of this.enemies.values()) if (!e.def.passive && Math.hypot(e.x - p.sim.x, e.y - p.sim.y) <= SLIP_SLOW_RADIUS) e.slowT = SLIP_SLOW_TIME;
    this.fx({ kind: 'perfect', x: p.sim.x, y: p.sim.y, id: p.id });
  }

  private respawn(p: ServerPlayer): void {
    p.sim = newPlayerSim(SPAWN.x, SPAWN.y);
    p.hp = p.maxHp;
    p.invuln = 2;
    p.dashTick = -1; p.slipTick = -2;
  }

  /** DEV_COMMANDS only: spawn enemies around the player (browser tests, tuning). */
  private devSpawn(p: ServerPlayer, m: DevMsg): void {
    if (!runtime().config.devCommands || m.cmd !== 'spawn' || typeof m.kind !== 'string' || !(m.kind in ENEMY_DEFS)) return;
    const n = Math.max(1, Math.min(8, Math.floor(Number(m.n) || 1)));
    const d = typeof m.d === 'number' && Number.isFinite(m.d) ? Math.min(12, Math.max(1, m.d)) : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      const x = p.sim.x + Math.cos(a) * d, y = p.sim.y + Math.sin(a) * d;
      if (this.store.solidAt(Math.floor(x), Math.floor(y))) continue;
      this.spawnEnemy(m.kind as EnemyKind, x, y, m.night === true || (m.night === undefined && isNight(this.wclock.now())), { level: p.level, elite: Number(m.elite) & 7 });
    }
  }

  /** Meadow spawner: a per-player budget of enemy "points", a spawn table by level and time of day, mite packs and elites. */
  private ambientSpawn(now: number): void {
    if ([...this.enemies.values()].filter((e) => !e.def.passive).length >= MAX_ENEMIES) return;
    const night = isNight(now);
    for (const p of this.players.values()) {
      if (p.deadT > 0) continue;
      let used = 0;
      for (const e of this.enemies.values()) if (!e.def.passive && Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 32) used += e.def.budget ?? 1;
      const budget = spawnBudget(p.level, night);
      if (used >= budget) continue;
      for (let tries = 0; tries < 6; tries++) {
        const a = this.rand() * Math.PI * 2;
        const d = 14 + this.rand() * 8;
        const x = Math.floor(p.sim.x + Math.cos(a) * d), y = Math.floor(p.sim.y + Math.sin(a) * d);
        if (Math.hypot(x, y) < 12 || buildingAt(this.seed, x, y)) continue; // safe zone around the spawn shrine; never indoors
        const t = this.store.getTile(x, y);
        if (TILE_DEFS[t]?.solid || t === T.TORCH) continue;
        let kind = pickSpawn(p.level, night, this.rand());
        if (kind === 'brute' && used + 3 > budget + 0.5) kind = 'slime';
        const elite = this.rand() < eliteChance(p.level, night) ? [ELITE.HARDENED, ELITE.SWIFT, ELITE.VOLATILE][Math.floor(this.rand() * 3)]! : 0;
        if (kind === 'mite') {
          const n = 4 + Math.floor(this.rand() * 3);
          for (let i = 0; i < n; i++) {
            const mx = x + 0.5 + Math.cos(i * 2.4) * 0.8, my = y + 0.5 + Math.sin(i * 2.4) * 0.8;
            if (!this.store.solidAt(Math.floor(mx), Math.floor(my))) this.spawnEnemy('mite', mx, my, night, { level: p.level });
          }
        } else this.spawnEnemy(kind, x + 0.5, y + 0.5, night, { level: p.level, elite });
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

