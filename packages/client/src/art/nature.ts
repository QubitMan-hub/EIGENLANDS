import { wildlifeModel } from './nature-models';
import { paintModel, type Heading } from './voxel';
import { FLORA_BY_ID, C, mulberry32 } from '@eigenlands/shared';
import { poly, dk, lt, ramp4, type Ctx } from './shade';
import { Iso } from './isokit';

const salt = (id: string) => [...id].reduce((v, ch) => Math.imul(v ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Botanical geometry in tile space, projected by the same 2:1 kit as furniture and buildings. */
export function paintFlora(ctx: Ctx, id: string, variant: number, season: number): void {
  const s = FLORA_BY_ID[id];
  if (!s) return;
  const rng = mulberry32(salt(id) + variant * 313),
    winter = season === 3 && !s.evergreen;
  const leaf = winter ? C.e3 : season === 2 && !s.evergreen ? C.e4 : s.leaf;
  const petal = winter ? C.fog : season === 2 && !s.evergreen ? C.e6 : s.petal;
  const h = s.height * (winter ? 0.6 : 1),
    I = new Iso(ctx, 20, 26);
  type Point = [number, number, number];
  const leafAt = (u: number, v: number, z: number, du: number, dv: number, dz: number, color = leaf) => {
    const pts: Point[] = [
      [u, v, z],
      [u + du * 0.35 - dv * 0.23, v + dv * 0.35 + du * 0.23, z + dz * 0.55],
      [u + du, v + dv, z + dz],
      [u + du * 0.35 + dv * 0.23, v + dv * 0.35 - du * 0.23, z + dz * 0.55],
    ];
    poly(
      ctx,
      pts.map(([a, b, c]) => [I.X(a, b), I.Y(a, b, c)]),
      color,
    );
    I.line3(u, v, z, u + du, v + dv, z + dz, lt(color));
  };
  const bloom = (u: number, v: number, z: number, r = 1.3) => {
    for (const [du, dv] of [
      [-r, 0],
      [r, 0],
      [0, -r],
      [0, r],
    ])
      I.cyl(u + du!, v + dv!, z, r * 0.65, 0.5, ramp4(petal));
    I.dot(u, v, z + 0.8, id === 'poppy' ? C.ink : C.e7);
  };
  const bases = Array.from({ length: s.shape === 'moss' ? 9 : 3 }, () => ({
    u: 4 + rng() * 8,
    v: 4 + rng() * 8,
    k: rng(),
  })).sort((a, b) => a.u + a.v - b.u - b.v);
  for (const { u, v, k } of bases) {
    const height = Math.max(2, h - 2 * k);
    if (['flower', 'herb', 'spike', 'cotton', 'reed'].includes(s.shape)) {
      I.line3(u, v, 0, u + 0.4, v, height, dk(leaf));
      for (let z = 2; z < height - 1; z += 3) leafAt(u, v, z, (z % 2 ? 1 : -1) * 3, 1, 1);
      if (!winter) {
        if (s.shape === 'spike')
          for (let z = height * 0.4; z < height; z += 2) I.cyl(u + 0.4, v, z, 1, 0.8, ramp4(petal));
        else if (s.shape === 'cotton') I.cyl(u + 0.4, v, height - 1, 1.8, 2, ramp4(petal));
        else if (s.shape === 'reed') I.cyl(u + 0.4, v, height - 2, 0.6, 3, ramp4(petal));
        else bloom(u + 0.4, v, height, s.shape === 'flower' ? 1.2 : 0.8);
      }
    } else if (s.shape === 'bush') {
      I.line3(u, v, 0, u, v, height, C.e2);
      for (let twig = 0; twig < 5; twig++) {
        const a = k * 6 + twig * 2.4,
          du = Math.cos(a) * (2 + k),
          dv = Math.sin(a) * (2 + k),
          z = height * (0.4 + twig * 0.11);
        I.line3(u, v, height * 0.25, u + du * 0.6, v + dv * 0.6, z, C.e2);
        leafAt(u + du * 0.5, v + dv * 0.5, z, du, dv, 0.5, twig % 2 ? leaf : dk(leaf));
        leafAt(u + du * 0.5, v + dv * 0.5, z, -dv * 0.65, du * 0.65, 0.4);
        if (!winter) I.dot(u + du * 0.65, v + dv * 0.65, z + 0.7, petal);
      }
    } else if (s.shape === 'fern' || s.shape === 'fan' || s.shape === 'succulent') {
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 + k,
          du = Math.cos(a) * 5,
          dv = Math.sin(a) * 5;
        leafAt(u, v, 0, du, dv, height * (s.shape === 'succulent' ? 0.65 : 1), i % 2 ? leaf : dk(leaf));
        if (s.shape === 'fern')
          for (let t = 0.3; t < 0.9; t += 0.25) {
            leafAt(u + du * t, v + dv * t, height * t, -dv * 0.45, du * 0.45, 0);
            leafAt(u + du * t, v + dv * t, height * t, dv * 0.45, -du * 0.45, 0);
          }
      }
      if (s.shape === 'fan' && !winter) bloom(u, v, height * 0.7, 0.8);
    } else if (s.shape === 'pad' || s.shape === 'moss') {
      I.cyl(u, v, 0, s.shape === 'pad' ? 2.8 : 1.3, 0.3, ramp4(leaf));
      if (s.shape === 'pad') bloom(u, v, 1, 1);
      else if (k > 0.65) I.dot(u, v, 0.6, petal);
    } else if (s.shape === 'cactus') {
      I.cyl(u, v, 0, id === 'prickly_pear' ? 1.5 : 2.4, height, ramp4(leaf));
      if (id === 'prickly_pear')
        for (const side of [-1, 1]) {
          I.line3(u, v, height * 0.5, u + side * 2, v, height * 0.65, leaf);
          I.cyl(u + side * 2, v, height * 0.55, 1, 3, ramp4(leaf));
        }
      for (let z = 2; z < height; z += 3) I.dot(u + 1.3, v + 0.5, z, C.e6);
      bloom(u, v, height, 1);
    } else if (s.shape === 'mushroom' || s.shape === 'shelf') {
      I.cyl(u, v, 0, 0.6, height, ramp4(C.e5));
      I.cyl(u, v, height, s.shape === 'shelf' ? 2.5 : 2, s.shape === 'shelf' ? 0.5 : 1.2, ramp4(petal));
      if (id === 'fly_agaric') {
        I.dot(u - 1, v, height + 1.3, C.white);
        I.dot(u + 0.5, v + 1, height + 1.3, C.white);
      }
      if (s.shape === 'shelf') I.cyl(u + 0.5, v, height * 0.55, 1.8, 0.5, ramp4(C.e4));
    } else if (s.shape === 'coral') {
      I.line3(u, v, 0, u, v, height, leaf);
      for (const side of [-1, 1]) {
        I.line3(u, v, height * 0.4, u + side * 2, v + 1, height, petal);
        I.line3(u + side * 2, v + 1, height * 0.8, u + side * 3, v, height + 1, leaf);
      }
    } else if (s.shape === 'vine') {
      let a = u,
        b = v;
      for (let z = 1; z < height; z += 3) {
        const na = u + Math.sin(z) * 1.4,
          nb = v + Math.cos(z) * 1.4;
        I.line3(a, b, z - 1, na, nb, z + 2, leaf);
        leafAt(na, nb, z + 1, 2, 1, 1);
        I.dot(na - 1, nb, z + 1, petal);
        a = na;
        b = nb;
      }
    }
    if (winter) I.dot(u, v, 0.3, C.fog, 2, 1);
  }
}

/** Four headings share one anatomical rig; lighting never flips with the animal. */
export function paintWildlife(ctx: Ctx, id: string, frame: number, season: number, heading: Heading = 0): void {
  paintModel(ctx, wildlifeModel(id, frame, season), heading, 40, 40, 20, 32);
}
