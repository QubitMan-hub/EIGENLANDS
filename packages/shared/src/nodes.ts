import { T } from './tiles';
import { catalogSources } from './catalog';

export type SkillId = 'farming' | 'mining' | 'foraging' | 'fishing' | 'crafting';
export interface Drop {
  item: string;
  min: number;
  max: number;
  chance: number;
  minTier?: number;
  /** only in this kingdom's land (a realm id) */
  realm?: string;
  /** only in this Undercroft biome */
  cave?: string;
}
export interface NodeDef {
  tile: number;
  tool: 'axe' | 'pickaxe' | null;
  /** minimum tool tier to damage it */
  minTier: number;
  hp: number;
  skill: SkillId;
  xp: number;
  drops: Drop[];
  /** tile it turns into, and seconds until it grows back to `tile` */
  to: number;
  respawnSec: number;
  label: string;
}

const n = (
  tile: number,
  label: string,
  tool: NodeDef['tool'],
  minTier: number,
  hp: number,
  skill: SkillId,
  xp: number,
  drops: Drop[],
  to: number,
  respawnSec: number,
): NodeDef => ({ tile, label, tool, minTier, hp, skill, xp, drops, to, respawnSec });

/** Gatherable world tiles. Damage per swing = 3 + 2 * tier (+ skill haste). */
export const NODES: Record<number, NodeDef> = {
  [T.TREE]: n(
    T.TREE,
    'Tree',
    'axe',
    1,
    14,
    'foraging',
    6,
    [
      { item: 'wood', min: 3, max: 5, chance: 1 },
      { item: 'fiber', min: 1, max: 2, chance: 0.4 },
      { item: 'heartwood', min: 1, max: 1, chance: 0.05, minTier: 3 },
    ],
    T.STUMP,
    1200,
  ),
  [T.STUMP]: n(
    T.STUMP,
    'Stump',
    'axe',
    1,
    6,
    'foraging',
    2,
    [{ item: 'wood', min: 1, max: 2, chance: 1 }],
    T.GRASS,
    600,
  ),
  [T.ROCK]: n(
    T.ROCK,
    'Boulder',
    'pickaxe',
    1,
    10,
    'mining',
    4,
    [
      { item: 'stone', min: 2, max: 4, chance: 1 },
      { item: 'coal', min: 1, max: 2, chance: 0.18 },
      { item: 'copper_ore', min: 1, max: 1, chance: 0.06 },
    ],
    T.GRASS,
    900,
  ),
  [T.ORE_COPPER]: n(
    T.ORE_COPPER,
    'Copper outcrop',
    'pickaxe',
    1,
    12,
    'mining',
    9,
    [
      { item: 'copper_ore', min: 2, max: 4, chance: 1 },
      { item: 'stone', min: 1, max: 2, chance: 0.5 },
    ],
    T.GRASS,
    1500,
  ),
  [T.ORE_IRON]: n(
    T.ORE_IRON,
    'Iron outcrop',
    'pickaxe',
    2,
    18,
    'mining',
    15,
    [
      { item: 'iron_ore', min: 2, max: 3, chance: 1 },
      { item: 'coal', min: 1, max: 2, chance: 0.3 },
    ],
    T.GRASS,
    1800,
  ),
  [T.ORE_SILVER]: n(
    T.ORE_SILVER,
    'Silver outcrop',
    'pickaxe',
    3,
    24,
    'mining',
    24,
    [{ item: 'silver_ore', min: 1, max: 3, chance: 1 }],
    T.GRASS,
    2400,
  ),
  [T.ORE_GOLD]: n(
    T.ORE_GOLD,
    'Gold outcrop',
    'pickaxe',
    3,
    30,
    'mining',
    34,
    [{ item: 'gold_ore', min: 1, max: 2, chance: 1 }],
    T.GRASS,
    3000,
  ),
  [T.CRYSTAL]: n(
    T.CRYSTAL,
    'Qubit crystal',
    'pickaxe',
    4,
    36,
    'mining',
    60,
    [{ item: 'qubit_crystal', min: 1, max: 1, chance: 1 }],
    T.GRASS,
    3600,
  ),
  // undercroft rock: tunnels you dig stay dug
  [T.CAVE_WALL]: n(
    T.CAVE_WALL,
    'Cave rock',
    'pickaxe',
    1,
    16,
    'mining',
    3,
    [
      { item: 'stone', min: 1, max: 3, chance: 1 },
      { item: 'coal', min: 1, max: 1, chance: 0.12 },
      { item: 'iron_ore', min: 1, max: 1, chance: 0.04, minTier: 2 },
    ],
    T.CAVE_FLOOR,
    0,
  ),
  // ── Undercroft 2: veins inside the wall; the open floor stays behind
  [T.CAVE_COAL]: n(
    T.CAVE_COAL,
    'Coal seam',
    'pickaxe',
    1,
    10,
    'mining',
    6,
    [
      { item: 'coal', min: 2, max: 4, chance: 1 },
      { item: 'stone', min: 0, max: 1, chance: 0.4 },
    ],
    T.CAVE_FLOOR,
    0,
  ),
  [T.CAVE_COPPER]: n(
    T.CAVE_COPPER,
    'Copper vein',
    'pickaxe',
    1,
    12,
    'mining',
    9,
    [
      { item: 'copper_ore', min: 2, max: 4, chance: 1 },
      { item: 'stone', min: 1, max: 2, chance: 0.5 },
    ],
    T.CAVE_FLOOR,
    0,
  ),
  [T.CAVE_IRON]: n(
    T.CAVE_IRON,
    'Iron vein',
    'pickaxe',
    2,
    18,
    'mining',
    15,
    [
      { item: 'iron_ore', min: 2, max: 3, chance: 1 },
      { item: 'coal', min: 1, max: 2, chance: 0.3 },
    ],
    T.CAVE_FLOOR,
    0,
  ),
  [T.CAVE_SILVER]: n(
    T.CAVE_SILVER,
    'Silver vein',
    'pickaxe',
    3,
    24,
    'mining',
    24,
    [{ item: 'silver_ore', min: 1, max: 3, chance: 1 }],
    T.CAVE_FLOOR,
    0,
  ),
  [T.CAVE_GOLD]: n(
    T.CAVE_GOLD,
    'Gold vein',
    'pickaxe',
    3,
    30,
    'mining',
    34,
    [{ item: 'gold_ore', min: 1, max: 2, chance: 1 }],
    T.CAVE_FLOOR,
    0,
  ),
  [T.CAVE_CRYSTAL]: n(
    T.CAVE_CRYSTAL,
    'Qubit crystal vein',
    'pickaxe',
    4,
    36,
    'mining',
    60,
    [{ item: 'qubit_crystal', min: 1, max: 1, chance: 1 }],
    T.CAVE_FLOOR,
    0,
  ),
  [T.CAVE_GEODE]: n(
    T.CAVE_GEODE,
    'Crystal geode',
    'pickaxe',
    4,
    52,
    'mining',
    90,
    [
      { item: 'qubit_crystal', min: 2, max: 3, chance: 1 },
      { item: 'gold_ore', min: 1, max: 1, chance: 0.35 },
    ],
    T.CAVE_FLOOR,
    0,
  ),
  [T.STALAGMITE]: n(
    T.STALAGMITE,
    'Stalagmite',
    'pickaxe',
    1,
    8,
    'mining',
    2,
    [{ item: 'stone', min: 1, max: 2, chance: 1 }],
    T.CAVE_FLOOR,
    0,
  ),
  [T.CAVE_BOULDER]: n(
    T.CAVE_BOULDER,
    'Fallen boulder',
    'pickaxe',
    1,
    14,
    'mining',
    4,
    [
      { item: 'stone', min: 2, max: 4, chance: 1 },
      { item: 'coal', min: 1, max: 1, chance: 0.1 },
    ],
    T.CAVE_FLOOR,
    0,
  ),
  [T.FENCE]: n(
    T.FENCE,
    'Fence',
    'axe',
    1,
    2,
    'foraging',
    0,
    [{ item: 'fence', min: 1, max: 1, chance: 1 }],
    T.GRASS,
    0,
  ),
};

/** Seasonal forage found on FORAGE tiles (spring, summer, autumn, winter). */
export const FORAGE_BY_SEASON: string[][] = [
  ['wild_leek', 'daffodil', 'healing_herb'],
  ['blackberry', 'sunpetal', 'healing_herb'],
  ['mushroom', 'hazelnut', 'blackberry'],
  ['snow_yam', 'crocus'],
];

/** Catalog forage per season (weighted): herbs, spices, wild fruit. Rolled alongside the base list so old finds stay common. */
export const FORAGE_EXTRA_BY_SEASON: Array<Array<{ item: string; weight: number; realm?: string }>> = [[], [], [], []];
for (const { item, src } of catalogSources())
  if (src.k === 'forage')
    for (const s of src.seasons)
      FORAGE_EXTRA_BY_SEASON[s]?.push({ item, weight: src.weight, ...(src.realm ? { realm: src.realm } : {}) });
/** What a forage tile gives: mostly the base list, a third of the time something from the catalog. */
export function pickForage(season: number, rand: () => number, realm: string | null): string {
  const extra = (FORAGE_EXTRA_BY_SEASON[season] ?? []).filter((e) => !e.realm || e.realm === realm);
  if (extra.length && rand() < 0.38) {
    let total = 0;
    for (const e of extra) total += e.weight;
    let r = rand() * total;
    for (const e of extra) if ((r -= e.weight) < 0) return e.item;
  }
  const list = FORAGE_BY_SEASON[season]!;
  return list[Math.floor(rand() * list.length)]!;
}

export const toolDamage = (tier: number, skillLevel: number, hasteBonus = 0): number =>
  Math.round((3 + 2 * tier) * (1 + 0.05 * skillLevel + hasteBonus));

// The catalog adds drops to the existing nodes (realm metals, cave minerals, woods, gems ...): data, not code.
for (const { item, src } of catalogSources())
  if (src.k === 'node') {
    const node = NODES[src.tile];
    if (!node) throw new Error(`catalog: ${item} drops from unknown node tile ${src.tile}`);
    node.drops.push({
      item,
      min: src.min,
      max: src.max,
      chance: src.chance,
      minTier: src.tier,
      ...(src.realm ? { realm: src.realm } : {}),
      ...(src.cave ? { cave: src.cave } : {}),
    });
  }

/** May this drop fall here? `realm` is the kingdom of the tile (null on the home continent and at sea), `cave` the biome underground. */
export const dropAllowed = (d: Drop, realm: string | null, cave: string | null): boolean =>
  (!d.realm || d.realm === realm) && (!d.cave || d.cave === cave);
