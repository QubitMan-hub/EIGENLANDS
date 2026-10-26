import { COL as C, item, rec, src } from './kit';

/**
 * Fibre, cloth, hide and the parts monsters leave behind. Plants and animals give raw fibre and pelts; the loom and the
 * tanning rack turn them into cloth and leather; every monster part has a bench that wants it.
 */

// ── raw fibre
item('flax', 'Flax', 'fiber', {
  v: 4,
  g: 'leaf',
  a: C.w5,
  b: C.g4,
  d: 'Slender blue-flowered stalks. Retted and spun they become linen.',
  src: [src.forage([0, 1], 3)],
});
item('hemp', 'Hemp', 'fiber', {
  v: 4,
  g: 'leaf',
  a: C.g4,
  b: C.e5,
  d: 'Tall coarse stalks with strong bast fibre.',
  src: [src.forage([1, 2], 3)],
});
item('wool', 'Wool', 'fiber', {
  v: 8,
  g: 'cloth',
  a: C.white,
  b: C.pale,
  d: 'A thick fleece. Warm, springy, water-shedding.',
  src: [src.mob('blind_ram', 0.7, 1, 2)],
});
item('silk_cocoon', 'Silk Cocoon', 'fiber', {
  v: 16,
  g: 'nugget',
  a: C.white,
  b: C.e7,
  d: 'A pale cocoon found in the autumn mulberries.',
  rarity: 1,
  src: [src.forage([2], 1)],
});
item('reed_fiber', 'Reed Fibre', 'fiber', {
  v: 3,
  g: 'leaf',
  a: C.g5,
  b: C.e5,
  d: 'Long pliant reeds for thatch and mats.',
  src: [src.mob('reed_stalker', 0.5, 1, 3), src.forage([0, 1, 2], 2)],
});

// ── thread and yarn (loom)
const THREADS: Array<[string, string, string, number, number, string, number]> = [
  // id, name, from, in, out, colour, lvl
  ['linen_thread', 'Linen Thread', 'flax', 3, 2, 'w5', 1],
  ['hemp_cord', 'Hemp Cord', 'hemp', 3, 2, 'g4', 1],
  ['wool_yarn', 'Wool Yarn', 'wool', 2, 2, 'white', 2],
  ['silk_thread', 'Silk Thread', 'silk_cocoon', 2, 2, 'e7', 6],
];
const COLS: Record<string, number> = { w5: C.w5, g4: C.g4, white: C.white, e7: C.e7 };
for (const [id, name, from, nIn, nOut, col, lvl] of THREADS) {
  item(id, name, 'textile', {
    v: 6 + lvl,
    g: 'spool',
    a: COLS[col]!,
    b: C.pale,
    d: `${name} wound on a spool.`,
    rarity: lvl >= 6 ? 1 : 0,
  });
  rec('loom', [[from, nIn]], [id, nOut], { lvl, xp: 3 + lvl, hint: 'Spin it on the wheel.' });
}
item('thread', 'Plain Thread', 'textile', {
  v: 4,
  g: 'spool',
  a: C.fog,
  b: C.pale,
  d: 'Common thread spun from fibre.',
});
rec('loom', [['fiber', 3]], ['thread', 2], { lvl: 1, xp: 2, hint: 'Spin rough fibre.' });

// ── cloth (loom)
const CLOTHS: Array<[string, string, string, number, string, number, number, number, 0 | 1 | 2 | 3]> = [
  // id, name, thread, n, desc, a, b, lvl, rarity
  ['linen_cloth', 'Linen Cloth', 'linen_thread', 3, 'Cool, smooth cloth that wears well.', C.pale, C.w6, 2, 0],
  ['wool_cloth', 'Wool Cloth', 'wool_yarn', 3, 'Dense warm felted cloth.', C.fog, C.white, 3, 0],
  ['cotton_cloth', 'Cotton Cloth', 'cotton', 3, 'Soft, breathable cloth.', C.white, C.pale, 4, 0],
  ['silk_cloth', 'Silk Cloth', 'silk_thread', 3, 'Shimmering cloth, light as breath.', C.q4, C.e7, 8, 2],
  ['canvas', 'Canvas', 'hemp_cord', 3, 'Heavy plain weave for tents, sails and sacks.', C.e6, C.e5, 3, 0],
];
for (const [id, name, thread, n, desc, a, b, lvl, rarity] of CLOTHS) {
  item(id, name, 'textile', { v: 14 + lvl * 4 + rarity * 10, g: 'roll', a, b, d: desc, rarity });
  rec('loom', [[thread, n]], [id, 1], { lvl, xp: 4 + lvl, hint: `Weave ${name.toLowerCase()}.` });
}
item('moonweave', 'Moonweave', 'textile', {
  v: 190,
  g: 'roll',
  a: C.q5,
  b: C.white,
  d: 'Silk shot through with moonsilver wire. It glows faintly when no one is looking.',
  rarity: 3,
});
rec(
  'loom',
  [
    ['silk_cloth', 2],
    ['moonsilver_wire', 1],
  ],
  ['moonweave', 1],
  { lvl: 14, xp: 30, hint: 'Weave moonsilver wire into silk.' },
);
item('quilting', 'Quilted Padding', 'textile', {
  v: 22,
  g: 'roll',
  a: C.fog,
  b: C.pale,
  d: 'Layers of wool stitched between cloth. Takes the sting out of a blow.',
});
rec(
  'loom',
  [
    ['wool_cloth', 1],
    ['wool', 2],
  ],
  ['quilting', 1],
  { lvl: 2, xp: 5, hint: 'Stuff wool between cloth and stitch.' },
);
item('hemp_rope', 'Rope', 'component', {
  v: 14,
  g: 'rope',
  a: C.e6,
  b: C.e5,
  d: 'Twisted hemp. Climbing, hauling, and tying down.',
});
rec('loom', [['hemp_cord', 3]], ['hemp_rope', 1], { lvl: 2, xp: 4, hint: 'Twist cord into rope.' });

// ── dyes (alchemy table)
const DYES: Array<[string, string, string, number, number, string]> = [
  ['dye_red', 'Red Dye', 'sunpetal', C.r4, C.r3, 'Crushed sunpetals in vinegar and alum.'],
  ['dye_blue', 'Blue Dye', 'blueberry', C.w4, C.w3, 'Boiled blueberries fixed with salt.'],
  ['dye_yellow', 'Yellow Dye', 'daffodil', C.e6, C.e5, 'Steeped daffodil heads.'],
  ['dye_green', 'Green Dye', 'healing_herb', C.g4, C.g3, 'Pounded herb leaf.'],
  ['dye_violet', 'Violet Dye', 'eggplant', C.q4, C.q3, 'Eggplant skins simmered down.'],
];
for (const [id, name, plant, a, b, hint] of DYES) {
  item(id, name, 'reagent', { v: 12, g: 'vial', a, b, d: `${name}: colours cloth, banners and rugs.` });
  rec(
    'alchemy',
    [
      [plant, 2],
      ['salt', 1],
    ],
    [id, 2],
    { lvl: 2, xp: 5, hint },
  );
}
item('dye_black', 'Black Dye', 'reagent', {
  v: 12,
  g: 'vial',
  a: C.night,
  b: C.slate,
  d: 'Soot-black dye for cloth and leather.',
});
rec(
  'alchemy',
  [
    ['charcoal', 3],
    ['salt', 1],
  ],
  ['dye_black', 2],
  { lvl: 2, xp: 5, hint: 'Grind charcoal fine.' },
);
item('dye_white', 'White Dye', 'reagent', {
  v: 12,
  g: 'vial',
  a: C.white,
  b: C.pale,
  d: 'Chalk-white dye and bleach.',
});
rec(
  'alchemy',
  [
    ['quicklime', 1],
    ['salt', 1],
  ],
  ['dye_white', 2],
  { lvl: 3, xp: 5, hint: 'Slake lime into a wash.' },
);

// ── monster parts: every one has a bench that wants it
interface Part {
  id: string;
  name: string;
  cat: 'bone' | 'hide' | 'monster' | 'magical' | 'reagent';
  g: Parameters<typeof item>[3]['g'];
  a: number;
  b: number;
  v: number;
  rarity?: 0 | 1 | 2 | 3 | 4 | 5;
  d: string;
  from: Array<ReturnType<typeof src.mob> | ReturnType<typeof src.boss>>;
}
const BEASTS = ['boar', 'wolf', 'badger', 'deer', 'spirit_stag', 'hellhound', 'fox', 'rabbit'];
const PARTS: Part[] = [
  {
    id: 'bone',
    name: 'Bone',
    cat: 'bone',
    g: 'bone',
    a: C.pale,
    b: C.fog,
    v: 4,
    d: 'Clean long bone. Glue, needles, charms and meal.',
    from: BEASTS.filter((b) => b !== 'rabbit').map((b) => src.mob(b, 0.3)),
  },
  {
    id: 'sinew',
    name: 'Sinew',
    cat: 'monster',
    g: 'rope',
    a: C.e6,
    b: C.e5,
    v: 6,
    d: 'Tough animal tendon: bowstrings and stitching.',
    from: ['wolf', 'boar', 'deer', 'griffin', 'spirit_stag'].map((b) => src.mob(b, 0.22)),
  },
  {
    id: 'pelt',
    name: 'Thick Pelt',
    cat: 'hide',
    g: 'pelt',
    a: C.e4,
    b: C.e3,
    v: 11,
    d: 'A full furred pelt, warm in the worst winter.',
    rarity: 1,
    from: ['wolf', 'fox', 'badger', 'deer', 'boar', 'spirit_stag', 'hellhound'].map((b) => src.mob(b, 0.25)),
  },
  {
    id: 'bat_wing',
    name: 'Bat Wing',
    cat: 'monster',
    g: 'wing',
    a: C.night,
    b: C.q3,
    v: 9,
    d: 'Leathery membrane that hears the cave.',
    from: [src.mob('echo_bat', 0.55)],
  },
  {
    id: 'moth_dust',
    name: 'Cinder Dust',
    cat: 'monster',
    g: 'dust',
    a: C.r5,
    b: C.e7,
    v: 12,
    d: 'Warm scales shaken from a cinder moth. Glows under heat.',
    from: [src.mob('cinder_moth', 0.5, 1, 2)],
  },
  {
    id: 'glass_chitin',
    name: 'Prism Chitin',
    cat: 'monster',
    g: 'shard',
    a: C.w6,
    b: C.q5,
    v: 14,
    d: 'Clear faceted shell that splits light.',
    rarity: 1,
    from: [src.mob('glasscrawler', 0.4), src.mob('prism_beetle', 0.45)],
  },
  {
    id: 'amber_gland',
    name: 'Amber Gland',
    cat: 'monster',
    g: 'resin',
    a: C.e6,
    b: C.e5,
    v: 13,
    d: 'A sticky gland of golden fluid, prized for varnish and light.',
    from: [src.mob('amber_gnawer', 0.4)],
  },
  {
    id: 'glow_gland',
    name: 'Glow Gland',
    cat: 'monster',
    g: 'heart',
    a: C.e6,
    b: C.white,
    v: 15,
    d: 'A warm lantern-sac that gives steady light for weeks.',
    rarity: 1,
    from: [src.mob('lantern_hound', 0.4)],
  },
  {
    id: 'rime_essence',
    name: 'Rime Essence',
    cat: 'magical',
    g: 'shard',
    a: C.w6,
    b: C.white,
    v: 20,
    d: 'Frost that will not melt, drawn from the cold dead.',
    rarity: 1,
    from: [src.mob('rime_skitter', 0.3), src.mob('frost_wraith', 0.4)],
  },
  {
    id: 'geode_core',
    name: 'Geode Core',
    cat: 'monster',
    g: 'crystal',
    a: C.q4,
    b: C.w6,
    v: 34,
    d: 'The humming heart of a geode golem.',
    rarity: 2,
    from: [src.mob('geode_golem', 0.6)],
  },
  {
    id: 'wyrm_scale',
    name: 'Wyrm Scale',
    cat: 'hide',
    g: 'scale',
    a: C.r4,
    b: C.e5,
    v: 38,
    d: 'A heat-hardened scale. Armourers fight over them.',
    rarity: 2,
    from: [src.mob('cinder_drake', 0.45, 1, 2), src.boss('cinder_wyrm', 1)],
  },
  {
    id: 'eel_skin',
    name: 'Eel Skin',
    cat: 'hide',
    g: 'hide',
    a: C.w4,
    b: C.w3,
    v: 16,
    d: 'Slick, supple and water-proof.',
    from: [src.mob('tide_eel', 0.5)],
  },
  {
    id: 'naga_scale',
    name: 'Naga Scale',
    cat: 'hide',
    g: 'scale',
    a: C.w5,
    b: C.g4,
    v: 30,
    d: 'Sea-green scale with an iridescent edge.',
    rarity: 2,
    from: [src.mob('reef_naga', 0.5)],
  },
  {
    id: 'spore_cap',
    name: 'Spore Cap',
    cat: 'reagent',
    g: 'mushroom',
    a: C.g4,
    b: C.q4,
    v: 10,
    d: 'A fat cap heavy with drowsy spores.',
    from: [src.mob('spore_sage', 0.55), src.mob('spore_matriarch', 1, 2, 3)],
  },
  {
    id: 'tortoise_shell',
    name: 'Tortoise Shell',
    cat: 'monster',
    g: 'scale',
    a: C.g3,
    b: C.e4,
    v: 18,
    d: 'Mossy domed plate. Shields and bucklers love it.',
    from: [src.mob('tortoise', 0.55)],
  },
  {
    id: 'briar_thorn',
    name: 'Briar Thorn',
    cat: 'monster',
    g: 'fang',
    a: C.g3,
    b: C.e5,
    v: 7,
    d: 'Hard hooked thorn, good on a trap or a tip.',
    from: [src.mob('thornling', 0.5, 1, 3)],
  },
  {
    id: 'dragon_bone',
    name: 'Dragon Bone',
    cat: 'bone',
    g: 'bone',
    a: C.pale,
    b: C.r5,
    v: 160,
    d: 'A rib or horn of a great wyrm. Armour, weapons and relics.',
    rarity: 4,
    from: [src.boss('cinder_wyrm', 1), src.boss('rime_sovereign', 1), src.boss('tide_leviathan', 1)],
  },
  {
    id: 'starstone',
    name: 'Starstone',
    cat: 'magical',
    g: 'crystal',
    a: C.q6,
    b: C.white,
    v: 400,
    d: 'A fallen star, cooled. The strongest enchanting gem there is.',
    rarity: 5,
    from: [src.boss('geode_tyrant', 0.6)],
  },
];
for (const p of PARTS) {
  item(p.id, p.name, p.cat, {
    v: p.v,
    g: p.g!,
    a: p.a,
    b: p.b,
    d: p.d,
    rarity: p.rarity ?? 0,
    src: p.from,
  });
}

// ── tanning rack: hide to leather
item('leather', 'Leather', 'hide', {
  v: 20,
  g: 'hide',
  a: C.e4,
  b: C.e3,
  d: 'Cured, supple leather. Armour, straps, bags and boots start here.',
});
rec(
  'tannery',
  [
    ['hide', 2],
    ['bark', 1],
  ],
  ['leather', 1],
  { lvl: 1, xp: 4, hint: 'Soak the hide in bark tannin.' },
);
rec(
  'tannery',
  [
    ['hide', 2],
    ['salt', 1],
  ],
  ['leather', 1],
  { lvl: 2, xp: 4, hint: 'Salt-cure a hide instead.', id: 'leather_salt' },
);
rec(
  'tannery',
  [
    ['eel_skin', 2],
    ['bark', 1],
  ],
  ['leather', 2],
  { lvl: 4, xp: 7, hint: 'Eel skin cures soft and tough.', id: 'leather_eel' },
);
item('thick_leather', 'Boiled Leather', 'hide', {
  v: 44,
  g: 'hide',
  a: C.e3,
  b: C.e2,
  d: 'Leather hardened in hot wax. Takes a blade and keeps its shape.',
  rarity: 1,
});
rec(
  'tannery',
  [
    ['leather', 2],
    ['resin', 1],
  ],
  ['thick_leather', 1],
  { lvl: 6, xp: 10, hint: 'Boil leather in wax and resin.' },
);
item('leather_strap', 'Leather Straps', 'component', {
  v: 8,
  g: 'rope',
  a: C.e4,
  b: C.e3,
  d: 'Cut straps for buckles, quivers and harness.',
});
rec('tannery', [['leather', 1]], ['leather_strap', 4], { lvl: 1, xp: 3, hint: 'Cut a hide into strips.' });
item('scale_leather', 'Scale Leather', 'hide', {
  v: 120,
  g: 'scale',
  a: C.r4,
  b: C.e4,
  d: 'Leather studded with overlapping wyrm scales.',
  rarity: 3,
});
rec(
  'tannery',
  [
    ['leather', 2],
    ['wyrm_scale', 3],
  ],
  ['scale_leather', 1],
  { lvl: 16, xp: 28, hint: 'Sew scales into leather.' },
);
item('wyrm_leather', 'Wyrm Hide', 'hide', {
  v: 120,
  g: 'hide',
  a: C.r3,
  b: C.r5,
  d: 'Hide of the great wyrms, cured with ash and fire.',
  rarity: 4,
});
rec(
  'tannery',
  [
    ['dragon_bone', 1],
    ['thick_leather', 2],
  ],
  ['wyrm_leather', 1],
  { lvl: 22, xp: 50, hint: 'Pound bone to meal and work it into the leather.' },
);
item('naga_leather', 'Naga Leather', 'hide', {
  v: 70,
  g: 'hide',
  a: C.w5,
  b: C.g4,
  d: 'Sea-green leather that shrugs off damp.',
  rarity: 2,
});
rec(
  'tannery',
  [
    ['naga_scale', 2],
    ['leather', 1],
  ],
  ['naga_leather', 1],
  { lvl: 10, xp: 18, hint: 'Cure naga scale with leather.' },
);
