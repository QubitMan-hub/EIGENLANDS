import { COL as C, item, rec, src } from './kit';
import type { Discipline, ItemCat, StationId } from '../crafting';
import type { Rarity } from '../crafting';

/**
 * Stations, furniture and decoration for the home and the workshop. Every row is one placeable: what it looks like
 * (a shape and two materials, drawn by the client's isometric prop kit), what it costs to make, and what it does when it does
 * anything: stations unlock recipes, hearths warm you, lamps light the room, cabinets keep your things.
 */
export type PropShape =
  | 'table'
  | 'table_round'
  | 'desk'
  | 'cabinet'
  | 'dresser'
  | 'wardrobe'
  | 'chest'
  | 'bed'
  | 'bed_canopy'
  | 'hammock'
  | 'cradle'
  | 'armchair'
  | 'garden_bench'
  | 'candelabra'
  | 'chandelier'
  | 'sconce'
  | 'brazier'
  | 'fireplace'
  | 'stone_lantern'
  | 'clock'
  | 'globe'
  | 'telescope'
  | 'armor_stand'
  | 'weapon_rack'
  | 'display_case'
  | 'mirror'
  | 'harp'
  | 'music_box'
  | 'statue'
  | 'bird_bath'
  | 'sundial'
  | 'trellis'
  | 'topiary'
  | 'banner'
  | 'tapestry'
  | 'barrel'
  | 'pen'
  | 'apiary'
  | 'masonry'
  | 'tannery'
  | 'oven'
  | 'brewery'
  | 'enchanting'
  | 'engineering'
  | 'runeforge'
  | 'dairy';

/** Material ramps the prop kit knows by name. */
export type RampKey =
  | 'oak'
  | 'pine'
  | 'birch'
  | 'cedar'
  | 'ebony'
  | 'ironwood'
  | 'willow'
  | 'bamboo'
  | 'stone'
  | 'marble'
  | 'granite'
  | 'sandstone'
  | 'brick'
  | 'iron'
  | 'brass'
  | 'copper'
  | 'linen'
  | 'wool'
  | 'crimson'
  | 'azure'
  | 'violet'
  | 'forest'
  | 'gold'
  | 'straw'
  | 'bronze';

export interface PropSpec {
  shape: PropShape;
  main: RampKey;
  trim: RampKey;
  /** a flat palette colour for cloth, glass and flame */
  tint?: number;
}
export const PROP_SPECS: Record<string, PropSpec> = {};
export const PROP_LIGHT: Record<string, { radius: number; color: number }> = {};
export const PROP_WARM = new Set<string>();

interface Make {
  station: StationId;
  inputs: Array<[string, number]>;
  lvl: number;
  disc: Discipline;
  learn?: `realm:${string}` | 'discover' | 'level';
  realm?: string;
  tool?: string;
}
interface Row {
  sub: string;
  name: string;
  cat: Extract<ItemCat, 'station' | 'furniture' | 'decor' | 'farm'>;
  place: 'station' | 'furniture' | 'chest';
  v: number;
  d: string;
  rarity?: Rarity;
  spec: PropSpec;
  make: Make;
  light?: { radius: number; color: number };
  warm?: boolean;
  /** inventory glyph */
  g: Parameters<typeof item>[3]['g'];
  a: number;
  b: number;
}

const ROWS: Row[] = [
  // ── the eight benches that open the other trades
  {
    sub: 'masonry',
    name: 'Stonecutter’s Bench',
    cat: 'station',
    place: 'station',
    v: 140,
    d: 'A slab bench for cutting stone, brick, tile and glass. Opens masonry.',
    spec: { shape: 'masonry', main: 'stone', trim: 'oak' },
    make: {
      station: 'workbench',
      inputs: [
        ['stone', 16],
        ['plank', 6],
        ['iron_rod', 1],
      ],
      lvl: 1,
      disc: 'masonry',
    },
    g: 'bench',
    a: C.mist,
    b: C.e4,
  },
  {
    sub: 'tannery',
    name: 'Tanning Rack',
    cat: 'station',
    place: 'station',
    v: 120,
    d: 'Frames, pegs and a scraping beam. Opens leatherworking.',
    spec: { shape: 'tannery', main: 'pine', trim: 'iron' },
    make: {
      station: 'workbench',
      inputs: [
        ['pine_plank', 6],
        ['hemp_rope', 2],
        ['bark', 4],
      ],
      lvl: 2,
      disc: 'leatherworking',
    },
    g: 'bench',
    a: C.e4,
    b: C.e6,
  },
  {
    sub: 'oven',
    name: 'Stone Oven',
    cat: 'station',
    place: 'station',
    v: 260,
    d: 'A domed oven with a firebox. Opens baking: bread, pies, roasts and pastries.',
    spec: { shape: 'oven', main: 'brick', trim: 'iron' },
    light: { radius: 3, color: C.r5 },
    warm: true,
    make: {
      station: 'workbench',
      inputs: [
        ['clay_brick', 14],
        ['mortar', 3],
        ['iron_plate', 1],
      ],
      lvl: 2,
      disc: 'cooking',
    },
    g: 'furnace',
    a: C.r3,
    b: C.r5,
  },
  {
    sub: 'brewery',
    name: 'Brewing Barrels',
    cat: 'station',
    place: 'station',
    v: 220,
    d: 'Casks, a copper kettle and an airlock. Opens brewing: beer, wine, mead and spirits.',
    spec: { shape: 'brewery', main: 'oak', trim: 'copper' },
    make: {
      station: 'carpenter',
      inputs: [
        ['oak_plank', 10],
        ['copper_plate', 2],
        ['iron_rod', 3],
      ],
      lvl: 4,
      disc: 'brewing',
      tool: 'saw',
    },
    g: 'barrel_drink',
    a: C.e4,
    b: C.e6,
  },
  {
    sub: 'enchanting',
    name: 'Enchanting Table',
    cat: 'station',
    place: 'station',
    v: 480,
    d: 'An ebony table inlaid with silver and set with a crystal. Binds runes into gear.',
    rarity: 2,
    spec: { shape: 'enchanting', main: 'ebony', trim: 'gold', tint: C.q5 },
    light: { radius: 3, color: C.q5 },
    make: {
      station: 'carpenter',
      inputs: [
        ['ebony_plank', 4],
        ['amethyst_cut', 2],
        ['silver_wire', 2],
        ['crystal_dust', 3],
      ],
      lvl: 9,
      disc: 'enchanting',
      tool: 'saw',
    },
    g: 'table',
    a: C.night,
    b: C.q5,
  },
  {
    sub: 'engineering',
    name: 'Engineer’s Bench',
    cat: 'station',
    place: 'station',
    v: 300,
    d: 'A heavy bench with a vice, a lathe and a rack of gears. Opens engineering.',
    spec: { shape: 'engineering', main: 'iron', trim: 'oak' },
    make: {
      station: 'carpenter',
      inputs: [
        ['oak_plank', 6],
        ['iron_plate', 3],
        ['gear_set', 2],
        ['rivets', 10],
      ],
      lvl: 6,
      disc: 'engineering',
      tool: 'saw',
    },
    g: 'bench',
    a: C.steel,
    b: C.e5,
  },
  {
    sub: 'runeforge',
    name: 'Rune Altar',
    cat: 'station',
    place: 'station',
    v: 640,
    d: 'A carved granite altar that holds a charge. Opens rune-carving and magical crafting.',
    rarity: 2,
    spec: { shape: 'runeforge', main: 'granite', trim: 'gold', tint: C.q6 },
    light: { radius: 3.5, color: C.q5 },
    make: {
      station: 'masonry',
      inputs: [
        ['granite_block', 6],
        ['qubit_crystal', 3],
        ['silver_plate', 2],
      ],
      lvl: 7,
      disc: 'magic',
      tool: 'chisel',
    },
    g: 'rune',
    a: C.slate,
    b: C.q6,
  },
  {
    sub: 'dairy',
    name: 'Mill & Dairy',
    cat: 'station',
    place: 'station',
    v: 240,
    d: 'A hand mill, a cheese press and a churn. Opens milling, pressing and dairy.',
    spec: { shape: 'dairy', main: 'oak', trim: 'stone' },
    make: {
      station: 'carpenter',
      inputs: [
        ['oak_plank', 8],
        ['iron_rod', 2],
        ['granite', 4],
        ['hemp_rope', 1],
      ],
      lvl: 3,
      disc: 'farming',
      tool: 'saw',
    },
    g: 'barn',
    a: C.e4,
    b: C.fog,
  },
  // ── beds and rest
  {
    sub: 'double_bed',
    name: 'Double Bed',
    cat: 'furniture',
    place: 'furniture',
    v: 220,
    d: 'A broad pine bed with a wool quilt.',
    spec: { shape: 'bed', main: 'pine', trim: 'wool', tint: C.w3 },
    make: {
      station: 'carpenter',
      inputs: [
        ['pine_plank', 8],
        ['wool_cloth', 3],
        ['wool', 4],
      ],
      lvl: 3,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'bed',
    a: C.w3,
    b: C.e5,
  },
  {
    sub: 'canopy_bed',
    name: 'Canopy Bed',
    cat: 'furniture',
    place: 'furniture',
    v: 640,
    d: 'Ebony posts and silk curtains. Fit for a ruler.',
    rarity: 3,
    spec: { shape: 'bed_canopy', main: 'ebony', trim: 'violet', tint: C.q4 },
    make: {
      station: 'carpenter',
      inputs: [
        ['ebony_plank', 6],
        ['silk_cloth', 4],
        ['wool_cloth', 2],
        ['dye_violet', 1],
      ],
      lvl: 12,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'bed',
    a: C.q4,
    b: C.night,
  },
  {
    sub: 'hammock',
    name: 'Hammock',
    cat: 'furniture',
    place: 'furniture',
    v: 90,
    d: 'Canvas slung between two posts. Easy and cheap.',
    spec: { shape: 'hammock', main: 'bamboo', trim: 'linen', tint: C.e6 },
    make: {
      station: 'carpenter',
      inputs: [
        ['bamboo_plank', 3],
        ['canvas', 2],
        ['hemp_rope', 2],
      ],
      lvl: 2,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'bed',
    a: C.e6,
    b: C.g4,
  },
  {
    sub: 'cradle',
    name: 'Cradle',
    cat: 'furniture',
    place: 'furniture',
    v: 140,
    d: 'A rocking cot of birch with a linen blanket.',
    spec: { shape: 'cradle', main: 'birch', trim: 'linen' },
    make: {
      station: 'carpenter',
      inputs: [
        ['birch_plank', 4],
        ['linen_cloth', 2],
        ['glue', 1],
      ],
      lvl: 4,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'bed',
    a: C.pale,
    b: C.w6,
  },
  // ── tables, seats and desks
  {
    sub: 'dining_table',
    name: 'Dining Table',
    cat: 'furniture',
    place: 'furniture',
    v: 160,
    d: 'A solid oak table that seats the whole family.',
    spec: { shape: 'table', main: 'oak', trim: 'oak' },
    make: {
      station: 'carpenter',
      inputs: [
        ['oak_plank', 6],
        ['nails', 6],
        ['glue', 1],
      ],
      lvl: 3,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'table',
    a: C.e4,
    b: C.e6,
  },
  {
    sub: 'round_table',
    name: 'Round Table',
    cat: 'furniture',
    place: 'furniture',
    v: 220,
    d: 'A cedar table with no head and no foot.',
    spec: { shape: 'table_round', main: 'cedar', trim: 'cedar' },
    make: {
      station: 'carpenter',
      inputs: [
        ['cedar_plank', 6],
        ['nails', 4],
        ['glue', 1],
      ],
      lvl: 5,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'table',
    a: C.r3,
    b: C.e4,
  },
  {
    sub: 'writing_desk',
    name: 'Writing Desk',
    cat: 'furniture',
    place: 'furniture',
    v: 260,
    d: 'A birch desk with a slanted lid and drawers.',
    spec: { shape: 'desk', main: 'birch', trim: 'brass' },
    make: {
      station: 'carpenter',
      inputs: [
        ['birch_plank', 6],
        ['nails', 6],
        ['rivets', 4],
      ],
      lvl: 6,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'table',
    a: C.pale,
    b: C.e5,
  },
  {
    sub: 'armchair',
    name: 'Armchair',
    cat: 'furniture',
    place: 'furniture',
    v: 180,
    d: 'A padded oak armchair in wool.',
    spec: { shape: 'armchair', main: 'oak', trim: 'crimson', tint: C.r3 },
    make: {
      station: 'carpenter',
      inputs: [
        ['oak_plank', 4],
        ['wool_cloth', 2],
        ['quilting', 1],
      ],
      lvl: 5,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'chair',
    a: C.r3,
    b: C.e4,
  },
  {
    sub: 'garden_bench',
    name: 'Garden Bench',
    cat: 'decor',
    place: 'furniture',
    v: 100,
    d: 'A weathered willow bench beside the path.',
    spec: { shape: 'garden_bench', main: 'willow', trim: 'iron' },
    make: {
      station: 'carpenter',
      inputs: [
        ['willow_plank', 4],
        ['iron_rod', 1],
        ['nails', 4],
      ],
      lvl: 3,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'chair',
    a: C.g4,
    b: C.e5,
  },
  // ── storage
  {
    sub: 'cabinet',
    name: 'Cabinet',
    cat: 'furniture',
    place: 'chest',
    v: 260,
    d: 'A tall oak cabinet with double doors. Holds 30 stacks, like a chest.',
    spec: { shape: 'cabinet', main: 'oak', trim: 'brass' },
    make: {
      station: 'carpenter',
      inputs: [
        ['oak_plank', 8],
        ['nails', 8],
        ['rivets', 4],
      ],
      lvl: 4,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'shelf',
    a: C.e4,
    b: C.e6,
  },
  {
    sub: 'dresser',
    name: 'Dresser',
    cat: 'furniture',
    place: 'chest',
    v: 200,
    d: 'A birch chest of drawers. Holds 30 stacks.',
    spec: { shape: 'dresser', main: 'birch', trim: 'brass' },
    make: {
      station: 'carpenter',
      inputs: [
        ['birch_plank', 6],
        ['nails', 6],
        ['rivets', 4],
      ],
      lvl: 3,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'shelf',
    a: C.pale,
    b: C.e6,
  },
  {
    sub: 'wardrobe_tall',
    name: 'Tall Wardrobe',
    cat: 'furniture',
    place: 'chest',
    v: 340,
    d: 'Cedar keeps moths out. Holds 30 stacks.',
    spec: { shape: 'wardrobe', main: 'cedar', trim: 'brass' },
    make: {
      station: 'carpenter',
      inputs: [
        ['cedar_plank', 8],
        ['nails', 8],
        ['rivets', 4],
      ],
      lvl: 6,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'shelf',
    a: C.r3,
    b: C.e6,
  },
  {
    sub: 'strongbox',
    name: 'Iron Strongbox',
    cat: 'furniture',
    place: 'chest',
    v: 320,
    d: 'A riveted iron box with a lock. Holds 30 stacks.',
    spec: { shape: 'chest', main: 'iron', trim: 'brass' },
    make: {
      station: 'forge',
      inputs: [
        ['iron_plate', 4],
        ['rivets', 8],
        ['iron_rod', 1],
      ],
      lvl: 6,
      disc: 'smithing',
      tool: 'tongs',
    },
    g: 'box',
    a: C.steel,
    b: C.e6,
  },
  {
    sub: 'sea_chest',
    name: 'Sea Chest',
    cat: 'furniture',
    place: 'chest',
    v: 240,
    d: 'A brass-bound driftwood chest salted by a hundred crossings. Holds 30 stacks.',
    spec: { shape: 'chest', main: 'cedar', trim: 'bronze' },
    make: {
      station: 'carpenter',
      inputs: [
        ['cedar_plank', 6],
        ['bronze_plate', 1],
        ['nails', 6],
      ],
      lvl: 5,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'box',
    a: C.r3,
    b: C.e5,
  },
  // ── light and warmth
  {
    sub: 'candelabra',
    name: 'Candelabra',
    cat: 'furniture',
    place: 'furniture',
    v: 150,
    d: 'Brass arms for five candles. Warm light.',
    spec: { shape: 'candelabra', main: 'brass', trim: 'brass' },
    light: { radius: 5, color: C.e6 },
    make: {
      station: 'forge',
      inputs: [
        ['bronze_plate', 1],
        ['bronze_rod', 2],
        ['wax', 3],
      ],
      lvl: 4,
      disc: 'smithing',
      tool: 'tongs',
    },
    g: 'candle',
    a: C.e6,
    b: C.e7,
  },
  {
    sub: 'chandelier',
    name: 'Chandelier',
    cat: 'furniture',
    place: 'furniture',
    v: 420,
    d: 'An iron ring crowded with candles. Floods a room with light.',
    rarity: 1,
    spec: { shape: 'chandelier', main: 'iron', trim: 'brass' },
    light: { radius: 8, color: C.e6 },
    make: {
      station: 'forge',
      inputs: [
        ['iron_rod', 4],
        ['bronze_plate', 1],
        ['wax', 6],
        ['hemp_rope', 1],
      ],
      lvl: 7,
      disc: 'smithing',
      tool: 'tongs',
    },
    g: 'lantern',
    a: C.e5,
    b: C.e7,
  },
  {
    sub: 'brazier',
    name: 'Iron Brazier',
    cat: 'furniture',
    place: 'furniture',
    v: 130,
    d: 'A bowl of embers on iron legs. Gives light and warms those who stand near.',
    spec: { shape: 'brazier', main: 'iron', trim: 'iron' },
    light: { radius: 6, color: C.r5 },
    warm: true,
    make: {
      station: 'forge',
      inputs: [
        ['iron_plate', 1],
        ['iron_rod', 3],
        ['charcoal', 4],
      ],
      lvl: 4,
      disc: 'smithing',
      tool: 'tongs',
    },
    g: 'torch',
    a: C.r5,
    b: C.steel,
  },
  {
    sub: 'fireplace',
    name: 'Stone Fireplace',
    cat: 'furniture',
    place: 'furniture',
    v: 360,
    d: 'A hearth with a chimney breast. Warms the whole room.',
    spec: { shape: 'fireplace', main: 'stone', trim: 'oak' },
    light: { radius: 6.5, color: C.r5 },
    warm: true,
    make: {
      station: 'masonry',
      inputs: [
        ['stone_brick', 12],
        ['mortar', 3],
        ['iron_rod', 2],
      ],
      lvl: 5,
      disc: 'masonry',
      tool: 'chisel',
    },
    g: 'furnace',
    a: C.mist,
    b: C.r5,
  },
  {
    sub: 'stone_lantern',
    name: 'Stone Lantern',
    cat: 'decor',
    place: 'furniture',
    v: 190,
    d: 'A carved stone lantern for a garden path. Burns with a steady glow.',
    spec: { shape: 'stone_lantern', main: 'granite', trim: 'granite', tint: C.e7 },
    light: { radius: 5.5, color: C.e6 },
    make: {
      station: 'masonry',
      inputs: [
        ['granite_block', 3],
        ['wax', 1],
      ],
      lvl: 4,
      disc: 'masonry',
      tool: 'chisel',
    },
    g: 'lantern',
    a: C.mist,
    b: C.e7,
  },
  {
    sub: 'wall_sconce',
    name: 'Wall Sconce',
    cat: 'furniture',
    place: 'furniture',
    v: 80,
    d: 'An iron torch bracket. Light without taking floor space.',
    spec: { shape: 'sconce', main: 'iron', trim: 'iron' },
    light: { radius: 4.5, color: C.e6 },
    make: {
      station: 'forge',
      inputs: [
        ['iron_rod', 1],
        ['charcoal', 1],
        ['resin', 1],
      ],
      lvl: 2,
      disc: 'smithing',
      tool: 'tongs',
    },
    g: 'torch',
    a: C.steel,
    b: C.e6,
  },
  // ── the study, the hall and the display
  {
    sub: 'grandfather_clock',
    name: 'Grandfather Clock',
    cat: 'decor',
    place: 'furniture',
    v: 520,
    d: 'Pendulum, weights and a chiming bell. Keeps good time.',
    rarity: 2,
    spec: { shape: 'clock', main: 'ebony', trim: 'brass' },
    make: {
      station: 'engineering',
      inputs: [
        ['ebony_plank', 4],
        ['gear_set', 3],
        ['spring', 2],
        ['bronze_plate', 1],
      ],
      lvl: 9,
      disc: 'engineering',
    },
    g: 'cabinet',
    a: C.night,
    b: C.e6,
  },
  {
    sub: 'globe',
    name: 'Great Globe',
    cat: 'decor',
    place: 'furniture',
    v: 260,
    d: 'A spinning map of the Eigenlands on a brass stand.',
    spec: { shape: 'globe', main: 'oak', trim: 'brass', tint: C.w4 },
    make: {
      station: 'engineering',
      inputs: [
        ['oak_plank', 3],
        ['bronze_plate', 1],
        ['glass', 2],
        ['dye_blue', 1],
      ],
      lvl: 6,
      disc: 'engineering',
    },
    g: 'compass',
    a: C.w4,
    b: C.e6,
  },
  {
    sub: 'telescope',
    name: 'Brass Telescope',
    cat: 'decor',
    place: 'furniture',
    v: 340,
    d: 'A long brass tube on a tripod. Star-gazing is better with it.',
    rarity: 1,
    spec: { shape: 'telescope', main: 'brass', trim: 'oak' },
    make: {
      station: 'engineering',
      inputs: [
        ['bronze_plate', 2],
        ['lens', 2],
        ['oak_plank', 2],
      ],
      lvl: 8,
      disc: 'engineering',
    },
    g: 'compass',
    a: C.e5,
    b: C.w6,
  },
  {
    sub: 'armor_stand',
    name: 'Armour Stand',
    cat: 'decor',
    place: 'furniture',
    v: 140,
    d: 'A wooden mannequin for showing off a set of armour.',
    spec: { shape: 'armor_stand', main: 'oak', trim: 'iron' },
    make: {
      station: 'carpenter',
      inputs: [
        ['oak_plank', 4],
        ['leather', 2],
        ['iron_rod', 1],
      ],
      lvl: 4,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'cuirass',
    a: C.steel,
    b: C.e4,
  },
  {
    sub: 'weapon_rack',
    name: 'Weapon Rack',
    cat: 'decor',
    place: 'furniture',
    v: 130,
    d: 'Pegs and a rail for swords, spears and axes.',
    spec: { shape: 'weapon_rack', main: 'pine', trim: 'iron' },
    make: {
      station: 'carpenter',
      inputs: [
        ['pine_plank', 4],
        ['iron_rod', 2],
        ['nails', 4],
      ],
      lvl: 3,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'sword',
    a: C.steel,
    b: C.e4,
  },
  {
    sub: 'display_case',
    name: 'Display Case',
    cat: 'decor',
    place: 'furniture',
    v: 280,
    d: 'A glass-topped case for treasures.',
    spec: { shape: 'display_case', main: 'birch', trim: 'brass', tint: C.w6 },
    make: {
      station: 'carpenter',
      inputs: [
        ['birch_plank', 4],
        ['glass_pane', 3],
        ['rivets', 4],
      ],
      lvl: 7,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'cabinet',
    a: C.w6,
    b: C.pale,
  },
  {
    sub: 'standing_mirror',
    name: 'Standing Mirror',
    cat: 'decor',
    place: 'furniture',
    v: 300,
    d: 'A tall silvered mirror in a carved frame.',
    rarity: 1,
    spec: { shape: 'mirror', main: 'cedar', trim: 'brass', tint: C.w6 },
    make: {
      station: 'carpenter',
      inputs: [
        ['cedar_plank', 3],
        ['glass_pane', 2],
        ['silver_plate', 1],
      ],
      lvl: 8,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'pane',
    a: C.w6,
    b: C.e5,
  },
  {
    sub: 'harp',
    name: 'Concert Harp',
    cat: 'decor',
    place: 'furniture',
    v: 420,
    d: 'Gold-leafed and strung with gut. It hums when the wind blows.',
    rarity: 2,
    spec: { shape: 'harp', main: 'willow', trim: 'gold' },
    make: {
      station: 'carpenter',
      inputs: [
        ['willow_plank', 3],
        ['sinew', 8],
        ['gold_wire', 2],
      ],
      lvl: 10,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'wand',
    a: C.e6,
    b: C.e7,
  },
  {
    sub: 'music_box',
    name: 'Music Box',
    cat: 'decor',
    place: 'furniture',
    v: 240,
    d: 'A clockwork box that plays a little tune.',
    spec: { shape: 'music_box', main: 'birch', trim: 'brass' },
    make: {
      station: 'engineering',
      inputs: [
        ['birch_plank', 2],
        ['gear_set', 1],
        ['spring', 1],
        ['bronze_rod', 1],
      ],
      lvl: 7,
      disc: 'engineering',
    },
    g: 'box',
    a: C.pale,
    b: C.e6,
  },
  {
    sub: 'tapestry',
    name: 'Woven Tapestry',
    cat: 'decor',
    place: 'furniture',
    v: 220,
    d: 'A heavy hanging of wool and dyed thread.',
    spec: { shape: 'tapestry', main: 'wool', trim: 'crimson', tint: C.r4 },
    make: {
      station: 'loom',
      inputs: [
        ['wool_cloth', 3],
        ['dye_red', 1],
        ['dye_yellow', 1],
        ['dye_blue', 1],
      ],
      lvl: 6,
      disc: 'tailoring',
    },
    g: 'rug',
    a: C.r4,
    b: C.e6,
  },
  // ── garden and yard
  {
    sub: 'bird_bath',
    name: 'Bird Bath',
    cat: 'decor',
    place: 'furniture',
    v: 130,
    d: 'A shallow stone bowl. Sparrows arrive within the hour.',
    spec: { shape: 'bird_bath', main: 'marble', trim: 'marble', tint: C.w5 },
    make: {
      station: 'masonry',
      inputs: [
        ['marble_slab', 2],
        ['limestone_block', 1],
      ],
      lvl: 5,
      disc: 'masonry',
      tool: 'chisel',
    },
    g: 'fountain',
    a: C.pale,
    b: C.w5,
  },
  {
    sub: 'sundial',
    name: 'Sundial',
    cat: 'decor',
    place: 'furniture',
    v: 150,
    d: 'A granite pedestal with a bronze gnomon. Tells the hour when the sun shines.',
    spec: { shape: 'sundial', main: 'granite', trim: 'bronze' },
    make: {
      station: 'masonry',
      inputs: [
        ['granite_block', 2],
        ['bronze_plate', 1],
      ],
      lvl: 5,
      disc: 'masonry',
      tool: 'chisel',
    },
    g: 'compass',
    a: C.mist,
    b: C.e5,
  },
  {
    sub: 'trellis',
    name: 'Garden Trellis',
    cat: 'decor',
    place: 'furniture',
    v: 80,
    d: 'A lattice for climbing roses and beans.',
    spec: { shape: 'trellis', main: 'bamboo', trim: 'forest' },
    make: {
      station: 'carpenter',
      inputs: [
        ['bamboo_plank', 4],
        ['hemp_cord', 4],
      ],
      lvl: 2,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'fence',
    a: C.g5,
    b: C.e5,
  },
  {
    sub: 'topiary',
    name: 'Clipped Topiary',
    cat: 'decor',
    place: 'furniture',
    v: 110,
    d: 'A bush trimmed into a neat sphere on a terracotta pot.',
    spec: { shape: 'topiary', main: 'brick', trim: 'forest' },
    make: {
      station: 'masonry',
      inputs: [
        ['clay_brick', 2],
        ['oak_sapling', 1],
      ],
      lvl: 3,
      disc: 'masonry',
      tool: 'chisel',
    },
    g: 'tree_sapling',
    a: C.g4,
    b: C.r4,
  },
  {
    sub: 'statue_marble',
    name: 'Marble Statue',
    cat: 'decor',
    place: 'furniture',
    v: 560,
    d: 'A robed figure with a calm face, cut from a single block.',
    rarity: 2,
    spec: { shape: 'statue', main: 'marble', trim: 'granite' },
    make: {
      station: 'masonry',
      inputs: [
        ['marble_slab', 4],
        ['granite_block', 1],
      ],
      lvl: 10,
      disc: 'masonry',
      tool: 'chisel',
    },
    g: 'statue',
    a: C.pale,
    b: C.fog,
  },
  {
    sub: 'statue_bronze',
    name: 'Bronze Statue',
    cat: 'decor',
    place: 'furniture',
    v: 600,
    d: 'A hero in bronze, green at the edges.',
    rarity: 2,
    spec: { shape: 'statue', main: 'bronze', trim: 'granite' },
    make: {
      station: 'forge',
      inputs: [
        ['bronze_plate', 5],
        ['granite_block', 1],
      ],
      lvl: 11,
      disc: 'smithing',
      tool: 'tongs',
    },
    g: 'statue',
    a: C.e4,
    b: C.g4,
  },
  {
    sub: 'rain_barrel',
    name: 'Rain Barrel',
    cat: 'decor',
    place: 'furniture',
    v: 90,
    d: 'A hooped barrel with a spout that catches rain. Looks the part at a farm gate.',
    spec: { shape: 'barrel', main: 'pine', trim: 'iron' },
    make: {
      station: 'carpenter',
      inputs: [
        ['pine_plank', 6],
        ['iron_rod', 2],
        ['pipe_copper', 1],
      ],
      lvl: 4,
      disc: 'woodworking',
      tool: 'saw',
    },
    g: 'barrel_drink',
    a: C.w4,
    b: C.e4,
  },
  // ── kingdom banners: a pattern you may sew once a kingdom counts you a friend
  {
    sub: 'banner_aurelion',
    name: 'Banner of Aurelion',
    cat: 'decor',
    place: 'furniture',
    v: 160,
    d: 'A golden sun on blue. Hang it with pride.',
    spec: { shape: 'banner', main: 'oak', trim: 'azure', tint: C.e7 },
    make: {
      station: 'loom',
      inputs: [
        ['linen_cloth', 3],
        ['dye_blue', 1],
        ['dye_yellow', 1],
        ['oak_plank', 1],
      ],
      lvl: 4,
      disc: 'tailoring',
      learn: 'realm:aurelion',
      realm: 'aurelion',
    },
    g: 'banner',
    a: C.w4,
    b: C.e7,
  },
  {
    sub: 'banner_sylvaris',
    name: 'Banner of Sylvaris',
    cat: 'decor',
    place: 'furniture',
    v: 160,
    d: 'A silver moon on deep green.',
    spec: { shape: 'banner', main: 'birch', trim: 'forest', tint: C.white },
    make: {
      station: 'loom',
      inputs: [
        ['linen_cloth', 3],
        ['dye_green', 1],
        ['dye_white', 1],
        ['birch_plank', 1],
      ],
      lvl: 4,
      disc: 'tailoring',
      learn: 'realm:sylvaris',
      realm: 'sylvaris',
    },
    g: 'banner',
    a: C.g3,
    b: C.white,
  },
  {
    sub: 'banner_khardum',
    name: 'Banner of Khardum',
    cat: 'decor',
    place: 'furniture',
    v: 160,
    d: 'A black anvil on rust red.',
    spec: { shape: 'banner', main: 'pine', trim: 'crimson', tint: C.night },
    make: {
      station: 'loom',
      inputs: [
        ['wool_cloth', 3],
        ['dye_red', 1],
        ['dye_black', 1],
        ['pine_plank', 1],
      ],
      lvl: 4,
      disc: 'tailoring',
      learn: 'realm:khardum',
      realm: 'khardum',
    },
    g: 'banner',
    a: C.r3,
    b: C.night,
  },
  {
    sub: 'banner_raijin',
    name: 'Banner of Raijin',
    cat: 'decor',
    place: 'furniture',
    v: 160,
    d: 'A white lightning bolt on indigo.',
    spec: { shape: 'banner', main: 'bamboo', trim: 'violet', tint: C.white },
    make: {
      station: 'loom',
      inputs: [
        ['cotton_cloth', 3],
        ['dye_blue', 1],
        ['dye_violet', 1],
        ['bamboo_plank', 1],
      ],
      lvl: 4,
      disc: 'tailoring',
      learn: 'realm:raijin',
      realm: 'raijin',
    },
    g: 'banner',
    a: C.q3,
    b: C.white,
  },
  {
    sub: 'banner_thalassara',
    name: 'Banner of Thalassara',
    cat: 'decor',
    place: 'furniture',
    v: 160,
    d: 'A pearl on turquoise waves.',
    spec: { shape: 'banner', main: 'willow', trim: 'azure', tint: C.pale },
    make: {
      station: 'loom',
      inputs: [
        ['cotton_cloth', 3],
        ['dye_blue', 2],
        ['dye_white', 1],
        ['willow_plank', 1],
      ],
      lvl: 4,
      disc: 'tailoring',
      learn: 'realm:thalassara',
      realm: 'thalassara',
    },
    g: 'banner',
    a: C.w3,
    b: C.pale,
  },
  {
    sub: 'banner_nethrakar',
    name: 'Banner of Nethrakar',
    cat: 'decor',
    place: 'furniture',
    v: 160,
    d: 'A flame on black.',
    spec: { shape: 'banner', main: 'ebony', trim: 'crimson', tint: C.r5 },
    make: {
      station: 'loom',
      inputs: [
        ['cotton_cloth', 3],
        ['dye_black', 1],
        ['dye_red', 2],
        ['ebony_plank', 1],
      ],
      lvl: 4,
      disc: 'tailoring',
      learn: 'realm:nethrakar',
      realm: 'nethrakar',
    },
    g: 'banner',
    a: C.night,
    b: C.r5,
  },
];

for (const r of ROWS) {
  PROP_SPECS[r.sub] = r.spec;
  if (r.light) PROP_LIGHT[r.sub] = r.light;
  if (r.warm) PROP_WARM.add(r.sub);
  item(r.sub, r.name, r.cat, {
    v: r.v,
    g: r.g!,
    a: r.a,
    b: r.b,
    d: r.d,
    rarity: r.rarity ?? 0,
    kind: 'placeable',
    stack: 20,
    place: { kind: r.place === 'station' ? 'station' : r.place === 'chest' ? 'chest' : 'furniture', sub: r.sub },
    ...(r.make.realm ? { realm: r.make.realm } : {}),
  });
  rec(r.make.station, r.make.inputs, [r.sub, 1], {
    lvl: r.make.lvl,
    disc: r.make.disc,
    xp: 12 + r.make.lvl * 3,
    hint: r.d,
    stage: 3,
    cat: r.cat,
    ...(r.make.learn ? { learn: r.make.learn } : {}),
    ...(r.make.realm ? { realm: r.make.realm } : {}),
    ...(r.make.tool ? { tool: r.make.tool } : {}),
  });
}
void src;

// ── parts the home and the workshop need
item('gear_set', 'Gear Set', 'component', {
  v: 36,
  g: 'cog',
  a: C.e5,
  b: C.e6,
  d: 'Brass cogs on a spindle. Clocks, benches and lanterns turn on them.',
});
rec(
  'forge',
  [
    ['bronze_plate', 1],
    ['bronze_rod', 1],
  ],
  ['gear_set', 2],
  { lvl: 5, disc: 'engineering', xp: 12, hint: 'Cut and file small cogs.', tool: 'tongs' },
);
item('spring', 'Spring', 'component', { v: 24, g: 'coil', a: C.steel, b: C.slate, d: 'A coiled steel spring.' });
rec('forge', [['steel_rod', 1]], ['spring', 3], {
  lvl: 9,
  disc: 'engineering',
  xp: 14,
  hint: 'Coil and temper a bar.',
  tool: 'tongs',
});
item('wax', 'Beeswax', 'component', {
  v: 8,
  g: 'resin',
  a: C.e7,
  b: C.e6,
  d: 'Pale honeycomb wax. Candles, polish and sealing.',
  src: [src.animal('bee_colony')],
});
item('oak_sapling', 'Oak Sapling', 'farm', {
  v: 30,
  g: 'tree_sapling',
  a: C.g4,
  b: C.e4,
  d: 'A young oak in a pot. Plant it, or keep it as a bonsai.',
  src: [src.forage([0, 2], 1)],
});
