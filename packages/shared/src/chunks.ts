import { buildTile, type BuildCell } from './construction';
import { oceanObjectsIn } from './ocean';
import { sanctuaryObjectsIn, isDiveY } from './sanctuaries';
import { CHUNK_SIZE } from './constants';
import { generateChunk } from './worldgen';
import { T, isSolid } from './tiles';
import type { SolidQuery } from './sim';
import { objSolid, type WorldObj } from './objects';
import { townsFor } from './town';
import { ruinObjectsIn } from './ruins';
import { caveObjectsIn, isCaveY } from './caves';
import { shrineObjectsIn } from './shrines';

export type ChunkDiff = Map<number, number>;

export interface Chunk {
  cx: number;
  cy: number;
  tiles: Uint8Array;
  diff: ChunkDiff;
}

export const chunkKey = (cx: number, cy: number) => `${cx},${cy}`;
export const chunkOf = (t: number) => Math.floor(t / CHUNK_SIZE);

/** Binary diff: u16 count, then (u16 index, u8 tile) triples. */
export function encodeDiff(diff: ChunkDiff): Uint8Array {
  const out = new Uint8Array(2 + diff.size * 3);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, diff.size, true);
  let o = 2;
  for (const [idx, tile] of diff) {
    dv.setUint16(o, idx, true);
    out[o + 2] = tile;
    o += 3;
  }
  return out;
}

export function decodeDiff(buf: Uint8Array): ChunkDiff {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = dv.getUint16(0, true);
  const diff: ChunkDiff = new Map();
  for (let i = 0; i < n; i++) {
    const o = 2 + i * 3;
    if (o + 3 > buf.byteLength) throw new Error('truncated diff');
    diff.set(dv.getUint16(o, true), buf[o + 2]!);
  }
  return diff;
}

/** Generated terrain + player edits. Shared by server (authority) and client (render/predict). */
export class ChunkStore {
  private chunks = new Map<string, Chunk>();
  /** solid world objects (stations, chests, furniture...) keyed by "x,y" */
  private solidObjs = new Set<string>();
  /** all dynamic + static objects by "x,y" (server/client keep this in sync with OBJ messages) */
  readonly objects = new Map<string, WorldObj>();
  readonly structures = new Map<string, BuildCell>();
  structureRevision = 0;
  private townByChunk: Map<string, WorldObj[]> | null = null;

  constructor(readonly seed: number, private maxChunks = 256) {}

  has(cx: number, cy: number): boolean {
    return this.chunks.has(chunkKey(cx, cy));
  }

  get(cx: number, cy: number): Chunk {
    const k = chunkKey(cx, cy);
    let c = this.chunks.get(k);
    if (c) {
      // refresh LRU order
      this.chunks.delete(k);
      this.chunks.set(k, c);
      return c;
    }
    c = { cx, cy, tiles: generateChunk(this.seed, cx, cy), diff: new Map() };
    this.chunks.set(k, c);
    for (const o of this.townObjectsIn(cx, cy)) this.putObject(o);
    if (this.chunks.size > this.maxChunks) {
      for (const [key, ch] of this.chunks) {
        if (ch.diff.size === 0 && ch !== this.lastChunk) { this.chunks.delete(key); break; } // never evict edited chunks
      }
    }
    return c;
  }

  applyDiff(cx: number, cy: number, diff: ChunkDiff): Chunk {
    const c = this.get(cx, cy);
    for (const [idx, tile] of diff) {
      c.tiles[idx] = tile;
      c.diff.set(idx, tile);
    }
    return c;
  }

  private lastChunk: Chunk | null = null;

  getTile(x: number, y: number): number {
    const built = this.structures.size ? buildTile(this.structureAt(x, y)) : undefined;
    if (built !== undefined) return built;
    const cx = chunkOf(x), cy = chunkOf(y);
    let c = this.lastChunk;
    // fast path: consecutive lookups (collision, light scans) mostly hit the same chunk
    if (!c || c.cx !== cx || c.cy !== cy) { c = this.get(cx, cy); this.lastChunk = c; }
    return c.tiles[(y - c.cy * CHUNK_SIZE) * CHUNK_SIZE + (x - c.cx * CHUNK_SIZE)]!;
  }

  setTile(x: number, y: number, tile: number): { cx: number; cy: number; idx: number } {
    const c = this.get(chunkOf(x), chunkOf(y));
    const idx = (y - c.cy * CHUNK_SIZE) * CHUNK_SIZE + (x - c.cx * CHUNK_SIZE);
    c.tiles[idx] = tile;
    c.diff.set(idx, tile);
    return { cx: c.cx, cy: c.cy, idx };
  }

  /** Static furnishing of the generated town that lives in chunk (cx,cy). */
  townObjectsIn(cx: number, cy: number): WorldObj[] {
    if (!this.townByChunk) {
      this.townByChunk = new Map();
      for (const o of townsFor(this.seed).flatMap(t => t.objects)) {
        const k = chunkKey(chunkOf(o.x), chunkOf(o.y));
        const list = this.townByChunk.get(k) ?? [];
        list.push({ x: o.x, y: o.y, kind: o.kind, sub: o.sub, static: true, ...(o.data ? { data: o.data } : {}) });
        this.townByChunk.set(k, list);
      }
    }
    const town = this.townByChunk.get(chunkKey(cx, cy)) ?? [];
    const wild = isCaveY(cy * CHUNK_SIZE) ? [...caveObjectsIn(this.seed, cx, cy), ...shrineObjectsIn(this.seed,cx,cy)]
      : isDiveY(cy * CHUNK_SIZE) ? sanctuaryObjectsIn(this.seed, cx, cy)
      : [...sanctuaryObjectsIn(this.seed, cx, cy), ...oceanObjectsIn(this.seed, cx, cy), ...shrineObjectsIn(this.seed, cx, cy), ...ruinObjectsIn(this.seed, cx, cy), ...caveObjectsIn(this.seed, cx, cy)];
    return wild.length ? [...town, ...wild] : town;
  }

  putObject(o: WorldObj): void {
    const k = `${o.x},${o.y}`;
    if (o.kind === 'structure') { this.structures.set(k, o as BuildCell); this.structureRevision++; return; }
    this.objects.set(k, o);
    if (objSolid(o.kind, o.sub)) this.solidObjs.add(k); else this.solidObjs.delete(k);
  }
  removeObject(x: number, y: number): void { const k = `${x},${y}`; this.objects.delete(k); this.solidObjs.delete(k); }
  structureAt(x: number, y: number): BuildCell | undefined { return this.structures.get(`${x},${y}`); }
  removeStructure(x: number, y: number): void { this.structures.delete(`${x},${y}`); this.structureRevision++; }
  objectAt(x: number, y: number): WorldObj | undefined { return this.objects.get(`${x},${y}`); }

  /** a ship's collision: only open water is passable */
  private seaSolidAt = (x: number, y: number): boolean => {
    const t = this.getTile(x, y);
    return (t !== T.WATER && t !== T.DEEP_WATER) || this.solidObjs.has(`${x},${y}`);
  };
  solidAt: SolidQuery = Object.assign(
    (x: number, y: number): boolean => isSolid(this.getTile(x, y)) || this.solidObjs.has(`${x},${y}`),
    { sea: (x: number, y: number): boolean => this.seaSolidAt(x, y) },
  );
  /** cannonballs and bolts fly over water but stop at land, walls and trees */
  shotBlockedAt = (x: number, y: number): boolean => {
    const t = this.getTile(x, y);
    return (t !== T.WATER && t !== T.DEEP_WATER && isSolid(t)) || this.solidObjs.has(`${x},${y}`);
  };
}
