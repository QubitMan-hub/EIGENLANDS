import { CHUNK_SIZE, INTEREST_RADIUS, MSG, chunkKey, chunkOf, type ChunkStore, type WorldObj, type ObjMsg } from '@eigenlands/shared';
import type { Repo } from '../db/repo';
import type { ServerPlayer } from '../rooms/player';

export interface ObjHost { store: ChunkStore; seed: number; players: Map<string, ServerPlayer>; objectChanged?(m: ObjMsg): void }

/**
 * Dynamic world objects (crops, placed stations, chests...). The ChunkStore holds them (so collision sees them);
 * this class adds per-chunk indexing, persistence and OBJ broadcasting. Static town furnishing is never touched.
 */
export class ObjectManager {
  private byChunk = new Map<string, Set<string>>();
  private dirty = new Map<string, WorldObj>();
  private removed = new Map<string, { x: number; y: number; structure?: boolean }>();
  private key(x: number, y: number, structure = false): string { return `${structure ? 's:' : ''}${x},${y}`; }

  constructor(private host: ObjHost) {}

  get(x: number, y: number): WorldObj | undefined { return this.host.store.objectAt(x, y); }

  inChunk(cx: number, cy: number): WorldObj[] {
    const out: WorldObj[] = [];
    for (const k of this.byChunk.get(chunkKey(cx, cy)) ?? []) { const o = k.startsWith('s:') ? this.host.store.structures.get(k.slice(2)) : this.host.store.objects.get(k); if (o && !o.static) out.push(o); }
    return out;
  }

  private index(o: WorldObj): void {
    const ck = chunkKey(chunkOf(o.x), chunkOf(o.y));
    let s = this.byChunk.get(ck);
    if (!s) { s = new Set(); this.byChunk.set(ck, s); }
    s.add(this.key(o.x, o.y, o.kind === 'structure'));
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
    this.dirty.set(this.key(o.x, o.y, o.kind === 'structure'), o);
    this.removed.delete(this.key(o.x, o.y, o.kind === 'structure'));
    this.broadcast(o.x, o.y, o);
    this.host.objectChanged?.({ x:o.x, y:o.y, obj:o, ...(o.kind === 'structure' ? {structure:true} : {}) });
  }

  /** Call after mutating `o.data` in place. */
  update(o: WorldObj): void { this.put(o); }

  remove(x: number, y: number, structure = false): boolean {
    const o = structure ? this.host.store.structureAt(x, y) : this.host.store.objectAt(x, y);
    if (!o || o.static) return false;
    if (structure) this.host.store.removeStructure(x, y); else this.host.store.removeObject(x, y);
    const key = this.key(x, y, structure);
    this.byChunk.get(chunkKey(chunkOf(x), chunkOf(y)))?.delete(key);
    this.dirty.delete(key);
    this.removed.set(key, { x, y, ...(structure ? { structure: true } : {}) });
    this.broadcast(x, y, null, structure);
    this.host.objectChanged?.({x,y,obj:null,...(structure?{structure:true}:{})});
    return true;
  }

  private broadcast(x: number, y: number, obj: WorldObj | null, structure = obj?.kind === 'structure'): void {
    const r = (INTEREST_RADIUS + 1) * CHUNK_SIZE;
    for (const p of this.host.players.values()) {
      if (Math.hypot(p.sim.x - x, p.sim.y - y) <= r) p.client.send(MSG.OBJ, { x, y, obj, ...(structure ? { structure: true } : {}) });
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
      for (const o of ups) { const k = this.key(o.x, o.y, o.kind === 'structure'); if (!this.removed.has(k) && !this.dirty.has(k)) this.dirty.set(k, o); }
      for (const d of dels) { const k = this.key(d.x, d.y, d.structure); if (!this.dirty.has(k) && !this.removed.has(k)) this.removed.set(k, d); }
      throw e;
    }
  }

  all(): IterableIterator<WorldObj> { return this.host.store.objects.values(); }
}
