import { mulberry32 } from '@eigenlands/shared';
import { Iso } from './isokit';
import { C, poly, type Ctx, type Ramp } from './shade';

type Point = [number, number, number];
const GRANITE: Ramp = [C.night, C.slate, C.steel, C.mist, C.fog, C.pale];
export const MINERALS: Record<string, Ramp> = {
  ore_copper: [C.r0, C.r1, C.r4, C.e5, C.e6],
  ore_iron: [C.e0, C.e1, C.e2, C.steel, C.mist],
  ore_silver: [C.slate, C.steel, C.mist, C.pale, C.white],
  ore_gold: [C.e1, C.e2, C.e4, C.e5, C.e7],
};

/** Angular, bevelled stones in world u/v/z. Veins are a single field intersecting all exposed faces. */
export function drawOutcrop(ctx: Ctx, variant: number, mineral?: string, snow = false, glint = 0, stoneRamp: Ramp = GRANITE): void {
  const I = new Iso(ctx, 20, 21), rng = mulberry32(210 + variant * 37);
  const vein = MINERALS[mineral ?? ''];
  const face = (points: Point[], shade: number, height: number) => {
    const [a, b, c] = points as [Point, Point, Point, ...Point[]];
    const e = b.map((n, i) => n - a[i]!) as Point, f = c.map((n, i) => n - a[i]!) as Point;
    const n = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
    const d = n[0]! * a[0] + n[1]! * a[1] + n[2]! * a[2], det = n[0]! + n[1]! + n[2]!;
    if (Math.abs(det) < 1e-6) return;
    poly(ctx, points.map(([u, v, z]) => [I.X(u, v), I.Y(u, v, z)]), (x, y) => {
      const sx = x + 0.5 - I.ox, sy = y + 0.5 - I.oy;
      const v = (d - (n[0]! + n[2]! / 2) * sx + n[2]! * sy) / det, u = sx + v, z = sx / 2 + v - sy;
      const seam = u * 0.57 + v * 0.34 + z * 0.6 + Math.sin(v * 0.75 + z * 0.45) * 0.55;
      const inVein = Math.abs(seam - (8.4 + variant * 0.6)) < 0.55 || Math.abs(seam - (12.7 - variant * 0.4)) < 0.24;
      if (snow && shade >= 4 && u + v < 17 + variant && z > height - 0.2) return x % 5 === 0 ? C.fog : C.pale;
      if (vein && inVein) {
        const k = Math.max(0, Math.min(4, shade - 1 + (Math.floor(u + z) % 3 === 0 ? 1 : 0)));
        return glint && shade >= 3 && Math.abs(seam - 8.4 - variant * 0.6) < 0.16 ? vein[4]! : vein[k]!;
      }
      // Broad material planes with occasional connected strata, never random white sprinkles.
      const strata = Math.abs(z - Math.floor(z / 4) * 4 - 0.3) < 0.18 && shade < 4 ? -1 : 0;
      return stoneRamp[Math.min(stoneRamp.length - 1, Math.max(0, shade + strata - (z < 1.2 ? 1 : 0)))]!;
    });
  };
  const stone = (u: number, v: number, du: number, dv: number, h: number, bevel: number) => {
    const ring: Array<[number, number]> = [[u + bevel, v], [u + du - bevel, v], [u + du, v + bevel], [u + du, v + dv - bevel], [u + du - bevel, v + dv], [u + bevel, v + dv], [u, v + dv - bevel], [u, v + bevel]];
    const top = ring.map(([x, y]) => [u + du / 2 + (x - u - du / 2) * 0.78, v + dv / 2 + (y - v - dv / 2) * 0.78, h] as Point);
    for (let j = 0; j < ring.length; j++) {
      const k = (j + 1) % ring.length, a = ring[j]!, b = ring[k]!;
      const facing = b[1] - a[1] - (b[0] - a[0]);
      if (facing <= 0) continue;
      face([[...a, 0], [...b, 0], top[k]!, top[j]!], j === 2 ? 2 : 3, h);
    }
    face(top, 4, h);
  };
  // Back companions first; the main outcrop stays within its 32×16 ground footprint.
  if (variant % 3 === 1) stone(1, 1, 6, 6, 4, 1.4);
  stone(3 + variant % 2, 3, 10 + rng() * 2, 9 + rng(), 7 + variant % 3 * 2, 2.2);
  if (variant % 3 !== 2) stone(11, 10, 4, 4, 3, 1);
}
