/**
 * Procedural pixel art for the Circuit Board: element glyphs (colour-blind friendly), crystal gate tiles,
 * ability medallions and Lumen, the light-sprite. Everything is drawn once into small canvases and cached
 * (as data URLs for the DOM and canvases for Pixi textures), so there are no asset files.
 */
import { ELEMENTS, GATES, PALETTE, type GateId } from '@eigenlands/shared';

export const hex = (i: number): string => PALETTE[i] ?? '#ff00ff';
export const pcol = (i: number): number => parseInt(hex(i).slice(1), 16);
/** Element (hue 0..7) -> CSS colour. */
export const elHex = (hue: number): string => hex(ELEMENTS[((hue % 8) + 8) % 8]!.color);
/** hue 8 is "physical" (crossbow bolts): steel-bronze */
export const elCol = (hue: number): number => (hue === 8 ? pcol(21) : pcol(ELEMENTS[((hue % 8) + 8) % 8]!.color));
export const elName = (hue: number): string => ELEMENTS[((hue % 8) + 8) % 8]!.name;
/** Text fallbacks for the element glyphs (Pixi labels, screen readers). */
export const EL_CHAR = ['▲', '✦', '☀', '❦', '❄', '≈', '◆', '✺'];

function rgb(h: string): [number, number, number] { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a: string, b: string, k: number): string {
  const x = rgb(a), y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i]! - v) * k)).join(',')})`;
}

type Bitmap = string[];
const OUTLINE = '#0b0c1a';

function canvas(w: number, hgt: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt;
  return { c, x: c.getContext('2d')! };
}

/** Stamp a bitmap at (ox, oy) in `color`, with a 1px dark outline around it. */
function stamp(x: CanvasRenderingContext2D, bm: Bitmap, ox: number, oy: number, color: string, outline: string | null = OUTLINE): void {
  const on = (r: number, c: number) => bm[r]?.[c] === '#';
  if (outline) {
    x.fillStyle = outline;
    for (let r = -1; r <= bm.length; r++) for (let c = -1; c <= (bm[0]?.length ?? 0); c++) {
      if (on(r, c)) continue;
      if (on(r - 1, c) || on(r + 1, c) || on(r, c - 1) || on(r, c + 1)) x.fillRect(ox + c, oy + r, 1, 1);
    }
  }
  x.fillStyle = color;
  bm.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '#') x.fillRect(ox + c, oy + r, 1, 1); });
}

// ───────────────────────── element glyphs ─────────────────────────

const EL_BM: Bitmap[] = [
  ['...#...', '...##..', '..###..', '.#####.', '.##.##.', '.#...#.', '..###..'], // Ember: flame
  ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'], // Spark: star
  ['#..#..#', '.#...#.', '..###..', '#.###.#', '..###..', '.#...#.', '#..#..#'], // Radiant: sun
  ['....###', '..#####', '.####.#', '.###.##', '.##.###', '.#.###.', '#......'], // Verdant: leaf
  ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#'], // Frost: flake
  ['.......', '.##...#', '#..#.#.', '....#..', '.##...#', '#..#.#.', '....#..'], // Tide: waves
  ['...#...', '..#.#..', '.#.#.#.', '#.###.#', '.#.#.#.', '..#.#..', '...#...'], // Void: rift
  ['.####..', '#....#.', '#.##..#', '#.#.#.#', '#..##.#', '.#....#', '..####.'], // Flux: swirl
];

const elCache = new Map<string, string>();
/** 9x9 pixel glyph for an element, in its colour (or `color`), as a data URL. */
export function elementIcon(hue: number, color?: string): string {
  const h = ((hue % 8) + 8) % 8;
  const key = `${h}:${color ?? ''}`;
  let u = elCache.get(key);
  if (u) return u;
  const { c, x } = canvas(9, 9);
  stamp(x, EL_BM[h]!, 1, 1, color ?? elHex(h));
  u = c.toDataURL();
  elCache.set(key, u);
  return u;
}

// ───────────────────────── gate crystals ─────────────────────────

function disc(n: number, r: number, fill: (dx: number, dy: number, ang: number) => boolean): Bitmap {
  const rows: string[] = [];
  const cc = (n - 1) / 2;
  for (let y = 0; y < n; y++) {
    let s = '';
    for (let xx = 0; xx < n; xx++) {
      const dx = xx - cc, dy = y - cc, d = Math.hypot(dx, dy);
      const ang = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2); // 0 at 12 o'clock, clockwise
      s += d <= r + 0.35 && (d >= r - 0.75 || fill(dx, dy, ang)) ? '#' : '.';
    }
    rows.push(s);
  }
  return rows;
}
const wedge = (span: number) => disc(9, 3.6, (_dx, _dy, a) => a <= span + 0.05);

const GATE_BM: Record<GateId, Bitmap> = {
  h: ['#.......#', '.#.....#.', '..#...#..', '...#.#...', '....#....', '....#....', '....#....', '....#....', '...###...'],
  x: ['..#....#.', '.###...#.', '..#....#.', '..#....#.', '..#....#.', '..#....#.', '..#....#.', '..#...###', '..#....#.'],
  t: wedge(Math.PI / 4),
  s: wedge(Math.PI / 2),
  z: wedge(Math.PI),
  cx: ['.........', '.###.....', '#...#....', '#..###...', '#..#.#..#', '.###..#.#', '...#...#.', '....###..', '.........'],
  m: ['...###...', '..#...#..', '..#...#..', '.#######.', '.#######.', '.###.###.', '.###.###.', '.#######.', '.#######.'],
};

const EXPERT_BM: Record<string, Bitmap> = {
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  '●': ['.###.', '#####', '#####', '#####', '.###.'],
  '⊕': ['..#####..', '.#..#..#.', '#...#...#', '#...#...#', '#########', '#...#...#', '#...#...#', '.#..#..#.', '..#####..'],
};

const gemCache = new Map<string, string>();
/**
 * A 16x16 crystal tile for gate `g`. `mode`: 'friendly' symbol, 'expert' circuit symbol, 'target' (the ⊕ end of a Link),
 * 'blank' (palette ghost). `dim` greys it out (none left).
 */
export function gateTile(g: GateId, mode: 'friendly' | 'expert' | 'target' | 'control' = 'friendly', dim = false): string {
  const key = `${g}:${mode}:${dim ? 1 : 0}`;
  let u = gemCache.get(key);
  if (u) return u;
  const base = dim ? '#484c6e' : hex(GATES[g].color);
  const { c, x } = canvas(16, 16);
  // octagon silhouette
  const inside = (px: number, py: number) => px >= 1 && px <= 14 && py >= 1 && py <= 14 && px + py >= 4 && (15 - px) + py >= 4 && px + (15 - py) >= 4 && (15 - px) + (15 - py) >= 4;
  for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
    if (!inside(px, py)) {
      if (inside(px + 1, py) || inside(px - 1, py) || inside(px, py + 1) || inside(px, py - 1)) { x.fillStyle = OUTLINE; x.fillRect(px, py, 1, 1); }
      continue;
    }
    const edge = !inside(px - 1, py) || !inside(px, py - 1) ? 'hi' : !inside(px + 1, py) || !inside(px, py + 1) ? 'lo' : '';
    const ring = !inside(px - 2, py) || !inside(px, py - 2) ? 'hi2' : !inside(px + 2, py) || !inside(px, py + 2) ? 'lo2' : '';
    let col: string;
    if (edge === 'hi') col = mix(base, '#ffffff', 0.55);
    else if (edge === 'lo') col = mix(base, '#000000', 0.55);
    else if (ring === 'hi2') col = mix(base, '#ffffff', 0.25);
    else if (ring === 'lo2') col = mix(base, '#000000', 0.3);
    else col = mix(mix(base, '#000000', 0.45), base, Math.max(0, Math.min(1, 1 - (px + py - 6) / 18))); // table: lit from the top-left
    x.fillStyle = col; x.fillRect(px, py, 1, 1);
  }
  // sparkle
  x.fillStyle = '#ffffff'; x.fillRect(4, 3, 1, 1); x.fillRect(3, 4, 1, 1);
  const ink = dim ? '#9a9ec0' : '#f4f4ff';
  if (mode === 'friendly') stamp(x, GATE_BM[g], 3, 3, ink);
  else {
    const sym = mode === 'target' ? '⊕' : mode === 'control' ? '●' : GATES[g].expert === 'CNOT' ? '●' : GATES[g].expert;
    const bm = EXPERT_BM[sym] ?? EXPERT_BM.H!;
    stamp(x, bm, Math.floor((16 - bm[0]!.length) / 2), Math.floor((16 - bm.length) / 2), ink);
  }
  u = c.toDataURL();
  gemCache.set(key, u);
  return u;
}

/** Rune socket art (an Error Correction rune): a small carved stone with a triple-dot "vote" mark. */
let runeUrl: { on: string; off: string } | null = null;
export function runeIcon(on: boolean): string {
  if (!runeUrl) {
    const draw = (lit: boolean) => {
      const { c, x } = canvas(10, 10);
      const bm = ['..######..', '.########.', '##########', '##########', '##########', '##########', '##########', '.########.', '..######..'];
      stamp(x, bm.slice(0, 9).map((r) => r.slice(0, 10)), 0, 0, lit ? '#2f8040' : '#2c2f4a', null);
      x.fillStyle = lit ? '#a9e07a' : '#484c6e';
      for (const [px, py] of [[2, 4], [4, 4], [6, 4], [4, 2], [4, 6]] as const) x.fillRect(px + (px === 4 ? 0 : 0), py, 2, 2);
      x.fillStyle = lit ? '#d4f2a0' : '#6d7194'; x.fillRect(2, 1, 2, 1);
      return c.toDataURL();
    };
    runeUrl = { on: draw(true), off: draw(false) };
  }
  return on ? runeUrl.on : runeUrl.off;
}

// ───────────────────────── Lumen ─────────────────────────

/**
 * Lumen, 16x16: a round light-sprite with two dark eyes and fluttering wings. `frame` 0..3 animates the wings,
 * `blink` closes the eyes. Returns the canvas (Pixi textures and DOM portraits both use it).
 */
export function drawLumen(frame: number, blink = false, mood: 'calm' | 'happy' = 'calm'): HTMLCanvasElement {
  const { c, x } = canvas(16, 16);
  const px = (xx: number, yy: number, col: string) => { x.fillStyle = col; x.fillRect(xx, yy, 1, 1); };
  const wingUp = frame % 4 < 2;
  // wings (behind the body)
  const wing = 'rgba(180,234,255,0.75)', wingEdge = 'rgba(90,240,208,0.9)';
  const W = wingUp
    ? [[2, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [2, 6], [3, 6], [4, 6], [2, 7], [3, 7], [4, 7]]
    : [[2, 8], [3, 8], [4, 8], [1, 9], [2, 9], [3, 9], [4, 9], [1, 10], [2, 10], [3, 10], [2, 11], [3, 11]];
  for (const [wx, wy] of W) { px(wx!, wy!, wing); px(15 - wx!, wy!, wing); }
  px(wingUp ? 1 : 1, wingUp ? 5 : 10, wingEdge); px(14, wingUp ? 5 : 10, wingEdge);
  // body: soft round glow
  for (let yy = 3; yy < 14; yy++) for (let xx = 3; xx < 13; xx++) {
    const d = Math.hypot(xx - 7.5, yy - 8.2);
    if (d > 4.6) continue;
    px(xx, yy, d > 3.8 ? '#5af0d0' : d > 2.6 ? '#b4eaff' : d > 1.4 ? '#e0f8ff' : '#ffffff');
  }
  // eyes + cheeks
  const eye = '#1a1c2e';
  if (blink) { px(6, 8, eye); px(9, 8, eye); }
  else { px(6, 7, eye); px(6, 8, eye); px(9, 7, eye); px(9, 8, eye); }
  if (mood === 'happy') { px(7, 10, eye); px(8, 10, eye); } else px(8, 10, '#7cd0ff');
  px(5, 9, '#ff9ae8'); px(10, 9, '#ff9ae8');
  // antenna spark
  px(7, 2, '#fff08a'); px(8, 1, '#ffffff');
  return c;
}

const lumenUrls = new Map<string, string>();
export function lumenUrl(frame: number, blink = false): string {
  const k = `${frame % 4}:${blink ? 1 : 0}`;
  let u = lumenUrls.get(k);
  if (!u) { u = drawLumen(frame, blink).toDataURL(); lumenUrls.set(k, u); }
  return u;
}
