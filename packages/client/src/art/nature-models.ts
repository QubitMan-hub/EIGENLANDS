import { WILDLIFE_BY_ID } from '@eigenlands/shared';
import { C, ramp4 } from './shade';
import { capsule, ellipsoid, rbox, type Prim, type Ramp } from './voxel';

const DARK: Ramp = [C.ink, C.ink, C.night, C.slate];
const PALE: Ramp = [C.mist, C.fog, C.pale, C.white];
const eye = (a: number, b: number, z: number) => ellipsoid([a, b, z], [0.35, 0.3, 0.4], DARK);

/** Animal space: a toward the nose, b across the body, z above its ground contact. */
export function wildlifeModel(id: string, frame: number, season: number): Prim[] {
  const s = WILDLIFE_BY_ID[id];
  if (!s) return [];
  const winter = season === 3 && (id === 'stoat' || id === 'hare');
  const coat = winter ? PALE : ramp4(s.body),
    accent = ramp4(s.accent);
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const p: Prim[] = [];
  const legs = (front: number, back: number, spread: number, hip: number, radius = 0.5) => {
    for (const a of [front, back])
      for (const side of [-1, 1]) {
        const swing = step * (a * side > 0 ? 1 : -1),
          lift = swing > 0 ? 0.5 : 0;
        p.push(capsule([a, side * spread, hip], [a + swing, side * spread, 0.6 + lift], radius, coat));
        p.push(ellipsoid([a + swing + 0.4, side * spread, 0.5 + lift], [0.9, 0.55, 0.4], accent));
      }
  };
  const eyes = (a: number, width: number, z: number) => {
    for (const side of [-1, 1]) p.push(eye(a, side * width, z));
  };
  if (['rodent', 'spiny', 'hare', 'longbody'].includes(s.shape)) {
    const hare = s.shape === 'hare',
      long = s.shape === 'longbody',
      spiny = s.shape === 'spiny';
    const length = long ? 6 : hare ? 4.4 : id === 'vole' ? 3.2 : 3.8,
      height = long ? 3.3 : hare ? 5 : 3.8;
    const fur =
      id === 'chipmunk'
        ? (a: number, b: number, z: number) =>
            z > height + 1 && Math.abs(b) > 0.4 && Math.abs(b) < 1.1 ? accent : coat
        : coat;
    p.push(ellipsoid([0, 0, height], [length, 2, 2.2], fur));
    legs(length - 1, -length + 1, 1.35, height - 1, hare ? 0.65 : 0.45);
    if (hare) for (const side of [-1, 1]) p.push(ellipsoid([-2, side * 1.5, 2.6], [1.8, 1, 1.8], coat));
    const hz = hare ? 7 : long ? 4.5 : 5.2;
    p.push(capsule([length - 1, 0, height], [length, 0, hz], 1.2, coat));
    p.push(ellipsoid([length + 0.3, 0, hz], [1.8, 1.5, 1.5], coat));
    p.push(ellipsoid([length + 1.6, 0, hz - 0.7], [1.1, 1, 0.6], accent));
    p.push(ellipsoid([length + 2.4, 0, hz - 0.5], [0.4, 0.4, 0.35], DARK));
    eyes(length + 1, 1.2, hz + 0.35);
    for (const side of [-1, 1])
      p.push(
        capsule(
          [length, side, hz + 0.9],
          [length - 0.4, side * 1.3, hz + (hare ? 6 : 2.4)],
          hare ? 0.7 : 0.8,
          coat,
          hare ? 0.4 : 0.55,
        ),
      );
    if (hare) p.push(ellipsoid([-length - 0.5, 0, height], [1.2, 1.2, 1.3], PALE));
    else if (id === 'squirrel') {
      p.push(capsule([-length, 0, height], [-length - 2, 0, 9 + step * 0.6], 1.3, coat, 2));
      p.push(ellipsoid([-length - 1.6, 0, 9 + step * 0.6], [1.8, 1.4, 2.5], accent));
    } else if (!spiny) {
      p.push(capsule([-length, 0, height], [-length - (long ? 4 : 2.5), step * 0.5, 2], 0.45, coat, 0.25));
      if (id === 'stoat') p.push(ellipsoid([-length - 4, step * 0.5, 2], [0.7, 0.45, 0.5], DARK));
    }
    if (spiny)
      for (let a = -3; a <= 2; a += 1.5)
        for (const side of [-1, 1]) p.push(capsule([a, side, 5], [a - 0.7, side * 2, 7], 0.4, accent, 0.15));
  } else if (['bird', 'wader', 'waterbird'].includes(s.shape)) {
    const tall = s.shape === 'wader',
      water = s.shape === 'waterbird';
    const bodyZ = tall ? 10 : water ? 5 : 4.5,
      neck = tall ? 19 : water ? 9 : 7;
    p.push(ellipsoid([0, 0, bodyZ], [water ? 4 : 3.2, water ? 2.3 : 1.7, 2.2], coat));
    p.push(ellipsoid([1.4, 0, bodyZ - 0.5], [1.6, 1.6, 1.8], id === 'robin' ? accent : PALE));
    for (const side of [-1, 1]) {
      const swing = step * side;
      p.push(capsule([0.5, side, bodyZ - 1], [swing, side, 0.5], 0.35, accent));
      p.push(capsule([swing - 0.2, side, 0.4], [swing + 1.3, side, 0.4], 0.3, accent));
      const flying = s.motion === 'flutter';
      p.push(
        ellipsoid(
          [-0.6, side * (flying ? 3.6 : 1.7), bodyZ + (flying ? step * 1.7 : 0.3)],
          [2.5, flying ? 3 : 0.6, 0.75],
          accent,
        ),
      );
    }
    p.push(capsule([1.7, 0, bodyZ + 1], [2.8, 0, neck], tall ? 0.7 : 1, coat, 0.8));
    p.push(ellipsoid([3, 0, neck], [1.6, 1.3, 1.4], id === 'duck' ? accent : coat));
    p.push(
      capsule([4, 0, neck - 0.3], [tall ? 7 : water ? 5.9 : 5.3, 0, neck - 0.5], water ? 0.7 : 0.45, ramp4(C.e5), 0.2),
    );
    eyes(3.6, 1, neck + 0.3);
    p.push(capsule([-2.5, 0, bodyZ], [-5, 0, bodyZ + 1], 0.9, accent, 0.4));
    if (id === 'woodpecker') p.push(capsule([2.2, 0, neck + 1], [3.5, 0, neck + 1.5], 0.65, accent));
    if (id === 'clockwork_wren') {
      p.push(ellipsoid([0, 1.8, bodyZ], [1, 0.35, 1], accent));
      p.push(eye(0, 2, bodyZ));
    }
  } else if (['frog', 'newt', 'lizard', 'turtle'].includes(s.shape)) {
    const turtle = s.shape === 'turtle',
      frog = s.shape === 'frog',
      long = !frog && !turtle;
    const length = long ? 5.5 : 3.4;
    p.push(ellipsoid([0, 0, 2], [length, 2.2, turtle ? 2.5 : 1.5], coat));
    if (turtle)
      p.push(
        ellipsoid([-0.4, 0, 3], [3.5, 2.7, 2.2], (a, b) =>
          Math.abs(a % 2.8) < 0.2 || Math.abs(b) < 0.2 ? accent : coat,
        ),
      );
    for (const a of [-length + 1, length - 1])
      for (const side of [-1, 1]) {
        const swing = step * (a * side > 0 ? 1 : -1),
          knee = a < 0 && frog ? -length - 1 : a + swing;
        p.push(capsule([a, side * 1.4, 2], [knee, side * 3, 1.2], frog ? 0.8 : 0.45, coat));
        p.push(capsule([knee, side * 3, 1.2], [a + swing + 1, side * 3.5, 0.4], 0.4, accent));
      }
    p.push(ellipsoid([length + 0.7, 0, 2.6], [1.9, 1.6, 1.2], coat));
    eyes(length + 1.3, 1.3, 3.4);
    if (long) {
      p.push(capsule([-length, 0, 2], [-length - 3, step, 1], 0.8, coat, 0.4));
      p.push(capsule([-length - 3, step, 1], [-length - 5, step + 1, 0.5], 0.4, coat, 0.15));
      if (id === 'gecko') for (const a of [-3, 0, 3]) p.push(ellipsoid([a, 0, 3.3], [0.6, 0.7, 0.3], accent));
    }
  } else if (s.shape === 'crab') {
    p.push(rbox([0, 0, 2.5], [3.5, 2.4, 1.5], 1, coat));
    for (const side of [-1, 1]) {
      for (let a = -2; a <= 2; a += 2) {
        p.push(capsule([a, side * 2, 2], [a + step * side, side * 4.5, 1.2], 0.4, accent));
        p.push(capsule([a + step * side, side * 4.5, 1.2], [a - 1, side * 5.5, 0.4], 0.35, coat));
      }
      p.push(capsule([2, side * 1.8, 3], [5, side * 3, 4 + step * 0.5], 0.65, coat));
      p.push(ellipsoid([5.2, side * 3, 4.4 + step * 0.5], [1.4, 0.9, 0.8], accent));
      p.push(capsule([2.5, side, 3], [3, side, 4.8], 0.3, coat));
      p.push(eye(3, side, 5));
    }
  } else {
    const moth = s.shape === 'moth',
      dragon = s.shape === 'dragonfly',
      bee = s.shape === 'bee';
    const wing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const material = bee ? (a: number) => (Math.floor(a + 4) % 2 === 0 ? DARK : coat) : coat;
    p.push(ellipsoid([0, 0, 3.4], [dragon ? 4 : bee ? 3 : 2, moth ? 1 : 1.3, 1.1], material));
    p.push(ellipsoid([dragon || bee ? 3 : 2, 0, 3.8], [1, 1, 1], accent));
    eyes(dragon || bee ? 3.5 : 2.5, 0.7, 4);
    for (const side of [-1, 1]) {
      if (s.shape !== 'beetle')
        for (const a of [-1, 1]) {
          const b = side * (moth ? 3 : dragon ? 3.6 : 3.8);
          p.push(
            ellipsoid(
              [a, b, 3 + wing * (moth ? 2 : 1.4)],
              [dragon ? 2 : 1.6, moth ? 2.2 : 1.4, 0.45],
              moth ? accent : PALE,
            ),
          );
        }
      if (s.motion !== 'flutter')
        for (const a of [-1, 0, 1]) p.push(capsule([a, side, 3], [a + step * side, side * 2, 0.4], 0.25, accent));
      p.push(capsule([2, side * 0.6, 4], [3, side * 1.3, 5], 0.2, accent));
    }
    if (s.shape === 'beetle')
      p.push(
        rbox([-0.3, 0, 4.2], [2, 1.3, 0.5], 0.4, (a, b) => {
          const seam = Math.abs(b) < 0.2;
          const spot = id === 'ladybird' && Math.abs(Math.abs(a + 0.3) - 1) < 0.45 && Math.abs(b) > 0.55;
          return seam || spot ? accent : coat;
        }),
      );
  }
  return p;
}
