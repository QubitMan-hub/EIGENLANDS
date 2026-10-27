/**
 * Story scenes in the wild (master plan §16, shared/src/stories.ts), native 2:1 iso: a cold camp (fire ring, bedroll,
 * a pack with an open journal), a grave with a sword driven into its mound, an overturned cart and its broken
 * crates, a carved standing stone, a wayside shrine stuffed with notes, and the sealed crypt door under a ruin.
 * One tile each (16 units a side, origin at the back corner), like the ruins they share the wild with.
 */
import { C, type Ramp } from './shade';
import { DARKWOOD, STONEM, WOODM, type Facing } from './isokit';
import { iso } from './props';
import type { ObjSprite } from './objects';

const EARTH: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e4];
const ASH: Ramp = [C.ink, C.night, C.slate, C.steel];
const CLOTH: Ramp = [C.r0, C.r1, C.r2, C.r3, C.r4];
const PAPER: Ramp = [C.e5, C.e6, C.e7, C.white, C.white];
const IRON: Ramp = [C.ink, C.night, C.slate, C.steel, C.mist];
const MOSSY: Ramp = [C.g1, C.g2, C.g3, C.g4];
const RUNE = C.t2;

function firepit(face: Facing): ObjSprite {
  return iso(
    40,
    30,
    face,
    (p) => {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        p.box(8 + Math.cos(a) * 5 - 1.2, 8 + Math.sin(a) * 5 - 1.2, 0, 2.4, 2.4, 1.8, { ramp: STONEM });
      }
      p.box(5.5, 5.5, 0, 5, 5, 0.4, { ramp: ASH });
      p.box(5, 7.4, 0.4, 6, 1.2, 1.2, { ramp: [C.ink, C.e0, C.e1] });
      p.box(7.4, 5, 0.6, 1.2, 6, 1.2, { ramp: [C.ink, C.e0, C.e1] });
    },
    { margin: 6 },
  );
}

function bedroll(face: Facing): ObjSprite {
  return iso(
    40,
    30,
    face,
    (p) => {
      p.box(2, 4, 0, 11, 6, 0.8, { ramp: CLOTH, top: (s) => (Math.abs(s - 0.7) < 0.05 ? C.e6 : null) });
      p.box(11, 4, 0.8, 3, 6, 2.6, { ramp: CLOTH }); // the rolled end
      p.box(3, 11, 0, 4, 3, 3, { ramp: [C.e1, C.e2, C.e3, C.e4] }); // a boot, left behind
    },
    { margin: 6 },
  );
}

function journal(face: Facing): ObjSprite {
  return iso(
    40,
    40,
    face,
    (p) => {
      // a travelling pack slumped against nothing, an open book on top and a quill
      p.box(3, 4, 0, 9, 7, 7, {
        ramp: [C.e1, C.e2, C.e3, C.e4, C.e5],
        front: (_s, t) => (t > 0.45 && t < 0.55 ? C.e1 : null),
      });
      p.box(4, 4.5, 7, 7, 6, 1.2, { ramp: [C.e1, C.e2, C.e3] });
      p.box(4.5, 5, 8.2, 3, 5, 0.6, { ramp: PAPER });
      p.box(7.6, 5, 8.2, 3, 5, 0.6, { ramp: PAPER, top: (_s, t) => (Math.round(t * 8) % 2 ? C.e4 : null) });
      p.box(9, 9, 8.8, 0.5, 0.5, 4, { ramp: [C.mist, C.fog, C.white] });
    },
    { margin: 6 },
  );
}

function grave(face: Facing): ObjSprite {
  return iso(
    40,
    56,
    face,
    (p) => {
      p.box(2, 3, 0, 12, 9, 2, { ramp: EARTH });
      p.box(3.5, 4.5, 2, 9, 6, 1.4, { ramp: MOSSY });
      for (const [a, b, c] of [
        [4, 10, C.r4],
        [7, 11, C.e7],
        [10, 10.5, C.q5],
      ] as const)
        p.box(a, b, 2, 1, 1, 1.4, { ramp: [c, c, c, c] });
      // a sword driven in at the head of the grave, crossguard and pommel above the earth
      p.box(7.4, 2.4, 0, 1.2, 0.8, 22, { ramp: IRON });
      p.box(5, 2.2, 15, 6, 1.2, 1.4, { ramp: IRON });
      p.box(7.2, 2.2, 16.4, 1.6, 1.2, 4, { ramp: [C.e0, C.e1, C.e2] });
      p.box(7.1, 2.1, 20.4, 1.8, 1.4, 1.6, { ramp: [C.e3, C.e5, C.e6, C.e7] });
    },
    { margin: 8 },
  );
}

function cart(face: Facing): ObjSprite {
  return iso(
    64,
    52,
    face,
    (p) => {
      // the bed lies on its side: its floor faces us, one wheel up in the air, the other snapped beneath
      p.box(-2, 6, 0, 20, 2, 11, { ramp: WOODM, front: (_s, t) => (Math.round(t * 11) % 3 === 0 ? C.e1 : null) });
      p.box(-2, 2, 0, 20, 4, 1.4, { ramp: DARKWOOD });
      p.box(-2, 2, 9.6, 20, 4, 1.4, { ramp: DARKWOOD });
      p.box(3, 8, 9, 6, 0.8, 6, {
        ramp: DARKWOOD,
        front: (s, t) => {
          const r = Math.hypot((s - 0.5) * 2, (t - 0.5) * 2);
          return r > 1 ? -1 : r > 0.75 ? C.e1 : r < 0.2 ? C.e3 : null;
        },
      });
      p.box(12, 9, 0, 4, 2, 1.6, { ramp: DARKWOOD }); // the broken wheel
      p.box(16, 9, 0, 6, 1, 1, { ramp: WOODM }); // the shaft, snapped
    },
    { margin: 8 },
  );
}

function crate(face: Facing): ObjSprite {
  return iso(
    36,
    32,
    face,
    (p) => {
      // an open crate, its lid gone: straw inside, then the four walls round it
      p.box(3.5, 3.5, 0, 8, 8, 3.5, { ramp: [C.e4, C.e5, C.e6, C.e7] });
      p.box(3, 3, 0, 9, 1, 6, { ramp: WOODM });
      p.box(3, 3, 0, 1, 9, 6, { ramp: WOODM });
      p.box(3, 11, 0, 9, 1, 6, { ramp: WOODM, front: (_s, t) => (Math.abs(t - 0.5) < 0.1 ? C.e1 : null) });
      p.box(11, 3, 0, 1, 9, 6, { ramp: WOODM, front: (_s, t) => (Math.abs(t - 0.5) < 0.1 ? C.e1 : null) });
      p.box(12, 6, 0, 4, 2, 0.8, { ramp: WOODM }); // a stove-in board
    },
    { margin: 6 },
  );
}

function stone(face: Facing): ObjSprite {
  return iso(
    40,
    72,
    face,
    (p) => {
      p.box(3, 4, 0, 10, 8, 3, { ramp: STONEM });
      p.box(4.5, 5.5, 3, 7, 5, 24, {
        ramp: STONEM,
        // the carvings: backwards runes low down, a lopsided heart above
        front: (s, t) => {
          if (t > 0.15 && t < 0.45 && Math.abs(s - 0.5) < 0.25 && Math.round(t * 30) % 3 === 0) return RUNE;
          const hx = (s - 0.5) * 2.4,
            hy = (t - 0.68) * 3.2;
          const heart = Math.pow(hx * hx + hy * hy - 0.35, 3) - hx * hx * hy * hy * hy;
          return Math.abs(heart) < 0.012 ? C.night : null;
        },
      });
      p.box(5, 6, 27, 6, 4, 3, { ramp: STONEM });
      p.box(4, 5, 3, 2, 2, 5, { ramp: MOSSY, top: () => -1 });
    },
    { margin: 8 },
  );
}

function shrine(face: Facing): ObjSprite {
  return iso(
    44,
    66,
    face,
    (p) => {
      p.box(7, 7, 0, 2, 2, 16, { ramp: DARKWOOD });
      p.box(3.5, 3.5, 16, 9, 9, 7, {
        ramp: WOODM,
        front: (s, t) =>
          s > 0.2 && s < 0.8 && t > 0.2 && t < 0.85 ? (Math.round(s * 9 + t * 5) % 3 ? C.e6 : C.white) : null,
      });
      // a little pitched roof
      p.box(2.5, 2.5, 23, 11, 11, 1.4, { ramp: [C.r0, C.r1, C.r2, C.r3] });
      p.box(4, 4, 24.4, 8, 8, 1.4, { ramp: [C.r0, C.r1, C.r2, C.r3] });
      p.box(5.5, 5.5, 25.8, 5, 5, 1.4, { ramp: [C.r0, C.r1, C.r2, C.r3] });
      // ribbons tied to the post
      for (const [z, c] of [
        [6, C.q5],
        [9, C.w5],
        [12, C.e6],
      ] as const)
        p.box(8.8, 7.2, z, 2.4, 0.4, 0.8, { ramp: [c, c, c, c] });
    },
    { margin: 8 },
  );
}

function crypt(face: Facing): ObjSprite {
  return iso(
    48,
    56,
    face,
    (p) => {
      // steps sinking toward a door of fitted stone under a heavy lintel
      p.box(0, 0, 0, 16, 16, 1, { ramp: STONEM });
      for (let k = 0; k < 3; k++) p.box(3, 8 + k * 2.4, 0, 10, 2.4, 0.6, { ramp: [C.ink, C.night, C.slate] });
      for (const a of [1, 13]) p.box(a, 2, 0, 2, 4, 16, { ramp: STONEM });
      p.box(1, 2, 16, 14, 4, 3, {
        ramp: STONEM,
        front: (s, t) => (t > 0.3 && t < 0.7 && Math.round(s * 14) % 2 === 0 && s > 0.15 && s < 0.85 ? RUNE : null),
      });
      p.box(3, 3, 0, 10, 2, 16, {
        ramp: [C.night, C.slate, C.steel, C.mist],
        front: (s, t) =>
          Math.abs(s - 0.5) < 0.03 || Math.abs(t - 0.55) < 0.025
            ? C.ink
            : Math.abs(s - 0.5) < 0.1 && Math.abs(t - 0.55) < 0.06
              ? RUNE
              : null,
      });
    },
    { margin: 8 },
  );
}

const GILT: Ramp = [C.e0, C.e2, C.e4, C.c3, C.c4, C.e7];
const BONE: Ramp = [C.mist, C.fog, C.pale, C.white];

/** steps rising to a square of daylight under a stone lintel */
function cryptExit(face: Facing): ObjSprite {
  return iso(
    48,
    64,
    face,
    (p) => {
      for (let k = 0; k < 5; k++) p.box(3, 10 - k * 2, k * 3, 10, 2, 3, { ramp: STONEM });
      for (const a of [1, 13]) p.box(a, 0, 0, 2, 12, 18, { ramp: STONEM });
      p.box(1, 0, 18, 14, 3, 3, {
        ramp: STONEM,
        front: (s, t) => (t > 0.3 && t < 0.7 && Math.round(s * 12) % 3 === 0 ? RUNE : null),
      });
      p.box(3, 0, 15, 10, 0.6, 3, { ramp: [C.e5, C.e6, C.e7, C.white, C.white] }); // the light from above
    },
    { margin: 8 },
  );
}

/** a gilded reliquary on a stepped dais, runes glowing along its lid */
function reliquary(face: Facing): ObjSprite {
  return iso(
    44,
    48,
    face,
    (p) => {
      p.box(1, 1, 0, 14, 14, 2, { ramp: STONEM });
      p.box(3, 3, 2, 10, 10, 2, { ramp: STONEM });
      p.box(4, 5, 4, 8, 6, 6, {
        ramp: GILT,
        front: (s, t) => (Math.abs(t - 0.5) < 0.1 && s > 0.15 && s < 0.85 ? RUNE : null),
      });
      p.box(3.6, 4.6, 10, 8.8, 6.8, 1.6, { ramp: GILT });
      p.box(7, 7, 11.6, 2, 2, 1.6, { ramp: [C.q3, C.q5, C.q6, C.q7] }); // a gem on the lid
    },
    { margin: 8 },
  );
}

/** a stone coffin with a carved effigy on its lid */
function sarcophagus(face: Facing): ObjSprite {
  return iso(
    44,
    40,
    face,
    (p) => {
      p.box(2, 4, 0, 13, 7, 5, {
        ramp: STONEM,
        front: (s, t) => (t > 0.4 && t < 0.6 && Math.round(s * 13) % 4 === 0 ? C.night : null),
      });
      p.box(1.5, 3.5, 5, 14, 8, 1.4, { ramp: STONEM });
      p.box(4, 5.5, 6.4, 9, 4, 1.6, { ramp: [C.slate, C.steel, C.mist, C.fog] }); // the effigy
      p.box(12, 6.5, 8, 2, 2, 1.2, { ramp: [C.slate, C.steel, C.mist, C.fog] });
    },
    { margin: 8 },
  );
}

function bones(face: Facing): ObjSprite {
  return iso(
    32,
    20,
    face,
    (p) => {
      p.box(3, 5, 0, 7, 1, 0.8, { ramp: BONE });
      p.box(6, 2, 0, 1, 8, 0.8, { ramp: BONE });
      p.box(10, 7, 0, 3, 3, 2.4, {
        ramp: BONE,
        front: (s, t) => (t > 0.3 && t < 0.6 && Math.abs(s - 0.5) > 0.15 && Math.abs(s - 0.5) < 0.35 ? C.ink : null),
      });
    },
    { margin: 4 },
  );
}

/** a traveller's pack, dropped where they fell (Hardcore) */
function satchel(face: Facing): ObjSprite {
  return iso(
    32,
    28,
    face,
    (p) => {
      p.box(3, 4, 0, 9, 7, 5, {
        ramp: [C.e1, C.e2, C.e3, C.e4, C.e5],
        front: (_s, t) => (Math.abs(t - 0.5) < 0.1 ? C.e1 : null),
      });
      p.box(3.5, 4.5, 5, 8, 6, 1.4, { ramp: [C.e2, C.e3, C.e4, C.e5] });
      p.box(6.5, 3.6, 2.5, 2, 0.6, 2, { ramp: [C.e4, C.e5, C.e6, C.e7] }); // buckle
      p.box(11, 5, 0, 3, 2, 0.8, { ramp: [C.r2, C.r3, C.r4] }); // a spilled bedroll strap
    },
    { margin: 6 },
  );
}

export const STORY_ART: Record<string, (face: Facing) => ObjSprite> = {
  lost_satchel: satchel,
  crypt_exit: cryptExit,
  crypt_reliquary: reliquary,
  crypt_sarcophagus: sarcophagus,
  crypt_bones: bones,
  story_firepit: firepit,
  story_bedroll: bedroll,
  story_journal: journal,
  story_grave: grave,
  story_cart: cart,
  story_crate: crate,
  story_stone: stone,
  story_shrine: shrine,
  ruin_crypt: crypt,
};
