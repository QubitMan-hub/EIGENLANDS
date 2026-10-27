/**
 * Title-screen diorama: a floating isometric island with a raised ledge, a resonance shrine ring, torches, a tree and
 * your wanderer standing in front. Built from the same Iso kit and palette as the world, then bobbed gently by CSS
 * (still under reduced motion). The wanderer follows the character creator live.
 */
import { C, type Appearance } from '@eigenlands/shared';
import { OUTFITS, PERSON_W, PERSON_H, renderPersonCanvas } from '../art/actors';
import { outfitFromAppearance } from '../art/appearance';
import { Iso, mat, rampAt, STONEM, WOODM } from '../art/isokit';
import { blob, makeCanvas, rasterPixels, R } from '../art/shade';
import { h } from './dom';

const W = 192,
  H = 208;
/** geometry scale: the island is modelled in half-tiles and drawn twice as large */
const S = 2;

function island(ctx: ReturnType<typeof makeCanvas>['ctx']): void {
  rasterPixels(ctx, W, H, () => {
    const iso = new Iso(ctx, 96, 100);
    const B = (u: number, v: number, z: number, du: number, dv: number, dz: number, m: Parameters<Iso['box']>[6]) =>
      iso.box(u * S, v * S, z * S, du * S, dv * S, dz * S, m);
    const T = (u: number, v: number, z: number, du: number, dv: number, pt: Parameters<Iso['top']>[5]) =>
      iso.top(u * S, v * S, z * S, du * S, dv * S, pt);
    const Cy = (u: number, v: number, z: number, r: number, h: number, a: readonly number[], b: readonly number[]) =>
      iso.cyl(u * S, v * S, z * S, r * S, h * S, a, b);
    const D = (u: number, v: number, z: number, c: number, w = 1, h = 1) => iso.dot(u * S, v * S, z * S, c, w, h);
    const grass = (a: number, b: number, x: number, y: number) =>
      a < 0.04 || b < 0.04 ? C.g6 : (x * 7 + y * 13) % 11 === 0 ? C.g6 : (x + y) % 5 === 0 ? C.g4 : C.g5;
    // hanging rock, tapering to a point so the island floats
    B(-3, -3, -36, 6, 6, 10, mat(STONEM, { grain: 20 }));
    B(-5, -5, -28, 10, 10, 9, mat(STONEM, { grain: 17 }));
    B(-7, -7, -20, 14, 14, 9, mat(STONEM, { grain: 15 }));
    // soil and turf slab
    B(-9, -9, -12, 18, 18, 9, {
      top: grass,
      left: (_a, b) => (b > 0.82 ? C.g4 : rampAt(WOODM, 0.45 - b * 0.2)),
      right: (_a, b) => (b > 0.82 ? C.g2 : rampAt(WOODM, 0.22 - b * 0.12)),
    });
    T(-9, -9, -3, 18, 18, grass);
    // raised ledge at the back (a real cliff: one level up)
    B(-9, -9, -3, 9, 7, 6, {
      top: (a, b, x, y) => (a < 0.06 || b < 0.06 ? C.g7 : grass(a, b, x, y)),
      left: (_a, b) => (b > 0.84 ? C.g5 : rampAt(STONEM, 0.55 - b * 0.15)),
      right: (_a, b) => (b > 0.84 ? C.g3 : rampAt(STONEM, 0.3 - b * 0.1)),
    });
    // shrine ring on the lawn: three stepped discs, the middle one glowing cyan
    for (let i = 0; i < 3; i++) {
      const r = [5.2, 3.8, 2.2][i]!;
      const col = [C.mist, C.w6, C.steel][i]!;
      Cy(3, 3, -3 + i * 0.6, r, 0.6, [col, col], [col, col]);
    }
    Cy(3, 3, -1.8, 1.1, 0.8, [C.q4, C.q6], [C.q7, C.white]);
    // torches
    for (const [u, v] of [
      [7, -6],
      [-6, 7],
      [8, 7],
    ] as const) {
      B(u, v, -3, 1, 1, 9, mat(WOODM));
      D(u + 0.5, v + 0.5, 7, C.r5, 2, 2);
      D(u + 0.5, v + 0.5, 9, C.r7, 1, 1);
    }
    // tree on the ledge
    B(-6, -6, 3, 1.4, 1.4, 6, mat(WOODM));
    blob(ctx, iso.X(-5.3 * S, -5.3 * S), iso.Y(-5.3 * S, -5.3 * S, 20 * S), 22, 18, R.leaf, {
      seed: 3,
      noise: 0.3,
      edgeDark: 0.32,
    });
    blob(ctx, iso.X(-4.4 * S, -6 * S), iso.Y(-4.4 * S, -6 * S, 14 * S), 14, 11, R.leaf, {
      seed: 8,
      noise: 0.3,
      edgeDark: 0.3,
    });
    // rocks and flowers
    B(5, -2, -3, 2, 2, 2, mat(STONEM));
    for (const [u, v, c] of [
      [-1, 6, C.r4],
      [1, 7, C.q5],
      [6, 4, C.e6],
      [-4, 3, C.q6],
    ] as const)
      D(u, v, -3, c, 1, 2);
  });
}

export function mountTitleScene(host: HTMLElement, initial: Appearance): { setLook(a: Appearance): void } {
  const { canvas, ctx } = makeCanvas(W, H);
  island(ctx);
  const hero = h('canvas', { class: 'ts-hero' });
  hero.width = PERSON_W;
  hero.height = PERSON_H;
  hero.setAttribute('aria-hidden', 'true');
  canvas.className = 'ts-island';
  canvas.setAttribute('aria-hidden', 'true');
  const motes = Array.from({ length: 7 }, (_, i) => {
    const m = h('i', { class: 'ts-mote' });
    m.style.setProperty('--x', `${12 + i * 13}%`);
    m.style.setProperty('--d', `${5 + (i % 4) * 1.7}s`);
    m.style.setProperty('--w', `${-(i * 0.9)}s`);
    return m;
  });
  const stage = h('div', { class: 'ts-stage' }, canvas, hero, ...motes);
  host.append(h('div', { class: 'title-scene', 'aria-hidden': 'true' } as never, stage));
  const draw = (a: Appearance) => {
    const c = renderPersonCanvas(outfitFromAppearance(OUTFITS[0]!, a, true), 0, 0);
    const g = hero.getContext('2d')!;
    g.clearRect(0, 0, PERSON_W, PERSON_H);
    g.drawImage(c, 0, 0);
  };
  draw(initial);
  return { setLook: draw };
}
