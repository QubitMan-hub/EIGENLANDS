import { Scene, ramp, type Mat } from '../../art/sprite';
import type { Anim } from '../../art/foes';

const NAMES = [
  'slime_king',
  'warden',
  'colossus',
  'bellkeeper',
  'veyr',
  'geode_tyrant',
  'cinder_wyrm',
  'rime_sovereign',
  'tide_leviathan',
];
export const isVoxelBoss = (id: string) => NAMES.includes(id);
const m = (color: number): Mat => ({ r: ramp(color, 1, 1) });

/** Authored volumes replace the nine bosses whose prior source is exclusively sprite artwork. */
export function drawVoxelBoss(s: Scene, id: string, anim: Anim, t: number): void {
  const gait = anim === 'move' ? Math.sin(t * Math.PI * 2) : 0;
  const attack = anim === 'attack' ? Math.sin(t * Math.PI) : 0;
  const stone = m(id === 'colossus' ? 0x76647c : 0x5a6270),
    bone = m(0xddd3ac),
    gold = m(0xd6a34f);
  const crystal = m(id === 'geode_tyrant' ? 0xb18fd3 : id === 'rime_sovereign' ? 0xb1d5df : 0x62b9ca);
  const eye = m(0xf4cd69),
    dark = m(0x24343f),
    wood = m(0x64432f),
    leaf = m(0x64814a);
  const z = anim === 'death' ? -8 * t : 0;
  s.push([1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0], [attack * 3, 0, z]);
  if (id === 'slime_king') {
    const body = m(0x43836d),
      light = m(0x6da881);
    s.ell([0, 0, 11 + gait], [18, 14, 12 + gait], body);
    for (const side of [-1, 1]) {
      s.ell([0, side * 11, 6], [9, 8, 6], body);
      s.ell([9, side * 5, 16], [3, 2, 2], light);
      s.ell([15, side * 5, 17], [1.5, 2, 1], eye);
    }
    s.ell([-2, 0, 25], [8, 7, 2], gold);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      s.cap([-2 + Math.cos(a) * 6, Math.sin(a) * 5, 25], [-2 + Math.cos(a) * 7, Math.sin(a) * 6, 31], 2, 0.4, gold);
    }
    s.sph([5, 0, 27], 2, m(0xe49840));
  } else if (id === 'warden') {
    s.ell([0, 0, 15], [18, 11, 12], wood);
    s.ell([15, 0, 13], [9, 9, 8], wood);
    s.ell([23, 0, 10], [4, 6, 4], m(0x855a44));
    for (const side of [-1, 1]) {
      for (const x of [-10, 12]) s.cap([x, side * 7, 12], [x + gait * side * 3, side * 8, 1], 3.3, 2.2, wood);
      s.cap([23, side * 6, 8], [28, side * 9, 16], 2.2, 0.2, bone);
      s.sph([20, side * 8, 17], 1.6, eye);
      s.ell([-7, side * 9, 19], [7, 2, 4], leaf);
      for (let i = 0; i < 4; i++) s.cap([-13 + i * 8, side * 2, 24], [-17 + i * 8, side * 3, 31 - i], 3, 0.3, wood);
    }
  } else if (['cinder_wyrm', 'tide_leviathan'].includes(id)) {
    const fire = id === 'cinder_wyrm',
      body = m(fire ? 0x67463c : 0x426f7c),
      fin = m(fire ? 0xbd6f42 : 0x6ca59c);
    for (let i = 0; i < 16; i++) {
      const a = i * 0.28,
        x = -28 + i * 4,
        y = Math.sin(a + gait * 0.2) * 9,
        z = 7 + Math.cos(a) * 2;
      s.ell([x, y, z], [4.8, 6 - i * 0.17, 5.5 - i * 0.15], body);
      s.cap([x, y, z + 4], [x - 2, y, z + 9], 1.9, 0.1, fin);
    }
    s.ell([35, -8, 10], [9, 8, 7], body);
    s.ell([42, -8, 8], [5, 5, 3], body);
    for (const side of [-1, 1]) {
      s.sph([40, -8 + side * 6, 13], 1.2, eye);
      s.cap([30, -8 + side * 6, 15], [25, -8 + side * 10, 24], 2, 0.1, fin);
      s.cap([16, side * 6, 7], [12, side * 19, 4], 4, 0.4, fin);
    }
  } else {
    const bell = id === 'bellkeeper',
      ice = id === 'rime_sovereign',
      gem = id === 'geode_tyrant';
    const body = bell ? m(0x716441) : ice ? m(0x85a0ac) : stone;
    s.ell([0, 0, 18], [10, 7, 11], body);
    s.ell([0, 0, 32], [7, 6, 6], body);
    for (const side of [-1, 1]) {
      s.cap([0, side * 6, 11], [gait * side * 3, side * 8, 1], 4, 3, body);
      s.ell([0, side * 13, 24], [6, 6, 6], body);
      s.cap([0, side * 13, 22], [attack * 9, side * 16, 11 + attack * 12], 4.8, 4.5, body);
      s.sph([6, side * 2.5, 33], 0.8, crystal);
      s.cap([-1, side * 11, 29], [-3, side * 12, 37], 2.5, 0.1, crystal);
    }
    s.sph([8, 0, 22], 3, anim === 'windup' ? eye : crystal);
    s.cap([0, 0, 36], [-2, 0, 43], 2.5, 0.1, crystal);
    if (bell) {
      s.ell([8, 17, 9], [6, 6, 7], gold);
      s.ell([8, 17, 3], [8, 8, 2], gold);
      s.cap([0, 17, 15], [8, 17, 19], 1, 1, wood);
      for (let i = 0; i < 4; i++) s.ell([-4 + i * 3, 0, 19], [1, 8, 7], dark);
    }
    if (ice || gem)
      for (let i = 0; i < 7; i++) {
        const a = (i * Math.PI) / 3.5;
        s.cap(
          [Math.cos(a) * 5, Math.sin(a) * 5, 36],
          [Math.cos(a) * 9, Math.sin(a) * 9, 44 + (i % 2) * 3],
          2,
          0.1,
          crystal,
        );
      }
  }
  s.pop();
}
