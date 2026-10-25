import { mulberry32 } from './rng';

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class Simplex2D {
  private perm = new Uint8Array(512);

  constructor(seed: number) {
    const rng = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]!;
      p[i] = p[j]!;
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]!;
  }

  /** Returns noise in [-1, 1]. */
  noise(xin: number, yin: number): number {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const corner = (x: number, y: number, gi: number) => {
      let t0 = 0.5 - x * x - y * y;
      if (t0 < 0) return 0;
      t0 *= t0;
      const g = GRAD[gi % 8]!;
      return t0 * t0 * (g[0]! * x + g[1]! * y);
    };
    const n0 = corner(x0, y0, this.perm[ii + this.perm[jj]!]!);
    const n1 = corner(x1, y1, this.perm[ii + i1 + this.perm[jj + j1]!]!);
    const n2 = corner(x2, y2, this.perm[ii + 1 + this.perm[jj + 1]!]!);
    return 70 * (n0 + n1 + n2);
  }

  fbm(x: number, y: number, octaves: number): number {
    let amp = 1,
      freq = 1,
      sum = 0,
      norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }
}
