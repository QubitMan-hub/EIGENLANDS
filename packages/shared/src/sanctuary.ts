import { townsFor, type Town } from './town';
/** A settlement's ward includes its streets, gardens and a three-tile boundary. Coordinate planes stay separate. */
export function sanctuaryAt(seed: number, x: number, y: number): Town | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return townsFor(seed).find(t => x >= t.x0 - 3 && x <= t.x1 + 4 && y >= t.y0 - 3 && y <= t.y1 + 4) ?? null;
}
