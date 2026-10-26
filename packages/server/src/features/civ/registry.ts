import type { CivWorld, Ledger, RealmId } from '@eigenlands/shared';

/**
 * One civilization per world, shared by every shard room in this process (the solo build and a single server both run
 * all their rooms in one process). Rooms in other processes keep their own copy and the last save wins; see
 * docs/LIVING_WORLD.md.
 */
interface Entry {
  w: CivWorld | null;
  loading: Promise<void> | null;
  dirty: boolean;
}
const worlds = new Map<number, Entry>();

export function civEntry(seed: number): Entry {
  let e = worlds.get(seed);
  if (!e) {
    e = { w: null, loading: null, dirty: false };
    worlds.set(seed, e);
  }
  return e;
}
export const civOf = (seed: number): CivWorld | null => worlds.get(seed)?.w ?? null;

/** Something a player did that the kingdom will feel at the next day's turn. */
export function recordCiv(seed: number, realm: RealmId | undefined | null, key: keyof Ledger, n = 1): void {
  const e = worlds.get(seed);
  if (!realm || !e?.w?.ledger[realm] || !Number.isFinite(n)) return;
  e.w.ledger[realm][key] += n;
  e.dirty = true;
}

/** Tests: forget the world (each test boot starts afresh). */
export function resetCiv(): void {
  worlds.clear();
}
