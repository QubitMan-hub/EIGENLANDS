/**
 * Isometric props for the everyday scenes and the road: a realm standard carried at the head of a marching column,
 * a chopping block with an axe in it, a water bucket and a grain sack (carried at the hands or on the shoulder).
 * All are modelled with the isokit Prop (real boxes and cylinders under the game's 2:1 camera), never drawn flat.
 */
import { C, type Ramp } from './shade';
import { DARKWOOD, IRONM, WOODM, type Facing } from './isokit';
import { iso } from './props';
import type { ObjSprite } from './objects';

const cache = new Map<string, ObjSprite>();
const once = (k: string, mk: () => ObjSprite): ObjSprite => {
  let s = cache.get(k);
  if (!s) cache.set(k, (s = mk()));
  return s;
};

/** a six-step ramp around a palette name like 'e5' or 'r1' (banner fields in shared/kingdoms.ts) */
export function rampOf(name: string): Ramp {
  const fam = name.replace(/[0-9]/g, ''),
    n = Number(name.replace(/[^0-9]/g, '')) || 0;
  const table = C as unknown as Record<string, number>;
  if (!(`${fam}0` in table)) return [C.ink, C.night, C.slate, C.steel, C.mist, C.fog];
  const at = (k: number) => {
    for (let i = Math.max(0, Math.min(7, k)); i >= 0; i--) if (`${fam}${i}` in table) return table[`${fam}${i}`]!;
    return C.night;
  };
  return [at(n - 3), at(n - 2), at(n - 1), at(n), at(n + 1), at(n + 2)];
}

/** A realm's standard on a carrying pole: the cloth hangs from a crossbar and stirs (frame f). */
export function standardSprite(field: string, charge: string, face: Facing, f: number): ObjSprite {
  return once(`std:${field}:${charge}:${face}:${f % 2}`, () =>
    iso(
      30,
      70,
      face,
      (p) => {
        const cloth = rampOf(field),
          trim = rampOf(charge)[4]!;
        p.cyl(8, 8, 0, 0.7, 52, DARKWOOD, DARKWOOD);
        p.cyl(8, 8, 52, 1.2, 1.4, rampOf('e5'), rampOf('e6'));
        p.box(3, 8.2, 48.5, 10, 0.7, 0.7, { ramp: DARKWOOD });
        p.box(3.3 + (f % 2) * 0.3, 8.5, 32, 9.4, 0.3, 16.5, {
          ramp: cloth,
          front: (s, t, c) => {
            if (t < 0.14 && Math.abs(s - 0.5) < (0.14 - t) * 2.6) return -1; // swallow tail
            if (s < 0.09 || s > 0.91 || t > 0.93) return trim;
            const dx = (s - 0.5) * 9,
              dz = (t - 0.58) * 16;
            if (Math.hypot(dx, dz) < 2.4) return trim; // the device
            return c(Math.round(s * 9 + f) % 4 === 0 ? -1 : 0);
          },
        });
      },
      { margin: 6 },
    ),
  );
}

/** A chopping block: a sawn round with a split face, an axe bitten into it, chips around its foot. */
export function choppingBlockSprite(face: Facing = 'sw'): ObjSprite {
  return once(`block:${face}`, () =>
    iso(30, 30, face, (p) => {
      const END: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6, C.e7];
      p.cyl(8, 8, 0, 4.4, 6.5, WOODM, END);
      p.dot(8, 8, 6.6, C.e3, 2, 1); // the year rings
      // the axe: haft leaning back, head buried in the top
      p.line(9, 7.5, 6.5, 13.5, 5.5, 15, C.e2);
      p.box(7.2, 7.2, 5.5, 2.6, 1, 2.2, { ramp: IRONM });
      for (const [a, b] of [
        [3, 12],
        [13, 11],
        [12, 3.5],
        [4.5, 4],
      ])
        p.box(a!, b!, 0, 1.6, 0.8, 0.5, { ramp: END });
    }),
  );
}

/** A wooden water bucket with an iron band and a rope bail, for carrying (anchor at its base). */
export function bucketSprite(): ObjSprite {
  return once('bucket', () =>
    iso(
      18,
      22,
      'sw',
      (p) => {
        p.cyl(8, 8, 0, 3, 6, WOODM, [C.w2, C.w3, C.w4, C.w5, C.w6, C.w7], (t) =>
          t > 0.75 && t < 0.88 ? C.slate : null,
        );
        p.line(5, 8, 6, 8, 8, 10, C.e1);
        p.line(8, 8, 10, 11, 8, 6, C.e1);
      },
      { margin: 5 },
    ),
  );
}

/** A tied grain sack, carried on the shoulder (anchor at its base). */
export function sackSprite(): ObjSprite {
  return once('sack', () =>
    iso(
      22,
      22,
      'sw',
      (p) => {
        const HESSIAN: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6, C.e7];
        p.box(4.5, 5, 0, 7, 6, 6, { ramp: HESSIAN });
        p.cyl(8, 8, 6, 2.2, 1.6, HESSIAN, HESSIAN);
        p.cyl(8, 8, 7.6, 0.9, 1.4, [C.e0, C.e1, C.e2, C.e2, C.e3, C.e3]);
      },
      { margin: 5 },
    ),
  );
}

/** A broom standing at the sweeper's side, bristles on the ground; `k` (0..2) tilts it through the stroke. */
export function broomSprite(k: number): ObjSprite {
  const t = ((k % 3) + 3) % 3;
  return once(`broom:${t}`, () =>
    iso(
      30,
      40,
      'sw',
      (p) => {
        const lean = (t - 1) * 3;
        p.line(8 + lean, 8, 3, 8, 8, 26, C.e2);
        p.box(5.5 + lean, 7, 0, 5, 2, 3, { ramp: [C.e3, C.e4, C.e5, C.e6, C.e6, C.e7] });
        p.box(6.5 + lean, 7.5, 3, 3, 1, 1, { ramp: [C.e1, C.e2, C.e2, C.e3, C.e3, C.e4] });
      },
      { margin: 5 },
    ),
  );
}

/** The lamplighter's pole: its foot on the ground, a taper burning at the top; `lift` 0/1 raises it to a lamp. */
export function lampPoleSprite(lift: number): ObjSprite {
  const l = lift ? 1 : 0;
  return once(`lpole:${l}`, () =>
    iso(
      30,
      90,
      'sw',
      (p) => {
        const top = 58 + l * 10;
        p.line(8, 8, 0, 11, 6, top, C.e1);
        p.line(9, 8, 0, 12, 6, top, C.e2);
        p.box(10.5, 5.5, top, 1.5, 1.5, 2, { ramp: IRONM });
        p.dot(11, 6, top + 3.5, C.e7, 1, 2);
        p.dot(11, 6, top + 5, C.white);
      },
      { margin: 5 },
    ),
  );
}

/** A lute held across the body: a round-backed bowl and a fretted neck (`strum` nudges the hand frame). */
export function luteSprite(): ObjSprite {
  return once('lute', () =>
    iso(
      30,
      26,
      'sw',
      (p) => {
        const BOWL: Ramp = [C.r0, C.e1, C.e2, C.e3, C.e4, C.e5];
        p.box(5, 7, 2, 6, 2, 5, { ramp: BOWL });
        p.dot(8, 9, 4.5, C.ink, 2, 2); // the rose
        p.line(11, 8, 5, 18, 8, 9, C.e1);
        p.box(17, 7.5, 8.5, 2, 1, 1.5, { ramp: DARKWOOD });
      },
      { margin: 4 },
    ),
  );
}

/** An umbrella: a ribbed cone canopy on a stick (anchor at the hand that holds it). */
export function umbrellaSprite(colour: string): ObjSprite {
  return once(`umb:${colour}`, () =>
    iso(
      40,
      44,
      'sw',
      (p) => {
        const r = rampOf(colour);
        p.line(8, 8, 0, 8, 8, 24, C.e1);
        for (let k = 0; k < 4; k++) p.cyl(8, 8, 20 + k * 1.6, 9 - k * 2.4, 1.6, r, r);
        p.dot(8, 8, 27.5, C.e1);
      },
      { margin: 4 },
    ),
  );
}

/** A watchman's lantern on its ring: glazed sides lit from within (carried at the hand). */
export function lanternSprite(): ObjSprite {
  return once('lantern', () =>
    iso(
      22,
      32,
      'sw',
      (p) => {
        const GLOW: Ramp = [C.e5, C.e6, C.e7, C.e7, C.white, C.white];
        p.box(5, 5, 0, 6, 6, 1.5, { ramp: IRONM });
        p.box(5.5, 5.5, 1.5, 5, 5, 7, { ramp: GLOW, front: (s) => (Math.abs(s - 0.5) < 0.08 ? C.slate : null) });
        p.box(5, 5, 8.5, 6, 6, 1.5, { ramp: IRONM });
        p.cyl(8, 8, 10, 1.6, 1.5, IRONM, IRONM);
        p.line(8, 8, 11.5, 8, 8, 15, C.slate);
      },
      { margin: 4 },
    ),
  );
}

/** A fishing rod angled out over the water from the hand (the line itself is drawn as a string). */
export function rodSprite(face: Facing): ObjSprite {
  return once(`rod:${face}`, () =>
    iso(
      48,
      40,
      face,
      (p) => {
        p.line(8, 8, 0, 22, 8, 18, C.e1);
        p.line(9, 8, 0, 9.5, 8, 2, C.e3);
        p.dot(22, 8, 18, C.e4);
      },
      { margin: 4, flat: true },
    ),
  );
}
