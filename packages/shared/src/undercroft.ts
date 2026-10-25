import { hash2 } from './rng';
import { Simplex2D } from './simplex';
import { activeGeneration } from './generation-registry';
export const CAVE_OY = 40000,
  CAVE_CELL = 72;
export const CAVE_BIOMES = ['limestone', 'glowmoss', 'crystal', 'basalt', 'frost', 'drowned'] as const;
export type CaveBiome = (typeof CAVE_BIOMES)[number];
export const CAVE_BIOME_NAMES: Record<CaveBiome, string> = {
  limestone: 'Amber Galleries',
  glowmoss: 'Lanternroot Grotto',
  crystal: 'Prism Vaults',
  basalt: 'Cinder Hollows',
  frost: 'Rime Cathedral',
  drowned: 'Stillwater Deeps',
};
export interface CaveRegion {
  id: string;
  gx: number;
  gy: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  biome: CaveBiome;
  depth: number;
  feature: 'lake' | 'ruins' | 'secret' | 'puzzle' | 'vents' | 'arena' | 'grove';
}
const regions = new Map<string, CaveRegion>();
const FEATURES = ['lake', 'ruins', 'secret', 'puzzle', 'vents', 'arena', 'grove'] as const;
/**
 * Revision 4 deals features out in 3x3 blocks: every block holds one of each kind (plus a second ruin and lake), so
 * boss arenas, vault shrines, camps and puzzles are spread evenly instead of clumping or leaving long empty stretches.
 */
function latticeFeature(seed: number, gx: number, gy: number): CaveRegion['feature'] {
  const bx = Math.floor(gx / 3),
    by = Math.floor(gy / 3);
  const slots: Array<CaveRegion['feature']> = [...FEATURES, 'ruins', 'lake'];
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(hash2(seed, bx * 31 + i, by, 2420) * (i + 1));
    [slots[i], slots[j]] = [slots[j]!, slots[i]!];
  }
  const f = slots[gx - bx * 3 + 3 * (gy - by * 3)]!;
  // the first steps from the start ladder stay gentle: no boss arena within two districts of the origin
  return f === 'arena' && Math.hypot(gx, gy) < 2.2 ? 'grove' : f;
}
const biomeNoise = new Map<number, Simplex2D>();
const SITE = 56;
/**
 * Revision 4 biomes are continuous: warped Voronoi patches roughly 56 tiles across that cross district borders, so a
 * glowmoss grotto can run through three districts and a frozen hall can end in a basalt seam. The area under the
 * home vale is always limestone.
 */
export function caveBiomeField(seed: number, x: number, y: number): CaveBiome {
  const ly = y - CAVE_OY;
  if (Math.hypot(x, ly) < 60) return 'limestone';
  let n = biomeNoise.get(seed);
  if (!n) {
    n = new Simplex2D(seed ^ 0xb10e);
    if (biomeNoise.size > 8) biomeNoise.clear();
    biomeNoise.set(seed, n);
  }
  const wx = x + 11 * n.noise(x / 41, ly / 41),
    wy = ly + 11 * n.noise(x / 41 + 77, ly / 41 + 31);
  const cx = Math.floor(wx / SITE),
    cy = Math.floor(wy / SITE);
  let best = Infinity,
    pick = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const sx = (cx + i + hash2(seed, cx + i, cy + j, 2430)) * SITE,
        sy = (cy + j + hash2(seed, cx + i, cy + j, 2431)) * SITE,
        d = (wx - sx) ** 2 + (wy - sy) ** 2;
      if (d < best) {
        best = d;
        pick = Math.floor(hash2(seed, cx + i, cy + j, 2432) * 6);
      }
    }
  return CAVE_BIOMES[pick]!;
}
/** Biome of one cave tile for the world revision (continuous in revision 4, per-district before). */
export const caveBiomeAt = (
  seed: number,
  x: number,
  y: number,
  generation: number = activeGeneration(seed),
): CaveBiome => (generation >= 4 ? caveBiomeField(seed, x, y) : caveRegionAt(seed, x, y, generation).biome);
export function caveRegion(
  seed: number,
  gx: number,
  gy: number,
  generation: number = activeGeneration(seed),
): CaveRegion {
  const modern = generation >= 4,
    key = `${seed}:${gx},${gy}:${modern ? 4 : 2}`,
    old = regions.get(key);
  if (old) return old;
  const depth = Math.min(4, 1 + Math.floor(Math.hypot(gx, gy) / 4));
  const x = gx * 72 + 36 + Math.floor(hash2(seed, gx, gy, 2402) * 13) - 6,
    y = CAVE_OY + gy * 72 + 36 + Math.floor(hash2(seed, gx, gy, 2403) * 13) - 6;
  const r: CaveRegion = {
    id: `uc${gx}_${gy}`,
    gx,
    gy,
    x,
    y,
    rx: 19 + hash2(seed, gx, gy, 2404) * 7,
    ry: 17 + hash2(seed, gx, gy, 2405) * 7,
    biome: modern ? caveBiomeField(seed, x, y) : CAVE_BIOMES[Math.floor(hash2(seed, gx, gy, 2401) * 6)]!,
    depth,
    feature: modern ? latticeFeature(seed, gx, gy) : FEATURES[Math.floor(hash2(seed, gx, gy, 2406) * 7)]!,
  };
  if (regions.size >= 1024) regions.delete(regions.keys().next().value!);
  regions.set(key, r);
  return r;
}
export const caveRegionAt = (seed: number, x: number, y: number, generation?: number) =>
  caveRegion(seed, Math.floor(x / 72), Math.floor((y - CAVE_OY) / 72), generation);
export interface CavePoint {
  x: number;
  y: number;
}
const paths = new Map<string, CavePoint[][]>();
/** Four shared boundary gates make every district part of one connected network. */
export function caveRoutes(seed: number, gx: number, gy: number): CavePoint[][] {
  const key = `${seed}:${gx},${gy}`,
    old = paths.get(key);
  if (old) return old;
  const r = caveRegion(seed, gx, gy),
    x = gx * 72,
    y = CAVE_OY + gy * 72;
  const gates = [
    { x: x + 72, y: y + 28 + Math.floor(hash2(seed, gx, gy, 2410) * 17) },
    { x: x + 28 + Math.floor(hash2(seed, gx, gy, 2411) * 17), y: y + 72 },
    { x, y: y + 28 + Math.floor(hash2(seed, gx - 1, gy, 2410) * 17) },
    { x: x + 28 + Math.floor(hash2(seed, gx, gy - 1, 2411) * 17), y },
  ];
  const out = gates.map((p, i) => {
    const dx = p.x - r.x,
      dy = p.y - r.y,
      d = Math.hypot(dx, dy),
      bend = (hash2(seed, gx * 4 + i, gy, 2412) - 0.5) * 7;
    return [{ x: r.x, y: r.y }, { x: (r.x + p.x) / 2 - (dy / d) * bend, y: (r.y + p.y) / 2 + (dx / d) * bend }, p];
  });
  if (paths.size >= 512) paths.delete(paths.keys().next().value!);
  paths.set(key, out);
  return out;
}
export function segmentDistance2(x: number, y: number, a: CavePoint, b: CavePoint): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return (x - a.x - dx * t) ** 2 + (y - a.y - dy * t) ** 2;
}
export function caveRouteDistance2(seed: number, x: number, y: number): number {
  const r = caveRegionAt(seed, x, y);
  let d = Infinity;
  for (const p of caveRoutes(seed, r.gx, r.gy))
    for (let i = 1; i < p.length; i++) d = Math.min(d, segmentDistance2(x, y, p[i - 1]!, p[i]!));
  return d;
}
export function caveWaystation(seed: number, gx: number, gy: number): (CavePoint & { id: string }) | null {
  if (gx % 2 || gy % 2) return null;
  const r = caveRegion(seed, gx, gy);
  return { id: `lf${gx}_${gy}`, x: r.x - 7, y: r.y + 5 };
}
export const CAVE_TOWNS = [
  {
    id: 'hollowhearth',
    name: 'Hollowhearth',
    cx: -108,
    cy: CAVE_OY - 108,
    w: 64,
    h: 48,
    abandoned: false,
    culture: 'The Lamplighters keep a flame for every missing traveller.',
  },
  {
    id: 'prismdelve',
    name: 'Prismdelve',
    cx: 180,
    cy: CAVE_OY + 108,
    w: 64,
    h: 48,
    abandoned: false,
    culture: 'The Resonant Guild records its history in singing crystal.',
  },
  {
    id: 'bellfall',
    name: 'Bellfall',
    cx: -252,
    cy: CAVE_OY + 180,
    w: 56,
    h: 44,
    abandoned: true,
    culture: 'The bells rang once after everyone had gone.',
  },
  {
    id: 'stillwater',
    name: 'Stillwater Refuge',
    cx: 252,
    cy: CAVE_OY - 180,
    w: 56,
    h: 44,
    abandoned: true,
    culture: 'Water remembers the streets that the miners forgot.',
  },
] as const;
export const caveTownAt = (x: number, y: number) =>
  CAVE_TOWNS.find((t) => Math.abs(x - t.cx) <= t.w / 2 && Math.abs(y - t.cy) <= t.h / 2);
const NAMES = [
  'Neri Wick',
  'Bram Flintwake',
  'Iona Spore',
  'Tovin Brass',
  'Maeve Coal',
  'Orin Chalk',
  'Sera Bell',
  'Dara Root',
  'Avel Prism',
  'Kestrel Chime',
  'Lysa Quartz',
  'Pell Echo',
  'Venn Silver',
  'Mora Glass',
  'Iris Vein',
  'Tarn Rune',
];
export const CAVE_RESIDENTS = CAVE_TOWNS.filter((t) => !t.abandoned).flatMap((t, ti) =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `${t.id}_${i}`,
    name: NAMES[ti * 8 + i]!,
    title: ['Lamplighter', 'Provisioner', 'Medic', 'Prospector', 'Archivist', 'Smith', 'Cartographer', 'Mushroom cook'][
      i
    ]!,
    town: t.id,
    index: ti * 8 + i,
    local: i,
    culture: t.culture,
  })),
);
/** A charted lift direction is allowed; it never reveals surrounding terrain. */
export function caveExitsNear(seed: number, x: number, y: number): Array<CavePoint & { id: string; name: string }> {
  const gx = Math.floor(x / 144) * 2,
    gy = Math.floor((y - CAVE_OY) / 144) * 2,
    out: Array<CavePoint & { id: string; name: string }> = [];
  for (let j = -2; j <= 2; j += 2)
    for (let i = -2; i <= 2; i += 2) {
      const p = caveWaystation(seed, gx + i, gy + j)!;
      if (!caveTownAt(p.x, p.y)) out.push({ ...p, name: 'Surveyed supply lift' });
    }
  for (const t of CAVE_TOWNS)
    if (!t.abandoned) out.push({ id: `townlift:${t.id}`, name: `${t.name} lift`, x: t.cx + 3, y: t.cy + 5 });
  return out.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
}
