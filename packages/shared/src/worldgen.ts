import { CHUNK_SIZE } from './constants';
import { hash2 } from './rng';
import { Simplex2D } from './simplex';
import { T } from './tiles';

export type Biome = 'phase_meadows';

interface Layers {
  height: Simplex2D;
  moisture: Simplex2D;
  temperature: Simplex2D;
  flux: Simplex2D;
  forest: Simplex2D;
  meadow: Simplex2D;
  rocky: Simplex2D;
}

const layerCache = new Map<number, Layers>();
function layers(seed: number): Layers {
  let l = layerCache.get(seed);
  if (!l) {
    l = {
      height: new Simplex2D(seed ^ 0x1111),
      moisture: new Simplex2D(seed ^ 0x2222),
      temperature: new Simplex2D(seed ^ 0x3333),
      flux: new Simplex2D(seed ^ 0x4444),
      forest: new Simplex2D(seed ^ 0x5555),
      meadow: new Simplex2D(seed ^ 0x6666),
      rocky: new Simplex2D(seed ^ 0x7777),
    };
    if (layerCache.size > 8) layerCache.clear();
    layerCache.set(seed, l);
  }
  return l;
}

export interface ClimateSample {
  height: number;
  moisture: number;
  temperature: number;
  flux: number;
}

export function sampleClimate(seed: number, x: number, y: number): ClimateSample {
  const l = layers(seed);
  let height = l.height.fbm(x / 48, y / 48, 4);
  // keep the spawn area dry land
  const dist = Math.hypot(x, y);
  height += Math.max(0, 1 - dist / 22) * 0.8;
  return {
    height,
    moisture: l.moisture.fbm(x / 64 + 100, y / 64 - 100, 3),
    temperature: l.temperature.fbm(x / 96 - 50, y / 96 + 50, 2),
    flux: l.flux.fbm(x / 36, y / 36, 2),
  };
}

/** Only one biome ships in Phase 1; later phases switch on climate here. */
export function biomeAt(_seed: number, _x: number, _y: number): Biome {
  return 'phase_meadows';
}

const CAMP_CELL = 48;
function campCenter(seed: number, cellX: number, cellY: number): { x: number; y: number } | null {
  if (hash2(seed, cellX, cellY, 91) > 0.35) return null;
  const x = cellX * CAMP_CELL + 6 + Math.floor(hash2(seed, cellX, cellY, 92) * (CAMP_CELL - 12));
  const y = cellY * CAMP_CELL + 6 + Math.floor(hash2(seed, cellX, cellY, 93) * (CAMP_CELL - 12));
  if (Math.hypot(x, y) < 12) return null; // spawn shrine owns the origin
  if (sampleClimate(seed, x, y).height < -0.1) return null;
  return { x, y };
}

export function tileAt(seed: number, x: number, y: number): number {
  // Spawn shrine: path disc, four torches.
  const r0 = Math.hypot(x, y);
  if (Math.abs(x) === 3 && Math.abs(y) === 3) return T.TORCH;
  if (r0 <= 2.6) return T.PATH;

  const cx = Math.floor(x / CAMP_CELL);
  const cy = Math.floor(y / CAMP_CELL);
  const camp = campCenter(seed, cx, cy);
  if (camp) {
    const dx = x - camp.x;
    const dy = y - camp.y;
    if (dx === 0 && dy === 0) return T.TORCH;
    if (Math.hypot(dx, dy) <= 1.6) return T.PATH;
  }

  const c = sampleClimate(seed, x, y);
  if (c.height < -0.42) return T.DEEP_WATER;
  if (c.height < -0.28) return T.WATER;
  if (c.height < -0.2) return T.SAND;

  const r = hash2(seed, x, y, 1);
  if (c.flux > 0.55 && r < 0.035) return T.SHIMMER;

  const l = layers(seed);
  const shoreDist = Math.max(0, c.height + 0.2); // 0 at the sand line, grows inland
  // groves and clearings: trees follow a low-frequency density field instead of uniform noise
  const forest = l.forest.fbm(x / 70 + 40, y / 70 - 40, 3);
  const grove = smooth(forest, 0.02, 0.35);
  const treeP = (0.004 + 0.5 * grove * (0.55 + 0.45 * Math.max(0, c.moisture + 0.3))) * Math.min(1, shoreDist * 6);
  if (hash2(seed, x, y, 2) < treeP && r0 > 7) return T.TREE;

  // boulder fields on rocky ground
  const rocky = l.rocky.fbm(x / 45 - 90, y / 45 + 90, 3);
  if (hash2(seed, x, y, 3) < 0.003 + 0.2 * smooth(rocky, 0.35, 0.65) && r0 > 7) return T.ROCK;

  // flower meadows and tall-grass patches
  const meadow = l.meadow.fbm(x / 20 + 300, y / 20 - 300, 2);
  if (hash2(seed, x, y, 4) < 0.5 * smooth(meadow, 0.2, 0.55) * (0.5 + 0.5 * Math.max(0, c.moisture + 0.4))) return T.FLOWERS;
  const tall = l.meadow.fbm(x / 14 - 500, y / 14 + 500, 2);
  if (hash2(seed, x, y, 5) < 0.04 + 0.55 * smooth(tall, 0.05, 0.5)) return T.GRASS_TALL;
  return T.GRASS;
}

function smooth(v: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function generateChunk(seed: number, cx: number, cy: number): Uint8Array {
  const out = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const ox = cx * CHUNK_SIZE;
  const oy = cy * CHUNK_SIZE;
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      out[y * CHUNK_SIZE + x] = tileAt(seed, ox + x, oy + y);
    }
  }
  return out;
}
