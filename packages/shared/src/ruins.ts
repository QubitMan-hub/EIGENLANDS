import { hash2, mulberry32 } from './rng';
import type { Stack } from './items';
import type { WorldObj } from './objects';
import { isSolid } from './tiles';
import { townFor, townAt } from './town';
import { HOME_VALE, biomeAt, sampleClimate, landmarkTileAt, type Biome } from './worldgen';

/**
 * Ruins: the wild remembers older settlers. Each 96x96-tile cell beyond the home vale may hold a ruined site styled
 * by its biome (a toppled colonnade in the woods, a frozen cairn on the tundra, a sunken idol in the fen, a buried
 * obelisk in the dunes, a crystal arch in the glade, a decohered monolith in the wastes). Every site keeps a treasure
 * cache that each traveller may open once. Placement is a pure function of the seed: nothing is stored.
 */
export interface RuinSite {
  id: string;
  x: number;
  y: number;
  biome: Biome;
}

const CELL = 96;
const cache = new Map<string, RuinSite | null>();

function clearAround(seed: number, x: number, y: number): boolean {
  if (townAt(seed, x, y)) return false;
  // the heart of the site must be dry, open ground; walls that would land on trees or rocks simply fell long ago
  for (let j = -1; j <= 2; j++)
    for (let i = -1; i <= 1; i++) if (isSolid(landmarkTileAt(seed, x + i, y + j))) return false;
  return sampleClimate(seed, x, y).height > -0.15;
}

export function ruinOfCell(seed: number, gx: number, gy: number): RuinSite | null {
  const key = `${seed}:${gx},${gy}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let out: RuinSite | null = null;
  if (hash2(seed, gx, gy, 951) < 0.55) {
    const t = townFor(seed);
    for (let k = 0; k < 12 && !out; k++) {
      const x = gx * CELL + 12 + Math.floor(hash2(seed, gx * 13 + k, gy, 952) * (CELL - 24));
      const y = gy * CELL + 12 + Math.floor(hash2(seed, gx, gy * 13 + k, 953) * (CELL - 24));
      if (Math.hypot(x, y) < HOME_VALE + 8 || (x > t.x0 - 10 && x < t.x1 + 10 && y > t.y0 - 10 && y < t.y1 + 10))
        continue;
      if (!clearAround(seed, x, y)) continue;
      out = { id: `ru${gx}_${gy}`, x, y, biome: biomeAt(seed, x, y) };
    }
  }
  if (cache.size > 4000) cache.clear();
  cache.set(key, out);
  return out;
}

/** The centrepiece each biome raises at a ruin. */
export const RUIN_MONUMENT: Record<Biome, string> = {
  meadow: 'ruin_arch',
  forest: 'ruin_arch',
  autumn: 'ruin_arch',
  taiga: 'ruin_cairn',
  swamp: 'ruin_idol',
  desert: 'ruin_obelisk',
  enchanted: 'ruin_crystal',
  corrupted: 'ruin_monolith',
};

/** Static objects of a ruin: broken walls and pillars around a monument, rubble, and the cache. */
export function ruinObjects(seed: number, s: RuinSite): WorldObj[] {
  const rng = mulberry32((s.x * 73856093) ^ (s.y * 19349663) ^ seed);
  const out: WorldObj[] = [];
  const add = (x: number, y: number, sub: string, data?: Record<string, unknown>) => {
    if (out.some((o) => o.x === x && o.y === y)) return;
    out.push({ x, y, kind: 'deco', sub, static: true, data: { biome: s.biome, ...(data ?? {}) } });
  };
  add(s.x, s.y - 1, RUIN_MONUMENT[s.biome]);
  // a broken ring of walls and columns (gaps where they fell), rubble spilled outward
  const ring: Array<[number, number]> = [
    [-3, -3],
    [-1, -3],
    [1, -3],
    [3, -3],
    [-3, -1],
    [3, -1],
    [-3, 1],
    [3, 1],
    [-3, 3],
    [3, 3],
  ];
  for (const [dx, dy] of ring) {
    const r = rng();
    if (r < 0.3) continue;
    add(
      s.x + dx,
      s.y + dy,
      Math.abs(dx) === 3 && Math.abs(dy) === 3 ? 'ruin_pillar' : r < 0.7 ? 'ruin_wall' : 'ruin_pillar',
    );
  }
  for (let i = 0; i < 4; i++)
    add(s.x + Math.round((rng() - 0.5) * 9), s.y + Math.round((rng() - 0.5) * 9), 'ruin_rubble');
  add(s.x + 1, s.y + 1, 'ruin_cache', { ruin: s.id });
  // drop anything that landed on a solid tile (trees, rocks, water)
  return out.filter((o) => !isSolid(landmarkTileAt(seed, o.x, o.y)));
}

/** Ruin objects that live in chunk (cx, cy). */
export function ruinObjectsIn(seed: number, cx: number, cy: number): WorldObj[] {
  const out: WorldObj[] = [];
  const x0 = cx * 32,
    y0 = cy * 32;
  for (let gy = Math.floor((y0 - 8) / CELL); gy <= Math.floor((y0 + 40) / CELL); gy++) {
    for (let gx = Math.floor((x0 - 8) / CELL); gx <= Math.floor((x0 + 40) / CELL); gx++) {
      const s = ruinOfCell(seed, gx, gy);
      if (!s) continue;
      for (const o of ruinObjects(seed, s)) if (Math.floor(o.x / 32) === cx && Math.floor(o.y / 32) === cy) out.push(o);
    }
  }
  return out;
}

/** What a ruin's cache holds: common finds from its land, plus a chance of something rare. */
const LOOT: Record<Biome, Array<[string, number, number]>> = {
  meadow: [
    ['copper_ingot', 2, 4],
    ['healing_potion', 1, 2],
    ['superposed_seed', 1, 2],
    ['coal', 3, 6],
  ],
  forest: [
    ['heartwood', 2, 4],
    ['hazelnut', 3, 6],
    ['regen_potion', 1, 1],
    ['iron_ingot', 1, 3],
  ],
  autumn: [
    ['pumpkin_seed', 3, 5],
    ['berry_jam', 1, 2],
    ['boar_tusk', 1, 3],
    ['iron_ingot', 1, 3],
  ],
  taiga: [
    ['silver_ingot', 1, 3],
    ['snow_yam', 2, 4],
    ['wolf_fang', 1, 3],
    ['ward_potion', 1, 1],
  ],
  swamp: [
    ['mushroom', 3, 6],
    ['regen_potion', 1, 2],
    ['eel', 1, 1],
    ['slime_gel', 3, 6],
  ],
  desert: [
    ['gold_ingot', 1, 2],
    ['doubloon', 2, 5],
    ['sunpetal', 2, 4],
    ['might_potion', 1, 1],
  ],
  enchanted: [
    ['qubit_crystal', 1, 2],
    ['glowfin', 1, 1],
    ['lantern_potion', 1, 2],
    ['phase_tonic_a', 1, 2],
  ],
  corrupted: [
    ['qubit_crystal', 2, 3],
    ['void_core', 1, 1],
    ['silver_ingot', 2, 3],
    ['ward_potion', 1, 2],
  ],
};
const RARE: string[] = ['shrine_shard', 'outfit_gold', 'outfit_frost', 'qubit_tea', 'heart_crystal'];

export function ruinLoot(seed: number, ruinId: string, biome: Biome, rand: () => number): Stack[] {
  const table = LOOT[biome];
  const out: Stack[] = [];
  const picks = 2 + Math.floor(rand() * 2);
  const used = new Set<number>();
  for (let i = 0; i < picks; i++) {
    let k = Math.floor(rand() * table.length);
    while (used.has(k)) k = (k + 1) % table.length;
    used.add(k);
    const [id, lo, hi] = table[k]!;
    out.push({ id, n: lo + Math.floor(rand() * (hi - lo + 1)) });
  }
  if (rand() < 0.18) out.push({ id: RARE[Math.floor(rand() * RARE.length)]!, n: 1 });
  void seed;
  void ruinId;
  return out;
}

export const RUIN_NAMES: Record<string, string> = {
  ruin_arch: 'Fallen colonnade',
  ruin_cairn: 'Frozen cairn',
  ruin_idol: 'Sunken idol',
  ruin_obelisk: 'Buried obelisk',
  ruin_crystal: 'Crystal arch',
  ruin_monolith: 'Decohered monolith',
};

/** What a traveller reads on each kind of monument. */
export const RUIN_LORE: Record<string, { plaque: string; epitaph: string; pages: string[] }> = {
  ruin_arch: {
    plaque: 'HERE WE MEASURED THE MORNING',
    epitaph: 'The colonnade of the first surveyors.',
    pages: [
      'Before Hadamere there were the Surveyors, who walked the vale with lenses of polished qubit glass.',
      'They raised these arches where the light split cleanly in two, and wrote down which way it fell each dawn.',
      'The arches fell. The habit of looking stayed.',
    ],
  },
  ruin_cairn: {
    plaque: 'COLD KEEPS WHAT IT IS GIVEN',
    epitaph: 'A waymark of the tundra walkers.',
    pages: [
      'Each stone was carried up from the valley by someone who meant to come back.',
      'Under the frost, the stones still remember the order they were stacked in. Ice is a patient memory.',
    ],
  },
  ruin_idol: {
    plaque: 'SHE WHO DOES NOT DECIDE',
    epitaph: 'An idol half-swallowed by the fen.',
    pages: [
      'The fen folk prayed to an undecided goddess: the one who was every answer until someone asked.',
      'They say she sank because too many people looked at her at once.',
    ],
  },
  ruin_obelisk: {
    plaque: 'THE SAND REMEMBERS EVERY WAVE',
    epitaph: 'A buried obelisk of the dune scribes.',
    pages: [
      'The scribes carved the shapes the wind left in the sand: crests where waves met and doubled, flats where they cancelled.',
      'Read the dunes long enough and you can tell which way the wind blew a thousand years ago.',
    ],
  },
  ruin_crystal: {
    plaque: 'TWO STONES, ONE SONG',
    epitaph: 'An arch grown from a single crystal.',
    pages: [
      'Strike one pillar and the other answers, whichever is nearer, whichever is farther.',
      'The glade-keepers called them married stones. Nobody has ever heard one ring alone.',
    ],
  },
  ruin_monolith: {
    plaque: 'WE LOOKED TOO LONG',
    epitaph: 'A monolith at the heart of the wastes.',
    pages: [
      'Something here was once in a thousand states at once. Then everything around it looked, and kept looking.',
      'The land collapsed into the one answer nobody wanted. Walk softly. It is still settling.',
    ],
  },
};
