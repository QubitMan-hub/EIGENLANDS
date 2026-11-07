/**
 * Off-hand shields, rasterised from the skeleton's left hand at every facing and frame: the shield is a flat board in
 * body space (round for bucklers, a heater for the rest), projected by the same iso frame as the body, so it turns
 * with the character instead of being a rotated sprite. At rest it is carried on the forearm, facing forward and out;
 * in the guard and parry clips it comes round to face the blow.
 *
 * Colours come from the item's icon (face and trim), shaded within their palette ramp from the upper-left light; the
 * back of the board (seen when it faces away) is dark wood with a strap. One-pixel ink outline, like all held art.
 */
import { Texture } from 'pixi.js';
import { ITEMS } from '@eigenlands/shared';
import { C, makeCanvas, outline, PixBuf, put } from './shade';
import { actionPose } from './person-actions';
import { DIMS, frameOf, project, solve, type V3 } from './body/skeleton';
import { poseOf } from './body/poses';
import { HELD_AX, HELD_AY, HELD_H, HELD_W } from './weapons';
import { PERSON_H, PERSON_W } from './actors';

/** a colour `steps` lighter (+) or darker (−) within its 8-colour palette ramp */
const shade = (c: number, steps: number): number => {
  const base = c & ~7;
  return base + Math.max(0, Math.min(7, (c & 7) + steps));
};
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export interface ShieldFrame {
  texture: Texture;
  /** the board is nearer the camera than the chest: draw it over the body */
  front: boolean;
}

function render(id: string, dir: number, frame: number): { buf: PixBuf; front: boolean } {
  const d = DIMS.male;
  const pose = poseOf(d, frame, dir);
  const j = solve(d, pose);
  const fr = frameOf(dir);
  const action = actionPose(dir, frame)?.action;
  const raised = action === 'guard' || action === 'parry';
  // the board's facing: forward (and a little up) when raised; outward from the left forearm, angled forward, at rest
  const n = norm(raised ? [1, -0.25, 0.2] : [0.85, -0.6, 0.05]);
  const up0: V3 = [0, 0, 1];
  const v = norm(cross(n, up0)); // across the board
  const u = norm(cross(v, n)); // up the board
  const out = raised ? 1.8 : 1.1;
  const centre: V3 = [
    j.wristL[0] + n[0] * out,
    j.wristL[1] + n[1] * out,
    j.wristL[2] + n[2] * out + (raised ? 0.5 : 1),
  ];
  const def = ITEMS[id];
  const face = def?.icon.a ?? C.e4,
    trim = def?.icon.b ?? C.steel;
  const round = id.includes('buckler');
  const half = round ? 3.3 : 3.6,
    top = round ? 3.3 : 4.2,
    bottom = round ? 3.3 : 5.4;
  const inside = (a: number, b: number): number => {
    // a: across, b: up; returns 0 outside, else 1 + how far in from the rim (for the trim band)
    if (round) {
      const r = Math.hypot(a, b) / half;
      return r <= 1 ? 1 + (1 - r) * half : 0;
    }
    if (b > top || b < -bottom) return 0;
    const w = b >= -1 ? half : half * (1 - (-1 - b) / (bottom - 1)) ** 0.8;
    if (Math.abs(a) > w) return 0;
    return 1 + Math.min(w - Math.abs(a), top - b, b + bottom);
  };
  // is the face toward the camera? (nearness grows along the normal)
  const c0 = project(centre, fr),
    c1 = project([centre[0] + n[0], centre[1] + n[1], centre[2] + n[2]], fr);
  const facing = c1.depth > c0.depth;
  // light from the upper left of the screen: how much the face turns toward it
  const lit = (c1.x - c0.x) * -0.6 + (c1.y - c0.y) * -0.8;
  const buf = new PixBuf(HELD_W, HELD_H);
  const ox = HELD_AX - PERSON_W / 2,
    oy = HELD_AY - PERSON_H;
  const seen = new Set<number>();
  for (let b = -bottom - 0.5; b <= top + 0.5; b += 0.25)
    for (let a = -half - 0.5; a <= half + 0.5; a += 0.25) {
      const k = inside(a, b);
      if (!k) continue;
      const p = project(
        [centre[0] + v[0] * a + u[0] * b, centre[1] + v[1] * a + u[1] * b, centre[2] + v[2] * a + u[2] * b],
        fr,
      );
      const x = Math.round(p.x + ox),
        y = Math.round(p.y + oy);
      const key = y * HELD_W + x;
      const rim = k < 1.9;
      let c: number;
      if (!facing)
        c = rim ? C.e1 : Math.abs(a) < 0.6 ? C.e3 : C.e2; // the back: planks and a leather strap
      else if (rim) c = shade(trim, lit > 0.15 ? 1 : 0);
      else if (Math.hypot(a, b - (round ? 0 : 0.6)) < 1.1)
        c = shade(trim, 2); // the boss
      else {
        // stepped, not smooth: the upper-left half of the face catches the light
        const side = (-a * 0.7 + b * 0.7) / half;
        c = shade(face, (lit > 0.15 ? 1 : 0) + (side > 0.25 ? 1 : side < -0.35 ? -1 : 0));
      }
      if (seen.has(key) && rim) continue;
      seen.add(key);
      put(buf.ctx, x, y, c);
    }
  outline(buf.ctx, HELD_W, HELD_H, C.night);
  // over or behind the body: compare nearness with the chest axis at the board's own height
  const chest = project([j.chest[0], j.chest[1], centre[2]], fr);
  return { buf, front: c0.depth > chest.depth };
}

const cache = new Map<string, ShieldFrame>();
/** the shield `id` held on the left arm for a person facing `dir` in frame `frame` (same cell as held weapons) */
export function shieldFrame(id: string, dir: number, frame: number): ShieldFrame {
  const key = `${id}|${dir}|${frame}`;
  let s = cache.get(key);
  if (!s) {
    const { buf, front } = render(id, dir, Math.max(0, frame));
    const { canvas, ctx } = makeCanvas(HELD_W, HELD_H);
    buf.blit(ctx, 0, 0);
    const texture = Texture.from(canvas);
    texture.source.scaleMode = 'nearest';
    s = { texture, front };
    cache.set(key, s);
  }
  return s;
}
