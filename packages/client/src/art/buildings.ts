/** Procedural facades, roofs and hanging signs for Hadamere's buildings (styles 0-3). */
import { Texture } from 'pixi.js';
import type { Building } from '@eigenlands/shared';
import { hash2 } from '@eigenlands/shared';
import { blob, C, line, makeCanvas, poly, put, R, slab, lt, dk, type Ctx, type Ramp } from './shade';

export interface BuildingArt {
  /** wall pieces on the FACE row (left of the door, right of the door) and the lintel above the door */
  left: Texture | null;
  right: Texture | null;
  lintel: Texture;
  roof: Texture;
  roofAx: number;
  roofAy: number;
  /** window glows (tile-local pixel centres within the facade) for night lighting */
  windows: Array<{ x: number; y: number }>;
}

const tex = (canvas: HTMLCanvasElement): Texture => { const t = Texture.from(canvas); t.source.scaleMode = 'nearest'; return t; };

const WALL: Ramp[] = [
  [C.e3, C.e4, C.e5, C.e6, C.e7],          // 0 warm plaster
  [C.steel, C.mist, C.fog, C.pale, C.white], // 1 pale stone
  [C.w2, C.w3, C.w4, C.w5, C.w6],          // 2 blue-washed
  [C.g2, C.g3, C.g4, C.g5, C.g6],          // 3 sage
];
const TIMBER = [C.e0, C.e1, C.e2, C.e3];
const ROOF: Array<{ hi: Ramp; kind: 'thatch' | 'shingle' | 'tile' | 'slate' }> = [
  { hi: [C.e3, C.e4, C.e5, C.e6, C.e7], kind: 'thatch' },
  { hi: [C.slate, C.steel, C.mist, C.fog, C.pale], kind: 'slate' },
  { hi: [C.r1, C.r2, C.r3, C.r4, C.r5], kind: 'tile' },
  { hi: [C.w1, C.w2, C.w3, C.w4, C.w5], kind: 'shingle' },
];

const pickL = (r: Ramp, t: number, x: number, y: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(t * (r.length - 1) + ((x * 7 + y * 3) % 4) / 8)))]!;

function window16(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  put(ctx, x - 1, y - 1, TIMBER[1]!, w + 2, h + 2);
  put(ctx, x, y, C.w6, w, h);
  put(ctx, x, y, C.w7, w, 1); put(ctx, x + Math.floor(w / 2), y, TIMBER[1]!, 1, h); put(ctx, x, y + Math.floor(h / 2), TIMBER[1]!, w, 1);
  put(ctx, x - 1, y + h + 1, TIMBER[2]!, w + 2, 1);
}

function wallTile(ctx: Ctx, x0: number, w: number, style: number, seed: number): void {
  const ramp = WALL[style]!;
  for (let y = 0; y < 16; y++) for (let x = 0; x < w; x++) {
    const t = 0.55 + 0.28 * (1 - y / 16) - 0.06 * ((x + x0) % 16 < 2 ? 1 : 0) + (hash2(seed, x + x0, y, 3) - 0.5) * 0.18;
    put(ctx, x, y, pickL(ramp, t, x, y));
  }
  put(ctx, 0, 15, TIMBER[0]!, w, 1); put(ctx, 0, 14, TIMBER[1]!, w, 1);                // stone foundation lip
  if (style === 1) for (let y = 0; y < 14; y += 4) for (let x = (y / 4) % 2 ? 4 : 0; x < w; x += 8) put(ctx, x, y, ramp[1]!, 1, 4);
  else if (style === 0 || style === 3) for (let x = 0; x < w; x += 8) put(ctx, x, 0, TIMBER[2]!, 2, 14); // half-timbering posts
}

/** Build the facade/roof textures for one building. */
export function buildBuildingArt(b: Building): BuildingArt {
  const seed = b.x * 31 + b.y * 17;
  const doorCol = b.doorX - b.x;
  const leftW = doorCol * 16, rightW = (b.w - doorCol - 1) * 16;
  const win = (ctx: Ctx, off: number, w: number, out: Array<{ x: number; y: number }>) => {
    for (let x = 4; x + 8 < w; x += 16) {
      const gx = off + x;
      if (Math.abs(gx - doorCol * 16) < 16 && off === 0) continue;
      window16(ctx, x + 1, 3, 6, 6);
      out.push({ x: gx + 4, y: 6 });
    }
  };
  const windows: Array<{ x: number; y: number }> = [];
  let left: Texture | null = null, right: Texture | null = null;
  if (leftW > 0) {
    const { canvas, ctx } = makeCanvas(leftW, 16); wallTile(ctx, 0, leftW, b.style, seed); win(ctx, 0, leftW, windows);
    if (b.kind === 'store') { slab(ctx, 2, 10, leftW - 4, 3, [C.w2, C.w3, C.w4], 3, 0.1); for (let x = 2; x < leftW - 2; x += 4) put(ctx, x, 10, C.pale, 2, 3); }    // awning stripe
    if (b.kind === 'smithy') { put(ctx, leftW - 10, 4, C.steel, 6, 2); put(ctx, leftW - 8, 6, C.steel, 2, 6); }                                                            // anvil sign
    left = tex(canvas);
  }
  if (rightW > 0) {
    const { canvas, ctx } = makeCanvas(rightW, 16); wallTile(ctx, (doorCol + 1) * 16, rightW, b.style, seed); win(ctx, (doorCol + 1) * 16, rightW, windows);
    if (b.kind === 'store') { slab(ctx, 2, 10, rightW - 4, 3, [C.w2, C.w3, C.w4], 3, 0.1); for (let x = 2; x < rightW - 2; x += 4) put(ctx, x, 10, C.pale, 2, 3); }
    // hanging shop sign on a bracket next to the door
    if (b.kind !== 'house') {
      put(ctx, 1, 2, TIMBER[1]!, 8, 1);
      put(ctx, 2, 3, C.steel, 1, 2); put(ctx, 8, 3, C.steel, 1, 2);
      slab(ctx, 1, 5, 9, 8, [C.e1, C.e2, C.e3, C.e4], 5, 0.2); put(ctx, 1, 5, C.e5, 9, 1);
      const glyph = ({ store: () => { put(ctx, 4, 7, C.e6, 3, 4); put(ctx, 3, 7, C.e7, 5, 1); put(ctx, 5, 11, C.e1, 1, 1); }, inn: () => { put(ctx, 3, 7, C.pale, 5, 4); put(ctx, 8, 8, C.pale, 1, 2); put(ctx, 4, 7, C.e6, 3, 1); }, smithy: () => { put(ctx, 3, 7, C.fog, 6, 2); put(ctx, 5, 9, C.fog, 2, 2); put(ctx, 4, 11, C.fog, 4, 1); }, hall: () => { put(ctx, 5, 7, C.e6, 1, 5); put(ctx, 3, 7, C.e6, 5, 1); put(ctx, 4, 8, C.r4, 3, 2); }, farmhouse: () => { put(ctx, 3, 10, C.g5, 6, 1); put(ctx, 4, 8, C.g5, 1, 2); put(ctx, 7, 7, C.g5, 1, 3); put(ctx, 5, 7, C.e6, 1, 1); } } as Record<string, () => void>)[b.kind];
      glyph?.();
    }
    right = tex(canvas);
  }
  // lintel above the (cut-out) doorway: timber header with a little door-light
  const lt0 = makeCanvas(16, 16);
  wallTile(lt0.ctx, doorCol * 16, 16, b.style, seed);
  poly(lt0.ctx, [[3, 16], [3, 6], [5, 3], [11, 3], [13, 6], [13, 16]], (x, y) => (y >= 15 ? C.night : C.night)); // clear the opening
  // clear opening: erase pixels (transparent) so the floor tile shows through
  lt0.ctx.clearRect(3, 6, 10, 10); lt0.ctx.clearRect(5, 3, 6, 3);
  put(lt0.ctx, 2, 5, TIMBER[2]!, 12, 2); put(lt0.ctx, 2, 5, TIMBER[3]!, 12, 1);
  put(lt0.ctx, 2, 7, TIMBER[1]!, 1, 9); put(lt0.ctx, 13, 7, TIMBER[1]!, 1, 9);
  put(lt0.ctx, 3, 4, TIMBER[1]!, 10, 1);
  windows.push({ x: doorCol * 16 + 8, y: 8 });
  const lintel = tex(lt0.canvas);

  // ── roof: a gabled roof seen from the front, covering rows y..y+h-2 plus an eave over the facade
  const rw = b.w * 16 + 10, rh = (b.h - 1) * 16 + 12;
  const R0 = ROOF[b.style]!;
  const { canvas: rc, ctx: r } = makeCanvas(rw, rh);
  const ridgeY = Math.floor(rh * 0.38);
  for (let y = 0; y < rh - 5; y++) {
    const back = y < ridgeY;
    for (let x = 0; x < rw; x++) {
      let ci: number;
      const row = back ? y : y - ridgeY;
      switch (R0.kind) {
        case 'tile': ci = (((x + (row % 6 < 3 ? 0 : 4)) % 8) < 1 || row % 3 === 0) ? 0 : 1 + ((x >> 3) + row) % 3; break;
        case 'shingle': ci = (row % 4 === 0 || ((x + (Math.floor(row / 4) % 2) * 3) % 6) === 0) ? 0 : 1 + (hash2(seed, x >> 1, row >> 2, 5) > 0.5 ? 1 : 2); break;
        case 'slate': ci = (row % 5 === 0 || ((x + (Math.floor(row / 5) % 2) * 4) % 8) === 0) ? 0 : 1 + ((x >> 3) + (row >> 2)) % 3; break;
        default: ci = 1 + Math.floor(hash2(seed, x >> 1, row, 6) * 3); if (row % 5 === 0) ci = Math.max(0, ci - 1); break;
      }
      const shade = back ? -1 : 1;
      put(r, x, y, R0.hi[Math.min(4, Math.max(0, ci + shade))]!);
    }
  }
  put(r, 0, ridgeY - 2, dk(R0.hi[0]!), rw, 1); put(r, 0, ridgeY - 1, R0.hi[3]!, rw, 1); put(r, 0, ridgeY, R0.hi[4]!, rw, 1); put(r, 0, ridgeY + 1, R0.hi[1]!, rw, 1); // ridge cap
  for (let x = 0; x < rw; x += 6) put(r, x, ridgeY - 1, R0.hi[2]!, 3, 1);
  // eave shadow + fringe
  for (let x = 0; x < rw; x++) { put(r, x, rh - 5, R0.hi[0]!); put(r, x, rh - 4, dk(R0.hi[0]!)); put(r, x, rh - 3, C.night); }
  if (R0.kind === 'thatch') for (let x = 0; x < rw; x += 2) put(r, x, rh - 5 + (x % 4 === 0 ? 1 : 0), R0.hi[1]!);
  for (let y = 0; y < rh - 3; y++) { put(r, 0, y, dk(R0.hi[0]!)); put(r, 1, y, R0.hi[0]!); put(r, rw - 1, y, dk(R0.hi[0]!)); put(r, rw - 2, y, R0.hi[0]!); }
  put(r, 0, 0, dk(R0.hi[0]!), rw, 1); put(r, 0, 1, R0.hi[0]!, rw, 1);
  // chimney on the bigger buildings
  if (b.kind === 'hall' || b.kind === 'inn' || b.kind === 'smithy' || b.kind === 'farmhouse') {
    const cx = Math.floor(rw * 0.72);
    slab(r, cx, ridgeY - 9, 7, 12, R.stone, seed, 0.4); put(r, cx - 1, ridgeY - 10, C.slate, 9, 2); put(r, cx, ridgeY - 9, C.fog, 7, 1);
    for (let j = 0; j < 12; j += 3) put(r, cx, ridgeY - 8 + j, C.slate, 7, 1);
  }
  // little dormer for the hall
  if (b.kind === 'hall') { blob(r, rw / 2, ridgeY + 8, 6, 5, WALL[b.style]!, { seed, noise: 0.1 }); window16(r, rw / 2 - 3, ridgeY + 6, 6, 5); }
  return { left, right, lintel, roof: tex(rc), roofAx: 5, roofAy: rh - 3, windows };
}
