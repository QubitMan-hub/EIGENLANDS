/**
 * The plane the dungeon gates open onto (gates.ts). Kept apart so the realm and world modules can test for it.
 * GATE_OY is a multiple of the shard region size, so each dungeon sits at the centre of one region (one room runs it).
 */
export const GATE_OY = -600064;
export const GATE_SPAN = 30000;
export const isGateY = (y: number): boolean => Math.abs(y - GATE_OY) < GATE_SPAN;
