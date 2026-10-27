/**
 * Props of the three realms (shared/otherworlds.ts), drawn with the same isometric prop kit, palette and lighting as
 * every overworld prop so the realms read as part of one world: the realm portals and their return arches, Aetheria's
 * updrafts, wind chimes, cloud blooms and sky-temple pillars, the Abyss's glowing caps, obelisks and the Hollow's lamps,
 * Chronoria's hourglasses of upward sand, broken clocks, rifts, dials and the chrono gate, and each realm's lore tablet
 * and guardian altar. Animated ones have a few frames; the swirls are drawn in the faces' own pixel grid.
 */
import { C, type Ramp } from './shade';
import { DARKWOOD, STONEM, WOODM, type Facing } from './isokit';
import { iso } from './props';
import type { ObjSprite } from './objects';

type Realm = 'aetheria' | 'umbra' | 'chronoria';
const MARBLE: Ramp = [C.steel, C.mist, C.fog, C.pale, C.white];
const OBSIDIAN: Ramp = [C.ink, C.night, C.slate, C.steel];
const BRASS: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6, C.e7];
const GOLD: Ramp = [C.e4, C.e5, C.e6, C.e7, C.white];
const VIOLET: Ramp = [C.q1, C.q2, C.q3, C.q4, C.q5, C.q6];
const SKY: Ramp = [C.w3, C.w4, C.w5, C.w6, C.w7];

const STONE_OF: Record<Realm, Ramp> = { aetheria: MARBLE, umbra: OBSIDIAN, chronoria: BRASS };
const GLOW_OF: Record<Realm, number[]> = {
  aetheria: [C.w4, C.w5, C.w6, C.w7, C.white],
  umbra: [C.q2, C.q3, C.q4, C.q5, C.q6],
  chronoria: [C.q4, C.mist, C.pale, C.white, C.e7],
};

/** a standing arch with a swirling light inside: the realm portals (surface) and the return arches (in the realm) */
function portal(realm: Realm, f: number, face: Facing): ObjSprite {
  const stone = STONE_OF[realm],
    glow = GLOW_OF[realm];
  return iso(
    48,
    72,
    face,
    (p) => {
      p.box(0, 4, 0, 16, 8, 1.5, { ramp: stone }); // the step
      p.box(1, 6, 1.5, 3, 4, 20, { ramp: stone });
      p.box(12, 6, 1.5, 3, 4, 20, { ramp: stone });
      p.box(0, 5.5, 21.5, 16, 5, 3, { ramp: stone });
      p.box(6.5, 5, 24.5, 3, 6, 2, { ramp: realm === 'chronoria' ? GOLD : glow }); // keystone
      // the light: a sheet inside the arch whose rings turn frame by frame
      p.box(4, 7.6, 1.5, 8, 0.8, 20, {
        ramp: glow,
        front: (s, t) => {
          const dx = (s - 0.5) * 1.6,
            dy = (t - 0.5) * 2.4;
          const r = Math.hypot(dx, dy),
            a = Math.atan2(dy, dx);
          const k = Math.floor(((r * 6 - a / Math.PI + f / 4) % 1) * glow.length + glow.length) % glow.length;
          return r < 0.12 ? C.white : glow[k]!;
        },
        end: () => glow[2]!,
      });
      for (const [a, b] of [
        [2, 4],
        [13.5, 4],
      ] as const)
        p.dot(a, b, 23 + (f % 2), glow[4]!);
    },
    { margin: 10 },
  );
}

/** a column of rising wind over a ring of white stones */
function updraft(f: number, face: Facing): ObjSprite {
  return iso(
    40,
    64,
    face,
    (p) => {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        p.box(8 + Math.cos(a) * 6 - 1, 8 + Math.sin(a) * 6 - 1, 0, 2, 2, 1.5 + (k % 2), { ramp: MARBLE });
      }
      p.box(3, 3, 0, 10, 10, 0.3, { ramp: SKY });
      // wisps spiralling up
      for (let i = 0; i < 14; i++) {
        const z = ((i * 2.6 + f * 3) % 34) + 1;
        const a = i * 1.3 + z * 0.25 + f * 0.4;
        const r = 2.4 + (z / 34) * 2.4;
        p.dot(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, z, i % 3 ? C.white : C.w6);
      }
    },
    { margin: 8 },
  );
}

/** a wooden frame hung with bronze chimes */
function windChime(f: number, face: Facing): ObjSprite {
  return iso(
    36,
    56,
    face,
    (p) => {
      p.box(2, 7, 0, 2, 2, 22, { ramp: WOODM });
      p.box(12, 7, 0, 2, 2, 22, { ramp: WOODM });
      p.box(1, 7, 22, 14, 2, 1.6, { ramp: DARKWOOD });
      for (let i = 0; i < 4; i++) {
        const sway = (f % 2 ? 0.5 : -0.5) * ((i % 2) * 2 - 1);
        p.box(4.5 + i * 2.2 + sway, 7.6, 22 - 6 - i * 1.5, 0.9, 0.9, 6 + i * 1.5, { ramp: GOLD });
      }
      p.box(6, 7.5, 9, 4, 1, 1, { ramp: SKY }); // the clapper's sail
    },
    { margin: 6 },
  );
}

/** a white bloom of cloud-silk with a gold heart */
function skyBloom(face: Facing): ObjSprite {
  return iso(
    32,
    32,
    face,
    (p) => {
      p.box(7, 7, 0, 2, 2, 5, { ramp: [C.g2, C.g3, C.g4] });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        p.box(8 + Math.cos(a) * 3 - 2, 8 + Math.sin(a) * 3 - 1.5, 5, 4, 3, 1.4, { ramp: [C.fog, C.pale, C.white] });
      }
      p.box(6.5, 6.5, 6, 3, 3, 1.6, { ramp: GOLD });
    },
    { margin: 6 },
  );
}

/** a fallen marble column of a sky-temple, a gold band, a pebble floating above */
function skyPillar(face: Facing): ObjSprite {
  return iso(
    40,
    64,
    face,
    (p) => {
      p.box(3, 3, 0, 10, 10, 2, { ramp: MARBLE });
      p.cyl(8, 8, 2, 3.4, 18, MARBLE);
      p.cyl(8, 8, 12, 3.6, 1.4, GOLD);
      p.box(5.5, 5.5, 20, 5, 5, 1.5, { ramp: MARBLE, top: (s, t) => (s + t > 1.4 ? C.steel : null) });
      p.box(7, 7, 27, 2.4, 2.4, 2, { ramp: MARBLE });
    },
    { margin: 8 },
  );
}

/** a cluster of tall violet caps glowing in the dark */
function umbralCap(face: Facing): ObjSprite {
  return iso(
    36,
    40,
    face,
    (p) => {
      const stems: Array<[number, number, number, number]> = [
        [6, 7, 9, 3],
        [10, 9, 6, 2.4],
        [5, 11, 4, 2],
      ];
      for (const [a, b, h, r] of stems) {
        p.cyl(a, b, 0, r * 0.35, h, [C.mist, C.fog, C.pale]);
        p.cyl(a, b, h, r, r * 0.6, VIOLET, [C.q4, C.q5, C.q6, C.q7]);
        p.dot(a, b, h + r * 0.6 + 0.4, C.q7);
      }
    },
    { margin: 6 },
  );
}

/** a black obelisk with violet runes running up it */
function umbralObelisk(face: Facing): ObjSprite {
  return iso(
    32,
    72,
    face,
    (p) => {
      p.box(3, 3, 0, 10, 10, 2, { ramp: OBSIDIAN });
      p.box(5, 5, 2, 6, 6, 24, {
        ramp: OBSIDIAN,
        front: (s, t) => (Math.abs(s - 0.5) < 0.12 && Math.floor(t * 9) % 2 === 0 ? C.q5 : null),
        end: (s, t) => (Math.abs(s - 0.5) < 0.12 && Math.floor(t * 9 + 1) % 2 === 0 ? C.q4 : null),
      });
      p.box(6, 6, 26, 4, 4, 3, { ramp: OBSIDIAN });
      p.dot(8, 8, 30, C.q6);
    },
    { margin: 8 },
  );
}

/** the Hollow's iron lamps, still burning */
function hollowLamp(face: Facing): ObjSprite {
  return iso(
    28,
    64,
    face,
    (p) => {
      p.box(5, 5, 0, 6, 6, 2, { ramp: STONEM });
      p.box(7, 7, 2, 2, 2, 20, { ramp: OBSIDIAN });
      p.box(5.5, 5.5, 22, 5, 5, 5, { ramp: GOLD, front: (s, t) => (s > 0.2 && s < 0.8 && t > 0.2 ? C.e7 : null) });
      p.box(5, 5, 27, 6, 6, 1.5, { ramp: OBSIDIAN });
    },
    { margin: 6 },
  );
}

/** an hourglass whose sand runs upward, on a worn plinth */
function timeSand(f: number, face: Facing): ObjSprite {
  return iso(
    32,
    56,
    face,
    (p) => {
      p.box(3, 3, 0, 10, 10, 2.5, { ramp: BRASS });
      p.box(4, 4, 2.5, 8, 8, 1.2, { ramp: GOLD });
      p.box(4, 4, 20, 8, 8, 1.2, { ramp: GOLD });
      for (const [a, b] of [
        [4.5, 4.5],
        [10.5, 4.5],
        [4.5, 10.5],
        [10.5, 10.5],
      ] as const)
        p.box(a, b, 3.7, 1, 1, 16.3, { ramp: BRASS });
      // the glass bulbs
      p.cyl(8, 8, 4, 3, 7, [C.w4, C.w5, C.w6, C.mist]);
      p.cyl(8, 8, 12, 3, 7, [C.w4, C.w5, C.w6, C.mist]);
      // sand: a pile in the top bulb, a thread rising from the bottom
      p.cyl(8, 8, 15, 2.4, 3, [C.e5, C.e6, C.e7]);
      for (let z = 6; z < 15; z += 2) if ((z + f) % 4 < 2) p.dot(8, 8, z, C.e7);
      p.cyl(8, 8, 4, 2, 1, [C.e5, C.e6]);
    },
    { margin: 6 },
  );
}

/** a great clock face fallen against its rubble, its hands stopped at different hours */
function brokenClock(face: Facing): ObjSprite {
  return iso(
    48,
    56,
    face,
    (p) => {
      p.box(1, 2, 0, 14, 12, 2, { ramp: BRASS });
      p.box(3, 9, 0, 5, 4, 3, { ramp: STONEM });
      p.box(2, 7, 2, 12, 2, 14, {
        ramp: [C.mist, C.fog, C.pale, C.white],
        front: (s, t) => {
          const dx = s - 0.5,
            dy = t - 0.5;
          const r = Math.hypot(dx * 1.2, dy);
          if (r > 0.46) return C.e3;
          if (r > 0.42) return C.e5;
          const a = Math.atan2(dy, dx);
          if (Math.abs(Math.sin(a * 6)) < 0.1 && r > 0.34) return C.ink;
          if (Math.abs(a + 1.1) < 0.06 && r < 0.3) return C.ink; // hour hand
          if (Math.abs(a - 0.4) < 0.04 && r < 0.38) return C.ink; // minute hand
          if (Math.abs(dx - dy * 0.4) < 0.015 && r < 0.4) return C.q4; // the crack
          return null;
        },
      });
      p.box(11, 3, 0, 3, 3, 2, { ramp: GOLD }); // a fallen gear
    },
    { margin: 8 },
  );
}

/** a crack in the air, white at its heart, shimmering */
function chronoRift(f: number, face: Facing): ObjSprite {
  return iso(
    32,
    64,
    face,
    (p) => {
      for (let i = 0; i < 12; i++) {
        const z = 2 + i * 2.2;
        const off = Math.sin(i * 1.7 + f * 0.9) * 1.6;
        const w = 0.6 + Math.sin(i * 0.9) * 0.4 + (i > 2 && i < 9 ? 0.8 : 0);
        p.box(8 + off - w / 2, 7.6, z, w, 0.8, 2.2, { ramp: [C.q4, C.q6, C.mist, C.white] });
      }
      for (let k = 0; k < 5; k++) p.dot(6 + ((k * 3 + f) % 5), 8, 4 + ((k * 7 + f * 3) % 24), k % 2 ? C.white : C.q6);
      p.box(5, 5, 0, 6, 6, 0.3, { ramp: [C.q1, C.q2, C.q3] });
    },
    { margin: 6 },
  );
}

/** a stone pedestal with a brass dial on top */
function chronoDial(face: Facing): ObjSprite {
  return iso(
    32,
    40,
    face,
    (p) => {
      p.box(4, 4, 0, 8, 8, 8, { ramp: STONEM });
      p.box(3, 3, 8, 10, 10, 1.5, {
        ramp: BRASS,
        top: (s, t) => {
          const r = Math.hypot(s - 0.5, t - 0.5);
          if (r < 0.06) return C.e7;
          if (Math.abs(s - 0.5) < 0.04 && t < 0.5 && r < 0.4) return C.ink; // the pointer
          return r > 0.42 ? C.e3 : null;
        },
      });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        p.dot(8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 10, [C.e7, C.white, C.q5, C.night][k]!);
      }
    },
    { margin: 6 },
  );
}

/** the chrono gate: a brass arch hung with a great gear, closed on a dark that is not quite there */
function chronoGate(face: Facing): ObjSprite {
  return iso(
    56,
    80,
    face,
    (p) => {
      p.box(0, 4, 0, 16, 8, 2, { ramp: STONEM });
      p.box(0.5, 6, 2, 3, 4, 24, { ramp: BRASS });
      p.box(12.5, 6, 2, 3, 4, 24, { ramp: BRASS });
      p.box(0, 5.5, 26, 16, 5, 3, { ramp: BRASS });
      p.box(3.5, 7.6, 2, 9, 0.8, 24, {
        ramp: [C.ink, C.night, C.q1, C.q2],
        front: (s, t) => {
          const dx = (s - 0.5) * 1.2,
            dy = (t - 0.6) * 2;
          const r = Math.hypot(dx, dy);
          if (r > 0.5 && r < 0.56) return C.e5;
          if (r < 0.5 && Math.abs(Math.sin(Math.atan2(dy, dx) * 8)) < 0.12 && r > 0.38) return C.e4;
          return Math.floor((s * 7 + t * 11) * 3) % 9 === 0 ? C.q3 : null;
        },
      });
      p.dot(8, 4, 30, C.q6);
    },
    { margin: 10 },
  );
}

/** a lore tablet in the realm's own stone */
function loreTablet(realm: Realm, face: Facing): ObjSprite {
  const stone = STONE_OF[realm];
  return iso(
    32,
    44,
    face,
    (p) => {
      p.box(4, 6, 0, 8, 4, 2, { ramp: stone });
      p.box(5, 7, 2, 6, 2, 12, {
        ramp: stone,
        front: (s, t) =>
          s > 0.15 && s < 0.85 && [0.22, 0.38, 0.54, 0.7].some((r) => Math.abs(t - r) < 0.035)
            ? GLOW_OF[realm][3]!
            : null,
      });
      p.box(4.6, 6.6, 14, 6.8, 2.8, 1, { ramp: stone });
    },
    { margin: 6 },
  );
}

/** the guardian's altar: a low dais with the realm's sigil burning on it */
function altar(realm: Realm, face: Facing): ObjSprite {
  const stone = STONE_OF[realm],
    glow = GLOW_OF[realm];
  return iso(
    48,
    40,
    face,
    (p) => {
      p.box(0, 0, 0, 16, 16, 2, { ramp: stone });
      p.box(2, 2, 2, 12, 12, 2, {
        ramp: stone,
        top: (s, t) => {
          const r = Math.hypot(s - 0.5, t - 0.5);
          return (r > 0.3 && r < 0.36) ||
            (Math.abs(s - t) < 0.04 && r < 0.36) ||
            (Math.abs(s + t - 1) < 0.04 && r < 0.36)
            ? glow[4]!
            : null;
        },
      });
      p.box(7, 7, 4, 2, 2, 3, { ramp: glow });
    },
    { margin: 6 },
  );
}

export interface RealmArt {
  n: number;
  fps: number;
  draw: (face: Facing, f: number) => ObjSprite;
}
const still = (fn: (face: Facing) => ObjSprite): RealmArt => ({ n: 1, fps: 0, draw: (face) => fn(face) });

export const REALM_ART: Record<string, RealmArt> = {
  realm_portal_aetheria: { n: 4, fps: 6, draw: (face, f) => portal('aetheria', f, face) },
  realm_portal_umbra: { n: 4, fps: 6, draw: (face, f) => portal('umbra', f, face) },
  realm_portal_chronoria: { n: 4, fps: 6, draw: (face, f) => portal('chronoria', f, face) },
  realm_return_aetheria: { n: 4, fps: 6, draw: (face, f) => portal('aetheria', f, face) },
  realm_return_umbra: { n: 4, fps: 6, draw: (face, f) => portal('umbra', f, face) },
  realm_return_chronoria: { n: 4, fps: 6, draw: (face, f) => portal('chronoria', f, face) },
  updraft: { n: 6, fps: 8, draw: (face, f) => updraft(f, face) },
  wind_chime: { n: 2, fps: 2, draw: (face, f) => windChime(f, face) },
  sky_bloom: still(skyBloom),
  sky_pillar: still(skyPillar),
  umbral_cap: still(umbralCap),
  umbral_obelisk: still(umbralObelisk),
  hollow_lamp: still(hollowLamp),
  time_sand: { n: 4, fps: 4, draw: (face, f) => timeSand(f, face) },
  broken_clock: still(brokenClock),
  chrono_rift: { n: 4, fps: 6, draw: (face, f) => chronoRift(f, face) },
  chrono_dial: still(chronoDial),
  chrono_gate: still(chronoGate),
  realm_lore_aetheria: still((face) => loreTablet('aetheria', face)),
  realm_lore_umbra: still((face) => loreTablet('umbra', face)),
  realm_lore_chronoria: still((face) => loreTablet('chronoria', face)),
  realm_altar_aetheria: still((face) => altar('aetheria', face)),
  realm_altar_umbra: still((face) => altar('umbra', face)),
  realm_altar_chronoria: still((face) => altar('chronoria', face)),
};
