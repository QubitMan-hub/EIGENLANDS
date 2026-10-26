import { T } from '../tiles';
import { COL as C, item, rec, src } from './kit';

/**
 * Alchemy: herbs gathered by the season, salts and spirits from the ground, brewed into potions, tonics and oils.
 * Every potion does one clear thing, and the stronger ones ask for rarer reagents from deeper places.
 */

// ── herbs: found on forage tiles in their season
interface Herb {
  id: string;
  name: string;
  seasons: number[];
  a: number;
  b: number;
  v: number;
  d: string;
  rarity?: 0 | 1 | 2;
  w?: number;
}
const HERBS: Herb[] = [
  {
    id: 'sage',
    name: 'Sage',
    seasons: [0, 1],
    a: C.g4,
    b: C.pale,
    v: 5,
    d: 'Grey-green leaves. Clears the head and cleans a wound.',
  },
  {
    id: 'thyme',
    name: 'Thyme',
    seasons: [0, 1, 2],
    a: C.g3,
    b: C.q4,
    v: 5,
    d: 'Tiny aromatic leaves for a stew or a tonic.',
  },
  { id: 'mint', name: 'Mint', seasons: [0, 1], a: C.g5, b: C.g6, v: 5, d: 'Cool, sharp and quick growing.' },
  { id: 'lavender', name: 'Lavender', seasons: [1], a: C.q4, b: C.q6, v: 7, d: 'Violet spikes that calm the mind.' },
  {
    id: 'chamomile',
    name: 'Chamomile',
    seasons: [0, 1],
    a: C.white,
    b: C.e6,
    v: 6,
    d: 'Small daisy-like flowers for a soothing tea.',
  },
  {
    id: 'nightshade',
    name: 'Nightshade',
    seasons: [1, 2],
    a: C.q2,
    b: C.q5,
    v: 9,
    d: 'Glossy dark berries. Beautiful and deadly.',
    w: 2,
  },
  {
    id: 'ember_root',
    name: 'Ember Root',
    seasons: [1, 2],
    a: C.r4,
    b: C.e6,
    v: 11,
    d: 'A knobbly red root hot enough to sting the tongue.',
    rarity: 1,
  },
  {
    id: 'frost_lily',
    name: 'Frost Lily',
    seasons: [3],
    a: C.w6,
    b: C.white,
    v: 11,
    d: 'Pale petals that never wilt in the cold.',
    rarity: 1,
  },
  {
    id: 'stormcap',
    name: 'Stormcap',
    seasons: [2],
    a: C.e7,
    b: C.w6,
    v: 12,
    d: 'A mushroom that tingles after thunder.',
    rarity: 1,
  },
  {
    id: 'moonbloom',
    name: 'Moonbloom',
    seasons: [1, 2, 3],
    a: C.q6,
    b: C.white,
    v: 14,
    d: 'Opens only after dark and fades by dawn.',
    rarity: 2,
    w: 1,
  },
  {
    id: 'bitterroot',
    name: 'Bitterroot',
    seasons: [0, 3],
    a: C.e3,
    b: C.e5,
    v: 6,
    d: 'A tough white root that tastes of iron.',
  },
  {
    id: 'clover',
    name: 'Four-Leaf Clover',
    seasons: [0, 1],
    a: C.g5,
    b: C.g6,
    v: 18,
    d: 'Rare, and said to keep luck near.',
    rarity: 1,
    w: 0.5,
  },
  {
    id: 'mandrake',
    name: 'Mandrake',
    seasons: [2, 3],
    a: C.e4,
    b: C.g3,
    v: 22,
    d: 'A root shaped like a person. Pull it up gently.',
    rarity: 2,
    w: 0.5,
  },
];
for (const h of HERBS)
  item(h.id, h.name, 'reagent', {
    v: h.v,
    g: 'leaf',
    a: h.a,
    b: h.b,
    d: h.d,
    rarity: h.rarity ?? 0,
    src: [src.forage(h.seasons, h.w ?? 2)],
  });

// ── mineral reagents
item('sulfur', 'Sulfur', 'reagent', {
  v: 14,
  g: 'dust',
  a: C.e7,
  b: C.e6,
  d: 'Yellow crust from hot cave vents. Burns blue.',
  src: [
    src.node(T.CAVE_WALL, 1, 2, 0.14, 2, { cave: 'basalt' }),
    src.node(T.ROCK, 1, 2, 0.1, 2, { realm: 'nethrakar' }),
  ],
});
item('quicksilver', 'Quicksilver', 'reagent', {
  v: 40,
  g: 'flask',
  a: C.pale,
  b: C.white,
  d: 'A heavy liquid metal that will not sit still.',
  rarity: 1,
  src: [src.node(T.CAVE_SILVER, 1, 1, 0.12, 3), src.node(T.CAVE_GEODE, 1, 1, 0.1, 3, { cave: 'frost' })],
});
item('alum', 'Alum', 'reagent', {
  v: 10,
  g: 'dust',
  a: C.white,
  b: C.fog,
  d: 'A white astringent salt. Fixes dyes and stops bleeding.',
  src: [src.node(T.CAVE_WALL, 1, 2, 0.16, 1, { cave: 'limestone' })],
});

// ── bottles
item('glass_vial', 'Glass Vial', 'component', {
  v: 8,
  g: 'vial',
  a: C.w6,
  b: C.white,
  d: 'A stoppered glass vial. Every potion starts in one.',
});
rec('alchemy', [['glass', 1]], ['glass_vial', 3], {
  lvl: 1,
  disc: 'alchemy',
  xp: 3,
  hint: 'Blow glass into small vials.',
});

// ── potions: every one has a single clear job
interface Potion {
  id: string;
  name: string;
  inputs: Array<[string, number]>;
  lvl: number;
  d: string;
  a: number;
  b: number;
  v: number;
  heal?: number;
  buff?: {
    kind:
      | 'regen'
      | 'might'
      | 'ward'
      | 'vigor'
      | 'fortune'
      | 'swift'
      | 'fury'
      | 'bulwark'
      | 'steady'
      | 'focus'
      | 'lantern'
      | 'warmth'
      | 'coolness';
    secs: number;
    power: number;
  };
  cure?: Array<'bleed' | 'poison' | 'burn' | 'frostbite'>;
  rarity?: 0 | 1 | 2 | 3;
  learn?: 'start' | 'level' | 'discover';
  hint: string;
}
const POTIONS: Potion[] = [
  {
    id: 'greater_healing',
    name: 'Greater Healing Potion',
    inputs: [
      ['healing_potion', 1],
      ['healing_herb', 3],
      ['sage', 2],
    ],
    lvl: 6,
    d: 'Restores 140 health.',
    a: C.r4,
    b: C.r6,
    v: 190,
    heal: 140,
    rarity: 1,
    hint: 'Concentrate a healing potion with sage.',
  },
  {
    id: 'supreme_healing',
    name: 'Supreme Healing Potion',
    inputs: [
      ['greater_healing', 1],
      ['life_crystal', 1],
      ['moonbloom', 1],
    ],
    lvl: 14,
    d: 'Restores 320 health.',
    a: C.r5,
    b: C.white,
    v: 520,
    heal: 320,
    rarity: 3,
    hint: 'Infuse the greater potion with a life crystal.',
  },
  {
    id: 'vigor_elixir',
    name: 'Vigor Elixir',
    inputs: [
      ['glass_vial', 1],
      ['healing_herb', 3],
      ['mint', 2],
      ['honey', 1],
    ],
    lvl: 5,
    d: 'Maximum health +30 for five minutes.',
    a: C.g5,
    b: C.e6,
    v: 150,
    buff: { kind: 'vigor', secs: 300, power: 30 },
    hint: 'Honeyed herbs: hearty and sweet.',
  },
  {
    id: 'swiftness_draught',
    name: 'Swiftness Draught',
    inputs: [
      ['glass_vial', 1],
      ['mint', 3],
      ['topaz_raw', 1],
    ],
    lvl: 8,
    d: 'Haste +3: gather and work faster for four minutes.',
    a: C.e7,
    b: C.w6,
    v: 210,
    buff: { kind: 'swift', secs: 240, power: 3 },
    rarity: 1,
    hint: 'Mint and powdered topaz.',
  },
  {
    id: 'fortune_draught',
    name: 'Draught of Fortune',
    inputs: [
      ['glass_vial', 1],
      ['clover', 1],
      ['chamomile', 2],
      ['emerald_raw', 1],
    ],
    lvl: 11,
    d: 'Luck +4 for five minutes: better drops and finds.',
    a: C.g5,
    b: C.e7,
    v: 330,
    buff: { kind: 'fortune', secs: 300, power: 4 },
    rarity: 2,
    hint: 'A clover steeped with emerald.',
  },
  {
    id: 'fury_elixir',
    name: 'Fury Elixir',
    inputs: [
      ['glass_vial', 1],
      ['ember_root', 2],
      ['garnet_raw', 1],
    ],
    lvl: 9,
    d: 'Attack +8 for three minutes.',
    a: C.r4,
    b: C.e7,
    v: 230,
    buff: { kind: 'fury', secs: 180, power: 8 },
    rarity: 1,
    hint: 'Ember root and garnet dust.',
  },
  {
    id: 'bulwark_tonic',
    name: 'Bulwark Tonic',
    inputs: [
      ['glass_vial', 1],
      ['tortoise_shell', 1],
      ['salt', 2],
      ['bitterroot', 2],
    ],
    lvl: 7,
    d: 'Take 15% less damage for four minutes.',
    a: C.g3,
    b: C.mist,
    v: 180,
    buff: { kind: 'bulwark', secs: 240, power: 0.15 },
    rarity: 1,
    hint: 'Shell dust and bitter root.',
  },
  {
    id: 'steady_tonic',
    name: 'Steady Tonic',
    inputs: [
      ['glass_vial', 1],
      ['thyme', 2],
      ['mint', 1],
      ['bitterroot', 1],
    ],
    lvl: 4,
    d: 'Stamina +25 for five minutes.',
    a: C.w5,
    b: C.g5,
    v: 110,
    buff: { kind: 'steady', secs: 300, power: 25 },
    hint: 'A bracing cup before a long climb.',
  },
  {
    id: 'focus_draught',
    name: 'Focus Draught',
    inputs: [
      ['glass_vial', 1],
      ['lavender', 2],
      ['crystal_dust', 1],
    ],
    lvl: 10,
    d: '12% chance to save an ingredient when crafting, for five minutes.',
    a: C.q5,
    b: C.white,
    v: 200,
    buff: { kind: 'focus', secs: 300, power: 12 },
    rarity: 1,
    hint: 'Lavender and crystal dust clear the mind.',
  },
  {
    id: 'greater_ward',
    name: 'Greater Warding Potion',
    inputs: [
      ['ward_potion', 1],
      ['tortoise_shell', 1],
      ['frost_lily', 1],
    ],
    lvl: 12,
    d: 'Take 35% less damage for three minutes.',
    a: C.w4,
    b: C.white,
    v: 320,
    buff: { kind: 'ward', secs: 180, power: 0.35 },
    rarity: 2,
    hint: 'Reinforce a warding potion.',
  },
  {
    id: 'greater_might',
    name: 'Greater Might Potion',
    inputs: [
      ['might_potion', 1],
      ['wolf_fang', 2],
      ['ember_root', 1],
    ],
    lvl: 12,
    d: 'Hit 40% harder for three minutes.',
    a: C.r5,
    b: C.e7,
    v: 320,
    buff: { kind: 'might', secs: 180, power: 0.4 },
    rarity: 2,
    hint: 'Reinforce a might potion.',
  },
  {
    id: 'greater_regen',
    name: 'Greater Regeneration Potion',
    inputs: [
      ['regen_potion', 1],
      ['life_crystal', 1],
      ['chamomile', 2],
    ],
    lvl: 13,
    d: 'Heals quickly over time.',
    a: C.g6,
    b: C.white,
    v: 340,
    buff: { kind: 'regen', secs: 120, power: 4 },
    rarity: 2,
    hint: 'Reinforce a regeneration potion.',
  },
  {
    id: 'greater_antidote',
    name: 'Strong Antidote',
    inputs: [
      ['antidote', 1],
      ['mint', 2],
      ['alum', 1],
    ],
    lvl: 6,
    d: 'Cures poison and bleeding.',
    a: C.g4,
    b: C.w6,
    v: 90,
    cure: ['poison', 'bleed'],
    hint: 'Fortify an antidote with alum.',
  },
  {
    id: 'panacea',
    name: 'Panacea',
    inputs: [
      ['glass_vial', 1],
      ['mandrake', 1],
      ['moonbloom', 1],
      ['alum', 1],
    ],
    lvl: 16,
    d: 'Cures every injury at once.',
    a: C.white,
    b: C.q6,
    v: 420,
    cure: ['poison', 'bleed', 'burn', 'frostbite'],
    rarity: 3,
    hint: 'The alchemist’s masterpiece.',
  },
  {
    id: 'frostward_tonic',
    name: 'Frostward Tonic',
    inputs: [
      ['glass_vial', 1],
      ['ember_root', 1],
      ['thyme', 2],
    ],
    lvl: 3,
    d: 'Cold barely touches you for six minutes.',
    a: C.r4,
    b: C.e6,
    v: 90,
    buff: { kind: 'warmth', secs: 360, power: 1 },
    hint: 'A hot cordial for long winter roads.',
  },
  {
    id: 'coolant_tonic',
    name: 'Coolant Tonic',
    inputs: [
      ['glass_vial', 1],
      ['frost_lily', 1],
      ['mint', 2],
    ],
    lvl: 3,
    d: 'Heat barely touches you for six minutes.',
    a: C.w5,
    b: C.white,
    v: 90,
    buff: { kind: 'coolness', secs: 360, power: 1 },
    hint: 'Mint and frost lily over ice.',
  },
  {
    id: 'eyes_of_night',
    name: 'Eyes of Night',
    inputs: [
      ['glass_vial', 1],
      ['glow_gland', 1],
      ['moonbloom', 1],
    ],
    lvl: 9,
    d: 'See far in the dark for ten minutes.',
    a: C.q5,
    b: C.e7,
    v: 160,
    buff: { kind: 'lantern', secs: 900, power: 2 },
    rarity: 1,
    hint: 'A glow gland in moonbloom water.',
  },
  {
    id: 'mycelium_tonic',
    name: 'Mycelium Tonic',
    inputs: [
      ['glass_vial', 1],
      ['spore_cap', 2],
      ['healing_herb', 2],
      ['honey', 1],
    ],
    lvl: 7,
    d: 'Maximum health +55 for five minutes.',
    a: C.g4,
    b: C.q4,
    v: 240,
    buff: { kind: 'vigor', secs: 300, power: 55 },
    rarity: 1,
    hint: 'Spore caps steeped in honey.',
  },
  {
    id: 'shade_draught',
    name: 'Draught of Shadows',
    inputs: [
      ['glass_vial', 1],
      ['nightshade', 2],
      ['moonbloom', 1],
      ['bat_wing', 1],
    ],
    lvl: 11,
    d: 'Haste +4 for three minutes. Bitter, and a little frightening.',
    a: C.q2,
    b: C.night,
    v: 280,
    buff: { kind: 'swift', secs: 180, power: 4 },
    rarity: 2,
    hint: 'Nightshade and bat wing under moonlight.',
  },
  {
    id: 'phoenix_tonic',
    name: 'Phoenix Tonic',
    inputs: [
      ['glass_vial', 1],
      ['essence_life', 1],
      ['essence_fire', 1],
      ['griffin_plume', 1],
    ],
    lvl: 17,
    d: 'A powerful regeneration for two minutes.',
    a: C.r5,
    b: C.e7,
    v: 700,
    buff: { kind: 'regen', secs: 120, power: 8 },
    rarity: 3,
    hint: 'Life and flame in one vial.',
  },
  {
    id: 'rimeguard_tonic',
    name: 'Rimeguard Tonic',
    inputs: [
      ['glass_vial', 1],
      ['essence_frost', 1],
      ['tortoise_shell', 1],
      ['salt', 2],
    ],
    lvl: 15,
    d: 'Take 30% less damage for four minutes.',
    a: C.w6,
    b: C.white,
    v: 520,
    buff: { kind: 'bulwark', secs: 240, power: 0.3 },
    rarity: 3,
    hint: 'Frost essence and shell dust.',
  },
];
for (const p of POTIONS) {
  item(p.id, p.name, 'potion', {
    v: p.v,
    g: p.heal ? 'flask' : 'vial',
    a: p.a,
    b: p.b,
    d: p.d,
    rarity: p.rarity ?? 0,
    ...(p.heal ? { heal: p.heal } : {}),
    ...(p.buff ? { buff: p.buff } : {}),
    ...(p.cure ? { cure: p.cure } : {}),
  });
  rec('alchemy', p.inputs, [p.id, 1], {
    lvl: p.lvl,
    disc: 'alchemy',
    xp: 8 + p.lvl * 2,
    learn: p.learn ?? (p.lvl <= 4 ? 'start' : 'level'),
    hint: p.hint,
  });
}

// ── oils and fuels
item('lamp_oil', 'Lamp Oil', 'component', {
  v: 12,
  g: 'flask',
  a: C.e6,
  b: C.e7,
  d: 'Pressed oil for lanterns and lamps.',
});
rec('dairy', [['sunpetal', 3]], ['lamp_oil', 1], { lvl: 2, disc: 'farming', xp: 5, hint: 'Press the seed heads.' });
rec('dairy', [['amber_gland', 1]], ['lamp_oil', 2], {
  lvl: 4,
  disc: 'farming',
  xp: 7,
  hint: 'Squeeze an amber gland.',
  id: 'lamp_oil_amber',
});
item('fire_oil', 'Fire Oil', 'component', {
  v: 36,
  g: 'flask',
  a: C.r4,
  b: C.e7,
  d: 'Sticky oil that burns hot. Lanterns burn bright; forges burn hotter.',
  rarity: 1,
});
rec(
  'alchemy',
  [
    ['lamp_oil', 2],
    ['sulfur', 1],
    ['moth_dust', 1],
  ],
  ['fire_oil', 1],
  { lvl: 8, disc: 'alchemy', xp: 14, hint: 'Cook sulfur and cinder dust into oil.' },
);
