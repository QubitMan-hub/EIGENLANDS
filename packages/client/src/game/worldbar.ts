/**
 * Compact world-space health bar for creatures: a thin isometric slab lying along the 2:1 axis, so it sits on the
 * ground grid like everything else. Colour says camp; elites get a gilt frame and one pip per modifier; armoured
 * creatures get a second, shorter slab for poise.
 */
import type { Graphics } from 'pixi.js';
import { PALETTE } from '@eigenlands/shared';
import type { Faction } from '../ui/enemy-model';

const pc = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);

/** palette indices: fill, lit edge */
export const FACTION_FILL: Record<Faction, [number, number]> = {
  hostile: [34, 36],
  neutral: [20, 22],
  passive: [11, 13],
  ally: [10, 14],
  elite: [35, 38],
};

const HALF = 8;

/** Parallelogram covering fraction `f` of the slab whose left end is at (x - HALF, y). Slope is exactly 1:2. */
function slab(g: Graphics, x: number, y: number, f: number, h: number, color: number, alpha = 1): void {
  const w = Math.max(0, Math.min(1, f)) * HALF * 2;
  if (w <= 0) return;
  const x0 = x - HALF,
    y0 = y - HALF / 2;
  g.poly([x0, y0, x0 + w, y0 + w / 2, x0 + w, y0 + w / 2 + h, x0, y0 + h]).fill({ color, alpha });
}

export interface WorldBar {
  /** screen y of the slab's centre above the creature */
  top: number;
  hp: number;
  trail: number;
  faction: Faction;
  /** number of elite modifiers (0..3) */
  pips: number;
  /** remaining poise 0..1 for armoured creatures, otherwise null */
  armor: number | null;
  staggered: boolean;
  /** seconds, drives the elite shimmer; 0 for reduced motion */
  t: number;
}

export function drawWorldBar(g: Graphics, b: WorldBar): void {
  const [fill, edge] = FACTION_FILL[b.faction];
  const frame = b.faction === 'elite' ? 38 : 1;
  // frame (one pixel larger than the fill on every side) and empty well
  slab(g, 0, b.top - 1, 1, 5, pc(frame));
  slab(g, 0, b.top, 1, 3, pc(0));
  // pale trail, then the fill with a lit top edge
  slab(g, 0, b.top, b.trail, 3, pc(6), 0.85);
  slab(g, 0, b.top, b.hp, 3, pc(fill));
  slab(g, 0, b.top, b.hp, 1, pc(edge));
  if (b.armor !== null) {
    slab(g, 0, b.top + 5, 1, 2, pc(1));
    slab(g, 0, b.top + 5, b.armor, 2, pc(b.staggered ? 38 : 5));
  }
  for (let i = 0; i < b.pips; i++) {
    const px = -3 + i * 3;
    const glint = b.t > 0 ? 0.6 + 0.4 * Math.sin(b.t * 5 + i) : 1;
    // a tiny diamond over the left end of the slab
    g.poly([px, b.top - 6, px + 1.5, b.top - 4.5, px, b.top - 3, px - 1.5, b.top - 4.5]).fill({
      color: pc(38),
      alpha: glint,
    });
  }
}
