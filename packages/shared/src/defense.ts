import type { PlayerSim } from './sim';
/** Frontal defence only. dir points along the incoming blow, towards the defender. */
export function defend(p: PlayerSim, weight: number, dirX: number, dirY: number): 'hit' | 'parry' | 'block' | 'break' {
  const length = Math.hypot(dirX, dirY);
  if (p.guard <= 0 || p.dashT > 0 || !length || weight >= 3 || -(p.faceX * dirX + p.faceY * dirY) / length < 0.35)
    return 'hit';
  const cost = p.parryT > 0 ? 12 : 18 + Math.max(0, weight) * 8;
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
  if (p.parryT > 0) {
    p.parryT = 0;
    p.slipT = 0.9;
    return 'parry';
  }
  return 'block';
}
