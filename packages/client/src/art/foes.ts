import { Rectangle, Texture } from 'pixi.js';
import { blob, C, line, makeCanvas, put, slab, type Ctx, type Ramp } from './shade';

/**
 * Sprites for the combat-2.0 meadow foes (Phase Wisp, Decoherent Brute, Static Mite) and enemy orbs.
 * Procedural, palette-only, drawn once into one atlas. Frames: 0/1 idle-move, 2 windup, 3 active (cast/charge/lunge).
 */
export interface FoeSheets {
  wisp(night: boolean, frame: number): Texture;
  brute(night: boolean, frame: number): Texture;
  mite(night: boolean, frame: number): Texture;
  /** enemy orb (frame 0/1); reflected orb when `reflected` */
  orb(reflected: boolean, frame: number): Texture;
}

const WISP: Ramp = [C.q0, C.q1, C.q2, C.q3, C.q4, C.q5, C.q7];
const WISP_N: Ramp = [C.r0, C.q0, C.q1, C.q5, C.q6, C.r5, C.r7];
const BRUTE: Ramp = [C.night, C.slate, C.steel, C.mist, C.fog];
const BRUTE_N: Ramp = [C.ink, C.night, C.slate, C.steel, C.mist];
const MITE: Ramp = [C.e2, C.e4, C.e6, C.r6, C.r7];
const MITE_N: Ramp = [C.r1, C.r3, C.r5, C.q5, C.q6];

function drawWisp(ctx: Ctx, f: number, night: boolean): void {
  const ramp = night ? WISP_N : WISP;
  const bob = [0, -1, 0, 1][f]!;
  const flare = f === 2 ? 1.2 : f === 3 ? 0.6 : 0;
  // trailing tail
  for (let i = 0; i < 4; i++) put(ctx, 7 + ((i + f) % 2), 13 - i + bob, i < 2 ? ramp[2]! : ramp[3]!, 2 - (i >> 1), 1);
  blob(ctx, 8, 7 + bob, 4.4 + flare, 4.6 + flare, ramp, { seed: night ? 41 : 40, noise: 0.18, bright: 0.25, edgeDark: 0.25 });
  blob(ctx, 8, 6.4 + bob, 2.2 + flare * 0.6, 2.2 + flare * 0.6, ramp, { seed: 3, noise: 0, bright: 0.6, edgeDark: 0 });
  // orbiting phase motes
  const a = (f / 4) * Math.PI * 2;
  put(ctx, Math.round(8 + Math.cos(a) * 6.5), Math.round(7 + bob + Math.sin(a) * 2.5), night ? C.r7 : C.q7);
  put(ctx, Math.round(8 - Math.cos(a) * 6.5), Math.round(7 + bob - Math.sin(a) * 2.5), night ? C.r6 : C.w7);
  // eye: narrows while aiming
  if (f === 2) put(ctx, 6, 6 + bob, night ? C.r7 : C.white, 4, 1);
  else { put(ctx, 7, 5 + bob, C.ink, 2, 2); put(ctx, 7, 5 + bob, night ? C.r7 : C.white); }
}

function drawBrute(ctx: Ctx, f: number, night: boolean): void {
  const ramp = night ? BRUTE_N : BRUTE;
  const crack = night ? C.r5 : C.q5, crack2 = night ? C.r7 : C.q7;
  const crouch = f === 2 ? 3 : 0, lean = f === 3 ? 3 : 0, breathe = f === 1 ? 1 : 0;
  put(ctx, 4, 23, C.night, 16, 1);
  // legs
  slab(ctx, 6 + lean, 18, 4, 5, ramp, 11);
  slab(ctx, 14 + lean, 18, 4, 5, ramp, 12);
  // torso: big shaded mass, slightly offset "decoherent" slices
  blob(ctx, 12 + lean, 13 + crouch * 0.6, 8 + breathe * 0.3, 6.5 - crouch * 0.3, ramp, { seed: night ? 21 : 20, noise: 0.22, edgeDark: 0.35, shape: 2.6 });
  slab(ctx, 5 + lean + (f % 2), 10 + crouch, 4, 3, ramp, 31, 0.3);
  slab(ctx, 17 + lean - (f % 2), 12 + crouch, 3, 3, ramp, 32, 0.3);
  // head
  blob(ctx, 12 + lean * 1.4, 7 + crouch, 4, 3.4, ramp, { seed: 23, noise: 0.15, bright: 0.1 });
  // glowing fault lines
  line(ctx, 8 + lean, 11 + crouch, 12 + lean, 16 + crouch, crack);
  line(ctx, 12 + lean, 16 + crouch, 16 + lean, 12 + crouch, crack);
  put(ctx, 12 + lean, 14 + crouch, crack2);
  // eyes
  put(ctx, 10 + lean * 1.4, 6 + crouch, f >= 2 ? crack2 : crack, 2, 1);
  put(ctx, 13 + lean * 1.4, 6 + crouch, f >= 2 ? crack2 : crack, 2, 1);
  // fists
  blob(ctx, 4 + lean - crouch, 16 + crouch * 0.5, 2.4, 2.2, ramp, { seed: 24, noise: 0.1 });
  blob(ctx, 20 + lean + crouch, 16 + crouch * 0.5, 2.4, 2.2, ramp, { seed: 25, noise: 0.1 });
}

function drawMite(ctx: Ctx, f: number, night: boolean): void {
  const ramp = night ? MITE_N : MITE;
  const jx = [0, 1, 0, -1][f]!, hop = f === 3 ? 2 : 0;
  put(ctx, 5, 15, C.night, 6, 1);
  blob(ctx, 8 + jx, 11 - hop, 3, 2.4, ramp, { seed: night ? 51 : 50, noise: 0.2, bright: 0.2, edgeDark: 0.2 });
  // static spikes
  const sp = night ? C.q7 : C.e7;
  put(ctx, 8 + jx, 7 - hop - (f % 2), sp); put(ctx, 5 + jx - (f % 2), 9 - hop, sp); put(ctx, 11 + jx + (f % 2), 9 - hop, sp);
  // legs
  for (const lx of [5, 7, 9, 11]) put(ctx, lx + jx, 13 - hop + ((lx + f) % 2), C.ink);
  put(ctx, 7 + jx, 10 - hop, C.ink); put(ctx, 9 + jx, 10 - hop, C.ink);
  if (f === 2) { put(ctx, 7 + jx, 10 - hop, C.r7); put(ctx, 9 + jx, 10 - hop, C.r7); }
}

function drawOrb(ctx: Ctx, f: number, reflected: boolean): void {
  const ramp: Ramp = reflected ? [C.w2, C.w4, C.w6, C.q7, C.e7, C.white] : [C.r1, C.r2, C.q5, C.q6, C.r6, C.white];
  const r = f ? 4.2 : 3.6;
  blob(ctx, 8, 8, r + 1, r + 1, [ramp[0]!, ramp[1]!], { seed: 61, noise: 0.4, edgeDark: 0.6 });
  blob(ctx, 8, 8, r, r, ramp, { seed: 62, noise: 0.05, bright: 0.4, edgeDark: 0.05 });
  put(ctx, 7, 6, C.white, 2, 2);
}

export function buildFoeSheets(): FoeSheets {
  // rows: wisp d/n (16), mite d/n (16), orb (16, 4 cells: enemy 0/1, reflected 0/1), brute d/n (24)
  const { canvas, ctx } = makeCanvas(24 * 4, 16 * 5 + 24 * 2);
  const cell = (x: number, y: number, w: number, h: number, fn: () => void) => {
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip(); fn(); ctx.restore();
  };
  for (let f = 0; f < 4; f++) {
    for (const n of [0, 1]) {
      cell(f * 16, n * 16, 16, 16, () => drawWisp(ctx, f, n === 1));
      cell(f * 16, 32 + n * 16, 16, 16, () => drawMite(ctx, f, n === 1));
      cell(f * 24, 80 + n * 24, 24, 24, () => drawBrute(ctx, f, n === 1));
    }
    cell(f * 16, 64, 16, 16, () => drawOrb(ctx, f % 2, f >= 2));
  }
  const base = Texture.from(canvas);
  base.source.scaleMode = 'nearest';
  const cache = new Map<string, Texture>();
  const sub = (k: string, x: number, y: number, w: number, h: number) => {
    let t = cache.get(k);
    if (!t) { t = new Texture({ source: base.source, frame: new Rectangle(x, y, w, h) }); cache.set(k, t); }
    return t;
  };
  return {
    wisp: (n, f) => sub(`w${n}${f % 4}`, (f % 4) * 16, n ? 16 : 0, 16, 16),
    mite: (n, f) => sub(`m${n}${f % 4}`, (f % 4) * 16, 32 + (n ? 16 : 0), 16, 16),
    brute: (n, f) => sub(`b${n}${f % 4}`, (f % 4) * 24, 80 + (n ? 24 : 0), 24, 24),
    orb: (r, f) => sub(`o${r}${f % 2}`, ((r ? 2 : 0) + (f % 2)) * 16, 64, 16, 16),
  };
}
