/**
 * Project-Zomboid-style isometric buildings for Hadamere, rendered procedurally in world space.
 *
 * Walls are thin slabs on the OUTER half of the perimeter tiles, height WALL_H px. They are rasterised analytically
 * (each pixel inverse-projected onto the top / south / east face of an axis-aligned box) so every surface is textured
 * in world coordinates: plaster with timber framing, stone courses, painted siding, windows with shutters and sills,
 * door frames. Each wall TILE becomes its own sprite so it y-sorts correctly against people walking around it.
 *
 *  - back walls (north row + west column): always drawn; you see their inner faces when the roof is lifted
 *  - front walls (south "face" row + east column): full height, plus a CUT variant (8px stub) used while the
 *    player is inside, and a NIGHT variant whose window glass glows
 *  - roof: one sprite (gabled, overhanging eaves, fascia, gable end with an attic window, chimney), faded away
 *    while the player is inside or standing behind the building
 *  - a soft ground shadow cast to the lower right, and a hanging shop sign
 */
import { Texture } from 'pixi.js';
import type { Building } from '@eigenlands/shared';
import { hash2 } from '@eigenlands/shared';
import { bigTextC, bigTextWidth, C, makeCanvas, outline, put, rampAt, type Ctx, type Ramp } from './shade';

export const WALL_H = 44;
const CUT_H = 8;
const T = 0.5;          // wall thickness in tiles (outer half of the perimeter tiles)

export interface WallPiece {
  tx: number; ty: number;
  front: boolean;
  /** sprite top-left in iso art pixels */
  x: number; y: number;
  day: Texture; night: Texture; cut: Texture | null;
  door: boolean;
}
export interface BuildingArt {
  walls: WallPiece[];
  roof: { tex: Texture; x: number; y: number };
  shadow: { tex: Texture; x: number; y: number };
  sign: { tex: Texture; x: number; y: number; tx: number; ty: number } | null;
  /** chimney top in iso art pixels (smoke origin) */
  chimney: { x: number; y: number } | null;
  /** window light positions in tile space (outside, at the glass) */
  windows: Array<{ x: number; y: number }>;
}

const tex = (canvas: HTMLCanvasElement): Texture => { const t = Texture.from(canvas); t.source.scaleMode = 'nearest'; return t; };

interface Style { wall: Ramp; timber: Ramp | null; kind: 'plaster' | 'stone' | 'siding'; shutter: Ramp | null; roof: Ramp; roofKind: 'thatch' | 'slate' | 'tile' | 'shingle'; trim: number }
const STYLES: Style[] = [
  { wall: [C.e4, C.e5, C.e6, C.e7, C.white], timber: [C.e0, C.e1, C.e2, C.e3], kind: 'plaster', shutter: [C.g1, C.g2, C.g3, C.g4], roof: [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6], roofKind: 'thatch', trim: C.e1 },
  { wall: [C.slate, C.steel, C.mist, C.fog, C.pale], timber: null, kind: 'stone', shutter: null, roof: [C.ink, C.night, C.slate, C.steel, C.mist], roofKind: 'slate', trim: C.night },
  { wall: [C.w1, C.w2, C.w3, C.w4, C.w5], timber: null, kind: 'siding', shutter: [C.white, C.pale, C.white, C.white], roof: [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5], roofKind: 'tile', trim: C.pale },
  { wall: [C.g3, C.g4, C.g5, C.g6, C.g7], timber: [C.e0, C.e1, C.e2, C.e3], kind: 'plaster', shutter: [C.r1, C.r2, C.r3, C.r4], roof: [C.e0, C.e1, C.e2, C.e3, C.e4], roofKind: 'shingle', trim: C.e1 },
];
const GRANITE: Ramp = [C.night, C.slate, C.steel, C.mist, C.fog];
const GLASS_DAY: Ramp = [C.w1, C.w2, C.w3, C.w5, C.w6];
const GLASS_NIGHT: Ramp = [C.r4, C.r5, C.r6, C.r7, C.r7];
const BRICK: Ramp = [C.r0, C.r1, C.r2, C.r3];

type Face = 'top' | 'south' | 'east';
/** material callback: palette index, -1 transparent, or GLASS + ramp index (night-swappable) */
type Mat = (face: Face, x: number, y: number, z: number) => number;
const GLASS = 1000;

interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; mat: Mat }

/** Rasterise boxes (painter's order) into a canvas whose top-left is iso pixel (left, top). Returns glass pixels. */
function drawBoxes(ctx: Ctx, w: number, h: number, left: number, top: number, boxes: Box[], glass: Array<[number, number, number]>): void {
  for (const b of boxes) {
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const P = (px + 0.5 + left) / 16;          // x - y
      const sy = py + 0.5 + top;
      let c = -2;
      // top face
      {
        const Q = (sy + b.z1) / 8, x = (Q + P) / 2, y = (Q - P) / 2;
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) c = b.mat('top', x, y, b.z1);
      }
      if (c === -2) { const x = P + b.y1, z = (x + b.y1) * 8 - sy; if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) c = b.mat('south', x, b.y1, z); }
      if (c === -2) { const y = b.x1 - P, z = (b.x1 + y) * 8 - sy; if (y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1) c = b.mat('east', b.x1, y, z); }
      if (c < 0) continue;
      if (c >= GLASS) { glass.push([px, py, c - GLASS]); c = GLASS_DAY[c - GLASS]!; }
      put(ctx, px, py, c);
    }
  }
}

function wallMat(b: Building, st: Style, seed: number, interior: boolean, capC: number): Mat {
  const x1 = b.x + b.w, y1 = b.y + b.h;
  const winTile = (face: Face, x: number, y: number): boolean => {
    if (face === 'south') {
      const tx = Math.floor(x - 1e-6);
      if (!interior && (Math.abs(tx - b.doorX) <= 1 || tx <= b.x || tx >= x1 - 1)) return false;
      if (interior && (tx <= b.x || tx >= x1 - 1)) return false;
      return (tx - b.x) % 2 === 1 || (interior && (tx - b.x) % 3 === 1);
    }
    const ty = Math.floor(y - 1e-6);
    if (ty <= b.y || ty >= y1 - 1) return false;
    return (ty - b.y) % 2 === 1;
  };
  return (face, x, y, z) => {
    const lightOff = face === 'top' ? 0.18 : face === 'south' ? 0.1 : -0.3;
    if (face === 'top') return capC;
    const u = face === 'south' ? x : y;               // along the face, tiles
    const fu = u - Math.floor(u);
    const upx = u * 16;                               // along the face, px
    const ix = Math.floor(upx), iz = Math.floor(z);
    // foundation course
    if (z < 6) {
      const brick = Math.floor((upx + (iz < 3 ? 0 : 5)) / 10);
      if (iz === 2 || Math.floor(upx + (iz < 3 ? 0 : 5)) % 10 === 0) return C.night;
      return rampAt(GRANITE, 0.55 + lightOff + (hash2(seed, brick, iz < 3 ? 0 : 1, 3) - 0.5) * 0.3, ix, iz);
    }
    // windows
    if (winTile(face, x, y) && z >= 15 && z < 33) {
      const inU = fu >= 0.28 && fu <= 0.72, inZ = z >= 17 && z < 31;
      if (inU && inZ) {
        const frame = fu < 0.34 || fu > 0.66 || z < 18 || z >= 30 || Math.abs(fu - 0.5) < 0.03 || Math.abs(z - 24) < 0.6;
        if (frame) return st.kind === 'siding' ? C.pale : (st.timber ? st.timber[1]! : C.night);
        const refl = ((ix + iz) % 9) < 2;
        const gi = refl ? 4 : z > 25 ? 3 : z > 21 ? 2 : 1;
        return GLASS + Math.max(0, Math.min(4, gi + (face === 'east' ? -1 : 0)));
      }
      if (z < 17 && z >= 15 && fu > 0.24 && fu < 0.76) return z < 16 ? C.night : (st.kind === 'siding' ? C.white : C.fog);  // sill
      if (st.shutter && inZ && ((fu > 0.14 && fu < 0.28) || (fu > 0.72 && fu < 0.86))) {
        return (iz % 3 === 0) ? st.shutter[0]! : rampAt(st.shutter, 0.6 + lightOff, ix, iz);
      }
    }
    // corner quoins / posts at the building corners
    const atCorner = (face === 'south' && (x < b.x + 0.12 || x > x1 - 0.12)) || (face === 'east' && (y < b.y + 0.12 || y > y1 - 0.12));
    if (st.kind === 'stone') {
      const row = Math.floor((z - 6) / 6);
      const off = row % 2 ? 6 : 0;
      if (Math.floor(z - 6) % 6 === 5 || Math.floor(upx + off) % 12 === 0) return C.steel;
      const blk = Math.floor((upx + off) / 12);
      return rampAt(st.wall, 0.55 + lightOff + (hash2(seed, blk, row, 4) - 0.5) * 0.35 + (Math.floor(z - 6) % 6 === 0 ? 0.15 : 0), ix, iz);
    }
    if (st.kind === 'siding') {
      if (atCorner) return rampAt([C.mist, C.fog, C.pale, C.white], 0.7 + lightOff, ix, iz);
      if (z >= WALL_H - 3) return C.white;
      const bz = Math.floor(z - 6) % 5;
      if (bz === 4) return st.wall[0]!;
      return rampAt(st.wall, 0.5 + lightOff + (bz === 0 ? 0.18 : 0) + (hash2(seed, Math.floor(upx / 22), Math.floor((z - 6) / 5), 5) - 0.5) * 0.12, ix, iz);
    }
    // plaster + timber framing
    const tim = st.timber!;
    const post = fu < 0.07 || fu > 0.93 || atCorner;
    const beam = (z >= 6 && z < 8) || z >= WALL_H - 3 || (z >= 34 && z < 36);
    const brace = !winTile(face, x, y) && z >= 8 && z < 34 && Math.abs((fu - 0.08) * 16 * 1.6 - (z - 8)) < 1.4 && !(face === 'south' && Math.floor(x) === b.doorX);
    if (post || beam || brace) return rampAt(tim, 0.55 + lightOff + (post && fu < 0.07 ? 0.15 : 0), ix, iz);
    const n = hash2(seed, ix >> 1, iz >> 1, 6);
    return rampAt(st.wall, 0.6 + lightOff + (n - 0.5) * 0.12 - (z > 30 ? 0.05 : 0), ix, iz);
  };
}

/** Roof surfaces: height field of a gabled roof with overhangs, plus a chimney. */
function buildRoof(b: Building, st: Style, seed: number): { canvas: HTMLCanvasElement; left: number; top: number; chimney: { x: number; y: number } | null; windows: Array<{ x: number; y: number }> } {
  const o = 0.4;
  const X0 = b.x - o, X1 = b.x + b.w + o, Y0 = b.y - o, Y1 = b.y + b.h + o;
  const alongX = b.w >= b.h;
  const span = alongX ? b.h / 2 + o : b.w / 2 + o;
  const rise = Math.min(span * 11, 40);
  const zE = WALL_H, zR = zE + rise;
  const mid = alongX ? b.y + b.h / 2 : b.x + b.w / 2;
  const roofZ = (x: number, y: number) => zE + rise * (1 - Math.abs((alongX ? y : x) - mid) / span);
  const inFoot = (x: number, y: number) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
  const inWalls = (x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const big = b.kind === 'hall' || b.kind === 'inn' || b.kind === 'smithy' || b.kind === 'farmhouse' || b.kind === 'house';
  const ch = big ? { x0: alongX ? b.x + b.w * 0.7 : mid + 0.2, y0: alongX ? mid - 0.9 : b.y + b.h * 0.3, s: 0.75 } : null;
  const chTop = zR + 8;
  const L = Math.floor((X0 - Y1) * 16) - 2, R = Math.ceil((X1 - Y0) * 16) + 2;
  const top = Math.floor((X0 + Y0) * 8 - chTop) - 3, bot = Math.ceil((X1 + Y1) * 8 - zE) + 6;
  const w = R - L, h = bot - top;
  const { canvas, ctx } = makeCanvas(w, h);
  const R0 = st.roof;
  const windows: Array<{ x: number; y: number }> = [];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const P = (px + 0.5 + L) / 16, sy = py + 0.5 + top;
    for (let z = chTop; z >= zE - 4; z -= 0.5) {
      const Q = (sy + z) / 8, x = (Q + P) / 2, y = (Q - P) / 2;
      // chimney (a brick box poking through the roof)
      if (ch && x >= ch.x0 && x <= ch.x0 + ch.s && y >= ch.y0 && y <= ch.y0 + ch.s && z <= chTop && z >= zE) {
        const fx = x - ch.x0, fy = y - ch.y0;
        const isTop = z > chTop - 0.6;
        const face = isTop ? 'top' : (ch.s - fy) < (ch.s - fx) ? 'south' : 'east';
        let c: number;
        if (isTop) c = (fx > 0.15 && fx < ch.s - 0.15 && fy > 0.15 && fy < ch.s - 0.15) ? C.ink : C.mist;
        else {
          const u = (face === 'south' ? x : y) * 16, row = Math.floor((chTop - z) / 3);
          c = (Math.floor(chTop - z) % 3 === 2 || Math.floor(u + (row % 2) * 3) % 6 === 0) ? C.r0 : rampAt(BRICK, (face === 'south' ? 0.75 : 0.35) + (hash2(seed, Math.floor((u + (row % 2) * 3) / 6), row, 8) - 0.5) * 0.3, px, py);
          if (z > chTop - 3) c = face === 'south' ? C.mist : C.steel;
        }
        put(ctx, px, py, c);
        break;
      }
      if (!inFoot(x, y)) continue;
      const rz = roofZ(x, y);
      if (z > rz) continue;
      const slab = z >= rz - 3;
      if (slab) {
        const edge = z < rz - 0.75;   // fascia/barge board (the slab's thickness)
        if (edge) { put(ctx, px, py, (alongX ? (y > mid ? st.trim : C.night) : (x > mid ? st.trim : C.night))); break; }
        // roof surface: courses run along the ridge
        const along = alongX ? x : y, down = Math.abs((alongX ? y : x) - mid);
        const side = (alongX ? y : x) > mid ? 1 : -1;      // +1 = south/east slope (faces the camera)
        const lit = alongX ? (side > 0 ? 0.18 : -0.02) : (side > 0 ? -0.25 : 0.12);
        const dpx = down * 16, apx = along * 16;
        let t = 0.55 + lit;
        let c: number;
        if (Math.abs(down) < 0.12) { c = rampAt(R0, 0.85 + lit, px, py); put(ctx, px, py, c); break; }   // ridge cap
        if (st.roofKind === 'thatch') {
          const strand = hash2(seed, Math.floor(apx), Math.floor(dpx / 2), 9);
          const course = Math.floor(dpx) % 7;
          t += (strand - 0.5) * 0.35 + (course === 0 ? -0.3 : course < 2 ? 0.12 : 0);
        } else {
          const rowH = st.roofKind === 'slate' ? 4 : st.roofKind === 'tile' ? 5 : 4;
          const row = Math.floor(dpx / rowH);
          const len = st.roofKind === 'tile' ? 5 : st.roofKind === 'slate' ? 9 : 6;
          const off = (row % 2) * (len / 2);
          const k = Math.floor((apx + off) / len);
          const fr = (apx + off) - k * len, fz = dpx - row * rowH;
          if (fz < 1) t -= 0.35;                                 // course shadow line
          else if (st.roofKind === 'tile') t += Math.cos((fr / len) * Math.PI * 2) * 0.22 + (fz > rowH - 1.5 ? 0.12 : 0);
          else { if (fr < 1) t -= 0.25; t += (hash2(seed, k, row, 10) - 0.5) * 0.3 + (fz > rowH - 1.5 ? 0.1 : 0); }
          if (st.roofKind === 'shingle' && hash2(seed, k, row, 11) > 0.93) t -= 0.25;   // the odd mossy shingle
        }
        // eave darkening: the lowest course reads as an overhang
        if (dpx > span * 16 - 3) t -= 0.18;
        c = rampAt(R0, t, px, py);
        put(ctx, px, py, c);
        break;
      }
      // below the slab: the gable wall (only the part above the walls, inside the wall footprint)
      if (z >= zE && inWalls(x, y)) {
        const gableFace = alongX ? (x > b.x + b.w - 0.05 ? 'east' : null) : (y > b.y + b.h - 0.05 ? 'south' : null);
        if (!gableFace) continue;
        const u = gableFace === 'east' ? y : x;
        const cu = alongX ? mid : mid;
        const zMid = zE + rise * 0.35;
        const win = Math.abs(u - cu) < 0.32 && Math.abs(z - zMid) < 5;
        let c: number;
        if (win) {
          const r = Math.hypot((u - cu) * 16, (z - zMid)) ;
          c = r > 4.2 ? C.night : (r < 1 || Math.abs((u - cu) * 16) < 0.5 || Math.abs(z - zMid) < 0.5) ? C.night : (z > zMid ? C.w5 : C.w3);
        } else if (STYLES[b.style % 4]!.kind === 'stone') c = rampAt(STYLES[1]!.wall, gableFace === 'east' ? 0.35 : 0.65, px, py);
        else {
          const boards = Math.floor(u * 16 / 3);
          c = Math.floor(u * 16) % 3 === 0 ? C.e1 : rampAt([C.e1, C.e2, C.e3, C.e4], (gableFace === 'east' ? 0.35 : 0.7) + (hash2(seed, boards, 0, 12) - 0.5) * 0.25, px, py);
        }
        put(ctx, px, py, c);
        break;
      }
    }
  }
  outline(ctx, w, h, C.ink);
  if (ch) windows.push();
  const chimney = ch ? { x: (ch.x0 + ch.s / 2 - (ch.y0 + ch.s / 2)) * 16, y: (ch.x0 + ch.y0 + ch.s) * 8 - chTop } : null;
  return { canvas, left: L, top, chimney, windows };
}

const SIGN: Record<string, { text: string; icon: (ctx: Ctx, x: number, y: number) => void; board: Ramp }> = {
  smithy: { text: 'SMITH', board: [C.e0, C.e1, C.e2, C.e3], icon: (c, x, y) => { put(c, x, y + 2, C.fog, 9, 2); put(c, x + 2, y + 4, C.mist, 4, 2); put(c, x + 1, y + 6, C.mist, 6, 1); put(c, x - 1, y + 2, C.fog, 2, 1); } },
  store: { text: 'SHOP', board: [C.g0, C.g1, C.g2, C.g3], icon: (c, x, y) => { put(c, x + 1, y + 2, C.e5, 7, 5); put(c, x + 2, y + 1, C.e4, 5, 1); put(c, x + 3, y, C.e2, 3, 1); put(c, x + 3, y + 4, C.e7, 3, 1); } },
  inn: { text: 'INN', board: [C.r0, C.r1, C.r2, C.r3], icon: (c, x, y) => { put(c, x + 1, y + 1, C.r6, 6, 6); put(c, x + 1, y, C.white, 6, 2); put(c, x + 7, y + 2, C.r5, 2, 1); put(c, x + 8, y + 3, C.r5, 1, 2); put(c, x + 7, y + 5, C.r5, 2, 1); } },
  hall: { text: 'HALL', board: [C.w0, C.w1, C.w2, C.w3], icon: (c, x, y) => { put(c, x + 3, y, C.r6, 3, 1); put(c, x + 2, y + 1, C.r6, 5, 4); put(c, x + 1, y + 5, C.r5, 7, 1); put(c, x + 4, y + 6, C.r4, 1, 1); } },
  farmhouse: { text: 'FARM', board: [C.e1, C.e2, C.e3, C.e4], icon: (c, x, y) => { put(c, x + 4, y, C.g5, 1, 6); put(c, x + 2, y + 1, C.g4, 2, 2); put(c, x + 5, y + 2, C.g4, 2, 2); put(c, x + 3, y + 6, C.e5, 3, 1); } },
};

function signTexture(kind: string): HTMLCanvasElement | null {
  const s = SIGN[kind];
  if (!s) return null;
  const tw = bigTextWidth(s.text);
  const bw = tw + 18, bh = 13;
  const { canvas, ctx } = makeCanvas(bw + 4, bh + 8);
  // bracket + chains
  put(ctx, 0, 1, C.night, bw + 4, 2); put(ctx, 0, 1, C.slate, bw + 4, 1);
  put(ctx, 3, 3, C.slate, 1, 3); put(ctx, bw, 3, C.slate, 1, 3);
  for (let y = 6; y < 6 + bh; y++) for (let x = 1; x < bw + 3; x++) {
    const edge = y === 6 || y === 5 + bh || x === 1 || x === bw + 2;
    put(ctx, x, y, edge ? C.ink : rampAt(s.board, 0.85 - (y - 6) / 18, x, y));
  }
  put(ctx, 2, 7, s.board[3]!, bw, 1);
  s.icon(ctx, 4, 9);
  bigTextC(ctx, s.text, 14 + tw / 2 + 0.5, 9, C.e7, C.ink);
  return canvas;
}

/** Build every texture for one building (call lazily; ~tens of ms). */
export function buildBuildingArt(b: Building): BuildingArt {
  const seed = b.x * 31 + b.y * 17;
  const st = STYLES[b.style % 4]!;
  const x1 = b.x + b.w, y1 = b.y + b.h;
  const walls: WallPiece[] = [];
  const windows: Array<{ x: number; y: number }> = [];
  const outerMat = wallMat(b, st, seed, false, st.timber ? st.timber[1]! : C.slate);
  const innerMat = wallMat(b, st, seed, true, st.timber ? st.timber[1]! : C.slate);
  const cutMat: Mat = (face, x, y, z) => (face === 'top' ? C.fog : outerMat(face, x, y, z));
  const ring: Array<[number, number]> = [];
  for (let tx = b.x; tx < x1; tx++) { ring.push([tx, b.y]); ring.push([tx, y1 - 1]); }
  for (let ty = b.y + 1; ty < y1 - 1; ty++) { ring.push([b.x, ty]); ring.push([x1 - 1, ty]); }
  for (const [tx, ty] of ring) {
    const south = ty === y1 - 1, east = tx === x1 - 1, north = ty === b.y, west = tx === b.x;
    const front = south || east;
    const door = south && tx === b.doorX;
    const boxes = (zTop: number, mat: Mat, inner: Mat): Box[] => {
      const out: Box[] = [];
      // back strips first (painter's order: far to near)
      if (north && !east) out.push({ x0: tx, x1: tx + 1, y0: ty, y1: ty + T, z0: 0, z1: WALL_H, mat: inner });
      if (west && !south) out.push({ x0: tx, x1: tx + T, y0: north ? ty + T : ty, y1: ty + 1, z0: 0, z1: WALL_H, mat: inner });
      if (north && east) out.push({ x0: tx, x1: tx + 1 - T, y0: ty, y1: ty + T, z0: 0, z1: WALL_H, mat: inner });
      if (west && south) out.push({ x0: tx, x1: tx + T, y0: ty, y1: ty + 1 - T, z0: 0, z1: WALL_H, mat: inner });
      if (east) out.push({ x0: tx + 1 - T, x1: tx + 1, y0: ty, y1: south ? ty + 1 - T : ty + 1, z0: 0, z1: zTop, mat });
      if (south) {
        if (door) {
          out.push({ x0: tx, x1: tx + 0.12, y0: ty + 1 - T, y1: ty + 1, z0: 0, z1: zTop, mat });
          out.push({ x0: tx + 0.88, x1: tx + 1, y0: ty + 1 - T, y1: ty + 1, z0: 0, z1: zTop, mat });
          if (zTop > 34) out.push({ x0: tx, x1: tx + 1, y0: ty + 1 - T, y1: ty + 1, z0: 34, z1: zTop, mat: (f, x, y, z) => (f === 'top' ? mat(f, x, y, z) : z < 36 ? C.e1 : z > zTop - 2 ? C.e2 : rampAt([C.e1, C.e2, C.e3, C.e4], 0.6, Math.floor(x * 16), Math.floor(z))) });
          out.push({ x0: tx + 0.12, x1: tx + 0.88, y0: ty + 1 - T, y1: ty + 1, z0: 0, z1: 1.5, mat: (f) => (f === 'top' ? C.fog : C.steel) });
        } else out.push({ x0: tx, x1: east ? tx + 1 - T : tx + 1, y0: ty + 1 - T, y1: ty + 1, z0: 0, z1: zTop, mat });
        if (east) out.push({ x0: tx + 1 - T, x1: tx + 1, y0: ty + 1 - T, y1: ty + 1, z0: 0, z1: zTop, mat });
      }
      return out;
    };
    const left = (tx - ty - 1) * 16, top = (tx + ty) * 8 - WALL_H - 2;
    const W = 32, H = 16 + WALL_H + 3;
    const render = (zTop: number, mat: Mat, night: boolean) => {
      const { canvas, ctx } = makeCanvas(W, H);
      const glass: Array<[number, number, number]> = [];
      drawBoxes(ctx, W, H, left, top, boxes(zTop, mat, innerMat), glass);
      if (night) for (const [px, py, gi] of glass) put(ctx, px, py, GLASS_NIGHT[gi]!);
      return { canvas, glass };
    };
    const dayR = render(WALL_H, outerMat, false);
    const nightR = render(WALL_H, outerMat, true);
    const cut = front ? tex(render(CUT_H, cutMat, false).canvas) : null;
    walls.push({ tx, ty, front, x: left, y: top, day: tex(dayR.canvas), night: tex(nightR.canvas), cut, door });
    // outside window lights on the front faces
    if (front && dayR.glass.length > 8) windows.push({ x: south ? tx + 0.5 : tx + 1.3, y: south ? ty + 1.3 : ty + 0.5 });
  }

  // roof
  const rf = buildRoof(b, st, seed);
  const chimney = rf.chimney;

  // ground shadow: footprint smeared to the lower right (light from the top-left)
  const sx0 = (b.x - y1) * 16 - 2, sx1 = (x1 + 2.2 - b.y) * 16 + 2, sy0 = (b.x + b.y) * 8 - 2, sy1 = (x1 + 2.2 + y1 + 0.6) * 8 + 2;
  const sw = Math.ceil(sx1 - sx0), shh = Math.ceil(sy1 - sy0);
  const sc = makeCanvas(sw, shh);
  for (let py = 0; py < shh; py++) for (let px = 0; px < sw; px++) {
    const P = (px + 0.5 + sx0) / 16, Q = (py + 0.5 + sy0) / 8;
    const x = (Q + P) / 2, y = (Q - P) / 2;
    // inside the union of the footprint swept along (+2.2, +0.6)
    let hit = false;
    for (let k = 0; k <= 1 && !hit; k += 0.1) { const dx = 2.2 * k, dy = 0.6 * k; if (x >= b.x + dx && x <= x1 + dx && y >= b.y + dy && y <= y1 + dy) hit = true; }
    if (hit && !(x >= b.x && x <= x1 && y >= b.y && y <= y1)) put(sc.ctx, px, py, C.q0);
  }
  const sign = signTexture(b.kind);
  return {
    walls,
    roof: { tex: tex(rf.canvas), x: rf.left, y: rf.top },
    shadow: { tex: tex(sc.canvas), x: sx0, y: sy0 },
    sign: sign ? { tex: tex(sign), x: (b.doorX + 1.35 - (y1 + 0.15)) * 16 - 2, y: (b.doorX + 1.35 + y1 + 0.15) * 8 - 38, tx: b.doorX + 1.4, ty: y1 + 0.2 } : null,
    chimney,
    windows,
  };
}
