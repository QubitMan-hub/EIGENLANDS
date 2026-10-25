import {
  CHUNK_SIZE,
  CAVE_OY,
  DIVE_OY,
  UPPER_OY,
  TILE_DEFS,
  isCaveY,
  isDiveY,
  isUpperY,
  type ChunkStore,
} from '@eigenlands/shared';
export const planeOf = (y: number): string =>
  isDiveY(y) ? 'Submerged sanctuaries' : isUpperY(y) ? 'Upper rooms' : isCaveY(y) ? 'Undercroft' : 'Overworld';
export const chartY = (y: number): number =>
  isDiveY(y) ? y - DIVE_OY : isUpperY(y) ? y - UPPER_OY : isCaveY(y) ? y - CAVE_OY : y;
export interface ChartChunk {
  cx: number;
  cy: number;
  tiles: Int16Array;
  revision: number;
}
export const validPage = (key: string, tiles: unknown): tiles is Int16Array =>
  /^-?\d{1,5},-?\d{1,5}$/.test(key) &&
  tiles instanceof Int16Array &&
  tiles.length === 1024 &&
  tiles.every((n) => n === -1 || !!TILE_DEFS[n]);
export const encodeChart = (pages: Iterable<readonly [string, Int16Array]>): string =>
  JSON.stringify({
    v: 1,
    chunks: [...pages].map(([key, tiles]) => [
      key,
      Array.from(tiles, (n) => (n < 0 ? '.' : String.fromCharCode(65 + n))).join(''),
    ]),
  });
/** Bounded, local chart pages. Unknown cells stay -1; reading the atlas never generates terrain. */
export class Exploration {
  readonly chunks = new Map<string, ChartChunk>();
  revision = 0;
  constructor(
    readonly limit = 512,
    private changed?: (key: string, cells: Int16Array) => void,
  ) {}
  visit(store: ChunkStore, x: number, y: number, radius = 12): void {
    const changes = new Map<string, Int16Array>();
    const tx = Math.floor(x),
      ty = Math.floor(y);
    for (let j = -radius; j <= radius; j++)
      for (let i = -radius; i <= radius; i++) {
        if (i * i + j * j > radius * radius) continue;
        const px = tx + i,
          py = ty + j,
          cx = Math.floor(px / CHUNK_SIZE),
          cy = Math.floor(py / CHUNK_SIZE);
        if (!store.has(cx, cy)) continue;
        const key = `${cx},${cy}`;
        let c = this.chunks.get(key);
        if (!c) {
          c = { cx, cy, tiles: new Int16Array(1024).fill(-1), revision: 0 };
          this.chunks.set(key, c);
        } else {
          this.chunks.delete(key);
          this.chunks.set(key, c);
        }
        const idx = px - cx * 32 + (py - cy * 32) * 32,
          tile = store.get(cx, cy).tiles[idx]!;
        if (c.tiles[idx] !== tile) {
          c.tiles[idx] = tile;
          if (this.changed) {
            let delta = changes.get(key);
            if (!delta) changes.set(key, (delta = new Int16Array(1024).fill(-1)));
            delta[idx] = tile;
          }
          c.revision++;
          this.revision++;
        }
      }
    for (const [key, cells] of changes) this.changed?.(key, cells);
    this.trim();
  }
  /** Fill fog from an archive read, preserving observations made while that read was pending. */
  merge(key: string, tiles: Int16Array): void {
    if (!validPage(key, tiles)) return;
    let c = this.chunks.get(key);
    if (!c) {
      const [cx, cy] = key.split(',').map(Number);
      c = { cx: cx!, cy: cy!, tiles: new Int16Array(1024).fill(-1), revision: 0 };
      this.chunks.set(key, c);
    }
    for (let i = 0; i < 1024; i++)
      if (c.tiles[i]! < 0 && tiles[i]! >= 0) {
        c.tiles[i] = tiles[i]!;
        c.revision++;
        this.revision++;
      }
    this.trim();
  }
  private trim(): void {
    while (this.chunks.size > this.limit) {
      this.chunks.delete(this.chunks.keys().next().value!);
      this.revision++;
    }
  }
  tile(x: number, y: number): number | undefined {
    x = Math.floor(x);
    y = Math.floor(y);
    const cx = Math.floor(x / 32),
      cy = Math.floor(y / 32),
      n = this.chunks.get(`${cx},${cy}`)?.tiles[x - cx * 32 + (y - cy * 32) * 32];
    return n === undefined || n < 0 ? undefined : n;
  }
  serialize(): string {
    return encodeChart([...this.chunks].map(([key, c]) => [key, c.tiles] as const));
  }
  restore(raw: string): void {
    try {
      const v = JSON.parse(raw);
      if (v?.v !== 1 || !Array.isArray(v.chunks)) return;
      const next = new Map<string, ChartChunk>();
      for (const entry of v.chunks.slice(-this.limit)) {
        if (
          !Array.isArray(entry) ||
          typeof entry[0] !== 'string' ||
          !/^-?\d{1,5},-?\d{1,5}$/.test(entry[0]) ||
          typeof entry[1] !== 'string' ||
          entry[1].length !== 1024
        )
          continue;
        const [cx, cy] = entry[0].split(',').map(Number),
          tiles = Int16Array.from(entry[1], (ch: string) => (ch === '.' ? -1 : ch.charCodeAt(0) - 65));
        if ([...tiles].some((n) => n !== -1 && !TILE_DEFS[n])) continue;
        next.set(entry[0], { cx, cy, tiles, revision: 0 });
      }
      this.chunks.clear();
      for (const [key, c] of next) this.chunks.set(key, c);
      this.revision++;
    } catch {
      /* retain the current chart if storage is corrupt */
    }
  }
}
