/**
 * The road caravan's covered wagon, in native 2:1 iso: a plank bed on four spoked wheels, a hooped canvas cover in the
 * kingdom's colour with a darker band, crates and a hanging lantern. Built along the road for both road axes ('sw'
 * runs along x, 'se' along y), with two wheel frames so the spokes turn while it rolls.
 */
import type { RealmId } from '@eigenlands/shared';
import { C, type Ramp } from './shade';
import { WOODM, DARKWOOD, type Detail, type Facing } from './isokit';
import { iso } from './props';
import type { ObjSprite } from './objects';

const CANVAS: Record<RealmId, { cloth: Ramp; band: number }> = {
  aurelion: { cloth: [C.e3, C.e4, C.e5, C.e6, C.e7, C.white], band: C.r3 },
  sylvaris: { cloth: [C.g2, C.g3, C.g4, C.g5, C.g6, C.pale], band: C.e5 },
  khardum: { cloth: [C.slate, C.steel, C.mist, C.fog, C.pale, C.white], band: C.r2 },
  raijin: { cloth: [C.r1, C.r2, C.r3, C.r4, C.e6, C.pale], band: C.ink },
  thalassara: { cloth: [C.w2, C.w3, C.w4, C.w5, C.w6, C.white], band: C.e5 },
  nethrakar: { cloth: [C.q1, C.q2, C.q3, C.q4, C.q5, C.q6], band: C.r4 },
};

/** a spoked wheel painted on a thin upright face; `turn` rotates the spokes */
const wheel =
  (turn: number): Detail =>
  (s, t) => {
    const dx = (s - 0.5) * 2,
      dy = (t - 0.5) * 2,
      r = Math.hypot(dx, dy);
    if (r > 1) return -1;
    if (r > 0.78) return C.e1;
    if (r < 0.2) return C.e3;
    const a = Math.atan2(dy, dx) + turn;
    return Math.abs(Math.sin(a * 3)) < 0.28 ? C.e2 : -1;
  };

function wagon(face: Facing, f: number, realm: RealmId, rev: boolean): ObjSprite {
  const look = CANVAS[realm];
  return iso(
    84,
    80,
    face,
    (prop) => {
      // a reversed wagon (rolling toward -x or -y) is the same model mirrored along the road
      const p = {
        box: (
          a0: number,
          b0: number,
          z0: number,
          da: number,
          db: number,
          dz: number,
          m: Parameters<typeof prop.box>[6],
        ) => prop.box(rev ? 12 - a0 - da : a0, b0, z0, da, db, dz, m),
      };
      const turn = ((rev ? -f : f) * Math.PI) / 6;
      // far wheels first, then the bed, the cover and the near wheels
      for (const a of [-4, 12])
        p.box(a, 2.6, 0, 6.5, 0.8, 6.5, { ramp: DARKWOOD, front: wheel(turn), end: () => -1, top: () => -1 });
      p.box(-6, 3.4, 4.5, 24, 9.4, 1.5, { ramp: DARKWOOD });
      p.box(-6, 3.4, 6, 24, 9.4, 3, { ramp: WOODM, front: (_s, t, c) => (t > 0.45 && t < 0.55 ? c(-1) : null) });
      // hooped canvas: stacked, narrowing slabs make the rounded top; a band of the kingdom's second colour
      const cloth = look.cloth;
      for (let k = 0; k < 7; k++) {
        const z = 9 + k * 1.6,
          w = Math.max(2.5, 9.4 - Math.max(0, k - 2) * 1.6);
        p.box(-4.5, 3.4 + (9.4 - w) / 2, z, 19.5, w, 1.6, {
          ramp: cloth,
          front: (s) => (Math.abs(s - 0.5) < 0.06 ? look.band : null),
          top: (s) => (Math.abs(s - 0.5) < 0.06 ? look.band : null),
        });
      }
      // crates on the tailboard and the driver's bench up front
      p.box(-6.5, 4.5, 9, 3.2, 3.4, 3.2, { ramp: WOODM });
      p.box(-6.2, 8.6, 9, 2.6, 2.6, 2.6, { ramp: WOODM });
      p.box(15, 4.2, 9, 3, 7.8, 1.2, { ramp: WOODM });
      p.box(17.4, 4.2, 10.2, 0.8, 7.8, 2.6, { ramp: WOODM });
      // a lantern on a pole at the front corner
      p.box(17.6, 12.4, 9, 0.6, 0.6, 9, { ramp: DARKWOOD });
      p.box(17.1, 11.9, 15.5, 1.6, 1.6, 2.2, { ramp: [C.e2, C.e4, C.e6, C.e7, C.white] });
      // the draught pole, reaching toward the horse
      p.box(18, 7.6, 4.2, 6, 1, 0.9, { ramp: WOODM });
      for (const a of [-4, 12])
        p.box(a, 13, 0, 6.5, 0.8, 6.5, { ramp: DARKWOOD, front: wheel(-turn), end: () => -1, top: () => -1 });
    },
    { margin: 14 },
  );
}

const cache = new Map<string, ObjSprite>();
/** `face` 'sw' rolls along x, 'se' along y; `rev` toward -x/-y; frame 0..1 turns the wheels. */
export function wagonSprite(realm: RealmId, face: Facing, frame: number, rev = false): ObjSprite {
  const key = `${realm}:${face}:${frame & 1}:${rev ? 1 : 0}`;
  let s = cache.get(key);
  if (!s) {
    s = wagon(face, frame & 1, realm, rev);
    cache.set(key, s);
  }
  return s;
}
