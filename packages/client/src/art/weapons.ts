import { Rectangle, Texture } from 'pixi.js';
import { HUE_PALETTE, WEAPONS, isWeaponId, type WeaponId, type ToolSpec } from '@eigenlands/shared';
import { ATTACK_FRAME, RUN_FRAME, SHOT_FRAME, CAST_FRAME, personGrip } from './actors';
import { actionPose } from './person-actions';
import { C, line, makeCanvas, outline, poly, put, undithered } from './shade';

export type HeldId = WeaponId | ToolSpec['type'];
export const isHeldId = (id: unknown): id is HeldId =>
  isWeaponId(id) || ['axe', 'pickaxe', 'hoe', 'can', 'rod', 'net'].includes(String(id));

/** Held geometry is rasterized at each facing, never rotated as a finished frontal sprite. */
export class HeldWeapons {
  private sheets = new Map<string, Texture>();
  private frames = new Map<string, Texture>();

  texture(id: HeldId, dir: number, frame: number): Texture {
    const f = Math.max(0, frame),
      key = `${id}:${dir}:${f}`;
    const old = this.frames.get(key);
    if (old) return old;
    const extra = f >= 30,
      cols = extra ? 1 : 30,
      sheetKey = extra ? `${id}:${f}` : id;
    let sheet = this.sheets.get(sheetKey);
    if (!sheet) {
      const { canvas, ctx } = makeCanvas(56 * cols, 64 * 8);
      for (let d = 0; d < 8; d++)
        for (let column = 0; column < cols; column++) {
          const n = extra ? f : column;
          const b = makeCanvas(56, 64),
            g = personGrip(d, n),
            x = g.x + 16,
            y = g.y + 16;
          const w = isWeaponId(id) ? WEAPONS[id] : null,
            fam: string = w?.fam ?? id,
            [metal, shine] = w?.tint ?? [C.steel, C.pale],
            bow = w?.cls === 'crossbow',
            staff = w?.cls === 'staff',
            tool = !w;
          const work = actionPose(d, n);
          const aimedTool = !work && (id === 'can' || id === 'rod') && n >= CAST_FRAME;
          const thrust = fam === 'spear' && n >= ATTACK_FRAME && n < ATTACK_FRAME + 4;
          // Broad heads rest outside the face; grip/arm anchors remain unchanged.
          const resting =
            (fam === 'spear' ||
              fam === 'battle_axe' ||
              fam === 'warhammer' ||
              fam === 'greatsword' ||
              (tool && id !== 'can')) &&
            (n < ATTACK_FRAME || (n >= RUN_FRAME && n < SHOT_FRAME));
          const angle = work
            ? work.angle
            : id === 'can' && !aimedTool
              ? 0
              : thrust || aimedTool
                ? personGrip(d, SHOT_FRAME).angle
                : resting
                  ? personGrip(d, 0).x < 12.5
                    ? -2.05
                    : -1.1
                  : bow && n < 22
                    ? d === 2 || d === 4 || d === 6
                      ? -2.6
                      : -0.55
                    : g.angle;
          const ux = Math.cos(angle),
            uy = Math.sin(angle),
            vx = -uy,
            vy = ux;
          const pt = (along: number, across = 0): [number, number] => [
            x + ux * along + vx * across,
            y + uy * along + vy * across,
          ];
          const stroke = (a: number, z: number, c: number, offset = 0) => {
            const p = pt(a, offset),
              q = pt(z, offset);
            line(b.ctx, p[0], p[1], q[0], q[1], c);
          };
          undithered(() => {
            if (tool) {
              if (id !== 'can') {
                stroke(-4, id === 'rod' ? 13 : 8, C.e1, 0.8);
                stroke(-4, id === 'rod' ? 13 : 8, C.e4);
              }
              if (id === 'axe') {
                poly(b.ctx, [pt(6, -1), pt(10, -6), pt(7, -7), pt(3, -4), pt(3, -1)], C.steel);
                poly(b.ctx, [pt(10, -6), pt(7, -7), pt(4, -5), pt(4, -3)], C.pale);
              } else if (id === 'pickaxe') {
                poly(b.ctx, [pt(8, -7), pt(10, -3), pt(9, 1), pt(7, 6), pt(7, 1), pt(8, -3)], C.mist);
                stroke(7, 9, C.pale);
              } else if (id === 'hoe') {
                poly(b.ctx, [pt(7, -1), pt(8, -5), pt(5, -6), pt(5, -2)], C.steel);
                const a = pt(5, -6),
                  q = pt(8, -5);
                line(b.ctx, ...a, ...q, C.pale);
              } else if (id === 'can') {
                poly(b.ctx, [pt(-1, -3), pt(5, -3), pt(5, 2), pt(-1, 2)], C.w3);
                poly(b.ctx, [pt(-1, -3), pt(5, -3), pt(4, -5), pt(0, -5)], C.w5);
                const a = pt(5, 0),
                  q = pt(9, -3);
                line(b.ctx, ...a, ...q, C.w4);
                stroke(0, 4, C.w6, -5);
              } else if (id === 'rod' && work?.action !== 'fish') {
                const a = pt(13),
                  q = pt(8, 7);
                line(b.ctx, ...a, ...q, C.fog);
                const p = pt(8, 8);
                put(b.ctx, p[0], p[1], C.r4);
              } else if (id === 'net') {
                const ring = Array.from({ length: 13 }, (_, i) =>
                  pt(10 + Math.cos((i / 12) * Math.PI * 2) * 3, Math.sin((i / 12) * Math.PI * 2) * 4),
                );
                for (let i = 1; i < ring.length; i++) line(b.ctx, ...ring[i - 1]!, ...ring[i]!, i < 7 ? C.e5 : C.e2);
                for (const k of [-1, 1]) {
                  const a = pt(8, k * 2),
                    q = pt(12, -k * 2);
                  line(b.ctx, ...a, ...q, C.fog);
                }
              }
            } else if (fam === 'spear') {
              stroke(-5, 11, C.e1, 0.8);
              stroke(-5, 11, C.e4);
              poly(b.ctx, [pt(10, -2), pt(15), pt(10, 2), pt(9)], metal);
              poly(b.ctx, [pt(10, -2), pt(15), pt(10)], shine);
              for (const z of [-2, 0, 7]) {
                const a = pt(z, -1),
                  q = pt(z, 1);
                line(b.ctx, ...a, ...q, C.e6);
              }
            } else if (fam === 'battle_axe') {
              stroke(-5, 11, C.e1, 0.8);
              stroke(-5, 11, C.e4);
              stroke(-4, 0, C.r3);
              poly(b.ctx, [pt(7, -1), pt(9, -6), pt(13, -5), pt(14, 1), pt(11, 5), pt(8, 3)], metal);
              poly(b.ctx, [pt(9, -6), pt(13, -5), pt(14, 1), pt(11, 5), pt(12, 0), pt(11, -4)], shine);
              const a = pt(8, -2),
                q = pt(10, 2);
              line(b.ctx, ...a, ...q, C.e6);
            } else if (fam === 'dagger') {
              // a short leaf blade with a crossguard; its twin rides in the other hand
              stroke(-3, 1, C.e2);
              {
                const g0 = pt(0.5, -2),
                  g1 = pt(0.5, 2);
                line(b.ctx, ...g0, ...g1, C.e6);
              }
              poly(b.ctx, [pt(1, -1.2), pt(7, -0.6), pt(8.5, 0), pt(7, 0.6), pt(1, 1.2)], metal);
              poly(b.ctx, [pt(1, -1.2), pt(7, -0.6), pt(8.5, 0)], shine);
              const twin = [pt(-1, 5), pt(4, 6.5), pt(5, 7), pt(4, 7.5), pt(-1, 6)] as Array<[number, number]>;
              poly(b.ctx, twin, metal);
            } else if (fam === 'greatsword') {
              // a long two-handed blade: a wide guard, a long grip and a fuller down the middle
              stroke(-6, 0, C.e2);
              {
                const g0 = pt(0.5, -3.5),
                  g1 = pt(0.5, 3.5);
                line(b.ctx, ...g0, ...g1, C.e6);
              }
              poly(b.ctx, [pt(1, -1.6), pt(17, -1), pt(19, 0), pt(17, 1), pt(1, 1.6)], metal);
              poly(b.ctx, [pt(1, -1.6), pt(17, -1), pt(19, 0)], shine);
              const a = pt(2, 0),
                q = pt(15, 0);
              line(b.ctx, ...a, ...q, C.slate);
            } else if (fam === 'warhammer') {
              stroke(-5, 9, C.e1, 0.8);
              stroke(-5, 9, C.e4);
              stroke(-4, 0, C.e2);
              poly(b.ctx, [pt(7, -5), pt(11, -5), pt(13, -2), pt(9, -2)], shine);
              poly(b.ctx, [pt(7, -5), pt(9, -2), pt(9, 5), pt(7, 2)], metal);
              poly(b.ctx, [pt(9, -2), pt(13, -2), pt(13, 5), pt(9, 5)], C.slate);
              const a = pt(10, -1),
                q = pt(10, 4);
              line(b.ctx, ...a, ...q, C.steel);
            } else if (bow) {
              poly(b.ctx, [pt(-3, -1), pt(6, -1), pt(7, 1), pt(-3, 1)], C.e2);
              stroke(-3, 6, C.e4, -0.7);
              // Swept limbs have thickness and separate upper-lit and lower-shaded edges.
              for (const side of [-1, 1]) {
                const a = pt(3, side * 0.6),
                  q = pt(1, side * 6),
                  tip = pt(-1, side * 7);
                line(b.ctx, a[0], a[1], q[0], q[1], side < 0 ? C.steel : C.slate);
                line(b.ctx, q[0], q[1], tip[0], tip[1], C.mist);
                const notch = pt(-2, 0);
                line(b.ctx, notch[0], notch[1], tip[0], tip[1], C.e6);
              }
              stroke(0, 8, C.fog);
              const tip = pt(9);
              put(b.ctx, Math.round(tip[0]), Math.round(tip[1]), C.pale);
            } else if (staff) {
              stroke(-7, 8, C.e1, 0.8);
              stroke(-7, 8, C.e4);
              const hue = HUE_PALETTE[w!.hue] ?? C.q7;
              poly(b.ctx, [pt(7, -3), pt(12), pt(7, 3), pt(5)], hue);
              poly(b.ctx, [pt(7, -3), pt(12), pt(7)], C.pale);
              for (const z of [-4, 1, 5]) {
                const a = pt(z, -1),
                  q = pt(z, 1);
                line(b.ctx, a[0], a[1], q[0], q[1], C.e6);
              }
              if (n >= CAST_FRAME && n < CAST_FRAME + 3) {
                const p = pt(13, -2);
                put(b.ctx, Math.round(p[0]), Math.round(p[1]), C.q7);
              }
            } else {
              stroke(-3, 0, C.e2);
              poly(b.ctx, [pt(1, -1.3), pt(9, -1), pt(12), pt(9, 1.3), pt(1, 1.3)], metal);
              poly(b.ctx, [pt(1, -1.3), pt(9, -1), pt(12), pt(1)], shine);
              const a = pt(0, -3),
                q = pt(0, 3);
              line(b.ctx, a[0], a[1], q[0], q[1], C.e5);
              const pommel = pt(-4);
              put(b.ctx, Math.round(pommel[0]), Math.round(pommel[1]), C.e6);
            }
          });
          outline(b.ctx, 56, 64, C.night);
          // Let the body hand cover the handle instead of painting a shaft across its fingers.
          b.ctx.clearRect(Math.round(x) - 1, Math.round(y) - 1, 3, 2);
          ctx.drawImage(b.canvas, column * 56, d * 64);
        }
      sheet = Texture.from(canvas);
      sheet.source.scaleMode = 'nearest';
      this.sheets.set(sheetKey, sheet);
    }
    const t = new Texture({ source: sheet.source, frame: new Rectangle((extra ? 0 : f) * 56, dir * 64, 56, 64) });
    this.frames.set(key, t);
    return t;
  }
}
