/**
 * Legendary boss frames. Every boss has its own silhouette, emblem, metal and rune colour, but they share one grammar:
 * an isometric emblem on the left cap, a name band, a bar window with phase gems on its top edge, and a status band.
 * The frame is pixel art on a canvas (fixed palette, whole-number scaling); text, the health fill and the status chips
 * stay in the DOM so they remain crisp, selectable and accessible.
 */
import { BOSSES, C, PALETTE, type BossDef, type BossId } from '@eigenlands/shared';
import { Iso } from '../art/isokit';
import { put as spx, rasterPixels, type Ctx } from '../art/shade';

/** Logical frame size (pixels of art) and the bar window inside it. */
export const BOSS_W = 224;
export const BOSS_H = 48;
export const WINDOW = { x: 36, y: 24, w: 176, h: 9 } as const;

export interface BossTheme {
  id: BossId;
  /** name treatment: the headline and a quieter title under or beside it */
  name: string;
  title: string;
  /** frame metal, dark → light */
  frame: readonly [number, number, number];
  /** inner panel */
  panel: number;
  /** rune glow and lit phase gems */
  accent: number;
  /** health fill: base, lit edge; trail colour */
  fill: readonly [number, number];
  trail: number;
}

const FILLS = (a: number, b: number) => [a, b] as const;

export const BOSS_THEMES: Record<BossId, BossTheme> = {
  slime_king: {
    id: 'slime_king',
    name: 'Gelatinous Sovereign',
    title: 'Lord of the Wobbling Deep',
    frame: [C.g1, C.g3, C.g5],
    panel: C.g0,
    accent: C.r6,
    fill: FILLS(C.g4, C.g6),
    trail: C.e6,
  },
  warden: {
    id: 'warden',
    name: 'Warden of the Grove',
    title: 'Keeper of the Antlered Silence',
    frame: [C.e1, C.e3, C.e5],
    panel: C.e0,
    accent: C.g6,
    fill: FILLS(C.g3, C.g5),
    trail: C.e6,
  },
  colossus: {
    id: 'colossus',
    name: 'Decoherent Colossus',
    title: 'The One in Many Places',
    frame: [C.q0, C.q2, C.q4],
    panel: C.q0,
    accent: C.q7,
    fill: FILLS(C.q3, C.q5),
    trail: C.q6,
  },
  bellkeeper: {
    id: 'bellkeeper',
    name: 'The Hollow Bellkeeper',
    title: 'Who Remembers Your Footsteps',
    frame: [C.e2, C.e4, C.r6],
    panel: C.night,
    accent: C.r6,
    fill: FILLS(C.r2, C.r4),
    trail: C.pale,
  },
  veyr: {
    id: 'veyr',
    name: 'Veyr',
    title: 'the Stormbound Colossus',
    frame: [C.slate, C.steel, C.w6],
    panel: C.night,
    accent: C.w7,
    fill: FILLS(C.w4, C.w7),
    trail: C.pale,
  },
};

const hex = (i: number) => PALETTE[i]!;
export const themeVars = (t: BossTheme): Record<string, string> => ({
  '--bb-fill': hex(t.fill[0]),
  '--bb-edge': hex(t.fill[1]),
  '--bb-trail': hex(t.trail),
  '--bb-accent': hex(t.accent),
});

export function themeFor(def: BossDef): BossTheme {
  return BOSS_THEMES[def.id];
}

/** Phase markers: where each new phase begins on the bar, and whether the boss has already passed it. */
export function phaseMarks(phases: readonly number[], frac: number): Array<{ at: number; reached: boolean }> {
  return phases.map((at) => ({ at, reached: frac <= at }));
}

// ───────────── silhouettes ─────────────

/** Is pixel (x,y) inside the frame outline for this boss? Each boss gets a different cut. */
function inside(id: BossId, x: number, y: number): boolean {
  const W = BOSS_W,
    H = BOSS_H;
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const cx = W / 2;
  switch (id) {
    case 'slime_king': {
      // jelly: rounded shoulders and a dripping lower edge
      const drip = (Math.floor(x / 6) % 3 === 1 ? 4 : Math.floor(x / 6) % 3 === 2 ? 1 : 0) + 3;
      if (y < 4 + (x < 6 || x > W - 7 ? 3 : 0)) return false;
      return y <= H - 1 - drip + 3;
    }
    case 'warden': {
      // a raised antler tab over the name
      const tab = Math.abs(x - cx) < 34 ? 0 : 5;
      return y >= tab && y < H - 2 && !((x < 3 || x > W - 4) && (y < 8 || y > H - 8));
    }
    case 'colossus': {
      // chamfered corners and two cut notches, like fractured stone
      const c = 7;
      if (x + y < c || W - 1 - x + y < c || x + (H - 1 - y) < c || W - 1 - x + (H - 1 - y) < c) return false;
      if (y < 3 && Math.abs(x - W / 3) < 3) return false;
      if (y > H - 4 && Math.abs(x - (2 * W) / 3) < 3) return false;
      return y >= 2 && y < H - 2;
    }
    case 'bellkeeper': {
      // a bell's arch over the emblem and name, square at the foot
      const r = 14;
      const dx = Math.min(x, W - 1 - x);
      if (y < r && dx < r) return (r - dx) * (r - dx) + (r - y) * (r - y) <= r * r;
      return y >= 1 && y < H - 3;
    }
    case 'veyr': {
      // lightning-cut flanks
      const zig = Math.abs((y % 10) - 5) * 0.8;
      return x >= zig && x < W - zig && y >= 3 && y < H - 3;
    }
  }
}

function emblem(ctx: Ctx, t: BossTheme): void {
  // 28×28 plate on the left cap; the origin is the plate's centre, near the ground line of the emblem
  const iso = new Iso(ctx, 18, 33);
  switch (t.id) {
    case 'slime_king': {
      iso.box(-6, -6, 0, 12, 12, 7, {
        top: (a, b) => (a < 0.2 || b < 0.2 ? C.g7 : C.g6),
        left: () => C.g5,
        right: () => C.g3,
      });
      for (const dx of [-5, 0, 5]) {
        iso.dot(dx / 2, -dx / 2, 7, C.r6, 2, 1);
        iso.dot(dx / 2, -dx / 2, 8, C.r7, 1, 4);
      }
      iso.dot(1, 1, 5, C.ink, 1, 2);
      iso.dot(-3, 3, 5, C.ink, 1, 2);
      break;
    }
    case 'warden': {
      iso.cyl(0, 0, 0, 5, 9, [C.e0, C.e1, C.e2, C.e3, C.e4], [C.e4, C.e5, C.e6]);
      for (const s of [-1, 1]) {
        iso.line3(0, 0, 11, s * 4, -s * 4, 17, C.e7);
        iso.line3(s * 4, -s * 4, 17, s * 6, -s * 6, 21, C.e6);
        iso.line3(s * 3, -s * 3, 15, s * 6, -s * 4, 17, C.e6);
      }
      iso.dot(0, 0, 9, C.g6, 3, 1);
      break;
    }
    case 'colossus': {
      for (const [u, v, h] of [
        [-5, 2, 16],
        [0, -2, 21],
        [5, 3, 13],
      ] as const)
        iso.box(u, v, 2, 3, 3, h, {
          top: () => C.q7,
          left: () => C.q5,
          right: () => C.q3,
        });
      iso.dot(0, 0, 0, C.q1, 11, 2);
      break;
    }
    case 'bellkeeper': {
      iso.cyl(0, 0, 0, 6, 4, [C.e2, C.e3, C.e4, C.e5], [C.e5, C.e6, C.r6]);
      iso.cyl(0, 0, 4, 4.5, 8, [C.e2, C.e3, C.e4, C.e5, C.e6], [C.e6, C.r6, C.r7]);
      iso.cyl(0, 0, 12, 2, 3, [C.e3, C.e4, C.e5], [C.r6, C.r7]);
      iso.dot(0, 0, 15, C.r7, 1, 1);
      iso.dot(0, 1, 1, C.ink, 2, 3);
      break;
    }
    case 'veyr': {
      iso.box(-4, -4, 0, 8, 8, 4, { top: () => C.w6, left: () => C.w4, right: () => C.w2 });
      const bolt: Array<[number, number]> = [
        [2, 22],
        [-1, 15],
        [2, 15],
        [-2, 7],
      ];
      for (let i = 0; i + 1 < bolt.length; i++) iso.line3(0, 0, bolt[i]![1], 0, 0, bolt[i + 1]![1], C.w7);
      iso.dot(0, 0, 15, C.white, 4, 1);
      iso.dot(0, 0, 22, C.white, 3, 1);
      iso.dot(0, 0, 9, C.w7, 3, 1);
      break;
    }
  }
}

export interface BossFrameState {
  /** hp fraction 0..1 */
  frac: number;
  phases: readonly number[];
  /** seconds; 0 keeps everything still */
  t: number;
}

export function renderBossFrame(ctx: Ctx, theme: BossTheme, s: BossFrameState): void {
  const [fd, fm, fl] = theme.frame;
  rasterPixels(ctx, BOSS_W, BOSS_H, () => {
    const put = (x: number, y: number, c: number, w = 1, h = 1) => {
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < BOSS_W && yy < BOSS_H) px(xx, yy, c);
    };
    const px = (x: number, y: number, c: number) => spx(ctx, x, y, c);
    // body: outline, metal ring with a lit top-left edge, dark panel
    for (let y = 0; y < BOSS_H; y++)
      for (let x = 0; x < BOSS_W; x++) {
        if (!inside(theme.id, x, y)) continue;
        let d = 3;
        for (let k = 1; k <= 3 && d === 3; k++)
          if (
            !inside(theme.id, x - k, y) ||
            !inside(theme.id, x + k, y) ||
            !inside(theme.id, x, y - k) ||
            !inside(theme.id, x, y + k)
          )
            d = k;
        if (d === 1) px(x, y, C.ink);
        else if (d === 2) px(x, y, !inside(theme.id, x - 2, y) || !inside(theme.id, x, y - 2) ? fl : fm);
        else if (d === 3 && (!inside(theme.id, x - 3, y) || !inside(theme.id, x, y - 3) || y > BOSS_H - 5))
          px(x, y, fd);
        else px(x, y, theme.panel);
      }
    // name band underline and bar window (a recessed well with a lit lower lip)
    put(WINDOW.x - 2, WINDOW.y - 2, C.ink, WINDOW.w + 4, WINDOW.h + 4);
    put(WINDOW.x - 1, WINDOW.y - 1, fd, WINDOW.w + 2, WINDOW.h + 2);
    put(WINDOW.x, WINDOW.y, C.ink, WINDOW.w, WINDOW.h);
    put(WINDOW.x - 1, WINDOW.y + WINDOW.h, fl, WINDOW.w + 2, 1);
    put(WINDOW.x, WINDOW.y - 8, fd, WINDOW.w, 1);
    // rivets at the four corners of the plate holding the emblem
    for (const [x, y] of [
      [6, 8],
      [29, 8],
      [6, 40],
      [29, 40],
    ] as const)
      put(x, y, fl);
    // emblem plate, then the emblem and glints over it
    put(4, 6, fd, 28, 36);
    put(5, 7, theme.panel, 26, 34);
    put(5, 7, fl, 26, 1);
    emblem(ctx, theme);
    // phase gems: isometric diamonds on the window's top edge, lit once the boss has passed them
    for (const m of phaseMarks(s.phases, s.frac)) {
      const gx = Math.round(WINDOW.x + m.at * WINDOW.w),
        gy = WINDOW.y - 4;
      const c = m.reached ? theme.accent : fd;
      put(gx, gy - 3, c);
      put(gx - 1, gy - 2, c, 3);
      put(gx - 2, gy - 1, c, 5);
      put(gx - 1, gy, c, 3);
      put(gx, gy + 1, c);
      put(gx, gy - 2, m.reached ? C.white : fm);
    }
    // rune studs set into the bottom of the frame; one glows at a time and the glow walks along, or all sit dim
    const studs = 22;
    const lit = s.t > 0 ? Math.floor(s.t * 3) % studs : -1;
    for (let i = 0; i < studs; i++) {
      const x = 40 + i * 8;
      const on = i === lit || i === (lit + 1) % studs;
      put(x, BOSS_H - 4, on ? theme.accent : fm, 2, 1);
      if (on) put(x, BOSS_H - 5, fd, 2, 1);
    }
  });
}

/** Split "Veyr, the Stormbound Colossus" style names; fall back to the theme's title. */
export function bossHeading(def: BossDef): { name: string; title: string } {
  const t = BOSS_THEMES[def.id];
  return { name: t.name, title: t.title };
}

export const BOSS_IDS = Object.keys(BOSSES) as BossId[];
