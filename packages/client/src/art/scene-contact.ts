import { personGripOf } from './body';
import type { Facing } from './isokit';
import { GW, GH } from './body/grid';
export type CarryKind = 'bucket' | 'sack' | 'broom' | 'pole' | 'lute' | 'lantern';
/** The actual grip on each model, measured from its tile-centre ground anchor. */
export function propGrip(kind: CarryKind, phase = 0, face: Facing = 'sw'): { x: number; y: number } {
  let a = 8,
    b = 8,
    z = 0;
  if (kind === 'bucket') z = 10;
  if (kind === 'sack') z = 5;
  if (kind === 'lantern') z = 15;
  if (kind === 'lute') {
    a = 14;
    b = 8;
    z = 7;
  }
  if (kind === 'broom') {
    z = 17;
    a = 8 + (phase - 1) * 3 * (1 - 17 / 26);
  }
  if (kind === 'pole') {
    const top = 58 + (phase ? 10 : 0);
    z = 16;
    a = 8 + (3 * z) / top;
    b = 8 - (2 * z) / top;
  }
  const [u, v] = face === 'sw' ? [a, b] : [b, a];
  return { x: u - v, y: (u + v) / 2 - 8 - z };
}
export function carryPlacement(
  kind: CarryKind,
  dir: number,
  frame: number,
  phase = 0,
  scale = 1,
  body: 'male' | 'female' = 'male',
) {
  const face: Facing = [1, 2, 4, 6].includes(dir) ? 'se' : 'sw';
  const hand = personGripOf(dir, frame, kind === 'lute' ? 'L' : 'R', body),
    grip = propGrip(kind, phase, face);
  return {
    x: (hand.x - GW / 2 - grip.x) * scale,
    y: (hand.y - GH - grip.y) * scale,
    face,
    behind: dir === 1 || dir >= 6,
  };
}
