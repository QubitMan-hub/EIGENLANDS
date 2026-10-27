/** The modular character system: one entry point to paint a person frame (see docs/CHARACTERS.md). */
import { C, makeCanvas, outline, PixBuf, polish, undithered, type Ctx } from '../shade';
import { paintBody, dimsOf, type BodyLook } from './paint';
import { poseOf } from './poses';
import { DIMS, frameOf, project, solve, type Joints, type V3 } from './skeleton';

export type { BodyLook } from './paint';
export { CUTS, type CutId, type HatId, type BeardId } from './headwear';

/** paint one frame of a person (game DIR_*, frame id) into a 32×48 cell; returns the solved joints */
export function paintPersonFrame(ctx: Ctx, dir: number, frame: number, look: BodyLook): Joints {
  const d = dimsOf(look.body, look.scale ?? 1);
  return paintBody(ctx, dir, poseOf(d, frame, dir), look);
}

export function polishPerson(buf: PixBuf): void {
  outline(buf.ctx, buf.width, buf.height, C.night);
  polish(buf.ctx, buf.width, buf.height, { rim: true });
}

export function bodyCanvas(look: BodyLook, dir: number, frame: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 48);
  const buf = new PixBuf(32, 48);
  undithered(() => paintPersonFrame(buf.ctx, dir, frame, look));
  polishPerson(buf);
  buf.blit(ctx, 0, 0);
  return canvas;
}

const gripCache = new Map<number, { x: number; y: number; angle: number }>();
/**
 * The holding (right) hand in the 32×48 cell and the screen angle a held tool or weapon points along, for a frame —
 * solved from the reference man's skeleton (the women's differs by under a pixel at the hand).
 */
export function personGripOf(dir: number, frame: number): { x: number; y: number; angle: number } {
  const key = ((dir & 7) << 10) | (frame & 1023);
  let g = gripCache.get(key);
  if (!g) {
    const d = DIMS.male;
    const pose = poseOf(d, frame, dir);
    const j = solve(d, pose);
    const fr = frameOf(dir);
    const fore = sub(j.wristR, j.elbowR);
    const fl = Math.hypot(fore[0], fore[1], fore[2]) || 1;
    const hand: V3 = [
      j.wristR[0] + (fore[0] / fl) * d.hand * 0.6,
      j.wristR[1] + (fore[1] / fl) * d.hand * 0.6,
      j.wristR[2] + (fore[2] / fl) * d.hand * 0.6,
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
