/** Authored bosses use production PNGs, with no runtime geometry baking or generic monster recolouring. */
import manifest from './boss-manifest.json';
import type { Def } from './foes';
export const REDESIGNED_BOSSES = [
  'primordial_dragon',
  'world_serpent',
  'sealed_entity',
  'forgotten_titan',
  'realm_guardian',
  'slime_king',
  'warden',
  'colossus',
  'bellkeeper',
  'geode_tyrant',
  'cinder_wyrm',
  'rime_sovereign',
  'tide_leviathan',
  'veyr',
] as const;
export type DesignedBoss = (typeof REDESIGNED_BOSSES)[number];
export const AUTHORED_BOSS_FRAMES = { idle: 1, move: 4, windup: 1, attack: 2, hurt: 1, death: 1 };
const layouts = manifest.atlases as Record<string, { w: number; h: number; ay: number }>;
export const BOSS_CREATURE_DEFS = {} as Record<DesignedBoss, Def>;
for (const id of REDESIGNED_BOSSES) {
  const layout = layouts[id];
  if (!layout) throw Error(`Missing authored boss layout: ${id}`);
  BOSS_CREATURE_DEFS[id] = {
    ...layout,
    n: AUTHORED_BOSS_FRAMES,
    shadow:
      id === 'primordial_dragon'
        ? [31, 10]
        : ['world_serpent', 'tide_leviathan', 'cinder_wyrm'].includes(id)
          ? [30, 10]
          : id === 'sealed_entity'
            ? [19, 6]
            : [24, 8],
    draw() {
      throw Error(`Use tools/bake-boss-sheets.mjs to author ${id}; runtime loads its shipped atlas.`);
    },
  };
}
