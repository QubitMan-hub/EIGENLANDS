import { CHUNK_SIZE, MAX_LEVEL } from './constants';
import { hash2 } from './rng';
import { Simplex2D } from './simplex';
import { T } from './tiles';
import { spacedTree } from './distribution';
import type { Biome, ClimateSample } from './worldgen';

/**
 * The six great kingdoms (world revision 5). Each is its own continent across the sea, centred on a shard centre so
 * its capital lies wholly inside one shard, with four towns in the shards due north, east, south and west, and a
 * village plus a farm or outpost on each of those shards' remaining axes. Everything is a pure function of
 * (seed, x, y). Terrain mirrors the home continent's recipe (warped blob coast, Worley biome regions, grove and rock
 * clusters, massifs with a ramp sector) with each realm's own palette, so the realms feel like places, not recolours.
 */
export type RealmId = 'aurelion' | 'sylvaris' | 'khardum' | 'raijin' | 'thalassara' | 'nethrakar';
export const REALM_IDS: readonly RealmId[] = ['aurelion', 'sylvaris', 'khardum', 'raijin', 'thalassara', 'nethrakar'];
export const SHARD = 256;
export const REALM_R = 340;

export interface RealmGeo {
  id: RealmId;
  cx: number;
  cy: number;
}
/** Shard centres (multiples of 256), so a capital never straddles a shard border. */
export const REALM_GEO: Record<RealmId, RealmGeo> = {
  aurelion: { id: 'aurelion', cx: 1024, cy: -512 },
  sylvaris: { id: 'sylvaris', cx: 256, cy: -1024 },
  khardum: { id: 'khardum', cx: -768, cy: -768 },
  raijin: { id: 'raijin', cx: 768, cy: 768 },
  thalassara: { id: 'thalassara', cx: -256, cy: 1024 },
  nethrakar: { id: 'nethrakar', cx: -1024, cy: 256 },
};

export type SiteKind = 'capital' | 'town' | 'village' | 'farm' | 'outpost';
export interface RealmSite {
  id: string;
  /** Optional authored name for lazily generated frontier settlements. */
  name?: string;
  realm: RealmId;
  kind: SiteKind;
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** compass direction of the shard ring the site stands in (capital: 'c') */
  ring: 'c' | 'n' | 'e' | 's' | 'w';
}

const SIZE: Record<SiteKind, [number, number]> = {
  capital: [224, 168],
  town: [120, 92],
  village: [60, 50],
  farm: [56, 44],
  outpost: [50, 40],
};
const RINGS: Array<{ ring: 'n' | 'e' | 's' | 'w'; dx: number; dy: number }> = [
  { ring: 'n', dx: 0, dy: -SHARD },
  { ring: 'e', dx: SHARD, dy: 0 },
  { ring: 's', dx: 0, dy: SHARD },
  { ring: 'w', dx: -SHARD, dy: 0 },
];

/** All 78 settlement plots (13 per realm), deterministic and seed-independent so ids never move. */
export const REALM_SITES: RealmSite[] = REALM_IDS.flatMap((realm) => {
  const g = REALM_GEO[realm];
  const out: RealmSite[] = [
    {
      id: `${realm}_capital`,
      realm,
      kind: 'capital',
      cx: g.cx,
      cy: g.cy,
      w: SIZE.capital[0],
      h: SIZE.capital[1],
      ring: 'c',
    },
  ];
  RINGS.forEach((r, i) => {
    const sx = g.cx + r.dx,
      sy = g.cy + r.dy,
      ux = r.dx / SHARD,
      uy = r.dy / SHARD;
    out.push({
      id: `${realm}_${r.ring}town`,
      realm,
      kind: 'town',
      cx: sx,
      cy: sy,
      w: SIZE.town[0],
      h: SIZE.town[1],
      ring: r.ring,
    });
    // along the road from the capital: a village on the inland side of the town, a farm or outpost on the seaward side
    const off = 92;
    out.push({
      id: `${realm}_${r.ring}village`,
      realm,
      kind: 'village',
      cx: sx - ux * off,
      cy: sy - uy * off,
      w: SIZE.village[0],
      h: SIZE.village[1],
      ring: r.ring,
    });
    const second: SiteKind = i % 2 ? 'outpost' : 'farm';
    out.push({
      id: `${realm}_${r.ring}${second}`,
      realm,
      kind: second,
      cx: sx + ux * off,
      cy: sy + uy * off,
      w: SIZE[second][0],
      h: SIZE[second][1],
      ring: r.ring,
    });
  });
  return out;
});
export const REALM_SITE_BY_ID: Record<string, RealmSite> = Object.fromEntries(REALM_SITES.map((s) => [s.id, s]));

// ───────────────────────── fields ─────────────────────────

interface RF {
  warp: Simplex2D;
  warp2: Simplex2D;
  coast: Simplex2D;
  isle: Simplex2D;
  moist: Simplex2D;
  hill: Simplex2D;
  lake: Simplex2D;
  orchard: Simplex2D;
  forest: Simplex2D;
  meadow: Simplex2D;
  flux: Simplex2D;
  beach: Simplex2D;
}
const fcache = new Map<number, RF>();
function F(seed: number): RF {
  let f = fcache.get(seed);
  if (!f) {
    const s = (k: number) => new Simplex2D(seed ^ k);
    f = {
      warp: s(0x5101),
      warp2: s(0x5102),
      coast: s(0x5103),
      isle: s(0x5104),
      moist: s(0x5105),
      hill: s(0x5106),
      lake: s(0x5107),
      orchard: s(0x5108),
      forest: s(0x5109),
      meadow: s(0x510a),
      flux: s(0x510b),
      beach: s(0x510c),
    };
    if (fcache.size > 8) fcache.clear();
    fcache.set(seed, f);
  }
  return f;
}
const smooth = (v: number, a: number, b: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The realm whose centre is nearest, if (x, y) is within its sphere of influence. */
export function nearestRealm(x: number, y: number): RealmGeo | null {
  let best: RealmGeo | null = null,
    bd = Infinity;
  for (const id of REALM_IDS) {
    const g = REALM_GEO[id],
      d = (x - g.cx) ** 2 + (y - g.cy) ** 2;
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  return best && bd < (REALM_R * 1.25) ** 2 ? best : null;
}

const sitesByRealm = new Map<RealmId, RealmSite[]>();
for (const id of REALM_IDS)
  sitesByRealm.set(
    id,
    REALM_SITES.filter((s) => s.realm === id),
  );

/** Smooth land raised around every settlement plot, so each is on ground even in an archipelago. */
function siteLand(g: RealmGeo, x: number, y: number): number {
  let m = -1;
  for (const s of sitesByRealm.get(g.id)!) {
    const dx = Math.max(Math.abs(x - s.cx) - s.w / 2, 0),
      dy = Math.max(Math.abs(y - s.cy) - s.h / 2, 0);
    const d = Math.hypot(dx, dy);
    m = Math.max(m, 0.55 * (1 - d / 22));
  }
  return m;
}
/** Distance (tiles) from a point to the nearest settlement plot of its realm; 0 inside. */
export function siteDistance(g: RealmGeo, x: number, y: number): number {
  let best = Infinity;
  for (const s of sitesByRealm.get(g.id)!) {
    const dx = Math.max(Math.abs(x - s.cx) - s.w / 2, 0),
      dy = Math.max(Math.abs(y - s.cy) - s.h / 2, 0);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

/**
 * The kingdom road network: four roads run from the capital through each ring's village and town to its seaward
 * outpost or farm, gently weaving between the plots (straight at every plot's street). Distance in tiles to the
 * nearest road centre line.
 */
export function roadDistance(seed: number, g: RealmGeo, x: number, y: number): number {
  const l = F(seed);
  let best = Infinity;
  const reach = SHARD + 92 + 24;
  const sd = siteDistance(g, x, y);
  const w = smooth(sd, 8, 40);
  // north/south roads run along x = cx, east/west roads along y = cy
  if (Math.abs(y - g.cy) <= reach)
    best = Math.min(best, Math.abs(x - g.cx - Math.round(l.warp.noise(y / 55 + 3, 1.5) * 5 * w)));
  if (Math.abs(x - g.cx) <= reach)
    best = Math.min(best, Math.abs(y - g.cy - Math.round(l.warp2.noise(x / 55 - 3, 2.5) * 5 * w)));
  return best;
}

/**
 * The perpendicular coordinate of a kingdom road's centre line at `t`: for the north/south roads (axis 'ns') the x of
 * the road at y = t, for east/west roads the y at x = t. Matches `roadDistance` (whose weave is sampled on the line).
 */
export function roadCentre(seed: number, g: RealmGeo, axis: 'ns' | 'ew', t: number): number {
  const l = F(seed);
  if (axis === 'ns') {
    const w = smooth(siteDistance(g, g.cx, t), 8, 40);
    return g.cx + Math.round(l.warp.noise(t / 55 + 3, 1.5) * 5 * w);
  }
  const w = smooth(siteDistance(g, t, g.cy), 8, 40);
  return g.cy + Math.round(l.warp2.noise(t / 55 - 3, 2.5) * 5 * w);
}

/** Land height of the realm: >0 inland, about -0.2 at the beach; the coast is warped and ragged. */
export function realmHeight(seed: number, g: RealmGeo, x: number, y: number): number {
  const l = F(seed);
  const rx = x - g.cx,
    ry = y - g.cy;
  const wx = rx + l.warp.noise(x / 75 + 5, y / 75 - 9) * 30;
  const wy = ry + l.warp2.noise(x / 75 - 4, y / 75 + 8) * 30;
  const inland = 1 - Math.hypot(wx, wy) / REALM_R;
  let h = (inland + l.coast.fbm(x / 40, y / 40, 3) * 0.13) * 1.6 - 0.12;
  if (g.id === 'thalassara') {
    // an archipelago: the same continent broken into islands, with channels a sloop can pass
    const chop = l.isle.fbm(x / 46 + 17, y / 46 - 17, 2);
    h = h * 0.55 + 0.18 + chop * 0.75 - 0.35 * smooth(Math.hypot(rx, ry), 120, 330);
  }
  return Math.max(h, siteLand(g, x, y));
}

// ───────────────────────── biomes ─────────────────────────

const PALETTE: Record<RealmId, Biome[]> = {
  aurelion: ['meadow', 'meadow', 'meadow', 'meadow', 'autumn', 'forest', 'meadow'],
  sylvaris: ['forest', 'forest', 'forest', 'enchanted', 'enchanted', 'swamp', 'forest'],
  khardum: ['taiga', 'taiga', 'taiga', 'taiga', 'desert', 'autumn', 'taiga'],
  raijin: ['autumn', 'autumn', 'forest', 'forest', 'taiga', 'autumn', 'forest'],
  thalassara: ['meadow', 'meadow', 'swamp', 'desert', 'meadow', 'desert', 'swamp'],
  nethrakar: ['corrupted', 'corrupted', 'corrupted', 'corrupted', 'autumn', 'desert', 'corrupted'],
};
const REGION = 88;
export function realmBiome(seed: number, g: RealmGeo, x: number, y: number): Biome {
  const l = F(seed);
  const qx = x + l.warp.noise(x / 52 + 71, y / 52 - 33) * 22,
    qy = y + l.warp2.noise(x / 52 - 12, y / 52 + 90) * 22;
  const gx0 = Math.floor(qx / REGION),
    gy0 = Math.floor(qy / REGION);
  let best = Infinity,
    pick = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const sx = (gx0 + i + 0.15 + 0.7 * hash2(seed, gx0 + i, gy0 + j, 5201)) * REGION,
        sy = (gy0 + j + 0.15 + 0.7 * hash2(seed, gx0 + i, gy0 + j, 5202)) * REGION,
        d = (qx - sx) ** 2 + (qy - sy) ** 2;
      if (d < best) {
        best = d;
        pick = Math.floor(hash2(seed, gx0 + i, gy0 + j, 5203) * PALETTE[g.id].length);
      }
    }
  // the capital's surroundings always wear the realm's signature biome
  const cap = REALM_SITE_BY_ID[`${g.id}_capital`]!;
  if (Math.abs(x - cap.cx) < cap.w / 2 + 14 && Math.abs(y - cap.cy) < cap.h / 2 + 14) return PALETTE[g.id][0]!;
  return PALETTE[g.id][pick]!;
}

/** The realm of a tile for gen >= 5 worlds, or null over open sea / the home continent. */
export function realmOf(seed: number, x: number, y: number): { geo: RealmGeo; height: number } | null {
  const g = nearestRealm(x, y);
  if (!g) return null;
  return { geo: g, height: realmHeight(seed, g, x, y) };
}
/** True when (x, y) is land of one of the six kingdoms. */
export function inRealmLand(seed: number, x: number, y: number): RealmId | null {
  const r = realmOf(seed, x, y);
  return r && r.height > -0.2 ? r.geo.id : null;
}

/** Climate override for realm tiles (height drives sea/shore; temperature and moisture colour the weather). */
export function realmClimate(seed: number, x: number, y: number): ClimateSample | null {
  const r = realmOf(seed, x, y);
  if (!r) return null;
  const l = F(seed);
  const temp: Record<RealmId, number> = {
    aurelion: 0.05,
    sylvaris: 0,
    khardum: -0.55,
    raijin: -0.1,
    thalassara: 0.45,
    nethrakar: 0.35,
  };
  const wet: Record<RealmId, number> = {
    aurelion: 0,
    sylvaris: 0.3,
    khardum: -0.1,
    raijin: 0.2,
    thalassara: 0.4,
    nethrakar: -0.2,
  };
  const biome = realmBiome(seed, r.geo, x, y);
  const flux =
    biome === 'enchanted' ? 0.6 : biome === 'corrupted' ? -0.6 : l.flux.fbm(x / 130 - 900, y / 130 + 900, 2) * 0.8;
  return {
    height: r.height,
    moisture: wet[r.geo.id] + l.moist.fbm(x / 150 + 400, y / 150 - 400, 2) * 0.4,
    temperature: temp[r.geo.id],
    flux,
  };
}

// ───────────────────────── elevation ─────────────────────────

interface Massif {
  x: number;
  y: number;
  r: number;
  mesa: boolean;
  pass: number;
  half: number;
  id: number;
}
const MCELL = 104;
const massifs = new Map<string, Massif | null>();
/** Per-realm massif density: Khar-Dum's iron mountains, Raijin's misty peaks, gentle hills elsewhere. */
const MASSIF_P: Record<RealmId, number> = {
  aurelion: 0.12,
  sylvaris: 0.2,
  khardum: 0.78,
  raijin: 0.5,
  thalassara: 0.08,
  nethrakar: 0.4,
};
function massifOfCell(seed: number, g: RealmGeo, i: number, j: number): Massif | null {
  const key = `${seed}:${g.id}:${i},${j}`;
  const hit = massifs.get(key);
  if (hit !== undefined) return hit;
  let out: Massif | null = null;
  if (hash2(seed, i, j, 5301) < MASSIF_P[g.id]) {
    const x = Math.floor((i + 0.2 + 0.6 * hash2(seed, i, j, 5302)) * MCELL),
      y = Math.floor((j + 0.2 + 0.6 * hash2(seed, i, j, 5303)) * MCELL);
    const r = 24 + Math.floor(20 * hash2(seed, i, j, 5304));
    const h = realmHeight(seed, g, x, y);
    // keep clear of every settlement plot and of the coast
    if (h > 0.18 && siteDistance(g, x, y) > r * 0.7 + 10 && roadDistance(seed, g, x, y) > r * 0.85 + 8) {
      const biome = realmBiome(seed, g, x, y);
      if (biome !== 'swamp')
        out = {
          x,
          y,
          r,
          mesa: biome === 'desert',
          pass: hash2(seed, i, j, 5305) * Math.PI * 2,
          half: 0.4 + 0.2 * hash2(seed, i, j, 5306),
          id: i * 37 + j,
        };
    }
  }
  if (massifs.size > 2048) massifs.clear();
  massifs.set(key, out);
  return out;
}
const wrap = (a: number): number => {
  a = (a + Math.PI) % (Math.PI * 2);
  return (a < 0 ? a + Math.PI * 2 : a) - Math.PI;
};
function massifLevelAt(seed: number, g: RealmGeo, x: number, y: number): { level: number; inside: boolean } {
  let level = 0,
    inside = false;
  const gi = Math.floor(x / MCELL),
    gj = Math.floor(y / MCELL),
    l = F(seed);
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const m = massifOfCell(seed, g, gi + i, gj + j);
      if (!m) continue;
      const dx = x - m.x + l.warp.noise(x / 37 + 2, y / 37 - 2) * 4,
        dy = y - m.y + l.warp2.noise(x / 37 - 3, y / 37 + 5) * 4;
      const s = 1 - Math.hypot(dx, dy) / m.r;
      if (s <= 0) continue;
      inside = true;
      const inPass = Math.abs(wrap(Math.atan2(dy, dx) - m.pass)) < m.half;
      const jit = (hash2(seed, m.id, 7, 5307) - 0.5) * 0.06;
      let lv: number;
      if (m.mesa) lv = inPass ? 4 * smooth(s, 0.06, 0.5) : s > 0.3 + jit ? 4 : s > 0.12 + jit ? 2 : 0;
      else
        lv = inPass
          ? 8 * smooth(s, 0.1, 0.82)
          : s > 0.76 + jit
            ? 8
            : s > 0.56 + jit
              ? 6
              : s > 0.34 + jit
                ? 4
                : s > 0.14 + jit
                  ? 2
                  : 0;
      level = Math.max(level, Math.floor(lv + 0.0001));
    }
  return { level, inside };
}

/** Terrain level (0..MAX_LEVEL) of a realm tile; settlements and water are always level 0. */
export function realmLevel(seed: number, x: number, y: number): number {
  const r = realmOf(seed, x, y);
  if (!r || r.height < -0.1) return 0;
  const g = r.geo;
  const sd = Math.min(siteDistance(g, x, y), roadDistance(seed, g, x, y) * 2 + 4);
  if (sd < 16) return 0;
  const m = massifLevelAt(seed, g, x, y);
  // a settlement's apron blends to flat: the massif is cut back with the same ramp rule near plots
  if (m.inside) return sd < 26 ? Math.min(m.level, Math.floor((sd - 16) / 5)) : Math.min(MAX_LEVEL, m.level);
  if (g.id === 'thalassara') return 0;
  const h = F(seed).hill;
  const v = (h.noise(x / 74 + 90, y / 74 - 90) * 0.88 + h.noise(x / 29 - 40, y / 29 + 55) * 0.12) * 0.5 + 0.5;
  const mask = smooth(sd, 16, 44) * smooth(r.height, 0.0, 0.3);
  const amp = g.id === 'khardum' ? 3.99 : g.id === 'aurelion' ? 2.2 : 3.2;
  return Math.floor(smooth(v, 0.3, 0.86) * amp * mask);
}

export function realmChunkLevels(seed: number, cx: number, cy: number, tiles: Uint8Array): Uint8Array {
  const out = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  for (let y = 0; y < CHUNK_SIZE; y++)
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const t = tiles[y * CHUNK_SIZE + x]!;
      if (t === T.WATER || t === T.DEEP_WATER) continue;
      out[y * CHUNK_SIZE + x] = realmLevel(seed, cx * CHUNK_SIZE + x, cy * CHUNK_SIZE + y);
    }
  return out;
}

// ───────────────────────── tiles ─────────────────────────

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

const GROVE: Record<Biome, number> = {
  forest: 0.9,
  autumn: 0.8,
  taiga: 0.55,
  enchanted: 0.7,
  meadow: 0.25,
  swamp: 0.4,
  corrupted: 0.3,
  desert: 0,
};
const ROCKY: Record<Biome, number> = {
  taiga: 0.6,
  corrupted: 0.5,
  desert: 0.4,
  autumn: 0.3,
  forest: 0.2,
  enchanted: 0.25,
  meadow: 0.18,
  swamp: 0.1,
};

/**
 * Open ground of a kingdom (settlement plots are layered on top by the caller). Returns null when (x, y) is not in any
 * realm, so callers fall back to the ordinary ocean and islands.
 */
export function realmTileAt(seed: number, x: number, y: number): number | null {
  const r = realmOf(seed, x, y);
  if (!r) return null;
  const g = r.geo,
    h = r.height,
    l = F(seed);
  if (h < -0.42) return T.DEEP_WATER;
  if (h < -0.28) return T.WATER;
  const biome = realmBiome(seed, g, x, y);
  const sd = siteDistance(g, x, y),
    rd = roadDistance(seed, g, x, y);
  const level = realmLevel(seed, x, y);
  // the royal roads: three tiles wide, planked over any water
  if (rd < 1.6 && h > -0.28) return h < -0.05 ? T.FLOOR : T.PATH;
  const beach = (g.id === 'thalassara' ? -0.02 : -0.2) + 0.07 * l.beach.noise(x / 14 + 3, y / 14 - 3);
  // lakes and tarns, never beside a settlement or on high ground
  const lakeK: Record<RealmId, number> = {
    aurelion: 0.62,
    sylvaris: 0.5,
    khardum: 0.78,
    raijin: 0.56,
    thalassara: 2,
    nethrakar: 0.8,
  };
  if (level === 0 && sd > 14 && rd > 7 && h > 0.1 && l.lake.fbm(x / 60 + 7, y / 60 - 7, 2) > lakeK[g.id])
    return T.WATER;
  if (biome === 'corrupted' || g.id === 'nethrakar') {
    // basalt scars, ember vents and obsidian outcrops
    const gx = Math.floor(x / 56),
      gy = Math.floor(y / 56);
    if (sd > 18 && hash2(seed, gx, gy, 5401) < 0.16) {
      const vx = gx * 56 + 10 + Math.floor(hash2(seed, gx, gy, 5402) * 36),
        vy = gy * 56 + 10 + Math.floor(hash2(seed, gx, gy, 5403) * 36);
      const d = Math.hypot(x - vx, y - vy);
      if (d < 3.2) return T.LAVA;
      if (d < 5.2) return T.ROCK;
    }
  }
  if (h < beach || biome === 'desert') {
    if (biome !== 'desert') return T.SAND;
    const q = hash2(seed, x, y, 31);
    // palms in Thalassara, cacti and ash-scrub elsewhere
    if (q < (g.id === 'thalassara' ? 0.03 : 0.012)) return spacedTree(seed, x, y) ? T.TREE : T.SAND;
    if (q < 0.02) return T.ROCK;
    if (q < 0.026) return hash2(seed, Math.floor(x / 10), Math.floor(y / 10), 32) < 0.3 ? T.ORE_GOLD : T.ORE_COPPER;
    if (q < 0.05 && g.id !== 'thalassara') return T.GRASS_TALL;
    return T.SAND;
  }
  if (biome === 'swamp') {
    const pool = l.lake.noise(x / 30 + 55, y / 30 - 55);
    if (sd > 14 && pool > 0.56) return T.WATER;
    if (pool > 0.42) return hash2(seed, x, y, 33) < 0.3 ? T.GRASS_TALL : T.GRASS;
  }
  const q = hash2(seed, x, y, 1);
  const shimmerP = biome === 'enchanted' ? 0.07 : biome === 'corrupted' ? 0.025 : 0.025;
  const flux = biome === 'enchanted' ? 0.6 : biome === 'corrupted' ? 0.4 : l.flux.fbm(x / 130, y / 130, 2);
  if (flux > 0.3 && q < shimmerP && sd > 8) return T.SHIMMER;

  // Aurelion's orchards: even rows of fruit trees in pockets between the wheat country
  if (
    g.id === 'aurelion' &&
    sd > 10 &&
    level === 0 &&
    l.orchard.noise(x / 36 + 5, y / 36 - 5) > 0.35 &&
    x % 4 === 0 &&
    y % 4 === 0
  )
    return T.TREE;

  const shore = Math.max(0, h + 0.2);
  const gp = GROVE[biome] * (g.id === 'sylvaris' ? 1.15 : g.id === 'aurelion' ? 0.6 : 1);
  const grove = gp > 0 ? cluster(seed, x, y, 26, Math.min(0.95, gp), 5, g.id === 'sylvaris' ? 16 : 13, 5411) : 0;
  const lone = biome === 'forest' ? 0.014 : biome === 'swamp' || biome === 'corrupted' ? 0.01 : 0.004;
  const alpine = level >= 6 ? 0 : level >= 4 ? 0.4 : 1;
  const treeP = (lone + 0.62 * grove) * Math.min(1, shore * 6) * alpine;
  if (hash2(seed, x, y, 2) < treeP && sd > 6 && spacedTree(seed, x, y)) return T.TREE;

  const rocky = cluster(
    seed,
    x,
    y,
    34,
    Math.min(0.95, ROCKY[biome] + 0.08 * level + (g.id === 'khardum' ? 0.25 : 0)),
    3,
    8,
    5421,
  );
  const rr = hash2(seed, x, y, 3);
  const rockP = 0.003 + 0.42 * rocky + (level >= 5 ? 0.08 : 0);
  if (rr < rockP && sd > 6) {
    const o = hash2(seed, Math.floor(x / 10), Math.floor(y / 10), 6);
    if ((biome === 'corrupted' || biome === 'enchanted') && o < 0.25) return T.CRYSTAL;
    const rich = g.id === 'khardum' ? 0.18 : 0;
    if (o < 0.1 + rich) return T.ORE_GOLD;
    if (o < 0.22 + rich) return T.ORE_SILVER;
    if (o < 0.38 + rich) return T.ORE_IRON;
    if (o < 0.5) return T.ORE_COPPER;
    return T.ROCK;
  }
  if (hash2(seed, x, y, 9) < 0.004 + 0.04 * smooth(l.forest.fbm(x / 70 + 40, y / 70 - 40, 3), 0.02, 0.35) && sd > 6)
    return T.FORAGE;
  const meadow = l.meadow.fbm(x / 20 + 300, y / 20 - 300, 2);
  const flowerK =
    biome === 'taiga' || biome === 'corrupted' ? 0.1 : biome === 'enchanted' ? 0.8 : g.id === 'aurelion' ? 0.5 : 0.28;
  if (hash2(seed, x, y, 4) < flowerK * 0.6 * smooth(meadow, 0.2, 0.55)) return T.FLOWERS;
  const tall = l.meadow.fbm(x / 14 - 500, y / 14 + 500, 2);
  if (hash2(seed, x, y, 5) < 0.006 + 0.3 * smooth(tall, 0.05, 0.5)) return T.GRASS_TALL;
  return T.GRASS;
}
