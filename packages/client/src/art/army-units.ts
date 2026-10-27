import { ART_RGB } from './creature-pixels';
import { ramp, rotY, type Mat, type Ramp, type V3 } from './sprite';
import type { Def } from './foes';
import type { ArmyClass } from '@eigenlands/shared';

/**
 * Soldiers of the six kingdoms as 3D-rigged sprites: infantry, ranged troops, mounted riders and elites, each in the
 * colours, helms, weapons and mounts of their realm. Realm order matches REALM_IDS (aurelion, sylvaris, khardum,
 * raijin, thalassara, nethrakar). Baked per facing and animation like every other creature.
 */
const TAU = Math.PI * 2;
type Weapon =
  | 'spear'
  | 'sword'
  | 'greatsword'
  | 'axe'
  | 'hammer'
  | 'bow'
  | 'crossbow'
  | 'staff'
  | 'club'
  | 'trident'
  | 'naginata'
  | 'katana'
  | 'sing'
  | 'lance'
  | 'gun';
type Helm = 'kettle' | 'plume' | 'hood' | 'dwarf' | 'kasa' | 'kabuto' | 'shell' | 'horned' | 'crown' | 'ogre';
type MountKind = 'horse' | 'stag' | 'ram' | 'seahorse' | 'hound';
interface Look {
  cloth: number;
  cloth2: number;
  metal: number;
  trim: number;
  skin: number;
  weapon: Weapon;
  helm: Helm;
  shield?: 'kite' | 'round' | 'tower';
  scale?: number;
  mount?: MountKind;
  banner?: boolean;
  cape?: number;
  beard?: number;
}
const A = ART_RGB;
const LOOKS: Look[][] = [
  // aurelion: blue and gold, plate and plumes
  [
    {
      cloth: A.w2,
      cloth2: A.e6,
      metal: A.mist,
      trim: A.c4,
      skin: A.e5,
      weapon: 'spear',
      helm: 'kettle',
      shield: 'kite',
    },
    { cloth: A.n2, cloth2: A.e3, metal: A.e2, trim: A.c4, skin: A.e5, weapon: 'bow', helm: 'hood' },
    {
      cloth: A.w3,
      cloth2: A.c4,
      metal: A.fog,
      trim: A.c4,
      skin: A.e5,
      weapon: 'lance',
      helm: 'plume',
      shield: 'kite',
      mount: 'horse',
    },
    {
      cloth: A.w1,
      cloth2: A.c4,
      metal: A.pale,
      trim: A.c4,
      skin: A.e5,
      weapon: 'greatsword',
      helm: 'plume',
      banner: true,
      cape: A.w2,
    },
  ],
  // sylvaris: bark, moss and leaf
  [
    { cloth: A.e2, cloth2: A.n2, metal: A.e3, trim: A.n5, skin: A.e6, weapon: 'spear', helm: 'hood', shield: 'round' },
    { cloth: A.n1, cloth2: A.n4, metal: A.e3, trim: A.n5, skin: A.e6, weapon: 'bow', helm: 'hood' },
    { cloth: A.n2, cloth2: A.pale, metal: A.e3, trim: A.n5, skin: A.e6, weapon: 'lance', helm: 'hood', mount: 'stag' },
    { cloth: A.n0, cloth2: A.n4, metal: A.e3, trim: A.n5, skin: A.e6, weapon: 'staff', helm: 'crown', cape: A.n1 },
  ],
  // khardum: soot-black iron, forge-orange, dwarven stockiness
  [
    {
      cloth: A.slate,
      cloth2: A.c1,
      metal: A.steel,
      trim: A.c3,
      skin: A.e4,
      weapon: 'axe',
      helm: 'dwarf',
      shield: 'tower',
      scale: 0.86,
      beard: A.e2,
    },
    {
      cloth: A.night,
      cloth2: A.c1,
      metal: A.steel,
      trim: A.c3,
      skin: A.e4,
      weapon: 'crossbow',
      helm: 'dwarf',
      scale: 0.86,
      beard: A.e3,
    },
    {
      cloth: A.slate,
      cloth2: A.c1,
      metal: A.mist,
      trim: A.c3,
      skin: A.e4,
      weapon: 'axe',
      helm: 'dwarf',
      mount: 'ram',
      scale: 0.86,
      beard: A.e1,
    },
    {
      cloth: A.night,
      cloth2: A.c3,
      metal: A.mist,
      trim: A.c4,
      skin: A.e4,
      weapon: 'hammer',
      helm: 'dwarf',
      scale: 0.9,
      beard: A.pale,
      banner: true,
    },
  ],
  // raijin: lacquered red, black and gold
  [
    { cloth: A.c1, cloth2: A.night, metal: A.slate, trim: A.c4, skin: A.e5, weapon: 'naginata', helm: 'kasa' },
    { cloth: A.slate, cloth2: A.c1, metal: A.night, trim: A.c4, skin: A.e5, weapon: 'bow', helm: 'kasa' },
    {
      cloth: A.c1,
      cloth2: A.night,
      metal: A.slate,
      trim: A.c4,
      skin: A.e5,
      weapon: 'bow',
      helm: 'kabuto',
      mount: 'horse',
    },
    {
      cloth: A.c2,
      cloth2: A.night,
      metal: A.night,
      trim: A.c4,
      skin: A.e5,
      weapon: 'katana',
      helm: 'kabuto',
      banner: true,
      cape: A.c0,
    },
  ],
  // thalassara: coral, pearl, sea-green
  [
    { cloth: A.t1, cloth2: A.pale, metal: A.t2, trim: A.c2, skin: A.t2, weapon: 'trident', helm: 'shell' },
    { cloth: A.t0, cloth2: A.q6, metal: A.t2, trim: A.pale, skin: A.t2, weapon: 'sing', helm: 'shell' },
    {
      cloth: A.t1,
      cloth2: A.c2,
      metal: A.pale,
      trim: A.c4,
      skin: A.t2,
      weapon: 'trident',
      helm: 'shell',
      mount: 'seahorse',
    },
    {
      cloth: A.w2,
      cloth2: A.pale,
      metal: A.pale,
      trim: A.c4,
      skin: A.e5,
      weapon: 'sword',
      helm: 'shell',
      shield: 'round',
      cape: A.t0,
    },
  ],
  // nethrakar: obsidian, crimson and ember
  [
    {
      cloth: A.c0,
      cloth2: A.night,
      metal: A.night,
      trim: A.c3,
      skin: A.n1,
      weapon: 'club',
      helm: 'ogre',
      scale: 1.3,
      shield: 'tower',
    },
    { cloth: A.ink, cloth2: A.c1, metal: A.night, trim: A.c4, skin: A.c1, weapon: 'gun', helm: 'horned' },
    {
      cloth: A.ink,
      cloth2: A.c1,
      metal: A.night,
      trim: A.c3,
      skin: A.c1,
      weapon: 'lance',
      helm: 'horned',
      mount: 'hound',
    },
    {
      cloth: A.night,
      cloth2: A.c2,
      metal: A.ink,
      trim: A.c4,
      skin: A.c1,
      weapon: 'greatsword',
      helm: 'horned',
      banner: true,
      cape: A.c0,
    },
  ],
  // ───── the realms' hostile peoples (realmfolk.ts): order matches RACE_FOES (gale, gloam, sundered)
  // Gale Reavers: sky pirates in storm-blue and brass, feathered hoods, cutlasses and hand-cannons
  [
    { cloth: A.w2, cloth2: A.e6, metal: A.steel, trim: A.e7, skin: A.e4, weapon: 'sword', helm: 'hood', cape: A.w3 },
    { cloth: A.w1, cloth2: A.e5, metal: A.slate, trim: A.e7, skin: A.e5, weapon: 'gun', helm: 'kasa' },
    { cloth: A.w2, cloth2: A.e6, metal: A.steel, trim: A.e7, skin: A.e4, weapon: 'sword', helm: 'hood' },
    {
      cloth: A.w1,
      cloth2: A.c4,
      metal: A.mist,
      trim: A.e7,
      skin: A.e4,
      weapon: 'greatsword',
      helm: 'plume',
      cape: A.w3,
      banner: true,
      scale: 1.2,
    },
  ],
  // Gloamkin: hooded cultists of the Maw in black and violet, pale-skinned, carrying clubs and staves
  [
    { cloth: A.q1, cloth2: A.night, metal: A.slate, trim: A.q6, skin: A.fog, weapon: 'club', helm: 'hood' },
    { cloth: A.night, cloth2: A.q2, metal: A.slate, trim: A.q6, skin: A.fog, weapon: 'staff', helm: 'hood' },
    { cloth: A.q1, cloth2: A.night, metal: A.slate, trim: A.q6, skin: A.fog, weapon: 'club', helm: 'hood' },
    {
      cloth: A.night,
      cloth2: A.q3,
      metal: A.q2,
      trim: A.q6,
      skin: A.mist,
      weapon: 'staff',
      helm: 'crown',
      cape: A.q2,
      scale: 1.25,
    },
  ],
  // the Sundered: time-torn raiders in tarnished brass, horned and kabuto helms, greatswords and staves
  [
    { cloth: A.e2, cloth2: A.e6, metal: A.e5, trim: A.q5, skin: A.mist, weapon: 'greatsword', helm: 'kabuto' },
    { cloth: A.e1, cloth2: A.q3, metal: A.e4, trim: A.q5, skin: A.mist, weapon: 'staff', helm: 'hood' },
    { cloth: A.e2, cloth2: A.e6, metal: A.e5, trim: A.q5, skin: A.mist, weapon: 'greatsword', helm: 'kabuto' },
    {
      cloth: A.e1,
      cloth2: A.e7,
      metal: A.e6,
      trim: A.q5,
      skin: A.pale,
      weapon: 'greatsword',
      helm: 'horned',
      cape: A.q3,
      banner: true,
      scale: 1.3,
    },
  ],
];
const CLS: ArmyClass[] = ['infantry', 'ranged', 'cavalry', 'elite'];

export function armyUnitDef(realmIndex: number, cls: ArmyClass): Def {
  const L = LOOKS[realmIndex]![CLS.indexOf(cls)]!;
  const mounted = !!L.mount;
  const big = (L.scale ?? 1) > 1.1;
  return {
    w: mounted ? 128 : 96,
    h: mounted ? 124 : 112,
    ay: mounted ? 104 : 94,
    shadow: mounted ? [17, 6.5] : [big ? 11 : 8.5, big ? 4.5 : 3.8],
    n: { idle: 4, move: 6, windup: 4, attack: 3, hurt: 2, death: 5 },
    draw(s, a, k, t) {
      const moving = a === 'move',
        wind = a === 'windup',
        dead = a === 'death',
        hit = a === 'attack',
        hurt = a === 'hurt';
      const sw = Math.sin(t * TAU);
      const R = (c: number, n = 4, hue = 9) => M(ramp(c, n, 2, { hue }));
      const cloth = R(L.cloth),
        cloth2 = R(L.cloth2),
        metal = M(ramp(L.metal, 4, 2, { hue: 6 }), { shiny: true }),
        trim = M(ramp(L.trim, 3, 1), { shiny: true }),
        skin = R(L.skin, 3, 6),
        leather = R(A.e1, 3),
        dark = R(A.night, 3);
      const glow = (c: number) => M(ramp(c, 3, 2), { glow: true });
      const U = 1.6 * (L.scale ?? 1);
      const fall = dead ? Math.min(1, t * 1.6) : 0;
      s.push(rotY(-fall * 1.45), [0, 0, 2], [0, 0, 0]);
      s.push([U, 0, 0, 0, U, 0, 0, 0, U], [0, 0, 0], [hit ? (1 - t) * 1.6 : 0, 0, dead ? -t * 2 : 0]);
      const seatZ = mounted ? 9 : 0;
      // ───────── mount
      if (mounted) {
        const mk = L.mount!;
        const body =
          mk === 'stag'
            ? R(A.pale, 4, 6)
            : mk === 'hound'
              ? R(A.c0, 4)
              : mk === 'ram'
                ? R(A.e2, 4)
                : mk === 'seahorse'
                  ? R(A.t1, 4, 10)
                  : R(A.e3, 4);
        const bar = mk === 'horse' || mk === 'ram' ? cloth : cloth2;
        const gait = moving ? sw : hit ? 0.6 : 0;
        const bz = 9 + (moving ? 0.9 * Math.abs(sw) : 0.3 * Math.sin(t * TAU));
        if (mk === 'seahorse') {
          // a giant seahorse: upright coiled body, curled tail, fanned fins
          for (let i = 0; i < 6; i++)
            s.sph(
              [-4 + Math.sin(i * 0.8 + t * TAU) * 0.6 - i * 0.5, 0, 3 + i * 2.2],
              3.4 - i * 0.18,
              i % 2 ? body : bar,
            );
          s.ell([2.4, 0, 14], [3, 2.4, 3.2], body);
          s.cap([4, 0, 15], [8, 0, 14.4], 1.4, 0.8, body);
          for (const side of [-1, 1]) s.cap([-3, side * 2, 5 + i3(sw)], [-5, side * 6, 8], 2.2, 0.3, glow(A.t2));
          for (let i = 0; i < 4; i++) s.sph([-8 + Math.cos(i) * 2, 0, 1 + i * 0.9], 1.6 - i * 0.25, bar);
          s.cap([-1, 0, 17], [-3, 0, 20], 0.6, 0.15, glow(A.c2));
        } else {
          s.ell([0, 0, bz], [mk === 'ram' ? 6.6 : 8, 3.2, 3.8], body);
          s.ell([-5, 0, bz + 0.4], [3.6, 3.2, 3.6], body);
          s.ell([4.6, 0, bz + 0.8], [3.2, 3.2, 3.8], body);
          // barding over the flank
          s.ell([0.4, 0, bz + 1.4], [5.8, 3.4, 2.4], bar);
          s.cap([-8.6, 0, bz + 1], [-12, 0, bz - 3 + sw * 1.4], 0.9, 0.3, mk === 'hound' ? glow(A.c3) : dark);
          // neck and head
          const hx = mk === 'ram' ? 8.2 : 9.4;
          s.cap([5.8, 0, bz + 2], [hx, 0, bz + 6.4], 2.1, 1.5, body);
          s.ell([hx + 1.6, 0, bz + 6.8], [mk === 'hound' ? 3.2 : 2.8, 1.8, 1.6], body);
          s.sph([hx + 3.6, 0, bz + 6.2], 0.9, dark);
          for (const side of [-1, 1]) {
            s.sph(
              [hx + 2.6, side * 1.3, bz + 7.6],
              0.45,
              mk === 'hound' ? glow(A.c4) : M(ramp(A.e7, 2, 1), { glow: true }),
            );
            if (mk === 'ram')
              s.cap([hx, side * 1.4, bz + 8], [hx - 2, side * 3.4, bz + 6], 0.8, 0.3, M(ramp(A.e5, 3, 1)));
            if (mk === 'stag')
              (s.cap([hx, side * 1, bz + 8], [hx - 1, side * 4, bz + 14], 0.4, 0.2, glow(A.n5)),
                s.cap([hx - 1, side * 4, bz + 14], [hx + 1, side * 6, bz + 16], 0.3, 0.12, glow(A.n5)));
            if (mk === 'hound') s.cap([hx, side * 1.2, bz + 8], [hx - 2, side * 2, bz + 11], 0.5, 0.1, glow(A.c3));
          }
          for (const side of [-1, 1])
            for (const [x, ph] of [
              [4.2, 0],
              [-5, 0.5],
            ] as const) {
              const st = moving ? Math.sin(t * TAU + (ph + (side > 0 ? 0.5 : 0)) * TAU) * 3 : 0;
              const lift = moving ? Math.max(0, Math.cos(t * TAU + (ph + (side > 0 ? 0.5 : 0)) * TAU)) * 1.4 : 0;
              s.cap([x, side * 2.4, bz - 1], [x + st, side * 2.8, 0.9 + lift], 1.1, 0.6, body);
              s.ell([x + st + 0.5, side * 2.8, 0.7 + lift], [1.2, 0.9, 0.6], dark);
            }
          if (gait > 0.9) s.sph([-13, 0, bz - 2], 0.6, M(ramp(A.pale, 2, 1)));
        }
      }
      // ───────── legs
      const hipZ = seatZ + 7;
      for (const side of [-1, 1]) {
        if (mounted) {
          s.cap([0, side * 1.7, hipZ], [2.6, side * 3.4, hipZ - 3], 1.3, 1, cloth);
          s.cap([2.6, side * 3.4, hipZ - 3], [1.6, side * 3.6, hipZ - 7], 1.1, 0.9, leather);
        } else {
          const swing = moving ? Math.sin(t * TAU + (side > 0 ? Math.PI : 0)) * 3.2 : 0;
          const lift = moving ? Math.max(0, Math.cos(t * TAU + (side > 0 ? Math.PI : 0))) * 1.2 : 0;
          s.cap([0, side * 1.6, hipZ], [swing, side * 1.9, 3.6 + lift], 1.4, 1.1, cloth);
          s.cap([swing, side * 1.9, 3.6 + lift], [swing * 1.2, side * 2, 0.8 + lift], 1.1, 1, leather);
          s.ell([swing * 1.2 + 0.7, side * 2, 0.7 + lift], [1.6, 1.1, 0.7], dark);
        }
      }
      const bob = moving && !mounted ? 0.5 * Math.abs(sw) : 0;
      const tz = hipZ + 3.6 + bob;
      // ───────── cape and banner
      if (L.cape) {
        const c = R(L.cape);
        s.ell([-2.4, 0, tz + 1], [0.8, 3.4, 5], c);
        s.cap([-2.6, 0, tz + 4], [-3.4 - (moving ? 1 : 0), 0, tz - 6], 2.4, 3, c);
      }
      if (L.banner) {
        s.cap([-3, 0, tz - 2], [-3.4, 0, tz + 16], 0.28, 0.28, leather);
        s.ell([-3.4, 0.2 + Math.sin(t * TAU) * 0.5, tz + 13], [0.3, 3, 3], cloth2);
        s.sph([-3.4, 0, tz + 16.6], 0.6, trim);
      }
      // ───────── torso: tabard over armour, belt, shoulders
      s.ell([0, 0, tz], [2.5, 3.2, 4.4], cloth);
      s.ell([0.5, 0, tz + 0.4], [2.3, 2.6, 3.2], cloth2);
      s.ell([0, 0, tz - 3.6], [2.6, 3.2, 0.8], leather);
      s.sph([0.7, 0, tz - 3.6], 0.6, trim);
      for (const side of [-1, 1]) s.sph([0, side * 3.5, tz + 3.2], 1.5, metal);
      if (cls === 'elite' || cls === 'infantry') s.ell([1, 0, tz + 1.4], [1.6, 2.2, 2.4], metal);
      // ───────── head and helm
      const hz = tz + 6.6;
      s.cap([0, 0, tz + 3.8], [0, 0, hz - 1.4], 0.9, 0.9, skin);
      s.sph([0.4, 0, hz], 2.5, skin);
      for (const side of [-1, 1])
        s.sph([2.6, side * 1.1, hz + 0.4], 0.38, hurt || dead ? dark : M(ramp(A.night, 2, 1)));
      if (L.beard) s.ell([2.2, 0, hz - 1.8], [1.6, 2, 2.4], R(L.beard, 3));
      drawHelm(s, L.helm, hz, { metal, trim, cloth, cloth2, dark, glow, skin });
      // ───────── weapon arms
      const rest: V3 = [2.4, 4.3, tz - 1.2];
      const power = wind ? 1 : hit ? 2 : 0;
      for (const side of [-1, 1]) {
        const sh: V3 = [0, side * 3.6, tz + 2.8];
        let hand: V3 = [2.2 + (moving ? -side * sw * 1.4 : 0), side * 4.1, tz - 1.4];
        if (side > 0) {
          if (L.weapon === 'bow' || L.weapon === 'gun' || L.weapon === 'crossbow' || L.weapon === 'sing') {
            hand = wind ? [5, 3.2, tz + 2.4] : hit ? [4.6, 2.8, tz + 2] : [4.2, 3.2, tz + 0.4];
          } else {
            hand = power === 1 ? [-1, 3.8, tz + 7] : power === 2 ? [6.2, 3.4, tz + 1.4] : rest;
          }
        } else if (L.shield) hand = [3.6, -4.6, tz - 0.6];
        else if (L.weapon === 'bow' || L.weapon === 'crossbow' || L.weapon === 'gun') hand = [5.4, 1.2, tz + 1.4];
        else if (L.weapon === 'sing') hand = wind || hit ? [3, -3.6, tz + 7] : [2.4, -4.2, tz + 2];
        else if (L.weapon === 'greatsword' || L.weapon === 'hammer' || L.weapon === 'staff')
          hand = [2.6, side * 2.4, tz + 0.6];
        const elbow = lerp(sh, hand, 0.5, [-0.6, side * 0.8, -1.4]);
        s.cap(sh, elbow, 1.2, 1, cloth);
        s.cap(elbow, hand, 1, 0.85, metal);
        s.sph(hand, 0.95, skin);
        if (side > 0)
          drawWeapon(s, L.weapon, hand, power, t, { metal, trim, leather, glow, cloth2, dark, wood: R(A.e2, 3) });
      }
      if (L.shield) {
        const sp: V3 = [3.4, -5, tz - 0.4];
        const sc = L.shield === 'tower' ? [0.9, 2.8, 5] : L.shield === 'kite' ? [0.8, 2.4, 4.4] : [0.8, 3, 3];
        s.ell(sp, sc as V3, cloth2);
        s.ell([sp[0] + 0.6, sp[1], sp[2]], [0.4, sc[1]! - 0.5, sc[2]! - 0.5], metal);
        s.sph([sp[0] + 1, sp[1], sp[2]], 0.9, trim);
      }
      if (L.weapon === 'sing' && (wind || hit))
        for (let i = 0; i < 4; i++) {
          const ph = (t + i / 4) % 1;
          s.sph([4 + ph * 5, Math.sin(ph * TAU * 2 + i) * 2, tz + 6 + ph * 5], 0.5, glow(A.t2));
        }
      s.pop();
      s.pop();
    },
  };
}

const M = (r: Ramp, o: Partial<Mat> = {}): Mat => ({ r, ...o });
const i3 = (v: number) => v * 1.2;
const lerp = (a: V3, b: V3, t: number, bend: V3): V3 => [
  a[0] + (b[0] - a[0]) * t + bend[0],
  a[1] + (b[1] - a[1]) * t + bend[1],
  a[2] + (b[2] - a[2]) * t + bend[2],
];

interface Mats {
  metal: Mat;
  trim: Mat;
  cloth: Mat;
  cloth2: Mat;
  dark: Mat;
  glow: (c: number) => Mat;
  skin: Mat;
}
type SceneLike = {
  ell(c: V3, r: V3, m: Mat): void;
  sph(c: V3, r: number, m: Mat): void;
  cap(a: V3, b: V3, ra: number, rb: number, m: Mat): void;
};
function drawHelm(s: SceneLike, h: Helm, z: number, m: Mats): void {
  const sp = (x: number, y: number, zz: number, r: number, mat: Mat) => s.sph([x, y, zz], r, mat);
  switch (h) {
    case 'kettle':
      s.ell([0.2, 0, z + 1.2], [2.9, 2.9, 1.8], m.metal);
      s.ell([0.2, 0, z + 0.2], [3.5, 3.5, 0.4], m.metal);
      break;
    case 'plume':
      s.ell([0.2, 0, z + 0.9], [2.9, 2.9, 2.5], m.metal);
      s.ell([1.8, 0, z + 0.4], [1.2, 2.3, 0.7], m.dark);
      s.cap([-0.4, 0, z + 3], [-2.6, 0, z + 5.2], 0.9, 0.3, m.trim);
      s.ell([-2.6, 0, z + 5], [0.7, 0.9, 1.2], m.cloth2);
      break;
    case 'hood':
      s.ell([-0.3, 0, z + 0.5], [3, 3, 3], m.cloth);
      s.ell([1.6, 0, z - 0.2], [1.2, 2, 1.4], m.dark);
      s.cap([0, 0, z + 2.6], [-2.4, 0, z + 1], 0.5, 0.2, m.cloth2);
      break;
    case 'dwarf':
      s.ell([0.2, 0, z + 1.2], [3, 3, 2], m.metal);
      s.cap([2.2, 0, z + 2], [2.6, 0, z - 1.6], 0.35, 0.35, m.metal);
      for (const side of [-1, 1]) s.cap([0, side * 2.8, z + 1.6], [-0.6, side * 4.2, z + 4], 0.5, 0.2, m.trim);
      break;
    case 'kasa':
      s.ell([0, 0, z + 1.6], [4.6, 4.6, 0.8], m.cloth);
      s.ell([0, 0, z + 2.4], [2.6, 2.6, 1.4], m.cloth);
      sp(0, 0, z + 3.6, 0.5, m.trim);
      break;
    case 'kabuto':
      s.ell([0.2, 0, z + 1], [3, 3, 2.3], m.dark);
      s.ell([0.2, 0, z + 0.2], [3.7, 3.7, 0.5], m.metal);
      for (const side of [-1, 1]) s.cap([1.4, side * 1, z + 2.8], [0.6, side * 3.4, z + 6], 0.4, 0.15, m.trim);
      sp(2.4, 0, z + 1.8, 0.5, m.trim);
      break;
    case 'shell':
      s.ell([-0.3, 0, z + 0.9], [3, 3, 2.4], m.cloth2);
      for (const side of [-1, 1]) {
        s.cap([0, side * 2.2, z + 0.4], [-0.6, side * 4.8, z + 1.8], 0.8, 0.15, m.glow(A.t2));
      }
      s.cap([0, 0, z + 2.4], [-1, 0, z + 4.6], 0.5, 0.15, m.glow(A.c2));
      break;
    case 'horned':
      s.ell([0.2, 0, z + 0.8], [2.9, 2.9, 2.2], m.dark);
      for (const side of [-1, 1]) {
        s.cap([0.6, side * 1.8, z + 2], [-0.2, side * 3.4, z + 4.6], 0.7, 0.2, m.trim);
        s.cap([-0.2, side * 3.4, z + 4.6], [1.4, side * 3, z + 7], 0.35, 0.1, m.trim);
        s.sph([2.4, side * 1, z + 0.4], 0.4, m.glow(A.c4));
      }
      break;
    case 'crown':
      s.ell([0, 0, z + 0.6], [2.7, 2.7, 1.8], m.cloth);
      for (const side of [-1, 1]) {
        s.cap([0, side * 1.2, z + 2], [-0.6, side * 2.6, z + 6], 0.3, 0.12, m.glow(A.n5));
        s.cap([-0.6, side * 2.6, z + 6], [0.4, side * 3.6, z + 7.8], 0.2, 0.1, m.glow(A.n5));
      }
      sp(0.2, 0, z + 2.2, 0.6, m.glow(A.c2));
      break;
    case 'ogre':
      s.ell([0.2, 0, z + 1], [2.9, 2.9, 1.6], m.dark);
      for (const side of [-1, 1])
        s.cap([2, side * 1.1, z - 1.4], [3, side * 1.3, z + 0.8], 0.4, 0.15, M(ramp(A.pale, 2, 1)));
      break;
  }
}

function drawWeapon(
  s: SceneLike,
  w: Weapon,
  hand: V3,
  power: number,
  t: number,
  m: { metal: Mat; trim: Mat; leather: Mat; glow: (c: number) => Mat; cloth2: Mat; dark: Mat; wood: Mat },
): void {
  const [hx, hy, hz] = hand;
  // blade angle in the x-z plane: 0 = straight up, positive tips forward
  const ang = power === 1 ? -1.0 : power === 2 ? 1.5 - t * 0.6 : 0.35;
  const tip = (len: number, a = ang): V3 => [hx + Math.sin(a) * len, hy, hz + Math.cos(a) * len];
  const back = (len: number, a = ang): V3 => [hx - Math.sin(a) * len, hy, hz - Math.cos(a) * len];
  switch (w) {
    case 'sword':
    case 'katana':
      s.cap(back(1.2), tip(w === 'katana' ? 8.5 : 7.5), 0.35, 0.2, m.metal);
      s.cap(tip(0), [hx + 0.2, hy + 1.5, hz], 0.2, 0.2, m.trim);
      s.cap([hx, hy - 1.5, hz], [hx, hy + 1.5, hz], 0.25, 0.25, m.trim);
      break;
    case 'greatsword':
    case 'hammer': {
      const e = tip(w === 'hammer' ? 6 : 10);
      s.cap(back(2), e, 0.5, w === 'hammer' ? 0.5 : 0.28, w === 'hammer' ? m.wood : m.metal);
      if (w === 'hammer') s.ell(e, [1.8, 2.4, 1.6], m.metal);
      else s.cap([hx, hy - 2, hz], [hx, hy + 2, hz], 0.35, 0.35, m.trim);
      if (w === 'greatsword' && (power > 0 || t > 0.5)) s.cap(tip(2), tip(9.5), 0.2, 0.2, m.glow(A.c4));
      break;
    }
    case 'axe': {
      const e = tip(6);
      s.cap(back(1.5), e, 0.45, 0.45, m.wood);
      s.ell([e[0] + 0.4, e[1], e[2] - 0.6], [0.6, 1.9, 1.9], m.metal);
      break;
    }
    case 'spear':
    case 'lance':
    case 'naginata':
    case 'trident': {
      const a = power === 1 ? -0.5 : power === 2 ? 1.3 : 1.15;
      const len = w === 'lance' ? 13 : 10;
      const tp: V3 = [hx + Math.sin(a) * len, hy, hz + Math.cos(a) * len];
      const bk: V3 = [hx - Math.sin(a) * 4, hy, hz - Math.cos(a) * 4];
      s.cap(bk, tp, 0.32, 0.32, m.wood);
      if (w === 'trident') {
        for (const d of [-1, 0, 1])
          s.cap(tp, [tp[0] + Math.sin(a) * 3, tp[1] + d * 1.3, tp[2] + Math.cos(a) * 3], 0.25, 0.1, m.metal);
        s.cap([tp[0], tp[1] - 1.3, tp[2]], [tp[0], tp[1] + 1.3, tp[2]], 0.22, 0.22, m.metal);
      } else if (w === 'naginata')
        s.cap(tp, [tp[0] + Math.sin(a - 0.4) * 4, tp[1], tp[2] + Math.cos(a - 0.4) * 4], 0.55, 0.12, m.metal);
      else s.cap(tp, [tp[0] + Math.sin(a) * 2.6, tp[1], tp[2] + Math.cos(a) * 2.6], 0.5, 0.08, m.metal);
      if (w === 'lance') s.ell([tp[0] - Math.sin(a) * 3, tp[1], tp[2] - Math.cos(a) * 3], [0.2, 1.4, 1.2], m.cloth2);
      break;
    }
    case 'staff': {
      const e = tip(9, 0.15);
      s.cap(back(3, 0.15), e, 0.35, 0.35, m.wood);
      s.sph([e[0], e[1], e[2] + 0.8], 1.1 + (power ? 0.5 : 0), m.glow(A.n5));
      break;
    }
    case 'club': {
      const e = tip(6);
      s.cap(back(1.5), e, 0.6, 0.9, m.wood);
      s.sph([e[0], e[1], e[2] + 0.6], 1.7, m.wood);
      for (let i = 0; i < 4; i++)
        s.sph([e[0] + Math.cos(i * 1.6) * 1.3, e[1] + Math.sin(i * 1.6) * 1.3, e[2] + 0.6], 0.3, m.metal);
      break;
    }
    case 'bow': {
      const draw = power === 1 ? 1 : 0;
      const top: V3 = [hx + 1.2, hy, hz + 5.6],
        bot: V3 = [hx + 1.2, hy, hz - 5.6],
        mid: V3 = [hx + 2.6, hy, hz];
      s.cap(top, mid, 0.3, 0.4, m.wood);
      s.cap(mid, bot, 0.4, 0.3, m.wood);
      s.cap(top, [hx + 1.2 - draw * 3.4, hy, hz], 0.1, 0.1, m.trim);
      s.cap([hx + 1.2 - draw * 3.4, hy, hz], bot, 0.1, 0.1, m.trim);
      if (power !== 2) s.cap([hx + 1.2 - draw * 3.4, hy, hz], [hx + 4, hy, hz], 0.12, 0.12, m.metal);
      break;
    }
    case 'crossbow':
    case 'gun': {
      s.cap([hx - 1.5, hy, hz], [hx + 4.4, hy, hz + 0.4], 0.5, 0.35, m.wood);
      s.cap([hx + 3.6, hy - 3, hz + 0.4], [hx + 3.6, hy + 3, hz + 0.4], 0.28, 0.28, m.metal);
      if (w === 'gun' && (power === 2 || power === 1)) s.sph([hx + 5, hy, hz + 0.5], 0.9 + t * 0.4, m.glow(A.c4));
      break;
    }
    case 'sing':
      break;
  }
}
