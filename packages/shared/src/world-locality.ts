/** Shared habitat policies for generation and authoritative encounters. No terrain scans or mutable simulation. */
import { activeGeneration } from './generation-registry';
import { caveRegion, CAVE_BIOME_NAMES, type CaveBiome } from './undercroft';
import type { EnemyKindName } from './combat';
import type { OtherworldId, RoomTheme } from './otherworlds';
import type { WorldGeneration } from './world-version';

export interface CaveDistrictHabitat {
  biome: CaveBiome;
  hazard: 'steam' | 'spores' | 'rime' | null;
  guardian: EnemyKindName;
  resource: string;
}
const HABITATS: Record<
  CaveBiome,
  Omit<CaveDistrictHabitat, 'biome' | 'hazard'> & { vent: CaveDistrictHabitat['hazard'] }
> = {
  limestone: { vent: 'steam', guardian: 'amber_gnawer', resource: 'coal and copper seams' },
  glowmoss: { vent: 'spores', guardian: 'spore_matriarch', resource: 'copper and glowing caps' },
  crystal: { vent: null, guardian: 'geode_golem', resource: 'crystal and geode veins' },
  basalt: { vent: 'steam', guardian: 'cinder_drake', resource: 'iron and deep gold' },
  frost: { vent: 'rime', guardian: 'frost_wraith', resource: 'iron and deep silver' },
  drowned: { vent: 'steam', guardian: 'pool_lurker', resource: 'copper, silver and geodes' },
};
export function caveDistrictHabitat(
  seed: number,
  gx: number,
  gy: number,
  generation: WorldGeneration = activeGeneration(seed),
): CaveDistrictHabitat {
  const r = caveRegion(seed, gx, gy, generation),
    h = HABITATS[r.biome];
  return { biome: r.biome, guardian: h.guardian, resource: h.resource, hazard: r.feature === 'vents' ? h.vent : null };
}
const PURPOSE = {
  lake: 'water cavern',
  ruins: 'delver camp',
  secret: 'sealed vault',
  puzzle: 'echo trial',
  vents: 'vent field',
  arena: 'guardian altar',
  grove: 'grotto',
} as const;
export function caveRouteClue(
  seed: number,
  gx: number,
  gy: number,
  generation: WorldGeneration = activeGeneration(seed),
): string {
  return [
    [0, -1, 'North'],
    [1, 0, 'East'],
    [0, 1, 'South'],
    [-1, 0, 'West'],
  ]
    .map(([dx, dy, direction]) => {
      const r = caveRegion(seed, gx + Number(dx), gy + Number(dy), generation);
      return `${direction}: ${CAVE_BIOME_NAMES[r.biome]} ${PURPOSE[r.feature]}${r.gx % 2 === 0 && r.gy % 2 === 0 ? ' and supply lift' : ''}.`;
    })
    .join(' ');
}

/** Existing beasts, selected from the habitat where the spawn actually lands. Warbands remain separate. */
export function realmRoomInhabitants(w: OtherworldId, theme: RoomTheme | null): readonly EnemyKindName[] {
  if (w === 'aetheria') return theme === 'ruin' || theme === 'crystal' ? ['gilded_sentinel'] : ['zephyr_ray'];
  if (w === 'umbra') return theme === 'flooded' || theme === 'ember' ? ['abyss_serpent'] : ['shade_stalker'];
  return theme === 'clockyard' || theme === 'dunes' ? ['gear_hound'] : ['paradox_echo'];
}
/** Gathering flourishes in supporting habitat and is sparse among hostile works and hot seeps. */
export function realmGatheringChance(w: OtherworldId, theme: RoomTheme | null): number {
  if (w === 'aetheria') return theme === 'meadow' || theme === 'grove' || theme === 'lake' ? 0.95 : 0.3;
  if (w === 'umbra') return theme === 'fungal' || theme === 'flooded' ? 0.95 : theme === 'ember' ? 0.15 : 0.4;
  return theme === 'dunes' || theme === 'stilled' ? 0.95 : 0.4;
}
