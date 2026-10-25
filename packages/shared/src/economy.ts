import { ITEMS } from './items';

/** Dynamic NPC-shop prices driven by supply: sell a lot of one thing and its price drops, then recovers. */
export const SUPPLY_CAP = 40;
export const SUPPLY_DECAY_PER_HOUR = 0.06;

export type Supply = Record<string, number>;

export function demandMultiplier(supply: number): number {
  const f = Math.min(1, Math.max(0, supply / SUPPLY_CAP));
  return 1.2 - 0.7 * f; // 1.2x when scarce, 0.5x when saturated
}

/** What the shop pays you for one. */
export function sellPrice(itemId: string, supply: number, quality = 1): number {
  const base = ITEMS[itemId]?.value ?? 0;
  return Math.max(1, Math.floor(base * 0.5 * demandMultiplier(supply) * quality));
}

/** What the shop charges you for one (shops mark up their own stock; markup 1 = base value). */
export function buyPrice(itemId: string, markup = 1): number {
  return Math.max(1, Math.ceil((ITEMS[itemId]?.value ?? 0) * markup));
}

export function decaySupply(supply: Supply, hours: number): Supply {
  const out: Supply = {};
  const k = Math.pow(1 - SUPPLY_DECAY_PER_HOUR, hours);
  for (const [id, v] of Object.entries(supply)) {
    const n = v * k;
    if (n > 0.05) out[id] = n;
  }
  return out;
}
