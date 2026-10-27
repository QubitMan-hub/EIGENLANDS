import { C } from './palette';
import { PEN_DATA } from './catalog/pen-data';
import { PROP_LIGHT } from './catalog/home';
import { T } from './tiles';

/** Things placed on top of the tile grid. Persisted per chunk (crops, stations...) or static (town furnishing). */
export type WorldObjKind =
  'crop' | 'station' | 'sprinkler' | 'shelter' | 'chest' | 'furniture' | 'sign' | 'deco' | 'structure';

export interface WorldObj {
  x: number;
  y: number;
  kind: WorldObjKind;
  sub: string;
  /** account id of the player who placed/planted it; undefined for town/static objects */
  owner?: string;
  /** kind-specific state: CropData for crops, {animals,fed,ready} for shelters, slots for chests, text for signs */
  data?: Record<string, unknown>;
  /** true = part of the generated town; never saved, never removable */
  static?: boolean;
}

/** Objects that block movement. Crops, rugs and sprinklers can be walked over. */
export function objSolid(kind: WorldObjKind, sub: string): boolean {
  if (
    [
      'guild_clue',
      'mine_rail',
      'minecart',
      'cave_seal',
      'stairs_up',
      'stairs_down',
      'dive_gate',
      'dive_exit',
      'vault_plate',
    ].includes(sub)
  )
    return false;
  if (kind === 'crop' || kind === 'sprinkler') return false;
  if (sub === 'sea_cache' || sub === 'rug' || sub === 'shrine_altar' || sub === 'shrine_pillar') return false;
  if (sub === 'crypt_bones') return false; // scattered bones underfoot // resonance projections leave no invisible collision after completion
  return true;
}

/** Which wall a prop backs onto: a wall behind (north-east) faces it south-west, one to the north-west faces it
 * south-east. The client draws that orientation and collision lays out multi-tile footprints the same way. */
export type PropFacing = 'sw' | 'se';
export function propFacing(isWall: (x: number, y: number) => boolean, x: number, y: number): PropFacing {
  if (isWall(x, y - 1)) return 'sw';
  if (isWall(x - 1, y)) return 'se';
  return 'sw';
}

/**
 * Extra tiles a large prop's artwork stands on, as (along, out) offsets: `along` runs beside the wall it backs onto,
 * `out` away from it. Their collision matches the art so nobody walks through a carousel or a market counter.
 */
const SQUARE = (r: number): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (a || b) out.push([a, b]);
  return out;
};
const FOOTPRINTS: Record<string, Array<[number, number]>> = {
  stall: [[1, 0]],
  ferris_wheel: [
    [-1, 0],
    [1, 0],
  ],
  carousel: SQUARE(1),
  circus_tent: SQUARE(1),
  statue: SQUARE(2),
  realm_gate: [
    [-1, 0],
    [1, 0],
  ],
};
/** Additional solid tiles (beyond the object's own) for a prop at (x, y) with the given facing. */
export function objFootprint(sub: string, x: number, y: number, facing: PropFacing = 'sw'): Array<[number, number]> {
  const f = FOOTPRINTS[sub.startsWith('stall') ? 'stall' : sub];
  if (!f) return [];
  return f.map(([a, b]) => (facing === 'sw' ? [x + a, y + b] : [x + b, y + a]));
}

/**
 * The footprint a prop actually claims on generated ground: facing from the walls around it, and never a tile within
 * two steps of a doorway, so a counter or ride can't seal a front door's approach.
 */
export function propFootprint(
  sub: string,
  x: number,
  y: number,
  tile: (x: number, y: number) => number,
): Array<[number, number]> {
  const fp = objFootprint(
    sub,
    x,
    y,
    propFacing((wx, wy) => tile(wx, wy) === T.WALL || tile(wx, wy) === T.FACE, x, y),
  );
  if (!fp.length) return fp;
  return fp.filter(([fx, fy]) => {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) if (tile(fx + dx, fy + dy) === T.DOOR) return false;
    return true;
  });
}

export interface ObjLight {
  radius: number;
  color: number;
}
export function objLight(kind: WorldObjKind, sub: string): ObjLight | null {
  if (['dive_gate', 'dive_exit', 'coral_column'].includes(sub)) return { radius: 4, color: C.w6 };
  if (sub === 'glow_mushrooms') return { radius: 4.5, color: C.w6 };
  if (sub === 'bell_pylon') return { radius: 4, color: C.q4 };
  if (sub === 'magma_fall') return { radius: 3.5, color: C.r5 };
  if (sub === 'cave_waterfall') return { radius: 2, color: C.w4 };
  if (sub === 'lamp' || sub === 'street_lamp' || sub === 'cave_lamp') return { radius: 5.5, color: C.e6 };
  if (PROP_LIGHT[sub]) return PROP_LIGHT[sub]!;
  if (sub === 'campfire') return { radius: 7, color: C.e6 };
  if (sub.startsWith('realm_portal_') || sub.startsWith('realm_return_'))
    return { radius: 5, color: sub.endsWith('umbra') ? C.q5 : sub.endsWith('chronoria') ? C.mist : C.w6 };
  if (sub === 'updraft') return { radius: 2.5, color: C.w6 };
  if (sub === 'sky_bloom') return { radius: 2, color: C.white };
  if (sub === 'umbral_cap') return { radius: 3.5, color: C.q5 };
  if (sub === 'umbral_obelisk') return { radius: 2, color: C.q4 };
  if (sub === 'hollow_lamp') return { radius: 6.5, color: C.e6 };
  if (sub === 'chrono_rift') return { radius: 3, color: C.q6 };
  if (sub === 'time_sand') return { radius: 2, color: C.e6 };
  if (sub === 'chrono_gate') return { radius: 3, color: C.q4 };
  if (sub.startsWith('realm_altar_')) return { radius: 3.5, color: sub.endsWith('umbra') ? C.q5 : C.e6 };
  if (sub === 'fallen_star') return { radius: 7.5, color: C.w6 };
  if (sub === 'merchant_cart') return { radius: 3.5, color: C.e6 };
  if (sub === 'trial_brazier') return { radius: 5, color: C.q5 };
  if (sub === 'vault_plate') return { radius: 1.5, color: C.q4 };
  if (sub === 'hearth') return { radius: 5, color: C.r5 };
  if (sub === 'candles') return { radius: 3.5, color: C.e6 };
  if (sub === 'cauldron') return { radius: 2, color: C.q7 };
  if (sub === 'ruin_crystal') return { radius: 4, color: C.q7 };
  if (sub === 'cave_mouth') return { radius: 3, color: C.e6 };
  if (sub === 'cave_lift') return { radius: 6, color: C.e6 };
  if (sub === 'cave_altar') return { radius: 5, color: C.q5 };
  if (sub === 'cave_ladder') return { radius: 6, color: C.pale }; // daylight down the shaft
  if (sub === 'ruin_monolith') return { radius: 4, color: C.q5 };
  if (sub === 'statue') return { radius: 6, color: C.q5 };
  if (sub === 'waystone') return { radius: 4.5, color: C.w6 };
  if (sub === 'realm_gate') return { radius: 7, color: C.q5 };
  if (sub === 'ferry_post') return { radius: 4, color: C.e6 };
  if (sub === 'shrine_altar') return { radius: 5, color: C.q5 };
  if (sub === 'phase_lantern') return { radius: 4.5, color: C.q5 };
  if (sub === 'forge' || sub === 'furnace') return { radius: 3.5, color: C.r5 };
  if (sub === 'cooking_pot') return { radius: 3, color: C.e5 };
  if (sub === 'alchemy') return { radius: 2.5, color: C.q5 };
  if (kind === 'crop' && sub.startsWith('*')) return { radius: 1.6, color: C.q5 };
  return null;
}

export const objKey = (x: number, y: number): number => x * 4194304 + y + 2097152 * 0; // unique for |coords| < 2M

export interface ShelterDef {
  max: number;
  animal: string;
  product: string;
  name: string;
  animalName: string;
  productName: string;
}
export const FARM_ANIMALS: Record<string, ShelterDef> = {
  coop: { max: 4, animal: 'chicken', product: 'egg', name: 'Chicken coop', animalName: 'chicken', productName: 'eggs' },
  barn: { max: 4, animal: 'cow', product: 'milk', name: 'Barn', animalName: 'cow', productName: 'milk' },
};
// the catalog's pens (sheep, goats, pigs, bees) are data too
for (const p of PEN_DATA)
  FARM_ANIMALS[p.sub] = {
    max: p.max,
    animal: p.animal,
    product: p.product,
    name: p.name,
    animalName: p.animalName.toLowerCase(),
    productName: p.productName,
  };

/** Crops within this Chebyshev radius of a Phase Lantern are protected from the season (greenhouse effect). */
export const LANTERN_RADIUS = 2;
/** Sprinkler reach: 'sprinkler1' waters orthogonal neighbours, 'sprinkler2' all 8 neighbours. */
export const sprinklerCovers = (sub: string, dx: number, dy: number): boolean =>
  sub === 'sprinkler3'
    ? Math.max(Math.abs(dx), Math.abs(dy)) <= 2
    : sub === 'sprinkler2'
      ? Math.max(Math.abs(dx), Math.abs(dy)) === 1
      : Math.abs(dx) + Math.abs(dy) === 1;
/** How far from a sprinkler its water can reach, in tiles. */
export const sprinklerReach = (sub: string): number => (sub === 'sprinkler3' ? 2 : 1);
