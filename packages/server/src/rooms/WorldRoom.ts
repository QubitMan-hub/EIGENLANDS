import { Client, Room, ServerError } from 'colyseus';
import { StateView } from '@colyseus/schema';
import {
  BASE_PLAYER_HP, ChunkStore, COMBO, EDIT_REACH, INTEREST_RADIUS, MAX_REWIND_TICKS, MSG,
  NAME_MAX, PROJECTILE_DAMAGE, PROJECTILE_RADIUS, PROJECTILE_RANGE, PROJECTILE_SPEED, CHUNK_SIZE, TICK_DT,
  TICK_MS, TILE_DEFS, PlayerState, ProjectileState, WorldState, chunkOf, encodeDiff, inArc, isNight,
  maxHpForLevel, newPlayerSim, rewindPosition, sanitizeCmd, segmentHitsCircle, stepPlayer, xpForLevel, T,
  type ChunkDiff, type EditMsg, type FxMsg, type InputBatch, type InputCmd, type PlayerSim, type PosSample,
  type WelcomeMsg, type ChunkReq,
} from '@eigenlands/shared';
import { verifyToken } from '../auth/token';
import { createEnemy, enemyDamage, stepEnemy, type Enemy } from '../game/enemies';
import { TokenBucket } from '../rate';
import { runtime } from './runtime';

interface ServerPlayer {
  client: Client;
  accountId: string;
  state: PlayerState;
  sim: PlayerSim;
  queue: InputCmd[];
  lastSeq: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  deadT: number;
  invuln: number;
  history: PosSample[];
  inputBucket: TokenBucket;
  chunkBucket: TokenBucket;
  editBucket: TokenBucket;
  view: StateView;
  inView: Set<string>;
  hurtFlash: number;
}

interface Projectile {
  state: ProjectileState;
  x: number; y: number; dx: number; dy: number; travelled: number; owner: string;
}

const SPAWN = { x: 0.5, y: 4.5 };
const MAX_QUEUE = 24;
const MAX_ENEMIES = 48;
const key = (cx: number, cy: number) => `${cx},${cy}`;

export class WorldRoom extends Room<WorldState> {
  maxClients = 100;
  state = new WorldState();

  store!: ChunkStore;
  players = new Map<string, ServerPlayer>();
  enemies = new Map<string, Enemy>();
  projectiles = new Map<string, Projectile>();
  private loaded = new Set<string>();
  private loading = new Map<string, Promise<void>>();
  private dirtyChunks = new Set<string>();
  private byAccount = new Map<string, ServerPlayer>();
  private spawnTimer = 0;
  private autosaveTimer = 0;
  private projSeq = 0;
  /** injectable for deterministic tests */
  rand: () => number = Math.random;

  async onCreate(): Promise<void> {
    const rt = runtime();
    this.store = new ChunkStore(rt.config.worldSeed, 512);
    this.setPatchRate(TICK_MS);
    this.setSimulationInterval(() => this.tick(), TICK_MS);

    this.onMessage(MSG.INPUT, (client, msg: InputBatch) => this.onInput(client, msg));
    this.onMessage(MSG.CHUNK_REQ, (client, msg: ChunkReq) => { void this.onChunkReq(client, msg); });
    this.onMessage(MSG.EDIT, (client, msg: EditMsg) => { void this.onEdit(client, msg); });
    this.onMessage(MSG.PING, (client, msg: { t: number }) => {
      client.send(MSG.PONG, { t: typeof msg?.t === 'number' ? msg.t : 0, st: Date.now() });
    });
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

    const maxHp = maxHpForLevel(ch.level, BASE_PLAYER_HP);
    const st = new PlayerState();
    st.id = client.sessionId; st.name = ch.name; st.x = ch.x; st.y = ch.y;
    st.hp = Math.min(ch.hp > 0 ? ch.hp : maxHp, maxHp); st.maxHp = maxHp; st.level = ch.level;
    const p: ServerPlayer = {
      client, accountId, state: st, sim: newPlayerSim(ch.x, ch.y), queue: [], lastSeq: 0,
      hp: st.hp, maxHp, level: ch.level, xp: ch.xp, deadT: 0, invuln: 1.5, history: [],
      inputBucket: new TokenBucket(80, 160), chunkBucket: new TokenBucket(30, 60), editBucket: new TokenBucket(6, 10),
      view: new StateView(), inView: new Set(), hurtFlash: 0,
    };
    client.view = p.view;
    this.players.set(client.sessionId, p);
    this.byAccount.set(accountId, p);
    this.state.players.set(client.sessionId, st);
    p.view.add(st);
    p.inView.add(st.id);
    await rt.presence.set(accountId, client.sessionId);

    const welcome: WelcomeMsg = {
      seed: rt.config.worldSeed, serverNow: Date.now(), playerId: client.sessionId, name: ch.name,
      tickRate: Math.round(1000 / TICK_MS),
    };
    client.send(MSG.WELCOME, welcome);
  }

  async onLeave(client: Client): Promise<void> {
    const p = this.players.get(client.sessionId);
    if (p) await this.removePlayer(p, true);
  }

  async onDispose(): Promise<void> {
    await this.flushChunks();
    await Promise.all([...this.players.values()].map((p) => this.savePlayer(p)));
  }

  // ───────────────────────── helpers ─────────────────────────

  private async removePlayer(p: ServerPlayer, save: boolean): Promise<void> {
    if (this.players.get(p.client.sessionId) !== p) return;
    this.players.delete(p.client.sessionId);
    if (this.byAccount.get(p.accountId) === p) this.byAccount.delete(p.accountId);
    this.state.players.delete(p.client.sessionId);
    const rt = runtime();
    await rt.presence.clear(p.accountId, p.client.sessionId).catch(() => {});
    if (save) await this.savePlayer(p).catch((e) => console.error('save failed', e));
  }

  private async savePlayer(p: ServerPlayer): Promise<void> {
    await runtime().repo.saveCharacter({
      accountId: p.accountId, x: p.sim.x, y: p.sim.y, hp: Math.max(1, p.hp), level: p.level, xp: p.xp,
    });
  }

  private ensureChunk(cx: number, cy: number): Promise<void> {
    const k = key(cx, cy);
    if (this.loaded.has(k)) return Promise.resolve();
    let pr = this.loading.get(k);
    if (!pr) {
      pr = runtime().repo.loadChunkDiff(this.store.seed, cx, cy).then((diff) => {
        // edits made while loading take precedence
        const local = this.store.get(cx, cy).diff;
        const merged: ChunkDiff = new Map([...diff, ...local]);
        this.store.applyDiff(cx, cy, merged);
        this.loaded.add(k);
        this.loading.delete(k);
      }).catch((e) => { this.loading.delete(k); throw e; });
      this.loading.set(k, pr);
    }
    return pr;
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
      await runtime().repo.saveChunkDiffs(this.store.seed, diffs);
    } catch (e) {
      batch.forEach((k) => this.dirtyChunks.add(k)); // retry next time; never lose edits
      throw e;
    }
  }

  private nearby(x: number, y: number, radius: number): ServerPlayer[] {
    const out: ServerPlayer[] = [];
    for (const p of this.players.values()) if (Math.hypot(p.sim.x - x, p.sim.y - y) <= radius) out.push(p);
    return out;
  }

  private fx(msg: FxMsg, radius = (INTEREST_RADIUS + 0.5) * CHUNK_SIZE): void {
    for (const p of this.nearby(msg.x, msg.y, radius)) p.client.send(MSG.FX, msg);
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

  private async onChunkReq(client: Client, msg: ChunkReq): Promise<void> {
    const p = this.players.get(client.sessionId);
    if (!p || !Number.isInteger(msg?.cx) || !Number.isInteger(msg?.cy)) return;
    if (!p.chunkBucket.take()) return;
    const pcx = chunkOf(Math.floor(p.sim.x)), pcy = chunkOf(Math.floor(p.sim.y));
    if (Math.abs(msg.cx - pcx) > INTEREST_RADIUS + 1 || Math.abs(msg.cy - pcy) > INTEREST_RADIUS + 1) return;
    await this.ensureChunk(msg.cx, msg.cy);
    client.send(MSG.CHUNK, { cx: msg.cx, cy: msg.cy, diff: encodeDiff(this.store.get(msg.cx, msg.cy).diff) });
  }

  private async onEdit(client: Client, msg: EditMsg): Promise<void> {
    const p = this.players.get(client.sessionId);
    if (!p || p.deadT > 0 || !Number.isInteger(msg?.tx) || !Number.isInteger(msg?.ty)) return;
    if (!p.editBucket.take()) return;
    if (Math.hypot(msg.tx + 0.5 - p.sim.x, msg.ty + 0.5 - p.sim.y) > EDIT_REACH) return;
    await this.ensureChunk(chunkOf(msg.tx), chunkOf(msg.ty));
    const cur = this.store.getTile(msg.tx, msg.ty);
    const to = TILE_DEFS[cur]?.breaksTo ?? -1;
    if (to < 0) return;
    const { cx, cy } = this.store.setTile(msg.tx, msg.ty, to);
    this.dirtyChunks.add(key(cx, cy));
    for (const q of this.nearby(msg.tx, msg.ty, (INTEREST_RADIUS + 1) * CHUNK_SIZE)) {
      q.client.send(MSG.TILE, { tx: msg.tx, ty: msg.ty, tile: to });
    }
    this.fx({ kind: 'break', x: msg.tx + 0.5, y: msg.ty + 0.5 });
  }

  // ───────────────────────── simulation ─────────────────────────

  /** Spawn an enemy (also used by the ambient spawner and by tests). */
  spawnEnemy(kind: 'slime' | 'hopper', x: number, y: number, night = isNight(Date.now())): Enemy {
    const e = createEnemy(kind, x, y, night);
    this.enemies.set(e.id, e);
    this.state.enemies.set(e.id, e.state);
    return e;
  }

  tick(): void {
    this.state.tick++;
    const tick = this.state.tick;
    const now = Date.now();
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
    if (this.spawnTimer <= 0) { this.spawnTimer = 1; if (runtime().ambientSpawns) this.ambientSpawn(now); this.despawnFar(); }

    this.updateViews();

    this.autosaveTimer += TICK_DT * 1000;
    if (this.autosaveTimer >= runtime().config.autosaveMs) {
      this.autosaveTimer = 0;
      void this.autosave();
    }
  }

  private async autosave(): Promise<void> {
    try {
      await this.flushChunks();
      await Promise.all([...this.players.values()].map((p) => this.savePlayer(p)));
    } catch (e) { console.error('autosave failed', e); }
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
      if (ev.dashed) this.fx({ kind: 'dash', x: p.sim.x, y: p.sim.y, dx: p.sim.faceX, dy: p.sim.faceY });
      if (ev.attacked) this.resolveMelee(p, cmd, ev.combo, tick);
      if (ev.skill) this.spawnProjectile(p);
    }
    p.history.push({ tick, x: p.sim.x, y: p.sim.y });
    if (p.history.length > 12) p.history.shift();

    const s = p.state;
    s.x = p.sim.x; s.y = p.sim.y; s.faceX = p.sim.faceX; s.faceY = p.sim.faceY;
    s.hp = p.hp; s.maxHp = p.maxHp; s.level = p.level; s.ack = p.lastSeq;
    s.flags = (p.sim.dashT > 0 ? 1 : 0) | (p.sim.atkCd > 0.12 ? 2 : 0) | (p.deadT > 0 ? 4 : 0);
  }

  private resolveMelee(p: ServerPlayer, cmd: InputCmd, combo: number, tick: number): void {
    const hit = COMBO[combo]!;
    const rewindTick = Math.min(tick, Math.max(cmd.viewTick, tick - MAX_REWIND_TICKS));
    this.fx({ kind: 'swing', x: p.sim.x, y: p.sim.y, dx: p.sim.faceX, dy: p.sim.faceY, v: combo });
    for (const e of [...this.enemies.values()]) {
      const pos = rewindPosition(e.history, rewindTick) ?? { x: e.x, y: e.y };
      if (!inArc(p.sim.x, p.sim.y, p.sim.faceX, p.sim.faceY, hit, { x: pos.x, y: pos.y, r: e.def.radius })) continue;
      this.damageEnemy(e, hit.damage, p, p.sim.faceX, p.sim.faceY, hit.knockback);
    }
  }

  private spawnProjectile(p: ServerPlayer): void {
    const id = `p${++this.projSeq}`;
    const st = new ProjectileState();
    st.id = id; st.x = p.sim.x; st.y = p.sim.y; st.owner = p.client.sessionId;
    const pr: Projectile = { state: st, x: p.sim.x, y: p.sim.y, dx: p.sim.faceX, dy: p.sim.faceY, travelled: 0, owner: p.client.sessionId };
    this.projectiles.set(id, pr);
    this.state.projectiles.set(id, st);
    this.fx({ kind: 'shot', x: p.sim.x, y: p.sim.y, dx: pr.dx, dy: pr.dy });
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
            this.damageEnemy(e, PROJECTILE_DAMAGE, owner, pr.dx, pr.dy, 3);
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

  private damageEnemy(e: Enemy, dmg: number, by: ServerPlayer | null, dx: number, dy: number, kb: number): void {
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
    if (killer) this.giveXp(killer, Math.round(e.def.xp * (e.night ? 1.5 : 1)));
  }

  private giveXp(p: ServerPlayer, xp: number): void {
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
      const dmg = enemyDamage(e);
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
    if (this.enemies.size >= MAX_ENEMIES) return;
    const night = isNight(now);
    for (const p of this.players.values()) {
      if (p.deadT > 0) continue;
      let near = 0;
      for (const e of this.enemies.values()) if (Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 32) near++;
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

  private despawnFar(): void {
    for (const e of [...this.enemies.values()]) {
      let close = false;
      for (const p of this.players.values()) if (Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 48) { close = true; break; }
      if (!close) { this.enemies.delete(e.id); this.state.enemies.delete(e.id); }
    }
  }

  /** Interest management: each client only receives entities within INTEREST_RADIUS chunks. */
  private updateViews(): void {
    const ents: Array<{ id: string; cx: number; cy: number; st: PlayerState | Enemy['state'] | ProjectileState }> = [];
    for (const p of this.players.values()) ents.push({ id: p.client.sessionId, cx: chunkOf(Math.floor(p.sim.x)), cy: chunkOf(Math.floor(p.sim.y)), st: p.state });
    for (const e of this.enemies.values()) ents.push({ id: e.id, cx: chunkOf(Math.floor(e.x)), cy: chunkOf(Math.floor(e.y)), st: e.state });
    for (const pr of this.projectiles.values()) ents.push({ id: pr.state.id, cx: chunkOf(Math.floor(pr.x)), cy: chunkOf(Math.floor(pr.y)), st: pr.state });
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

export function sanitizeName(n: unknown): string {
  if (typeof n !== 'string') return '';
  return n.replace(/[^\p{L}\p{N} _'-]/gu, '').trim().slice(0, NAME_MAX);
}

