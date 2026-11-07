import type { PlayerSim } from './sim';
/**
 * Frontal defence only. dir points along the incoming blow, towards the defender.
 *
 * Holding guard blocks; letting it go opens a short parry window (`parryT`), so a parry is timed by the release.
 * A bare guard covers about 70° either side of facing, cannot hold an unblockable (weight 3) blow, and costs stamina.
 * A shield in the off hand (`p.shield`, 0..1) covers a wider arc, can hold even an unblockable blow (not parry it),
 * costs less stamina per blow, and takes more of the damage (`blockedShare`).
 */
export function defend(p: PlayerSim, weight: number, dirX: number, dirY: number): 'hit' | 'parry' | 'block' | 'break' {
  const length = Math.hypot(dirX, dirY);
  const s = Math.max(0, Math.min(1, p.shield ?? 0));
  const cone = 0.35 - 0.3 * s;
  if (
    (p.guard <= 0 && p.parryT <= 0) ||
    p.dashT > 0 ||
    !length ||
    (weight >= 3 && s <= 0) ||
    -(p.faceX * dirX + p.faceY * dirY) / length < cone
  )
    return 'hit';
  const parrying = p.parryT > 0 && weight < 3;
  const cost = (parrying ? 12 : 18 + Math.max(0, weight) * 8) * (1 - 0.4 * s);
  if (p.stamina < cost) {
    p.stamina = 0;
    p.guard = -1;
    p.parryT = 0;
    p.guardCd = 1.1;
    p.atkBuf = 0;
    p.charge = 0;
    p.atkCd = Math.max(p.atkCd, 0.6);
    p.staminaT = 1.5;
    return 'break';
  }
  p.stamina -= cost;
  p.staminaT = 1;
  if (parrying) {
    p.parryT = 0;
    p.slipT = 0.9;
    return 'parry';
  }
  return 'block';
}

/** The share of a blocked blow's damage that still lands: a quarter through a bare guard, a tenth behind a full shield. */
export const blockedShare = (p: PlayerSim): number => 0.25 - 0.15 * Math.max(0, Math.min(1, p.shield ?? 0));
