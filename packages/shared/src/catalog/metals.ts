import { T } from '../tiles';
import { COL as C, item, rec, src } from './kit';
import type { Rarity } from '../crafting';

/**
 * The metal ladder. Every metal has the same chain so the player learns it once: ore -> ingot (furnace) -> plate and
 * rod (forge). Plates become armour and shields, rods become blades, hafts and tools. Higher metals need a better
 * pickaxe to mine and more discipline to work, and realm metals are only found in their own kingdom.
 */
export interface Metal {
  id: string;
  name: string;
  /** hardness: tool tier of a pickaxe made of it, and how hard a pick must be to mine its ore */
  tier: number;
  rarity: Rarity;
  /** ore and ingot colours */
  ore: [number, number];
  ing: [number, number];
  /** interference-forging phase 0..7 */
  phase: number;
  /** discipline level to smelt/work it */
  lvl: number;
  /** present in the base game: only the plate/rod/wire chain is added */
  base?: boolean;
  /** how the ore is found (new metals only) */
  find?: Array<ReturnType<typeof src.node>>;
  /** an alloy: made from other ingots instead of ore */
  alloy?: { from: Array<[string, number]>; out: number };
  realm?: string;
  /** smelting: ore needed per ingot and coal */
  smelt?: [number, number];
  /** wire is only made of metals goldsmiths draw */
  wire?: boolean;
  blurb: string;
}

/** Parts no recipe uses are not made: every part in the catalog earns its place. */
const NO_PART = new Set(['tin_rod', 'tin_wire', 'bronze_wire', 'silver_rod', 'gold_plate', 'gold_rod']);

export const METALS: Metal[] = [
  {
    id: 'copper',
    name: 'Copper',
    tier: 2,
    rarity: 0,
    ore: [C.e4, C.e6],
    ing: [C.e4, C.e6],
    phase: 1,
    lvl: 1,
    base: true,
    wire: true,
    blurb: 'Soft and bright. The first metal.',
  },
  {
    id: 'tin',
    name: 'Tin',
    tier: 2,
    rarity: 0,
    ore: [C.fog, C.pale],
    ing: [C.fog, C.white],
    phase: 4,
    lvl: 2,
    smelt: [2, 1],
    wire: true,
    find: [
      src.node(T.ORE_COPPER, 1, 2, 0.4, 1),
      src.node(T.CAVE_COPPER, 1, 2, 0.4, 1),
      src.node(T.ROCK, 1, 1, 0.05, 1),
    ],
    blurb: 'Dull and pliable. Alone it is weak; with copper it makes bronze.',
  },
  {
    id: 'bronze',
    name: 'Bronze',
    tier: 2,
    rarity: 1,
    ore: [C.e3, C.e5],
    ing: [C.e3, C.e5],
    phase: 2,
    lvl: 4,
    wire: true,
    alloy: {
      from: [
        ['copper_ingot', 3],
        ['tin_ingot', 1],
      ],
      out: 4,
    },
    blurb: 'Copper hardened with tin. Holds an edge far better than either.',
  },
  {
    id: 'iron',
    name: 'Iron',
    tier: 3,
    rarity: 0,
    ore: [C.steel, C.w5],
    ing: [C.steel, C.w5],
    phase: 5,
    lvl: 6,
    base: true,
    blurb: 'The workhorse metal.',
  },
  {
    id: 'steel',
    name: 'Steel',
    tier: 4,
    rarity: 1,
    ore: [C.slate, C.mist],
    ing: [C.slate, C.pale],
    phase: 5,
    lvl: 9,
    alloy: {
      from: [
        ['iron_ingot', 2],
        ['coal', 3],
      ],
      out: 1,
    },
    blurb: 'Iron folded with carbon: keen, springy and tough.',
  },
  {
    id: 'silver',
    name: 'Silver',
    tier: 4,
    rarity: 1,
    ore: [C.pale, C.w7],
    ing: [C.pale, C.w7],
    phase: 4,
    lvl: 8,
    base: true,
    wire: true,
    blurb: 'Bright and a little magical.',
  },
  {
    id: 'gold',
    name: 'Gold',
    tier: 3,
    rarity: 2,
    ore: [C.e5, C.e7],
    ing: [C.e5, C.e7],
    phase: 2,
    lvl: 8,
    base: true,
    wire: true,
    blurb: 'Soft and heavy; wonderful for conducting magic.',
  },
  {
    id: 'mithril',
    name: 'Mithril',
    tier: 6,
    rarity: 3,
    ore: [C.w4, C.q7],
    ing: [C.w5, C.white],
    phase: 4,
    lvl: 14,
    smelt: [3, 2],
    find: [
      src.node(T.CAVE_SILVER, 1, 1, 0.28, 4, { cave: 'frost' }),
      src.node(T.CAVE_GEODE, 1, 2, 0.4, 4, { cave: 'frost' }),
      src.node(T.CAVE_CRYSTAL, 1, 1, 0.22, 4, { cave: 'crystal' }),
    ],
    wire: true,
    blurb: 'Pale blue, light as cloth, hard as a promise. Found deep in the frost.',
  },
  {
    id: 'adamant',
    name: 'Adamant',
    tier: 7,
    rarity: 4,
    ore: [C.g2, C.g5],
    ing: [C.g3, C.g6],
    phase: 3,
    lvl: 18,
    smelt: [4, 3],
    find: [
      src.node(T.CAVE_GEODE, 1, 1, 0.3, 5, { cave: 'basalt' }),
      src.node(T.CAVE_CRYSTAL, 1, 1, 0.18, 5, { cave: 'basalt' }),
    ],
    blurb: 'A green-black metal that shrugs off blades. It needs a crystal pick and a patient smith.',
  },
  {
    id: 'voidsteel',
    name: 'Voidsteel',
    tier: 8,
    rarity: 5,
    ore: [C.q1, C.q4],
    ing: [C.q2, C.q5],
    phase: 6,
    lvl: 24,
    alloy: {
      from: [
        ['adamant_ingot', 2],
        ['void_core', 1],
        ['qubit_crystal', 2],
      ],
      out: 2,
    },
    blurb: 'Adamant quenched in a collapsed wavefunction. It is not quite always there.',
  },
  // ── the kingdoms' own metals, found only on their soil
  {
    id: 'skysteel',
    name: 'Skysteel',
    tier: 4,
    rarity: 2,
    ore: [C.w5, C.e7],
    ing: [C.w4, C.e7],
    phase: 5,
    lvl: 10,
    realm: 'aurelion',
    smelt: [2, 2],
    find: [
      src.node(T.ORE_IRON, 1, 2, 0.35, 2, { realm: 'aurelion' }),
      src.node(T.ROCK, 1, 1, 0.06, 1, { realm: 'aurelion' }),
    ],
    blurb: 'Iron that fell from the Aurelian sky: blue-bright and gold-flecked.',
  },
  {
    id: 'deepsteel',
    name: 'Deepsteel',
    tier: 5,
    rarity: 3,
    ore: [C.slate, C.r3],
    ing: [C.night, C.r4],
    phase: 0,
    lvl: 12,
    realm: 'khardum',
    smelt: [3, 3],
    find: [
      src.node(T.ORE_IRON, 1, 2, 0.4, 3, { realm: 'khardum' }),
      src.node(T.ROCK, 1, 1, 0.08, 1, { realm: 'khardum' }),
    ],
    blurb: 'Khar-Dum’s black, forge-red metal, folded a hundred times.',
  },
  {
    id: 'stormiron',
    name: 'Stormiron',
    tier: 5,
    rarity: 3,
    ore: [C.w3, C.q7],
    ing: [C.w4, C.q6],
    phase: 5,
    lvl: 12,
    realm: 'raijin',
    smelt: [3, 2],
    find: [
      src.node(T.ORE_IRON, 1, 2, 0.4, 3, { realm: 'raijin' }),
      src.node(T.ROCK, 1, 1, 0.08, 1, { realm: 'raijin' }),
    ],
    blurb: 'Raijin iron that has been struck by lightning. It hums when drawn.',
  },
  {
    id: 'tidesilver',
    name: 'Tidesilver',
    tier: 4,
    rarity: 2,
    ore: [C.w6, C.w7],
    ing: [C.w6, C.white],
    phase: 4,
    lvl: 10,
    realm: 'thalassara',
    smelt: [2, 2],
    find: [
      src.node(T.ORE_SILVER, 1, 2, 0.4, 3, { realm: 'thalassara' }),
      src.node(T.ROCK, 1, 1, 0.06, 1, { realm: 'thalassara' }),
    ],
    blurb: 'Silver grown in salt water; it never tarnishes and sings in the surf.',
  },
  {
    id: 'hellsteel',
    name: 'Hellsteel',
    tier: 6,
    rarity: 3,
    ore: [C.r2, C.e6],
    ing: [C.r3, C.e7],
    phase: 0,
    lvl: 14,
    realm: 'nethrakar',
    smelt: [3, 4],
    find: [
      src.node(T.ORE_IRON, 1, 2, 0.4, 3, { realm: 'nethrakar' }),
      src.node(T.CAVE_IRON, 1, 2, 0.15, 3, { cave: 'basalt' }),
    ],
    blurb: 'Nethrakar iron smelted over brimstone; it stays warm to the touch.',
  },
  {
    id: 'moonsilver',
    name: 'Moonsilver',
    tier: 5,
    rarity: 3,
    ore: [C.w6, C.q6],
    ing: [C.pale, C.q6],
    phase: 7,
    lvl: 12,
    realm: 'sylvaris',
    smelt: [3, 2],
    find: [
      src.node(T.ORE_SILVER, 1, 2, 0.4, 3, { realm: 'sylvaris' }),
      src.node(T.CAVE_SILVER, 1, 1, 0.12, 3, { cave: 'glowmoss' }),
    ],
    wire: true,
    blurb: 'Sylvaris silver that drinks moonlight and gives a little back.',
  },
  // ── the three realms' metals (otherworlds.ts): found only there, worked only with their people's blessing
  {
    id: 'aetherium',
    name: 'Aetherium',
    tier: 4,
    rarity: 3,
    ore: [C.white, C.w6],
    ing: [C.pale, C.e7],
    phase: 6,
    lvl: 9,
    realm: 'aerin',
    smelt: [2, 2],
    find: [
      src.node(T.ORE_SILVER, 1, 2, 0.5, 2, { realm: 'aetheria' }),
      src.node(T.ROCK, 1, 1, 0.12, 1, { realm: 'aetheria' }),
    ],
    blurb: 'Cloud-light metal from the floating isles. A blade of it seems to want to fly.',
  },
  {
    id: 'umbrite',
    name: 'Umbrite',
    tier: 5,
    rarity: 3,
    ore: [C.night, C.q4],
    ing: [C.slate, C.q5],
    phase: 3,
    lvl: 13,
    realm: 'hollowfolk',
    smelt: [3, 3],
    find: [
      src.node(T.CAVE_SILVER, 1, 2, 0.5, 3, { realm: 'umbra' }),
      src.node(T.CAVE_CRYSTAL, 1, 1, 0.25, 3, { realm: 'umbra' }),
    ],
    blurb: 'Black metal of the Abyss with a violet sheen, heavy and patient as the dark.',
  },
  {
    id: 'chronium',
    name: 'Chronium',
    tier: 6,
    rarity: 4,
    ore: [C.e6, C.mist],
    ing: [C.e7, C.white],
    phase: 4,
    lvl: 16,
    realm: 'archivists',
    smelt: [3, 3],
    find: [
      src.node(T.ORE_GOLD, 1, 2, 0.5, 3, { realm: 'chronoria' }),
      src.node(T.CRYSTAL, 1, 1, 0.3, 3, { realm: 'chronoria' }),
    ],
    blurb: 'Brass-bright metal from Chronoria that is never quite the same temperature twice.',
  },
];
export const METAL_BY_ID: Record<string, Metal> = Object.fromEntries(METALS.map((m) => [m.id, m]));

export const oreId = (m: string) => `${m}_ore`;
export const ingotId = (m: string) => `${m}_ingot`;

for (const m of METALS) {
  const ore = oreId(m.id),
    ing = ingotId(m.id);
  if (!m.base) {
    if (!m.alloy)
      item(ore, `${m.name} Ore`, 'ore', {
        kind: 'resource',
        v: 8 + m.tier * 9 + m.rarity * 14,
        g: 'ore',
        a: m.ore[0],
        b: m.ore[1],
        d: `${m.blurb} Mined with a tier ${Math.max(1, m.tier - 1)} pickaxe.`,
        rarity: m.rarity,
        tier: m.tier,
        phase: m.phase,
        ...(m.realm ? { realm: m.realm } : {}),
        src: m.find,
      });
    item(ing, `${m.name} Ingot`, 'metal', {
      v: 26 + m.tier * 20 + m.rarity * 30,
      g: 'ingot',
      a: m.ing[0],
      b: m.ing[1],
      d: `${m.name} smelted and cast. Phase ${m.phase}.`,
      rarity: m.rarity,
      tier: m.tier,
      phase: m.phase,
      ...(m.realm ? { realm: m.realm } : {}),
    });
    if (m.alloy)
      rec('furnace', m.alloy.from, [ing, m.alloy.out], {
        lvl: m.lvl,
        stage: 2,
        cat: 'metal',
        hint: `Alloy: ${m.alloy.from.map(([i, n]) => `${n} ${i.replace(/_/g, ' ')}`).join(' + ')}.`,
        ...(m.realm ? { realm: m.realm } : {}),
      });
    else
      rec(
        'furnace',
        [
          [ore, m.smelt![0]],
          ['coal', m.smelt![1]],
        ],
        [ing, 1],
        {
          lvl: m.lvl,
          stage: 1,
          cat: 'metal',
          hint: `${m.name} ore and coal.`,
          ...(m.realm ? { realm: m.realm } : {}),
        },
      );
  }
  // plate (armour, shields) and rod (blades, hafts, tools): the intermediate parts every gear recipe asks for
  const pl = `${m.id}_plate`,
    rod = `${m.id}_rod`;
  const wants = (part: 'plate' | 'rod' | 'wire'): boolean => !NO_PART.has(`${m.id}_${part}`);
  if (wants('plate'))
    item(pl, `${m.name} Plate`, 'component', {
      v: 40 + m.tier * 26 + m.rarity * 36,
      g: 'plate',
      a: m.ing[0],
      b: m.ing[1],
      d: `Hammered ${m.name.toLowerCase()} sheet for armour and shields.`,
      rarity: m.rarity,
      tier: m.tier,
      ...(m.realm ? { realm: m.realm } : {}),
    });
  if (wants('rod'))
    item(rod, `${m.name} Rod`, 'component', {
      v: 34 + m.tier * 22 + m.rarity * 30,
      g: 'rod',
      a: m.ing[0],
      b: m.ing[1],
      d: `A drawn ${m.name.toLowerCase()} bar for blades, hafts and tool heads.`,
      rarity: m.rarity,
      tier: m.tier,
      ...(m.realm ? { realm: m.realm } : {}),
    });
  if (wants('plate'))
    rec('forge', [[ing, 2]], [pl, 1], {
      lvl: m.lvl,
      stage: 2,
      cat: 'component',
      ...(m.realm ? { realm: m.realm } : {}),
      hint: `Two ingots hammered flat.`,
    });
  if (wants('rod'))
    rec('forge', [[ing, 1]], [rod, 1], {
      lvl: m.lvl,
      stage: 2,
      cat: 'component',
      ...(m.realm ? { realm: m.realm } : {}),
      hint: `An ingot drawn long.`,
    });
  if (m.wire && wants('wire')) {
    const w = `${m.id}_wire`;
    item(w, `${m.name} Wire`, 'component', {
      v: 18 + m.tier * 14 + m.rarity * 20,
      g: 'coil',
      a: m.ing[0],
      b: m.ing[1],
      d: `Fine ${m.name.toLowerCase()} wire for jewellery, circuits and bindings.`,
      rarity: m.rarity,
      tier: m.tier,
    });
    rec('jeweler', [[ing, 1]], [w, 3], {
      lvl: Math.max(1, m.lvl - 1),
      stage: 2,
      cat: 'component',
      disc: 'smithing',
      hint: 'Drawn through a die.',
    });
  }
}
