/**
 * World sharding: the infinite world is cut into square regions of REGION_CHUNKS × REGION_CHUNKS chunks, and each
 * region is simulated by one shard (one room). Region (0,0) is centred on the spawn shrine.
 */
import { CHUNK_SIZE } from './constants';
import { isUpperY, UPPER_OY } from './floors';

/** Storeys retain separate collision coordinates but share the ground region’s authority. */
export const shardY = (y: number): number => isUpperY(y) ? y - UPPER_OY : y;

export const REGION_CHUNKS = 8;
export const REGION_TILES = REGION_CHUNKS * CHUNK_SIZE;
/** how far past a border (tiles) a player walks before being handed to the next shard (hysteresis) */
export const HANDOFF_MARGIN = 2;
/** players this close (tiles) to a border are shown to the neighbouring shard as ghosts */
export const GHOST_MARGIN = 24;

export interface Region { rx: number; ry: number }

const OFFSET = (REGION_CHUNKS / 2) * CHUNK_SIZE;
export const regionOfTile = (t: number): number => Math.floor((t + OFFSET) / REGION_TILES);
export const regionOf = (x: number, y: number): Region => ({ rx: regionOfTile(Math.floor(x)), ry: regionOfTile(Math.floor(shardY(y))) });
export const shardId = (r: Region): string => `${r.rx},${r.ry}`;
export const shardAt = (x: number, y: number): string => shardId(regionOf(x, y));

export function parseShard(id: unknown): Region | null {
  if (typeof id !== 'string') return null;
  const m = /^(-?\d{1,6}),(-?\d{1,6})$/.exec(id);
  return m ? { rx: Number(m[1]), ry: Number(m[2]) } : null;
}

/** Tile bounds [x0, x1) × [y0, y1) of a region. */
export function regionBounds(r: Region): { x0: number; y0: number; x1: number; y1: number } {
  const x0 = r.rx * REGION_TILES - OFFSET, y0 = r.ry * REGION_TILES - OFFSET;
  return { x0, y0, x1: x0 + REGION_TILES, y1: y0 + REGION_TILES };
}

export const inRegion = (r: Region, x: number, y: number): boolean => {
  const b = regionBounds(r);
  const sy = shardY(y);
  return x >= b.x0 && x < b.x1 && sy >= b.y0 && sy < b.y1;
};

/** The shard a player at (x,y) should move to, or null while they are within the margin of `r`. */
export function handoffTarget(r: Region, x: number, y: number, margin = HANDOFF_MARGIN): string | null {
  const b = regionBounds(r);
  const sy = shardY(y);
  if (x >= b.x0 - margin && x < b.x1 + margin && sy >= b.y0 - margin && sy < b.y1 + margin) return null;
  return shardAt(x, y);
}

/** Neighbouring shards whose border is within `margin` tiles of (x,y). */
export function nearbyShards(r: Region, x: number, y: number, margin = GHOST_MARGIN): string[] {
  const out = new Set<string>();
  for (const dx of [-margin, 0, margin]) for (const dy of [-margin, 0, margin]) {
    const s = shardAt(x + dx, y + dy);
    if (s !== shardId(r)) out.add(s);
  }
  return [...out];
}
