import { T } from '../tiles';
import { COL as C, item, rec, src } from './kit';

/**
 * What the three realms give (otherworlds.ts): each realm's creatures, its hostile people and its rocks yield their own
 * materials; its neutral people teach the remedies and meals made from them (their recipes need standing with that
 * people, realmfolk.ts); and each hostile people's champion carries a trophy the best realm gear is built around.
 * Realm gear itself (metals, plate, weapons, accessories) is in metals.ts, armor.ts, gear.ts and gear-items.ts.
 */

// ───────── Aetheria: the Aerin (neutral) and the Gale Reavers (hostile)
item('zephyr_scale', 'Zephyr Scale', 'monster', {
  v: 55,
  g: 'scale',
  a: C.w5,
  b: C.white,
  d: 'A ray’s scale that crackles faintly with static.',
  src: [src.mob('zephyr_ray', 0.6, 1, 2)],
});
item('sentinel_gilding', 'Sentinel Gilding', 'monster', {
  v: 90,
  g: 'plate',
  a: C.e6,
  b: C.e7,
  d: 'Gold leaf peeled from a sky-temple guardian. Still warm with purpose.',
  src: [src.mob('gilded_sentinel', 0.6, 1, 2)],
});
item('storm_feather', 'Storm Feather', 'monster', {
  v: 60,
  g: 'wing',
  a: C.w3,
  b: C.w6,
  d: 'A Gale Reaver’s flight-feather. The Aerin pay well to see them grounded.',
  src: [src.mob('gale_reaver', 0.5, 1, 2), src.mob('gale_gunner', 0.5, 1, 2)],
});
item('sky_amber', 'Sky Amber', 'gem', {
  v: 70,
  g: 'nugget',
  a: C.e5,
  b: C.e7,
  d: 'Golden resin from the floating isles’ roots, with a bubble of old sky inside.',
  src: [src.node(T.ROCK, 1, 1, 0.35, 1, { realm: 'aetheria' })],
});
item('captains_compass', 'Reaver Captain’s Compass', 'collectible', {
  v: 500,
  g: 'compass',
  a: C.e6,
  b: C.w6,
  d: 'It points to wherever the wind is going next. The Gale Reavers steered by nothing else.',
  src: [src.mob('gale_captain', 1)],
});

// ───────── the Umbral Abyss: the Hollowfolk (neutral) and the Gloamkin (hostile)
item('shade_pelt', 'Shade Pelt', 'monster', {
  v: 70,
  g: 'pelt',
  a: C.night,
  b: C.q3,
  d: 'A stalker’s hide. It is darker than its colour should allow.',
  src: [src.mob('shade_stalker', 0.6, 1, 2)],
});
item('serpent_scale', 'Abyssal Scale', 'monster', {
  v: 80,
  g: 'scale',
  a: C.fog,
  b: C.w6,
  d: 'A pale scale from the deep pools, cold as the water it came from.',
  src: [src.mob('abyss_serpent', 0.6, 1, 2)],
});
item('gloam_sigil', 'Gloam Sigil', 'monster', {
  v: 65,
  g: 'rune',
  a: C.q2,
  b: C.r5,
  d: 'A cultist’s token of the Maw. The Hollowfolk burn them, and thank whoever brings them.',
  src: [src.mob('gloam_zealot', 0.5, 1, 1), src.mob('gloam_hexer', 0.6, 1, 2)],
});
item('void_pearl', 'Void Pearl', 'gem', {
  v: 120,
  g: 'crystal',
  a: C.q2,
  b: C.q6,
  d: 'A pearl of solid dark grown in the crystal seams of the Abyss.',
  src: [src.node(T.CAVE_CRYSTAL, 1, 1, 0.3, 2, { realm: 'umbra' })],
});
item('hierophant_mask', 'Hierophant’s Mask', 'collectible', {
  v: 550,
  g: 'relic',
  a: C.night,
  b: C.q6,
  d: 'The Gloam Hierophant’s mask of black glass. Behind it, they say, was nothing at all.',
  src: [src.mob('gloam_hierophant', 1)],
});

// ───────── Chronoria: the Archivists (neutral) and the Sundered (hostile)
item('clockwork_spring', 'Clockwork Spring', 'monster', {
  v: 85,
  g: 'coil',
  a: C.e5,
  b: C.steel,
  d: 'The mainspring of a gear hound, still trying to wind itself.',
  src: [src.mob('gear_hound', 0.6, 1, 2)],
});
item('echo_shard', 'Echo Shard', 'monster', {
  v: 95,
  g: 'shard',
  a: C.q5,
  b: C.w6,
  d: 'A sliver of a moment that did not happen. You can hear it, if you hold it to your ear.',
  src: [src.mob('paradox_echo', 0.6, 1, 2)],
});
item('sundered_seal', 'Sundered Seal', 'monster', {
  v: 90,
  g: 'rune',
  a: C.e6,
  b: C.q4,
  d: 'The broken seal of a Sundered raider. The Archivists keep a record of every one returned.',
  src: [src.mob('sundered_blade', 0.5, 1, 1), src.mob('sundered_seer', 0.6, 1, 2)],
});
item('temporal_crystal', 'Temporal Crystal', 'gem', {
  v: 140,
  g: 'crystal',
  a: C.mist,
  b: C.q5,
  d: 'A crystal that grew backwards from its own future shape.',
  src: [src.node(T.CRYSTAL, 1, 1, 0.35, 2, { realm: 'chronoria' })],
});
item('warlord_sigil', 'Sundered Warlord’s Sigil', 'collectible', {
  v: 600,
  g: 'trophy',
  a: C.e7,
  b: C.q5,
  d: 'The sigil of a warlord who fought every battle twice and lost the second time.',
  src: [src.mob('sundered_warlord', 1)],
});

// ───────── remedies and meals the realm peoples teach (their recipes need that people's standing)
item('skyfeather_tonic', 'Skyfeather Tonic', 'potion', {
  v: 140,
  g: 'vial',
  a: C.w5,
  b: C.white,
  d: 'An Aerin tonic: your feet barely touch the ground.',
  buff: { kind: 'swift', secs: 300, power: 1.5 },
});
rec(
  'alchemy',
  [
    ['storm_feather', 1],
    ['zephyr_scale', 1],
    ['healing_herb', 1],
  ],
  ['skyfeather_tonic', 2],
  { lvl: 8, learn: 'realm:aerin', realm: 'aerin', hint: 'Feather and scale steeped with herb.' },
);
item('aerin_honeycake', 'Aerin Honeycake', 'dish', {
  v: 120,
  g: 'cake',
  a: C.e6,
  b: C.white,
  d: 'Cloud-light cake sweetened with sky amber. A long rest in every slice.',
  heal: 45,
  buff: { kind: 'regen', secs: 300, power: 1.4 },
});
rec(
  'oven',
  [
    ['sky_amber', 1],
    ['wheat', 2],
    ['egg', 1],
  ],
  ['aerin_honeycake', 2],
  { lvl: 8, learn: 'realm:aerin', realm: 'aerin', hint: 'Amber honey folded through a light batter.' },
);
item('gloamward_draught', 'Gloamward Draught', 'potion', {
  v: 180,
  g: 'flask',
  a: C.q3,
  b: C.w6,
  d: 'A Hollowfolk draught: the dark finds you harder to hold, and curses slide off.',
  buff: { kind: 'ward', secs: 600, power: 0.2 },
  cure: ['curse'],
});
rec(
  'alchemy',
  [
    ['void_pearl', 1],
    ['umbral_spore', 2],
  ],
  ['gloamward_draught', 2],
  { lvl: 12, learn: 'realm:hollowfolk', realm: 'hollowfolk', hint: 'A pearl of dark dissolved in glowing spores.' },
);
item('glowcap_stew', 'Glowcap Stew', 'dish', {
  v: 130,
  g: 'pot_stew',
  a: C.q4,
  b: C.e5,
  d: 'Hollow stew that glows faintly in the bowl. You see further in the dark for a long while after.',
  heal: 55,
  buff: { kind: 'lantern', secs: 600, power: 1 },
});
rec(
  'cooking_pot',
  [
    ['umbral_spore', 2],
    ['raw_meat', 1],
  ],
  ['glowcap_stew', 2],
  { lvl: 12, learn: 'realm:hollowfolk', realm: 'hollowfolk', hint: 'Spores and meat, simmered slow.' },
);
item('chrono_tea', 'Chrono Tea', 'drink', {
  v: 160,
  g: 'teapot',
  a: C.e6,
  b: C.mist,
  d: 'Archivist tea brewed with a pinch of upward sand. The afternoon goes on and on.',
  heal: 20,
  buff: { kind: 'swift', secs: 420, power: 2 },
});
rec(
  'cooking_pot',
  [
    ['chrono_sand', 1],
    ['healing_herb', 1],
  ],
  ['chrono_tea', 2],
  { lvl: 15, learn: 'realm:archivists', realm: 'archivists', hint: 'Steep the herb; stir the sand counter-clockwise.' },
);
item('rewind_elixir', 'Rewind Elixir', 'potion', {
  v: 320,
  g: 'vial',
  a: C.mist,
  b: C.q5,
  d: 'Undo the last few wounds. Every ailment you had a minute ago is gone, and most of the damage too.',
  heal: 120,
  cure: ['bleed', 'poison', 'burn', 'frostbite', 'fracture', 'curse', 'fever', 'gut_rot', 'ague', 'grave_rot'],
});
rec(
  'alchemy',
  [
    ['echo_shard', 1],
    ['temporal_crystal', 1],
  ],
  ['rewind_elixir', 1],
  { lvl: 16, learn: 'realm:archivists', realm: 'archivists', hint: 'An echo and a crystal, out of order.' },
);
item('paradox_brew', 'Paradox Brew', 'potion', {
  v: 200,
  g: 'flask',
  a: C.q5,
  b: C.e7,
  d: 'Luck that has not happened yet, borrowed in advance.',
  buff: { kind: 'fortune', secs: 600, power: 3 },
});
rec(
  'alchemy',
  [
    ['echo_shard', 1],
    ['chrono_sand', 1],
  ],
  ['paradox_brew', 1],
  { lvl: 15, learn: 'realm:archivists', realm: 'archivists', hint: 'Shake it before you make it.' },
);
