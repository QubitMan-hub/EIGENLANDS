import { T } from '../tiles';
import { COL as C, item, rec, src } from './kit';

/**
 * Gems, crystals and jewellery. Raw stones come from geodes and veins (deeper caves, rarer kinds); the jeweller cuts
 * them; cut gems are set into rings and amulets and are the heart of enchanting. Elemental crystals power lanterns,
 * wands and runes. Every kind has its own cave or kingdom, so exploring pays differently in different places.
 */
interface Gem {
  id: string;
  name: string;
  rarity: 0 | 1 | 2 | 3 | 4;
  a: number;
  b: number;
  find: ReturnType<typeof src.node>[];
  blurb: string;
  lvl: number;
  /** what a ring/amulet set with it gives */
  stat: 'hp' | 'atk' | 'luck' | 'haste';
}
const GEMS: Gem[] = [
  {
    id: 'quartz',
    name: 'Quartz',
    rarity: 0,
    a: C.white,
    b: C.pale,
    find: [src.node(T.CRYSTAL, 1, 2, 0.25, 1), src.node(T.ROCK, 1, 1, 0.06, 1), src.node(T.CAVE_WALL, 1, 1, 0.08, 1)],
    blurb: 'Clear and common, but it takes a cut well. Lenses start here.',
    lvl: 2,
    stat: 'luck',
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    rarity: 1,
    a: C.q4,
    b: C.q6,
    find: [
      src.node(T.CAVE_GEODE, 1, 1, 0.3, 2, { cave: 'crystal' }),
      src.node(T.CAVE_GEODE, 1, 1, 0.2, 2, { cave: 'glowmoss' }),
    ],
    blurb: 'Violet and calm. Said to settle a restless mind.',
    lvl: 4,
    stat: 'hp',
  },
  {
    id: 'topaz',
    name: 'Topaz',
    rarity: 1,
    a: C.e6,
    b: C.e7,
    find: [
      src.node(T.CAVE_GEODE, 1, 1, 0.3, 2, { cave: 'limestone' }),
      src.node(T.ROCK, 1, 1, 0.07, 2, { realm: 'aurelion' }),
    ],
    blurb: 'Honey-gold and warm. Favoured for rings of speed.',
    lvl: 5,
    stat: 'haste',
  },
  {
    id: 'garnet',
    name: 'Garnet',
    rarity: 1,
    a: C.r3,
    b: C.r5,
    find: [src.node(T.ROCK, 1, 1, 0.1, 2, { realm: 'khardum' }), src.node(T.CAVE_IRON, 1, 1, 0.08, 2)],
    blurb: 'Deep wine-red, hard-wearing. A smith’s stone.',
    lvl: 5,
    stat: 'atk',
  },
  {
    id: 'ruby',
    name: 'Ruby',
    rarity: 2,
    a: C.r4,
    b: C.r6,
    find: [
      src.node(T.CAVE_GEODE, 1, 1, 0.28, 3, { cave: 'basalt' }),
      src.node(T.ROCK, 1, 1, 0.07, 3, { realm: 'nethrakar' }),
    ],
    blurb: 'Blood-red fire. Strikes harder than its size should allow.',
    lvl: 9,
    stat: 'atk',
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    rarity: 2,
    a: C.w3,
    b: C.w6,
    find: [
      src.node(T.CAVE_GEODE, 1, 1, 0.28, 3, { cave: 'frost' }),
      src.node(T.ROCK, 1, 1, 0.07, 3, { realm: 'thalassara' }),
    ],
    blurb: 'Deep sea-blue. Wearers feel steady in any weather.',
    lvl: 9,
    stat: 'hp',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    rarity: 2,
    a: C.g4,
    b: C.g6,
    find: [
      src.node(T.CAVE_GEODE, 1, 1, 0.28, 3, { cave: 'glowmoss' }),
      src.node(T.ROCK, 1, 1, 0.07, 3, { realm: 'sylvaris' }),
    ],
    blurb: 'A green so deep it looks alive. Lucky.',
    lvl: 9,
    stat: 'luck',
  },
  {
    id: 'onyx',
    name: 'Onyx',
    rarity: 2,
    a: C.night,
    b: C.slate,
    find: [
      src.node(T.CAVE_WALL, 1, 1, 0.07, 3, { cave: 'basalt' }),
      src.node(T.CAVE_BOULDER, 1, 1, 0.2, 3, { cave: 'basalt' }),
    ],
    blurb: 'Pure black with a cold shine. Shields the wearer from harm.',
    lvl: 8,
    stat: 'hp',
  },
  {
    id: 'opal',
    name: 'Opal',
    rarity: 3,
    a: C.w6,
    b: C.q5,
    find: [src.node(T.CAVE_GEODE, 1, 1, 0.2, 3, { cave: 'drowned' })],
    blurb: 'Milky and shot with every colour. Never the same twice.',
    lvl: 13,
    stat: 'luck',
  },
  {
    id: 'moonstone',
    name: 'Moonstone',
    rarity: 3,
    a: C.pale,
    b: C.q6,
    find: [
      src.node(T.CAVE_CRYSTAL, 1, 1, 0.2, 3, { cave: 'crystal' }),
      src.node(T.ROCK, 1, 1, 0.05, 3, { realm: 'sylvaris' }),
    ],
    blurb: 'Pale blue sheen that moves as you turn it.',
    lvl: 13,
    stat: 'haste',
  },
  {
    id: 'sunstone',
    name: 'Sunstone',
    rarity: 3,
    a: C.e7,
    b: C.e6,
    find: [
      src.node(T.ROCK, 1, 1, 0.05, 3, { realm: 'aurelion' }),
      src.node(T.ROCK, 1, 1, 0.05, 3, { realm: 'raijin' }),
    ],
    blurb: 'Gold flecks sparkle inside it. Warm to hold in the cold.',
    lvl: 13,
    stat: 'atk',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    rarity: 4,
    a: C.white,
    b: C.w6,
    find: [src.node(T.CAVE_CRYSTAL, 1, 1, 0.07, 4)],
    blurb: 'The hardest thing in the Eigenlands. It only parts for a skilled hand.',
    lvl: 18,
    stat: 'atk',
  },
];
for (const g of GEMS) {
  item(`${g.id}_raw`, `Rough ${g.name}`, 'gem', {
    v: 12 + g.rarity * 22,
    g: 'gem',
    a: g.a,
    b: g.b,
    d: `${g.blurb} Uncut.`,
    rarity: g.rarity,
    tier: g.rarity,
    src: g.find,
  });
  item(`${g.id}_cut`, `Cut ${g.name}`, 'gem', {
    v: 34 + g.rarity * 60,
    g: 'crystal',
    a: g.a,
    b: g.b,
    d: `${g.name}, cut and polished. Ready to be set or enchanted.`,
    rarity: g.rarity,
    tier: g.rarity,
  });
  rec('jeweler', [[`${g.id}_raw`, 1]], [`${g.id}_cut`, 1], {
    lvl: g.lvl,
    disc: 'smithing',
    xp: 6 + g.lvl * 2,
    tool: 'loupe',
    hint: `Facet and polish the ${g.name.toLowerCase()}.`,
  });
}

// ── elemental crystals: a mined charge of each element, tied to the cave that grows it
interface Crystal {
  id: string;
  name: string;
  a: number;
  b: number;
  cave?: string;
  realm?: string;
  rarity: 1 | 2 | 3;
  blurb: string;
  hue: string;
}
const CRYSTALS: Crystal[] = [
  {
    id: 'ember_crystal',
    name: 'Ember Crystal',
    a: C.r5,
    b: C.e7,
    cave: 'basalt',
    rarity: 2,
    blurb: 'Red crystal with a slow heat in it. Fuels flames and forges.',
    hue: 'ember',
  },
  {
    id: 'frost_crystal',
    name: 'Frost Crystal',
    a: C.w6,
    b: C.white,
    cave: 'frost',
    rarity: 2,
    blurb: 'Pale blue crystal, cold enough to frost the hand. Cools and slows.',
    hue: 'frost',
  },
  {
    id: 'life_crystal',
    name: 'Life Crystal',
    a: C.g5,
    b: C.g6,
    cave: 'glowmoss',
    rarity: 2,
    blurb: 'Soft green crystal that hums like a sleeping bird. Heals and grows.',
    hue: 'verdant',
  },
  {
    id: 'tide_crystal',
    name: 'Tide Crystal',
    a: C.w4,
    b: C.t1,
    cave: 'drowned',
    rarity: 2,
    blurb: 'Blue-green crystal that rises and falls like a tide.',
    hue: 'tide',
  },
  {
    id: 'storm_crystal',
    name: 'Storm Crystal',
    a: C.e7,
    b: C.w6,
    realm: 'raijin',
    rarity: 2,
    blurb: 'Crackling yellow-white crystal. It arcs to anything metal.',
    hue: 'storm',
  },
  {
    id: 'prism_crystal',
    name: 'Prism Crystal',
    a: C.q5,
    b: C.w6,
    cave: 'crystal',
    rarity: 2,
    blurb: 'Clear crystal that splits light into every colour.',
    hue: 'prism',
  },
];
for (const c of CRYSTALS) {
  const where = c.cave
    ? [
        src.node(T.CAVE_CRYSTAL, 1, 2, 0.35, 3, { cave: c.cave }),
        src.node(T.CAVE_GEODE, 1, 1, 0.12, 3, { cave: c.cave }),
      ]
    : [src.node(T.CRYSTAL, 1, 2, 0.3, 3, { realm: c.realm }), src.mob('raiju', 0.5)];
  item(c.id, c.name, 'crystal', { v: 50, g: 'crystal', a: c.a, b: c.b, d: c.blurb, rarity: c.rarity, src: where });
}
// shaped crystals for the lantern, wand and rune benches
item('crystal_dust', 'Crystal Dust', 'reagent', {
  v: 18,
  g: 'dust',
  a: C.q5,
  b: C.white,
  d: 'Fine powder ground from a spent crystal. Alchemists want it.',
});
rec('alchemy', [['qubit_crystal', 1]], ['crystal_dust', 3], { lvl: 3, xp: 6, hint: 'Grind a crystal in the mortar.' });
rec('alchemy', [['quartz_raw', 2]], ['crystal_dust', 1], {
  lvl: 2,
  xp: 4,
  hint: 'Grind rough quartz.',
  id: 'crystal_dust_quartz',
});
item('crystal_lens_focus', 'Focus Lens', 'component', {
  v: 120,
  g: 'crystal',
  a: C.q6,
  b: C.white,
  d: 'A lens cut from a prism crystal. Foci and spyglasses depend on it.',
  rarity: 2,
});
rec(
  'jeweler',
  [
    ['prism_crystal', 1],
    ['lens', 1],
  ],
  ['crystal_lens_focus', 1],
  { lvl: 12, disc: 'smithing', xp: 24, hint: 'Cut a prism crystal to a lens curve.' },
);

// ── jewellery: gems set in metal. Each stone suggests its stat; a stone set in gold is dearer than in copper.
const SETTINGS: Array<[string, string, number, number]> = [
  // metal id, name, lvl, stat scale
  ['silver', 'Silver', 6, 1],
  ['gold', 'Gold', 9, 1.3],
  ['mithril', 'Mithril', 16, 1.8],
];
const STAT_TEXT: Record<Gem['stat'], string> = { hp: 'max health', atk: 'attack', luck: 'luck', haste: 'haste' };
for (const g of GEMS.filter((x) => x.rarity >= 1)) {
  for (const [metal, mname, mlvl, scale] of SETTINGS) {
    if (metal === 'mithril' && g.rarity < 3) continue;
    if (metal === 'silver' && g.rarity >= 4) continue;
    const id = `ring_${g.id}_${metal}`;
    const base = g.stat === 'hp' ? 12 : g.stat === 'atk' ? 2 : g.stat === 'luck' ? 1 : 1;
    const val = Math.max(1, Math.round(base * scale * (1 + g.rarity * 0.5)));
    item(id, `${mname} ${g.name} Ring`, 'accessory', {
      v: 90 + g.rarity * 70 + mlvl * 8,
      g: 'ring',
      a: g.a,
      b: g.b,
      d: `A ${g.name.toLowerCase()} set in ${mname.toLowerCase()}. +${val} ${STAT_TEXT[g.stat]}.`,
      kind: 'ring',
      rarity: Math.min(5, g.rarity + (metal === 'mithril' ? 1 : 0)) as 0 | 1 | 2 | 3 | 4 | 5,
      stack: 1,
    });
    rec(
      'jeweler',
      [
        [`${g.id}_cut`, 1],
        [`${metal}_wire`, 2],
        [`${metal}_ingot`, 1],
      ],
      [id, 1],
      {
        lvl: Math.max(mlvl, g.lvl),
        disc: 'smithing',
        xp: 14 + g.rarity * 8,
        hint: `Set the ${g.name.toLowerCase()} in ${mname.toLowerCase()}.`,
        p: { stat: g.stat, val },
      },
    );
  }
}
