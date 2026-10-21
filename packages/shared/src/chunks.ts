import { CHUNK_SIZE } from './constants';
import { generateChunk } from './worldgen';
import { isSolid } from './tiles';

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
    if (this.chunks.size > this.maxChunks) {
      for (const [key, ch] of this.chunks) {
        if (ch.diff.size === 0) { this.chunks.delete(key); break; } // never evict edited chunks
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

  getTile(x: number, y: number): number {
    const c = this.get(chunkOf(x), chunkOf(y));
    return c.tiles[(y - c.cy * CHUNK_SIZE) * CHUNK_SIZE + (x - c.cx * CHUNK_SIZE)]!;
  }

  setTile(x: number, y: number, tile: number): { cx: number; cy: number; idx: number } {
    const c = this.get(chunkOf(x), chunkOf(y));
    const idx = (y - c.cy * CHUNK_SIZE) * CHUNK_SIZE + (x - c.cx * CHUNK_SIZE);
    c.tiles[idx] = tile;
    c.diff.set(idx, tile);
    return { cx: c.cx, cy: c.cy, idx };
  }

  solidAt = (x: number, y: number): boolean => isSolid(this.getTile(x, y));
}
