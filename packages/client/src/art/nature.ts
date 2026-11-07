import { FLORA_BY_ID, WILDLIFE_BY_ID, C, mulberry32 } from '@eigenlands/shared';
import { line, poly, put, type Ctx } from './shade';

const oval = (ctx: Ctx, x: number, y: number, rx: number, ry: number, color: number) => {
  for (let dy = -Math.ceil(ry); dy <= ry; dy++)
    for (let dx = -Math.ceil(rx); dx <= rx; dx++)
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) put(ctx, x + dx, y + dy, color);
};
const salt = (id: string) => [...id].reduce((v, ch) => Math.imul(v ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Native-resolution billboards: ground anchor (20,34), no filtered or fractional raster edges. */
export function paintFlora(ctx: Ctx, id: string, variant: number, season: number): void {
  const s = FLORA_BY_ID[id];
  if (!s) return;
  const rng = mulberry32(salt(id) + variant * 313),
    winter = season === 3 && !s.evergreen;
  const leaf = winter ? C.e3 : season === 2 && !s.evergreen ? C.e4 : s.leaf;
  const petal = winter ? C.fog : season === 2 && !s.evergreen ? C.e6 : s.petal;
  const h = Math.round(s.height * (winter ? 0.6 : 1));
  const stem = (x: number, y: number, height: number) => {
    line(ctx, x, y, x + 1, y - height, leaf);
    for (let k = 2; k < height - 1; k += 3) {
      line(ctx, x, y - k, x - 3, y - k - 2, leaf);
      line(ctx, x + 1, y - k - 1, x + 4, y - k - 3, leaf);
    }
  };
  const flower = (x: number, y: number, big = false) => {
    const r = big ? 2 : 1;
    for (const [dx, dy] of [
      [-r, 0],
      [r, 0],
      [0, -r],
      [0, r],
    ])
      oval(ctx, x + dx!, y + dy!, r, 1, petal);
    put(ctx, x, y, id === 'poppy' ? C.ink : C.e7);
  };
  if (s.shape === 'flower' || s.shape === 'herb' || s.shape === 'spike' || s.shape === 'cotton') {
    for (let i = 0; i < 3 + (variant % 2); i++) {
      const x = 13 + i * 5 + Math.floor(rng() * 2),
        y = 30 + (i % 2),
        height = h - Math.floor(rng() * 3);
      stem(x, y, height);
      if (s.shape === 'spike') {
        for (let k = 2; k < Math.max(4, height - 2); k += 2)
          put(ctx, x + (k % 4 ? -1 : 2), y - height + k, petal, 2, 2);
      } else if (s.shape === 'cotton') oval(ctx, x + 1, y - height, 3, 2, petal);
      else if (!winter) flower(x + 1, y - height, s.shape === 'flower' && i === 1);
    }
  } else if (s.shape === 'bush') {
    for (const dx of [-5, 0, 5]) {
      line(ctx, 20, 32, 20 + dx, 31 - h, C.e2);
      oval(ctx, 20 + dx, 29 - h / 2, 5, h / 2 + 1, leaf);
      for (let k = 0; k < 5; k++)
        put(ctx, 17 + dx + Math.floor(rng() * 6), 26 - h / 2 + Math.floor(rng() * 6), petal, 1, 2);
    }
  } else if (s.shape === 'fern' || s.shape === 'fan') {
    for (let i = -2; i <= 2; i++) {
      const x = 20 + i * 5,
        y = 30 - h + Math.abs(i) * 2;
      line(ctx, 20, 32, x, y, leaf);
      for (let k = 1; k <= 4; k++) {
        const px = 20 + (i * 5 * k) / 5,
          py = 32 + ((y - 32) * k) / 5;
        line(ctx, px, py, px - 3, py - 2, s.shape === 'fan' ? petal : leaf);
        line(ctx, px, py, px + 3, py - 1, leaf);
      }
    }
  } else if (s.shape === 'reed') {
    for (let i = 0; i < 6; i++) {
      const x = 12 + i * 3,
        y = 30 + (i % 2),
        top = y - h + Math.floor(rng() * 4);
      line(ctx, x, y, x + (i % 2), top, leaf);
      line(ctx, x, y - 3, x - 3, top + 5, leaf);
      if (i % 2 === 0) put(ctx, x, top - 2, petal, 2, 4);
    }
  } else if (s.shape === 'pad') {
    for (let i = 0; i < 3; i++) oval(ctx, 13 + i * 7, 30 + (i % 2), 6, 2, leaf);
    flower(21, 27, true);
  } else if (s.shape === 'moss') {
    for (let i = 0; i < 36; i++)
      put(ctx, 9 + Math.floor(rng() * 23), 27 + Math.floor(rng() * 7), i % 4 ? leaf : petal, 2, 1);
  } else if (s.shape === 'cactus') {
    if (id === 'prickly_pear') {
      oval(ctx, 20, 27, 3, 6, leaf);
      oval(ctx, 14, 21, 3, 5, leaf);
      oval(ctx, 25, 19, 3, 5, leaf);
      flower(25, 13);
    } else {
      oval(ctx, 20, 27, 6, 6, leaf);
      flower(20, 20);
    }
    for (const dx of [-3, 0, 3]) for (let y = 23; y < 31; y += 3) put(ctx, 20 + dx, y, C.e6);
  } else if (s.shape === 'succulent') {
    for (let i = -3; i <= 3; i++)
      poly(
        ctx,
        [
          [18, 32],
          [20 + i * 4, 29 - h + Math.abs(i) * 2],
          [23, 32],
        ],
        i % 2 ? leaf : C.g5,
      );
    put(ctx, 20, 28, petal, 2, 2);
  } else if (s.shape === 'mushroom' || s.shape === 'shelf') {
    for (let i = 0; i < 3; i++) {
      const x = 13 + i * 7,
        y = 31 - (i % 2),
        height = Math.max(3, h - (i % 2));
      put(ctx, x, y - height, C.e6, 2, height);
      oval(ctx, x + 1, y - height, 4, s.shape === 'shelf' ? 1 : 2, petal);
      if (id === 'fly_agaric') {
        put(ctx, x - 1, y - height - 1, C.white);
        put(ctx, x + 3, y - height, C.white);
      }
      if (s.shape === 'shelf') oval(ctx, x - 1, y - height + 3, 3, 1, C.e5);
    }
  } else if (s.shape === 'coral') {
    for (let i = -2; i <= 2; i++) {
      const x = 20 + i * 4,
        y = 30 - h + Math.abs(i);
      line(ctx, 20, 32, x, y, leaf);
      line(ctx, x, y + 3, x - 2, y - 2, petal);
      line(ctx, x, y + 3, x + 2, y - 1, petal);
    }
  } else if (s.shape === 'vine') {
    for (let i = 0; i < 5; i++) {
      const x = 18 + (i % 2) * 4,
        y = 31 - i * 3;
      line(ctx, x, y, 18 + ((i + 1) % 2) * 4, y - 3, leaf);
      oval(ctx, x - 2, y - 1, 2, 1, leaf);
      put(ctx, x + 2, y - 2, petal, 2, 2);
    }
  }
  if (winter) {
    line(ctx, 12, 33, 27, 33, C.fog);
    put(ctx, 16, 32, C.pale, 4, 1);
  }
}

/** Each small animal has a recognizable anatomical rig; frame 0 pauses, frames 1–3 move. */
export function paintWildlife(ctx: Ctx, id: string, frame: number, season: number): void {
  const s = WILDLIFE_BY_ID[id];
  if (!s) return;
  const body = season === 3 && (id === 'stoat' || id === 'hare') ? C.pale : s.body;
  const accent = s.accent,
    step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const eye = (x: number, y: number) => put(ctx, x, y, C.ink);
  const feet = (x0: number, x1: number, y: number, height = 3) => {
    for (const x of [x0, x1]) {
      line(ctx, x, y, x + step, y + height, accent);
      put(ctx, x + step, y + height, C.ink, 2, 1);
    }
  };
  if (s.shape === 'rodent' || s.shape === 'spiny' || s.shape === 'hare' || s.shape === 'longbody') {
    const long = s.shape === 'longbody',
      hop = s.shape === 'hare' && frame > 0 ? Math.abs(step) : 0;
    oval(ctx, 18, 26 - hop, long ? 8 : 6, long ? 3 : 4, body);
    oval(ctx, 25, 23 - hop, 3, 3, body);
    oval(ctx, 24, 26 - hop, 3, 1, accent);
    feet(15, 23, 28 - hop, 3);
    if (s.shape === 'hare') {
      oval(ctx, 24, 17 - hop, 1, 5, body);
      oval(ctx, 27, 17 - hop, 1, 5, accent);
      oval(ctx, 12, 25 - hop, 2, 2, C.pale);
    } else if (s.shape === 'spiny') {
      for (let x = 12; x <= 22; x += 2) line(ctx, x, 24, x - 1, 20 + (x % 3), C.e1);
    } else {
      oval(ctx, 24, 20, 1, 2, accent);
      if (id === 'squirrel') {
        oval(ctx, 10 + step, 20, 3, 6, body);
        oval(ctx, 11 + step, 17, 2, 3, accent);
      } else line(ctx, 11, 27, long ? 5 : 7, 24 + step, body);
      if (id === 'chipmunk') {
        line(ctx, 13, 23, 21, 23, accent);
        line(ctx, 13, 25, 21, 25, C.ink);
      }
      if (id === 'stoat') put(ctx, 5, 24 + step, C.ink, 2, 2);
    }
    eye(27, 22 - hop);
    put(ctx, 29, 24 - hop, C.ink);
  } else if (s.shape === 'bird' || s.shape === 'wader' || s.shape === 'waterbird') {
    const tall = s.shape === 'wader',
      aquatic = s.shape === 'waterbird',
      y = tall ? 22 : 26;
    oval(ctx, 18, y, 5, 3, body);
    oval(ctx, 19, y + 1, 3, 2, id === 'robin' ? accent : C.pale);
    const hy = tall ? 12 : aquatic ? 21 : 22;
    line(ctx, 22, y, 24, hy + 1, body);
    oval(ctx, 25, hy, 3, 2, id === 'duck' ? accent : body);
    line(ctx, 28, hy, tall ? 33 : 30, hy + 1, C.e6);
    eye(26, hy - 1);
    line(ctx, 13, y, 9, y - 2, accent);
    line(ctx, 16, y - 1, 19 - step, y - 3 - Math.abs(step) * 2, accent);
    feet(16, 21, y + 2, tall ? 8 : 3);
    if (id === 'woodpecker') put(ctx, 24, hy - 3, accent, 3, 1);
    if (id === 'clockwork_wren') {
      oval(ctx, 17, y, 2, 2, accent);
      put(ctx, 17, y, C.ink);
    }
  } else if (s.shape === 'frog' || s.shape === 'newt' || s.shape === 'lizard' || s.shape === 'turtle') {
    const long = s.shape === 'newt' || s.shape === 'lizard';
    oval(ctx, 19, 27, long ? 7 : 5, s.shape === 'turtle' ? 4 : 3, body);
    oval(ctx, 26, 26, 3, 2, body);
    for (const x of [15, 23]) for (const dy of [-1, 1]) line(ctx, x, 27 + dy, x + step * dy - 2, 27 + dy * 4, accent);
    if (long) {
      line(ctx, 12, 27, 6, 24 + step, body);
      line(ctx, 6, 24 + step, 4, 26, body);
    }
    if (s.shape === 'turtle') {
      oval(ctx, 19, 25, 4, 2, C.g4);
      line(ctx, 16, 25, 22, 25, accent);
    }
    if (s.shape === 'frog') {
      oval(ctx, 26, 23, 1, 2, accent);
      oval(ctx, 16 - step, 29, 3, 2, body);
    }
    if (id === 'gecko') for (const x of [14, 18, 22]) put(ctx, x, 26, accent);
    eye(27, 25);
  } else if (s.shape === 'crab') {
    oval(ctx, 20, 27, 5, 3, body);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++)
        line(ctx, 20 + side * 4, 26 + i, 20 + side * (7 + (i % 2)), 25 + i * 2 + step, accent);
      line(ctx, 20 + side * 3, 25, 20 + side * 7, 21 - step, body);
      put(ctx, 19 + side * 7, 19 - step, body, 3, 3);
      put(ctx, 20 + side * 2, 23, C.ink);
    }
  } else {
    const flying = s.motion === 'flutter',
      y = flying ? 20 : 29;
    if (s.shape === 'moth') {
      for (const side of [-1, 1]) {
        oval(ctx, 20 + side * (frame === 2 ? 2 : 5), y - 2, frame === 2 ? 1 : 4, 3, body);
        oval(ctx, 20 + side * 4, y + 2, frame === 2 ? 1 : 3, 2, accent);
      }
      line(ctx, 20, y - 4, 20, y + 4, C.ink);
    } else if (s.shape === 'dragonfly') {
      line(ctx, 17, y, 25, y, body);
      for (const side of [-1, 1]) line(ctx, 20, y, 16 + step, y + side * (3 + Math.abs(step)), accent);
      eye(25, y);
    } else if (s.shape === 'bee') {
      oval(ctx, 20, y, 4, 2, body);
      put(ctx, 18, y - 2, accent, 1, 5);
      put(ctx, 21, y - 2, accent, 1, 5);
      oval(ctx, 19, y - 3 - Math.abs(step), 2 + step, 1, C.pale);
      eye(24, y);
    } else {
      oval(ctx, 20, y, 3, 3, body);
      line(ctx, 20, y - 2, 20, y + 2, accent);
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++) {
          line(ctx, 20 + side * 2, y - 1 + i, 20 + side * 4, y - 2 + i * 2 + step, accent);
          if (id === 'ladybird') put(ctx, 20 + side * 2, y - 1 + i, C.ink);
        }
      eye(22, y - 3);
    }
  }
}
