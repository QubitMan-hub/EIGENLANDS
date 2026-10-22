import { Rectangle, Texture } from 'pixi.js';
import { HUE_PALETTE, WEAPONS, type WeaponId } from '@eigenlands/shared';
import { CAST_FRAME, personGrip } from './actors';
import { C, line, makeCanvas, outline, poly, put, undithered } from './shade';

/** Held geometry is rasterized at each facing, never rotated as a finished frontal sprite. */
export class HeldWeapons {
  private sheets = new Map<WeaponId, Texture>();
  private frames = new Map<string, Texture>();

  texture(id: WeaponId, dir: number, frame: number): Texture {
    const f = Math.max(0, frame), key = `${id}:${dir}:${f}`;
    const old = this.frames.get(key);
    if (old) return old;
    let sheet = this.sheets.get(id);
    if (!sheet) {
      const { canvas, ctx } = makeCanvas(56 * 30, 64 * 8);
      for (let d = 0; d < 8; d++) for (let n = 0; n < 30; n++) {
        const b = makeCanvas(56, 64), g = personGrip(d, n), x = g.x + 16, y = g.y + 16;
        const bow = WEAPONS[id].cls === 'crossbow', staff = WEAPONS[id].cls === 'staff';
        const angle = bow && n < 22 ? (d === 2 || d === 4 || d === 6 ? -2.6 : -0.55) : g.angle;
        const ux = Math.cos(angle), uy = Math.sin(angle), vx = -uy, vy = ux;
        const pt = (along: number, across = 0): [number, number] => [x + ux * along + vx * across, y + uy * along + vy * across];
        const stroke = (a: number, z: number, c: number, offset = 0) => { const p = pt(a, offset), q = pt(z, offset); line(b.ctx, p[0], p[1], q[0], q[1], c); };
        undithered(() => {
          if (bow) {
            poly(b.ctx, [pt(-3, -1), pt(6, -1), pt(7, 1), pt(-3, 1)], C.e2);
            stroke(-3, 6, C.e4, -0.7);
            // Swept limbs have thickness and separate upper-lit and lower-shaded edges.
            for (const side of [-1, 1]) {
              const a = pt(3, side * 0.6), q = pt(1, side * 6), tip = pt(-1, side * 7);
              line(b.ctx, a[0], a[1], q[0], q[1], side < 0 ? C.steel : C.slate);
              line(b.ctx, q[0], q[1], tip[0], tip[1], C.mist);
              const notch = pt(-2, 0); line(b.ctx, notch[0], notch[1], tip[0], tip[1], C.e6);
            }
            stroke(0, 8, C.fog); const tip = pt(9); put(b.ctx, Math.round(tip[0]), Math.round(tip[1]), C.pale);
          } else if (staff) {
            stroke(-7, 8, C.e1, 0.8); stroke(-7, 8, C.e4);
            const hue = HUE_PALETTE[WEAPONS[id].hue] ?? C.q7;
            poly(b.ctx, [pt(7, -3), pt(12), pt(7, 3), pt(5)], hue);
            poly(b.ctx, [pt(7, -3), pt(12), pt(7)], C.pale);
            for (const z of [-4, 1, 5]) { const a = pt(z, -1), q = pt(z, 1); line(b.ctx, a[0], a[1], q[0], q[1], C.e6); }
            if (n >= CAST_FRAME && n < CAST_FRAME + 3) { const p = pt(13, -2); put(b.ctx, Math.round(p[0]), Math.round(p[1]), C.q7); }
          } else {
            stroke(-3, 0, C.e2);
            poly(b.ctx, [pt(1, -1.3), pt(9, -1), pt(12), pt(9, 1.3), pt(1, 1.3)], C.steel);
            poly(b.ctx, [pt(1, -1.3), pt(9, -1), pt(12), pt(1)], C.pale);
            const a = pt(0, -3), q = pt(0, 3); line(b.ctx, a[0], a[1], q[0], q[1], C.e5);
            const pommel = pt(-4); put(b.ctx, Math.round(pommel[0]), Math.round(pommel[1]), C.e6);
          }
        });
        outline(b.ctx, 56, 64, C.night);
        ctx.drawImage(b.canvas, n * 56, d * 64);
      }
      sheet = Texture.from(canvas); sheet.source.scaleMode = 'nearest'; this.sheets.set(id, sheet);
    }
    const t = new Texture({ source: sheet.source, frame: new Rectangle(f * 56, dir * 64, 56, 64) });
    this.frames.set(key, t); return t;
  }
}
