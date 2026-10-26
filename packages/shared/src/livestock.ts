import { FARM_ANIMALS } from './objects';
/** Catalog-independent husbandry: the parallel item expansion may replace product IDs here. */
export const LIVESTOCK = {
  chicken: { name: 'Chicken', shelter: 'coop', product: 'egg', price: 160, growth: 2, interval: 1 },
  cow: { name: 'Cow', shelter: 'barn', product: 'milk', price: 520, growth: 3, interval: 1 },
  sheep: { name: 'Sheep', shelter: 'barn', product: 'wool', price: 380, growth: 3, interval: 2 },
  goat: { name: 'Goat', shelter: 'barn', product: 'goat_milk', price: 420, growth: 3, interval: 1 },
  pig: { name: 'Pig', shelter: 'barn', product: 'truffle', price: 460, growth: 3, interval: 2 },
  horse: { name: 'Horse', shelter: 'barn', product: 'fertilizer', price: 900, growth: 5, interval: 2 },
  phasehart: { name: 'Glimmerhart', shelter: 'barn', product: 'qubit_crystal', price: 2400, growth: 6, interval: 4 },
} as const;
export type LivestockSpecies = keyof typeof LIVESTOCK;
export interface FarmAnimal {
  id: number;
  species: LivestockSpecies;
  born: number;
  happy: number;
  bred: number;
}
export interface HerdData extends Record<string, unknown> {
  animals: number;
  fed: boolean;
  ready: number;
  herd: FarmAnimal[];
  stock: Record<string, number>;
  lastDay: number;
  cared: number;
  serial: number;
}
export const HERD_CAPACITY = 4;
const bounded = (v: unknown, fallback: number, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : fallback;
export const isLivestock = (v: unknown): v is LivestockSpecies => typeof v === 'string' && Object.hasOwn(LIVESTOCK, v);
export function shelterAccepts(species: LivestockSpecies, shelter: string): boolean {
  return (shelter === 'barn' && species !== 'chicken') || FARM_ANIMALS[shelter]?.animal === species;
}

/** Old count-only saves become adult individuals, preserving uncollected products. */
export function readHerd(raw: Record<string, unknown> | undefined, shelter: string, day: number): HerdData {
  const r = raw ?? {},
    base = (FARM_ANIMALS[shelter]?.animal ?? 'cow') as LivestockSpecies;
  const herd: FarmAnimal[] = Array.isArray(r.herd)
    ? r.herd.slice(0, HERD_CAPACITY).flatMap((a) =>
        a && isLivestock(a.species) && shelterAccepts(a.species, shelter)
          ? [
              {
                id: bounded(a.id, 0, 0, 1e9),
                species: a.species,
                born: bounded(a.born, day - 8, -1e9, day),
                happy: bounded(a.happy, 60, 0, 100),
                bred: bounded(a.bred, -1e9, -1e9, day),
              },
            ]
          : [],
      )
    : Array.from({ length: bounded(r.animals, 0, 0, HERD_CAPACITY) }, (_, id) => ({
        id,
        species: base as LivestockSpecies,
        born: day - 8,
        happy: 60,
        bred: -1e9,
      }));
  const stock: Record<string, number> = {};
  if (r.stock && typeof r.stock === 'object')
    for (const product of new Set(Object.values(LIVESTOCK).map((s) => s.product))) {
      const n = bounded((r.stock as Record<string, unknown>)[product], 0, 0, 99);
      if (n) stock[product] = n;
    }
  else stock[LIVESTOCK[base].product] = bounded(r.ready, 0, 0, 99);
  return {
    animals: herd.length,
    fed: r.fed === true,
    ready: Object.values(stock).reduce((a, b) => a + b, 0),
    herd,
    stock,
    lastDay: bounded(r.lastDay, day, -1e9, 1e9),
    cared: bounded(r.cared, -1e9, -1e9, day),
    serial: Math.max(bounded(r.serial, herd.length, 0, 1e9), ...herd.map((a) => a.id + 1)),
  };
}
/** Food covers one dawn only; offline time cannot invent feed or unlimited income. */
export function advanceHerd(data: HerdData, day: number): HerdData {
  if (day <= data.lastDay) return data;
  const d: HerdData = {
    ...data,
    herd: data.herd.map((a) => ({ ...a })),
    stock: { ...data.stock },
    lastDay: day,
    fed: false,
  };
  const elapsed = Math.min(28, day - data.lastDay);
  for (const a of d.herd) {
    const s = LIVESTOCK[a.species];
    a.happy = Math.max(0, Math.min(100, a.happy + (data.fed ? 8 : -12)));
    if (
      data.fed &&
      a.happy >= 40 &&
      data.lastDay + 1 - a.born >= s.growth &&
      (data.lastDay + 1 - a.born) % s.interval === 0
    )
      d.stock[s.product] = Math.min(99, (d.stock[s.product] ?? 0) + 1);
    a.happy = Math.max(0, a.happy - 12 * (elapsed - 1));
  }
  d.ready = Object.values(d.stock).reduce((a, b) => a + b, 0);
  return d;
}
export function breedHerd(data: HerdData, species: LivestockSpecies, day: number): HerdData | null {
  if (!data.fed || data.herd.length >= HERD_CAPACITY) return null;
  const pair = data.herd
    .filter(
      (a) => a.species === species && day - a.born >= LIVESTOCK[species].growth && a.happy >= 70 && day - a.bred >= 4,
    )
    .slice(0, 2);
  if (pair.length < 2) return null;
  return {
    ...data,
    animals: data.herd.length + 1,
    serial: data.serial + 1,
    herd: [
      ...data.herd.map((a) => (pair.includes(a) ? { ...a, bred: day, happy: a.happy - 10 } : { ...a })),
      { id: data.serial, species, born: day, happy: 60, bred: day },
    ],
  };
}
