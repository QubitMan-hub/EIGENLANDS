import { CHUNK_SIZE, CLIFF, MAX_LEVEL } from './constants';
import { hash2 } from './rng';
import { Simplex2D } from './simplex';
import { T, TILE_DEFS } from './tiles';
import { townFor } from './town';
import { ruinOfCell } from './ruins';
import { caveOfCell, caveShaftOfCell } from './caves';
import { shrinesNear } from './shrines';
import { isUpperY } from './floors';
import { isDiveY } from './sanctuaries';
import { isCryptY } from './cryptplane';
import { isOtherworldY } from './otherworlds';
import { isCaveY } from './caves';
import {
  BIOMES,
  HOME_VALE,
  campCenter,
  sampleClimate,
  smooth,
  surfaceLavaAt,
  vegetationCover,
  wetlandBasin,
  worldLayers,
  type Biome,
  type ClimateSample,
} from './worldgen';
import { spacedTree } from './distribution';

/**
 * World generation revision 3: the full rebuild.
 *
 * Everything here is a pure function of (seed, x, y): no per-chunk state, so chunk seams cannot appear and
 * clients, servers and workers always agree. Revision 3 only ever changes a world that was *created* at revision 3;
 * older worlds are pinned to their saved revision and keep their exact tiles.
 *
 *  - Land: a large, coherent home continent (union with the old coast so every legacy landmark site stays on land).
 *  - Climate: latitudinal temperature (cold north, hot south), moisture with a rain shadow behind high ground.
 *  - Regions: domain-warped Worley cells carry one climate each; a biome is chosen per region, border strips blend
 *    with noise-clustered ecotones, incompatible neighbours are separated by a transitional biome, and the home vale
 *    frontier is a broad ragged edge instead of a ring.
 *  - Water: coastal beaches, rivers that follow the zero contours of a warped low-frequency field (so they connect,
 *    form lakes and always have fords), and the broad revision-2 fens.
 *  - Objects: tree groves and rock fields are Worley clusters thinned by the existing spacing rule.
 *  - Elevation: per-tile integer levels (0..MAX_LEVEL). Gentle hills everywhere beyond the vale, plus massifs
 *    (terraced mountains, mesas) with a guaranteed ramp sector so every level is reachable. See `elevationAt`.
 */
export const CONTINENT_R = 236;
export const REGION_CELL = 112;

interface Fields {
  warp: Simplex2D;
  warp2: Simplex2D;
  coast: Simplex2D;
  moist: Simplex2D;
  temp: Simplex2D;
  flux: Simplex2D;
  river: Simplex2D;
  ford: Simplex2D;
  hill: Simplex2D;
  ecotone: Simplex2D;
  frontier: Simplex2D;
  beach: Simplex2D;
}
const fieldCache = new Map<number, Fields>();
function F(seed: number): Fields {
  let f = fieldCache.get(seed);
  if (!f) {
    const s = (k: number) => new Simplex2D(seed ^ k);
    f = {
      warp: s(0x3101),
      warp2: s(0x3102),
      coast: s(0x3103),
      moist: s(0x3104),
      temp: s(0x3105),
      flux: s(0x3106),
      river: s(0x3107),
      ford: s(0x3108),
      hill: s(0x3109),
      ecotone: s(0x310a),
      frontier: s(0x310b),
      beach: s(0x310c),
    };
    if (fieldCache.size > 8) fieldCache.clear();
    fieldCache.set(seed, f);
  }
  return f;
}

// ───────────────────────── climate ─────────────────────────

/** Cold in the north (negative y), hot in the south; the home vale sits in the temperate band. */
export const latitude = (y: number): number => 0.7 * Math.sin(y / 360);

/** The home continent: >0 inland, ~-0.2 at the beach. Warped so the coast is a coherent, ragged shoreline. */
export function continentBlob(seed: number, x: number, y: number): number {
  const l = F(seed);
  const wx = x + l.warp.noise(x / 75 + 5, y / 75 - 9) * 26;
  const wy = y + l.warp2.noise(x / 75 - 4, y / 75 + 8) * 26;
  const inland = 1 - Math.hypot(wx, wy) / CONTINENT_R;
  return (inland + l.coast.fbm(x / 40, y / 40, 3) * 0.13) * 1.6 - 0.12;
}

export function climate3(seed: number, x: number, y: number): ClimateSample {
  const l = F(seed);
  const legacy = sampleClimate(seed, x, y, 2);
  const height = Math.max(legacy.height, continentBlob(seed, x, y));
  const lee = massifShadow(seed, x, y);
  return {
    height,
    moisture: l.moist.fbm(x / 150 + 400, y / 150 - 400, 3) - 0.4 * lee,
    temperature: latitude(y) + l.temp.fbm(x / 120 - 50, y / 120 + 50, 2) * 0.25,
    flux: legacy.flux,
  };
}

// ───────────────────────── regions and biomes ─────────────────────────

interface Region {
  x: number;
  y: number;
  t: number;
  m: number;
  f: number;
  biome: Biome;
}
const regionCache = new Map<string, Region>();

function pickBiome(t: number, m: number, f: number): Biome {
  if (f > 0.55) return 'enchanted';
  if (f < -0.6) return 'corrupted';
  if (t < -0.3) return 'taiga';
  if (t > 0.3) return m < 0.1 ? 'desert' : 'swamp';
  if (m > 0.35) return 'swamp';
  if (m < -0.3) return 'meadow';
  if (m > 0) return t < -0.1 ? 'autumn' : 'forest';
  return t < -0.08 ? 'autumn' : 'forest';
}

function regionCell(seed: number, gx: number, gy: number): Region {
  const k = `${seed}:${gx},${gy}`;
  let r = regionCache.get(k);
  if (r) return r;
  const l = F(seed);
  const x = (gx + 0.15 + 0.7 * hash2(seed, gx, gy, 3101)) * REGION_CELL;
  const y = (gy + 0.15 + 0.7 * hash2(seed, gx, gy, 3102)) * REGION_CELL;
  const t = latitude(y) + (hash2(seed, gx, gy, 3103) - 0.5) * 0.5 + l.temp.noise(x / 240, y / 240) * 0.2;
  const m = l.moist.fbm(x / 200 + 400, y / 200 - 400, 2) * 1.2 + (hash2(seed, gx, gy, 3104) - 0.5) * 0.5;
  const f = l.flux.fbm(x / 130 - 900, y / 130 + 900, 2) * 1.3 + (hash2(seed, gx, gy, 3105) - 0.5) * 0.4;
  r = { x, y, t, m, f, biome: pickBiome(t, m, f) };
  if (regionCache.size > 4096) regionCache.clear();
  regionCache.set(k, r);
  return r;
}

/** The two nearest regions of a point (after domain warping) and the distance gap between them. */
export function regionsAt(seed: number, x: number, y: number): { a: Region; b: Region; edge: number } {
  const l = F(seed);
  const qx = x + l.warp.noise(x / 58 + 71, y / 58 - 33) * 20;
  const qy = y + l.warp2.noise(x / 58 - 12, y / 58 + 90) * 20;
  const gx0 = Math.floor(qx / REGION_CELL),
    gy0 = Math.floor(qy / REGION_CELL);
  let a: Region | null = null,
    b: Region | null = null,
    d1 = Infinity,
    d2 = Infinity;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const r = regionCell(seed, gx0 + i, gy0 + j);
      const d = Math.hypot(qx - r.x, qy - r.y);
      if (d < d1) {
        b = a;
        d2 = d1;
        a = r;
        d1 = d;
      } else if (d < d2) {
        b = r;
        d2 = d;
      }
    }
  return { a: a!, b: b!, edge: d2 - d1 };
}

/** warmth class: cold < cool < mild < hot; quantum biomes are compatible with any neighbour (-1) */
const CLASS: Record<Biome, number> = {
  taiga: 0,
  autumn: 1,
  forest: 2,
  meadow: 2,
  swamp: 2,
  desert: 3,
  enchanted: -1,
  corrupted: -1,
};
const OF_CLASS: Biome[] = ['taiga', 'autumn', 'meadow', 'desert'];
/** the biome of the border strip between two regions: the neighbour if compatible, otherwise a transitional biome */
function across(a: Biome, b: Biome): Biome {
  const ca = CLASS[a],
    cb = CLASS[b];
  if (ca < 0 || cb < 0 || Math.abs(ca - cb) <= 1) return b;
  return OF_CLASS[Math.abs(ca - cb) >= 3 ? 2 : Math.round((ca + cb) / 2)]!;
}
const ECOTONE = 18;

export function biome3(seed: number, x: number, y: number): Biome {
  const dist = Math.hypot(x, y);
  if (dist < HOME_VALE) return 'meadow';
  const l = F(seed);
  const { a, b, edge } = regionsAt(seed, x, y);
  let biome = a.biome;
  if (edge < ECOTONE) {
    const n = l.ecotone.noise(x / 8 + 3, y / 8 - 3) * 0.5 + 0.5; // clustered, never per-tile
    if (n > 0.5 + 0.5 * (edge / ECOTONE)) biome = across(a.biome, b.biome);
  }
  // the vale frontier: a broad ragged edge, meadow dissolving into the region biomes between r=82 and r=140
  if (dist < 140 && l.frontier.noise(x / 27 + 9, y / 27 - 9) * 0.5 + 0.5 > smooth(dist, 82, 140)) return 'meadow';
  return biome;
}

// ───────────────────────── rivers ─────────────────────────

/** Contour field: rivers lie where |value| is small. Low frequency and warped, so they are long and connected. */
export function riverField(seed: number, x: number, y: number): number {
  const l = F(seed);
  const wx = x + l.warp.noise(x / 90 + 30, y / 90 - 30) * 18;
  const wy = y + l.warp2.noise(x / 90 - 20, y / 90 + 40) * 18;
  return l.river.fbm(wx / 230 + 11, wy / 230 - 17, 2);
}
const riverWidth = (b: Biome): number => (b === 'desert' ? 0.012 : b === 'swamp' ? 0.032 : 0.024);

/** Rivers never run through the vale, towns or the sea; every few dozen tiles a ford keeps both banks connected. */
export function riverAt(seed: number, x: number, y: number, biome: Biome): 'water' | 'ford' | null {
  const dist = Math.hypot(x, y);
  if (dist < HOME_VALE + 30 || dist > CONTINENT_R + 20) return null;
  if (Math.abs(riverField(seed, x, y)) >= riverWidth(biome)) return null;
  const t = townFor(seed);
  if (x > t.x0 - 12 && x < t.x1 + 12 && y > t.y0 - 12 && y < t.y1 + 12) return null;
  return F(seed).ford.noise(x / 16 + 5, y / 16 - 5) > 0.36 ? 'ford' : 'water';
}

// ───────────────────────── landmarks (flat ground around authored sites) ─────────────────────────

/** Distance to the nearest authored surface site (shrine, ruin, cave mouth, camp) within `r`, else Infinity. */
export function landmarkDistance(seed: number, x: number, y: number, r: number): number {
  return nearestLandmark(seed, x, y, r)?.d ?? Infinity;
}
/** The nearest authored surface site within `r`, with its distance. */
export function nearestLandmark(
  seed: number,
  x: number,
  y: number,
  r: number,
): { x: number; y: number; d: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  const take = (px: number, py: number) => {
    const d = Math.hypot(px - x, py - y);
    if (!best || d < best.d) best = { x: px, y: py, d };
  };
  for (const s of shrinesNear(seed, x, y, r)) take(s.x, s.y);
  for (let gy = Math.floor((y - r) / 96); gy <= Math.floor((y + r) / 96); gy++)
    for (let gx = Math.floor((x - r) / 96); gx <= Math.floor((x + r) / 96); gx++) {
      const s = ruinOfCell(seed, gx, gy);
      if (s) take(s.x, s.y);
    }
  for (let gy = Math.floor((y - r) / 72); gy <= Math.floor((y + r) / 72); gy++)
    for (let gx = Math.floor((x - r) / 72); gx <= Math.floor((x + r) / 72); gx++) {
      const m = caveOfCell(seed, gx, gy) ?? caveShaftOfCell(seed, gx, gy);
      if (m) take(m.x, m.y);
    }
  for (let gy = Math.floor((y - r) / 48); gy <= Math.floor((y + r) / 48); gy++)
    for (let gx = Math.floor((x - r) / 48); gx <= Math.floor((x + r) / 48); gx++) {
      const c = campCenter(seed, gx, gy);
      if (c) take(c.x, c.y);
    }
  return best;
}

// ───────────────────────── elevation ─────────────────────────

interface Massif {
  x: number;
  y: number;
  r: number;
  mesa: boolean;
  /** direction (radians) and half-width of the ramp sector that makes every level reachable */
  pass: number;
  half: number;
  /** tier thresholds jitter seed */
  id: number;
}
const MASSIF_CELL = 130;
const massifCache = new Map<string, Massif | null>();

export function massifOfCell(seed: number, i: number, j: number): Massif | null {
  const k = `${seed}:${i},${j}`;
  const hit = massifCache.get(k);
  if (hit !== undefined) return hit;
  let out: Massif | null = null;
  if (hash2(seed, i, j, 3201) < 0.62) {
    const x = Math.floor((i + 0.2 + 0.6 * hash2(seed, i, j, 3202)) * MASSIF_CELL);
    const y = Math.floor((j + 0.2 + 0.6 * hash2(seed, i, j, 3203)) * MASSIF_CELL);
    const r = 26 + Math.floor(17 * hash2(seed, i, j, 3204));
    const dist = Math.hypot(x, y);
    const onLand = [
      [0, 0],
      [0.8, 0],
      [-0.8, 0],
      [0, 0.8],
      [0, -0.8],
    ].every(([ox, oy]) => continentBlob(seed, x + ox! * r * 0.6, y + oy! * r * 0.6) > -0.08);
    if (dist > HOME_VALE + r * 0.6 + 14 && onLand) {
      const biome = biome3(seed, x, y);
      if (biome !== 'swamp')
        out = {
          x,
          y,
          r,
          mesa: biome === 'desert',
          pass: hash2(seed, i, j, 3205) * Math.PI * 2,
          half: 0.4 + 0.2 * hash2(seed, i, j, 3206),
          id: i * 31 + j,
        };
    }
  }
  if (massifCache.size > 2048) massifCache.clear();
  massifCache.set(k, out);
  return out;
}

const wrap = (a: number): number => {
  a = (a + Math.PI) % (Math.PI * 2);
  return (a < 0 ? a + Math.PI * 2 : a) - Math.PI;
};

/** Level of the highest massif covering a point (0 if none), and whether the point lies inside any massif. */
export function massifLevel(seed: number, x: number, y: number): { level: number; inside: boolean; shadow: number } {
  let level = 0,
    inside = false,
    shadow = 0;
  const gi = Math.floor(x / MASSIF_CELL),
    gj = Math.floor(y / MASSIF_CELL);
  const l = F(seed);
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const m = massifOfCell(seed, gi + i, gj + j);
      if (!m) continue;
      const dx = x - m.x + l.warp.noise(x / 37 + 2, y / 37 - 2) * 4,
        dy = y - m.y + l.warp2.noise(x / 37 - 3, y / 37 + 5) * 4;
      const s = 1 - Math.hypot(dx, dy) / m.r;
      if (s <= 0) continue;
      inside = true;
      shadow = Math.max(shadow, s);
      const inPass = Math.abs(wrap(Math.atan2(dy, dx) - m.pass)) < m.half;
      const jitter = (hash2(seed, m.id, 7, 3207) - 0.5) * 0.06;
      let lv: number;
      if (m.mesa) {
        // a flat-topped mesa of 4 levels, stepped in two terraces, with a smooth ramp sector
        lv = inPass ? 4 * smooth(s, 0.06, 0.5) : s > 0.3 + jitter ? 4 : s > 0.12 + jitter ? 2 : 0;
      } else {
        // a four-tier mountain: tops of 2, 4, 6 and 8 levels with sheer steps between them
        lv = inPass
          ? 8 * smooth(s, 0.1, 0.82)
          : s > 0.76 + jitter
            ? 8
            : s > 0.56 + jitter
              ? 6
              : s > 0.34 + jitter
                ? 4
                : s > 0.14 + jitter
                  ? 2
                  : 0;
      }
      level = Math.max(level, Math.floor(lv + 0.0001));
    }
  return { level, inside, shadow };
}

/** Upwind (westerly) high ground dries the lee: moisture falls behind massifs. */
function massifShadow(seed: number, x: number, y: number): number {
  return massifLevel(seed, x - 34, y).shadow;
}

/** Distance (tiles) to the vale/town flat zone is folded into one smooth 0..1 mask. */
function hillMask(seed: number, x: number, y: number, height: number): number {
  const dist = Math.hypot(x, y);
  const t = townFor(seed);
  const rx = Math.max(t.x0 - x, 0, x - t.x1),
    ry = Math.max(t.y0 - y, 0, y - t.y1);
  return smooth(dist, 95, 150) * smooth(Math.hypot(rx, ry), 14, 40) * smooth(height, -0.02, 0.3);
}

const levelBlocks = new Map<string, Uint8Array>();
let lastBlock: { key: string; data: Uint8Array } | undefined;
/**
 * Terrain elevation level of a tile (0 = sea level/valley floor). Hills never exceed 3 levels with at most one level
 * between neighbours; massifs add terraced mountains (cliffs of two levels between tiers) and a ramp sector with at most
 * one level per tile, so a walker can always reach every plateau. Water, towns and flat landmark grounds stay at 0.
 */
export function elevationAt(seed: number, x: number, y: number): number {
  if (isCaveY(y) || isUpperY(y) || isDiveY(y) || isCryptY(y) || isOtherworldY(y) || !Number.isInteger(x) || !Number.isInteger(y)) return 0;
  const cx = Math.floor(x / CHUNK_SIZE),
    cy = Math.floor(y / CHUNK_SIZE);
  const key = `${seed}:${cx},${cy}`;
  let data = lastBlock?.key === key ? lastBlock.data : levelBlocks.get(key);
  if (!data) {
    data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(255);
    if (levelBlocks.size > 192) levelBlocks.delete(levelBlocks.keys().next().value!);
    levelBlocks.set(key, data);
  }
  lastBlock = { key, data };
  const i = (y - cy * CHUNK_SIZE) * CHUNK_SIZE + x - cx * CHUNK_SIZE;
  if (data[i] !== 255) return data[i]!;
  const v = computeLevel(seed, x, y);
  data[i] = v;
  return v;
}

/** Radius of the slope-limited cone that keeps every authored site reachable on uneven ground. */
export const LANDMARK_CONE = 12;

function computeLevel(seed: number, x: number, y: number): number {
  const raw = rawLevel(seed, x, y);
  const lm = nearestLandmark(seed, x, y, LANDMARK_CONE);
  if (!lm) return raw;
  // Around a site the ground is limited to one level of difference per two tiles from the site's own level,
  // so cliffs are eroded away and the site can always be walked to from every side.
  const base = rawLevel(seed, lm.x, lm.y);
  const bound = Math.floor(Math.max(Math.abs(x - lm.x), Math.abs(y - lm.y)) / 2);
  return Math.max(0, Math.min(base + bound, Math.max(base - bound, raw)));
}

function rawLevel(seed: number, x: number, y: number): number {
  const c = sampleClimate(seed, x, y, 3);
  if (c.height < -0.2) return 0;
  const dist = Math.hypot(x, y);
  if (dist < HOME_VALE) return 0;
  const m = massifLevel(seed, x, y);
  if (m.inside) return Math.min(MAX_LEVEL, m.level);
  let mask = hillMask(seed, x, y, c.height);
  if (mask <= 0) return 0;
  // valleys: the land falls away smoothly to the river bed so banks are flush with the water
  mask *= smooth(Math.abs(riverField(seed, x, y)), riverWidth('forest'), riverWidth('forest') + 0.075);
  if (mask <= 0) return 0;
  if (biome3(seed, x, y) === 'swamp') return 0;
  // broad swells with a little detail: terraces that are tens of tiles across, not a contour-line maze
  const h = F(seed).hill;
  const v = (h.noise(x / 74 + 90, y / 74 - 90) * 0.88 + h.noise(x / 29 - 40, y / 29 + 55) * 0.12) * 0.5 + 0.5;
  return Math.floor(smooth(v, 0.3, 0.86) * 3.99 * mask);
}

/** Level of every tile in a chunk; all zero for revisions before 3 and for water. */
export function chunkLevels(seed: number, cx: number, cy: number, tiles: Uint8Array): Uint8Array {
  const out = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  for (let y = 0; y < CHUNK_SIZE; y++)
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const t = tiles[y * CHUNK_SIZE + x]!;
      if (t === T.WATER || t === T.DEEP_WATER) continue;
      out[y * CHUNK_SIZE + x] = elevationAt(seed, cx * CHUNK_SIZE + x, cy * CHUNK_SIZE + y);
    }
  return out;
}

// ───────────────────────── tiles ─────────────────────────

const GROVE_P: Record<Biome, number> = {
  forest: 0.85,
  autumn: 0.75,
  taiga: 0.6,
  enchanted: 0.5,
  meadow: 0.3,
  swamp: 0.35,
  corrupted: 0.22,
  desert: 0,
};
const ROCKY_P: Record<Biome, number> = {
  taiga: 0.55,
  corrupted: 0.5,
  desert: 0.35,
  autumn: 0.3,
  forest: 0.25,
  enchanted: 0.3,
  meadow: 0.22,
  swamp: 0.12,
};

/** Worley clusters: strongest at the centre of a randomly placed, randomly sized pocket. */
function cluster(seed: number, x: number, y: number, cell: number, p: number, r0: number, r1: number, salt: number) {
  const gx = Math.floor(x / cell),
    gy = Math.floor(y / cell);
  let best = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i,
        cy = gy + j;
      if (hash2(seed, cx, cy, salt) >= p) continue;
      const px = (cx + hash2(seed, cx, cy, salt + 1)) * cell,
        py = (cy + hash2(seed, cx, cy, salt + 2)) * cell;
      const r = r0 + (r1 - r0) * hash2(seed, cx, cy, salt + 3);
      const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
      if (d >= r) continue;
      best = Math.max(best, Math.pow(1 - d / r, 0.7) * (0.6 + 0.4 * hash2(seed, cx, cy, salt + 4)));
    }
  return best;
}

/** The revision-3 surface (everything below the settlement/cave/spawn prelude shared with older revisions). */
export function surfaceTile3(seed: number, x: number, y: number, r0: number, generation: 3 | 6 = 3): number {
  const c = sampleClimate(seed, x, y, generation);
  if (c.height < -0.42) return T.DEEP_WATER;
  if (c.height < -0.28) return T.WATER;
  const biome = biomeAt3(seed, x, y);
  const level = elevationAt(seed, x, y);
  if (level === 0 && c.height > -0.1) {
    const river = riverAt(seed, x, y, biome);
    if (river === 'water') return T.WATER;
    if (river === 'ford') return T.SAND;
  }
  const vent = surfaceLavaAt(seed, x, y, biome, 3);
  if (vent !== null) return vent;
  const beach = -0.2 + 0.075 * F(seed).beach.noise(x / 14 + 3, y / 14 - 3);
  const l = worldLayers(seed);
  if (c.height < beach || biome === 'desert') {
    if (biome !== 'desert') return T.SAND;
    const r = hash2(seed, x, y, 31);
    if (r < 0.012) return spacedTree(seed, x, y) ? T.TREE : T.SAND; // cactus
    if (r < 0.02) return T.ROCK;
    if (r < 0.026) return hash2(seed, Math.floor(x / 10), Math.floor(y / 10), 32) < 0.3 ? T.ORE_GOLD : T.ORE_COPPER;
    if (r < 0.05) return T.GRASS_TALL;
    return T.SAND;
  }
  if (biome === 'swamp') {
    const pool = wetlandBasin(seed, x, y);
    if (pool > 0.5) return T.WATER;
    if (pool > 0.38) return hash2(seed, x, y, 33) < 0.12 + 0.26 * vegetationCover(seed, x, y) ? T.GRASS_TALL : T.GRASS;
  }
  const r = hash2(seed, x, y, 1);
  const shimmerP = biome === 'enchanted' ? 0.06 : biome === 'corrupted' ? 0.02 : 0.035;
  if (c.flux > (biome === 'enchanted' ? 0.3 : 0.55) && r < shimmerP) return T.SHIMMER;

  // groves: pockets of woodland with clearings between them, a few lone trees elsewhere
  const shore = Math.max(0, c.height + 0.2);
  const grove = GROVE_P[biome] > 0 ? cluster(seed, x, y, 26, GROVE_P[biome], 5, 13, 3301) : 0;
  const lone = biome === 'forest' ? 0.012 : biome === 'swamp' || biome === 'corrupted' ? 0.01 : 0.004;
  const alpine = level >= 6 ? 0 : level >= 4 ? 0.4 : 1;
  const treeP = (lone + 0.62 * grove) * Math.min(1, shore * 6) * alpine;
  if (hash2(seed, x, y, 2) < treeP && r0 > 7 && spacedTree(seed, x, y)) return T.TREE;

  // rock fields: pockets of boulders, denser on high or steep ground
  const rocky = cluster(seed, x, y, 34, Math.min(0.95, ROCKY_P[biome] + 0.08 * level), 3, 8, 3311);
  const rr = hash2(seed, x, y, 3);
  const rockP = 0.003 + 0.42 * rocky + (level >= 5 ? 0.08 : 0);
  if (rr < rockP && r0 > 7) {
    const o = hash2(seed, Math.floor(x / 10), Math.floor(y / 10), 6);
    if ((c.flux > 0.42 || biome === 'corrupted' || biome === 'enchanted') && o < (biome === 'corrupted' ? 0.3 : 0.1))
      return T.CRYSTAL;
    if (r0 > 150 && o < 0.1) return T.ORE_GOLD;
    if ((r0 > 90 || biome === 'taiga') && o < 0.2) return T.ORE_SILVER;
    if (r0 > 40 && o < 0.3) return T.ORE_IRON;
    if (o < 0.4 + 0.1 * smooth(rocky, 0.5, 0.7)) return T.ORE_COPPER;
    return T.ROCK;
  }

  const grove2 = smooth(l.forest.fbm(x / 70 + 40, y / 70 - 40, 3), 0.02, 0.35);
  if (hash2(seed, x, y, 9) < 0.004 + 0.05 * Math.max(grove2, grove) + (biome === 'swamp' ? 0.02 : 0) && r0 > 6)
    return T.FORAGE;

  const meadow = l.meadow.fbm(x / 20 + 300, y / 20 - 300, 2);
  const cover = vegetationCover(seed, x, y);
  const flowerK = biome === 'taiga' || biome === 'corrupted' ? 0.12 : biome === 'enchanted' ? 0.8 : 0.28;
  if (
    hash2(seed, x, y, 4) <
    flowerK * (0.15 + 0.85 * cover) * smooth(meadow, 0.2, 0.55) * (0.5 + 0.5 * Math.max(0, c.moisture + 0.4))
  )
    return T.FLOWERS;
  const tall = l.meadow.fbm(x / 14 - 500, y / 14 + 500, 2);
  if (hash2(seed, x, y, 5) < 0.006 + 0.36 * smooth(tall, 0.05, 0.5) * cover) return T.GRASS_TALL;
  return T.GRASS;
}

function biomeAt3(seed: number, x: number, y: number): Biome {
  return BIOMES[biomeIndex3(seed, x, y)]!;
}
const biomeBlocks = new Map<string, Uint8Array>();
function biomeIndex3(seed: number, x: number, y: number): number {
  const cx = Math.floor(x / CHUNK_SIZE),
    cy = Math.floor(y / CHUNK_SIZE),
    key = `${seed}:${cx},${cy}`;
  let data = biomeBlocks.get(key);
  if (!data) {
    data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(255);
    if (biomeBlocks.size > 192) biomeBlocks.delete(biomeBlocks.keys().next().value!);
    biomeBlocks.set(key, data);
  }
  const i = (y - cy * CHUNK_SIZE) * CHUNK_SIZE + x - cx * CHUNK_SIZE;
  if (data[i] === 255) data[i] = BIOMES.indexOf(biome3(seed, x, y));
  return data[i]!;
}

/** Tiles of this revision that are always passable (used by pathing/validation tools). */
export const walkable3 = (tile: number): boolean => !(TILE_DEFS[tile]?.solid ?? true);
