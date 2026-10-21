/** Shared rhythm-minigame maths for forging and fishing. The server owns the schedule and verifies scores. */
export interface RhythmPlan { startAt: number; intervalMs: number; count: number; windowMs: number }

export const beatTimes = (p: RhythmPlan): number[] => Array.from({ length: p.count }, (_, i) => p.startAt + (i + 1) * p.intervalMs);

/**
 * Accuracy 0..1: each beat is matched to the nearest unused press within the window;
 * a perfect press scores 1, one at the window edge scores 0. Presses cannot be reused, so mashing does not help.
 */
export function scoreHits(beats: number[], hits: number[], windowMs: number): number {
  if (!beats.length) return 0;
  const used = new Set<number>();
  let total = 0;
  for (const b of beats) {
    let best = -1, bd = Infinity;
    hits.forEach((h, i) => { if (!used.has(i) && Math.abs(h - b) < bd) { bd = Math.abs(h - b); best = i; } });
    if (best >= 0 && bd <= windowMs) { used.add(best); const k = 1 - bd / windowMs; total += k * k * (3 - 2 * k); }
  }
  return total / beats.length;
}

/** Reject physically implausible or out-of-session presses. */
export function sanitizeHits(hits: unknown, plan: RhythmPlan, maxHits: number): number[] {
  if (!Array.isArray(hits)) return [];
  const lo = plan.startAt - 200, hi = plan.startAt + (plan.count + 1) * plan.intervalMs + 400;
  const out: number[] = [];
  for (const h of hits.slice(0, maxHits)) if (typeof h === 'number' && Number.isFinite(h) && h >= lo && h <= hi) out.push(h);
  out.sort((a, b) => a - b);
  // humans cannot press faster than ~90 ms apart
  return out.filter((h, i) => i === 0 || h - out[i - 1]! >= 90);
}
