import {
  T,
  biomeAt,
  caveBiomeAt,
  isCaveY,
  isCryptY,
  isDiveY,
  isGateY,
  isUpperY,
  otherworldOf,
  roomContextAt,
  type ChunkStore,
  type NatureContext,
  type NatureHabitat,
  type Weather,
} from '@eigenlands/shared';

/** A handful of local samples, shared by plant placement and staggered wildlife discovery. */
export function natureContextAt(
  store: ChunkStore,
  x: number,
  y: number,
  season = 1,
  hour = 12,
  weather: Weather = 'clear',
): NatureContext | null {
  if (isCryptY(y) || isGateY(y) || isDiveY(y) || isUpperY(y)) return null;
  let habitat: NatureHabitat;
  const realm = otherworldOf(y);
  if (realm) {
    if (!roomContextAt(store.seed, realm, x, y, store.generation)) return null;
    habitat = `realm:${realm}`;
  } else if (isCaveY(y)) habitat = `cave:${caveBiomeAt(store.seed, x, y, store.generation)}`;
  else habitat = biomeAt(store.seed, x, y, store.generation);
  let nearWater = false,
    wooded = habitat.startsWith('cave:'),
    flowering = false;
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [3, 0],
    [-3, 0],
    [0, 3],
    [0, -3],
  ]) {
    const tile = store.getTile(x + dx!, y + dy!);
    nearWater ||= tile === T.WATER || tile === T.DEEP_WATER;
    wooded ||= tile === T.TREE;
    flowering ||= tile === T.FLOWERS || tile === T.SHIMMER;
  }
  return { habitat, nearWater, wooded, flowering, season, hour, weather };
}
