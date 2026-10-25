import { ART_RGB } from './creature-pixels';
import { Scene, ramp, rampOf, rotY, I3, type Mat, type V3 } from './sprite';
import type { Anim } from './foes';

export type WildModel = 'fox' | 'otter' | 'tortoise' | 'owl' | 'thornling' | 'glasscrawler';
const mat = (c: number): Mat => ({ r: ramp(c, 2, 2, { step: 0.09, hue: 9 }) });
const cream = mat(ART_RGB.pale),
  dark = mat(ART_RGB.slate),
  eye: Mat = { r: rampOf([ART_RGB.ink], 0) };
const colours: Record<WildModel, number> = {
  fox: ART_RGB.e4,
  otter: ART_RGB.e3,
  tortoise: ART_RGB.g3,
  owl: ART_RGB.fog,
  thornling: ART_RGB.g2,
  glasscrawler: ART_RGB.w3,
};

/** Original jointed rigs, all projected by Scene; no rotated front-facing sprites or palette-only species. */
export function wildDef(kind: WildModel) {
  return {
    w: 56,
    h: 52,
    ay: 44,
    shadow: [9, 3] as [number, number],
    n: { idle: 4, move: 8, windup: 4, attack: 4, hurt: 2, death: 5 },
    draw(s: Scene, anim: Anim, k: number, t: number, night: boolean) {
      const fur = mat(colours[kind]),
        shade = mat(kind === 'glasscrawler' ? ART_RGB.q1 : ART_RGB.e1);
      const moving = anim === 'move',
        attack = anim === 'attack',
        wind = anim === 'windup';
      const phase = t * Math.PI * 2,
        gait = moving ? Math.sin(phase) : 0;
      const head = anim === 'idle' && k === 3 ? -0.5 : wind ? -1 : attack ? 1.5 : 0;
      const sink = anim === 'death' ? t * 5 : 0;
      s.push(I3, [0, 0, 0], [0, 0, -sink]);
      if (kind === 'owl') {
        const chest = mat(ART_RGB.e5);
        for (const side of [-1, 1]) {
          s.cap([0, side * 2, 3], [1 + gait * side, side * 2, 0.8], 0.7, 0.5, dark);
          s.ell([-1, side * 3.1, 8], [3, 1.1, 5], fur, rotY(side * gait * 0.12));
          s.ell([3.5, side * 2.1, 14 + head], [1.5, 2, 2], cream);
          s.dot([4.9, side * 2.2, 14 + head], ART_RGB.ink, 1.2, 1.2, 1.2);
          s.cap([0, side * 2.5, 15], [0.5, side * 3.5, 19], 1.2, 0.1, fur);
        }
        s.ell([0, 0, 8], [4, 3.6, 6], fur);
        s.ell([2.8, 0, 7.5], [2, 2.7, 4.5], chest);
        s.ell([0.5, 0, 14], [4, 4, 4.3], fur);
        // Facial discs sit in front of the head, not behind its rasterized volume.
        for (const side of [-1, 1]) {
          s.ell([3.8, side * 2, 14], [1.3, 1.8, 2], cream);
          s.ell([4.9, side * 2, 14], [0.5, 0.7, 1], eye);
        }
        s.cap([5, 0, 13], [6.5, 0, 12], 0.7, 0.1, mat(ART_RGB.e4));
      } else if (kind === 'tortoise') {
        for (const x of [-4, 4])
          for (const side of [-1, 1]) s.cap([x, side * 3, 3], [x + gait * side, side * 4.4, 0.8], 1.3, 1, fur);
        s.ell([0, 0, 4], [7, 5, 4], shade);
        s.ell([0, 0, 5], [6.7, 4.7, 4], fur);
        // Raised scutes follow the dome, with the rear rim and head clearly separated.
        for (const x of [-3, 0, 3]) s.ell([x, 0, 8], [1.8, 2.1, 1.1], mat(ART_RGB.g4));
        s.cap([5, 0, 3], [8, 0, 3 + head], 1.4, 1.3, fur);
        s.ell([8, 0, 3 + head], [2, 1.5, 1.5], fur);
        s.dot([9, 1.1, 4 + head], ART_RGB.ink, 0.8, 0.8, 0.8);
      } else if (kind === 'thornling' || kind === 'glasscrawler') {
        const crystal = kind === 'glasscrawler';
        const body = crystal ? mat(ART_RGB.w4) : fur;
        s.ell([0, 0, 6], [5, 4, 4], body);
        for (const x of [-3.5, 2.5])
          for (const side of [-1, 1]) {
            const foot: V3 = [x + gait * side * 1.5, side * 6, 0.6 + Math.max(0, -gait * side)];
            s.cap([x, side * 2, 6], [x + 1, side * 4, 4], 1.2, 0.8, shade);
            s.cap([x + 1, side * 4, 4], foot, 0.8, 0.4, body);
          }
        for (const [x, y] of [
          [-3, -2],
          [0, 0],
          [2, 2],
        ])
          s.cap(
            [x!, y!, 8],
            [x! - 1, y!, 13 + (wind ? t * 2 : 0)],
            1.7,
            0.08,
            crystal ? mat(ART_RGB.q3) : mat(ART_RGB.g5),
          );
        s.ell([5 + head, 0, 5], [2, 2.5, 2], shade);
        for (const side of [-1, 1])
          s.dot([6.5 + head, side * 1.3, 6], night || crystal ? ART_RGB.q7 : ART_RGB.r5, 1, 1, 1);
      } else {
        const fox = kind === 'fox',
          z = fox ? 7 : 4.5,
          length = fox ? 6.5 : 7;
        for (const x of [-4.5, 4.5])
          for (const side of [-1, 1]) {
            const stride = moving ? Math.sin(phase + (x * side > 0 ? Math.PI : 0)) : 0;
            s.cap(
              [x, side * 2, z],
              [x + stride * 2, side * 2.2, 0.7 + Math.max(0, stride) * 1.6],
              fox ? 0.9 : 1.2,
              0.6,
              x * side > 0 ? fur : shade,
            );
          }
        s.ell([0, 0, z], [length, 3, fox ? 3.2 : 2.6], fur);
        s.ell([5, 0, z + 2 + head], [3.1, 2.4, 2.8], fur);
        s.cap([6, 0, z + 1 + head], [9, 0, z + head], 1.8, fox ? 0.65 : 1.2, cream);
        s.ell([9, 0, z + head], [0.8, 0.9, 0.7], eye);
        for (const side of [-1, 1]) {
          s.ell([6.6, side * 1.8, z + 3 + head], [0.5, 0.6, 0.7], eye);
          s.cap([4, side * 1.8, z + 3], [3.4, side * 2.2, z + (fox ? 7 : 4.5)], fox ? 1.4 : 0.8, fox ? 0.1 : 0.5, fur);
        }
        const tip: V3 = [-13, fox ? 2 + gait : gait * 0.4, fox ? 4 : 1.2];
        s.cap([-5, 0, z], [-10, 1, fox ? 5 : 2], fox ? 2.4 : 1.6, fox ? 2.1 : 1, fur);
        s.cap([-10, 1, fox ? 5 : 2], tip, fox ? 2 : 1, 0.4, fox ? cream : fur);
        if (!fox) {
          s.cap([6, 1.6, z + 1], [9, 3.5, z + 1], 0.12, 0.08, cream);
          s.cap([6, -1.6, z + 1], [9, -3.5, z + 1], 0.12, 0.08, cream);
        }
      }
      s.pop();
    },
  };
}
