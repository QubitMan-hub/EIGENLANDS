import { portElevation, portChannel } from './settlements';
import { isUpperY } from './floors';
import { sanctuaryTileAt } from './sanctuaries';
import { spacedTree } from './distribution';
import { CHUNK_SIZE } from './constants';
import { hash2 } from './rng';
import { Simplex2D } from './simplex';
import { T } from './tiles';
import { townTileAt } from './town';
import { CAVE_OY, caveTileAt, isCaveY } from './caves';

/**
 * Biomes, in a fixed order (the index is packed into the client's terrain texture).
 * meadow: the home vale; forest: dense old woods; autumn: red-gold woodland; taiga: snowy pine slopes;
 * swamp: pools, reeds and dead trees; desert: dunes and cacti; enchanted: flux-rich glowing glades;
 * corrupted: decohered wastes of dead wood and crystal.
 */
export const BIOMES = ['meadow', 'forest', 'autumn', 'taiga', 'swamp', 'desert', 'enchanted', 'corrupted'] as const;
export type Biome = typeof BIOMES[number];
export const BIOME_NAMES: Record<Biome, string> = {
  meadow: 'Phase Meadows', forest: 'Superposition Forest', autumn: 'Amberwood', taiga: 'Bloch Tundra',
  swamp: 'Decoherence Fen', desert: 'Interference Desert', enchanted: 'Entangled Glade', corrupted: 'Decoherence Wastes',
};
/** the home vale (spawn and Hadamere) is always meadow; biomes fade in beyond this radius */
export const HOME_VALE = 78;

interface Layers {
  height: Simplex2D;
  moisture: Simplex2D;
  temperature: Simplex2D;
  flux: Simplex2D;
  forest: Simplex2D;
  meadow: Simplex2D;
  rocky: Simplex2D;
  sea: Simplex2D;
}

const layerCache = new Map<number, Layers>();
function layers(seed: number): Layers {
  let l = layerCache.get(seed);
  if (!l) {
    l = {
      height: new Simplex2D(seed ^ 0x1111),
      moisture: new Simplex2D(seed ^ 0x2222),
      temperature: new Simplex2D(seed ^ 0x3333),
      flux: new Simplex2D(seed ^ 0x4444),
      forest: new Simplex2D(seed ^ 0x5555),
      meadow: new Simplex2D(seed ^ 0x6666),
      rocky: new Simplex2D(seed ^ 0x7777),
      sea: new Simplex2D(seed ^ 0x8888),
    };
    if (layerCache.size > 8) layerCache.clear();
    layerCache.set(seed, l);
  }
  return l;
}

/** the home continent ends here: open sea begins between these radii */
export const SEA_START = 150;
export const SEA_FULL = 230;

export interface ClimateSample {
  height: number;
  moisture: number;
  temperature: number;
  flux: number;
}

// Bounded Float64 blocks preserve every generated value while sharing cold work between
// terrain, scenery and (in solo) authority. No per-tile object/string cache or periodic global clear.
interface ClimateBlock {seed:number;cx:number;cy:number;data:Float64Array;biomes?:Uint8Array}
const climateBlocks=new Map<string,ClimateBlock>();let lastClimate:ClimateBlock|undefined;
export function sampleClimate(seed:number,x:number,y:number):ClimateSample {
  if(!Number.isInteger(x)||!Number.isInteger(y))return computeClimate(seed,x,y);
  const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE);let b=lastClimate;
  if(!b||b.seed!==seed||b.cx!==cx||b.cy!==cy){
    const k=`${seed}:${cx},${cy}`;b=climateBlocks.get(k);
    if(b)climateBlocks.delete(k);else b={seed,cx,cy,data:new Float64Array(CHUNK_SIZE*CHUNK_SIZE*4).fill(NaN)};
    climateBlocks.set(k,b);if(climateBlocks.size>96)climateBlocks.delete(climateBlocks.keys().next().value!);lastClimate=b;
  }
  const i=((y-cy*CHUNK_SIZE)*CHUNK_SIZE+x-cx*CHUNK_SIZE)*4,a=b.data;
  if(!Number.isNaN(a[i]))return{height:a[i]!,moisture:a[i+1]!,temperature:a[i+2]!,flux:a[i+3]!};
  const c=computeClimate(seed,x,y);a.set([c.height,c.moisture,c.temperature,c.flux],i);return c;
}

function computeClimate(seed: number, x: number, y: number): ClimateSample {
  const l = layers(seed);
  let height = l.height.fbm(x / 48, y / 48, 4);
  // keep the spawn area dry land
  const dist = Math.hypot(x, y);
  height += Math.max(0, 1 - dist / 22) * 0.8;
  // beyond the home continent lies the sea: a ring of open water broken by islands and archipelagos
  const ring = smooth(dist, SEA_START, SEA_FULL);
  if (ring > 0) {
    const isles = l.sea.fbm(x / 58 + 700, y / 58 - 700, 4) + 0.35 * l.sea.fbm(x / 21 - 300, y / 21 + 300, 2);
    height = height * (1 - ring) + ring * (isles * 1.15 - 0.52);
  }
  height += portElevation(x, y);
  if (portChannel(x, y)) height = Math.min(height, -0.36);
  return {
    height,
    moisture: l.moisture.fbm(x / 64 + 100, y / 64 - 100, 3),
    temperature: l.temperature.fbm(x / 96 - 50, y / 96 + 50, 2),
    flux: l.flux.fbm(x / 36, y / 36, 2),
  };
}

const biomeCache = new Map<number, Biome>();
/** Which biome a tile belongs to: climate (temperature, moisture, quantum flux) with ragged, noise-jittered borders. */
export function biomeAt(seed: number, x: number, y: number): Biome {
  if (isCaveY(y)) y -= CAVE_OY;                                    // the Undercroft takes the biome of the land above
  if(Number.isInteger(x)&&Number.isInteger(y)){
    const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE),prepared=climateBlocks.get(`${seed}:${cx},${cy}`)?.biomes;
    if(prepared)return BIOMES[prepared[(y-cy*CHUNK_SIZE)*CHUNK_SIZE+x-cx*CHUNK_SIZE]!]!;
  }
  const k = ((x & 0xffff) << 16) ^ (y & 0xffff) ^ (seed << 3);
  const hit = biomeCache.get(k);
  if (hit) return hit;
  const b = computeBiome(seed, x, y);
  if (biomeCache.size > 200_000) biomeCache.clear();
  biomeCache.set(k, b);
  return b;
}

function computeBiome(seed: number, x: number, y: number): Biome {
  const dist = Math.hypot(x, y);
  if (dist < HOME_VALE) return 'meadow';
  const l = layers(seed);
  // biome fields are much broader than the terrain's climate, so each biome is a region worth exploring
  const j = l.meadow.fbm(x / 11 + 911, y / 11 - 377, 2) * 0.05;     // ragged borders
  // the vale's edge is a soft, noisy frontier rather than a ring
  if (smooth(dist, HOME_VALE, HOME_VALE + 45) < 0.5 + l.rocky.fbm(x / 23, y / 23, 2)) return 'meadow';
  const t = l.temperature.fbm(x / 170 + 31, y / 170 - 77, 3) + j;
  const m = l.moisture.fbm(x / 150 + 400, y / 150 - 400, 3) - j;
  const f = l.flux.fbm(x / 130 - 900, y / 130 + 900, 2);
  if (f > 0.42) return 'enchanted';
  if (f < -0.45) return 'corrupted';
  if (t < -0.2) return 'taiga';
  if (t > 0.2 && m < 0.0) return 'desert';
  if (m > 0.2) return 'swamp';
  if (t < -0.02) return 'autumn';
  if (m > -0.04) return 'forest';
  return 'meadow';
}

/** Shared coherent undergrowth field: sprites and generated plants follow the same pockets of shelter. */
export function vegetationCover(seed: number, x: number, y: number): number {
  if (isCaveY(y)) y -= CAVE_OY;
  return smooth(layers(seed).forest.noise(x / 9 + 71, y / 9 - 71), -0.3, 0.45);
}

const CAMP_CELL = 48;
function campCenter(seed: number, cellX: number, cellY: number): { x: number; y: number } | null {
  if (hash2(seed, cellX, cellY, 91) > 0.35) return null;
  const x = cellX * CAMP_CELL + 6 + Math.floor(hash2(seed, cellX, cellY, 92) * (CAMP_CELL - 12));
  const y = cellY * CAMP_CELL + 6 + Math.floor(hash2(seed, cellX, cellY, 93) * (CAMP_CELL - 12));
  if (Math.hypot(x, y) < 12) return null; // spawn shrine owns the origin
  if (sampleClimate(seed, x, y).height < -0.1) return null;
  return { x, y };
}

/** Original surface layout remains the placement reference for persistent landmark IDs. */
export function landmarkTileAt(seed: number, x: number, y: number): number { return surfaceTileAt(seed, x, y, true); }

export function tileAt(seed: number, x: number, y: number): number { return surfaceTileAt(seed, x, y, false); }

function surfaceTileAt(seed: number, x: number, y: number, legacy: boolean): number {
  const sanctuary = sanctuaryTileAt(seed, x, y); if (sanctuary !== null) return sanctuary;
  if (isCaveY(y)) return townTileAt(seed, x, y) ?? caveTileAt(seed, x, y, legacy);
  const tt = townTileAt(seed, x, y);
  if (tt !== null) return tt;
  if (isUpperY(y)) return T.UPPER_VOID;
  // Spawn shrine: path disc, four torches.
  const r0 = Math.hypot(x, y);
  if (Math.abs(x) === 3 && Math.abs(y) === 3) return T.TORCH;
  if (r0 <= 2.6) return T.PATH;

  const cx = Math.floor(x / CAMP_CELL);
  const cy = Math.floor(y / CAMP_CELL);
  const camp = campCenter(seed, cx, cy);
  if (camp) {
    const dx = x - camp.x;
    const dy = y - camp.y;
    if (dx === 0 && dy === 0) return T.TORCH;
    if (Math.hypot(dx, dy) <= 1.6) return T.PATH;
  }

  const c = sampleClimate(seed, x, y);
  if (c.height < -0.42) return T.DEEP_WATER;
  if (c.height < -0.28) return T.WATER;
  const biome = biomeAt(seed, x, y);
  if (c.height < -0.2 || biome === 'desert') {
    // dunes: open sand with rare scrub, cacti and wind-cut boulders
    if (biome !== 'desert') return T.SAND;
    const r = hash2(seed, x, y, 31);
    if (r < 0.012) return legacy || spacedTree(seed, x, y) ? T.TREE : T.SAND; // cactus
    if (r < 0.02) return T.ROCK;
    if (r < 0.026) return hash2(seed, legacy ? x : Math.floor(x / 10), legacy ? y : Math.floor(y / 10), 32) < 0.3 ? T.ORE_GOLD : T.ORE_COPPER;
    if (r < 0.05) return T.GRASS_TALL;                          // dry scrub
    return T.SAND;
  }

  const r = hash2(seed, x, y, 1);
  const shimmerP = biome === 'enchanted' ? 0.06 : biome === 'corrupted' ? 0.02 : 0.035;
  if (c.flux > (biome === 'enchanted' ? 0.3 : 0.55) && r < shimmerP) return T.SHIMMER;

  const l = layers(seed);
  const shoreDist = Math.max(0, c.height + 0.2); // 0 at the sand line, grows inland

  // fen: scattered pools and reed beds between the dead trees
  if (biome === 'swamp') {
    const pool = l.sea.fbm(x / 7 + 55, y / 7 - 55, 2);
    if (pool > 0.32) return T.WATER;
    if (pool > 0.22) return hash2(seed, x, y, 33) < 0.6 ? T.GRASS_TALL : T.GRASS;
  }

  // groves and clearings: trees follow a low-frequency density field instead of uniform noise
  const forest = l.forest.fbm(x / 70 + 40, y / 70 - 40, 3);
  const grove = smooth(forest, 0.02, 0.35);
  const woody = biome === 'forest' ? 0.12 + 0.6 * grove : biome === 'autumn' ? 0.1 + 0.5 * grove : biome === 'taiga' ? 0.05 + 0.4 * grove
    : biome === 'swamp' ? 0.05 : biome === 'enchanted' ? 0.04 + 0.35 * grove : biome === 'corrupted' ? 0.03 : 0.5 * grove * (0.55 + 0.45 * Math.max(0, c.moisture + 0.3));
  const treeP = (0.004 + woody) * Math.min(1, shoreDist * 6);
  if (hash2(seed, x, y, 2) < treeP && r0 > 7 && (legacy || spacedTree(seed, x, y))) return T.TREE;

  // boulder fields on rocky ground; ore outcrops get richer the further you roam from the shrine
  const rocky = l.rocky.fbm(x / 45 - 90, y / 45 + 90, 3);
  const rockBias = biome === 'taiga' ? 0.04 : biome === 'corrupted' ? 0.05 : 0;
  const rockP = 0.003 + rockBias + 0.2 * smooth(rocky, 0.35, 0.65);
  const rr = hash2(seed, x, y, 3);
  if (rr < rockP && r0 > 7) {
    // One mineral family per geological pocket; rock positions and overall tier rates remain compatible.
    const o = legacy ? hash2(seed, x, y, 6) : hash2(seed, Math.floor(x / 10), Math.floor(y / 10), 6);
    if ((c.flux > 0.42 || biome === 'corrupted' || biome === 'enchanted') && o < (biome === 'corrupted' ? 0.3 : 0.1)) return T.CRYSTAL;
    if (r0 > 150 && o < 0.1) return T.ORE_GOLD;
    if ((r0 > 90 || biome === 'taiga') && o < 0.2) return T.ORE_SILVER;
    if (r0 > 40 && o < 0.3) return T.ORE_IRON;
    if (o < 0.4 + 0.1 * smooth(rocky, 0.5, 0.7)) return T.ORE_COPPER;
    if (legacy || rocky > 0.12 || rr < 0.0015) return T.ROCK;
  }

  // forageables cluster near groves (and fen hummocks)
  if (hash2(seed, x, y, 9) < 0.004 + 0.05 * grove + (biome === 'swamp' ? 0.02 : 0) && r0 > 6) return T.FORAGE;

  // flower meadows and tall-grass patches
  const meadow = l.meadow.fbm(x / 20 + 300, y / 20 - 300, 2);
  const cover = legacy ? 1 : vegetationCover(seed, x, y);
  const flowerK = biome === 'taiga' || biome === 'corrupted' ? 0.12 : biome === 'enchanted' ? 0.8 : legacy ? 0.5 : 0.28;
  if (hash2(seed, x, y, 4) < flowerK * (legacy ? 1 : 0.15 + 0.85 * cover) * smooth(meadow, 0.2, 0.55) * (0.5 + 0.5 * Math.max(0, c.moisture + 0.4))) return T.FLOWERS;
  const tall = l.meadow.fbm(x / 14 - 500, y / 14 + 500, 2);
  if (hash2(seed, x, y, 5) < (legacy ? 0.04 + 0.55 * smooth(tall, 0.05, 0.5) : 0.006 + 0.36 * smooth(tall, 0.05, 0.5) * cover)) return T.GRASS_TALL;
  return T.GRASS;
}

function smooth(v: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const generatedChunks=new Map<string,Uint8Array>();
export function generateChunk(seed: number, cx: number, cy: number): Uint8Array {
  const key=`${seed}:${cx},${cy}`,cached=generatedChunks.get(key);
  if(cached){generatedChunks.delete(key);generatedChunks.set(key,cached);return cached.slice();}
  const out = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const ox = cx * CHUNK_SIZE;
  const oy = cy * CHUNK_SIZE;
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      out[y * CHUNK_SIZE + x] = tileAt(seed, ox + x, oy + y);
    }
  }
  generatedChunks.set(key,out.slice());
  if(generatedChunks.size>128)generatedChunks.delete(generatedChunks.keys().next().value!);
  return out;
}

/** Transferable deterministic base data; mutable edits and ownership never enter this cache. */
export interface PreparedWorldChunk {seed:number;cx:number;cy:number;tiles:Uint8Array;climate:Float64Array;biomes:Uint8Array}
export function prepareWorldChunk(seed:number,cx:number,cy:number):PreparedWorldChunk{
 const tiles=generateChunk(seed,cx,cy),climate=new Float64Array(CHUNK_SIZE*CHUNK_SIZE*4),biomes=new Uint8Array(CHUNK_SIZE*CHUNK_SIZE);
 for(let y=0;y<CHUNK_SIZE;y++)for(let x=0;x<CHUNK_SIZE;x++){
  const tx=cx*CHUNK_SIZE+x,ty=cy*CHUNK_SIZE+y,i=y*CHUNK_SIZE+x,c=sampleClimate(seed,tx,ty);
  climate.set([c.height,c.moisture,c.temperature,c.flux],i*4);biomes[i]=BIOMES.indexOf(biomeAt(seed,tx,ty));
 }
 return{seed,cx,cy,tiles,climate,biomes};
}
export function hasPreparedWorldChunk(seed:number,cx:number,cy:number):boolean{
 return generatedChunks.has(`${seed}:${cx},${cy}`)&&!!climateBlocks.get(`${seed}:${cx},${cy}`)?.biomes;
}
export function acceptPreparedWorldChunk(p:PreparedWorldChunk):void{
 if(p.tiles.length!==CHUNK_SIZE*CHUNK_SIZE||p.climate.length!==CHUNK_SIZE*CHUNK_SIZE*4||p.biomes.length!==CHUNK_SIZE*CHUNK_SIZE)throw new Error('invalid prepared chunk');
 const key=`${p.seed}:${p.cx},${p.cy}`;
 generatedChunks.delete(key);generatedChunks.set(key,p.tiles.slice());if(generatedChunks.size>128)generatedChunks.delete(generatedChunks.keys().next().value!);
 const block={seed:p.seed,cx:p.cx,cy:p.cy,data:p.climate.slice(),biomes:p.biomes.slice()};
 climateBlocks.delete(key);climateBlocks.set(key,block);if(climateBlocks.size>96)climateBlocks.delete(climateBlocks.keys().next().value!);lastClimate=block;
}
