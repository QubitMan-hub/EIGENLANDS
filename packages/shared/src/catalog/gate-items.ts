import { COL as C, item, rec, src } from './kit';

/**
 * What the dungeon gates (gates.ts) pay out: mana stones, the crystallised power of a gate's master, in three grades
 * by the gate's rank. Hunters sell them for coin or brew them into the strongest restoratives in the game.
 * (A stray stone now and then turns up on the monsters that haunt the gates in the wild, too.)
 */
item('lesser_mana_stone', 'Lesser Mana Stone', 'gem', {
  v: 60,
  g: 'crystal',
  a: C.w4,
  b: C.w6,
  d: 'A pale blue stone from an E- or D-rank gate, faintly warm. Merchants buy them by the handful.',
  src: [src.mob('goblin', 0.04, 1, 1), src.mob('bandit', 0.04, 1, 1)],
});
item('mana_stone', 'Mana Stone', 'gem', {
  v: 180,
  g: 'crystal',
  a: C.q4,
  b: C.w6,
  d: 'A violet stone from a C- or B-rank gate. It hums against your palm.',
  src: [src.mob('troll', 0.05, 1, 1), src.mob('rogue_mage', 0.05, 1, 1)],
});
item('radiant_mana_stone', 'Radiant Mana Stone', 'gem', {
  v: 520,
  g: 'crystal',
  a: C.e6,
  b: C.white,
  d: 'A blazing stone from an A- or S-rank gate. Hunters have fought each other over less.',
  src: [src.mob('hydra', 0.08, 1, 1), src.mob('dragon', 0.08, 1, 1)],
});

item('mana_tonic', 'Mana Tonic', 'potion', {
  v: 110,
  g: 'vial',
  a: C.w5,
  b: C.white,
  d: 'A lesser stone dissolved in herb water. Wounds close quickly.',
  heal: 60,
  buff: { kind: 'regen', secs: 120, power: 1.5 },
});
rec(
  'alchemy',
  [
    ['lesser_mana_stone', 1],
    ['healing_herb', 2],
  ],
  ['mana_tonic', 2],
  { lvl: 6, hint: 'A lesser mana stone steeped in herb water.' },
);
item('mana_elixir', 'Mana Elixir', 'potion', {
  v: 320,
  g: 'flask',
  a: C.q4,
  b: C.w6,
  d: 'The violet glow of a mana stone, bottled. Heals deeply and hardens you against harm.',
  heal: 140,
  buff: { kind: 'ward', secs: 300, power: 0.15 },
});
rec(
  'alchemy',
  [
    ['mana_stone', 1],
    ['healing_herb', 2],
  ],
  ['mana_elixir', 2],
  { lvl: 14, hint: 'A mana stone, ground fine, in a strong herb tea.' },
);
item('radiant_elixir', 'Radiant Elixir', 'potion', {
  v: 900,
  g: 'vial',
  a: C.e6,
  b: C.white,
  d: 'Liquid light. Every wound, every ailment, gone, and the next while goes your way.',
  heal: 320,
  cure: ['bleed', 'poison', 'burn', 'frostbite', 'fracture', 'curse', 'fever', 'gut_rot', 'ague', 'grave_rot'],
  buff: { kind: 'fortune', secs: 600, power: 2 },
});
rec(
  'alchemy',
  [
    ['radiant_mana_stone', 1],
    ['mana_stone', 1],
  ],
  ['radiant_elixir', 1],
  { lvl: 24, hint: 'Two grades of stone, fused in the flask.' },
);
