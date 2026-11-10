import { hash2, type Building } from '@eigenlands/shared';

export interface BuildingStyle {
  roof: 'gable' | 'hip' | 'saltbox' | 'spire' | 'battlement';
  stone: boolean;
  wall: number;
  timber: number;
  roofColor: number;
  height: number;
  dormer: boolean;
  awning: boolean;
  chimney: boolean;
  shutters: boolean;
  variant: number;
}

/** Stable architectural identity; it changes presentation, never entrances, floors, footprint or collision. */
export function buildingStyle(b: Building): BuildingStyle {
  let salt = 0;
  for (const c of b.id) salt = (salt * 31 + c.charCodeAt(0)) | 0;
  const n = Math.floor(hash2(salt, b.x, b.y, 9023) * 997),
    variant = n % 7;
  const roof: BuildingStyle['roof'] =
    b.kind === 'tower'
      ? variant % 2
        ? 'spire'
        : 'battlement'
      : b.kind === 'church'
        ? 'gable'
        : b.kind === 'house'
          ? (['gable', 'hip', 'saltbox', 'gable'] as const)[variant % 4]
          : b.kind === 'farmhouse'
            ? 'hip'
            : b.kind === 'smithy'
              ? 'saltbox'
              : 'gable';
  const stone = b.kind === 'tower' || b.kind === 'church' || b.kind === 'hall' || variant % 4 === 0;
  return {
    roof,
    stone,
    variant,
    wall: stone
      ? [0x8c928c, 0xa49e88, 0x7d8b88, 0x9b8a7b][variant % 4]
      : [0xd0c4a0, 0xc8b792, 0xaeb6a4, 0xc8b4a1, 0xc4ba9f, 0xb4c0b2, 0xc0b2a4][variant],
    timber: [0x463329, 0x554536, 0x4b4038, 0x63513b][n % 4],
    roofColor: b.kind === 'farmhouse' ? 0x9c8b5a : [0x735d70, 0x5d7578, 0x946b52, 0x6d7865, 0x6e6977][n % 5],
    height:
      b.kind === 'tower' ? 3.2 : b.kind === 'church' ? 2.6 : b.kind === 'hall' ? 2.35 : 1.85 + (variant % 3) * 0.1,
    dormer: ['inn', 'house', 'hall'].includes(b.kind) && variant % 3 !== 0,
    awning: b.kind === 'store' || b.kind === 'smithy' || (b.kind === 'inn' && variant % 2 === 0),
    chimney: !['tower', 'church'].includes(b.kind),
    shutters: variant % 2 === 0,
  };
}
