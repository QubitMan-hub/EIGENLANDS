import { LEGACY_GENERATION, type WorldGeneration } from './world-version';

// Which revision a seed's world uses, for callers that have a seed but no store (renderer, spawning, labels). A
// ChunkStore registers its revision when it is created; seeds never registered behave as revision 2, so every
// legacy-placement caller (towns, shrines, ruins, caves, camps) is unaffected unless it asks for a newer revision.
const activeGenerations = new Map<number, WorldGeneration>();
export function setActiveGeneration(seed: number, generation: WorldGeneration): void {
  activeGenerations.set(seed, generation);
}
export const activeGeneration = (seed: number): WorldGeneration => activeGenerations.get(seed) ?? LEGACY_GENERATION;
