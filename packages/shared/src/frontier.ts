import { Simplex2D } from './simplex';
import { hash2 } from './rng';
import { sampleClimate } from './worldgen';
import { isCaveY } from './caves';
import { isDiveY } from './sanctuaries';
import { isUpperY } from './floors';
import { REALM_IDS, REALM_GEO, type RealmSite } from './realms';
import { buildRealmTown } from './realm-towns';
import { activeGeneration } from './generation-registry';
import type { Town } from './town';

/** One sparse province settlement candidate per region; never enumerate the world. */
export const FRONTIER_CELL = 1536;
const sites = new Map<string, RealmSite | null>();
const towns = new Map<string, Town>();
const PREFIX = [
  'Alder',
  'Amber',
  'Ash',
  'Bright',
  'Cedar',
  'Dawn',
  'Ember',
  'Fern',
  'Gold',
  'Grey',
  'Haven',
  'High',
  'Iron',
  'Moss',
  'Oak',
  'Silver',
];
const SUFFIX = [
  'bridge',
  'bury',
  'ford',
  'gate',
  'haven',
  'hold',
  'mere',
  'port',
  'rest',
  'stead',
  'vale',
  'watch',
  'wick',
  'wood',
  'fall',
  'crest',
];

export function frontierSite(seed: number, rx: number, ry: number): RealmSite | null {
  const key = `${seed}:${rx},${ry}`;
  if (sites.has(key)) return sites.get(key)!;
  let found: RealmSite | null = null;
  // Sparse regions leave the wilderness meaningful. Named kingdoms own the home seas.
  if (hash2(seed, rx, ry, 9600) < 0.72)
    for (let attempt = 0; attempt < 8; attempt++) {
      const cx = rx * FRONTIER_CELL + (1 + Math.floor(hash2(seed, rx + attempt, ry, 9601) * 5)) * 256;
      const cy = ry * FRONTIER_CELL + (1 + Math.floor(hash2(seed, rx, ry + attempt, 9602) * 5)) * 256;
      if (
        Math.hypot(cx, cy) < 1800 ||
        isCaveY(cy + 120) ||
        isDiveY(cy - 120) ||
        isDiveY(cy + 120) ||
        isUpperY(cy - 120) ||
        isUpperY(cy + 120)
      )
        continue;
      if (Object.values(REALM_GEO).some((g) => Math.hypot(cx - g.cx, cy - g.cy) < 650)) continue;
      // The coast reference is frozen at revision 2; no recursion through city overrides.
      if (sampleClimate(seed, cx, cy, 2).height < -0.65) continue;
      const realm = REALM_IDS[Math.floor(hash2(seed, rx, ry, 9603) * REALM_IDS.length)]!;
      const big = hash2(seed, rx, ry, 9604) < 0.7;
      const w = big ? 120 + Math.floor(hash2(seed, rx, ry, 9605) * 3) * 8 : 72;
      const h = big ? 96 + Math.floor(hash2(seed, rx, ry, 9606) * 3) * 8 : 64;
      const name =
        PREFIX[Math.floor(hash2(seed, rx, ry, 9607) * PREFIX.length)]! +
        SUFFIX[Math.floor(hash2(seed, rx, ry, 9608) * SUFFIX.length)]!;
      found = { id: `frontier_${rx}_${ry}`, realm, kind: big ? 'town' : 'village', cx, cy, w, h, ring: 'n', name };
      break;
    }
  sites.set(key, found);
  if (sites.size > 512) sites.delete(sites.keys().next().value!);
  return found;
}
export function frontierSitesNear(
  seed: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  generation: number = activeGeneration(seed),
): RealmSite[] {
  if (generation < 6 || ![x0, y0, x1, y1].every(Number.isFinite)) return [];
  const out: RealmSite[] = [];
  for (let y = Math.floor(y0 / FRONTIER_CELL); y <= Math.floor(y1 / FRONTIER_CELL); y++)
    for (let x = Math.floor(x0 / FRONTIER_CELL); x <= Math.floor(x1 / FRONTIER_CELL); x++) {
      const s = frontierSite(seed, x, y);
      if (s && s.cx + s.w / 2 >= x0 && s.cx - s.w / 2 <= x1 && s.cy + s.h / 2 >= y0 && s.cy - s.h / 2 <= y1)
        out.push(s);
    }
  return out;
}
export function frontierTown(seed: number, site: RealmSite): Town {
  const key = `${seed}:${site.id}`;
  let t = towns.get(key);
  if (t) {
    towns.delete(key);
    towns.set(key, t);
    return t;
  }
  t = buildRealmTown(site, seed, 6);
  t.site = site;
  towns.set(key, t);
  if (towns.size > 16) towns.delete(towns.keys().next().value!);
  return t;
}
export function frontierTownsNear(
  seed: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  generation: number = activeGeneration(seed),
): Town[] {
  return frontierSitesNear(seed, x0, y0, x1, y1, generation).map((s) => frontierTown(seed, s));
}
export function frontierTownAt(
  seed: number,
  x: number,
  y: number,
  generation: number = activeGeneration(seed),
): Town | null {
  return frontierTownsNear(seed, x, y, x, y, generation)[0] ?? null;
}
/** Gradual apron keeps streets flat and avoids an abrupt cliff at a city edge. */
export function frontierLevel(seed: number, x: number, y: number, natural: number, generation: number): number {
  const s = frontierSitesNear(seed, x - 24, y - 24, x + 24, y + 24, generation)[0];
  if (!s) return natural;
  const distance = Math.max(0, Math.abs(x - s.cx) - s.w / 2, Math.abs(y - s.cy) - s.h / 2);
  return Math.round(natural * Math.min(1, distance / 24));
}

const coastFields = new Map<number, Simplex2D>();
/** Broad province islands, not rectangular city shelves or scattered puddles. */
export function frontierCoast(seed: number, x: number, y: number): number | null {
  const s = frontierSitesNear(seed, x - 430, y - 430, x + 430, y + 430, 6)[0];
  if (!s) return null;
  let f = coastFields.get(seed);
  if (!f) {
    f = new Simplex2D(seed ^ 0x9600);
    coastFields.set(seed, f);
    if (coastFields.size > 8) coastFields.delete(coastFields.keys().next().value!);
  }
  const dx = x - s.cx + f.noise(x / 95, y / 95) * 22,
    dy = y - s.cy + f.noise(x / 110 + 91, y / 110 - 45) * 26;
  return (1 - Math.hypot(dx, dy) / 340) * 1.3 - 0.12 + f.noise(x / 65, y / 65) * 0.06;
}
