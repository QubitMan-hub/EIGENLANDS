import type { Redis } from 'ioredis';
import { PARTY_MAX, type ClassId } from '@eigenlands/shared';
import type { Bus } from '../bus';

/**
 * Party records and where they live. A `PartyStore` is the source of truth (a Map in one process, Redis keys with
 * optimistic WATCH/MULTI transactions in a cluster). Every process keeps a read-only mirror (`PartyRegistry`) that
 * is updated synchronously by its own writes and by versioned snapshots other processes publish on the `parties`
 * channel, so `partyOf()` is a cheap synchronous lookup for nameplates and ally checks.
 */

/** offline members stay listed this long before they are dropped */
export const OFFLINE_KEEP_MS = 5 * 60_000;
export const PARTY_ID_RE = /^pt_[0-9a-f]{16}$/;

export interface PartyMemberRec {
  accountId: string;
  name: string;
  level: number;
  cls: ClassId;
  offlineSince: number;
}
export interface PartyRec {
  id: string;
  v: number;
  leader: string;
  members: PartyMemberRec[];
}

/** `undefined` = leave unchanged, `null` = disband. */
export type PartyFn = (cur: PartyRec | null) => PartyRec | null | undefined;
export interface MutateResult {
  changed: boolean;
  prev: PartyRec | null;
  party: PartyRec | null;
  v: number;
}

export class PartyConflict extends Error {
  constructor(readonly accountId: string) {
    super('already in another party');
  }
}

export interface PartyStore {
  mutate(id: string, fn: PartyFn): Promise<MutateResult>;
  close?(): void;
}

const clone = (p: PartyRec): PartyRec => ({ ...p, members: p.members.map((m) => ({ ...m })) });

/**
 * Drop members that have been offline too long, keep at least two members (otherwise disband) and make sure an online
 * member leads whenever anyone is online.
 */
export function normalizeParty(p: PartyRec, now: number): PartyRec | null {
  const members = p.members
    .filter((m) => !m.offlineSince || now - m.offlineSince < OFFLINE_KEEP_MS)
    .slice(0, PARTY_MAX);
  if (members.length < 2) return null;
  const online = members.filter((m) => !m.offlineSince);
  const lead = members.find((m) => m.accountId === p.leader);
  let leader = p.leader;
  if (!lead || (lead.offlineSince && online.length)) leader = (online[0] ?? members[0]!).accountId;
  return { ...p, leader, members };
}

const same = (a: PartyRec | null, b: PartyRec | null): boolean =>
  (!a && !b) || (!!a && !!b && a.leader === b.leader && JSON.stringify(a.members) === JSON.stringify(b.members));

function diffMembers(prev: PartyRec | null, next: PartyRec | null): { added: string[]; removed: string[] } {
  const before = new Set(prev?.members.map((m) => m.accountId) ?? []);
  const after = new Set(next?.members.map((m) => m.accountId) ?? []);
  return { added: [...after].filter((a) => !before.has(a)), removed: [...before].filter((a) => !after.has(a)) };
}

/** Single-process store. */
export class MemoryPartyStore implements PartyStore {
  private parties = new Map<string, PartyRec>();
  private byAcct = new Map<string, string>();

  async mutate(id: string, fn: PartyFn): Promise<MutateResult> {
    const cur = this.parties.get(id) ?? null;
    const next = fn(cur ? clone(cur) : null);
    if (next === undefined || same(cur, next)) return { changed: false, prev: cur, party: cur, v: cur?.v ?? 0 };
    const { added, removed } = diffMembers(cur, next);
    for (const a of added) {
      const o = this.byAcct.get(a);
      if (o && o !== id) throw new PartyConflict(a);
    }
    const v = (cur?.v ?? 0) + 1;
    for (const a of removed) if (this.byAcct.get(a) === id) this.byAcct.delete(a);
    if (next) {
      next.v = v;
      next.id = id;
      this.parties.set(id, clone(next));
      for (const m of next.members) this.byAcct.set(m.accountId, id);
    } else this.parties.delete(id);
    return { changed: true, prev: cur, party: next ? clone(next) : null, v };
  }
}

const PKEY = (id: string) => `eig:party:${id}`;
const MKEY = (a: string) => `eig:pm:${a}`;
const TTL_S = 7 * 86400;

/** Cluster store: one JSON key per party plus an account -> party index, changed only inside WATCH/MULTI. */
export class RedisPartyStore implements PartyStore {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private r: Redis) {}

  /** WATCH is per connection: run one transaction at a time on this client (other processes are fenced by WATCH). */
  private serial<T>(job: () => Promise<T>): Promise<T> {
    const p = this.chain.then(job, job);
    this.chain = p.catch(() => {});
    return p;
  }

  mutate(id: string, fn: PartyFn): Promise<MutateResult> {
    return this.serial(async () => {
      for (let tries = 0; tries < 10; tries++) {
        await this.r.watch(PKEY(id));
        const raw = await this.r.get(PKEY(id));
        let cur: PartyRec | null;
        try {
          cur = raw ? (JSON.parse(raw) as PartyRec) : null;
        } catch {
          cur = null;
        }
        const next = fn(cur ? clone(cur) : null);
        if (next === undefined || same(cur, next)) {
          await this.r.unwatch();
          return { changed: false, prev: cur, party: cur, v: cur?.v ?? 0 };
        }
        const { added, removed } = diffMembers(cur, next);
        if (added.length) {
          await this.r.watch(...added.map(MKEY));
          const owners = await this.r.mget(...added.map(MKEY));
          const bad = owners.findIndex((o) => o && o !== id);
          if (bad >= 0) {
            await this.r.unwatch();
            throw new PartyConflict(added[bad]!);
          }
        }
        const v = (cur?.v ?? 0) + 1;
        const tx = this.r.multi();
        if (next) {
          next.v = v;
          next.id = id;
          tx.set(PKEY(id), JSON.stringify(next), 'EX', TTL_S);
          for (const m of next.members) tx.set(MKEY(m.accountId), id, 'EX', TTL_S);
        } else tx.del(PKEY(id));
        for (const a of removed) tx.del(MKEY(a));
        const res = await tx.exec();
        if (res === null) continue; // someone else changed it: retry on the fresh value
        return { changed: true, prev: cur, party: next ? clone(next) : null, v };
      }
      throw new Error('party store busy');
    });
  }
}

interface Snapshot {
  id: string;
  v: number;
  party: PartyRec | null;
}

/** This process's mirror of every party, kept current by local writes and bus snapshots. */
export class PartyRegistry {
  private parties = new Map<string, PartyRec>();
  private byAcct = new Map<string, string>();
  /** deleted party id -> version at deletion (ignore late snapshots) */
  private tomb = new Map<string, number>();
  private off: () => void;

  constructor(
    private store: PartyStore,
    private bus: Bus,
    private changed: (id: string) => void,
  ) {
    this.off = bus.subscribe('parties', (m) => this.onSnapshot(m as Snapshot));
  }

  get(id: string): PartyRec | undefined {
    return this.parties.get(id);
  }
  partyOf(accountId: string): string {
    return this.byAcct.get(accountId) ?? '';
  }
  /** true when this party id existed and was disbanded (ids are never reused) */
  wasDeleted(id: string): boolean {
    return this.tomb.has(id);
  }
  partyRecOf(accountId: string): PartyRec | undefined {
    const id = this.byAcct.get(accountId);
    return id ? this.parties.get(id) : undefined;
  }

  /** Atomically change a party. Returns the result, or throws `PartyConflict` if someone joined two parties at once. */
  async update(id: string, fn: PartyFn): Promise<MutateResult> {
    const r = await this.store.mutate(id, fn);
    if (r.changed) {
      this.apply({ id, v: r.v, party: r.party });
      this.bus.publish('parties', { id, v: r.v, party: r.party } satisfies Snapshot);
    }
    return r;
  }

  private onSnapshot(s: Snapshot): void {
    if (!s || typeof s.id !== 'string' || !Number.isInteger(s.v)) return;
    this.apply(s);
  }

  private apply(s: Snapshot): void {
    const cur = this.parties.get(s.id);
    if ((cur && cur.v >= s.v) || (this.tomb.get(s.id) ?? -1) >= s.v) return;
    if (cur) for (const m of cur.members) if (this.byAcct.get(m.accountId) === s.id) this.byAcct.delete(m.accountId);
    if (s.party) {
      const p = clone(s.party);
      this.parties.set(s.id, p);
      for (const m of p.members) this.byAcct.set(m.accountId, s.id);
    } else {
      this.parties.delete(s.id);
      this.tomb.set(s.id, s.v);
      if (this.tomb.size > 5000) this.tomb.delete(this.tomb.keys().next().value!);
    }
    this.changed(s.id);
  }

  /**
   * Housekeeping for one party: members whose shard stopped reporting them go offline, long-offline members are
   * dropped and leadership moves to an online member. Writes only when something actually changes.
   */
  async sweep(p: PartyRec, now: number, lastSeen: (accountId: string) => number): Promise<void> {
    const fix = (cur: PartyRec | null): PartyRec | null | undefined => {
      if (!cur) return undefined;
      const marked: PartyRec = {
        ...cur,
        members: cur.members.map((m) => {
          if (m.offlineSince) return m;
          const seen = lastSeen(m.accountId);
          return now - seen > 15_000 ? { ...m, offlineSince: seen } : m;
        }),
      };
      return normalizeParty(marked, now);
    };
    const want = fix(clone(p));
    if (want !== undefined && same(p, want)) return;
    await this.update(p.id, fix);
  }

  close(): void {
    this.off();
    this.store.close?.();
  }
}
