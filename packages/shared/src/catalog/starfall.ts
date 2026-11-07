import { COL as C, item, rec } from './kit';

/**
 * Starfall crafting: what to make of the star shards you break out of a fallen star (wonders.ts). A shard is still
 * warm and still faintly bright, so it goes into light and luck: star glass for lanterns, starsteel for the Starfall
 * longbow (legendary.ts), a lantern that outshines any oil lamp, a charm for the lucky, and a tonic of star dust.
 */

// ── materials
item('star_glass', 'Star Glass', 'component', {
  v: 120,
  g: 'crystal',
  a: C.w6,
  b: C.q6,
  d: 'Glass fused with a powdered star shard. It holds a little of the light that went into it.',
});
rec(
  'masonry',
  [
    ['star_shard', 1],
    ['glass', 2],
  ],
  ['star_glass', 2],
  { lvl: 10, disc: 'masonry', xp: 30, hint: 'Grind the shard to dust and fold it into molten glass.' },
);

item('starsteel_ingot', 'Starsteel Ingot', 'metal', {
  v: 260,
  g: 'ingot',
  a: C.pale,
  b: C.w6,
  d: 'Iron smelted with a star shard: light, springy and faintly luminous along its grain.',
});
rec(
  'furnace',
  [
    ['star_shard', 1],
    ['iron_ingot', 3],
    ['coal', 2],
  ],
  ['starsteel_ingot', 2],
  { lvl: 14, disc: 'smithing', xp: 40, hint: 'Smelt the shard with good iron; it carries the heat of its fall.' },
);

// ── gear
item('star_lantern', 'Starlit Lantern', 'light', {
  v: 520,
  g: 'lantern',
  a: C.w6,
  b: C.e7,
  d: 'A starsteel lantern glazed with star glass. It needs no oil, and it lights the dark further than any lamp.',
  rarity: 3,
  stack: 1,
  gear: { slot: 'light', level: 12, bonus: { light: 9 }, dur: 600 },
});
rec(
  'jeweler',
  [
    ['star_glass', 2],
    ['starsteel_ingot', 1],
    ['silver_wire', 1],
  ],
  ['star_lantern', 1],
  {
    lvl: 12,
    disc: 'smithing',
    xp: 52,
    hint: 'Set star glass in a starsteel frame.',
    quality: true,
    gear: true,
    cat: 'light',
    stage: 3,
  },
);

item('star_charm', 'Wishing Star Charm', 'accessory', {
  v: 640,
  g: 'charm',
  a: C.w6,
  b: C.e7,
  d: 'A star shard caged in starsteel wire. People who wear one find things.',
  rarity: 3,
  stack: 1,
  gear: { slot: 'charm', level: 14, bonus: { luck: 2.5, phase: 0.02 }, dur: 400 },
});
rec(
  'jeweler',
  [
    ['star_shard', 2],
    ['starsteel_ingot', 1],
    ['silver_wire', 2],
  ],
  ['star_charm', 1],
  {
    lvl: 14,
    disc: 'smithing',
    xp: 60,
    hint: 'Cage the shard so it can still breathe.',
    quality: true,
    gear: true,
    cat: 'accessory',
    stage: 3,
  },
);
