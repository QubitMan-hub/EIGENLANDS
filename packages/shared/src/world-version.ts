/** Revision 2 changes surface hydrology only. Landmark placement remains revision 1. */
export const WORLD_GENERATION = 2;
export type WorldGeneration = 1 | 2;
export interface WorldGenerationMeta {
  version: WorldGeneration;
  migratedFrom?: 1;
}
export function generationMeta(saved: unknown): WorldGenerationMeta {
  if (saved === null || saved === undefined) return { version: WORLD_GENERATION, migratedFrom: 1 };
  const value = saved as Partial<WorldGenerationMeta>;
  if (value.version !== 1 && value.version !== 2)
    throw new Error('Unsupported saved world generation; restore a compatible server');
  return value.version === 1 || value.migratedFrom === 1 ? { version: 2, migratedFrom: 1 } : { version: 2 };
}
