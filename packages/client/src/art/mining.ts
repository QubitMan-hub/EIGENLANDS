import { Texture } from 'pixi.js';
import { Iso, mat, IRONM, WOODM } from './isokit';
import { C, makeCanvas, polish, undithered } from './shade';
import type { ObjSprite } from './objects';
const rails = new Map<string, ObjSprite>(),
  carts = new Map<number, ObjSprite>();
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;
/**
 * A rail piece in native u/v geometry: gravel bed, cross sleepers, and two steel rails with a lit top edge. Connected
 * ends reach exactly to the neighbouring diamond, corners are chamfered curves with the inner rail on the tighter arc,
 * and a dead end (`end` 1 = line start, 2 = line end) carries a timber buffer with a red bumper so the line visibly stops.
 */
export function railSprite(mask: number, end = 0): ObjSprite {
  const key = `${mask}:${end}`,
    old = rails.get(key);
  if (old) return old;
  const { canvas, ctx } = makeCanvas(36, 32),
    ax = 18,
    ay = 20;
  undithered(() => {
    const p = new Iso(ctx, ax, ay - 8),
      wood = mat(WOODM),
      gravel = mat([C.ink, C.night, C.slate, C.steel]);
    const legs = DIRS.filter((_, i) => mask & (1 << i)).map(([dx, dy]) => ({ dx, dy }));
    if (!legs.length) legs.push({ dx: 1, dy: 0 }, { dx: -1, dy: 0 });
    // gravel bed: a hub plus a strip to each connected edge
    p.box(2, 2, 0, 12, 12, 0.5, gravel);
    for (const { dx, dy } of legs) {
      const u0 = dx > 0 ? 8 : dx < 0 ? 0 : 2,
        v0 = dy > 0 ? 8 : dy < 0 ? 0 : 2;
      p.box(u0, v0, 0, dx ? 8 : 12, dy ? 8 : 12, 0.5, gravel);
    }
    // sleepers across each leg, one at the hub
    const tie = (u: number, v: number, alongU: boolean) =>
      alongU ? p.box(u - 0.9, v - 4.6, 0.5, 1.8, 9.2, 0.9, wood) : p.box(u - 4.6, v - 0.9, 0.5, 9.2, 1.8, 0.9, wood);
    for (const { dx, dy } of legs) for (const t of [3, 6, 9.5, 13]) tie(8 + dx * t, 8 + dy * t, !!dx);
    if (legs.length > 1 && legs.some((l) => l.dx) && legs.some((l) => l.dy)) tie(8, 8, true);
    const rail = (u0: number, v0: number, u1: number, v1: number) => {
      p.line3(u0, v0, 1.1, u1, v1, 1.1, C.slate);
      p.line3(u0, v0, 1.7, u1, v1, 1.7, C.mist);
      p.line3(u0 - 0.4, v0 - 0.4, 1.7, u1 - 0.4, v1 - 0.4, 1.7, C.fog);
    };
    if (legs.length === 1) {
      const { dx, dy } = legs[0]!;
      for (const k of [-2.6, 2.6]) {
        // rail from the buffer to the edge
        const a = [8 - dx * 4 + (dx ? 0 : k), 8 - dy * 4 + (dy ? 0 : k)],
          b = [8 + dx * 8 + (dx ? 0 : k), 8 + dy * 8 + (dy ? 0 : k)];
        rail(a[0]!, a[1]!, b[0]!, b[1]!);
      }
      if (end) {
        // timber buffer across the rails, bumper facing down the line
        const bx = 8 - dx * 4.8,
          by = 8 - dy * 4.8;
        const across = dx ? by : bx,
          along = dx ? bx : by;
        if (dx) {
          p.box(along - 1.2, across - 5, 0.5, 2.4, 10, 4.5, wood);
          p.box(along - 1.2 + dx * 1.2, across - 4.6, 4.8, 2, 3, 1.5, { top: C.r5, left: C.r3, right: C.r2 });
          p.box(along - 1.2 + dx * 1.2, across + 1.6, 4.8, 2, 3, 1.5, { top: C.r5, left: C.r3, right: C.r2 });
          p.box(along - 2.4, across - 5, 0.5, 1.2, 1.4, 6, wood);
          p.box(along - 2.4, across + 3.6, 0.5, 1.2, 1.4, 6, wood);
        } else {
          p.box(across - 5, along - 1.2, 0.5, 10, 2.4, 4.5, wood);
          p.box(across - 4.6, along - 1.2 + dy * 1.2, 4.8, 3, 2, 1.5, { top: C.r5, left: C.r3, right: C.r2 });
          p.box(across + 1.6, along - 1.2 + dy * 1.2, 4.8, 3, 2, 1.5, { top: C.r5, left: C.r3, right: C.r2 });
          p.box(across - 5, along - 2.4, 0.5, 1.4, 1.2, 6, wood);
          p.box(across + 3.6, along - 2.4, 0.5, 1.4, 1.2, 6, wood);
        }
      }
    } else if (legs.length === 2 && legs[0]!.dx * legs[1]!.dx + legs[0]!.dy * legs[1]!.dy === 0) {
      // a curve: both rails chamfer the corner, the inner on the tighter arc
      const [a, b] = legs as [(typeof legs)[0], (typeof legs)[0]];
      for (const sign of [-1, 1]) {
        // lane offset toward the inside of the turn (sign +1) or the outside
        const lane = 2.6 * sign;
        const ea: [number, number] = [8 + a.dx * 8 + b.dx * lane, 8 + a.dy * 8 + b.dy * lane],
          eb: [number, number] = [8 + b.dx * 8 + a.dx * lane, 8 + b.dy * 8 + a.dy * lane];
        const cut = sign > 0 ? 0.5 : 2.6;
        const ma: [number, number] = [8 + b.dx * lane + a.dx * cut, 8 + b.dy * lane + a.dy * cut],
          mb: [number, number] = [8 + a.dx * lane + b.dx * cut, 8 + a.dy * lane + b.dy * cut];
        rail(ea[0], ea[1], ma[0], ma[1]);
        rail(ma[0], ma[1], mb[0], mb[1]);
        rail(mb[0], mb[1], eb[0], eb[1]);
      }
    } else {
      // straight run, junction or crossing: parallel rails through every leg
      for (const { dx, dy } of legs)
        for (const k of [-2.6, 2.6])
          rail(8 + (dx ? 0 : k), 8 + (dy ? 0 : k), 8 + dx * 8 + (dx ? 0 : k), 8 + dy * 8 + (dy ? 0 : k));
    }
    polish(ctx, 36, 32, { rim: false, ao: { ax, ay, rx: 14 } });
  });
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  const sprite = { tex, ax, ay };
  rails.set(key, sprite);
  return sprite;
}
export function minecartSprite(axis = 0, station = false, mask = 5): ObjSprite {
  const key = axis + (station ? 2 : 0) + (station ? mask * 4 : 0),
    old = carts.get(key);
  if (old) return old;
  const { canvas, ctx } = makeCanvas(44, 40),
    ax = 22,
    ay = 30;
  undithered(() => {
    const p = new Iso(ctx, ax, ay - 8),
      iron = mat(IRONM, { grain: 4 }),
      wood = mat(WOODM);
    const box = (u: number, v: number, z: number, du: number, dv: number, dz: number, m: ReturnType<typeof mat>) =>
      axis ? p.box(v, u, z, dv, du, dz, m) : p.box(u, v, z, du, dv, dz, m);
    if (station) {
      // the cart waits on its own bed of track
      const under = railSprite(mask, 0);
      ctx.drawImage(under.tex.source.resource as CanvasImageSource, ax - under.ax, ay - under.ay);
    }
    // Wheel pairs, recessed bed, sloped-looking stepped iron body and reinforced rim.
    for (const u of [3, 12]) for (const v of [2, 12]) box(u, v, 0, 2.5, 2, 4, iron);
    box(1, 2, 4, 14, 12, 1.5, wood);
    box(1, 2, 5, 14, 1.5, 7, iron);
    box(1, 12.5, 5, 14, 1.5, 7, iron);
    box(1, 3.5, 5, 1.5, 9, 7, iron);
    box(13.5, 3.5, 5, 1.5, 9, 7, iron);
    box(0.5, 1.5, 12, 15, 2, 1, wood);
    box(0.5, 12, 12, 15, 2, 1, wood);
    box(0.5, 3.5, 12, 2, 8.5, 1, wood);
    box(13.5, 3.5, 12, 2, 8.5, 1, wood);
    p.dot(11, 14.1, 8, C.e5);
    p.dot(4, 14.1, 8, C.mist);
    polish(ctx, 44, 40, { rim: false, ao: { ax, ay, rx: 12 } });
  });
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  const sprite = { tex, ax, ay };
  carts.set(key, sprite);
  return sprite;
}
