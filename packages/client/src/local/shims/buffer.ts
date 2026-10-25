/**
 * A small, dependency-free subset of Node's `Buffer` for the single-player build, where the server room runs in the
 * browser. Covers what the server code and @colyseus/schema's Encoder use: from/alloc/allocUnsafe/concat/byteLength
 * and toString/equals/copy with utf8, hex, base64, base64url, latin1 and ascii encodings.
 */
type Enc = 'utf8' | 'utf-8' | 'hex' | 'base64' | 'base64url' | 'latin1' | 'binary' | 'ascii';

const te = new TextEncoder();
const td = new TextDecoder();

function norm(enc: unknown): Enc {
  const e = String(enc ?? 'utf8').toLowerCase();
  if (
    e === 'utf8' ||
    e === 'utf-8' ||
    e === 'hex' ||
    e === 'base64' ||
    e === 'base64url' ||
    e === 'latin1' ||
    e === 'binary' ||
    e === 'ascii'
  )
    return e;
  throw new TypeError(`Unknown encoding: ${String(enc)}`);
}

function bytesOf(s: string, enc: Enc): Uint8Array {
  switch (enc) {
    case 'hex': {
      const n = s.length >> 1,
        out = new Uint8Array(n);
      let i = 0;
      for (; i < n; i++) {
        const v = parseInt(s.substr(i * 2, 2), 16);
        if (Number.isNaN(v)) break; // Node stops at the first invalid pair
        out[i] = v;
      }
      return out.subarray(0, i);
    }
    case 'base64':
    case 'base64url': {
      // lenient like Node: ignore invalid characters and padding, accept both alphabets
      let t = s
        .split('=')[0]!
        .replace(/[^A-Za-z0-9+/\-_]/g, '')
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      if (t.length % 4 === 1) t = t.slice(0, -1);
      while (t.length % 4) t += '=';
      const bin = atob(t);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    case 'latin1':
    case 'binary':
    case 'ascii': {
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
      return out;
    }
    default:
      return te.encode(s);
  }
}

function stringOf(b: Uint8Array, enc: Enc): string {
  switch (enc) {
    case 'hex': {
      let s = '';
      for (let i = 0; i < b.length; i++) s += (b[i]! < 16 ? '0' : '') + b[i]!.toString(16);
      return s;
    }
    case 'base64':
    case 'base64url': {
      let bin = '';
      for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
      const s = btoa(bin);
      return enc === 'base64' ? s : s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    case 'latin1':
    case 'binary': {
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return s;
    }
    case 'ascii': {
      let s = '';
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]! & 0x7f);
      return s;
    }
    default:
      return td.decode(b);
  }
}

export class Buffer extends Uint8Array {
  static poolSize = 8 * 1024;

  static from(value: unknown, encOrOffset?: unknown, length?: number): Buffer {
    if (typeof value === 'string') return Buffer.wrap(bytesOf(value, norm(encOrOffset)));
    if (
      value instanceof ArrayBuffer ||
      (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer)
    ) {
      const off = typeof encOrOffset === 'number' ? encOrOffset : 0;
      return new Buffer(value as ArrayBuffer, off, length ?? (value as ArrayBuffer).byteLength - off);
    }
    if (ArrayBuffer.isView(value)) {
      const src = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const b = new Buffer(src.length);
      b.set(src);
      return b;
    }
    if (Array.isArray(value)) {
      const b = new Buffer(value.length);
      for (let i = 0; i < value.length; i++) b[i] = Number(value[i]) & 0xff;
      return b;
    }
    if (
      value &&
      typeof value === 'object' &&
      (value as { type?: string }).type === 'Buffer' &&
      Array.isArray((value as { data?: unknown }).data)
    ) {
      return Buffer.from((value as { data: number[] }).data);
    }
    throw new TypeError('The first argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.');
  }

  private static wrap(u: Uint8Array): Buffer {
    return new Buffer(u.buffer as ArrayBuffer, u.byteOffset, u.byteLength);
  }

  static alloc(size: number, fill?: unknown, enc?: unknown): Buffer {
    const b = new Buffer(size);
    if (fill !== undefined && fill !== 0) b.fill(fill as number, 0, size, enc);
    return b;
  }

  static allocUnsafe(size: number): Buffer {
    return new Buffer(size);
  }
  static allocUnsafeSlow(size: number): Buffer {
    return new Buffer(size);
  }
  static isBuffer(v: unknown): v is Buffer {
    return v instanceof Buffer;
  }
  static isEncoding(e: unknown): boolean {
    try {
      norm(e);
      return true;
    } catch {
      return false;
    }
  }

  static byteLength(v: unknown, enc?: unknown): number {
    if (typeof v === 'string') return bytesOf(v, norm(enc)).length;
    if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return v.byteLength;
    throw new TypeError('The "string" argument must be a string, Buffer, or ArrayBuffer.');
  }

  static concat(list: readonly Uint8Array[], total?: number): Buffer {
    const n = total ?? list.reduce((a, b) => a + b.length, 0);
    const out = new Buffer(n);
    let o = 0;
    for (const b of list) {
      if (o >= n) break;
      const part = b.length > n - o ? b.subarray(0, n - o) : b;
      out.set(part, o);
      o += part.length;
    }
    return out;
  }

  static compare(a: Uint8Array, b: Uint8Array): number {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
    return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
  }

  // Node's fill also accepts strings and byte arrays (repeated as a pattern)
  override fill(value: unknown, start = 0, end = this.length, enc?: unknown): this {
    if (typeof start !== 'number') {
      enc = start;
      start = 0;
      end = this.length;
    }
    if (typeof value === 'number') return super.fill(value & 0xff, start, end);
    const pat =
      typeof value === 'string'
        ? bytesOf(value, norm(enc))
        : ArrayBuffer.isView(value)
          ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          : null;
    if (!pat || !pat.length) return super.fill(0, start, end);
    for (let i = start, j = 0; i < end; i++, j = (j + 1) % pat.length) this[i] = pat[j]!;
    return this;
  }

  override toString(enc?: unknown, start = 0, end = this.length): string {
    return stringOf(this.subarray(Math.max(0, start), Math.min(this.length, end)), norm(enc));
  }

  equals(other: Uint8Array): boolean {
    return Buffer.compare(this, other) === 0;
  }

  compare(other: Uint8Array): number {
    return Buffer.compare(this, other);
  }

  copy(target: Uint8Array, targetStart = 0, sourceStart = 0, sourceEnd = this.length): number {
    const n = Math.max(0, Math.min(sourceEnd, this.length) - sourceStart);
    const m = Math.min(n, target.length - targetStart);
    if (m <= 0) return 0;
    target.set(this.subarray(sourceStart, sourceStart + m), targetStart);
    return m;
  }

  write(s: string, offset = 0, length?: number, enc?: unknown): number {
    const b = bytesOf(s, norm(enc));
    const m = Math.min(b.length, length ?? this.length - offset, this.length - offset);
    this.set(b.subarray(0, m), offset);
    return m;
  }

  toJSON(): { type: 'Buffer'; data: number[] } {
    return { type: 'Buffer', data: Array.from(this) };
  }
}

/** Defines `globalThis.Buffer` (only if absent). @colyseus/schema's Encoder allocates its buffers with it. */
export function installBufferGlobal(): void {
  const g = globalThis as { Buffer?: unknown };
  if (typeof g.Buffer === 'undefined') g.Buffer = Buffer;
}

export default Buffer;
