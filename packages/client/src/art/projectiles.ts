/**
 * Projectiles and ammunition in flight, drawn as pixel art on the isometric grid: every shot is drawn along its true
 * heading (a world direction projected 2:1, in 16 steps), so a bolt fired down a road lies along the road.
 *
 * Bolts and arrows are hard-edged shafts with a metal head and fletching; staff magic takes its element's shape
 * (an ember comet, a rime shard, a verdant seed-leaf, a radiant star, a shapeshifter's mote); creatures spit dark
 * orbs, which turn the reflector's colour when batted back. All share the one-pixel ink outline of the game's art.
 */
import { Texture } from 'pixi.js';
import { C, makeCanvas, outline, PixBuf, put, type Ctx, type Ramp } from './shade';

export type ProjStyle = 'bolt' | 'arrow' | 'ember' | 'rime' | 'verdant' | 'radiant' | 'morph' | 'orb' | 'reflected';
export const HEADINGS = 16;
const S = 24,
  MID = S / 2;

/** the screen direction of world heading index `h` (0 = +x), unit length */
function screenDir(h: number): [number, number] {
  const a = (h / HEADINGS) * Math.PI * 2;
  const wx = Math.cos(a),
    wy = Math.sin(a);
  const sx = (wx - wy) * 16,
    sy = (wx + wy) * 8;
  const l = Math.hypot(sx, sy) || 1;
  return [sx / l, sy / l];
}

/** the heading index nearest a world direction */
export function headingOf(wx: number, wy: number): number {
  const a = Math.atan2(wy, wx);
  return (((Math.round((a / (Math.PI * 2)) * HEADINGS) % HEADINGS) + HEADINGS) % HEADINGS) as number;
}

/** a pixel-perfect line (one pixel per step along the longer axis) from a to b in palette colour c */
function seg(ctx: Ctx, ax: number, ay: number, bx: number, by: number, c: number): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  for (let i = 0; i <= n; i++) put(ctx, Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n), c);
}

/** a filled disc, shaded by a ramp from its lit upper left */
function disc(ctx: Ctx, cx: number, cy: number, r: number, ramp: Ramp): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx,
        dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const lit = (-dx - dy) / (r * 1.6) + (1 - d / r) * 0.5;
      const i = Math.max(0, Math.min(ramp.length - 1, Math.round((lit + 0.4) * (ramp.length - 1))));
      put(ctx, x, y, ramp[i]!);
    }
}

function draw(style: ProjStyle, h: number, frame: number): PixBuf {
  const buf = new PixBuf(S, S);
  const ctx = buf.ctx;
  const [dx, dy] = screenDir(h);
  const px = -dy,
    py = dx; // perpendicular on screen
  const at = (t: number, o = 0): [number, number] => [MID + dx * t + px * o, MID + dy * t + py * o];
  switch (style) {
    case 'bolt':
    case 'arrow': {
      const long = style === 'arrow' ? 5.5 : 4;
      const shaft = style === 'arrow' ? C.e4 : C.e2;
      const [tx, ty] = at(-long),
        [hx, hy] = at(long - 1.5);
      seg(ctx, tx, ty, hx, hy, shaft);
      // the head: a short bright point
      const [h1x, h1y] = at(long - 1),
        [h2x, h2y] = at(long);
      put(ctx, Math.round(h1x), Math.round(h1y), C.mist);
      put(ctx, Math.round(h2x), Math.round(h2y), style === 'arrow' ? C.pale : C.fog);
      // fletching: two vanes at the tail
      for (const o of [-1, 1]) {
        const [fx, fy] = at(-long + 0.5, o);
        put(ctx, Math.round(fx), Math.round(fy), style === 'arrow' ? C.fog : C.r2);
      }
      break;
    }
    case 'ember': {
      // a comet: white-hot head, orange body, a flickering red tail
      const tail = 3 + frame;
      for (let i = tail; i >= 1; i--) {
        const [x, y] = at(-i - 1);
        put(ctx, Math.round(x), Math.round(y), i > 2 ? C.r1 : C.r3);
      }
      disc(ctx, ...at(0.5), 2.2, [C.r2, C.r4, C.e6, C.e7, C.white]);
      break;
    }
    case 'rime': {
      // an ice shard: a long diamond along the flight line, a glint on its lit face
      for (let t = -3; t <= 3; t++) {
        const w = Math.max(0, 1.6 - Math.abs(t) * 0.45);
        for (let o = -w; o <= w; o += 0.5) {
          const [x, y] = at(t, o);
          put(ctx, Math.round(x), Math.round(y), o < 0 ? C.w6 : t > 1 ? C.w5 : C.w4);
        }
      }
      const [gx, gy] = at(1, -0.5);
      put(ctx, Math.round(gx), Math.round(gy), frame ? C.white : C.w7);
      break;
    }
    case 'verdant': {
      // a seed-leaf turning in flight: a green blade with a dark vein, flipping each frame
      const flip = frame ? 1 : -1;
      for (let t = -2.5; t <= 2.5; t += 0.5) {
        const w = 1.8 * Math.cos((t / 2.5) * (Math.PI / 2));
        for (let o = 0; o <= w; o += 0.5) {
          const [x, y] = at(t, o * flip);
          put(ctx, Math.round(x), Math.round(y), o > w - 0.6 ? C.g5 : C.g7);
        }
      }
      seg(ctx, ...at(-2.5), ...at(2.5), C.e6);
      break;
    }
    case 'radiant': {
      // a four-pointed star, its points alternating long and short as it spins
      const [cx, cy] = at(0);
      const l = frame ? 3 : 2;
      for (let i = -l; i <= l; i++) {
        put(ctx, Math.round(cx + i), Math.round(cy), Math.abs(i) < 2 ? C.white : C.e6);
        put(ctx, Math.round(cx), Math.round(cy + i), Math.abs(i) < 2 ? C.white : C.e6);
      }
      for (let i = 1; i <= 2; i++) {
        const [x, y] = at(-2 - i * 1.5);
        put(ctx, Math.round(x), Math.round(y), C.e5);
      }
      break;
    }
    case 'morph':
      disc(ctx, ...at(0), 2.4, [C.q0, C.q2, C.q3, C.q4, C.q6]);
      put(ctx, Math.round(MID - 1), Math.round(MID - 1), frame ? C.q7 : C.white);
      break;
    case 'orb':
    case 'reflected': {
      const ramp: Ramp = style === 'orb' ? [C.ink, C.q1, C.q5, C.q6, C.r7] : [C.w1, C.w3, C.q7, C.w6, C.white];
      disc(ctx, MID, MID, 2.8 + (frame ? 0.4 : 0), ramp);
      put(ctx, MID, MID, style === 'orb' ? C.ink : C.white);
      break;
    }
  }
  outline(ctx, S, S, C.night);
  return buf;
}

const cache = new Map<string, Texture>();
/** the texture for a projectile style flying along heading `h` (0..15), animation frame 0 or 1 */
export function projectileTexture(style: ProjStyle, h: number, frame: number): Texture {
  const directional = style !== 'orb' && style !== 'reflected' && style !== 'morph';
  const hh = directional ? ((h % HEADINGS) + HEADINGS) % HEADINGS : 0;
  const key = `${style}|${hh}|${frame & 1}`;
  let t = cache.get(key);
  if (!t) {
    const buf = draw(style, hh, frame & 1);
    const { canvas, ctx } = makeCanvas(S, S);
    buf.blit(ctx, 0, 0);
    t = Texture.from(canvas);
    t.source.scaleMode = 'nearest';
    cache.set(key, t);
  }
  return t;
}

/** the look of a player's shot, from the weapon it was fired with */
export function styleForWeapon(id: string | undefined, fam: string | undefined): ProjStyle {
  const base = fam ?? id ?? '';
  if (base === 'crossbow') return 'bolt';
  if (base === 'longbow') return 'arrow';
  if (base.startsWith('ember')) return 'ember';
  if (base.startsWith('rime')) return 'rime';
  if (base.startsWith('verdant')) return 'verdant';
  if (base.startsWith('radiant')) return 'radiant';
  if (base.startsWith('morph')) return 'morph';
  return 'bolt';
}
