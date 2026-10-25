import { Texture } from 'pixi.js';
import { blob, C, line, makeCanvas, outline, poly, put, ramp4, type Ctx, type Ramp } from './shade';

/**
 * Procedural ships and sea monsters. A ship is modelled in the ground plane (along = heading, across = beam) and
 * lofted: the hull is a lens polygon with its sides dropped below the deck, the sail a vertical quad that billows
 * with the wind. Sixteen headings x three sail frames per kind are drawn lazily and cached.
 */
export type ShipKind = 'sloop' | 'pirate';
export const HEADINGS = 16;
export const SHIP_W = 76;
export const SHIP_H = 66;
/** anchor (waterline centre) inside a ship texture */
export const SHIP_AX = 0.5;
export const SHIP_AY = 0.72;
const OX = SHIP_W / 2,
  OY = SHIP_H * SHIP_AY;

const HULL: Ramp = [C.e0, C.e1, C.e2, C.e3];
const HULL_PIRATE: Ramp = [C.ink, C.night, C.e0, C.e1];
const DECK: Ramp = [C.e3, C.e4, C.e5, C.e6];
const CLOTH: Ramp = [C.mist, C.fog, C.pale, C.white];
const CLOTH_BLACK: Ramp = [C.ink, C.night, C.slate, C.steel];

/** heading index -> world direction (iso: +x is down-right on screen, +y down-left) */
export const headingOf = (dx: number, dy: number): number => {
  const a = Math.atan2(dy, dx);
  return ((Math.round((a / (Math.PI * 2)) * HEADINGS) % HEADINGS) + HEADINGS) % HEADINGS;
};

function drawShip(kind: ShipKind, h: number, frame: number): Texture {
  const { canvas, ctx } = makeCanvas(SHIP_W, SHIP_H);
  const a = (h / HEADINGS) * Math.PI * 2;
  const dx = Math.cos(a),
    dy = Math.sin(a); // along
  const px = -dy,
    py = dx; // across
  // world (along, across, height) -> pixels
  const P = (al: number, ac: number, ht = 0): [number, number] => {
    const wx = dx * al + px * ac,
      wy = dy * al + py * ac;
    return [OX + (wx - wy) * 16, OY + (wx + wy) * 8 - ht];
  };
  const pirate = kind === 'pirate';
  const hull = pirate ? HULL_PIRATE : HULL;
  const lens = (ht: number, k: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 14; i++) {
      const al = -0.95 + (1.9 * i) / 14;
      pts.push(P(al, 0.36 * k * Math.pow(Math.max(0, 1 - (al / 0.98) ** 2), 0.7) * (al > 0 ? 1 : 1.06), ht));
    }
    for (let i = 14; i >= 0; i--) {
      const al = -0.95 + (1.9 * i) / 14;
      pts.push(P(al, -0.36 * k * Math.pow(Math.max(0, 1 - (al / 0.98) ** 2), 0.7) * (al > 0 ? 1 : 1.06), ht));
    }
    return pts;
  };
  // is the viewer looking at the hull's port side or starboard? (depth cue for planks)
  const side = (x: number, _y: number) => x < OX;
  // wake foam under the hull
  const foam = lens(-1, 1.18);
  poly(ctx, foam, (x, y) => ((x * 3 + y * 5 + frame) % 4 === 0 ? C.w7 : C.w6));
  // hull sides: the lens dropped by 5px, then the deck on top
  for (let d = 5; d >= 1; d--)
    poly(ctx, lens(d - 1, 1), (x, y) => hull[(d > 3 ? 0 : d > 1 ? 1 : 2) + (side(x, y + d) && d === 1 ? 1 : 0)]!);
  poly(ctx, lens(5, 0.86), (x, y) => {
    const sx = (x - OX) / 16,
      sy = (y - OY + 5) / 8;
    const wx = (sx + sy) / 2,
      wy = (sy - sx) / 2;
    const across = wx * px + wy * py;
    return Math.floor((across + 0.4) * 30) % 4 === 0 ? DECK[0]! : DECK[2]!;
  });
  // Raised gunwales, brass corners and rigging follow the actual heading, never a rotated billboard.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const al = -0.75 + i * 0.35,
        ac = side * 0.32 * Math.sqrt(1 - (al / 0.98) ** 2);
      line(ctx, ...P(al, ac, 5), ...P(al, ac, 8), i % 2 ? C.e3 : C.e5);
      if (i < 4)
        line(ctx, ...P(al, ac, 8), ...P(al + 0.3, side * 0.31 * Math.sqrt(1 - ((al + 0.3) / 0.98) ** 2), 8), C.e4);
    }
    line(ctx, ...P(-0.65, side * 0.27, 7), ...P(0, 0, 34), C.e2);
  }
  // bow: a bowsprit and a figurehead nub
  const bow = P(0.95, 0, 5),
    tip = P(1.25, 0, 8);
  line(ctx, bow[0], bow[1], tip[0], tip[1], hull[3]!);
  // stern castle
  poly(ctx, [P(-0.9, -0.3, 5), P(-0.9, 0.3, 5), P(-0.45, 0.28, 5), P(-0.45, -0.28, 5)], DECK[3]!);
  poly(ctx, [P(-0.9, -0.3, 8), P(-0.9, 0.3, 8), P(-0.45, 0.28, 8), P(-0.45, -0.28, 8)], pirate ? C.e1 : C.e5);
  // masts and sails
  const bulge = [0.1, 0.17, 0.24][frame % 3]!;
  const sail = (al: number, wid: number, top: number, bottom: number, tint: Ramp): void => {
    const q = (u: number, v: number): [number, number] =>
      P(
        al + u * wid * 0.5,
        bulge * Math.sin(Math.PI * (u * 0.5 + 0.5)) * (0.4 + (0.6 * (v - bottom)) / (top - bottom)) * 1.1,
        5 + v,
      );
    // the sail is a single vertical sheet along the beam of the ship; shade by fold bands
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 8; i++) pts.push(q(-1 + (2 * i) / 8, top));
    for (let i = 8; i >= 0; i--) pts.push(q(-1 + (2 * i) / 8, bottom));
    poly(
      ctx,
      pts,
      (x, y) =>
        tint[
          Math.max(0, Math.min(tint.length - 1, ((x - y * 0.4) % 9 < 4 ? 2 : 1) + (y < 14 ? 1 : 0) - (y > 40 ? 1 : 0)))
        ]!,
    );
    const m = P(al, 0, 5);
    line(ctx, m[0], m[1] - top - 3, m[0], m[1] + 1, hull[3]!);
    line(ctx, ...P(al - wid * 0.5, 0, 5 + bottom), ...P(al + wid * 0.5, 0, 5 + bottom), hull[3]!);
  };
  if (pirate) {
    sail(0.05, 1.0, 30, 9, CLOTH_BLACK);
    sail(0.55, 0.5, 18, 8, CLOTH_BLACK);
    const sk = P(0.05, bulge * 0.7, 5 + 22);
    put(ctx, sk[0] - 1, sk[1] - 1, C.white, 3, 2);
    put(ctx, sk[0], sk[1] + 1, C.white, 1, 2);
    const f = P(0.05, 0, 5 + 34);
    put(ctx, f[0], f[1], C.r4, 5 - (frame & 1), 2);
    put(ctx, f[0] + 3, f[1] + 2 + (frame & 1), C.r3, 2, 1);
  } else {
    sail(0.0, 1.0, 30, 9, CLOTH);
    sail(0.55, 0.5, 17, 8, CLOTH);
    const f = P(0.0, 0, 5 + 34);
    put(ctx, f[0], f[1], C.q5, 5 - (frame & 1), 2);
  }
  outline(ctx, SHIP_W, SHIP_H);
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
}

function drawSerpent(frame: number, part: 'head' | 'hump'): Texture {
  const W = 40,
    H = 40;
  const { canvas, ctx } = makeCanvas(W, H);
  const body = ramp4(C.g3);
  if (part === 'hump') {
    blob(ctx, 20, 30, 11, 11 - frame * 0.5, [C.g1, C.g2, C.g3, C.g4, C.g5], {
      seed: 3 + frame,
      noise: 0.25,
      edgeDark: 0.4,
    });
    for (let i = 0; i < 4; i++) put(ctx, 12 + i * 5, 24 + (i & 1), C.g6, 2, 1);
    poly(
      ctx,
      [
        [8, 34],
        [32, 34],
        [30, 38],
        [10, 38],
      ],
      (x, y) => (((x + y + frame) & 3) === 0 ? C.w7 : C.w6),
    );
  } else {
    const lift = frame === 0 ? 0 : 2;
    const seg = (cx: number, cy: number, r: number, k: number) =>
      blob(ctx, cx, cy, r, r * 1.05, [C.g1, C.g2, C.g3, C.g4, C.g5], { seed: 20 + k, noise: 0.2, edgeDark: 0.45 });
    // an S-curved neck rising out of the water
    seg(14, 35, 6.5, 0);
    seg(15, 29, 5.6, 1);
    seg(18, 23 - lift * 0.3, 5, 2);
    seg(21, 17 - lift * 0.6, 4.6, 3);
    for (let i = 0; i < 5; i++) put(ctx, 12 + (i % 2) + i, 30 - i * 4 - 0, C.g6, 1, 1);
    // head: a long jaw pointing right, a red frill behind it
    poly(
      ctx,
      [
        [17, 8 - lift],
        [21, 3 - lift],
        [23, 8 - lift],
      ],
      C.r4,
    );
    poly(
      ctx,
      [
        [13, 12 - lift],
        [18, 6 - lift],
        [20, 12 - lift],
      ],
      C.r3,
    );
    blob(ctx, 25, 11 - lift, 8.5, 4.6, [C.g2, C.g3, C.g4, C.g5, C.g6], { seed: 31, noise: 0.15, edgeDark: 0.35 });
    poly(
      ctx,
      [
        [22, 13 - lift],
        [35, 13 - lift],
        [33, 16 - lift],
        [23, 16 - lift],
      ],
      C.g2,
    ); // lower jaw
    for (let i = 0; i < 4; i++) put(ctx, 26 + i * 2, 13 - lift, C.white, 1, 2); // teeth
    put(ctx, 25, 8 - lift, C.q6, 3, 2);
    put(ctx, 26, 8 - lift, C.ink, 1, 1); // eye
    poly(
      ctx,
      [
        [8, 38],
        [32, 38],
        [30, 36],
        [10, 36],
      ],
      (x, y) => (((x + y + frame) & 3) === 0 ? C.w7 : C.w6),
    );
  }
  outline(ctx, W, H);
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
}

export class Ships {
  private ships = new Map<string, Texture>();
  private sea = new Map<string, Texture>();

  ship(kind: ShipKind, heading: number, frame: number): Texture {
    const k = `${kind}:${heading}:${frame % 3}`;
    let t = this.ships.get(k);
    if (!t) {
      t = drawShip(kind, heading, frame % 3);
      this.ships.set(k, t);
    }
    return t;
  }

  serpent(part: 'head' | 'hump', frame: number): Texture {
    const k = `${part}:${frame & 1}`;
    let t = this.sea.get(k);
    if (!t) {
      t = drawSerpent(frame & 1, part);
      this.sea.set(k, t);
    }
    return t;
  }
}
