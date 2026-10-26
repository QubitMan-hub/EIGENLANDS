/**
 * Mount codes carried in PlayerSim.mount (and the ACK / PlayerState): 0 on foot; 1 horse, 2 Moonlit Stag, 3 griffin;
 * 4-6 the same mounts well fed. Kept tiny and dependency-free so the shared sim can read it.
 */
export type MountKind = 'horse' | 'stag' | 'griffin';
export const MOUNT_KINDS: readonly MountKind[] = ['horse', 'stag', 'griffin'];
export const mountKindOf = (code: number): MountKind | null =>
  code <= 0 || code > 6 ? null : MOUNT_KINDS[(Math.round(code) - 1) % 3]!;
export const mountFed = (code: number): boolean => code > 3;
export const mountCode = (kind: MountKind, fed: boolean): number => MOUNT_KINDS.indexOf(kind) + 1 + (fed ? 3 : 0);
/** Flying mounts pass over terrain but not walls or settlement wards, and cannot fight from the air. */
export const isFlying = (code: number): boolean => mountKindOf(code) === 'griffin';
