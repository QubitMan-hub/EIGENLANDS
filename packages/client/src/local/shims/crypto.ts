/**
 * `node:crypto` for the single-player build: synchronous SHA-256 / HMAC-SHA256 (the server signs session tokens and
 * shard tickets synchronously), secure random bytes and UUIDs from Web Crypto, and a constant-time compare.
 */
import { Buffer } from './buffer';

type Data = string | Uint8Array;
const te = new TextEncoder();

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

/** One-shot SHA-256. */
export function sha256(msg: Uint8Array): Uint8Array {
  const len = msg.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(msg);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(len / 0x20000000), false);
  dv.setUint32(padded.length - 4, (len << 3) >>> 0, false);
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!,
        b = w[i - 2]!;
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let a = h[0]!,
      b = h[1]!,
      c = h[2]!,
      d = h[3]!,
      e = h[4]!,
      f = h[5]!,
      g = h[6]!,
      hh = h[7]!;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
    h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0;
    h[7] = (h[7]! + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]!, false);
  return out;
}

const toBytes = (d: Data, enc?: string): Uint8Array =>
  typeof d === 'string' ? (enc ? Buffer.from(d, enc) : te.encode(d)) : d;
const concat = (parts: Uint8Array[]): Uint8Array => Buffer.concat(parts);

function checkAlg(alg: string): void {
  if (alg.toLowerCase().replace('-', '') !== 'sha256')
    throw new Error(`Digest method not supported in the browser build: ${alg}`);
}

class Hash {
  private parts: Uint8Array[] = [];
  constructor(alg: string) {
    checkAlg(alg);
  }
  update(d: Data, enc?: string): this {
    this.parts.push(toBytes(d, enc));
    return this;
  }
  digest(): Buffer;
  digest(enc: string): string;
  digest(enc?: string): Buffer | string {
    const b = Buffer.from(sha256(concat(this.parts)));
    return enc ? b.toString(enc) : b;
  }
}

class Hmac {
  private parts: Uint8Array[] = [];
  private key: Uint8Array;
  constructor(alg: string, key: Data) {
    checkAlg(alg);
    let k = toBytes(key);
    if (k.length > 64) k = sha256(k);
    this.key = new Uint8Array(64);
    this.key.set(k);
  }
  update(d: Data, enc?: string): this {
    this.parts.push(toBytes(d, enc));
    return this;
  }
  digest(): Buffer;
  digest(enc: string): string;
  digest(enc?: string): Buffer | string {
    const ipad = this.key.map((x) => x ^ 0x36),
      opad = this.key.map((x) => x ^ 0x5c);
    const inner = sha256(concat([ipad, ...this.parts]));
    const b = Buffer.from(sha256(concat([opad, inner])));
    return enc ? b.toString(enc) : b;
  }
}

export const createHash = (alg: string): Hash => new Hash(alg);
export const createHmac = (alg: string, key: Data): Hmac => new Hmac(alg, key);

export function randomBytes(n: number): Buffer {
  const b = new Buffer(n);
  for (let i = 0; i < n; i += 65536) globalThis.crypto.getRandomValues(b.subarray(i, Math.min(n, i + 65536)));
  return b;
}

export function randomUUID(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function randomInt(min: number, max?: number): number {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  const range = max - min;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / range) * range;
  do globalThis.crypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return min + (buf[0]! % range);
}

/** Same contract as Node: throws when the lengths differ, otherwise compares in constant time. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) throw new RangeError('Input buffers must have the same byte length');
  let d = 0;
  for (let i = 0; i < a.byteLength; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

export const webcrypto = globalThis.crypto;
export const getRandomValues = <T extends ArrayBufferView>(a: T): T =>
  globalThis.crypto.getRandomValues(a as unknown as Uint8Array) as unknown as T;

export default {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  randomInt,
  timingSafeEqual,
  webcrypto,
  getRandomValues,
};
