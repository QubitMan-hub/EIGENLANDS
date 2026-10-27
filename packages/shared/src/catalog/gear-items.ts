import { COL as C, item, rec, src } from './kit';
import type { GearBonus, GearSlot } from './types';
import type { Rarity } from '../crafting';
import type { StationId, Discipline } from '../crafting';

/**
 * Worn and carried gear beyond armour and weapons: shields, cloaks and packs, amulets, belts, charms and lights. Each slot
 * has its own job (defence, survival, luck, craft, light), so wearing a full set is a build, not a stat pile. Also the
 * craft tools that unlock the benches, and the kits that repair and sharpen.
 */

// ── craft tools (kept in the pack, never used up): each opens the catalog recipes of one trade
interface CraftTool {
  id: string;
  name: string;
  g: Parameters<typeof item>[3]['g'];
  a: number;
  b: number;
  d: string;
  station: StationId;
  inputs: Array<[string, number]>;
  disc: Discipline;
  lvl: number;
}
const CRAFT_TOOLS: CraftTool[] = [
  {
    id: 'chisel',
    name: 'Stonecutter’s Chisel',
    g: 'chisel',
    a: C.steel,
    b: C.e4,
    d: 'Squares stone. Keep it in your pack to cut blocks and slabs.',
    station: 'workbench',
    inputs: [
      ['copper_rod', 1],
      ['handle', 1],
    ],
    disc: 'masonry',
    lvl: 1,
  },
  {
    id: 'saw',
    name: 'Handsaw',
    g: 'saw',
    a: C.mist,
    b: C.e4,
    d: 'Rips logs into planks. Keep it in your pack at the carpenter’s bench.',
    station: 'workbench',
    inputs: [
      ['copper_plate', 1],
      ['handle', 1],
    ],
    disc: 'woodworking',
    lvl: 1,
  },
  {
    id: 'tongs',
    name: 'Smith’s Tongs',
    g: 'tongs',
    a: C.slate,
    b: C.steel,
    d: 'Holds hot metal. Needed for armour and weapons at the forge.',
    station: 'workbench',
    inputs: [
      ['copper_rod', 2],
      ['rivets', 1],
    ],
    disc: 'smithing',
    lvl: 1,
  },
  {
    id: 'loupe',
    name: 'Jeweler’s Loupe',
    g: 'compass',
    a: C.e5,
    b: C.w6,
    d: 'A small lens on a brass ring. Needed to cut gems.',
    station: 'workbench',
    inputs: [
      ['glass', 1],
      ['copper_wire', 2],
    ],
    disc: 'smithing',
    lvl: 2,
  },
  {
    id: 'needle_kit',
    name: 'Sewing Kit',
    g: 'kit',
    a: C.e5,
    b: C.pale,
    d: 'Needles, awl and waxed thread. Needed for leather and cloth armour.',
    station: 'workbench',
    inputs: [
      ['copper_rod', 1],
      ['thread', 2],
      ['leather_strap', 1],
    ],
    disc: 'tailoring',
    lvl: 1,
  },
  {
    id: 'knife',
    name: 'Kitchen Knife',
    g: 'knife',
    a: C.mist,
    b: C.e4,
    d: 'Keen and balanced. Needed to butcher, slice and prepare.',
    station: 'workbench',
    inputs: [
      ['copper_plate', 1],
      ['handle', 1],
    ],
    disc: 'cooking',
    lvl: 1,
  },
  {
    id: 'pestle',
    name: 'Mortar & Pestle',
    g: 'urn',
    a: C.fog,
    b: C.mist,
    d: 'Grinds herbs and minerals fine. Needed for tonics and powders.',
    station: 'workbench',
    inputs: [
      ['stone', 6],
      ['clay', 1],
    ],
    disc: 'alchemy',
    lvl: 1,
  },
];
for (const t of CRAFT_TOOLS) {
  item(t.id, t.name, 'tool', { v: 60, g: t.g!, a: t.a, b: t.b, d: t.d, kind: 'misc', stack: 1 });
  rec(t.station, t.inputs, [t.id, 1], { lvl: t.lvl, disc: t.disc, xp: 8, hint: t.d });
}

// ── gear helpers
let GEARS = 0;
function gear(
  id: string,
  name: string,
  cat: 'shield' | 'accessory' | 'pack' | 'light',
  slot: GearSlot,
  level: number,
  bonus: GearBonus,
  dur: number,
  o: {
    g: Parameters<typeof item>[3]['g'];
    a: number;
    b: number;
    d: string;
    v: number;
    rarity?: Rarity;
    mat?: string;
    realm?: string;
  },
): void {
  GEARS++;
  item(id, name, cat, {
    v: o.v,
    g: o.g!,
    a: o.a,
    b: o.b,
    d: o.d,
    rarity: o.rarity ?? 0,
    stack: 1,
    gear: { slot, level, bonus, dur, ...(o.mat ? { mat: o.mat } : {}) },
    ...(o.realm ? { realm: o.realm } : {}),
  });
}
const R = (
  id: string,
  station: StationId,
  inputs: Array<[string, number]>,
  lvl: number,
  disc: Discipline,
  hint: string,
  extra: { tool?: string; learn?: `realm:${string}`; realm?: string } = {},
) => rec(station, inputs, [id, 1], { lvl, disc, xp: 10 + lvl * 3, hint, quality: true, gear: true, ...extra });

// ── shields
gear('wood_shield', 'Wooden Shield', 'shield', 'shield', 1, { def: 0.03, hp: 3 }, 90, {
  g: 'buckler',
  a: C.e4,
  b: C.e5,
  d: 'Planks and a leather grip. It will stop a few blows.',
  v: 40,
});
R(
  'wood_shield',
  'carpenter',
  [
    ['plank', 4],
    ['leather_strap', 2],
    ['nails', 4],
  ],
  1,
  'woodworking',
  'Plank, strap and nails.',
  { tool: 'saw' },
);
gear('oak_buckler', 'Oak Buckler', 'shield', 'shield', 4, { def: 0.04, haste: 0.3 }, 110, {
  g: 'buckler',
  a: C.e5,
  b: C.steel,
  d: 'A small round shield you can move with.',
  v: 85,
  mat: 'oak',
});
R(
  'oak_buckler',
  'carpenter',
  [
    ['oak_plank', 3],
    ['rivets', 4],
    ['leather_strap', 1],
  ],
  4,
  'woodworking',
  'Hardwood rimmed in bronze studs.',
  { tool: 'saw' },
);
gear('tortoise_shield', 'Tortoise Shield', 'shield', 'shield', 8, { def: 0.06, hp: 8 }, 150, {
  g: 'shield',
  a: C.g3,
  b: C.e4,
  d: 'A moss-green shell strapped to a frame. Heavy, but it takes a hit.',
  v: 190,
  rarity: 1,
});
R(
  'tortoise_shield',
  'tannery',
  [
    ['tortoise_shell', 2],
    ['leather', 2],
    ['ironwood_plank', 1],
  ],
  8,
  'leatherworking',
  'Strap the shell to a ironwood frame.',
  { tool: 'needle_kit' },
);
interface ShieldTier {
  metal: string;
  name: string;
  lvl: number;
  def: number;
  extra?: GearBonus;
  a: number;
  b: number;
  rarity: Rarity;
  realm?: string;
  v: number;
}
const SHIELDS: ShieldTier[] = [
  { metal: 'bronze', name: 'Bronze Shield', lvl: 5, def: 0.05, a: C.e3, b: C.e6, rarity: 0, v: 130 },
  { metal: 'iron', name: 'Iron Kite Shield', lvl: 9, def: 0.07, a: C.steel, b: C.pale, rarity: 0, v: 190 },
  {
    metal: 'steel',
    name: 'Steel Heater Shield',
    lvl: 14,
    def: 0.09,
    extra: { hp: 6 },
    a: C.slate,
    b: C.pale,
    rarity: 1,
    v: 300,
  },
  {
    metal: 'skysteel',
    name: 'Skysteel Aegis',
    lvl: 14,
    def: 0.085,
    extra: { haste: 0.6 },
    a: C.w5,
    b: C.e7,
    rarity: 2,
    realm: 'aurelion',
    v: 380,
  },
  {
    metal: 'deepsteel',
    name: 'Deepsteel Tower Shield',
    lvl: 16,
    def: 0.12,
    extra: { hp: 14 },
    a: C.slate,
    b: C.e4,
    rarity: 2,
    realm: 'khardum',
    v: 420,
  },
  {
    metal: 'moonsilver',
    name: 'Moonsilver Targe',
    lvl: 17,
    def: 0.08,
    extra: { luck: 0.6 },
    a: C.q5,
    b: C.white,
    rarity: 2,
    realm: 'sylvaris',
    v: 400,
  },
  {
    metal: 'tidesilver',
    name: 'Tidesilver Scutum',
    lvl: 18,
    def: 0.09,
    extra: { hp: 10, cool: 1 },
    a: C.w3,
    b: C.w7,
    rarity: 2,
    realm: 'thalassara',
    v: 410,
  },
  {
    metal: 'stormiron',
    name: 'Stormiron Round Shield',
    lvl: 19,
    def: 0.09,
    extra: { atk: 2 },
    a: C.w6,
    b: C.e6,
    rarity: 2,
    realm: 'raijin',
    v: 430,
  },
  {
    metal: 'mithril',
    name: 'Mithril Shield',
    lvl: 21,
    def: 0.11,
    extra: { haste: 1 },
    a: C.w4,
    b: C.white,
    rarity: 3,
    v: 620,
  },
  {
    metal: 'hellsteel',
    name: 'Hellsteel Bulwark',
    lvl: 22,
    def: 0.12,
    extra: { atk: 3, warm: 2 },
    a: C.r3,
    b: C.r6,
    rarity: 3,
    realm: 'nethrakar',
    v: 640,
  },
  {
    metal: 'adamant',
    name: 'Adamant Great Shield',
    lvl: 27,
    def: 0.15,
    extra: { hp: 20 },
    a: C.g2,
    b: C.g5,
    rarity: 4,
    v: 980,
  },
  {
    metal: 'voidsteel',
    name: 'Voidsteel Ward',
    lvl: 33,
    def: 0.14,
    extra: { phase: 0.1, atk: 4 },
    a: C.q2,
    b: C.q6,
    rarity: 5,
    v: 1500,
  },
];
for (const s of SHIELDS) {
  const id = `shield_${s.metal}`;
  gear(id, s.name, 'shield', 'shield', s.lvl, { def: s.def, ...s.extra }, 160 + s.lvl * 6, {
    g: 'shield',
    a: s.a,
    b: s.b,
    d: `A shield of ${s.metal}. -${Math.round(s.def * 1000) / 10}% damage taken while worn.`,
    v: s.v,
    rarity: s.rarity,
    mat: s.metal,
    ...(s.realm ? { realm: s.realm } : {}),
  });
  R(
    id,
    'forge',
    [
      [`${s.metal}_plate`, 4],
      ['oak_plank', 1],
      ['leather_strap', 2],
    ],
    s.lvl,
    'smithing',
    `Beat ${s.metal} plate over an oak frame.`,
    { tool: 'tongs', ...(s.realm ? { learn: `realm:${s.realm}` as const, realm: s.realm } : {}) },
  );
}

// ── cloaks and packs (back): the survival slot
gear('traveler_cloak', 'Traveler’s Cloak', 'accessory', 'back', 2, { warm: 2, drain: 0.04 }, 140, {
  g: 'cloak',
  a: C.e3,
  b: C.e5,
  d: 'A thick wool cloak: warm, and the road wears you less.',
  v: 80,
});
R(
  'traveler_cloak',
  'loom',
  [
    ['wool_cloth', 3],
    ['leather_strap', 1],
  ],
  2,
  'tailoring',
  'Cut and hem a wool cloak.',
  { tool: 'needle_kit' },
);
gear('linen_mantle', 'Linen Mantle', 'accessory', 'back', 3, { cool: 3, drain: 0.03 }, 120, {
  g: 'cloak',
  a: C.pale,
  b: C.w6,
  d: 'Light, pale and breathable. Beats the desert sun.',
  v: 90,
});
R(
  'linen_mantle',
  'loom',
  [
    ['linen_cloth', 3],
    ['linen_thread', 2],
  ],
  3,
  'tailoring',
  'Hem a light mantle.',
  { tool: 'needle_kit' },
);
gear('fur_cloak', 'Trapper’s Fur Cloak', 'accessory', 'back', 6, { warm: 5, hp: 6 }, 150, {
  g: 'cloak',
  a: C.e4,
  b: C.e2,
  d: 'Heavy furs worn against blizzards.',
  v: 170,
  rarity: 1,
});
R(
  'fur_cloak',
  'tannery',
  [
    ['pelt', 4],
    ['leather_strap', 2],
  ],
  6,
  'leatherworking',
  'Stitch pelts into a cloak.',
  { tool: 'needle_kit' },
);
gear('silk_cape', 'Silk Cape', 'accessory', 'back', 10, { luck: 0.8, haste: 0.5, cool: 2 }, 130, {
  g: 'cloak',
  a: C.q4,
  b: C.e7,
  d: 'Light as a breath, bright as a banner.',
  v: 280,
  rarity: 2,
});
R(
  'silk_cape',
  'loom',
  [
    ['silk_cloth', 3],
    ['silk_thread', 2],
    ['dye_violet', 1],
  ],
  10,
  'tailoring',
  'Cut silk on the bias.',
  { tool: 'needle_kit' },
);
gear('shadow_cloak', 'Shadow Cloak', 'accessory', 'back', 18, { phase: 0.05, haste: 1, luck: 0.5 }, 160, {
  g: 'cloak',
  a: C.night,
  b: C.q3,
  d: 'It drinks the light around you.',
  v: 520,
  rarity: 3,
});
R(
  'shadow_cloak',
  'tannery',
  [
    ['thick_leather', 3],
    ['dye_black', 2],
    ['bat_wing', 3],
  ],
  18,
  'leatherworking',
  'Dark leather lined with bat wing.',
  { tool: 'needle_kit' },
);
gear('wyrm_cloak', 'Wyrmhide Cloak', 'accessory', 'back', 22, { def: 0.05, warm: 3, hp: 12 }, 220, {
  g: 'cloak',
  a: C.r4,
  b: C.e5,
  d: 'A cloak of scaled hide that sheds fire and frost.',
  v: 780,
  rarity: 4,
});
R(
  'wyrm_cloak',
  'tannery',
  [
    ['wyrm_leather', 2],
    ['scale_leather', 1],
  ],
  22,
  'leatherworking',
  'Line wyrm hide with scale leather.',
  { tool: 'needle_kit' },
);
gear('moonweave_mantle', 'Moonweave Mantle', 'accessory', 'back', 15, { luck: 2, phase: 0.04, cool: 2, warm: 2 }, 180, {
  g: 'cloak',
  a: C.q5,
  b: C.white,
  d: 'A mantle that shimmers like moonlight on water.',
  v: 650,
  rarity: 3,
  realm: 'sylvaris',
});
R(
  'moonweave_mantle',
  'loom',
  [
    ['moonweave', 3],
    ['silk_thread', 3],
  ],
  15,
  'tailoring',
  'Cut moonweave into a mantle.',
  { tool: 'needle_kit', learn: 'realm:sylvaris', realm: 'sylvaris' },
);
gear('traveler_pack', 'Traveler’s Pack', 'pack', 'back', 3, { drain: 0.08, stamina: 8 }, 160, {
  g: 'backpack',
  a: C.e4,
  b: C.e6,
  d: 'Well-stitched straps spread the load. You tire and hunger less.',
  v: 110,
});
R(
  'traveler_pack',
  'tannery',
  [
    ['leather', 4],
    ['canvas', 2],
    ['leather_strap', 3],
  ],
  3,
  'leatherworking',
  'Stitch a canvas-and-leather pack.',
  { tool: 'needle_kit' },
);
gear('explorer_pack', 'Explorer’s Rucksack', 'pack', 'back', 10, { drain: 0.15, stamina: 20 }, 220, {
  g: 'backpack',
  a: C.g3,
  b: C.e5,
  d: 'Frame, hip belt and oiled canvas: made for long wilderness trips.',
  v: 360,
  rarity: 1,
});
R(
  'explorer_pack',
  'tannery',
  [
    ['thick_leather', 3],
    ['canvas', 3],
    ['bamboo_plank', 2],
    ['rivets', 8],
  ],
  10,
  'leatherworking',
  'A framed pack for long trips.',
  { tool: 'needle_kit' },
);
gear('delver_pack', 'Delver’s Pack', 'pack', 'back', 14, { drain: 0.1, stamina: 14, light: 3 }, 220, {
  g: 'backpack',
  a: C.slate,
  b: C.e6,
  d: 'A miner’s pack with a lamp bracket. Gives a little light underground.',
  v: 420,
  rarity: 2,
});
R(
  'delver_pack',
  'tannery',
  [
    ['thick_leather', 3],
    ['iron_plate', 2],
    ['canvas', 2],
    ['glow_gland', 1],
  ],
  14,
  'leatherworking',
  'A pack with a lamp and iron bracing.',
  { tool: 'needle_kit' },
);

// ── amulets (neck): one gem, one stat
const NECK: Array<[string, string, string, GearBonus, number, number, number, Rarity]> = [
  // gem id, name, blurb, bonus, lvl, a, b, rarity
  ['amethyst', 'Amethyst Amulet', 'Calms the mind.', { hp: 18, stamina: 4 }, 6, C.q4, C.q6, 1],
  ['topaz', 'Topaz Amulet', 'Quickens the step.', { haste: 1.2 }, 7, C.e6, C.e7, 1],
  ['garnet', 'Garnet Amulet', 'Sharpens the blade arm.', { atk: 3 }, 7, C.r3, C.r5, 1],
  ['ruby', 'Ruby Amulet', 'Burns with a quiet fury.', { atk: 6, warm: 2 }, 11, C.r4, C.r6, 2],
  ['sapphire', 'Sapphire Amulet', 'Steadies the wearer in any weather.', { hp: 28, cool: 2 }, 11, C.w3, C.w6, 2],
  ['emerald', 'Emerald Amulet', 'A deep green charm for luck.', { luck: 2.5 }, 11, C.g4, C.g6, 2],
  ['onyx', 'Onyx Amulet', 'Turns away harm.', { def: 0.04, hp: 10 }, 10, C.night, C.slate, 2],
  ['opal', 'Opal Amulet', 'Always a little different.', { luck: 2, haste: 1.2 }, 15, C.w6, C.q5, 3],
  ['moonstone', 'Moonstone Amulet', 'Quiet, quick and hard to hit.', { haste: 1.8, phase: 0.04 }, 15, C.pale, C.q6, 3],
  ['sunstone', 'Sunstone Amulet', 'Warm to hold and fierce to wear.', { atk: 8, warm: 3 }, 15, C.e7, C.e6, 3],
  [
    'diamond',
    'Diamond Amulet',
    'Hard as truth. Wearers cut deeper.',
    { atk: 10, def: 0.05, luck: 1 },
    20,
    C.white,
    C.w6,
    4,
  ],
];
for (const [gem, name, blurb, bonus, lvl, a, b, rarity] of NECK) {
  const id = `amulet_${gem}`;
  gear(id, name, 'accessory', 'neck', lvl, bonus, 200, {
    g: 'amulet',
    a,
    b,
    d: `${blurb} A cut ${gem} on a gold chain.`,
    v: 160 + rarity * 140,
    rarity,
    mat: gem,
  });
  R(
    id,
    'jeweler',
    [
      [`${gem}_cut`, 1],
      ['gold_wire', 3],
      ['gold_ingot', 1],
    ],
    lvl,
    'smithing',
    `Hang a ${gem} on a gold chain.`,
    { tool: 'loupe' },
  );
}
gear('warding_amulet', 'Warding Amulet', 'accessory', 'neck', 8, { def: 0.05, hp: 8 }, 220, {
  g: 'amulet',
  a: C.pale,
  b: C.w6,
  d: 'A silver disc etched with a ward-rune.',
  v: 240,
  rarity: 1,
});
R(
  'warding_amulet',
  'jeweler',
  [
    ['silver_plate', 1],
    ['silver_wire', 2],
    ['rune_ward', 1],
  ],
  8,
  'smithing',
  'Engrave a ward rune on a silver disc.',
  { tool: 'loupe' },
);

// ── belts
gear('leather_belt', 'Leather Belt', 'accessory', 'belt', 1, { hp: 5, stamina: 4 }, 100, {
  g: 'belt',
  a: C.e4,
  b: C.steel,
  d: 'A broad belt with a sturdy buckle.',
  v: 36,
});
R(
  'leather_belt',
  'tannery',
  [
    ['leather', 2],
    ['rivets', 2],
  ],
  1,
  'leatherworking',
  'Cut, rivet and buckle.',
  { tool: 'needle_kit' },
);
gear('toolbelt', 'Crafter’s Toolbelt', 'accessory', 'belt', 5, { craft: 6, stamina: 5 }, 160, {
  g: 'belt',
  a: C.e3,
  b: C.e6,
  d: 'Loops and pouches for every tool. 6% chance to save an ingredient.',
  v: 150,
  rarity: 1,
});
R(
  'toolbelt',
  'tannery',
  [
    ['thick_leather', 2],
    ['rivets', 8],
    ['leather_strap', 3],
  ],
  5,
  'leatherworking',
  'A belt for the working hands.',
  { tool: 'needle_kit' },
);
gear('adventurer_belt', 'Adventurer’s Belt', 'accessory', 'belt', 8, { stamina: 15, drain: 0.06, hp: 8 }, 200, {
  g: 'belt',
  a: C.g3,
  b: C.e6,
  d: 'A canteen loop, pouches and a knife sheath.',
  v: 220,
  rarity: 1,
});
R(
  'adventurer_belt',
  'tannery',
  [
    ['thick_leather', 2],
    ['hemp_rope', 1],
    ['bronze_plate', 1],
  ],
  8,
  'leatherworking',
  'A belt for the long road.',
  { tool: 'needle_kit' },
);
gear('warrior_girdle', 'Warrior’s Girdle', 'accessory', 'belt', 12, { hp: 22, atk: 3, def: 0.02 }, 240, {
  g: 'belt',
  a: C.steel,
  b: C.e6,
  d: 'Iron plates riveted on leather.',
  v: 360,
  rarity: 2,
});
R(
  'warrior_girdle',
  'forge',
  [
    ['iron_plate', 3],
    ['thick_leather', 2],
    ['rivets', 8],
  ],
  12,
  'smithing',
  'A plated girdle.',
  { tool: 'tongs' },
);
gear('mountain_girdle', 'Girdle of the Mountain', 'accessory', 'belt', 16, { hp: 32, def: 0.04 }, 260, {
  g: 'belt',
  a: C.slate,
  b: C.e5,
  d: 'Khardum smiths make these for their guard.',
  v: 520,
  rarity: 2,
  realm: 'khardum',
});
R(
  'mountain_girdle',
  'forge',
  [
    ['deepsteel_plate', 3],
    ['thick_leather', 2],
    ['granite_block', 1],
  ],
  16,
  'smithing',
  'Khardum’s guard-girdle.',
  { tool: 'tongs', learn: 'realm:khardum', realm: 'khardum' },
);
gear('silk_sash', 'Silk Sash', 'accessory', 'belt', 9, { haste: 1.2, luck: 0.6, cool: 1 }, 140, {
  g: 'belt',
  a: C.q4,
  b: C.e6,
  d: 'A bright sash that catches the eye and the wind.',
  v: 240,
  rarity: 1,
});
R(
  'silk_sash',
  'loom',
  [
    ['silk_cloth', 2],
    ['dye_red', 1],
    ['silk_thread', 1],
  ],
  9,
  'tailoring',
  'Dye and fringe a silk sash.',
  { tool: 'needle_kit' },
);

// ── lights: held at night and underground; wear out and are refuelled with lamp oil
gear('torch_hand', 'Hand Torch', 'light', 'light', 1, { light: 4 }, 60, {
  g: 'torch',
  a: C.r5,
  b: C.e7,
  d: 'A pitch-soaked brand. Smoky, but it holds the dark off.',
  v: 12,
});
rec(
  'workbench',
  [
    ['wood', 1],
    ['resin', 1],
    ['cloth', 1],
  ],
  ['torch_hand', 2],
  { lvl: 1, disc: 'woodworking', xp: 3, hint: 'Wrap a stick in oiled cloth.', gear: true },
);
gear('oil_lantern', 'Oil Lantern', 'light', 'light', 3, { light: 6 }, 200, {
  g: 'lantern',
  a: C.e5,
  b: C.e7,
  d: 'A tin lantern with a glass chimney.',
  v: 90,
});
R(
  'oil_lantern',
  'engineering',
  [
    ['tin_plate', 1],
    ['glass_pane', 1],
    ['lamp_oil', 1],
    ['rivets', 2],
  ],
  3,
  'engineering',
  'A tin lantern with a glass chimney.',
);
gear('brass_lantern', 'Brass Lantern', 'light', 'light', 8, { light: 7 }, 320, {
  g: 'lantern',
  a: C.e5,
  b: C.e7,
  d: 'A hooded brass lamp that burns steadily and cleanly.',
  v: 220,
  rarity: 1,
});
R(
  'brass_lantern',
  'engineering',
  [
    ['bronze_plate', 2],
    ['glass_pane', 1],
    ['lens', 1],
    ['lamp_oil', 2],
  ],
  8,
  'engineering',
  'A lensed brass lamp.',
);
gear('miner_lantern', 'Miner’s Lantern', 'light', 'light', 10, { light: 8, stamina: 5 }, 420, {
  g: 'lantern',
  a: C.steel,
  b: C.e7,
  d: 'Shielded and sturdy; built for the deep.',
  v: 340,
  rarity: 1,
});
R(
  'miner_lantern',
  'engineering',
  [
    ['iron_plate', 2],
    ['lens', 1],
    ['fire_oil', 1],
    ['hemp_rope', 1],
  ],
  10,
  'engineering',
  'An iron lantern with a lens.',
);
gear('glow_lantern', 'Glowgland Lantern', 'light', 'light', 12, { light: 8 }, 600, {
  g: 'lantern',
  a: C.e6,
  b: C.white,
  d: 'Runs on a living gland, no oil. Warm and steady.',
  v: 420,
  rarity: 2,
});
R(
  'glow_lantern',
  'engineering',
  [
    ['steel_plate', 1],
    ['glass_pane', 2],
    ['glow_gland', 2],
  ],
  12,
  'engineering',
  'A lantern lit by a living gland.',
);
gear('crystal_lantern', 'Crystal Lantern', 'light', 'light', 16, { light: 10, luck: 0.5 }, 700, {
  g: 'lantern',
  a: C.q5,
  b: C.white,
  d: 'A prism crystal in a silver cage. It lights the whole cave.',
  v: 760,
  rarity: 3,
});
R(
  'crystal_lantern',
  'engineering',
  [
    ['silver_plate', 2],
    ['prism_crystal', 1],
    ['crystal_lens_focus', 1],
  ],
  16,
  'engineering',
  'Cage a prism crystal in silver.',
);

// ── repair and upkeep
item('repair_kit', 'Repair Kit', 'tool', {
  v: 70,
  g: 'kit',
  a: C.e5,
  b: C.steel,
  d: 'Patches and rivets for gear in the field. Restores 40% durability of one worn weapon or armour piece.',
  kind: 'misc',
  use: { t: 'repair', pct: 40, kinds: ['weapon', 'armor', 'gear'], tier: 1 },
});
rec(
  'workbench',
  [
    ['iron_rod', 1],
    ['leather_strap', 2],
    ['rivets', 6],
    ['cloth', 1],
  ],
  ['repair_kit', 1],
  { lvl: 3, disc: 'engineering', xp: 8, hint: 'Rivets, patches and straps in a roll.' },
);
item('master_repair_kit', 'Master Repair Kit', 'tool', {
  v: 240,
  g: 'kit',
  a: C.e6,
  b: C.white,
  d: 'Fine tools and spare plate. Restores 100% durability of one piece.',
  kind: 'misc',
  rarity: 2,
  use: { t: 'repair', pct: 100, kinds: ['weapon', 'armor', 'gear'], tier: 2 },
});
rec(
  'workbench',
  [
    ['steel_plate', 1],
    ['thick_leather', 1],
    ['rivets', 10],
    ['repair_kit', 1],
  ],
  ['master_repair_kit', 1],
  { lvl: 12, disc: 'engineering', xp: 24, hint: 'A full field smithy in a satchel.' },
);
item('whetstone', 'Whetstone', 'tool', {
  v: 28,
  g: 'whetstone',
  a: C.slate,
  b: C.mist,
  d: 'Hone a blade: +6 attack for five minutes.',
  kind: 'misc',
  use: { t: 'whetstone', atk: 6, secs: 300 },
});
rec(
  'masonry',
  [
    ['granite', 1],
    ['flint', 1],
  ],
  ['whetstone', 2],
  { lvl: 2, disc: 'masonry', xp: 4, hint: 'Grind flint on granite.', tool: 'chisel' },
);
// ── the three realms (otherworlds.ts): each realm's gear is woven from what grows there and what its guardian guards
item('cloud_silk', 'Cloud-Silk', 'reagent', {
  v: 60,
  g: 'spool',
  a: C.white,
  b: C.w5,
  d: 'Threads spun from Aetherian cloud. Weighs nothing; holds anything.',
  src: [src.mob('zephyr_ray', 0.7, 1, 2, { realm: 'aetheria' }), src.mob('gilded_sentinel', 0.4)],
});
item('umbral_spore', 'Umbral Spore', 'reagent', {
  v: 70,
  g: 'dust',
  a: C.q4,
  b: C.w6,
  d: 'Spores that glow in the dark of the Abyss and hold it back a little.',
  src: [src.mob('shade_stalker', 0.7, 1, 2, { realm: 'umbra' }), src.mob('abyss_serpent', 0.8, 1, 3)],
});
item('chrono_sand', 'Chrono-Sand', 'reagent', {
  v: 80,
  g: 'dust',
  a: C.e6,
  b: C.mist,
  d: 'Sand from Chronoria that falls upward when nobody is watching.',
  src: [src.mob('gear_hound', 0.7, 1, 2, { realm: 'chronoria' }), src.mob('paradox_echo', 0.8, 1, 3)],
});
item('phoenix_plume', 'Phoenix Plume', 'reagent', {
  v: 600,
  g: 'wing',
  a: C.r5,
  b: C.e7,
  d: 'A feather of the Phoenix of the Eyrie, still burning without heat.',
  src: [src.boss('phoenix')],
});
item('abyss_heart', 'Heart of the Maw', 'monster', {
  v: 650,
  g: 'heart',
  a: C.q3,
  b: C.w6,
  d: 'It never stops beating, and gives off a light the dark cannot touch.',
  src: [src.boss('umbral_maw')],
});
item('unwound_gear', 'Unwound Gear', 'reagent', {
  v: 700,
  g: 'cog',
  a: C.e6,
  b: C.white,
  d: 'A cog from the Unwound. It turns both ways at once.',
  src: [src.boss('the_unwound')],
});
gear('aether_wings', 'Aether Wings', 'accessory', 'back', 10, { haste: 2, phase: 0.05, cool: 1 }, 260, {
  g: 'wing',
  a: C.white,
  b: C.r5,
  d: 'Cloud-silk wings with a phoenix plume at the heart: you move as if the wind were behind you.',
  v: 900,
  rarity: 3,
});
R(
  'aether_wings',
  'loom',
  [
    ['cloud_silk', 6],
    ['phoenix_plume', 1],
  ],
  10,
  'tailoring',
  'Weave cloud-silk around a living plume.',
);
gear('umbral_lantern', 'Umbral Lantern', 'light', 'light', 12, { light: 9 }, 400, {
  g: 'lantern',
  a: C.q4,
  b: C.w6,
  d: 'Lit by the Heart of the Maw. Its light is wide, and the dark of the Abyss will not touch whoever carries it.',
  v: 950,
  rarity: 3,
});
R(
  'umbral_lantern',
  'engineering',
  [
    ['umbral_spore', 6],
    ['abyss_heart', 1],
    ['aetherium_plate', 1],
  ],
  12,
  'engineering',
  'Cage the Heart in glass and spore.',
);
gear('chrono_charm', 'Chrono Charm', 'accessory', 'charm', 14, { haste: 2.5, luck: 3, stamina: 15 }, 300, {
  g: 'charm',
  a: C.e6,
  b: C.mist,
  d: 'An Unwound gear set in sand that falls upward: every moment lasts a little longer for you.',
  v: 1000,
  rarity: 3,
});
R(
  'chrono_charm',
  'jeweler',
  [
    ['chrono_sand', 6],
    ['unwound_gear', 1],
    ['umbrite_rod', 1],
  ],
  14,
  'enchanting',
  'Set the gear in a cage of moving sand.',
);
// ── realm accessories: each realm's people teach them, from that realm's metal, beasts and its champions' trophies
gear('storm_buckler', 'Storm Buckler', 'shield', 'shield', 11, { def: 0.06, haste: 1 }, 220, {
  g: 'buckler',
  a: C.pale,
  b: C.w5,
  d: 'An Aerin skyguard’s buckler, edged with storm feathers. It turns blows like wind turns a leaf.',
  v: 420,
  rarity: 2,
});
R(
  'storm_buckler',
  'forge',
  [
    ['aetherium_plate', 2],
    ['storm_feather', 3],
  ],
  11,
  'smithing',
  'Aetherium rim, feathered edge.',
  { tool: 'tongs', learn: 'realm:aerin', realm: 'aerin' },
);
gear('aerin_circlet', 'Aerin Circlet', 'accessory', 'neck', 12, { luck: 1.5, haste: 1, cool: 1 }, 200, {
  g: 'amulet',
  a: C.e7,
  b: C.w6,
  d: 'A band of aetherium set with sky amber, worn by the Aerin who ride the high winds.',
  v: 460,
  rarity: 2,
});
R(
  'aerin_circlet',
  'jeweler',
  [
    ['aetherium_rod', 1],
    ['sky_amber', 2],
    ['sentinel_gilding', 1],
  ],
  12,
  'enchanting',
  'Bend the rod; seat the amber.',
  { learn: 'realm:aerin', realm: 'aerin' },
);
gear('windcaller_mantle', 'Windcaller Mantle', 'accessory', 'back', 13, { haste: 2, phase: 0.04, luck: 1 }, 240, {
  g: 'cloak',
  a: C.w4,
  b: C.white,
  d: 'Sewn from cloud-silk around a reaver captain’s compass: the wind finds you before you find it.',
  v: 700,
  rarity: 3,
});
R(
  'windcaller_mantle',
  'loom',
  [
    ['cloud_silk', 4],
    ['captains_compass', 1],
  ],
  13,
  'tailoring',
  'Stitch the compass into the collar.',
  { learn: 'realm:aerin', realm: 'aerin' },
);
gear('hollow_cloak', 'Hollow Cloak', 'accessory', 'back', 14, { warm: 3, def: 0.04, hp: 10 }, 260, {
  g: 'cloak',
  a: C.night,
  b: C.q4,
  d: 'A Hollowfolk cloak of shade pelt. Warm in the deep cold, and the dark does not see you so easily.',
  v: 600,
  rarity: 2,
});
R(
  'hollow_cloak',
  'tannery',
  [
    ['shade_pelt', 4],
    ['umbrite_rod', 1],
  ],
  14,
  'leatherworking',
  'Cure the pelt; clasp it with umbrite.',
  { tool: 'needle_kit', learn: 'realm:hollowfolk', realm: 'hollowfolk' },
);
gear('serpentscale_buckler', 'Serpentscale Buckler', 'shield', 'shield', 15, { def: 0.08, hp: 8 }, 280, {
  g: 'shield',
  a: C.fog,
  b: C.q4,
  d: 'Abyssal scales laid over umbrite. Cold to hold, colder to strike.',
  v: 640,
  rarity: 2,
});
R(
  'serpentscale_buckler',
  'tannery',
  [
    ['serpent_scale', 4],
    ['umbrite_plate', 1],
  ],
  15,
  'leatherworking',
  'Overlap the scales like the serpent wore them.',
  { tool: 'needle_kit', learn: 'realm:hollowfolk', realm: 'hollowfolk' },
);
gear('gloamward_charm', 'Gloamward Charm', 'accessory', 'charm', 15, { def: 0.05, hp: 12, warm: 1 }, 260, {
  g: 'charm',
  a: C.q2,
  b: C.q6,
  d: 'A void pearl set in the Hierophant’s broken mask. Curses and blows alike find less of you.',
  v: 760,
  rarity: 3,
});
R(
  'gloamward_charm',
  'jeweler',
  [
    ['void_pearl', 2],
    ['hierophant_mask', 1],
    ['gloam_sigil', 3],
  ],
  15,
  'enchanting',
  'Break the mask; keep the part that was looking.',
  { learn: 'realm:hollowfolk', realm: 'hollowfolk' },
);
gear('archivist_lenses', 'Archivist’s Lenses', 'accessory', 'neck', 17, { craft: 12, luck: 2 }, 220, {
  g: 'amulet',
  a: C.e7,
  b: C.mist,
  d: 'Temporal crystal ground into lenses: you see how a thing was made, and how it might be made with less.',
  v: 720,
  rarity: 3,
});
R(
  'archivist_lenses',
  'jeweler',
  [
    ['temporal_crystal', 2],
    ['chronium_rod', 1],
  ],
  17,
  'enchanting',
  'Grind the crystal against its own grain.',
  { learn: 'realm:archivists', realm: 'archivists' },
);
gear('clockwork_belt', 'Clockwork Belt', 'accessory', 'belt', 17, { stamina: 20, haste: 1 }, 260, {
  g: 'belt',
  a: C.e5,
  b: C.steel,
  d: 'Gear-hound springs wound into a belt: every step stores a little for the next sprint.',
  v: 680,
  rarity: 2,
});
R(
  'clockwork_belt',
  'engineering',
  [
    ['clockwork_spring', 4],
    ['chronium_rod', 1],
  ],
  17,
  'engineering',
  'Wind the springs against each other.',
  { learn: 'realm:archivists', realm: 'archivists' },
);
gear('paradox_aegis', 'Paradox Aegis', 'shield', 'shield', 18, { def: 0.07, phase: 0.08, hp: 10 }, 320, {
  g: 'shield',
  a: C.e7,
  b: C.q5,
  d: 'A chronium shield set with the Warlord’s sigil. Half the blows meant for you strike it a moment too late.',
  v: 900,
  rarity: 3,
});
R(
  'paradox_aegis',
  'forge',
  [
    ['chronium_plate', 2],
    ['echo_shard', 3],
    ['warlord_sigil', 1],
    ['sundered_seal', 3],
  ],
  18,
  'smithing',
  'Forge it twice; keep the second.',
  { tool: 'tongs', learn: 'realm:archivists', realm: 'archivists' },
);
void GEARS;
