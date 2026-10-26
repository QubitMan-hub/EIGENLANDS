import { COL as C, item, rec, src } from './kit';
import type { FishSpec } from './types';

/**
 * The larder: meats and fish, culinary herbs, and everything the mill, the dairy, the pot and the oven make from raw
 * ingredients. These are the building blocks the dishes in dishes.ts and the drinks in drinks.ts are made from.
 */

// ── meats from the wild (each animal has its own cut)
const MEATS: Array<[string, string, string[], number, number, number, string, number]> = [
  // id, name, mobs, chance, a, b, desc, value
  ['venison', 'Venison', ['deer', 'spirit_stag'], 0.55, C.r3, C.r2, 'Dark lean meat with a sweet gamey edge.', 14],
  ['pork', 'Wild Pork', ['boar'], 0.6, C.r4, C.pale, 'Fatty and rich: ham, bacon and roast.', 12],
  ['rabbit_meat', 'Rabbit Meat', ['rabbit'], 0.6, C.pale, C.r4, 'Small, mild and lean.', 8],
  ['mutton', 'Mutton', ['blind_ram'], 0.5, C.r3, C.pale, 'Strong flavoured, best slow-cooked.', 14],
  ['wild_fowl', 'Wild Fowl', ['owl', 'griffin'], 0.4, C.e5, C.pale, 'Plump bird meat; roast it whole.', 12],
  [
    'drake_meat',
    'Drake Meat',
    ['cinder_drake'],
    0.3,
    C.r5,
    C.e7,
    'Lean, spiced by the creature’s own fire. A delicacy in Nethrakar.',
    34,
  ],
  ['eel_meat', 'Eel Fillet', ['tide_eel'], 0.45, C.w4, C.pale, 'Oily, silky and tender when grilled.', 18],
];
for (const [id, name, mobs, chance, a, b, d, v] of MEATS)
  item(id, name, 'meat', {
    v,
    g: 'meat',
    a,
    b,
    d,
    kind: 'material',
    rarity: v > 30 ? 2 : 0,
    src: mobs.map((m) => src.mob(m, chance)),
  });

// ── more of the sea and the rivers (fish table entries)
const F = (
  seasons: number[],
  water: FishSpec['water'],
  hours: [number, number],
  weight: number,
  difficulty: number,
  o: Partial<FishSpec> = {},
): FishSpec => ({ seasons, water, hours, weight, difficulty, ...o });
const FISH: Array<[string, string, FishSpec, number, number, string, number]> = [
  [
    'bass',
    'Bass',
    F([0, 1], 'shallow', [5, 12], 14, 0.4),
    C.g3,
    C.w5,
    'A feisty river fish with firm white flesh.',
    22,
  ],
  [
    'salmon',
    'Salmon',
    F([2], 'deep', [6, 18], 8, 0.55),
    C.r4,
    C.pale,
    'Pink flesh rich in oil. Runs upstream in autumn.',
    38,
  ],
  [
    'cod',
    'Cod',
    F([3, 2, 0], 'deep', [4, 16], 16, 0.35, { oceanOnly: true }),
    C.pale,
    C.e4,
    'Mild white fish; the sea’s staple.',
    20,
  ],
  [
    'tuna',
    'Tuna',
    F([1, 2], 'deep', [6, 18], 6, 0.7, { oceanOnly: true, minLevel: 2 }),
    C.w3,
    C.r4,
    'Deep red, meaty and strong. Fights to the end.',
    55,
  ],
  [
    'herring',
    'Herring',
    F([2, 3], 'shallow', [4, 12], 20, 0.2, { oceanOnly: true }),
    C.w5,
    C.pale,
    'Silver shoals. Pickle or smoke them.',
    10,
  ],
  [
    'mackerel',
    'Mackerel',
    F([1, 2], 'shallow', [0, 24], 18, 0.3, { oceanOnly: true }),
    C.w4,
    C.g3,
    'Oily, striped, quick to spoil.',
    14,
  ],
  [
    'squid',
    'Squid',
    F([0, 1, 2, 3], 'deep', [20, 5], 8, 0.55, { oceanOnly: true }),
    C.pale,
    C.q3,
    'Ink-filled night-feeder.',
    32,
  ],
  [
    'octopus',
    'Octopus',
    F([1, 2], 'deep', [20, 6], 4, 0.75, { oceanOnly: true, minLevel: 3 }),
    C.q3,
    C.r4,
    'Eight arms and a clever mind.',
    48,
  ],
  [
    'shrimp',
    'Shrimp',
    F([0, 1, 2], 'shallow', [0, 24], 18, 0.2, { oceanOnly: true }),
    C.r4,
    C.pale,
    'Sweet pink tails.',
    12,
  ],
  [
    'crab',
    'Crab',
    F([0, 1, 2], 'shallow', [0, 24], 12, 0.35, { oceanOnly: true }),
    C.r3,
    C.pale,
    'Sweet white meat in a hard shell.',
    26,
  ],
  [
    'lobster',
    'Lobster',
    F([1, 2], 'deep', [0, 24], 4, 0.65, { oceanOnly: true, minLevel: 3 }),
    C.r4,
    C.e7,
    'Sea royalty.',
    70,
  ],
  [
    'oyster',
    'Oyster',
    F([2, 3], 'shallow', [0, 24], 8, 0.3, { oceanOnly: true }),
    C.fog,
    C.pale,
    'Briny, silky and sometimes pearly.',
    28,
  ],
  [
    'clam',
    'Clam',
    F([0, 1, 2, 3], 'shallow', [0, 24], 14, 0.2, { oceanOnly: true }),
    C.fog,
    C.e5,
    'Sweet shellfish for chowder.',
    9,
  ],
  [
    'kelp',
    'Kelp',
    F([0, 1, 2, 3], 'any', [0, 24], 10, 0.15, { oceanOnly: true }),
    C.g3,
    C.g5,
    'Long ribbons of sea vegetable; rich in salt and iodine.',
    7,
  ],
  [
    'sturgeon',
    'Sturgeon',
    F([2, 3], 'deep', [6, 18], 2, 0.85, { minLevel: 4 }),
    C.slate,
    C.pale,
    'An armoured giant. Its roe is the finest in the world.',
    120,
  ],
];
for (const [id, name, spec, a, b, d, v] of FISH)
  item(id, name, 'fish', {
    v,
    g:
      id === 'crab' || id === 'lobster'
        ? 'claw'
        : id === 'oyster' || id === 'clam'
          ? 'nugget'
          : id === 'kelp'
            ? 'leaf'
            : 'fish',
    a,
    b,
    d,
    kind: 'fish',
    rarity: v > 60 ? 2 : v > 30 ? 1 : 0,
    src: [src.fish(spec)],
  });
item('fish_roe', 'Fish Roe', 'fish', {
  v: 40,
  g: 'berry',
  a: C.e5,
  b: C.r4,
  d: 'A glistening spoonful of eggs.',
  kind: 'fish',
  rarity: 1,
});
rec('cooking_pot', [['sturgeon', 1]], ['fish_roe', 4], {
  lvl: 8,
  disc: 'cooking',
  xp: 12,
  hint: 'Slit and sieve the roe.',
  tool: 'knife',
});
rec('cooking_pot', [['salmon', 1]], ['fish_roe', 1], {
  lvl: 5,
  disc: 'cooking',
  xp: 8,
  hint: 'Take the roe from a salmon.',
  tool: 'knife',
});

// ── culinary herbs from the forage tiles
const HERBS: Array<[string, string, number[], number, number, string]> = [
  ['basil', 'Basil', [1], C.g4, C.g6, 'Sweet peppery leaves. Tomato’s best friend.'],
  ['rosemary', 'Rosemary', [0, 1, 2], C.g3, C.q4, 'Piney needles for roasts and bread.'],
  ['parsley', 'Parsley', [0, 1, 2], C.g5, C.g3, 'Fresh green finishing herb.'],
  ['dill', 'Dill', [1, 2], C.g4, C.e7, 'Feathery fronds for fish and pickles.'],
  ['coriander', 'Coriander', [0, 1], C.g5, C.e6, 'Bright citrus-y leaf and seed.'],
  ['oregano', 'Oregano', [1, 2], C.g3, C.q4, 'Earthy dried herb of the south.'],
  ['wild_garlic', 'Wild Garlic', [0], C.g4, C.white, 'Broad leaves with a garlic bite.'],
  ['sorrel', 'Sorrel', [0, 3], C.g5, C.r3, 'Lemony leaves for sauces.'],
];
for (const [id, name, seasons, a, b, d] of HERBS)
  item(id, name, 'spice', { v: 6, g: 'leaf', a, b, d, src: [src.forage(seasons, 2)] });

// ── mill and press (Mill & Dairy)
const MILL = (
  id: string,
  name: string,
  from: [string, number],
  out: number,
  v: number,
  a: number,
  b: number,
  d: string,
  lvl = 1,
  g: Parameters<typeof item>[3]['g'] = 'sack',
) => {
  item(id, name, 'ingredient', { v, g, a, b, d });
  rec('dairy', [from], [id, out], { lvl, disc: 'farming', xp: 3 + lvl, hint: d });
};
MILL('flour', 'Wheat Flour', ['wheat', 2], 2, 6, C.white, C.pale, 'Milled wheat, the base of bread and pastry.');
MILL('rye_flour', 'Rye Flour', ['rye', 2], 2, 7, C.e4, C.e6, 'Dark, sour flour for dense bread.', 2);
MILL('oatmeal', 'Rolled Oats', ['oats', 2], 2, 6, C.e7, C.pale, 'Flattened oats for porridge and biscuits.');
MILL('cornmeal', 'Cornmeal', ['corn', 2], 2, 7, C.e6, C.e7, 'Coarse yellow meal.');
MILL('malt', 'Malted Barley', ['barley', 2], 2, 9, C.e5, C.e6, 'Sprouted, dried barley for beer and whisky.', 3);
MILL('rice_flour', 'Rice Flour', ['rice', 2], 2, 9, C.white, C.fog, 'Fine rice powder for mochi and noodles.', 2);
MILL('sugar', 'Sugar', ['sugarcane', 2], 1, 10, C.white, C.pale, 'Crystal sugar boiled from cane.', 2, 'dust');
rec('dairy', [['beet', 3]], ['sugar', 1], {
  lvl: 3,
  disc: 'farming',
  xp: 6,
  hint: 'Boil beets down to crystals.',
  id: 'sugar_beet',
});
rec('dairy', [['honey', 2]], ['sugar', 1], {
  lvl: 1,
  disc: 'farming',
  xp: 3,
  hint: 'Dry honey to crystals.',
  id: 'sugar_honey',
});
item('cream', 'Cream', 'dairy', { v: 14, g: 'jar', a: C.white, b: C.e7, d: 'Thick cream skimmed from the top.' });
rec('dairy', [['milk', 2]], ['cream', 1], { lvl: 1, disc: 'farming', xp: 3, hint: 'Skim the cream.' });
item('butter', 'Butter', 'dairy', {
  v: 18,
  g: 'butter',
  a: C.e7,
  b: C.e6,
  d: 'Churned cream. Everything is better with butter.',
});
rec('dairy', [['cream', 2]], ['butter', 1], { lvl: 1, disc: 'farming', xp: 4, hint: 'Churn until it breaks.' });
item('cheese', 'Cheese', 'dairy', {
  v: 30,
  g: 'cheese',
  a: C.e6,
  b: C.e7,
  d: 'A young pressed cheese.',
  heal: 12,
  nourishment: 12,
});
rec(
  'dairy',
  [
    ['milk', 3],
    ['salt', 1],
  ],
  ['cheese', 1],
  { lvl: 2, disc: 'farming', xp: 6, hint: 'Curdle, press and salt.' },
);
item('goat_cheese', 'Goat Cheese', 'dairy', {
  v: 38,
  g: 'cheese',
  a: C.white,
  b: C.pale,
  d: 'Tangy white cheese.',
  heal: 12,
  nourishment: 12,
});
rec(
  'dairy',
  [
    ['goat_milk', 3],
    ['salt', 1],
  ],
  ['goat_cheese', 1],
  { lvl: 3, disc: 'farming', xp: 7, hint: 'Curdle goat milk.' },
);
item('aged_cheese', 'Aged Cheese', 'dairy', {
  v: 96,
  g: 'cheese',
  a: C.e5,
  b: C.e7,
  d: 'Hard, nutty and complex after months in a cave.',
  rarity: 1,
  heal: 18,
  nourishment: 16,
});
rec(
  'dairy',
  [
    ['cheese', 3],
    ['salt', 1],
  ],
  ['aged_cheese', 1],
  { lvl: 9, disc: 'farming', xp: 18, hint: 'Cave-age a good cheese.' },
);
item('yogurt', 'Yogurt', 'dairy', {
  v: 16,
  g: 'jar',
  a: C.white,
  b: C.pale,
  d: 'Cultured milk, cool and sour.',
  heal: 8,
  nourishment: 8,
});
rec(
  'dairy',
  [
    ['milk', 2],
    ['honey', 1],
  ],
  ['yogurt', 2],
  { lvl: 2, disc: 'farming', xp: 5, hint: 'A spoon of last batch makes the next.' },
);
const OIL = (id: string, name: string, from: [string, number], v: number, a: number, d: string, lvl: number) => {
  item(id, name, 'ingredient', { v, g: 'flask', a, b: C.e7, d });
  rec('dairy', [from], [id, 1], { lvl, disc: 'farming', xp: 5 + lvl, hint: d });
};
OIL('olive_oil', 'Olive Oil', ['olive', 3], 40, C.g3, 'Green-gold oil, cold pressed.', 4);
OIL('sunflower_oil', 'Sunflower Oil', ['sunflower', 3], 22, C.e7, 'Light cooking oil.', 3);
OIL('sesame_oil', 'Sesame Oil', ['sesame', 3], 36, C.e5, 'Toasted, nutty oil for finishing.', 5);
OIL('peanut_oil', 'Peanut Oil', ['peanut', 3], 24, C.e6, 'Good for hot frying.', 3);
item('coconut_milk', 'Coconut Milk', 'ingredient', {
  v: 26,
  g: 'jar',
  a: C.white,
  b: C.e4,
  d: 'Rich white milk pressed from coconut flesh.',
});
rec('dairy', [['coconut', 1]], ['coconut_milk', 2], { lvl: 3, disc: 'farming', xp: 6, hint: 'Grate and press.' });
item('vinegar', 'Vinegar', 'ingredient', {
  v: 12,
  g: 'flask',
  a: C.e5,
  b: C.e3,
  d: 'Soured wine or cider. Pickles, dressings and sauces.',
});
rec('brewery', [['apple', 3]], ['vinegar', 2], { lvl: 2, disc: 'brewing', xp: 5, hint: 'Let cider go sour.' });
rec('brewery', [['grapes', 3]], ['vinegar', 2], {
  lvl: 2,
  disc: 'brewing',
  xp: 5,
  hint: 'Let wine go sour.',
  id: 'vinegar_wine',
});
item('raisins', 'Raisins', 'sweet', {
  v: 20,
  g: 'berry',
  a: C.q2,
  b: C.night,
  d: 'Sun-dried grapes, chewy and sweet.',
  heal: 6,
  nourishment: 6,
});
rec('oven', [['grapes', 3]], ['raisins', 2], { lvl: 2, disc: 'cooking', xp: 5, hint: 'Dry slowly on the oven shelf.' });
item('dried_fruit', 'Dried Fruit', 'sweet', {
  v: 24,
  g: 'berry',
  a: C.e4,
  b: C.r3,
  d: 'Apples, plums and figs dried for winter.',
  heal: 8,
  nourishment: 8,
});
rec(
  'oven',
  [
    ['apple', 1],
    ['plum', 1],
    ['fig', 1],
  ],
  ['dried_fruit', 3],
  { lvl: 3, disc: 'cooking', xp: 6, hint: 'Slice and dry in a low oven.' },
);
item('nori', 'Nori', 'ingredient', { v: 14, g: 'leaf', a: C.night, b: C.g2, d: 'Dried pressed sheets of kelp.' });
rec('oven', [['kelp', 2]], ['nori', 2], { lvl: 2, disc: 'cooking', xp: 5, hint: 'Press and dry kelp.' });
item('tomato_paste', 'Tomato Paste', 'ingredient', {
  v: 18,
  g: 'jar',
  a: C.r4,
  b: C.r3,
  d: 'Tomatoes reduced to a dark paste.',
});
rec('cooking_pot', [['tomato', 4]], ['tomato_paste', 1], {
  lvl: 2,
  disc: 'cooking',
  xp: 5,
  hint: 'Cook down and strain.',
});
item('chocolate', 'Dark Chocolate', 'sweet', {
  v: 70,
  g: 'butter',
  a: C.e1,
  b: C.e3,
  d: 'Roasted cocoa and sugar, tempered into a bar.',
  rarity: 1,
  heal: 14,
  nourishment: 12,
});
rec(
  'cooking_pot',
  [
    ['cocoa', 2],
    ['sugar', 1],
    ['butter', 1],
  ],
  ['chocolate', 2],
  { lvl: 7, disc: 'cooking', xp: 14, hint: 'Roast, grind, conche and temper.' },
);
item('coffee_beans', 'Roasted Coffee', 'ingredient', { v: 30, g: 'berry', a: C.e1, b: C.e2, d: 'Dark roasted beans.' });
rec('oven', [['coffee', 3]], ['coffee_beans', 2], { lvl: 4, disc: 'cooking', xp: 8, hint: 'Roast until fragrant.' });
item('tea_dried', 'Dried Tea', 'ingredient', {
  v: 14,
  g: 'leaf',
  a: C.g3,
  b: C.e4,
  d: 'Withered, rolled and dried leaves.',
});
rec('oven', [['tea_leaf', 3]], ['tea_dried', 2], {
  lvl: 2,
  disc: 'cooking',
  xp: 5,
  hint: 'Wither and fire the leaves.',
});
item('vanilla_extract', 'Vanilla Extract', 'spice', {
  v: 60,
  g: 'vial',
  a: C.e2,
  b: C.e4,
  d: 'Pods steeped in spirit. A few drops perfume a cake.',
  rarity: 1,
});
rec(
  'brewery',
  [
    ['vanilla', 1],
    ['sugar', 1],
  ],
  ['vanilla_extract', 2],
  { lvl: 5, disc: 'brewing', xp: 10, hint: 'Steep pods in spirit.' },
);
item('curry_paste', 'Curry Paste', 'spice', {
  v: 36,
  g: 'jar',
  a: C.e5,
  b: C.r4,
  d: 'Chili, turmeric, cumin and garlic pounded smooth.',
  rarity: 1,
});
rec(
  'cooking_pot',
  [
    ['chili', 2],
    ['turmeric', 1],
    ['cumin', 1],
    ['garlic', 1],
  ],
  ['curry_paste', 2],
  { lvl: 6, disc: 'cooking', xp: 12, hint: 'Pound in the mortar.', tool: 'pestle' },
);
item('hot_sauce', 'Hot Sauce', 'spice', {
  v: 24,
  g: 'flask',
  a: C.r5,
  b: C.r3,
  d: 'Fermented chili thinned with vinegar.',
});
rec(
  'cooking_pot',
  [
    ['chili', 3],
    ['vinegar', 1],
    ['salt', 1],
  ],
  ['hot_sauce', 2],
  { lvl: 4, disc: 'cooking', xp: 8, hint: 'Blend and bottle.' },
);
item('soy_sauce', 'Soy Sauce', 'spice', {
  v: 26,
  g: 'flask',
  a: C.e1,
  b: C.e3,
  d: 'Brined soybeans fermented for a season.',
  rarity: 1,
});
rec(
  'brewery',
  [
    ['soybean', 3],
    ['salt', 2],
    ['wheat', 1],
  ],
  ['soy_sauce', 2],
  { lvl: 5, disc: 'brewing', xp: 10, hint: 'Ferment beans in brine.' },
);
item('miso', 'Miso', 'spice', {
  v: 30,
  g: 'jar',
  a: C.e4,
  b: C.e6,
  d: 'Fermented soybean paste, salty and deep.',
  rarity: 1,
});
rec(
  'brewery',
  [
    ['soybean', 3],
    ['salt', 1],
    ['rice', 1],
  ],
  ['miso', 2],
  { lvl: 6, disc: 'brewing', xp: 11, hint: 'Ferment beans with rice mould.' },
);
item('tofu', 'Tofu', 'ingredient', {
  v: 14,
  g: 'cheese',
  a: C.white,
  b: C.pale,
  d: 'Soft pressed curds of soy milk.',
  heal: 8,
  nourishment: 8,
});
rec(
  'dairy',
  [
    ['soybean', 3],
    ['salt', 1],
  ],
  ['tofu', 2],
  { lvl: 3, disc: 'farming', xp: 6, hint: 'Curdle soy milk and press.' },
);

// ── pot and oven staples
item('dough', 'Dough', 'ingredient', {
  v: 8,
  g: 'sack',
  a: C.white,
  b: C.e7,
  d: 'Flour, salt and water, kneaded smooth.',
});
rec(
  'cooking_pot',
  [
    ['flour', 2],
    ['salt', 1],
  ],
  ['dough', 2],
  { lvl: 1, disc: 'cooking', xp: 3, hint: 'Knead for a good ten minutes.' },
);
item('pasta', 'Fresh Pasta', 'ingredient', { v: 14, g: 'bowl', a: C.e7, b: C.pale, d: 'Egg pasta, rolled and cut.' });
rec(
  'cooking_pot',
  [
    ['flour', 2],
    ['egg', 1],
  ],
  ['pasta', 2],
  { lvl: 3, disc: 'cooking', xp: 6, hint: 'Roll thin and cut.', tool: 'knife' },
);
item('noodles', 'Noodles', 'ingredient', { v: 12, g: 'bowl', a: C.pale, b: C.e7, d: 'Long pulled noodles.' });
rec(
  'cooking_pot',
  [
    ['flour', 2],
    ['salt', 1],
  ],
  ['noodles', 2],
  { lvl: 3, disc: 'cooking', xp: 6, hint: 'Stretch and fold the dough.', id: 'noodles_wheat' },
);
rec(
  'cooking_pot',
  [
    ['rice_flour', 2],
    ['salt', 1],
  ],
  ['noodles', 2],
  { lvl: 4, disc: 'cooking', xp: 6, hint: 'Steam rice batter and slice.', id: 'noodles_rice' },
);
item('stock', 'Bone Stock', 'ingredient', {
  v: 20,
  g: 'jar',
  a: C.e6,
  b: C.e4,
  d: 'Bones, onion and carrot simmered for hours.',
  heal: 10,
  nourishment: 10,
});
rec(
  'cooking_pot',
  [
    ['bone', 2],
    ['onion', 1],
    ['carrot', 1],
  ],
  ['stock', 2],
  { lvl: 2, disc: 'cooking', xp: 6, hint: 'Simmer and strain.' },
);
item('fish_stock', 'Fish Stock', 'ingredient', {
  v: 22,
  g: 'jar',
  a: C.w6,
  b: C.e6,
  d: 'Fish heads and seaweed in clear broth.',
  heal: 10,
  nourishment: 10,
});
rec(
  'cooking_pot',
  [
    ['minnow', 3],
    ['kelp', 1],
    ['dill', 1],
  ],
  ['fish_stock', 2],
  { lvl: 3, disc: 'cooking', xp: 7, hint: 'Simmer the small fish.' },
);
item('sausage', 'Sausage', 'meat', {
  v: 30,
  g: 'skewer',
  a: C.r3,
  b: C.e5,
  d: 'Minced pork with sage and salt in a casing.',
  heal: 16,
  nourishment: 16,
  kind: 'food',
});
rec(
  'cooking_pot',
  [
    ['pork', 2],
    ['salt', 1],
    ['sage', 1],
  ],
  ['sausage', 3],
  { lvl: 4, disc: 'cooking', xp: 9, hint: 'Mince, season and stuff.', tool: 'knife' },
);
item('bacon', 'Smoked Bacon', 'meat', {
  v: 34,
  g: 'meat',
  a: C.r4,
  b: C.pale,
  d: 'Cured, smoked belly. Crisp and salty.',
  heal: 14,
  nourishment: 14,
  kind: 'food',
});
rec(
  'cooking_pot',
  [
    ['pork', 2],
    ['salt', 2],
    ['charcoal', 1],
  ],
  ['bacon', 2],
  { lvl: 5, disc: 'cooking', xp: 10, hint: 'Cure and smoke belly.', tool: 'knife' },
);
item('jerky', 'Jerky', 'meat', {
  v: 26,
  g: 'meat',
  a: C.r2,
  b: C.e3,
  d: 'Salted, dried strips of meat. It keeps for months and never spoils on the road.',
  heal: 16,
  nourishment: 24,
  kind: 'food',
  buff: { kind: 'steady', secs: 240, power: 12 },
});
rec(
  'oven',
  [
    ['raw_meat', 2],
    ['salt', 1],
  ],
  ['jerky', 3],
  { lvl: 2, disc: 'cooking', xp: 6, hint: 'Salt and slow-dry strips.', tool: 'knife' },
);
item('smoked_fish', 'Smoked Fish', 'fish', {
  v: 30,
  g: 'fish',
  a: C.e4,
  b: C.e6,
  d: 'Fish cured over smoke. Keeps all winter.',
  heal: 16,
  nourishment: 22,
  kind: 'food',
});
rec(
  'oven',
  [
    ['herring', 2],
    ['salt', 1],
    ['charcoal', 1],
  ],
  ['smoked_fish', 2],
  { lvl: 3, disc: 'cooking', xp: 7, hint: 'Brine and smoke.', tool: 'knife' },
);
item('pickles', 'Pickles', 'vegetable', {
  v: 16,
  g: 'jar',
  a: C.g4,
  b: C.e6,
  d: 'Cucumbers in brine and dill. Sharp and crunchy.',
  heal: 6,
  nourishment: 8,
  kind: 'food',
});
rec(
  'cooking_pot',
  [
    ['cucumber', 2],
    ['vinegar', 1],
    ['dill', 1],
    ['salt', 1],
  ],
  ['pickles', 2],
  { lvl: 2, disc: 'cooking', xp: 5, hint: 'Pack in brine.' },
);
item('sauerkraut', 'Sauerkraut', 'vegetable', {
  v: 18,
  g: 'jar',
  a: C.g5,
  b: C.pale,
  d: 'Fermented cabbage; sour, crunchy, wintery.',
  heal: 8,
  nourishment: 10,
  kind: 'food',
});
rec(
  'cooking_pot',
  [
    ['cabbage', 2],
    ['salt', 1],
  ],
  ['sauerkraut', 2],
  { lvl: 2, disc: 'cooking', xp: 5, hint: 'Salt and press for a week.' },
);
item('kimchi', 'Kimchi', 'vegetable', {
  v: 26,
  g: 'jar',
  a: C.r4,
  b: C.g5,
  d: 'Chili-fermented cabbage, loud and alive.',
  heal: 10,
  nourishment: 12,
  kind: 'food',
  rarity: 1,
});
rec(
  'cooking_pot',
  [
    ['cabbage', 2],
    ['chili', 1],
    ['garlic', 1],
    ['ginger', 1],
    ['salt', 1],
  ],
  ['kimchi', 2],
  {
    lvl: 5,
    disc: 'cooking',
    xp: 10,
    hint: 'Rub with chili paste and ferment.',
    realm: 'raijin',
    learn: 'realm:raijin',
  },
);
