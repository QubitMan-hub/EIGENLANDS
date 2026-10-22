import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import type { ChatMsg, ClassId } from '@eigenlands/shared';
import { TokenBucket } from '../../rate';
import { runtime } from '../../rooms/runtime';
import type { Bus } from '../bus';
import { runtime34 } from '../runtime34';
import { MemoryPartyStore, PartyRegistry, RedisPartyStore, type PartyRec } from './party';

/**
 * Process-wide social state shared by every shard room in this process: the online directory, the party registry
 * (mirrored to other processes over the bus), pending invites, the global chat log and per-account chat limits.
 * Everything that must survive a shard handoff lives here (keyed by account), not in a room.
 */

/** Live party-member data published by the member's shard at ~2 Hz on `party:<id>`. */
export interface LiveInfo { a: string; n: string; l: number; c: ClassId; hp: number; mh: number; x: number; y: number; s: string; at: number }

export interface DirEntry { accountId: string; name: string; shard: string; sid: string; at: number }

export interface Invite { partyId: string; from: string; fromId: string; fromLevel: number; fromCls: ClassId; exp: number }

/** Per-account chat moderation state (kept across handoffs). */
export interface ChatLimits {
  buckets: Record<'local' | 'global' | 'party' | 'whisper', TokenBucket>;
  warnAt: number;
  recent: Array<{ norm: string; t: number }>;
  emoteAt: number;
  reports: number[];
  mutedUntil: number;
  /** lines this account received (context for /report) */
  log: ChatMsg[];
  /** last whisper partner name (for server-side sanity, the client keeps its own) */
  seen: number;
}

/** Bus messages on `player:<accountId>` (the shard module uses `t: 'kick'` on the same channel). */
export type PlayerBusMsg =
  | { t: 'whisper'; msg: ChatMsg }
  | { t: 'pinvite'; inv: Invite }
  | { t: 'sys'; text: string };

/** Bus messages on `party:<id>`. */
export type PartyBusMsg =
  | { t: 'live'; list: LiveInfo[] }
  | { t: 'chat'; msg: ChatMsg };

/** What a room's social module must implement for the hub to fan messages out to it. */
export interface HubRoom {
  onPartyChanged(id: string): void;
  onGlobalChat(msg: ChatMsg): void;
  onPartyChat(partyId: string, msg: ChatMsg): void;
}

export const GLOBAL_LOG = 30;
export const LIVE_STALE_MS = 15_000;
const DIR_KEY = 'eig:online';
const DIR_STALE_MS = 90_000;
const DEL_IF_SID = `local v = redis.call('hget', KEYS[1], ARGV[1])
if v then local o = cjson.decode(v) if o.sid == ARGV[2] then return redis.call('hdel', KEYS[1], ARGV[1]) end end
return 0`;

/** Online characters by name: this process's players, plus a Redis hash shared by every process in a cluster. */
export class Directory {
  private local = new Map<string, DirEntry>();
  constructor(private redis: Redis | null) {}

  add(e: DirEntry): void {
    this.local.set(e.accountId, e);
    void this.redis?.hset(DIR_KEY, e.name.toLowerCase(), JSON.stringify({ ...e, at: Date.now() })).catch(() => {});
  }

  remove(accountId: string, sid: string): void {
    const e = this.local.get(accountId);
    if (!e || e.sid !== sid) return;
    this.local.delete(accountId);
    void this.redis?.eval(DEL_IF_SID, 1, DIR_KEY, e.name.toLowerCase(), sid).catch(() => {});
  }

  /** keep this process's entries fresh in Redis */
  refresh(): void {
    if (!this.redis || !this.local.size) return;
    const now = Date.now();
    const args: string[] = [];
    for (const e of this.local.values()) args.push(e.name.toLowerCase(), JSON.stringify({ ...e, at: now }));
    void this.redis.hset(DIR_KEY, ...args).catch(() => {});
  }

  localByAccount(accountId: string): DirEntry | undefined { return this.local.get(accountId); }

  async find(name: string): Promise<DirEntry | null> {
    const n = name.trim().toLowerCase();
    if (!n) return null;
    for (const e of this.local.values()) if (e.name.toLowerCase() === n) return e;
    if (!this.redis) return null;
    try {
      const raw = await this.redis.hget(DIR_KEY, n);
      if (!raw) return null;
      const e = JSON.parse(raw) as DirEntry;
      return e && typeof e.accountId === 'string' && Date.now() - e.at < DIR_STALE_MS ? e : null;
    } catch { return null; }
  }
}

export class SocialHub {
  readonly dir: Directory;
  readonly parties: PartyRegistry;
  /** target account -> party id -> invite */
  readonly invites = new Map<string, Map<string, Invite>>();
  /** inviter account -> the party id their invites create (before anyone accepted) */
  readonly pendingParty = new Map<string, { id: string; exp: number }>();
  readonly globalLog: ChatMsg[] = [];
  readonly live = new Map<string, LiveInfo>();
  /** account -> trade save in flight / when its last trade finished (a new session reloads after a trade) */
  readonly tradeBusy = new Map<string, Promise<void>>();
  readonly tradeEnd = new Map<string, number>();
  private limits = new Map<string, ChatLimits>();
  private rooms = new Set<HubRoom>();
  private watched = new Map<string, { n: number; since: number; off: () => void }>();
  private subs: Array<() => void> = [];
  private timer: ReturnType<typeof setInterval>;
  private redis: Redis | null = null;

  constructor(readonly bus: Bus) {
    if (bus.kind === 'redis' && runtime().config.redisUrl) {
      this.redis = new Redis(runtime().config.redisUrl!, { maxRetriesPerRequest: 1 });
      this.redis.on('error', () => {});
    }
    this.dir = new Directory(this.redis);
    this.parties = new PartyRegistry(this.redis ? new RedisPartyStore(this.redis) : new MemoryPartyStore(), bus, (id) => this.partyChanged(id));
    this.subs.push(bus.subscribe('chat:global', (m) => this.onGlobal(m)));
    let n = 0;
    this.timer = setInterval(() => {
      n++;
      this.sweep();
      if (n % 6 === 0) this.dir.refresh();
    }, 5000);
    this.timer.unref?.();
  }

  register(r: HubRoom): void { this.rooms.add(r); }
  unregister(r: HubRoom): void { this.rooms.delete(r); }

  private partyChanged(id: string): void { for (const r of this.rooms) r.onPartyChanged(id); }

  private onGlobal(raw: unknown): void {
    const m = raw as { msg?: ChatMsg } | null;
    const msg = m?.msg;
    if (!msg || typeof msg.text !== 'string' || msg.ch !== 'global') return;
    this.globalLog.push(msg);
    if (this.globalLog.length > GLOBAL_LOG) this.globalLog.splice(0, this.globalLog.length - GLOBAL_LOG);
    for (const r of this.rooms) r.onGlobalChat(msg);
  }

  /** Follow a party's live channel (ref-counted per room). Returns the release function. */
  watchParty(id: string): () => void {
    let w = this.watched.get(id);
    if (!w) {
      const off = this.bus.subscribe(`party:${id}`, (m) => this.onPartyBus(id, m as PartyBusMsg));
      w = { n: 0, since: Date.now(), off };
      this.watched.set(id, w);
    }
    w.n++;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      const cur = this.watched.get(id);
      if (!cur) return;
      if (--cur.n <= 0) { cur.off(); this.watched.delete(id); }
    };
  }

  private onPartyBus(id: string, m: PartyBusMsg): void {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'live' && Array.isArray(m.list)) {
      for (const l of m.list) if (l && typeof l.a === 'string') this.live.set(l.a, l);
    } else if (m.t === 'chat' && m.msg && typeof m.msg.text === 'string') {
      for (const r of this.rooms) r.onPartyChat(id, m.msg);
    }
  }

  /** When did we start listening to this party (live data before then is unknown, not stale). */
  watchedSince(id: string): number { return this.watched.get(id)?.since ?? Date.now(); }

  limitsOf(accountId: string): ChatLimits {
    let l = this.limits.get(accountId);
    if (!l) {
      l = {
        buckets: { local: new TokenBucket(2, 4), global: new TokenBucket(1 / 3, 1), party: new TokenBucket(2, 4), whisper: new TokenBucket(2, 4) },
        warnAt: 0, recent: [], emoteAt: 0, reports: [], mutedUntil: 0, log: [], seen: Date.now(),
      };
      this.limits.set(accountId, l);
    }
    l.seen = Date.now();
    return l;
  }

  addInvite(target: string, inv: Invite): void {
    let m = this.invites.get(target);
    if (!m) { m = new Map(); this.invites.set(target, m); }
    m.set(inv.partyId, inv);
  }

  takeInvite(target: string, partyId: string): Invite | null {
    const m = this.invites.get(target);
    const inv = m?.get(partyId) ?? null;
    if (!m || !inv) return null;
    m.delete(partyId);
    if (!m.size) this.invites.delete(target);
    return inv.exp > Date.now() ? inv : null;
  }

  invitesFor(target: string): Invite[] {
    const now = Date.now();
    return [...(this.invites.get(target)?.values() ?? [])].filter((i) => i.exp > now);
  }

  /** The id an inviter's next party will get (stable while their invites are out). */
  partyIdFor(accountId: string): string {
    const now = Date.now();
    const cur = this.pendingParty.get(accountId);
    if (cur && cur.exp > now) { cur.exp = now + 70_000; return cur.id; }
    const id = `pt_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.pendingParty.set(accountId, { id, exp: now + 70_000 });
    return id;
  }

  /** Housekeeping: expire invites and stale limits, drop offline party members, hand leadership over. */
  private sweep(): void {
    const now = Date.now();
    for (const [k, m] of this.invites) { for (const [id, i] of m) if (i.exp <= now) m.delete(id); if (!m.size) this.invites.delete(k); }
    for (const [k, v] of this.pendingParty) if (v.exp <= now) this.pendingParty.delete(k);
    for (const [k, l] of this.limits) if (now - l.seen > 15 * 60_000 && !this.dir.localByAccount(k)) this.limits.delete(k);
    for (const [k, l] of this.live) if (now - l.at > 10 * 60_000) this.live.delete(k);
    for (const [k, t] of this.tradeEnd) if (now - t > 60_000) this.tradeEnd.delete(k);
    for (const id of this.watched.keys()) {
      const p = this.parties.get(id);
      if (p) void this.parties.sweep(p, now, (a) => this.lastSeen(id, a)).catch(() => {});
    }
  }

  /** When an account was last known to be online (live heartbeat, or a local player right now). */
  lastSeen(partyId: string, accountId: string): number {
    if (this.dir.localByAccount(accountId)) return Date.now();
    return Math.max(this.live.get(accountId)?.at ?? 0, this.watchedSince(partyId));
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    for (const off of this.subs) off();
    for (const w of this.watched.values()) w.off();
    this.watched.clear();
    this.parties.close();
    this.redis?.disconnect();
  }
}

let current: SocialHub | null = null;

/** The hub for the current runtime (tests start several apps in one process; each gets a fresh hub). */
export function hub(): SocialHub {
  const bus = runtime34().bus;
  if (!current || current.bus !== bus) {
    void current?.close();
    current = new SocialHub(bus);
  }
  return current;
}

/** for tests */
export function peekHub(): SocialHub | null { return current; }

export type { PartyRec };
