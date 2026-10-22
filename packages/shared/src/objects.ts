import { C } from './palette';

/** Things placed on top of the tile grid. Persisted per chunk (crops, stations...) or static (town furnishing). */
export type WorldObjKind = 'crop' | 'station' | 'sprinkler' | 'shelter' | 'chest' | 'furniture' | 'sign' | 'deco';

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
  if (kind === 'crop' || kind === 'sprinkler') return false;
  if (sub === 'rug') return false;
  return true;
}

export interface ObjLight { radius: number; color: number }
export function objLight(kind: WorldObjKind, sub: string): ObjLight | null {
  if (sub === 'lamp') return { radius: 5.5, color: C.e6 };
  if (sub === 'hearth') return { radius: 5, color: C.r5 };
  if (sub === 'candles') return { radius: 3.5, color: C.e6 };
  if (sub === 'cauldron') return { radius: 2, color: C.q7 };
  if (sub === 'ruin_crystal') return { radius: 4, color: C.q7 };
  if (sub === 'ruin_monolith') return { radius: 4, color: C.q5 };
  if (sub === 'statue') return { radius: 6, color: C.q5 };
  if (sub === 'shrine_altar') return { radius: 5, color: C.q5 };
  if (sub === 'phase_lantern') return { radius: 4.5, color: C.q5 };
  if (sub === 'forge' || sub === 'furnace') return { radius: 3.5, color: C.r5 };
  if (sub === 'cooking_pot') return { radius: 3, color: C.e5 };
  if (sub === 'alchemy') return { radius: 2.5, color: C.q5 };
  if (kind === 'crop' && sub.startsWith('*')) return { radius: 1.6, color: C.q5 };
  return null;
}

export const objKey = (x: number, y: number): number => x * 4194304 + y + 2097152 * 0; // unique for |coords| < 2M

export const FARM_ANIMALS = { coop: { max: 4, animal: 'chicken', product: 'egg' }, barn: { max: 4, animal: 'cow', product: 'milk' } } as const;

/** Crops within this Chebyshev radius of a Phase Lantern are protected from the season (greenhouse effect). */
export const LANTERN_RADIUS = 2;
/** Sprinkler reach: 'sprinkler1' waters orthogonal neighbours, 'sprinkler2' all 8 neighbours. */
export const sprinklerCovers = (sub: string, dx: number, dy: number): boolean =>
  sub === 'sprinkler2' ? Math.max(Math.abs(dx), Math.abs(dy)) === 1 : Math.abs(dx) + Math.abs(dy) === 1;
