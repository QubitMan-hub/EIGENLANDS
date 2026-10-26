import { T } from '../tiles';
import { COL as C, item, rec, src } from './kit';

/**
 * Stone and timber. Raw stones come from rock faces in the kingdom that has them; masonry cuts them into blocks, tiles
 * and glass; the carpenter turns each wood into planks. Every kind has a job: what it builds and what it is good for.
 */

// ── stones: [id, name, rarity, colours, where, what it is for]
interface Stone {
  id: string;
  name: string;
  rarity: 0 | 1 | 2 | 3;
  a: number;
  b: number;
  find: ReturnType<typeof src.node>[];
  blurb: string;
  /** the dressed block it cuts into */
  block: string;
  blockName: string;
  lvl: number;
}
const STONES: Stone[] = [
  {
    id: 'granite',
    name: 'Granite',
    rarity: 0,
    a: C.mist,
    b: C.fog,
    find: [
      src.node(T.ROCK, 1, 2, 0.35, 1, { realm: 'khardum' }),
      src.node(T.CAVE_WALL, 1, 2, 0.2, 2, { cave: 'basalt' }),
    ],
    blurb: 'Speckled grey stone: the dwarves’ own, and the best for foundations.',
    block: 'granite_block',
    blockName: 'Granite Block',
    lvl: 2,
  },
  {
    id: 'marble',
    name: 'Marble',
    rarity: 1,
    a: C.pale,
    b: C.white,
    find: [
      src.node(T.ROCK, 1, 2, 0.3, 2, { realm: 'aurelion' }),
      src.node(T.CAVE_WALL, 1, 1, 0.1, 2, { cave: 'limestone' }),
    ],
    blurb: 'White-veined and cool to the touch. Aurelion builds its halls from it.',
    block: 'marble_slab',
    blockName: 'Marble Slab',
    lvl: 5,
  },
  {
    id: 'sandstone',
    name: 'Sandstone',
    rarity: 0,
    a: C.e5,
    b: C.e7,
    find: [
      src.node(T.ROCK, 1, 2, 0.3, 1, { realm: 'nethrakar' }),
      src.node(T.ROCK, 1, 2, 0.25, 1, { realm: 'thalassara' }),
      src.node(T.CAVE_WALL, 1, 2, 0.2, 1, { cave: 'limestone' }),
    ],
    blurb: 'Warm banded stone that cuts easily and keeps a house cool.',
    block: 'sandstone_block',
    blockName: 'Sandstone Block',
    lvl: 1,
  },
  {
    id: 'slate',
    name: 'Slate',
    rarity: 0,
    a: C.slate,
    b: C.steel,
    find: [src.node(T.ROCK, 1, 2, 0.3, 1, { realm: 'raijin' }), src.node(T.CAVE_WALL, 1, 2, 0.2, 2, { cave: 'frost' })],
    blurb: 'Splits into thin, hard-wearing sheets: the roofer’s stone.',
    block: 'slate_tile',
    blockName: 'Slate Tile',
    lvl: 3,
  },
  {
    id: 'limestone',
    name: 'Limestone',
    rarity: 0,
    a: C.fog,
    b: C.pale,
    find: [
      src.node(T.CAVE_WALL, 1, 3, 0.3, 1, { cave: 'limestone' }),
      src.node(T.CAVE_WALL, 1, 2, 0.15, 1, { cave: 'glowmoss' }),
    ],
    blurb: 'Soft pale stone. Burn it for lime, or cut it for plain walls.',
    block: 'limestone_block',
    blockName: 'Limestone Block',
    lvl: 1,
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    rarity: 2,
    a: C.night,
    b: C.q3,
    find: [
      src.node(T.CAVE_WALL, 1, 2, 0.14, 3, { cave: 'basalt' }),
      src.node(T.CAVE_BOULDER, 1, 2, 0.4, 3, { cave: 'basalt' }),
    ],
    blurb: 'Black volcanic glass. Brittle, but its edge is sharper than steel.',
    block: 'obsidian_glass',
    blockName: 'Polished Obsidian',
    lvl: 11,
  },
];

for (const s of STONES) {
  item(s.id, s.name, 'stone', {
    v: 5 + s.rarity * 6,
    g: 'stone',
    a: s.a,
    b: s.b,
    d: s.blurb,
    rarity: s.rarity,
    src: s.find,
  });
  item(s.block, s.blockName, 'building', {
    v: 12 + s.rarity * 10,
    g: 'block',
    a: s.a,
    b: s.b,
    d: `Dressed ${s.name.toLowerCase()}, ready to build with.`,
    rarity: s.rarity,
    kind: 'material',
  });
  rec('masonry', [[s.id, 2]], [s.block, 1], {
    lvl: s.lvl,
    xp: 3 + s.lvl,
    tool: 'chisel',
    hint: `Square ${s.name.toLowerCase()} into building stone.`,
  });
}

item('flint', 'Flint', 'stone', {
  v: 4,
  g: 'shard',
  a: C.slate,
  b: C.mist,
  d: 'Chips to a keen edge and throws a good spark.',
  src: [src.node(T.ROCK, 1, 1, 0.14, 1), src.node(T.CAVE_WALL, 1, 1, 0.08, 1)],
});
item('sand', 'Sand', 'stone', {
  v: 2,
  g: 'dust',
  a: C.e6,
  b: C.e7,
  d: 'Fine grit. Melt it into glass or cut it into mortar.',
  src: [src.node(T.ROCK, 1, 3, 0.25, 1), src.node(T.CAVE_WALL, 1, 2, 0.12, 1, { cave: 'limestone' })],
});
item('clay', 'Clay', 'stone', {
  v: 3,
  g: 'nugget',
  a: C.e3,
  b: C.r3,
  d: 'Cold wet earth that holds its shape. Fire turns it to brick and tile.',
  src: [
    src.node(T.ROCK, 1, 2, 0.2, 1, { realm: 'thalassara' }),
    src.node(T.ROCK, 1, 2, 0.2, 1, { realm: 'sylvaris' }),
    src.node(T.CAVE_WALL, 1, 2, 0.12, 1, { cave: 'drowned' }),
  ],
});
item('salt', 'Rock Salt', 'stone', {
  v: 6,
  g: 'dust',
  a: C.white,
  b: C.pale,
  d: 'Grey-white crystals. Keeps meat, seasons stew and cures leather.',
  src: [
    src.node(T.CAVE_WALL, 1, 3, 0.25, 1, { cave: 'drowned' }),
    src.node(T.ROCK, 1, 3, 0.3, 1, { realm: 'thalassara' }),
    src.node(T.CAVE_WALL, 1, 2, 0.1, 1, { cave: 'limestone' }),
  ],
});

// ── fired and cut stone
item('stone_brick', 'Stone Brick', 'building', {
  v: 10,
  g: 'brick',
  a: C.mist,
  b: C.fog,
  d: 'Regular bricks of grey stone for sturdy walls.',
  kind: 'material',
});
rec('masonry', [['stone', 3]], ['stone_brick', 2], {
  lvl: 1,
  xp: 3,
  tool: 'chisel',
  hint: 'Square plain stone into bricks.',
});
item('clay_brick', 'Clay Brick', 'building', {
  v: 8,
  g: 'brick',
  a: C.r3,
  b: C.r4,
  d: 'Kiln-fired red brick. Cheap, warm and everywhere in town.',
  kind: 'material',
});
rec(
  'furnace',
  [
    ['clay', 2],
    ['coal', 1],
  ],
  ['clay_brick', 2],
  { lvl: 2, disc: 'masonry', xp: 4, hint: 'Fire clay in the furnace.' },
);
item('roof_tile', 'Roof Tile', 'building', {
  v: 9,
  g: 'tile',
  a: C.r4,
  b: C.r5,
  d: 'Curved fired tile that sheds rain.',
  kind: 'material',
});
rec(
  'furnace',
  [
    ['clay', 2],
    ['coal', 1],
  ],
  ['roof_tile', 3],
  { lvl: 3, disc: 'masonry', xp: 5, hint: 'Fire shaped clay.' },
);
item('quicklime', 'Quicklime', 'component', {
  v: 8,
  g: 'dust',
  a: C.white,
  b: C.fog,
  d: 'Burnt limestone. Binds mortar and whitens walls.',
});
rec(
  'furnace',
  [
    ['limestone', 3],
    ['coal', 1],
  ],
  ['quicklime', 2],
  { lvl: 3, disc: 'masonry', xp: 5, hint: 'Burn limestone hot.' },
);
item('mortar', 'Mortar', 'component', {
  v: 10,
  g: 'sack',
  a: C.fog,
  b: C.mist,
  d: 'Lime, sand and water. Holds a wall together for a century.',
});
rec(
  'masonry',
  [
    ['quicklime', 1],
    ['sand', 2],
  ],
  ['mortar', 2],
  { lvl: 3, xp: 5, hint: 'Slake lime and fold in sand.' },
);
item('glass', 'Glass', 'component', {
  v: 14,
  g: 'pane',
  a: C.w6,
  b: C.white,
  d: 'Clear melted sand. Windows, flasks and lenses begin here.',
});
rec(
  'furnace',
  [
    ['sand', 3],
    ['coal', 1],
  ],
  ['glass', 1],
  { lvl: 3, disc: 'masonry', xp: 6, hint: 'Melt sand until it runs clear.' },
);
item('glass_pane', 'Window Pane', 'building', {
  v: 22,
  g: 'pane',
  a: C.w5,
  b: C.white,
  d: 'A flat sheet of glass for a window.',
  kind: 'material',
});
rec('masonry', [['glass', 2]], ['glass_pane', 1], { lvl: 5, xp: 7, hint: 'Flatten and square the glass.' });
item('lens', 'Crystal Lens', 'component', {
  v: 60,
  g: 'crystal',
  a: C.w6,
  b: C.white,
  d: 'Ground glass that bends light. Lanterns and spyglasses need one.',
  rarity: 1,
});
rec(
  'masonry',
  [
    ['glass', 1],
    ['quartz_raw', 1],
  ],
  ['lens', 1],
  { lvl: 8, xp: 12, hint: 'Grind glass and quartz to a curve.' },
);

// ── woods: each kingdom's forests give their own timber
interface Wood {
  id: string;
  name: string;
  rarity: 0 | 1 | 2 | 3;
  tier: number;
  a: number;
  b: number;
  realm?: string;
  find: ReturnType<typeof src.node>;
  blurb: string;
  lvl: number;
}
const WOODS: Wood[] = [
  {
    id: 'oak',
    name: 'Oak',
    rarity: 0,
    tier: 1,
    a: C.e4,
    b: C.e2,
    realm: 'aurelion',
    find: src.node(T.TREE, 1, 3, 0.55, 1, { realm: 'aurelion' }),
    blurb: 'Hard, even timber: the furniture-maker’s first choice.',
    lvl: 2,
  },
  {
    id: 'pine',
    name: 'Pine',
    rarity: 0,
    tier: 1,
    a: C.e5,
    b: C.e3,
    realm: 'khardum',
    find: src.node(T.TREE, 1, 3, 0.55, 1, { realm: 'khardum' }),
    blurb: 'Light resinous softwood. Cheap, quick to work, burns well.',
    lvl: 1,
  },
  {
    id: 'birch',
    name: 'Birch',
    rarity: 0,
    tier: 1,
    a: C.pale,
    b: C.mist,
    realm: 'sylvaris',
    find: src.node(T.TREE, 1, 3, 0.5, 1, { realm: 'sylvaris' }),
    blurb: 'Pale smooth wood. Takes dye well and bends without breaking.',
    lvl: 2,
  },
  {
    id: 'cedar',
    name: 'Cedar',
    rarity: 1,
    tier: 2,
    a: C.r3,
    b: C.e3,
    realm: 'raijin',
    find: src.node(T.TREE, 1, 2, 0.45, 2, { realm: 'raijin' }),
    blurb: 'Fragrant red timber that moths and rot both avoid.',
    lvl: 5,
  },
  {
    id: 'willow',
    name: 'Willow',
    rarity: 0,
    tier: 1,
    a: C.g4,
    b: C.e5,
    realm: 'thalassara',
    find: src.node(T.TREE, 1, 3, 0.5, 1, { realm: 'thalassara' }),
    blurb: 'Whippy, damp-loving wood for baskets, wands and bows.',
    lvl: 3,
  },
  {
    id: 'ebony',
    name: 'Ebony',
    rarity: 2,
    tier: 3,
    a: C.night,
    b: C.e1,
    realm: 'nethrakar',
    find: src.node(T.TREE, 1, 2, 0.3, 3, { realm: 'nethrakar' }),
    blurb: 'Black, dense and heavy. It takes a polish like glass.',
    lvl: 9,
  },
  {
    id: 'ironwood',
    name: 'Ironwood',
    rarity: 2,
    tier: 3,
    a: C.e2,
    b: C.g2,
    realm: 'sylvaris',
    find: src.node(T.TREE, 1, 2, 0.22, 3, { realm: 'sylvaris' }),
    blurb: 'Sylvaris’ heartwood giants. Blades skate off it.',
    lvl: 10,
  },
  {
    id: 'bamboo',
    name: 'Bamboo',
    rarity: 0,
    tier: 1,
    a: C.g5,
    b: C.g3,
    realm: 'raijin',
    find: src.node(T.TREE, 2, 4, 0.4, 1, { realm: 'raijin' }),
    blurb: 'Hollow, strong, fast-growing. Poles, pipes, rods and scaffolds.',
    lvl: 2,
  },
];
for (const w of WOODS) {
  item(`${w.id}_log`, `${w.name} Log`, 'wood', {
    v: 6 + w.rarity * 7,
    g: 'log',
    a: w.a,
    b: w.b,
    d: w.blurb,
    rarity: w.rarity,
    tier: w.tier,
    ...(w.realm ? { realm: w.realm } : {}),
    src: [w.find],
  });
  item(`${w.id}_plank`, `${w.name} Plank`, 'wood', {
    v: 9 + w.rarity * 9,
    g: 'plank',
    a: w.a,
    b: w.b,
    d: `Sawn ${w.name.toLowerCase()}, ready for the carpenter.`,
    rarity: w.rarity,
    tier: w.tier,
  });
  rec('carpenter', [[`${w.id}_log`, 2]], [`${w.id}_plank`, 3], {
    lvl: w.lvl,
    xp: 3 + w.lvl,
    tool: 'saw',
    hint: `Saw ${w.name.toLowerCase()} into planks.`,
  });
}

// ── by-products and wood parts
item('bark', 'Bark', 'wood', {
  v: 3,
  g: 'bark',
  a: C.e3,
  b: C.e2,
  d: 'Rough strips of bark. Tannin for the tanner, tinder for the fire.',
  src: [src.node(T.TREE, 1, 2, 0.35, 1), src.node(T.STUMP, 1, 1, 0.3, 1)],
});
item('resin', 'Tree Resin', 'wood', {
  v: 7,
  g: 'resin',
  a: C.e6,
  b: C.e7,
  d: 'Sticky amber sap. Glue, varnish and torches all want it.',
  src: [src.node(T.TREE, 1, 1, 0.14, 1), src.node(T.STUMP, 1, 1, 0.1, 1)],
});
item('charcoal', 'Charcoal', 'component', {
  v: 5,
  g: 'coal',
  a: C.slate,
  b: C.night,
  d: 'Wood burnt without air. A clean fuel, and a good black pigment.',
});
rec('furnace', [['wood', 4]], ['charcoal', 2], {
  lvl: 1,
  disc: 'smithing',
  xp: 3,
  hint: 'Bury logs under embers and wait.',
});
item('glue', 'Wood Glue', 'component', {
  v: 8,
  g: 'resin',
  a: C.e4,
  b: C.e6,
  d: 'Boiled resin and bone. Holds joinery tight.',
});
rec(
  'cooking_pot',
  [
    ['resin', 2],
    ['bone', 1],
  ],
  ['glue', 2],
  { lvl: 2, disc: 'woodworking', xp: 4, hint: 'Simmer resin with bone.' },
);
item('nails', 'Iron Nails', 'component', { v: 6, g: 'rod', a: C.steel, b: C.slate, d: 'A handful of square nails.' });
rec('forge', [['iron_rod', 1]], ['nails', 12], { lvl: 3, xp: 4, hint: 'Cut and point a rod.' });
item('handle', 'Tool Handle', 'component', {
  v: 12,
  g: 'rod',
  a: C.e4,
  b: C.e5,
  d: 'A smooth turned handle for a tool or a blade.',
});
rec('carpenter', [['plank', 1]], ['handle', 1], { lvl: 1, xp: 3, hint: 'Turn a plank on the bench.' });
rec('carpenter', [['ironwood_plank', 1]], ['handle', 2], {
  lvl: 10,
  xp: 12,
  hint: 'Ironwood makes two handles that never split.',
  id: 'handle_ironwood',
});
item('rivets', 'Rivets', 'component', {
  v: 7,
  g: 'nugget',
  a: C.e4,
  b: C.e6,
  d: 'Small bronze studs to fasten plate to leather.',
});
rec('forge', [['bronze_rod', 1]], ['rivets', 10], { lvl: 4, xp: 4, hint: 'Cut and head a rod.' });
item('bowstave', 'Bow Stave', 'component', {
  v: 30,
  g: 'branch',
  a: C.e5,
  b: C.e6,
  d: 'A seasoned length of springy wood, ready to string.',
});
rec(
  'carpenter',
  [
    ['willow_plank', 1],
    ['bamboo_plank', 1],
  ],
  ['bowstave', 1],
  { lvl: 6, xp: 9, hint: 'Laminate willow and bamboo.' },
);
