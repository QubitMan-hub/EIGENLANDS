/**
 * Living settlements (master plan §16), native 2:1 iso: what a kingdom's state looks like on the ground. A timber
 * scaffold over rising stone courses while a public work is under way, a plinth monument for each finished work
 * (its topper tells which), and a string of pennants when the realm prospers or feasts. The props are 2×2 tiles
 * (32 units a side) with the origin at the back corner, like every other placed object.
 */
import type { ProjectKind, RealmId } from '@eigenlands/shared';
import { C, type Ramp } from './shade';
import { DARKWOOD, STONEM, WOODM, type Facing } from './isokit';
import { iso } from './props';
import type { ObjSprite } from './objects';

/** each kingdom's banner cloth and trim (the wagon canvases use the same colours) */
export const REALM_CLOTH: Record<RealmId | 'home', { cloth: Ramp; trim: number }> = {
  home: { cloth: [C.q1, C.q2, C.q3, C.q4, C.q5, C.q6], trim: C.e6 },
  aurelion: { cloth: [C.e3, C.e4, C.e5, C.e6, C.e7, C.white], trim: C.r3 },
  sylvaris: { cloth: [C.g2, C.g3, C.g4, C.g5, C.g6, C.pale], trim: C.e5 },
  khardum: { cloth: [C.slate, C.steel, C.mist, C.fog, C.pale, C.white], trim: C.r2 },
  raijin: { cloth: [C.r1, C.r2, C.r3, C.r4, C.e6, C.pale], trim: C.ink },
  thalassara: { cloth: [C.w2, C.w3, C.w4, C.w5, C.w6, C.white], trim: C.e5 },
  nethrakar: { cloth: [C.q1, C.q2, C.q3, C.q4, C.q5, C.q6], trim: C.r4 },
};
const GOLD: Ramp = [C.e0, C.e2, C.e4, C.c3, C.c4, C.e7];
const BRONZE: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e4, C.e5];
const CUT: Ramp = [C.slate, C.steel, C.mist, C.fog, C.pale, C.white];

/** A public work under construction: `stage` 0..3 raises the stone courses and the scaffold decks. */
export function scaffoldSprite(stage: number, face: Facing = 'sw'): ObjSprite {
  return cached(`scaf:${stage}:${face}`, () =>
    iso(
      72,
      92,
      face,
      (p) => {
        const courses = 1 + stage;
        // rising walls on two sides, block by block
        for (let k = 0; k < courses; k++) {
          const z = k * 5;
          p.box(4, 4, z, 24, 4, 5, {
            ramp: STONEM,
            front: (s, _t, c) => ((s * 6 + k * 0.5) % 1 < 0.06 ? c(-1) : null),
          });
          p.box(4, 8, z, 4, 18 - k * 3, 5, { ramp: STONEM });
        }
        // corner poles and plank decks, one per stage
        const top = 8 + courses * 5;
        for (const [a, b] of [
          [2, 2],
          [28, 2],
          [2, 28],
        ] as const)
          p.box(a, b, 0, 1.4, 1.4, top, { ramp: DARKWOOD });
        for (let k = 1; k <= Math.min(3, stage + 1); k++)
          p.box(1.5, 1.5, k * 7, 28, 3, 1, { ramp: WOODM, front: (s, _t, c) => ((s * 7) % 1 < 0.08 ? c(-1) : null) });
        // a ladder against the near pole, a block pile and a hoist arm
        for (let r = 0; r < top - 2; r += 3) p.box(26, 4.2, r, 3, 0.5, 0.6, { ramp: WOODM });
        p.box(26, 4, 0, 0.6, 0.6, top - 2, { ramp: WOODM });
        p.box(29, 4, 0, 0.6, 0.6, top - 2, { ramp: WOODM });
        p.box(16, 22, 0, 5, 5, 4, { ramp: CUT });
        p.box(17, 23, 4, 4, 4, 3, { ramp: CUT });
        p.box(22, 23, 0, 4, 4, 3, { ramp: CUT });
        p.box(2, 2, top, 16, 1.2, 1.2, { ramp: DARKWOOD });
        p.box(16.5, 2.2, top - 7, 0.4, 0.4, 7, { ramp: [C.e2, C.e3, C.e4] });
        p.box(15.5, 1.4, top - 10, 2.4, 2.4, 3, { ramp: CUT });
      },
      { margin: 10 },
    ),
  );
}

/** the topper that tells which work a monument remembers */
function topper(p: Parameters<Parameters<typeof iso>[3]>[0], kind: ProjectKind, cloth: Ramp, z: number): void {
  switch (kind) {
    case 'market': // a bronze balance
      p.box(15, 15, z, 2, 2, 12, { ramp: BRONZE });
      p.box(7, 15.2, z + 12, 18, 1.6, 1.2, { ramp: BRONZE });
      for (const a of [7, 22]) p.box(a, 13.5, z + 7, 3.4, 4.6, 1.2, { ramp: GOLD });
      break;
    case 'walls': // a crenellated tower stub
      p.box(9, 9, z, 14, 14, 12, { ramp: STONEM });
      for (const [a, b] of [
        [9, 9],
        [19, 9],
        [9, 19],
        [19, 19],
      ] as const)
        p.box(a, b, z + 12, 4, 4, 3, { ramp: STONEM });
      break;
    case 'granary': // a stack of grain sacks under a little roof
      for (const [a, b, h] of [
        [10, 10, 0],
        [16, 10, 0],
        [10, 16, 0],
        [16, 16, 0],
        [13, 13, 5],
      ] as const)
        p.box(a, b, z + h, 6, 6, 5, { ramp: [C.e1, C.e2, C.e3, C.e4, C.e5] });
      break;
    case 'temple': // a gilded obelisk
      p.box(12, 12, z, 8, 8, 18, { ramp: CUT });
      p.box(13, 13, z + 18, 6, 6, 4, { ramp: CUT });
      p.box(14, 14, z + 22, 4, 4, 3, { ramp: GOLD });
      break;
    case 'harbor': // an anchor on a post
      p.box(15, 15, z, 2, 2, 16, { ramp: DARKWOOD });
      p.box(14.2, 14.2, z + 4, 3.6, 3.6, 1.6, { ramp: [C.ink, C.night, C.slate, C.steel] });
      p.box(9, 15.2, z + 3, 14, 1.6, 1.6, { ramp: [C.ink, C.night, C.slate, C.steel] });
      p.box(14.5, 14.5, z + 15, 3, 3, 2, { ramp: [C.ink, C.night, C.slate, C.steel] });
      break;
    case 'bridge': // a little arch
      for (const a of [8, 20]) p.box(a, 13, z, 4, 6, 12, { ramp: STONEM });
      p.box(8, 13, z + 12, 16, 6, 3, { ramp: STONEM });
      break;
    case 'academy': // an open book on a lectern
      p.box(14, 14, z, 4, 4, 9, { ramp: WOODM });
      p.box(10, 12, z + 9, 12, 8, 1.4, { ramp: [C.e5, C.e6, C.e7, C.white, C.white] });
      p.box(15.6, 12, z + 10.4, 0.8, 8, 0.8, { ramp: cloth });
      break;
  }
}

/** A finished public work's monument: a stepped plinth, a kingdom pennant and the work's topper. */
export function monumentSprite(kind: ProjectKind, realm: RealmId | 'home', face: Facing = 'sw'): ObjSprite {
  return cached(`mon:${kind}:${realm}:${face}`, () =>
    iso(
      72,
      104,
      face,
      (p) => {
        const look = REALM_CLOTH[realm];
        p.box(3, 3, 0, 26, 26, 3, { ramp: STONEM });
        p.box(6, 6, 3, 20, 20, 3, { ramp: CUT, front: (_s, t) => (t > 0.4 && t < 0.6 ? look.trim : null) });
        topper(p, kind, look.cloth, 6);
        // a pennant pole at the back corner
        p.box(4, 4, 6, 1.2, 1.2, 30, { ramp: DARKWOOD });
        p.box(5.2, 4.2, 26, 9, 0.6, 8, {
          ramp: look.cloth,
          front: (s, t) => (s > 0.75 && Math.abs(t - 0.5) < 0.18 ? -1 : t > 0.82 ? look.trim : null),
        });
      },
      { margin: 10 },
    ),
  );
}

/** Pennants strung between two poles: the realm prospers or feasts. `f` 0..3 makes them flutter. */
export function buntingSprite(realm: RealmId | 'home', f: number, face: Facing = 'sw'): ObjSprite {
  return cached(`bunt:${realm}:${f}:${face}`, () =>
    iso(
      88,
      76,
      face,
      (p) => {
        const look = REALM_CLOTH[realm];
        const span = 44;
        for (const a of [0, span]) p.box(a, 8, 0, 1.4, 1.4, 24, { ramp: DARKWOOD });
        // the cord sags in the middle; pennants alternate the kingdom's cloth and trim
        for (let k = 0; k < 10; k++) {
          const a = 2 + k * 4.2,
            u = a / span;
          const z = 22 - Math.sin(u * Math.PI) * 5;
          p.box(a, 8.4, z, 4.2, 0.4, 0.5, { ramp: [C.e1, C.e2, C.e3] });
          const flap = (k + f) % 4 === 0 ? 1 : 0;
          const ramp: Ramp = k % 2 ? look.cloth : [look.trim, look.trim, look.trim, look.trim];
          p.box(a + 0.8, 8.2 + flap * 0.4, z - 4, 2.6, 0.5, 4, {
            ramp,
            front: (s, t) => (t < 0.5 && Math.abs(s - 0.5) > t ? -1 : null),
          });
        }
      },
      { margin: 10 },
    ),
  );
}

const cache = new Map<string, ObjSprite>();
function cached(key: string, mk: () => ObjSprite): ObjSprite {
  let s = cache.get(key);
  if (!s) cache.set(key, (s = mk()));
  return s;
}
