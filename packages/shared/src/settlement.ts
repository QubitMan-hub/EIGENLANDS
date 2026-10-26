import type { ChunkStore } from './chunks';
import { isDoor, type BuildData } from './construction';
export type ResidentRole = 'gardener' | 'artisan' | 'warden';
export interface Resident {
  id: number;
  name: string;
  role: ResidentRole;
  x: number;
  y: number;
  happy: number;
}
export interface Charter {
  tier: number;
  bank: number;
  day: number;
  serial: number;
  residents: Resident[];
}
export const CHARTER_TIERS = ['Homestead', 'Hamlet', 'Village', 'Borough'];
export const RESIDENT_NAMES = ['Rowan', 'Sable', 'Elian', 'Nessa', 'Bram', 'Iris', 'Linden', 'Aster'];
export function readCharter(raw: unknown, day: number): Charter {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Charter>;
  const n = (v: unknown, f: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(hi, Math.floor(v))) : f;
  return {
    tier: n(r.tier, 0, 3),
    bank: n(r.bank, 0, 100000),
    day: n(r.day, day, 1e9),
    serial: n(r.serial, 0, 1e9),
    residents: Array.isArray(r.residents)
      ? r.residents.slice(0, 8).flatMap((a) =>
          a &&
          Number.isInteger(a.x) &&
          Number.isInteger(a.y) &&
          Math.abs(a.x) < 10000 &&
          Math.abs(a.y) < 10000 &&
          ['gardener', 'artisan', 'warden'].includes(a.role)
            ? [
                {
                  id: n(a.id, 0, 1e9),
                  name: String(a.name).slice(0, 24),
                  role: a.role,
                  x: a.x,
                  y: a.y,
                  happy: n(a.happy, 50, 100),
                },
              ]
            : [],
        )
      : [],
  };
}
export interface Home {
  valid: boolean;
  reason: string;
  cells: Array<[number, number]>;
}
/** Closed doors bound a room even when open. Flood is bounded, independent of visual roof cutaways. */
export function inspectHome(store: ChunkStore, owner: string, x: number, y: number): Home {
  const cells: Array<[number, number]> = [],
    seen = new Set<string>(),
    queue: Array<[number, number]> = [[x, y]];
  let door = false,
    light = false,
    table = false,
    bed = false;
  const fail = (reason: string): Home => ({ valid: false, reason, cells });
  for (let i = 0; i < queue.length; i++) {
    if (i >= 144) return fail('Room is too large or not enclosed (maximum 144 floor cells).');
    const [cx, cy] = queue[i]!,
      key = `${cx},${cy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const o = store.structureAt(cx, cy),
      d = o?.data as BuildData | undefined;
    if (o?.owner !== owner || !d?.floor || !d.roof) return fail('Every interior cell needs your floor and a roof.');
    cells.push([cx, cy]);
    const prop = store.objectAt(cx, cy);
    if (prop?.owner === owner) {
      bed ||= ['bed', 'double_bed', 'canopy_bed', 'hammock'].includes(prop.sub);
      light ||= /lamp|lantern|candle|fireplace|brazier/.test(prop.sub);
      table ||= /table|desk|workbench/.test(prop.sub);
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx!,
        ny = cy + dy!,
        adj = store.structureAt(nx, ny),
        ad = adj?.data as BuildData | undefined;
      if (adj?.owner === owner && ad?.wall) {
        door ||= isDoor(ad.wall);
        continue;
      }
      if (!seen.has(`${nx},${ny}`) && !queue.some((p) => p[0] === nx && p[1] === ny)) queue.push([nx, ny]);
    }
  }
  if (cells.length < 6) return fail('Provide at least six interior floor cells.');
  if (!door) return fail('Add a usable door to the room boundary.');
  if (!bed || !light || !table) return fail('Furnish this home with an owned bed, table or desk, and light.');
  return { valid: true, reason: 'Enclosed, roofed and furnished', cells };
}
