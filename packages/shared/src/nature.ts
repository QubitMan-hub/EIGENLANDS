import { C } from './palette';
import { hash2 } from './rng';
import type { Weather } from './weather';

export const NATURE_HABITATS = [
  'meadow',
  'forest',
  'autumn',
  'taiga',
  'swamp',
  'desert',
  'enchanted',
  'corrupted',
  'cave:limestone',
  'cave:glowmoss',
  'cave:crystal',
  'cave:basalt',
  'cave:frost',
  'cave:drowned',
  'realm:aetheria',
  'realm:umbra',
  'realm:chronoria',
] as const;
export type NatureHabitat = (typeof NATURE_HABITATS)[number];
export interface NatureContext {
  habitat: NatureHabitat;
  nearWater: boolean;
  wooded: boolean;
  flowering: boolean;
  season: number;
  hour: number;
  weather: Weather;
}
export type FloraShape =
  | 'flower'
  | 'spike'
  | 'herb'
  | 'bush'
  | 'fern'
  | 'reed'
  | 'pad'
  | 'moss'
  | 'cactus'
  | 'succulent'
  | 'mushroom'
  | 'shelf'
  | 'coral'
  | 'fan'
  | 'vine'
  | 'cotton';
export interface FloraDef {
  id: string;
  name: string;
  habitats: readonly NatureHabitat[];
  shape: FloraShape;
  leaf: number;
  petal: number;
  height: number;
  water?: boolean;
  shade?: boolean;
  evergreen?: boolean;
}
const green: NatureHabitat[] = ['meadow', 'forest', 'autumn'];
const woods: NatureHabitat[] = ['forest', 'autumn'];
const wet: NatureHabitat[] = ['meadow', 'forest', 'swamp'];
const f = (
  id: string,
  name: string,
  habitats: readonly NatureHabitat[],
  shape: FloraShape,
  petal: number,
  height = 8,
  options: Partial<Pick<FloraDef, 'leaf' | 'water' | 'shade' | 'evergreen'>> = {},
): FloraDef => ({ id, name, habitats, shape, petal, height, leaf: C.g3, ...options });

/** Cosmetic species never occupy a tile or introduce saved terrain/item IDs. */
export const FLORA: readonly FloraDef[] = [
  f('daisy', 'Oxeye daisy', green, 'flower', C.white),
  f('buttercup', 'Meadow buttercup', ['meadow'], 'flower', C.c4, 6),
  f('poppy', 'Field poppy', ['meadow', 'autumn'], 'flower', C.c2, 9),
  f('cornflower', 'Cornflower', ['meadow'], 'flower', C.b0, 9),
  f('bluebell', 'Woodland bluebell', woods, 'spike', C.b1, 9, { shade: true }),
  f('foxglove', 'Foxglove', woods, 'spike', C.q5, 17, { shade: true }),
  f('lupin', 'Wild lupin', ['meadow', 'taiga'], 'spike', C.q4, 13),
  f('lavender', 'Wild lavender', ['meadow', 'autumn'], 'spike', C.q5, 9),
  f('yarrow', 'Yarrow', green, 'herb', C.pale, 9),
  f('thistle', 'Spear thistle', ['meadow', 'autumn'], 'spike', C.q4, 12),
  f('wild_mint', 'River mint', wet, 'herb', C.q6, 7, { water: true }),
  f('sage', 'Wild sage', ['meadow', 'desert'], 'herb', C.w4, 7, { leaf: C.g5 }),
  f('heather', 'Heather', ['autumn', 'taiga'], 'bush', C.q5, 8, { evergreen: true }),
  f('blackberry', 'Blackberry bramble', woods, 'bush', C.q1, 11),
  f('bilberry', 'Bilberry', ['forest', 'autumn', 'taiga'], 'bush', C.w2, 7),
  f('elderberry', 'Elderberry', woods, 'bush', C.q2, 15),
  f('bracken', 'Bracken', woods, 'fern', C.g4, 13, { shade: true }),
  f('horsetail', 'Horsetail', ['swamp', 'forest'], 'reed', C.g5, 13, { water: true }),
  f('cattail', 'Cattail', wet, 'reed', C.e2, 18, { water: true }),
  f('water_iris', 'Water iris', wet, 'flower', C.b0, 13, { water: true }),
  f('marsh_marigold', 'Marsh marigold', ['swamp', 'meadow'], 'flower', C.c4, 6, { water: true }),
  f('lotus', 'Bank-side lotus', ['swamp', 'enchanted'], 'pad', C.q6, 4, { water: true }),
  f('lichen', 'Stone lichen', ['taiga', 'corrupted', 'cave:limestone'], 'moss', C.e6, 2, {
    leaf: C.g5,
    evergreen: true,
  }),
  f('reindeer_moss', 'Reindeer moss', ['taiga'], 'coral', C.pale, 5, { leaf: C.mist, evergreen: true }),
  f('dwarf_willow', 'Dwarf willow', ['taiga'], 'bush', C.e5, 7),
  f('barrel_cactus', 'Barrel cactus', ['desert'], 'cactus', C.e7, 10, { evergreen: true }),
  f('prickly_pear', 'Prickly pear', ['desert'], 'cactus', C.r5, 15, { evergreen: true }),
  f('aloe', 'Desert aloe', ['desert'], 'succulent', C.e6, 9, { leaf: C.g4, evergreen: true }),
  f('desert_bloom', 'Rain lily', ['desert'], 'flower', C.r6, 7),
  f('fly_agaric', 'Fly agaric', woods, 'mushroom', C.c2, 7, { shade: true }),
  f('chanterelle', 'Chanterelle', ['forest', 'autumn', 'swamp'], 'mushroom', C.c3, 5, { shade: true }),
  f('shelf_fungus', 'Bracket fungus', ['forest', 'cave:limestone'], 'shelf', C.e4, 8, { shade: true, evergreen: true }),
  f('ghost_fern', 'Ghost fern', ['enchanted', 'corrupted'], 'fern', C.w6, 12, { leaf: C.w3, evergreen: true }),
  f('moonbell', 'Moonbell', ['enchanted'], 'spike', C.q7, 12),
  f('crystal_moss', 'Crystal moss', ['enchanted', 'cave:crystal'], 'moss', C.q6, 4, { leaf: C.w4, evergreen: true }),
  f('cave_lichen', 'Cave lichen', ['cave:limestone', 'cave:basalt', 'cave:frost'], 'moss', C.w5, 3, {
    leaf: C.w2,
    evergreen: true,
  }),
  f('cave_coral', 'Cave coral', ['cave:crystal', 'cave:frost', 'cave:drowned'], 'coral', C.w6, 9, {
    leaf: C.q3,
    evergreen: true,
  }),
  f('spore_fan', 'Spore fan', ['cave:glowmoss', 'cave:drowned', 'realm:umbra'], 'fan', C.q6, 10, {
    leaf: C.w3,
    evergreen: true,
  }),
  f('sky_lily', 'Sky lily', ['realm:aetheria'], 'flower', C.white, 11, { leaf: C.w4, evergreen: true }),
  f('cloud_cotton', 'Cloud cotton', ['realm:aetheria'], 'cotton', C.pale, 9, { evergreen: true }),
  f('ember_orchid', 'Ember orchid', ['cave:basalt', 'realm:umbra'], 'spike', C.r5, 12, { leaf: C.q2, evergreen: true }),
  f('clockvine', 'Clockvine', ['realm:chronoria'], 'vine', C.e6, 13, { leaf: C.g2, evergreen: true }),
];
export type WildlifeShape =
  | 'rodent'
  | 'spiny'
  | 'hare'
  | 'longbody'
  | 'bird'
  | 'wader'
  | 'waterbird'
  | 'frog'
  | 'newt'
  | 'turtle'
  | 'lizard'
  | 'crab'
  | 'bee'
  | 'dragonfly'
  | 'beetle'
  | 'moth';
export interface WildlifeDef {
  id: string;
  name: string;
  habitats: readonly NatureHabitat[];
  shape: WildlifeShape;
  body: number;
  accent: number;
  speed: number;
  scare: number;
  activity: 'day' | 'night' | 'twilight' | 'always';
  motion: 'walk' | 'hop' | 'flutter' | 'wade' | 'crawl';
  water?: boolean;
  shade?: boolean;
  flowers?: boolean;
  winter?: boolean;
  rain?: boolean;
}
const a = (
  id: string,
  name: string,
  habitats: readonly NatureHabitat[],
  shape: WildlifeShape,
  body: number,
  accent: number,
  options: Partial<Omit<WildlifeDef, 'id' | 'name' | 'habitats' | 'shape' | 'body' | 'accent'>> = {},
): WildlifeDef => ({
  id,
  name,
  habitats,
  shape,
  body,
  accent,
  speed: 0.65,
  scare: 2.5,
  activity: 'day',
  motion: 'walk',
  ...options,
});
export const WILDLIFE: readonly WildlifeDef[] = [
  a('squirrel', 'Red squirrel', woods, 'rodent', C.e4, C.e6, { shade: true, speed: 1.4, winter: true }),
  a('chipmunk', 'Striped chipmunk', ['forest', 'autumn', 'taiga'], 'rodent', C.e3, C.pale, { shade: true, speed: 1.2 }),
  a('hedgehog', 'Hedgehog', green, 'spiny', C.e2, C.e5, { activity: 'night', motion: 'crawl', speed: 0.35 }),
  a('hare', 'Brown hare', ['meadow', 'autumn', 'taiga'], 'hare', C.e4, C.pale, {
    activity: 'twilight',
    motion: 'hop',
    speed: 1.5,
    winter: true,
    scare: 4,
  }),
  a('stoat', 'Stoat', ['forest', 'autumn', 'taiga'], 'longbody', C.e5, C.white, { winter: true, speed: 1.1 }),
  a('vole', 'Field vole', green, 'rodent', C.e2, C.e4, { activity: 'always', speed: 0.8, winter: true }),
  a('robin', 'Robin', green, 'bird', C.e3, C.c2, { motion: 'hop', winter: true }),
  a('woodpecker', 'Spotted woodpecker', woods, 'bird', C.slate, C.r5, { shade: true, motion: 'hop', winter: true }),
  a('kingfisher', 'Kingfisher', wet, 'bird', C.w4, C.e5, { water: true, motion: 'flutter', speed: 1.1 }),
  a('heron', 'Grey heron', wet, 'wader', C.mist, C.e6, { water: true, motion: 'wade', speed: 0.35, scare: 4 }),
  a('duck', 'Mallard', wet, 'waterbird', C.e3, C.g4, { water: true, motion: 'wade', rain: true, winter: true }),
  a('goose', 'Greylag goose', ['meadow', 'swamp'], 'waterbird', C.fog, C.e6, {
    water: true,
    motion: 'wade',
    rain: true,
    winter: true,
    scare: 1.8,
  }),
  a('frog', 'Pond frog', wet, 'frog', C.g4, C.e7, { water: true, activity: 'always', motion: 'hop', rain: true }),
  a('toad', 'Common toad', woods, 'frog', C.e2, C.e4, { activity: 'night', motion: 'crawl', rain: true, shade: true }),
  a('terrapin', 'Pond terrapin', ['swamp', 'meadow'], 'turtle', C.g2, C.e6, {
    water: true,
    motion: 'crawl',
    speed: 0.2,
    scare: 1,
  }),
  a('newt', 'Smooth newt', wet, 'newt', C.e2, C.e5, {
    water: true,
    activity: 'always',
    motion: 'crawl',
    rain: true,
    speed: 0.35,
  }),
  a('lizard', 'Sand lizard', ['desert', 'meadow'], 'lizard', C.g3, C.e5, { motion: 'crawl', speed: 1.1 }),
  a('gecko', 'Dune gecko', ['desert'], 'lizard', C.e5, C.e7, { activity: 'night', motion: 'crawl', speed: 0.8 }),
  a('desert_hare', 'Desert hare', ['desert'], 'hare', C.e6, C.pale, {
    activity: 'twilight',
    motion: 'hop',
    speed: 1.5,
    winter: true,
  }),
  a('crab', 'Shore crab', ['meadow', 'desert', 'swamp'], 'crab', C.r3, C.e5, {
    water: true,
    motion: 'crawl',
    rain: true,
    speed: 0.5,
  }),
  a('sandpiper', 'Sandpiper', ['meadow', 'desert'], 'wader', C.e4, C.pale, { water: true, motion: 'wade', speed: 0.9 }),
  a('bee', 'Bumblebee', green, 'bee', C.c4, C.ink, { flowers: true, motion: 'flutter', speed: 0.7, scare: 0.8 }),
  a('dragonfly', 'Blue dragonfly', wet, 'dragonfly', C.w5, C.pale, { water: true, motion: 'flutter', speed: 1.2 }),
  a('ladybird', 'Seven-spot ladybird', green, 'beetle', C.c2, C.ink, {
    flowers: true,
    motion: 'crawl',
    speed: 0.2,
    scare: 0.5,
  }),
  a('moth', 'Garden moth', green, 'moth', C.e4, C.e6, { activity: 'night', motion: 'flutter', speed: 0.5 }),
  a('glowmoth', 'Luminous moth', ['enchanted', 'cave:glowmoss'], 'moth', C.q5, C.q7, {
    activity: 'always',
    motion: 'flutter',
    winter: true,
    rain: true,
  }),
  a('crystal_beetle', 'Crystal beetle', ['cave:crystal', 'cave:limestone', 'corrupted'], 'beetle', C.w4, C.q7, {
    activity: 'always',
    motion: 'crawl',
    winter: true,
    rain: true,
  }),
  a('cave_newt', 'Blind cave newt', ['cave:drowned', 'cave:frost', 'cave:basalt'], 'newt', C.pale, C.w4, {
    activity: 'always',
    motion: 'crawl',
    winter: true,
    rain: true,
    speed: 0.3,
  }),
  a('sky_swallow', 'Sky swallow', ['realm:aetheria'], 'bird', C.w4, C.white, {
    activity: 'always',
    motion: 'flutter',
    winter: true,
    rain: true,
    speed: 1.4,
  }),
  a('lantern_moth', 'Lantern moth', ['realm:umbra'], 'moth', C.q3, C.e7, {
    activity: 'always',
    motion: 'flutter',
    winter: true,
    rain: true,
  }),
  a('clockwork_wren', 'Clockwork wren', ['realm:chronoria'], 'bird', C.e4, C.e7, {
    activity: 'always',
    motion: 'hop',
    winter: true,
    rain: true,
  }),
];
export const FLORA_BY_ID: Readonly<Record<string, FloraDef>> = Object.fromEntries(FLORA.map((s) => [s.id, s]));
export const WILDLIFE_BY_ID: Readonly<Record<string, WildlifeDef>> = Object.fromEntries(WILDLIFE.map((s) => [s.id, s]));

export function floraFor(c: NatureContext, roll: number): FloraDef | null {
  const pool = FLORA.filter(
    (s) => s.habitats.includes(c.habitat) && (!s.water || c.nearWater) && (!s.shade || c.wooded),
  );
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))] ?? null;
}
/** A species patch spans several scenery cells, rather than a different plant on every tile. */
export function floraPatchAt(seed: number, x: number, y: number, c: NatureContext): FloraDef | null {
  return floraFor(c, hash2(seed, Math.floor(x / 24), Math.floor(y / 24), 17201));
}
export function wildlifeFor(c: NatureContext): readonly WildlifeDef[] {
  const night = c.hour >= 19 || c.hour < 6;
  return WILDLIFE.filter(
    (s) =>
      s.habitats.includes(c.habitat) &&
      (!s.water || c.nearWater) &&
      (!s.shade || c.wooded) &&
      (!s.flowers || c.flowering) &&
      (c.season !== 3 || s.winter) &&
      ((c.weather !== 'rain' && c.weather !== 'storm' && c.weather !== 'snow') || s.rain) &&
      (s.activity === 'always' ||
        (s.activity === 'night' ? night : s.activity === 'twilight' ? c.hour < 9 || c.hour >= 17 : !night)),
  );
}
