import { CaveModule } from '../features/caves';
import { matchMaker, type Client } from 'colyseus';
import type { Schema } from '@colyseus/schema';
import {
  CLASS_INDEX,
  MSG,
  MSG34,
  NPCS,
  delverRounds,
  realmNpcs,
  REALM_SITE_BY_ID,
  PORTS,
  CAVE_TOWNS,
  chunkOf,
  encodeDiff,
  inRegion,
  parseShard,
  regionBounds,
  shardAt,
  shardId,
  townFor,
  type ObjMsg,
  type ChunkReq,
  type HandoffMsg,
  type Region,
  type ShardInfoMsg,
  type SpellState,
  type StrikeShape,
  type WeaponShot,
  type WorldObj,
} from '@eigenlands/shared';
import type { Enemy } from '../game/enemies';
import { TokenBucket } from '../rate';
import { CircuitModule } from '../features/circuit';
import { runtime34 } from '../features/runtime34';
import { ShardModule } from '../features/shard';
import { signTicket, verifyTicket } from '../features/shard/ticket';
import { nullVillage } from '../features/shard/nullVillage';
import { BossModule } from '../features/bosses';
import { ShadowModule } from '../features/shadows';
import { SailingModule } from '../features/sailing';
import { ArmyModule } from '../features/armies';
import { VoiceModule } from '../features/voice';
import { ShrineModule } from '../features/shrines';
import { SocialModule } from '../features/social';
import type { BucketName, Carry, JoinOpts, Module, Registrar } from '../features/types';
import type { VillageHost, VillageSystem } from '../systems/types';
import { createVillage } from '../systems/village';
import type { ServerPlayer } from './player';
import { runtime } from './runtime';
import { WorldRoom } from './WorldRoom';

/** Shards whose previous room is still saving: a new room for the same shard waits for it. */
const disposing = new Map<string, Promise<void>>();

const BUCKETS: Record<BucketName, [number, number]> = {
  cast: [8, 12],
  board: [2, 4],
  party: [2, 5],
  chat: [2, 4],
  voice: [40, 80],
  trade: [4, 8],
  emote: [1, 3],
};

/**
 * The Phase 3/4 world room: one shard (region) of the world, plus the Circuit Board, abilities, parties, chat,
 * trading, handoffs and ghosts. Phase 1/2 behaviour lives unchanged in WorldRoom; this class plugs in through its hooks.
 */
export class GameRoom extends WorldRoom {
  region: Region = { rx: 0, ry: 0 };
  shard = '0,0';
  /** a room joined without a shard id outside production simulates the whole world (tools, tests, old clients) */
  unsharded = false;
  /** set when another room already owns this shard: every join is redirected there */
  private redirectTo: string | null = null;
  circuit!: CircuitModule;
  social!: SocialModule;
  shadows!: ShadowModule;
  sailing!: SailingModule;
  army!: ArmyModule;
  voice!: VoiceModule;
  bosses!: BossModule;
  caves!: CaveModule;
  shrines!: ShrineModule;
  shardMod!: ShardModule;
  private modules: Module[] = [];
  private buckets = new Map<string, Map<BucketName, TokenBucket>>();
  /** read-only copies of neighbouring shards' chunks (diff loaded, objects cached) */
  private foreign = new Map<
    string,
    { at: number; objs: WorldObj[]; pr: Promise<void> | null; live: Map<string, ObjMsg> }
  >();
  private lockTimer: ReturnType<typeof setInterval> | null = null;

  async onCreate(options: JoinOpts = {}): Promise<void> {
    const asked = parseShard(options?.shard);
    this.unsharded = !asked && process.env.NODE_ENV !== 'production';
    this.region = asked ?? { rx: 0, ry: 0 };
    this.shard = this.unsharded ? '*' : shardId(this.region);
    const locks = runtime34().locks;
    await disposing.get(this.shard);
    const owner = await locks.claim(this.shard, this.roomId, (id) => {
      const r = matchMaker.getLocalRoomById(id) as GameRoom | undefined;
      return !!r && !r.disposed;
    });
    if (owner !== this.roomId) this.redirectTo = owner;
    else
      this.lockTimer = setInterval(() => {
        void locks.refresh(this.shard, this.roomId).catch(() => {});
      }, 5000);
    await this.setMetadata({ shard: this.shard });

    await super.onCreate();
    if (this.redirectTo) return;

    this.shardMod = new ShardModule(this);
    this.circuit = new CircuitModule(this);
    this.social = new SocialModule(this);
    this.shadows = new ShadowModule(this);
    this.sailing = new SailingModule(this);
    this.army = new ArmyModule(this);
    this.voice = new VoiceModule(this);
    this.bosses = new BossModule(this);
    this.shrines = new ShrineModule(this);
    this.caves = new CaveModule(this);
    this.modules = [
      this.shardMod,
      this.circuit,
      this.social,
      this.shadows,
      this.bosses,
      this.caves,
      this.shrines,
      this.sailing,
      this.army,
      this.voice,
    ];
    const reg: Registrar = {
      on: <M>(type: string, bucket: BucketName, fn: (p: ServerPlayer, msg: M) => void | Promise<void>) => {
        this.onMessage(type, (client: Client, msg: M) => {
          const p = this.players.get(client.sessionId);
          if (!p || !this.bucket(p.id, bucket).take() || !msg || typeof msg !== 'object') return;
          try {
            const r = fn(p, msg);
            if (r instanceof Promise) r.catch((e) => console.error(`${type} failed`, e));
          } catch (e) {
            console.error(`${type} failed`, e);
          }
        });
      },
    };
    for (const m of this.modules) m.install(reg);
  }

  private bucket(sid: string, name: BucketName): TokenBucket {
    let m = this.buckets.get(sid);
    if (!m) {
      m = new Map();
      this.buckets.set(sid, m);
    }
    let b = m.get(name);
    if (!b) {
      const [rate, burst] = BUCKETS[name];
      b = new TokenBucket(rate, burst);
      m.set(name, b);
    }
    return b;
  }

  async onJoin(client: Client, options: JoinOpts & { name?: string }, auth: { accountId: string }): Promise<void> {
    if (this.redirectTo) {
      const m: HandoffMsg = {
        shard: this.shard,
        roomId: this.redirectTo,
        ticket: signTicket(auth.accountId, this.shard, {}, runtime().config.sessionSecret),
      };
      client.send(MSG34.HANDOFF, m);
      setTimeout(() => client.leave(4002), 2000);
      return;
    }
    const carry = options?.ticket
      ? verifyTicket(options.ticket, auth.accountId, this.shard, runtime().config.sessionSecret)
      : null;
    // one live session per account across every shard
    this.shardMod.claimAccount(auth.accountId, client.sessionId);
    await super.onJoin(client, options, auth);
    const p = this.players.get(client.sessionId);
    if (!p) return;
    const b = regionBounds(this.region);
    const info: ShardInfoMsg = { id: this.shard, ...b };
    client.send(MSG34.SHARD, info);
    for (const m of this.modules) await m.join?.(p, carry);
  }

  async onLeave(client: Client): Promise<void> {
    const p = this.players.get(client.sessionId);
    if (p)
      for (const m of this.modules)
        await Promise.resolve(m.leave?.(p, 'leave')).catch((e) => console.error('leave failed', e));
    this.buckets.delete(client.sessionId);
    await super.onLeave(client);
  }

  /** Remove a player because they moved to another shard or signed in elsewhere. Saves everything first. */
  async detach(p: ServerPlayer, reason: 'handoff' | 'kick'): Promise<Carry> {
    const carry: Carry = {};
    for (const m of this.modules) m.carry?.(p, carry);
    for (const m of this.modules)
      await Promise.resolve(m.leave?.(p, reason)).catch((e) => console.error('leave failed', e));
    this.buckets.delete(p.id);
    await this.removePlayer(p, true);
    return carry;
  }

  protected async savePlayer(p: ServerPlayer): Promise<void> {
    await super.savePlayer(p);
    for (const m of this.modules) await m.save?.(p);
  }

  disposed = false;

  async onDispose(): Promise<void> {
    if (this.lockTimer) clearInterval(this.lockTimer);
    if (this.redirectTo) {
      this.disposed = true;
      return;
    }
    const done = (async () => {
      await super.onDispose();
      for (const m of this.modules) await m.dispose?.().catch((e) => console.error('dispose failed', e));
      await runtime34()
        .locks.release(this.shard, this.roomId)
        .catch(() => {});
    })();
    disposing.set(this.shard, done);
    try {
      await done;
    } finally {
      this.disposed = true;
      if (disposing.get(this.shard) === done) disposing.delete(this.shard);
    }
  }

  // ───────────────────────── shard ownership ─────────────────────────

  owns(x: number, y: number): boolean {
    return this.unsharded || inRegion(this.region, x, y);
  }
  ownsChunk(cx: number, cy: number): boolean {
    return this.owns(cx * 32, cy * 32);
  }

  protected makeVillage(host: VillageHost): VillageSystem {
    const t = townFor(host.seed);
    const ids = NPCS.filter((n) => {
      const port = [...PORTS, ...CAVE_TOWNS].find((p) => p.id === n.settlement);
      return this.unsharded || shardAt(port?.cx ?? t.cx, port?.cy ?? t.cy) === this.shard;
    }).map((n) => n.id);
    // travelling merchants belong to the shard of their round (revision 4 only)
    if (this.store.generation >= 4)
      for (const r of delverRounds(this.seed))
        if (r.camps.length && (this.unsharded || r.shard === this.shard)) ids.push(r.id);
    // kingdom residents belong to the shard their settlement plot stands in (revision 5)
    if (this.store.generation >= 5)
      for (const n of realmNpcs()) {
        const site = REALM_SITE_BY_ID[n.site!];
        if (site && (this.unsharded || shardAt(site.cx, site.cy) === this.shard)) ids.push(n.id);
      }
    if (!ids.length) return nullVillage();
    const prefix = this.unsharded || shardAt(t.cx, t.cy) === this.shard ? '' : `${this.shard}:`;
    return createVillage(
      {
        ...host,
        hire: (player, id) => {
          const p = this.players.get(player.id);
          return p ? this.shadows.hire(p, id) : 'The guild is unavailable.';
        },
        loadBlob: (key) => host.loadBlob(prefix + key),
        saveBlob: (key, value) => host.saveBlob(prefix + key, value),
      },
      { npcIds: ids },
    );
  }

  /** World edits (anything aimed at a tile) are only accepted for this shard's own tiles. */
  protected hookAccepts(_p: ServerPlayer, msg: unknown): boolean {
    const m = msg as { tx?: unknown; ty?: unknown } | null;
    if (m && typeof m === 'object' && typeof m.tx === 'number' && typeof m.ty === 'number')
      return this.owns(m.tx, m.ty);
    return true;
  }

  /** Neighbouring shards' chunks are loaded read-only: tiles for collision and drawing, never saved or simulated here. */
  ensureChunk(cx: number, cy: number): Promise<void> {
    if (this.ownsChunk(cx, cy)) return super.ensureChunk(cx, cy);
    return this.ensureForeign(cx, cy);
  }

  private ensureForeign(cx: number, cy: number, maxAgeMs = Infinity): Promise<void> {
    const k = `${cx},${cy}`;
    const f = this.foreign.get(k);
    if (f && (f.pr || (f.at > 0 && Date.now() - f.at < maxAgeMs))) return f.pr ?? Promise.resolve();
    const rec = f ?? { at: 0, objs: [], pr: null, live: new Map<string, ObjMsg>() };
    const repo = runtime().repo;
    rec.pr = Promise.all([repo.loadChunkDiff(this.seed, cx, cy), repo.loadObjects(this.seed, cx, cy)])
      .then(([diff, objs]) => {
        // tiles relayed live by the owner shard win over the stored copy
        const live = this.store.get(cx, cy).diff;
        this.store.applyDiff(cx, cy, new Map([...diff, ...live]));
        // Live object relays win over a stored snapshot, just like live terrain diffs.
        for (const old of rec.objs) {
          if (old.kind === 'structure') this.store.removeStructure(old.x, old.y);
          else if (!old.static) this.store.removeObject(old.x, old.y);
        }
        const merged = new Map(objs.map((o) => [`${o.kind === 'structure' ? 's:' : ''}${o.x},${o.y}`, o]));
        for (const [k, m] of rec.live)
          if (m.obj) merged.set(k, m.obj);
          else merged.delete(k);
        rec.objs = [...merged.values()];
        for (const o of rec.objs) this.store.putObject(o);
        rec.at = Date.now();
        rec.pr = null;
      })
      .catch((e) => {
        rec.pr = null;
        throw e;
      });
    this.foreign.set(k, rec);
    return rec.pr;
  }

  protected async onChunkReq(client: Client, msg: ChunkReq): Promise<void> {
    if (!Number.isInteger(msg?.cx) || !Number.isInteger(msg?.cy) || this.ownsChunk(msg.cx, msg.cy))
      return super.onChunkReq(client, msg);
    const p = this.players.get(client.sessionId);
    if (!p || !p.chunkBucket.take()) return;
    const pcx = chunkOf(Math.floor(p.sim.x)),
      pcy = chunkOf(Math.floor(p.sim.y));
    if (Math.abs(msg.cx - pcx) > 3 || Math.abs(msg.cy - pcy) > 3) return;
    await this.ensureForeign(msg.cx, msg.cy, 5000);
    const objs: WorldObj[] = [
      ...this.store.townObjectsIn(msg.cx, msg.cy),
      ...(this.foreign.get(`${msg.cx},${msg.cy}`)?.objs ?? []),
    ];
    const chunk = this.store.get(msg.cx, msg.cy);
    client.send(MSG.CHUNK, {
      cx: msg.cx,
      cy: msg.cy,
      diff: encodeDiff(chunk.diff),
      objs,
      ...(chunk.levels ? { levels: chunk.levels } : {}),
    });
  }

  protected hookObjectChanged(m: ObjMsg): void {
    this.shardMod?.objectChanged(m);
  }

  /** Read-only collision/transport cache. Foreign edits are still refused at hookAccepts. */
  applyForeignObject(m: ObjMsg): void {
    if (this.owns(m.x, m.y)) return;
    const ck = `${chunkOf(m.x)},${chunkOf(m.y)}`;
    let rec = this.foreign.get(ck);
    if (!rec) {
      rec = { at: 0, objs: [], pr: null, live: new Map() };
      this.foreign.set(ck, rec);
    }
    const structural = !!m.structure || m.obj?.kind === 'structure',
      k = `${structural ? 's:' : ''}${m.x},${m.y}`;
    rec.live.set(k, m);
    rec.objs = rec.objs.filter((o) => !(o.x === m.x && o.y === m.y && (o.kind === 'structure') === structural));
    if (m.obj) {
      rec.objs.push(m.obj);
      this.store.putObject(m.obj);
    } else if (structural) this.store.removeStructure(m.x, m.y);
    else this.store.removeObject(m.x, m.y);
    for (const p of this.nearby(m.x, m.y, 3 * 32)) p.client.send(MSG.OBJ, m);
  }

  /** A tile changed in a neighbouring shard (relayed over the bus). */
  applyForeignTile(x: number, y: number, tile: number): void {
    if (this.owns(x, y)) return;
    this.store.setTile(x, y, tile);
    for (const q of this.nearby(x, y, 3 * 32)) q.client.send(MSG.TILE, { tx: x, ty: y, tile });
  }

  // ───────────────────────── hooks → modules ─────────────────────────

  protected hookTileChanged(x: number, y: number, tile: number): void {
    this.shardMod?.tileChanged(x, y, tile);
  }

  protected hookTick(now: number): void {
    for (const p of this.players.values()) {
      const c = this.circuit?.classOf(p.id) ?? 'wanderer';
      p.state.cls = Math.max(0, CLASS_INDEX.indexOf(c));
      p.state.party = this.social?.partyOf(p.accountId) ?? '';
    }
    for (const m of this.modules) m.tick?.(now, 0.05);
  }

  protected hookViewEntities(push: (id: string, x: number, y: number, st: SpellState) => void): void {
    for (const m of this.modules) m.viewEntities?.(push as (id: string, x: number, y: number, st: Schema) => void);
  }

  protected hookWeaponShot(p: ServerPlayer, shot: WeaponShot, ax: number, ay: number, power: number): boolean {
    const eng = this.circuit?.engine;
    if (!eng) return false;
    eng.weaponShot(p, shot, ax, ay, power);
    return true;
  }

  summonBoss(p: ServerPlayer, itemId: string, x: number, y: number): boolean {
    return this.bosses?.summon(p, itemId, x, y) ?? false;
  }
  vaultGuard(p: ServerPlayer, o: WorldObj): boolean {
    return this.caves?.guard(p, o) ?? false;
  }
  toggleShip(p: ServerPlayer): void {
    this.sailing?.toggle(p);
  }
  shrineInteract(p: ServerPlayer, o: WorldObj): void {
    this.shrines?.interact(p, o);
  }

  protected hookTargets(): Array<{ id: string; x: number; y: number; alive: boolean }> {
    return [...(this.shadows?.targets() ?? []), ...(this.army?.targets() ?? [])];
  }
  protected hookStrike(e: Enemy, shape: StrikeShape, dmg: number): void {
    this.shadows?.strikeShadows(e, shape, dmg);
    this.army?.strikeUnits(e, shape, dmg);
  }

  protected hookWarZone(x: number, y: number): boolean {
    return this.army?.warZone(x, y) ?? false;
  }
  protected hookFire(e: Enemy, dx: number, dy: number): void {
    this.army?.shot(e, dx, dy);
  }

  protected hookKilled(e: Enemy, killer: ServerPlayer | undefined): void {
    for (const m of this.modules) m.killed?.(e, killer);
  }

  protected hookIncomingDamage(p: ServerPlayer, dmg: number, e: Enemy): number {
    let d = dmg;
    for (const m of this.modules) {
      if (d <= 0) break;
      if (m.incomingDamage) d = m.incomingDamage(p, d, e);
    }
    return d;
  }

  // ───────────────────────── combat access for modules ─────────────────────────

  /** Damage an enemy as `by` (drops, XP and kill credit work exactly like melee). */
  hitEnemy(e: Enemy, dmg: number, by: ServerPlayer | null, dx: number, dy: number, kb: number): void {
    if (!this.enemies.has(e.id) || e.hp <= 0) return;
    this.damageEnemy(e, Math.max(1, Math.round(dmg)), by, dx, dy, kb);
  }

  grantXp(p: ServerPlayer, xp: number): void {
    if (xp > 0) this.giveXp(p, Math.round(xp));
  }

  playerByAccount(accountId: string): ServerPlayer | undefined {
    return this.byAccount.get(accountId);
  }

  playerByName(name: string): ServerPlayer | undefined {
    const n = name.trim().toLowerCase();
    for (const p of this.players.values()) if (p.name.toLowerCase() === n) return p;
    return undefined;
  }
}
