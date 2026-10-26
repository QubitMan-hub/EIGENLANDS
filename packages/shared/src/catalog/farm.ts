import { COL as C, item, rec, src } from './kit';
import { CROP_ROWS } from './crop-data';
import { PROP_SPECS } from './home';
import type { Rarity } from '../crafting';

/**
 * The farm: seeds and harvests for every crop, fertiliser, tools of the field, irrigation and animal supplies. Each
 * seed is sold by the shops of the kingdoms that grow it; each harvest feeds the kitchen, the brewery, the loom or the press.
 */
const SEED_OF_GLYPH = 'seed' as const;

for (const row of CROP_ROWS) {
  const d = row.def;
  const shopSrc: ReturnType<typeof src.shop>[] = [];
  for (const where of row.sold) {
    if (where === 'general') {
      shopSrc.push(src.shop('general', 1, undefined, d.seasons), src.shop('farm', 1.05, undefined, d.seasons));
    } else {
      shopSrc.push(src.shop('farm', 1, where, d.seasons), src.shop('merchant', 1.15, where, d.seasons));
    }
  }
  item(`${d.id}_seed`, `${d.name} Seed`, 'seed', {
    v: row.seed,
    g: SEED_OF_GLYPH,
    a: d.color,
    b: C.e5,
    d: `Plant on tilled soil. Grows into ${d.name.toLowerCase()}. ${seasonText(d.seasons)}`,
    crop: d.id,
    src: shopSrc,
  });
  item(d.id, d.name, 'crop', {
    v: row.crop,
    g: row.glyph,
    a: d.color,
    b: C.g5,
    d: row.blurb,
    heal: row.raw ? row.raw : 3,
    ...(row.raw ? { nourishment: row.raw } : {}),
    src: [src.crop()],
  });
}
function seasonText(s: number[]): string {
  const names = ['spring', 'summer', 'autumn', 'winter'];
  return `Grows in ${s.map((x) => names[x]).join(' and ')}.`;
}

// ── fertiliser: faster ripening and bigger harvests
item('compost', 'Compost', 'farm', {
  v: 8,
  g: 'sack',
  a: C.e2,
  b: C.g3,
  d: 'Rotted plants and straw. Saves a day of growth.',
  kind: 'fertilizer',
  fert: { days: 1, yield: 0 },
});
rec(
  'hand',
  [
    ['hay', 3],
    ['fiber', 2],
  ],
  ['compost', 2],
  { lvl: 1, disc: 'farming', xp: 3, hint: 'Pile and rot plant scraps.' },
);
item('bonemeal', 'Bonemeal', 'farm', {
  v: 16,
  g: 'dust',
  a: C.pale,
  b: C.fog,
  d: 'Ground bone. Saves two days of growth.',
  kind: 'fertilizer',
  fert: { days: 2, yield: 0 },
});
rec('masonry', [['bone', 2]], ['bonemeal', 2], { lvl: 2, disc: 'farming', xp: 4, hint: 'Grind bone to meal.' });
item('rich_soil', 'Rich Fertiliser', 'farm', {
  v: 44,
  g: 'sack',
  a: C.e3,
  b: C.g4,
  d: 'Compost, bonemeal and salt. Saves a day and adds a bigger harvest.',
  rarity: 1,
  kind: 'fertilizer',
  fert: { days: 1, yield: 1 },
});
rec(
  'hand',
  [
    ['compost', 2],
    ['bonemeal', 1],
    ['salt', 1],
  ],
  ['rich_soil', 2],
  { lvl: 5, disc: 'farming', xp: 8, hint: 'Mix to a fine crumb.' },
);
item('golden_soil', 'Golden Fertiliser', 'farm', {
  v: 140,
  g: 'sack',
  a: C.e7,
  b: C.g5,
  d: 'Saves two days of growth and adds a bigger harvest.',
  rarity: 2,
  kind: 'fertilizer',
  fert: { days: 2, yield: 1 },
});
rec(
  'hand',
  [
    ['rich_soil', 2],
    ['life_crystal', 1],
    ['amber_gland', 1],
  ],
  ['golden_soil', 2],
  { lvl: 12, disc: 'farming', xp: 20, hint: 'A little life crystal goes a long way.' },
);

// ── tools of the field: kept in the pack to unlock the work, never used up
item('sickle', 'Sickle', 'tool', {
  v: 40,
  g: 'sickle',
  a: C.steel,
  b: C.e4,
  d: 'Cuts grain cleanly. Keep it in your pack: grain and hay harvests yield +1.',
  kind: 'misc',
  stack: 1,
});
rec(
  'workbench',
  [
    ['copper_plate', 1],
    ['handle', 1],
  ],
  ['sickle', 1],
  { lvl: 2, disc: 'farming', xp: 6, hint: 'A curved blade on a short handle.' },
);
item('shears', 'Sheep Shears', 'tool', {
  v: 50,
  g: 'shears',
  a: C.steel,
  b: C.e4,
  d: 'Spring-loaded shears. Needed to clip wool and goat hair from a pen.',
  kind: 'misc',
  stack: 1,
});
rec(
  'workbench',
  [
    ['iron_plate', 1],
    ['iron_rod', 1],
  ],
  ['shears', 1],
  { lvl: 3, disc: 'farming', xp: 8, hint: 'Two blades pinned together.' },
);
item('trowel', 'Garden Trowel', 'tool', {
  v: 36,
  g: 'trowel',
  a: C.steel,
  b: C.e4,
  d: 'Digs seedlings and bulbs. Needed to transplant sapling trees.',
  kind: 'misc',
  stack: 1,
});
rec(
  'workbench',
  [
    ['copper_plate', 1],
    ['handle', 1],
  ],
  ['trowel', 1],
  { lvl: 1, disc: 'farming', xp: 5, hint: 'A hand shovel.' },
);
item('milk_pail', 'Milk Pail', 'tool', {
  v: 30,
  g: 'bucket',
  a: C.e4,
  b: C.steel,
  d: 'A wooden pail with a lid.',
  kind: 'misc',
  stack: 1,
});
rec(
  'carpenter',
  [
    ['plank', 3],
    ['nails', 4],
  ],
  ['milk_pail', 1],
  { lvl: 2, disc: 'farming', xp: 5, hint: 'Staves bound in iron.' },
);

// ── irrigation: bigger, steadier reach than the first two sprinklers
item('sprinkler_3', 'Rain Spout', 'farm', {
  v: 260,
  g: 'pipe',
  a: C.w4,
  b: C.e4,
  d: 'Waters every tilled tile within two tiles each morning: a whole plot.',
  kind: 'placeable',
  rarity: 1,
  place: { kind: 'sprinkler', sub: 'sprinkler3' },
  stack: 20,
});
rec(
  'engineering',
  [
    ['bronze_plate', 2],
    ['hemp_rope', 1],
    ['glass', 1],
    ['pipe_copper', 3],
  ],
  ['sprinkler_3', 1],
  { lvl: 6, disc: 'engineering', xp: 22, hint: 'A pipe, a nozzle and a clever valve.' },
);
item('pipe_copper', 'Copper Pipe', 'component', {
  v: 14,
  g: 'pipe',
  a: C.e4,
  b: C.e6,
  d: 'A soldered length of copper pipe.',
});
rec('forge', [['copper_plate', 1]], ['pipe_copper', 2], {
  lvl: 3,
  disc: 'engineering',
  xp: 5,
  hint: 'Roll and seam a plate.',
  tool: 'tongs',
});
// ── animal supplies: new shelters, the animals and their feed
interface Pen {
  sub: string;
  name: string;
  animal: string;
  animalName: string;
  product: string;
  productName: string;
  v: number;
  a: number;
  b: number;
  lvl: number;
  shelterInputs: Array<[string, number]>;
  animalV: number;
  blurb: string;
}
export const PENS: Pen[] = [
  {
    sub: 'sheepfold',
    name: 'Sheepfold',
    animal: 'sheep',
    animalName: 'Sheep',
    product: 'wool',
    productName: 'wool',
    v: 520,
    a: C.e4,
    b: C.g3,
    lvl: 4,
    shelterInputs: [
      ['pine_plank', 10],
      ['hemp_rope', 2],
      ['hay', 6],
    ],
    animalV: 300,
    blurb: 'A low-roofed fold for four sheep. They grow a fleece for the shears.',
  },
  {
    sub: 'goat_shed',
    name: 'Goat Shed',
    animal: 'goat',
    animalName: 'Goat',
    product: 'goat_milk',
    productName: 'goat milk',
    v: 560,
    a: C.e5,
    b: C.e3,
    lvl: 5,
    shelterInputs: [
      ['oak_plank', 8],
      ['nails', 12],
      ['hay', 6],
    ],
    animalV: 340,
    blurb: 'A hardy shed for four goats; they give rich milk for cheese.',
  },
  {
    sub: 'pig_pen',
    name: 'Pig Pen',
    animal: 'pig',
    animalName: 'Pig',
    product: 'truffle',
    productName: 'truffles',
    v: 600,
    a: C.r3,
    b: C.e3,
    lvl: 6,
    shelterInputs: [
      ['plank', 12],
      ['stone_brick', 6],
      ['hay', 8],
    ],
    animalV: 380,
    blurb: 'A muddy pen for four pigs. They root out truffles under the oaks.',
  },
  {
    sub: 'apiary',
    name: 'Apiary',
    animal: 'bee_colony',
    animalName: 'Bee Colony',
    product: 'honey',
    productName: 'honey',
    v: 480,
    a: C.e6,
    b: C.e4,
    lvl: 5,
    shelterInputs: [
      ['cedar_plank', 8],
      ['clay_brick', 4],
      ['resin', 4],
    ],
    animalV: 260,
    blurb: 'Skeps for four colonies of bees. They gather honey from the meadow flowers.',
  },
];
PROP_SPECS.sheepfold = { shape: 'pen', main: 'pine', trim: 'straw', tint: C.white };
PROP_SPECS.goat_shed = { shape: 'pen', main: 'oak', trim: 'oak', tint: C.e4 };
PROP_SPECS.pig_pen = { shape: 'pen', main: 'pine', trim: 'brick', tint: C.r5 };
PROP_SPECS.apiary = { shape: 'apiary', main: 'cedar', trim: 'brick' };
for (const p of PENS) {
  item(p.sub, p.name, 'farm', {
    v: p.v,
    g: p.sub === 'apiary' ? 'beehive' : 'hatch',
    a: p.a,
    b: p.b,
    d: p.blurb,
    kind: 'placeable',
    place: { kind: 'shelter', sub: p.sub },
    stack: 20,
    src: [src.shop('farm', 1.1)],
  });
  rec('carpenter', p.shelterInputs, [p.sub, 1], {
    lvl: p.lvl,
    disc: 'woodworking',
    xp: 16 + p.lvl * 2,
    hint: p.blurb,
    tool: 'saw',
  });
  const glyph = p.animal === 'sheep' ? 'sheep' : p.animal === 'goat' ? 'goat' : p.animal === 'pig' ? 'pig' : 'bee';
  item(p.animal, p.animalName, 'animal', {
    v: p.animalV,
    g: glyph,
    a: p.animal === 'pig' ? C.r5 : C.white,
    b: p.animal === 'bee_colony' ? C.e7 : C.ink,
    d: `Put it in a ${p.name.toLowerCase()}.`,
    stack: 4,
    src: [src.shop('farm', 1.15)],
  });
}
// products
item('goat_milk', 'Goat Milk', 'dairy', {
  v: 22,
  g: 'jar',
  a: C.white,
  b: C.pale,
  d: 'Tangy, rich milk.',
  heal: 6,
  nourishment: 6,
  src: [src.animal('goat')],
});
item('truffle', 'Black Truffle', 'ingredient', {
  v: 90,
  g: 'mushroom',
  a: C.night,
  b: C.e2,
  d: 'A knobbly black fungus a pig can smell from ten paces.',
  rarity: 2,
  src: [src.animal('pig')],
});
item('honey', 'Honey', 'sweet', {
  v: 28,
  g: 'honey',
  a: C.e6,
  b: C.e7,
  d: 'Golden and slow. Sweetens, soothes and keeps forever.',
  heal: 6,
  nourishment: 6,
  src: [src.animal('bee_colony')],
});
// feed: better feed, better yield
item('animal_feed', 'Animal Feed', 'farm', {
  v: 10,
  g: 'sack',
  a: C.e6,
  b: C.e4,
  d: 'Mixed grain and pulp. Fed animals produce next morning, and a mixed feed makes a richer product.',
});
rec(
  'dairy',
  [
    ['wheat', 2],
    ['oats', 1],
    ['carrot', 1],
  ],
  ['animal_feed', 3],
  { lvl: 3, disc: 'farming', xp: 5, hint: 'Mill and mix.' },
);
