/** The modular character system: one entry point to paint a person frame (see docs/CHARACTERS.md). */
import { C, outline, PixBuf, polish, type Ctx } from '../shade';
import { dimsOf, type BodyLook } from './paint';
import { paintDirectional } from './directional';
import { poseOf } from './poses';
import { DIMS, frameOf, project, solve, type Joints, type V3 } from './skeleton';

export type { BodyLook } from './paint';

/** paint one frame of a person (game DIR_*, frame id) into a 64×64 cell; returns the solved joints */
export function paintPersonFrame(ctx: Ctx, dir: number, frame: number, look: BodyLook): Joints {
  const d = dimsOf(look.body, look.scale ?? 1);
  const joints = solve(d, poseOf(d, frame, dir));
  paintDirectional(ctx, dir, joints, look);
  return joints;
}

export function polishPerson(buf: PixBuf): void {
  outline(buf.ctx, buf.width, buf.height, C.night);
  polish(buf.ctx, buf.width, buf.height, { rim: true });
}

const gripCache = new Map<number, { x: number; y: number; angle: number }>();
/**
 * The holding (right) hand in the 64×64 cell and the screen angle a held tool or weapon points along, for a frame —
 * solved from the selected body's skeleton, including its own shoulder and arm dimensions.
 */
export function personGripOf(
  dir: number,
  frame: number,
  handSide: 'R' | 'L' = 'R',
  body: 'male' | 'female' = 'male',
): { x: number; y: number; angle: number } {
  const key = ((dir & 7) << 10) | (frame & 1023) | (handSide === 'L' ? 1 << 14 : 0) | (body === 'female' ? 1 << 15 : 0);
  let g = gripCache.get(key);
  if (!g) {
    const d = DIMS[body];
    const pose = poseOf(d, frame, dir);
    const j = solve(d, pose);
    const fr = frameOf(dir);
    const wrist = handSide === 'R' ? j.wristR : j.wristL;
    const elbow = handSide === 'R' ? j.elbowR : j.elbowL;
    const fore = sub(wrist, elbow);
    const fl = Math.hypot(fore[0], fore[1], fore[2]) || 1;
    const hand: V3 = [
      wrist[0] + (fore[0] / fl) * d.hand * 0.6,
      wrist[1] + (fore[1] / fl) * d.hand * 0.6,
      wrist[2] + (fore[2] / fl) * d.hand * 0.6,
    ];
    const h = project(hand, fr);
    let angle: number;
    if (pose.tool) {
      const t = project(
        [hand[0] + pose.tool.dir[0] * 4, hand[1] + pose.tool.dir[1] * 4, hand[2] + pose.tool.dir[2] * 4],
        fr,
      );
      angle = Math.atan2(t.y - h.y, t.x - h.x);
    } else {
      // carried at rest: blade or haft up and forward along the facing
      const t = project([hand[0] + 2.5, hand[1], hand[2] + 3], fr);
      angle = Math.atan2(t.y - h.y, t.x - h.x);
    }
    g = { x: h.x, y: h.y, angle };
    gripCache.set(key, g);
  }
  return g;
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Physical tool plane: project both axes, preserving foreshortening in every facing. */
export function personToolAxes(
  dir: number,
  frame: number,
  body: 'male' | 'female' = 'male',
  thrust = false,
): { along: { x: number; y: number }; across: { x: number; y: number } } {
  const pose = poseOf(DIMS[body], frame, dir),
    fr = frameOf(dir);
  const d = pose.tool?.dir ?? (thrust ? ([1, 0, 0] as V3) : ([2.5, 0, 3] as V3));
  const n = Math.hypot(...d) || 1,
    u = d.map((x) => x / n) as V3;
  const h = Math.hypot(u[0], u[1]);
  const v: V3 = h > 0.01 ? [-u[1] / h, u[0] / h, 0] : [0, 1, 0];
  const origin = project([0, 0, 0], fr),
    a = project(u, fr),
    b = project(v, fr);
  return { along: { x: a.x - origin.x, y: a.y - origin.y }, across: { x: b.x - origin.x, y: b.y - origin.y } };
}
