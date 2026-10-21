import { CHUNK_SIZE, INTEREST_RADIUS, MSG, chunkKey, chunkOf, type ChunkStore, type WorldObj } from '@eigenlands/shared';
import type { Repo } from '../db/repo';
import type { ServerPlayer } from '../rooms/player';

export interface ObjHost { store: ChunkStore; seed: number; players: Map<string, ServerPlayer> }

/**
 * Dynamic world objects (crops, placed stations, chests...). The ChunkStore holds them (so collision sees them);
 * this class adds per-chunk indexing, persistence and OBJ broadcasting. Static town furnishing is never touched.
 */
export class ObjectManager {
  private byChunk = new Map<string, Set<string>>();
  private dirty = new Map<string, WorldObj>();
  private removed = new Map<string, { x: number; y: number }>();

  constructor(private host: ObjHost) {}

  get(x: number, y: number): WorldObj | undefined { return this.host.store.objectAt(x, y); }

  inChunk(cx: number, cy: number): WorldObj[] {
    const out: WorldObj[] = [];
    for (const k of this.byChunk.get(chunkKey(cx, cy)) ?? []) { const o = this.host.store.objects.get(k); if (o && !o.static) out.push(o); }
    return out;
  }

  private index(o: WorldObj): void {
    const ck = chunkKey(chunkOf(o.x), chunkOf(o.y));
    let s = this.byChunk.get(ck);
    if (!s) { s = new Set(); this.byChunk.set(ck, s); }
    s.add(`${o.x},${o.y}`);
  }

  /** Register objects loaded from the database (silent: no broadcast, not dirty). */
  load(list: WorldObj[]): void {
    for (const o of list) { if (this.host.store.objectAt(o.x, o.y)?.static) continue; this.host.store.putObject(o); this.index(o); }
  }

  /** Add or replace an object: persists and tells nearby players. */
  put(o: WorldObj): void {
    if (this.host.store.objectAt(o.x, o.y)?.static) return;
    this.host.store.putObject(o);
    this.index(o);
    this.dirty.set(`${o.x},${o.y}`, o);
    this.removed.delete(`${o.x},${o.y}`);
    this.broadcast(o.x, o.y, o);
  }

  /** Call after mutating `o.data` in place. */
  update(o: WorldObj): void { this.put(o); }

  remove(x: number, y: number): boolean {
    const o = this.host.store.objectAt(x, y);
    if (!o || o.static) return false;
    this.host.store.removeObject(x, y);
    this.byChunk.get(chunkKey(chunkOf(x), chunkOf(y)))?.delete(`${x},${y}`);
    this.dirty.delete(`${x},${y}`);
    this.removed.set(`${x},${y}`, { x, y });
    this.broadcast(x, y, null);
    return true;
  }

  private broadcast(x: number, y: number, obj: WorldObj | null): void {
    const r = (INTEREST_RADIUS + 1) * CHUNK_SIZE;
    for (const p of this.host.players.values()) {
      if (Math.hypot(p.sim.x - x, p.sim.y - y) <= r) p.client.send(MSG.OBJ, { x, y, obj });
    }
  }

  /** Persist pending changes. On failure everything is kept for the next attempt. */
  async flush(repo: Repo): Promise<void> {
    if (!this.dirty.size && !this.removed.size) return;
    const ups = [...this.dirty.values()];
    const dels = [...this.removed.values()];
    this.dirty.clear(); this.removed.clear();
    try {
      await repo.saveObjects(this.host.seed, ups, dels);
    } catch (e) {
      for (const o of ups) if (!this.removed.has(`${o.x},${o.y}`)) this.dirty.set(`${o.x},${o.y}`, o);
      for (const d of dels) if (!this.dirty.has(`${d.x},${d.y}`)) this.removed.set(`${d.x},${d.y}`, d);
      throw e;
    }
  }

  all(): IterableIterator<WorldObj> { return this.host.store.objects.values(); }
}
