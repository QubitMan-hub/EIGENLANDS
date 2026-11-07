import { CHUNK_SIZE, T, hash2, isCaveY, isDiveY, isUpperY, type ChunkStore } from '@eigenlands/shared';
export type SecretKind = 'ladle' | 'tea' | 'crown' | 'fish' | 'kite';
export interface WorldSecret {
  id: string;
  x: number;
  y: number;
  kind: SecretKind;
}
/** Sparse fixed sites, shared by everyone using a seed. Visiting never generates chunks or edits terrain. */
export function secretSites(seed: number, x: number, y: number): WorldSecret[] {
  const out: WorldSecret[] = [];
  const cx = Math.floor(x / 96),
    cy = Math.floor(y / 96);
  for (let yy = cy - 1; yy <= cy + 1; yy++)
    for (let xx = cx - 1; xx <= cx + 1; xx++) {
      if (hash2(seed, xx, yy, 9100) > 0.38) continue;
      const sx = xx * 96 + 12 + Math.floor(hash2(seed, xx, yy, 9101) * 72),
        sy = yy * 96 + 12 + Math.floor(hash2(seed, xx, yy, 9102) * 72);
      if (Math.hypot(sx - x, sy - y) > 62) continue;
      const kind: SecretKind = isCaveY(sy)
        ? 'tea'
        : isDiveY(sy)
          ? 'fish'
          : isUpperY(sy)
            ? 'kite'
            : hash2(seed, xx, yy, 9103) < 0.5
              ? 'ladle'
              : 'crown';
      out.push({ id: `${seed}:${xx}:${yy}`, x: sx, y: sy, kind });
    }
  return out;
}
const BUILT_GROUND = new Set<number>([T.PATH, T.FLOOR, T.DOOR]);
export function secretGround(store: ChunkStore, x: number, y: number): boolean {
  const tx = Math.floor(x),
    ty = Math.floor(y),
    cx = Math.floor(tx / CHUNK_SIZE),
    cy = Math.floor(ty / CHUNK_SIZE);
  if (!store.has(cx, cy)) return false;
  const c = store.get(cx, cy),
    index = (ty - cy * CHUNK_SIZE) * CHUNK_SIZE + tx - cx * CHUNK_SIZE;
  return (
    !BUILT_GROUND.has(store.getTile(tx, ty)) &&
    !c.diff.has(index) &&
    !store.solidAt(tx, ty) &&
    !store.objectAt(tx, ty) &&
    !store.structureAt(tx, ty)
  );
}
export const SECRET_STORIES: Record<SecretKind, [string, string]> = {
  ladle: ['The chosen ladle', 'Only the hungriest may draw it from the stone. Someone has left a recipe for soup.'],
  tea: ['Tea for two', 'Two tiny cups, one still warm. A note reads: “Back after one more cave.” Nobody signed it.'],
  crown: [
    'A very small kingdom',
    'A walnut crown rests on this stump. Beneath it: “All squirrels welcome. No taxes on acorns.”',
  ],
  fish: [
    'The clockwork fish',
    'A brass fish on a little plinth. Its winding key reads: “Please do not teach it to swim.”',
  ],
  kite: [
    'The missing wind',
    'A folded kite and a coil of string. The tag says: “If found above the clouds, please return the wind.”',
  ],
};
