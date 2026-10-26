import { COL as C, item, rec, src } from './kit';
import { LEGENDARY_WEAPONS } from './weapons-data';
import { PROP_SPECS } from './home';
import type { GearBonus, GearSlot } from './types';
import type { Rarity } from '../crafting';

/**
 * The top of the ladder: legendary weapons, artifacts and collectibles, plus the exploration kit that gets you there.
 * Legendary recipes are not learned by levelling; each is taught by a scroll found in a vault, a ruin or a high-standing
 * kingdom's reward. Each asks for materials from a different corner of the world, so a legend is a journey.
 */

// ── exploration kit
item('campfire_kit', 'Campfire Kit', 'explore', {
  v: 24,
  g: 'torch',
  a: C.r5,
  b: C.e6,
  d: 'Kindling, a flint and a ring of stones. Sets a campfire: light, and warmth against the cold.',
  kind: 'placeable',
  place: { kind: 'furniture', sub: 'campfire' },
  stack: 10,
});
rec(
  'hand',
  [
    ['wood', 4],
    ['flint', 1],
    ['stone', 4],
    ['charcoal', 1],
  ],
  ['campfire_kit', 1],
  { lvl: 1, disc: 'woodworking', xp: 4, hint: 'Stack kindling in a ring of stones.' },
);

interface GearRow {
  id: string;
  name: string;
  cat: 'accessory' | 'light' | 'pack' | 'shield';
  slot: GearSlot;
  level: number;
  bonus: GearBonus;
  dur: number;
  rarity: Rarity;
  g: Parameters<typeof item>[3]['g'];
  a: number;
  b: number;
  d: string;
  v: number;
  inputs: Array<[string, number]>;
  station: 'jeweler' | 'engineering' | 'tannery' | 'loom' | 'forge' | 'runeforge' | 'enchanting';
  disc: 'smithing' | 'engineering' | 'leatherworking' | 'tailoring' | 'magic' | 'enchanting';
  tool?: string;
  scroll?: boolean;
  lvl: number;
  hint: string;
}
const GEARS: GearRow[] = [
  // explorers' charms (charm slot)
  {
    id: 'compass_charm',
    name: 'Pathfinder’s Compass',
    cat: 'accessory',
    slot: 'charm',
    level: 5,
    bonus: { stamina: 12, drain: 0.06 },
    dur: 260,
    rarity: 1,
    g: 'compass',
    a: C.e6,
    b: C.w6,
    d: 'A bronze compass on a thong. You tire and hunger less when you know the way.',
    v: 180,
    inputs: [
      ['bronze_plate', 1],
      ['glass', 1],
      ['silver_wire', 1],
    ],
    station: 'jeweler',
    disc: 'smithing',
    tool: 'loupe',
    lvl: 5,
    hint: 'Set a needle under glass.',
  },
  {
    id: 'spyglass_charm',
    name: 'Brass Spyglass',
    cat: 'accessory',
    slot: 'charm',
    level: 8,
    bonus: { luck: 1.5, haste: 0.6 },
    dur: 260,
    rarity: 1,
    g: 'compass',
    a: C.e5,
    b: C.w6,
    d: 'A pocket spyglass. You spot good finds from afar.',
    v: 260,
    inputs: [
      ['bronze_plate', 1],
      ['lens', 1],
      ['glass_chitin', 2],
    ],
    station: 'engineering',
    disc: 'engineering',
    lvl: 8,
    hint: 'Grind a prism lens.',
  },
  {
    id: 'briar_charm',
    name: 'Briar Charm',
    cat: 'accessory',
    slot: 'charm',
    level: 6,
    bonus: { atk: 3, def: 0.02 },
    dur: 220,
    rarity: 1,
    g: 'charm',
    a: C.g3,
    b: C.e5,
    d: 'A twist of thorn on a leather cord. It pricks the hand that strikes you.',
    v: 150,
    inputs: [
      ['briar_thorn', 4],
      ['leather', 1],
      ['hemp_cord', 1],
    ],
    station: 'tannery',
    disc: 'leatherworking',
    tool: 'needle_kit',
    lvl: 6,
    hint: 'Bind thorns into a knot.',
  },
  {
    id: 'tide_cloak',
    name: 'Tide Cloak',
    cat: 'accessory',
    slot: 'back',
    level: 12,
    bonus: { cool: 3, luck: 1.5, drain: 0.06 },
    dur: 240,
    rarity: 2,
    g: 'cloak',
    a: C.w5,
    b: C.g4,
    d: 'Sea-green leather cut like a mantle. Rain slides off it.',
    v: 420,
    inputs: [
      ['naga_leather', 3],
      ['silk_thread', 2],
      ['dye_blue', 1],
    ],
    station: 'tannery',
    disc: 'leatherworking',
    tool: 'needle_kit',
    lvl: 12,
    hint: 'Stitch naga leather into a cloak.',
  },
  {
    id: 'geode_amulet',
    name: 'Geode Heart Amulet',
    cat: 'accessory',
    slot: 'neck',
    level: 14,
    bonus: { hp: 30, def: 0.03, luck: 1 },
    dur: 260,
    rarity: 2,
    g: 'amulet',
    a: C.q4,
    b: C.w6,
    d: 'A geode core cut and set in silver. It hums with the stone’s patience.',
    v: 480,
    inputs: [
      ['geode_core', 1],
      ['silver_wire', 3],
      ['silver_ingot', 1],
    ],
    station: 'jeweler',
    disc: 'smithing',
    tool: 'loupe',
    lvl: 14,
    hint: 'Cage a geode core in silver.',
  },
  {
    id: 'eternal_lantern',
    name: 'Eternal Lantern',
    cat: 'light',
    slot: 'light',
    level: 20,
    bonus: { light: 12, luck: 1 },
    dur: 1200,
    rarity: 4,
    g: 'lantern',
    a: C.q5,
    b: C.white,
    d: 'A charged crystal in a mithril cage. It will outburn a lifetime of oil.',
    v: 1100,
    inputs: [
      ['mithril_plate', 2],
      ['charged_crystal', 1],
      ['crystal_lens_focus', 1],
      ['essence_fire', 1],
    ],
    station: 'engineering',
    disc: 'engineering',
    scroll: true,
    lvl: 20,
    hint: 'Cage a charged crystal in mithril.',
  },
  // legendary artifacts, one per kingdom's greatest craft or deed
  {
    id: 'heart_of_mountain',
    name: 'Heart of the Mountain',
    cat: 'accessory',
    slot: 'neck',
    level: 24,
    bonus: { hp: 70, def: 0.08, warm: 4 },
    dur: 600,
    rarity: 4,
    g: 'amulet',
    a: C.slate,
    b: C.r5,
    d: 'A hearth-stone of Khardum: it never goes cold, and neither do you.',
    v: 1400,
    inputs: [
      ['deepsteel_plate', 3],
      ['geode_core', 2],
      ['essence_fire', 1],
      ['ruby_cut', 1],
    ],
    station: 'jeweler',
    disc: 'smithing',
    tool: 'loupe',
    scroll: true,
    lvl: 24,
    hint: 'Forge a hearth-stone in deepsteel.',
  },
  {
    id: 'tidecaller_pearl',
    name: 'Tidecaller Pearl',
    cat: 'accessory',
    slot: 'charm',
    level: 22,
    bonus: { cool: 6, luck: 3, drain: 0.1, hp: 20 },
    dur: 600,
    rarity: 4,
    g: 'charm',
    a: C.pale,
    b: C.w5,
    d: 'A black-sea pearl wrapped in tidesilver. Storms thin out around its wearer.',
    v: 1300,
    inputs: [
      ['naga_pearl', 2],
      ['tide_crystal', 2],
      ['opal_cut', 1],
      ['silver_wire', 1],
    ],
    station: 'jeweler',
    disc: 'smithing',
    tool: 'loupe',
    scroll: true,
    lvl: 22,
    hint: 'Wrap two pearls in tidesilver.',
  },
  {
    id: 'sun_court_crown',
    name: 'Crown of the Sun Court',
    cat: 'accessory',
    slot: 'charm',
    level: 26,
    bonus: { luck: 4, haste: 2, hp: 30, light: 6 },
    dur: 600,
    rarity: 4,
    g: 'crown',
    a: C.e7,
    b: C.e6,
    d: 'Worn by the rulers of Aurelion at midsummer. It gleams even at midnight.',
    v: 1600,
    inputs: [
      ['gold_ingot', 3],
      ['skysteel_plate', 1],
      ['sunstone_cut', 2],
      ['diamond_cut', 1],
    ],
    station: 'jeweler',
    disc: 'smithing',
    tool: 'loupe',
    scroll: true,
    lvl: 26,
    hint: 'A crown of gold, sunstone and diamond.',
  },
  {
    id: 'storm_belt',
    name: 'Stormcaller’s Belt',
    cat: 'accessory',
    slot: 'belt',
    level: 22,
    bonus: { atk: 9, haste: 3, stamina: 12 },
    dur: 600,
    rarity: 4,
    g: 'belt',
    a: C.e7,
    b: C.w6,
    d: 'Stormiron plates and storm-leather. It raises the hair on your arms.',
    v: 1300,
    inputs: [
      ['stormiron_plate', 3],
      ['thick_leather', 2],
      ['essence_storm', 1],
      ['storm_crystal', 1],
    ],
    station: 'forge',
    disc: 'smithing',
    tool: 'tongs',
    scroll: true,
    lvl: 22,
    hint: 'Stormiron on dark leather.',
  },
  {
    id: 'many_selves_cloak',
    name: 'Cloak of Many Selves',
    cat: 'accessory',
    slot: 'back',
    level: 28,
    bonus: { phase: 0.12, haste: 3, luck: 2 },
    dur: 700,
    rarity: 5,
    g: 'cloak',
    a: C.q5,
    b: C.white,
    d: 'A cloak that is not always where you left it. Blows pass through the other you.',
    v: 2200,
    inputs: [
      ['moonweave', 4],
      ['void_core', 1],
      ['starstone', 1],
      ['moonsilver_wire', 2],
    ],
    station: 'loom',
    disc: 'tailoring',
    tool: 'needle_kit',
    scroll: true,
    lvl: 28,
    hint: 'Weave starlight into moonweave.',
  },
  {
    id: 'phoenix_mantle',
    name: 'Phoenix Mantle',
    cat: 'accessory',
    slot: 'back',
    level: 30,
    bonus: { hp: 60, def: 0.06, warm: 6, atk: 5 },
    dur: 700,
    rarity: 5,
    g: 'cloak',
    a: C.r5,
    b: C.e7,
    d: 'Feathers of a bird that rises from its ashes. The cold cannot find you.',
    v: 2300,
    inputs: [
      ['wyrm_leather', 2],
      ['griffin_plume', 4],
      ['essence_fire', 1],
      ['essence_life', 1],
    ],
    station: 'tannery',
    disc: 'leatherworking',
    tool: 'needle_kit',
    scroll: true,
    lvl: 30,
    hint: 'Feather and fire in wyrm hide.',
  },
];
for (const g of GEARS) {
  item(g.id, g.name, g.cat, {
    v: g.v,
    g: g.g!,
    a: g.a,
    b: g.b,
    d: g.d,
    rarity: g.rarity,
    stack: 1,
    gear: { slot: g.slot, level: g.level, bonus: g.bonus, dur: g.dur },
  });
  rec(g.station, g.inputs, [g.id, 1], {
    lvl: g.lvl,
    disc: g.disc,
    xp: 16 + g.lvl * 3,
    hint: g.hint,
    quality: true,
    gear: true,
    cat: g.cat,
    stage: 3,
    ...(g.scroll ? { learn: 'scroll' as const } : {}),
    ...(g.tool ? { tool: g.tool } : {}),
  });
}

// ── legendary weapons: recipes (the items come from weapons-data, like every other weapon)
const LEG: Record<string, { station: 'forge'; inputs: Array<[string, number]>; lvl: number }> = {
  stormpiercer: {
    station: 'forge',
    inputs: [
      ['stormiron_rod', 3],
      ['essence_storm', 2],
      ['starstone', 1],
      ['ironwood_plank', 2],
    ],
    lvl: 26,
  },
  emberfall: {
    station: 'forge',
    inputs: [
      ['hellsteel_plate', 4],
      ['essence_fire', 2],
      ['dragon_bone', 2],
      ['wyrm_scale', 3],
    ],
    lvl: 28,
  },
  titans_maul: {
    station: 'forge',
    inputs: [
      ['adamant_plate', 6],
      ['geode_core', 3],
      ['essence_life', 1],
      ['ironwood_plank', 2],
    ],
    lvl: 30,
  },
  voidreaver: {
    station: 'forge',
    inputs: [
      ['voidsteel_rod', 3],
      ['voidsteel_plate', 1],
      ['void_core', 1],
      ['charged_crystal', 1],
    ],
    lvl: 32,
  },
};
for (const w of LEGENDARY_WEAPONS) {
  const m = LEG[w.id]!;
  rec(m.station, m.inputs, [w.id, 1], {
    lvl: m.lvl,
    disc: 'smithing',
    xp: 60 + m.lvl * 3,
    learn: 'scroll',
    hint: w.blurb,
    cat: 'weapon',
    quality: true,
    gear: true,
    tool: 'tongs',
    stage: 3,
  });
}

// ── recipe scrolls: each teaches one of the recipes that cannot be levelled into
interface Scroll {
  recipe: string;
  name: string;
  d: string;
  rarity: Rarity;
  src: ReturnType<typeof src.vault>[];
}
const SCROLLS: Scroll[] = [
  {
    recipe: 'eternal_lantern',
    name: 'Scroll of the Eternal Flame',
    d: 'A lantern whose crystal burns without end.',
    rarity: 3,
    src: [src.vault('crystal', 0.12), src.vault('frost', 0.08)],
  },
  {
    recipe: 'heart_of_mountain',
    name: 'Scroll of the Mountain’s Heart',
    d: 'Khardum’s guarded hearth-stone craft.',
    rarity: 4,
    src: [src.vault('basalt', 0.1)],
  },
  {
    recipe: 'tidecaller_pearl',
    name: 'Scroll of the Tide-Caller',
    d: 'A sea-witch’s rite for a pearl that quiets storms.',
    rarity: 4,
    src: [src.vault('drowned', 0.1)],
  },
  {
    recipe: 'sun_court_crown',
    name: 'Scroll of the Sun Court',
    d: 'The coronation crown of Aurelion.',
    rarity: 4,
    src: [src.vault('limestone', 0.07), src.vault('crystal', 0.06)],
  },
  {
    recipe: 'storm_belt',
    name: 'Scroll of the Storm-Caller',
    d: 'Raijin’s lightning-forged belt.',
    rarity: 4,
    src: [src.vault('frost', 0.08), src.vault('crystal', 0.05)],
  },
  {
    recipe: 'many_selves_cloak',
    name: 'Scroll of Many Selves',
    d: 'A cloak woven of what you might have been.',
    rarity: 5,
    src: [src.vault('crystal', 0.06), src.vault('glowmoss', 0.04)],
  },
  {
    recipe: 'phoenix_mantle',
    name: 'Scroll of the Phoenix',
    d: 'Nethrakar’s ash-and-flame mantle.',
    rarity: 5,
    src: [src.vault('basalt', 0.06)],
  },
  {
    recipe: 'stormpiercer',
    name: 'Scroll of Stormpiercer',
    d: 'The spear that arrives before its own thunder.',
    rarity: 4,
    src: [src.vault('frost', 0.07)],
  },
  {
    recipe: 'emberfall',
    name: 'Scroll of Emberfall',
    d: 'The axe that is never quite cool.',
    rarity: 4,
    src: [src.vault('basalt', 0.07)],
  },
  {
    recipe: 'titans_maul',
    name: 'Scroll of the Titan’s Maul',
    d: 'The hammer of geode and adamant.',
    rarity: 4,
    src: [src.vault('limestone', 0.06), src.vault('basalt', 0.04)],
  },
  {
    recipe: 'voidreaver',
    name: 'Scroll of the Voidreaver',
    d: 'A crossbow from a collapsed wavefunction.',
    rarity: 5,
    src: [src.vault('crystal', 0.05)],
  },
];
for (const s of SCROLLS) {
  item(`scroll_${s.recipe}`, s.name, 'scroll', {
    v: 300 + s.rarity * 160,
    g: 'scroll',
    a: C.pale,
    b: s.rarity >= 5 ? C.q5 : C.r3,
    d: `${s.d} Read it to learn the recipe.`,
    rarity: s.rarity,
    use: { t: 'recipe', id: s.recipe },
    stack: 5,
    src: s.src,
  });
}
// starforged armour: four pieces, one scroll teaches the set
for (const slot of ['head', 'chest', 'legs', 'feet']) void slot;
item('scroll_starforged', 'Scroll of the Starforged', 'scroll', {
  v: 1100,
  g: 'scroll',
  a: C.pale,
  b: C.q6,
  d: 'The pattern for armour set with fallen stars. Read it to learn the helm; the rest follow from the same hand.',
  rarity: 5,
  use: { t: 'recipe', id: 'armor_starforged_head' },
  stack: 5,
  src: [src.vault('crystal', 0.04)],
});
for (const slot of ['chest', 'legs', 'feet'])
  item(
    `scroll_starforged_${slot}`,
    `Starforged ${slot === 'chest' ? 'Cuirass' : slot === 'legs' ? 'Greaves' : 'Sabaton'} Pattern`,
    'scroll',
    {
      v: 900,
      g: 'scroll',
      a: C.pale,
      b: C.q6,
      d: `Teaches the Starforged ${slot} piece.`,
      rarity: 5,
      use: { t: 'recipe', id: `armor_starforged_${slot}` },
      stack: 5,
      src: [src.vault('crystal', 0.03)],
    },
  );

// ── collectibles: finds from vaults and the deep, worth a lot and wanted by the rarest recipes
const COLLECT: Array<[string, string, string, number, number, number, string, ReturnType<typeof src.vault>[]]> = [
  [
    'ancient_coin',
    'Ancient Coin',
    'collectible',
    C.e6,
    C.e7,
    60,
    'A coin from an empire no one remembers.',
    [src.vault('limestone', 0.25), src.vault('glowmoss', 0.2)],
  ],
  [
    'fossil_shell',
    'Fossil Shell',
    'collectible',
    C.fog,
    C.e5,
    50,
    'A spiral shell turned to stone.',
    [src.vault('limestone', 0.22), src.vault('drowned', 0.2)],
  ],
  [
    'amber_insect',
    'Amber with an Insect',
    'collectible',
    C.e6,
    C.e3,
    90,
    'A tiny creature caught mid-step, ten thousand years ago.',
    [src.vault('glowmoss', 0.2), src.vault('limestone', 0.12)],
  ],
  [
    'meteorite_shard',
    'Meteorite Shard',
    'collectible',
    C.slate,
    C.q4,
    140,
    'Iron that fell from the sky. It is warm to the touch.',
    [src.vault('basalt', 0.2), src.vault('frost', 0.15)],
  ],
  [
    'relic_idol',
    'Relic Idol',
    'collectible',
    C.e5,
    C.g4,
    180,
    'A small idol of a nameless god, worn smooth.',
    [src.vault('crystal', 0.16), src.vault('basalt', 0.12)],
  ],
  [
    'runestone_tablet',
    'Runestone Tablet',
    'collectible',
    C.steel,
    C.q5,
    220,
    'A fragment of a stone tablet carved with runes still faintly lit.',
    [src.vault('crystal', 0.18), src.vault('frost', 0.12)],
  ],
  [
    'star_map',
    'Star Map Fragment',
    'collectible',
    C.pale,
    C.w5,
    260,
    'Part of a star chart; the constellations are not ours.',
    [src.vault('frost', 0.14), src.vault('crystal', 0.1)],
  ],
];
for (const [id, name, cat, a, b, v, d, s] of COLLECT)
  item(id, name, cat as 'collectible', { v, g: 'collectible', a, b, d, rarity: v > 150 ? 3 : v > 80 ? 2 : 1, src: s });
// collectibles feed the rarest crafts and the scholar's shelves
item('sage_ink', 'Sage’s Ink', 'reagent', {
  v: 90,
  g: 'vial',
  a: C.night,
  b: C.q5,
  d: 'Ink made with ground relic stone. Scrolls and runes take it gladly.',
  rarity: 2,
});
rec(
  'alchemy',
  [
    ['relic_idol', 1],
    ['charcoal', 2],
    ['crystal_dust', 1],
  ],
  ['sage_ink', 2],
  { lvl: 10, disc: 'alchemy', xp: 24, hint: 'Grind a relic into soot-black ink.', tool: 'pestle' },
);
item('rune_tablet_blank', 'Inscribed Tablet', 'artifact', {
  v: 320,
  g: 'rune',
  a: C.steel,
  b: C.q5,
  d: 'A tablet of runestone, re-carved with your own runes. A lasting charm for a shelf.',
  rarity: 3,
});
rec(
  'runeforge',
  [
    ['runestone_tablet', 1],
    ['sage_ink', 1],
    ['charged_crystal', 1],
  ],
  ['rune_tablet_blank', 1],
  { lvl: 14, disc: 'magic', xp: 40, hint: 'Re-carve an old tablet.', tool: 'chisel' },
);
rec(
  'alchemy',
  [
    ['meteorite_shard', 1],
    ['star_map', 1],
    ['essence_storm', 1],
  ],
  ['elixir_of_stars', 1],
  { lvl: 18, disc: 'alchemy', xp: 90, hint: 'Distil starlight and fallen iron.', learn: 'discover', tool: 'pestle' },
);
item('elixir_of_stars', 'Elixir of Stars', 'potion', {
  v: 900,
  g: 'vial',
  a: C.q6,
  b: C.white,
  d: 'A shimmering draught that makes the world feel lucky. Luck +8 for ten minutes.',
  rarity: 4,
  buff: { kind: 'fortune', secs: 600, power: 8 },
});
item('ammonite_display', 'Ammonite Display', 'decor', {
  v: 340,
  g: 'collectible',
  a: C.fog,
  b: C.e5,
  d: 'A fossil shell on a polished stand: a conversation piece.',
  rarity: 2,
  kind: 'placeable',
  place: { kind: 'furniture', sub: 'display_case' },
  stack: 20,
});
rec(
  'carpenter',
  [
    ['fossil_shell', 2],
    ['oak_plank', 1],
    ['glass_pane', 1],
  ],
  ['ammonite_display', 1],
  { lvl: 8, disc: 'woodworking', xp: 16, hint: 'Mount a fossil under glass.', tool: 'saw' },
);
