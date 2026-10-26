import { CROP_ROWS } from './catalog/crop-data';
import { weatherForDay, waters, seasonOfDay } from './weather';

export interface CropDef {
  id: string;
  name: string;
  seasons: number[]; // 0 spring 1 summer 2 autumn 3 winter
  days: number; // watered days until ripe
  regrow: number; // 0 = single harvest, else watered days to ripen again
  yieldMin: number;
  yieldMax: number;
  xp: number;
  /** art hints */
  color: number; // palette index of the fruit
  shape: 'root' | 'leafy' | 'vine' | 'stalk' | 'bush';
}

const c = (
  id: string,
  name: string,
  seasons: number[],
  days: number,
  regrow: number,
  yMin: number,
  yMax: number,
  xp: number,
  color: number,
  shape: CropDef['shape'],
): CropDef => ({ id, name, seasons, days, regrow, yieldMin: yMin, yieldMax: yMax, xp, color, shape });

/** A season is 7 game days (2.8 real hours); crops ripen in a few game days of watering. */
export const CROPS: Record<string, CropDef> = Object.fromEntries(
  [
    c('turnip', 'Turnip', [0], 2, 0, 1, 2, 8, 31, 'root'),
    c('potato', 'Potato', [0], 3, 0, 1, 3, 10, 21, 'root'),
    c('strawberry', 'Strawberry', [0], 4, 2, 1, 2, 14, 36, 'bush'),
    c('green_bean', 'Green Bean', [0], 3, 2, 1, 2, 11, 13, 'vine'),
    c('tomato', 'Tomato', [1], 4, 2, 1, 2, 14, 35, 'vine'),
    c('melon', 'Melon', [1], 5, 0, 1, 1, 22, 12, 'vine'),
    c('corn', 'Corn', [1, 2], 6, 3, 1, 2, 16, 22, 'stalk'),
    c('blueberry', 'Blueberry', [1], 4, 2, 2, 4, 14, 27, 'bush'),
    c('pumpkin', 'Pumpkin', [2], 5, 0, 1, 1, 22, 20, 'vine'),
    c('cranberry', 'Cranberry', [2], 3, 2, 2, 3, 12, 36, 'bush'),
    c('yam', 'Yam', [2], 3, 0, 1, 3, 11, 44, 'root'),
    c('eggplant', 'Eggplant', [2], 3, 2, 1, 2, 13, 43, 'bush'),
    c('frostroot', 'Frostroot', [3], 3, 0, 1, 2, 15, 30, 'root'),
  ].map((d) => [d.id, d]),
);

// Catalog crops (grains, vegetables, orchards, spices ...) are data in catalog/crop-data.ts.
for (const row of CROP_ROWS) CROPS[row.def.id] = row.def;

export const STAGES = 4; // 0 seed, 1 sprout, 2 growing, 3 ripe

export interface CropData {
  crop: string;
  /** superposed seed: second crop */
  alt?: string;
  /** 'a' / 'b' tonic bias applied */
  bias?: 'a' | 'b';
  planted: number;
  growth: number;
  /** last world day the player watered it */
  watered: number;
  /** last world day processed by the day rollover */
  lastDay: number;
  /** fertiliser: true (old saves) or the days of growth it saves */
  fert?: boolean | number;
  /** extra harvest yield from fertiliser */
  yb?: number;
  dead?: boolean;
  owner: string;
}

export const cropSeasonOk = (crop: string, season: number, greenhouse = false): boolean =>
  greenhouse || (CROPS[crop]?.seasons.includes(season) ?? false);

/** Growth needed to ripen (superposed crops need the slower of the two). */
export function daysToRipe(d: CropData): number {
  const a = CROPS[d.crop]!.days,
    b = d.alt ? CROPS[d.alt]!.days : 0;
  return Math.max(a, b) - (d.fert === true ? 1 : Number(d.fert) || 0);
}

export function cropStage(d: CropData): number {
  if (d.growth >= daysToRipe(d)) return 3;
  const f = d.growth / Math.max(1, daysToRipe(d));
  return f < 0.34 ? 0 : f < 0.7 ? 1 : 2;
}

export const isRipe = (d: CropData): boolean => !d.dead && cropStage(d) === 3;

export interface DayContext {
  rain: boolean;
  sprinkler: boolean;
  greenhouse: boolean;
}

/** Day `day` has ended: credit growth if it was watered; wither if tomorrow's season is wrong. Pure. */
export function advanceDay(d: CropData, day: number, ctx: DayContext): CropData {
  if (d.dead || d.lastDay >= day) return d;
  const n = { ...d, lastDay: day };
  const wateredToday = d.watered === day || ctx.sprinkler || (ctx.rain && !ctx.greenhouse);
  if (wateredToday && !isRipe(d)) n.growth = d.growth + 1;
  const nextSeason = seasonOfDay(day + 1);
  if (!cropSeasonOk(d.crop, nextSeason, ctx.greenhouse) && !isRipe(n)) n.dead = true;
  return n;
}

/** Catch up a crop over several offline days. `sprinklerAt(day)` and weather are deterministic. */
export function catchUp(d: CropData, today: number, seed: number, sprinkler: boolean, greenhouse: boolean): CropData {
  let cur = d;
  const from = Math.max(d.lastDay + 1, today - 28);
  for (let day = from; day < today; day++) {
    cur = advanceDay(cur, day, { rain: waters(weatherForDay(seed, day)), sprinkler, greenhouse });
  }
  return cur;
}

/** Superposed crops collapse at harvest. Tonics bias the odds 75/25. */
export function collapseCrop(d: CropData, rand: () => number): string {
  if (!d.alt) return d.crop;
  const pA = d.bias === 'a' ? 0.75 : d.bias === 'b' ? 0.25 : 0.5;
  return rand() < pA ? d.crop : d.alt;
}

export function harvestYield(crop: string, rand: () => number, farmingLevel: number, luck = 0, bonus = 0): number {
  const def = CROPS[crop]!;
  let n = def.yieldMin + Math.floor(rand() * (def.yieldMax - def.yieldMin + 1)) + bonus;
  if (rand() < 0.05 * farmingLevel + 0.04 * luck) n += 1;
  return n;
}

/** After harvest: single-harvest crops are removed; regrowers drop back so they ripen again. */
export function afterHarvest(d: CropData): CropData | null {
  const def = CROPS[d.crop]!;
  const alt = d.alt ? CROPS[d.alt]! : null;
  const regrow = alt ? Math.min(def.regrow || 0, alt.regrow || 0) : def.regrow;
  if (!regrow) return null;
  return { ...d, growth: daysToRipe(d) - regrow };
}
