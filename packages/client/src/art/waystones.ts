/**
 * Travel architecture (master plan §14), native 2:1 iso like every other prop: the waystone (a rune-cut menhir on a
 * stepped plinth with a hovering lodestone), the Realm Gate (a three-tile arch whose portal swirls between two runed
 * pillars) and the harbour Ferry post (a bell, a lantern and an anchor board on a stone footing). All three share the
 * verdigris rune light of the network so a traveller learns to read them from far off.
 */
import { C, poly, type Ramp } from './shade';
import { STONEM, WOODM, type Detail, type Facing } from './isokit';
import { anim, iso, type Mk } from './props';
import type { ObjSprite } from './objects';

const RUNESTONE: Ramp = [C.night, C.slate, C.steel, C.mist, C.fog, C.pale];
const MOSS: Ramp = [C.g1, C.g2, C.g3, C.g4, C.g5];
const VIOLET: Ramp = [C.q1, C.q2, C.q3, C.q4, C.q5, C.q6];
/** worked gold: deep brown shadow up to a warm yellow highlight (the plain earth ramp reads as pale wood) */
const GOLD: Ramp = [C.e0, C.e2, C.e4, C.c3, C.c4, C.e7];
/** a band wrapped round a shaft: side faces only (its top would paint over the shaft above it) */
const BAND = { ramp: GOLD, top: () => -1 };
/** rune light by frame: a slow breath */
const glowOf = (f: number) => [C.t1, C.t2, C.w6, C.t2][f % 4]!;

/** carved rune strokes down a face: a column of short marks with gaps */
const runes =
  (f: number, lo = 0.2, hi = 0.85): Detail =>
  (s, t) => {
    if (t < lo || t > hi || Math.abs(s - 0.5) > 0.22) return null;
    const row = Math.floor(t * 18);
    const mark = row % 3 !== 2 && (Math.abs(s - 0.5) < 0.08 || (row % 3 === 0 && Math.abs(s - 0.5) < 0.2));
    return mark ? glowOf(f + row) : null;
  };

function waystone(face: Facing, f: number): ObjSprite {
  return iso(
    48,
    98,
    face,
    (p, ctx) => {
      // a two-step plinth, mossy at the foot
      p.box(0.5, 0.5, 0, 15, 15, 3.5, { ramp: STONEM, top: (s, t, c) => ((s * 7 + t * 5) % 1 < 0.08 ? c(-1) : null) });
      p.box(2.5, 2.5, 3.5, 11, 11, 3, { ramp: STONEM });
      for (const [a, b] of [
        [1, 13],
        [11.5, 14],
        [14, 1.5],
        [2, 2],
      ] as const)
        p.box(a, b, 3.5, 1.6, 1.2, 1.2, { ramp: MOSS });
      // the menhir: tapering in three stages, runes cut down its lit face and its edge
      p.box(4.5, 5, 6.5, 7, 6, 20, { ramp: RUNESTONE, front: runes(f, 0.08, 0.95), end: runes(f + 2, 0.25, 0.85) });
      p.box(5, 5.5, 26.5, 6, 5, 10, { ramp: RUNESTONE, front: runes(f + 1, 0.1, 0.8) });
      p.box(6, 6.4, 36.5, 4, 3.2, 3, { ramp: RUNESTONE });
      p.box(6.8, 7, 39.5, 2.4, 2, 1.5, { ramp: RUNESTONE });
      // gold collars where the stages meet
      p.box(4.2, 4.7, 25.6, 7.6, 6.6, 1.2, BAND);
      p.box(4.7, 5.2, 35.6, 6.6, 5.6, 1, BAND);
      // the lodestone: a faceted shard hovering over the tip, bobbing a pixel
      const bob = [0, 1, 2, 1][f % 4]!;
      const ox = p.X(8, 8),
        oy = p.Y(8, 8, 49 + bob);
      poly(
        ctx,
        [
          [ox, oy - 6],
          [ox + 3, oy],
          [ox, oy + 5],
          [ox - 3, oy],
        ],
        C.t1,
      );
      poly(
        ctx,
        [
          [ox, oy - 6],
          [ox - 3, oy],
          [ox, oy + 1],
        ],
        C.w6,
      );
      poly(
        ctx,
        [
          [ox, oy - 6],
          [ox + 3, oy],
          [ox, oy + 1],
        ],
        C.t2,
      );
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(ox - 1), Math.round(oy - 4), 1, 2);
    },
    { margin: 12 },
  );
}

function realmGate(face: Facing, f: number): ObjSprite {
  return iso(
    96,
    124,
    face,
    (p) => {
      // a broad stair across all three tiles
      p.box(-15, 1, 0, 46, 14, 2.5, { ramp: STONEM, top: (s, _t, c) => ((s * 23) % 1 < 0.05 ? c(-1) : null) });
      p.box(-13, 3, 2.5, 42, 10, 2, { ramp: STONEM });
      // the portal: a curtain of light hung between the pillars, swirling over four frames
      const swirl: Detail = (s, t) => {
        // round the top of the opening
        if (t > 0.8 && Math.hypot((s - 0.5) * 2, (t - 0.8) * 5) > 1) return -1;
        const edge = Math.min(s, 1 - s) < 0.05 || (t > 0.8 && Math.hypot((s - 0.5) * 2, (t - 0.8) * 5) > 0.9);
        if (edge) return C.q7;
        const r = Math.hypot(s - 0.5, (t - 0.45) * 0.8);
        const a = Math.atan2(t - 0.45, s - 0.5);
        const w = Math.sin(a * 3 + r * 26 - f * 1.57);
        if (r < 0.05) return C.white;
        return w > 0.55 ? C.q6 : w > 0 ? C.q5 : w > -0.5 ? C.q4 : r < 0.25 ? C.t2 : C.q3;
      };
      p.box(-6, 7.6, 4.5, 28, 0.8, 41, { ramp: VIOLET, front: swirl, end: () => C.q4, top: () => -1 });
      // pillars: runed shafts with gold bands
      for (const a of [-14, 22]) {
        p.box(a - 1, 2, 4.5, 10, 12, 3, { ramp: STONEM });
        p.box(a, 3, 7.5, 8, 10, 36, { ramp: RUNESTONE, front: runes(f + (a > 0 ? 2 : 0), 0.12, 0.92) });
        for (const z of [15, 33]) p.box(a - 0.2, 2.8, z, 8.4, 10.4, 1.2, BAND);
        p.box(a - 1, 2, 43.5, 10, 12, 3, { ramp: STONEM });
      }
      // the lintel and a keystone holding a violet gem
      p.box(-15, 2.5, 46.5, 46, 11, 6, { ramp: STONEM, front: runes(f + 1, 0.3, 0.7) });
      p.box(-15.2, 2.3, 51.3, 46.4, 11.4, 1.2, BAND);
      p.box(4, 2, 53.3, 8, 12, 6, { ramp: STONEM });
      p.box(6, 3.5, 59.3, 4, 9, 2.5, { ramp: VIOLET });
      // braziers at the foot of each pillar, flames breathing
      const flame = [C.r5, C.r6, C.e7, C.r6][f % 4]!;
      for (const a of [-12, 26]) {
        p.cyl(a, 14.5, 4.5, 1.8, 4, GOLD);
        p.cyl(a, 14.5, 8.5, 1, 2 + (f % 2), [C.r3, flame, C.e7], [flame, C.e7, C.white]);
      }
    },
    { margin: 16 },
  );
}

function ferryPost(face: Facing, f: number): ObjSprite {
  return iso(
    60,
    104,
    face,
    (p, ctx) => {
      // stone footing with the network's rune set into it
      p.box(1, 1, 0, 14, 14, 3.5, {
        ramp: STONEM,
        top: (s, t) => (Math.abs(s - 0.3) < 0.1 && Math.abs(t - 0.3) < 0.1 ? glowOf(f) : null),
      });
      // the post and its crossbeam
      p.box(6.5, 6.5, 3.5, 3, 3, 44, { ramp: WOODM, front: (_s, t, c) => ((t * 44) % 7 < 0.7 ? c(-1) : null) });
      p.box(-0.5, 7, 41, 17, 2, 2.5, { ramp: WOODM });
      p.box(4.5, 7, 37, 1.5, 2, 4, { ramp: WOODM });
      p.box(10, 7, 37, 1.5, 2, 4, { ramp: WOODM });
      // the ferry bell, swinging gently
      const sw = [0, 0.6, 0, -0.6][f % 4]!;
      p.line(1.5, 8, 41, 1.5 + sw, 8, 37, C.e2);
      // a flared bronze bell: a wide lip, a narrower waist and a crown
      p.cyl(1.5 + sw, 8, 29, 3.4, 2.2, GOLD, GOLD);
      p.cyl(1.5 + sw, 8, 31.2, 2.6, 3.2, GOLD, GOLD);
      p.cyl(1.5 + sw, 8, 34.4, 1.6, 1.4, GOLD, GOLD);
      p.dot(1.5 + sw * 2, 8, 28, C.e1, 2, 1);
      // a lantern hung from the other arm
      p.line(14.5, 8, 41, 14.5, 8, 37, C.e2);
      p.box(13.2, 6.8, 30.5, 2.8, 2.8, 5.5, { ramp: [C.e1, C.e3, C.e6, C.e7, C.white] });
      p.box(13, 6.6, 36, 3.2, 3.2, 1, { ramp: WOODM });
      // the anchor board on the post's face
      p.box(4, 9.5, 15, 8.5, 1.2, 11, { ramp: WOODM });
      const ax = p.X(8.2, 10.7),
        ay = p.Y(8.2, 10.7, 20.5);
      ctx.fillStyle = '#f0e2bd';
      ctx.fillRect(Math.round(ax), Math.round(ay - 4), 1, 8);
      ctx.fillRect(Math.round(ax - 1), Math.round(ay - 5), 3, 1);
      ctx.fillRect(Math.round(ax - 3), Math.round(ay - 2), 7, 1);
      ctx.fillRect(Math.round(ax - 3), Math.round(ay + 2), 1, 2);
      ctx.fillRect(Math.round(ax + 3), Math.round(ay + 2), 1, 2);
      ctx.fillRect(Math.round(ax - 2), Math.round(ay + 4), 5, 1);
      // a blue pennant snapping in the sea wind
      const wave = [0, 1, 0, -1][f % 4]!;
      p.line(8, 8, 47.5, 8, 8, 54, C.e2);
      p.box(8.4, 7.6, 49.5 + wave * 0.4, 6, 0.6, 3.5, { ramp: [C.b0, C.b0, C.b1, C.b1, C.w6] });
      // coiled mooring rope and a crate at the foot
      p.cyl(12.5, 12.5, 3.5, 2, 1.4, [C.e2, C.e3, C.e4, C.e5]);
      p.box(1.5, 10.5, 3.5, 3.5, 3.5, 3.5, { ramp: WOODM });
    },
    { margin: 12 },
  );
}

/** Registered alongside the town props (worldobjs looks them up by sub). */
export const TRAVEL_PROPS: Record<string, Mk> = {
  waystone: anim(4, 4, waystone),
  realm_gate: anim(4, 6, realmGate),
  ferry_post: anim(4, 3, ferryPost),
};
