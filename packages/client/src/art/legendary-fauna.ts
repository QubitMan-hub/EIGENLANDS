/** Original articulated creatures, authored in model space and baked to four isometric facings. */
import { BESTIARY_KEYS, CREATURE_BLUEPRINTS, type BestiaryKey } from '@eigenlands/shared';
import { ART_RGB as P } from './creature-pixels';
import { ramp, rotX, type Mat, type Scene, type V3 } from './sprite';
import type { Anim, Def } from './foes';
export const NEW_CREATURE_KEYS = BESTIARY_KEYS.filter((k) => !['cow', 'sheep', 'pig', 'horse'].includes(k));
export type NewCreatureKey = Exclude<BestiaryKey, 'cow' | 'sheep' | 'pig' | 'horse'>;
export const CREATURE_FRAMES: Record<Anim, number> = { idle: 3, move: 6, windup: 3, attack: 4, hurt: 2, death: 5 };
export function legendaryDef(id: NewCreatureKey): Def {
  const ancient = CREATURE_BLUEPRINTS[id].category === 'ancient';
  const large = ancient || ['dragon', 'hydra', 'manticore'].includes(id);
  const w = ancient ? 192 : large ? 132 : 96,
    h = ancient ? 184 : large ? 124 : 104,
    ay = h - 34;
  return {
    w,
    h,
    ay,
    shadow: ancient ? [24, 8] : large ? [16, 5.5] : [10, 3.5],
    n: CREATURE_FRAMES,
    draw(s, anim, _k, t, night) {
      const walk = anim === 'move',
        wind = anim === 'windup',
        attack = anim === 'attack',
        dead = anim === 'death',
        hurt = anim === 'hurt';
      const wave = Math.sin(t * Math.PI * 2),
        stride = walk ? wave : 0;
      const scale = ancient ? 3 : large ? 2.1 : 1.8;
      s.push([scale, 0, 0, 0, scale, 0, 0, 0, scale], [0, 0, 0], [attack ? (1 - t) * 2 : 0, 0, dead ? -t * 11 : 0]);
      const m = (c: number, glow = false): Mat => ({
        r: ramp(c, 3, 2, { hue: 8 }),
        bias: glow ? 0 : night ? -0.35 : 0,
        glow,
        shiny: glow,
      });
      const dark = m(P.night),
        bone = m(P.pale),
        gold = m(P.e5),
        eye = m(P.e7, true),
        steel = m(P.steel),
        leaf = m(P.g3),
        voidM = m(P.q3),
        cloth = m(P.r2);
      const pose = wind ? 1.5 : attack ? Math.sin(t * Math.PI) * 2 : 0;
      const legs = (body: Mat, front = 4, back = -4, z = 9, width = 3) => {
        for (const side of [-1, 1])
          for (const x of [front, back]) {
            const phase = (x === front ? 0 : Math.PI) + (side > 0 ? Math.PI : 0),
              step = walk ? Math.sin(t * Math.PI * 2 + phase) * 2 : 0,
              lift = walk ? Math.max(0, Math.cos(t * Math.PI * 2 + phase)) * 1.2 : 0;
            s.cap([x, side * width, z], [x + step, side * (width + 0.3), 1 + lift], 1.3, 0.7, body);
            s.ell([x + step + 0.5, side * (width + 0.3), 0.8 + lift], [1.3, 0.9, 0.8], dark);
          }
      };
      const eyes = (x: number, y: number, z: number, r = 0.5) => {
        for (const side of [-1, 1]) s.sph([x, side * y, z], r, eye);
      };
      const head = (x: number, y: number, z: number, body: Mat, size = 1) => {
        s.ell([x, y, z], [2.8 * size, 2 * size, 2.3 * size], body);
        s.cap([x + 1, y, z - 0.7], [x + 4 * size, y, z - 1], 1.5 * size, 0.9 * size, body);
        for (const side of [-1, 1]) s.sph([x + 1.8 * size, y + side * 1.5 * size, z + 0.6 * size], 0.45 * size, eye);
      };
      const wings = (body: Mat, plume: Mat, z: number, spread: number, feathers = 6) => {
        const flap = walk ? wave * 2 : wind ? 3 : attack ? 2 : 0;
        for (const side of [-1, 1]) {
          s.cap([0, side * 2, z], [0, side * spread, z + 2 + flap], 1.6, 0.7, body);
          for (let i = 0; i < feathers; i++)
            s.cap(
              [1 - i * 0.65, side * spread * 0.55, z + 1 + flap * 0.5],
              [-3 - i * 0.9, side * (spread + 2 - i * 0.25), z - 2 + flap],
              1.05,
              0.2,
              i % 2 ? body : plume,
            );
        }
      };
      const tail = (body: Mat, z = 7, length = 12, curve = 0) => {
        let from: V3 = [-5, 0, z];
        for (let i = 1; i <= 5; i++) {
          const to: V3 = [-5 - (i * length) / 5, Math.sin(i * 0.6 + stride * 0.2) * curve, z - i * 0.6];
          s.cap(from, to, Math.max(0.4, 1.8 - i * 0.25), Math.max(0.2, 1.5 - i * 0.25), body);
          from = to;
        }
      };
      if (['bandit', 'raider', 'goblin', 'troll', 'undead', 'orc', 'rogue_mage'].includes(id)) {
        const goblin = id === 'goblin',
          troll = id === 'troll',
          orc = id === 'orc',
          skeleton = id === 'undead',
          mage = id === 'rogue_mage';
        const bulk = troll ? 1.7 : orc ? 1.25 : goblin ? 0.78 : 1,
          skin = m(troll ? P.g2 : orc ? P.g3 : goblin ? P.g4 : skeleton ? P.pale : P.e4);
        const torso = m(mage ? P.q2 : id === 'raider' ? P.r3 : id === 'bandit' ? P.e2 : P.slate);
        const z = goblin ? 7 : 9;
        for (const side of [-1, 1]) {
          const step = walk ? Math.sin(t * Math.PI * 2 + (side > 0 ? 0 : Math.PI)) * 1.8 : 0;
          s.cap(
            [0, side * 1.8 * bulk, z],
            [step, side * 2 * bulk, 1],
            skeleton ? 0.65 : 1.3 * bulk,
            skeleton ? 0.5 : 0.9 * bulk,
            skeleton ? bone : dark,
          );
          s.ell([step + 0.7, side * 2 * bulk, 0.7], [1.6, 0.9, 0.8], dark);
        }
        if (skeleton) {
          s.cap([0, 0, z], [0, 0, z + 9], 0.55, 0.5, bone);
          s.cap([0, -2.5, z], [0, 2.5, z], 0.8, 0.8, bone);
        } else s.ell([0, 0, z + 4 * bulk], [2.8 * bulk, 3.1 * bulk, 5 * bulk], torso);
        if (skeleton)
          for (let i = 0; i < 4; i++) {
            for (const side of [-1, 1])
              s.cap([0, 0, z + 1 + i * 1.6], [2.2, side * 2.4, z + 0.5 + i * 1.6], 0.35, 0.3, bone);
          }
        s.ell([0.2, 0, z + 10 * bulk], [2.5 * bulk, 2.25 * bulk, 2.8 * bulk], skin);
        s.cap([1.8, 0, z + 9.5 * bulk], [3.1 * bulk, 0, z + 9.5 * bulk], 0.7, 0.55, skin);
        if (goblin || orc)
          for (const side of [-1, 1])
            s.cap([0, side * 1.8, z + 10 * bulk], [-0.8, side * 4 * bulk, z + 11 * bulk], 1, 0.1, skin);
        if (skeleton) for (const side of [-1, 1]) s.sph([2, side * 1.4, z + 11 * bulk], 0.8, dark);
        else eyes(2.1 * bulk, 1.5 * bulk, z + 10.6 * bulk, 0.45);
        if (orc || id === 'raider') s.ell([-0.1, 0, z + 12 * bulk], [2.7 * bulk, 2.4 * bulk, 1.5 * bulk], steel);
        if (orc) for (const side of [-1, 1]) s.cap([2.5, side * 1.2, z + 9], [3, side * 1.3, z + 11], 0.45, 0.1, bone);
        if (mage) {
          s.ell([-0.6, 0, z + 10], [2.8, 2.8, 3.4], voidM);
          s.cap([0, 0, z + 12], [-2, 0, z + 17], 1.6, 0.05, voidM);
          eyes(2, 1.3, z + 11);
        }
        const handZ = z + 2 + pose;
        for (const side of [-1, 1])
          s.cap([0, side * 3 * bulk, z + 6 * bulk], [2 + pose, side * 3.2 * bulk, handZ], 1.1 * bulk, 0.7 * bulk, skin);
        if (troll) {
          s.ell([3, 3.5, handZ], [2.3, 2.1, 2.1], skin);
          for (const [x, y] of [
            [-1, -2],
            [1, 2],
            [-2, 1],
          ])
            s.ell([x!, y! * bulk, z + 7], [1.8, 1.8, 0.7], leaf);
        } else if (mage) {
          s.cap([3, 3.3, 1], [3, 3.3, z + 14], 0.45, 0.4, gold);
          s.sph([3, 3.3, z + 15], 1.7, m(P.q6, true));
        } else {
          s.cap([2, 3.3, handZ], [7 + pose, 3.3, handZ + 4 + pose], 0.5, 0.9, steel);
          s.cap([2, 2.2, handZ], [3, 4.4, handZ], 0.4, 0.4, gold);
        }
        if (id === 'bandit') {
          s.ell([-0.8, 0, z + 10], [2.8, 2.7, 3], m(P.e2));
          eyes(2.1, 1.5, z + 10.6, 0.45);
          s.ell([-2, 0, z + 3], [1.1, 3.4, 5.5], m(P.e1));
        }
        if (orc || id === 'raider') s.ell([1.8, 0, z + 4 * bulk], [1.3, 3 * bulk, 4 * bulk], steel);
        if (id === 'bandit') s.ell([1.7, 0, z + 8.4], [1.1, 2.3, 0.7], cloth);
        if (id === 'raider') {
          for (const side of [-1, 1]) s.cap([-1, side * 2.4, z + 13], [-1, side * 4, z + 16], 0.7, 0.05, bone);
          s.ell([7 + pose, 3.3, handZ + 4], [2.3, 0.5, 2.5], steel);
        }
      } else if (id === 'songbird' || id === 'phoenix' || id === 'thunderbird') {
        const tiny = id === 'songbird',
          body = m(tiny ? P.e4 : id === 'phoenix' ? P.r4 : P.w3),
          plume = m(id === 'phoenix' ? P.e6 : P.w6),
          z = walk ? 10 : tiny ? 4 : 8;
        s.ell([0, 0, z], [tiny ? 3.5 : 5, tiny ? 2 : 3, tiny ? 2.5 : 3.5], body);
        s.ell([3, 0, z + 2], [2.4, 2, 2.4], body);
        s.cap([4, 0, z + 1.6], [7, 0, z + 1], 0.9, 0.1, gold);
        eyes(4, 1.4, z + 2.7);
        wings(body, plume, z + 2, tiny ? 5 : 11, tiny ? 4 : 7);
        for (const side of [-1, 1]) {
          s.cap([0, side, 3], [1, side * 1.5, 0.6], 0.4, 0.25, gold);
          s.cap([1, side * 1.5, 0.6], [3, side * 1.5, 0.5], 0.3, 0.15, gold);
        }
        for (let i = -1; i <= 1; i++)
          s.cap([-3, i * 0.6, z], [-10 - (!tiny ? 4 : 0), i * 2, z - 2 + (walk ? wave : 0)], 0.9, 0.15, plume);
        if (!tiny) {
          s.cap([2, 0, z + 4], [1, 0, z + 8 + pose], 1, 0.1, plume);
          if (id === 'thunderbird')
            for (const side of [-1, 1]) s.cap([2, side, z + 5], [0, side * 3, z + 7], 0.8, 0.1, gold);
        }
      } else if (id === 'river_fish') {
        const body = m(P.w4);
        s.ell([0, 0, 3], [5, 1.6, 2], body);
        s.ell([-5, 0, 3], [2, 0.5, 3], gold, rotX(stride * 0.2));
        s.ell([0, 0, 5], [2, 0.3, 1.5], gold);
        eyes(3.5, 1.2, 3.5, 0.4);
      } else if (id === 'spider') {
        const body = m(P.q1);
        s.ell([-2, 0, 6], [4, 3.5, 3], body);
        s.ell([3, 0, 5], [2.5, 2.5, 2], dark);
        for (const side of [-1, 1])
          for (let i = 0; i < 4; i++) {
            const x = -3 + i * 2,
              step = walk ? Math.sin(t * Math.PI * 2 + i + side) * 1 : 0;
            s.cap([x, side * 2, 5], [x - 1, side * (5 + i * 0.4), 6 + step], 0.65, 0.45, body);
            s.cap([x - 1, side * (5 + i * 0.4), 6 + step], [x + step, side * (8 + i * 0.3), 0.5], 0.45, 0.2, dark);
          }
        eyes(4.5, 1.2, 6, 0.7);
        s.sph([5.3, 0, 6.8], 0.45, eye);
        for (const side of [-1, 1]) s.cap([5, side, 4], [6, side * 1.4, 3], 0.5, 0.1, bone);
      } else if (id === 'siren') {
        const body = m(P.w3),
          fin = m(P.g4),
          hair = m(P.q2);
        s.ell([-2, 0, 3], [7, 3.2, 2.6], body);
        s.cap([-7, 0, 3], [-11, 0, 1.8], 1.5, 0.4, fin);
        s.ell([-11, 0, 2], [2, 0.5, 3], fin);
        s.ell([2, 0, 9], [2.4, 2.4, 5], body);
        s.ell([2, 0, 16], [2.6, 2.5, 3.2], hair);
        s.ell([3.3, 0, 15.6], [1.5, 2, 2.2], bone);
        eyes(4.2, 1.4, 16, 0.45);
        for (const side of [-1, 1]) s.cap([2, side * 2, 11], [5 + pose, side * 4, 10 + pose], 0.8, 0.5, body);
        s.cap([5, 4, 1], [5, 4, 20], 0.4, 0.3, gold);
        for (const side of [-1, 0, 1]) s.cap([5 + side * 1.8, 4, 18], [5 + side * 1.8, 4, 22 + pose], 0.4, 0.05, fin);
        for (const side of [-1, 1]) s.cap([1, side * 2, 17], [-2, side * 3, 9], 1.2, 0.3, hair);
      } else if (id === 'world_serpent') {
        const body = m(P.w3),
          belly = m(P.g5);
        for (let i = 0; i < 13; i++) {
          const a = i * 0.47 + stride * 0.04,
            x = Math.cos(a) * 12,
            y = Math.sin(a) * 9;
          const prev = (i - 1) * 0.47 + stride * 0.04;
          if (i)
            s.cap([Math.cos(prev) * 12, Math.sin(prev) * 9, 3 + (i - 1) * 0.35], [x, y, 3 + i * 0.35], 3.1, 3.1, body);
          s.ell([x, y, 3 + i * 0.35], [3.2, 2.9, 2.8], i % 3 === 0 ? belly : body);
          s.cap([x, y, 5 + i * 0.35], [x, y, 8 + i * 0.35], 0.8, 0.05, gold);
        }
        s.cap([12, -1, 7], [13, -1, 17 + pose], 2.8, 2.2, body);
        head(15, -1, 18 + pose, body, 1.4);
        for (const side of [-1, 1]) s.cap([14, side * 2, 20], [10, side * 5, 24], 1, 0.1, gold);
      } else if (id === 'sealed_entity' || id === 'forgotten_titan' || id === 'realm_guardian') {
        const king = id === 'sealed_entity',
          guardian = id === 'realm_guardian',
          body = m(king ? P.q1 : guardian ? P.g2 : P.slate);
        const z = king ? 10 : 11;
        if (!king)
          for (const side of [-1, 1]) {
            const step = walk ? Math.sin(t * Math.PI * 2 + (side > 0 ? 0 : Math.PI)) * 1.7 : 0;
            s.cap([0, side * 3, z], [step, side * 3.5, 1.2], 2.1, 1.4, body);
            s.ell([step + 1, side * 3.5, 1], [2.7, 1.8, 1.2], steel);
          }
        s.ell([0, 0, z + 6], [king ? 4 : 6, king ? 3 : 5, king ? 9 : 8], body);
        if (!king) {
          for (const side of [-1, 1]) s.ell([3, side * 2.7, z + 10], [2.4, 2.3, 2.7], steel);
          s.cap([4, -4, z + 5], [4, 4, z + 5], 0.7, 0.7, gold);
        }
        for (const side of [-1, 1]) {
          s.ell([0, side * 6, z + 10], [3, 3, 3], body);
          s.cap([0, side * 6, z + 8], [3 + pose, side * 7, z + 1], 2.5, 1.8, body);
          if (!king) s.ell([4 + pose, side * 7, z], [2.4, 2.2, 2.5], steel);
        }
        s.ell([0.8, 0, z + 16], [3.6, 3.1, 3.5], body);
        eyes(3, 2.2, z + 16, 0.7);
        s.ell([4, 0, z + 7], [1.2, 2.6, 3.4], m(guardian ? P.q6 : P.e5, true));
        for (let i = 0; i < (guardian ? 6 : 4); i++) {
          const a = (i / (guardian ? 6 : 4)) * Math.PI * 2;
          s.cap(
            [Math.cos(a) * 4, Math.sin(a) * 4, z + 18],
            [Math.cos(a) * 5, Math.sin(a) * 5, z + 24 + (i % 2) * 2],
            0.8,
            0.1,
            gold,
          );
        }
        if (king) {
          for (const [x, y] of [
            [-7, -6],
            [-7, 6],
            [6, -7],
            [6, 7],
          ]) {
            s.ell([x!, y!, z + 4 + wave * 0.3], [1.4, 1.4, 5], bone);
            s.line([x! + 0.8, y!, z + 2], [x! + 0.8, y!, z + 7], P.q3, 0.6);
          }
        }
        if (!king && !guardian) {
          s.cap([4, 7, z], [8, 7, z + 11 + pose], 1.2, 1.1, gold);
          s.cap([4, 7, z + 13 + pose], [13, 7, z + 13 + pose], 3, 3, steel);
          for (let i = 0; i < 4; i++) s.ell([3.8, 0, z + 2 + i * 2], [1, 4, 0.6], gold);
        }
      } else {
        const dragon = id === 'dragon' || id === 'primordial_dragon',
          hydra = id === 'hydra',
          unicorn = id === 'unicorn',
          manticore = id === 'manticore',
          basilisk = id === 'basilisk',
          spirit = id === 'woodland_spirit';
        const body = m(
          dragon
            ? ancient
              ? P.r2
              : P.r3
            : hydra
              ? P.g2
              : unicorn
                ? P.pale
                : manticore
                  ? P.e4
                  : basilisk
                    ? P.g3
                    : spirit
                      ? P.g4
                      : P.q2,
        );
        s.ell([0, 0, 8], [dragon ? 7 : 6.6, dragon ? 4.2 : 3.3, dragon ? 4.5 : 3.4], body);
        legs(body, 4.3, -4.3, 8, 3);
        if (hydra) {
          for (let i = -1; i <= 1; i++) {
            const y = i * 3.7;
            s.cap([3, y * 0.5, 8], [7, y, 15 + pose + Math.abs(i)], 2, 1.5, body);
            head(8, y, 17 + pose + Math.abs(i), body, 0.95);
          }
        } else {
          const z = dragon ? 15 : unicorn || spirit ? 15 : 11;
          s.cap([4, 0, 9], [6, 0, z], 2.2, 1.8, body);
          if (dragon) {
            s.ell([7, 0, z + 1 + pose], [3.9, 2.8, 2.7], body);
            s.cap([8, 0, z + pose], [13, 0, z - 0.8 + pose], 1.9, 1.2, body);
            for (const side of [-1, 1]) {
              s.sph([9.2, side * 2.3, z + 2 + pose], 0.6, eye);
              s.cap([7.5, side * 2.4, z + 2.4 + pose], [10.2, side * 2, z + 2.4 + pose], 0.6, 0.35, dark);
              s.cap([11, side * 1.1, z - 0.8 + pose], [12, side * 1.2, z - 2 + pose], 0.35, 0.05, bone);
            }
          } else head(7, 0, z + 1 + pose, body, 1);
        }
        tail(body, 7, dragon ? 15 : 9, manticore ? 1.8 : 1);
        if (dragon) {
          const spread = wind || walk || attack ? 1 : 0.72,
            flap = walk ? wave * 2 : wind ? 3 : 0;
          for (const side of [-1, 1]) {
            s.cap([2, side * 2, 12], [2, side * 9 * spread, 16 + flap], 1.4, 0.7, body);
            s.ell([-1, side * 8 * spread, 11 + flap], [6, 7 * spread, 0.6], m(P.r2), rotX(side * 0.25 + flap * 0.04));
            for (let i = 0; i < 4; i++)
              s.cap(
                [2, side * 9 * spread, 16 + flap],
                [-4 - i * 1.8, side * (14 - i * 1.8) * spread, 8 + flap],
                0.55,
                0.12,
                gold,
              );
            s.cap([2, side * 9 * spread, 16 + flap], [3, side * 10 * spread, 18 + flap], 0.45, 0.05, bone);
            for (const x of [4.3, -4.3])
              for (let claw = -1; claw <= 1; claw++)
                s.cap([x + 0.8, side * 3 + claw * 0.6, 0.8], [x + 2.3, side * 3 + claw * 0.7, 0.3], 0.3, 0.05, bone);
          }
          for (let x = -5; x <= 4; x += 2) s.cap([x, 0, 11], [x - 1, 0, 15 + pose * 0.5], 0.9, 0.05, gold);
          for (const side of [-1, 1]) s.cap([6, side * 1.8, 18 + pose], [3, side * 3, 22 + pose], 0.9, 0.1, bone);
          if (ancient) {
            s.ell([5, 0, 10], [1.8, 3.5, 3], m(P.e6, true));
            for (const side of [-1, 1]) s.cap([8, side * 1.4, 19 + pose], [7, side * 2, 24 + pose], 0.7, 0.1, gold);
          }
        }
        if (unicorn) s.cap([8, 0, 19], [11, 0, 25 + pose], 0.7, 0.05, gold);
        if (unicorn || spirit)
          for (let x = -4; x <= 4; x += 2) s.ell([x, 0, 11], [1.5, 0.8, 1.7], spirit ? leaf : m(P.w4));
        if (spirit || id === 'corrupted_beast')
          for (const side of [-1, 1]) {
            s.cap([6, side * 1.5, 18], [4, side * 4, 24], 0.6, 0.1, spirit ? leaf : voidM);
            s.cap([5, side * 3, 21], [8, side * 5, 24], 0.35, 0.05, spirit ? leaf : voidM);
          }
        if (manticore) {
          s.ell([7, 0, 13], [3.4, 3.3, 3.8], m(P.e2));
          s.cap([-7, 0, 8], [-12, 0, 18 + pose * 2], 1.3, 0.7, body);
          s.cap([-12, 0, 18 + pose * 2], [-8, 0, 21 + pose * 2], 0.8, 0.05, dark);
          wings(body, m(P.r2), 11, 7, 4);
        }
        if (basilisk) {
          for (let x = -5; x <= 8; x += 2) s.cap([x, 0, 11], [x - 1, 0, 15], 0.8, 0.05, gold);
          eyes(9, 2, 14, 0.95);
        }
      }
      if (hurt) s.ell([0, 0, 10], [2, 2, 2], m(P.e7, true));
      s.pop();
    },
  };
}
export const LEGENDARY_DEFS = Object.fromEntries(
  NEW_CREATURE_KEYS.map((id) => [id, legendaryDef(id as NewCreatureKey)]),
) as Record<NewCreatureKey, Def>;
