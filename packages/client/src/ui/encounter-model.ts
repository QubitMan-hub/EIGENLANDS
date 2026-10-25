import { BOSS_BY_KIND } from '@eigenlands/shared';

export function healthReading(hp: number, max: number): { hp: number; max: number; percent: number } {
  max = Number.isFinite(max) ? Math.max(0, Math.round(max)) : 0;
  hp = Number.isFinite(hp) ? Math.max(0, Math.min(max, Math.round(hp))) : 0;
  return { hp, max, percent: max > 0 ? (hp / max) * 100 : 0 };
}
export interface Encounter {
  id: string;
  kind: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** remaining poise 0..100 and stance byte, when the server syncs them */
  poise?: number;
  st?: number;
}

/** Nearby encounter, preferring deliberate focus; never let a remote large boss mask a local one. */
export function selectBoss(
  candidates: Encounter[],
  me: { x: number; y: number } | null,
  target: string | null,
): Encounter | null {
  if (!me) return null;
  let best: Encounter | null = null,
    distance = Infinity;
  for (const b of candidates) {
    const d = Math.hypot(b.x - me.x, b.y - me.y);
    if (
      !BOSS_BY_KIND[b.kind] ||
      b.hp <= 0 ||
      !Number.isFinite(b.hp) ||
      !Number.isFinite(b.maxHp) ||
      b.maxHp <= 0 ||
      !Number.isFinite(d) ||
      d >= 40
    )
      continue;
    if (b.id === target) return b;
    if (d < distance || (d === distance && b.id < (best?.id ?? ''))) {
      best = b;
      distance = d;
    }
  }
  return best;
}
export function bossPhase(kind: number, hp: number, max: number): number {
  return 1 + (BOSS_BY_KIND[kind]?.phases.filter((p) => max > 0 && hp / max <= p).length ?? 0);
}
