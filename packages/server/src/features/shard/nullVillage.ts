import type { VillageSystem } from '../../systems/types';

/** Shards that do not contain Hadamere run no village. */
export function nullVillage(): VillageSystem {
  return {
    async init() {},
    tick() {},
    onNewDay() {},
    talk: () => null,
    gift: () => null,
    shop: () => null,
    chat: async () => null,
    rumor() {},
    npc: () => undefined,
    async dispose() {},
  };
}
