/**
 * A small, exact state-vector quantum simulator (up to 12 qubits = 4096 amplitudes).
 * Qubit q is bit q of the basis index. Used by the Circuit Board on both client (preview) and server (casting).
 */

export const MAX_QUBITS = 12;

export class QState {
  readonly n: number;
  re: Float64Array;
  im: Float64Array;

  constructor(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > MAX_QUBITS) throw new Error(`bad qubit count ${n}`);
    this.n = n;
    this.re = new Float64Array(1 << n);
    this.im = new Float64Array(1 << n);
    this.re[0] = 1;
  }

  clone(): QState {
    const s = new QState(this.n);
    s.re.set(this.re); s.im.set(this.im);
    return s;
  }

  get size(): number { return this.re.length; }

  /** Apply a 2x2 unitary [[a,b],[c,d]] (complex, given as re/im pairs) to qubit q. */
  apply1(q: number, ar: number, ai: number, br: number, bi: number, cr: number, ci: number, dr: number, di: number): void {
    const bit = 1 << q, N = this.size, re = this.re, im = this.im;
    for (let i = 0; i < N; i++) {
      if (i & bit) continue;
      const j = i | bit;
      const x0r = re[i]!, x0i = im[i]!, x1r = re[j]!, x1i = im[j]!;
      re[i] = ar * x0r - ai * x0i + br * x1r - bi * x1i;
      im[i] = ar * x0i + ai * x0r + br * x1i + bi * x1r;
      re[j] = cr * x0r - ci * x0i + dr * x1r - di * x1i;
      im[j] = cr * x0i + ci * x0r + dr * x1i + di * x1r;
    }
  }

  h(q: number): void { const s = Math.SQRT1_2; this.apply1(q, s, 0, s, 0, s, 0, -s, 0); }
  x(q: number): void { this.apply1(q, 0, 0, 1, 0, 1, 0, 0, 0); }
  /** Phase gate diag(1, e^{iθ}) (Z = π, S = π/2, T = π/4). */
  phase(q: number, theta: number): void { this.apply1(q, 1, 0, 0, 0, 0, 0, Math.cos(theta), Math.sin(theta)); }
  z(q: number): void { this.phase(q, Math.PI); }
  s(q: number): void { this.phase(q, Math.PI / 2); }
  t(q: number): void { this.phase(q, Math.PI / 4); }

  /** CNOT: flip `target` where `control` is 1. */
  cx(control: number, target: number): void {
    if (control === target) throw new Error('cx needs two different qubits');
    const cb = 1 << control, tb = 1 << target, N = this.size, re = this.re, im = this.im;
    for (let i = 0; i < N; i++) {
      if (!(i & cb) || i & tb) continue;
      const j = i | tb;
      const r = re[i]!, m = im[i]!;
      re[i] = re[j]!; im[i] = im[j]!;
      re[j] = r; im[j] = m;
    }
  }

  /** Probability that qubit q reads 1. */
  prob1(q: number): number {
    const bit = 1 << q;
    let p = 0;
    for (let i = 0; i < this.size; i++) if (i & bit) p += this.re[i]! ** 2 + this.im[i]! ** 2;
    return Math.min(1, Math.max(0, p));
  }

  /** Projective measurement of qubit q onto `outcome` (renormalised). Returns the probability it had. */
  collapse(q: number, outcome: 0 | 1): number {
    const p1 = this.prob1(q);
    const p = outcome ? p1 : 1 - p1;
    const bit = 1 << q;
    if (p < 1e-12) {
      // impossible outcome (a stored lock that no longer fits the board): all weight is on the other
      // branch, so flipping the qubit prepares the requested outcome with the rest of the state intact
      this.x(q);
      return 0;
    }
    const k = 1 / Math.sqrt(p);
    for (let i = 0; i < this.size; i++) {
      if (((i & bit) !== 0) === !!outcome) { this.re[i] = this.re[i]! * k; this.im[i] = this.im[i]! * k; }
      else { this.re[i] = 0; this.im[i] = 0; }
    }
    return p;
  }

  /** Measure qubit q with a random number in [0,1). */
  measure(q: number, r: number): 0 | 1 {
    const out: 0 | 1 = r < this.prob1(q) ? 1 : 0;
    this.collapse(q, out);
    return out;
  }

  /** Born-rule probabilities of every basis state. */
  probabilities(): Float64Array {
    const p = new Float64Array(this.size);
    for (let i = 0; i < this.size; i++) p[i] = this.re[i]! ** 2 + this.im[i]! ** 2;
    return p;
  }

  /** Reduced density matrix of qubit q: [ρ00, ρ11, Re ρ10, Im ρ10] where ρ10 = Σ a(..1..) conj(a(..0..)). */
  reduced(q: number): { p0: number; p1: number; cRe: number; cIm: number } {
    const bit = 1 << q;
    let p0 = 0, p1 = 0, cRe = 0, cIm = 0;
    for (let i = 0; i < this.size; i++) {
      if (i & bit) continue;
      const j = i | bit;
      const ar = this.re[i]!, ai = this.im[i]!, br = this.re[j]!, bi = this.im[j]!;
      p0 += ar * ar + ai * ai;
      p1 += br * br + bi * bi;
      // b * conj(a)
      cRe += br * ar + bi * ai;
      cIm += bi * ar - br * ai;
    }
    return { p0, p1, cRe, cIm };
  }

  /** Bloch vector of qubit q (x, y, z), length 1 for an unentangled pure qubit, shorter when entangled. */
  bloch(q: number): { x: number; y: number; z: number } {
    const r = this.reduced(q);
    return { x: 2 * r.cRe, y: 2 * r.cIm, z: r.p0 - r.p1 };
  }

  norm(): number {
    let s = 0;
    for (let i = 0; i < this.size; i++) s += this.re[i]! ** 2 + this.im[i]! ** 2;
    return s;
  }
}

/** Cumulative distribution for fast sampling (binary search). */
export function cumulative(p: Float64Array): Float64Array {
  const c = new Float64Array(p.length);
  let s = 0;
  for (let i = 0; i < p.length; i++) { s += p[i]!; c[i] = s; }
  return c;
}

export function sampleIndex(cdf: Float64Array, r: number): number {
  const total = cdf[cdf.length - 1]!;
  const x = r * total;
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid]! > x) hi = mid; else lo = mid + 1;
  }
  // skip zero-probability states that share a cumulative value
  while (lo > 0 && cdf[lo]! === cdf[lo - 1]!) lo--;
  return lo;
}

/** Binomial coefficient (small n). */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/**
 * Logical error rate of a distance-d repetition code against independent bit flips with probability p
 * (majority vote fails when more than half the copies flip). d = 1 means no correction.
 */
export function repetitionError(p: number, d: number): number {
  if (d <= 1) return p;
  let e = 0;
  for (let j = Math.floor(d / 2) + 1; j <= d; j++) e += choose(d, j) * p ** j * (1 - p) ** (d - j);
  return e;
}

/** Format a complex amplitude for Expert View. */
export function fmtAmp(re: number, im: number): string {
  const r = (v: number) => (Math.abs(v) < 5e-4 ? '0' : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));
  if (Math.abs(im) < 5e-4) return r(re);
  if (Math.abs(re) < 5e-4) return `${r(im)}i`;
  return `(${r(re)}${im < 0 ? '−' : '+'}${r(Math.abs(im))}i)`;
}
