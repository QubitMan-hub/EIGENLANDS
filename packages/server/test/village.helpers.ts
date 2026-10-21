import {
  ChunkStore, DAY_MS, WORLD_EPOCH_MS, WorldState, addStack, dayNumber, emptyInventory, gameHour, mulberry32, seasonOfDay,
  weatherForDay, type Weather,
} from '@eigenlands/shared';
import type { DirtyPart, PlayerData, PlayerRef, VillageHost } from '../src/systems/types';
import { createVillage, type Village, type VillageOptions } from '../src/systems/village';

export const SEED = 20260101;

/** Controllable clock: now() advances only when told to. */
export class FakeClock {
  t = WORLD_EPOCH_MS + 40 * DAY_MS;
  forced: Weather | null = null;
  now = () => this.t;
  day = () => dayNumber(this.t);
  hour = () => gameHour(this.t);
  season = () => seasonOfDay(this.day());
  weather = (): Weather => this.forced ?? weatherForDay(SEED, this.day());
  /** jump to a given day-offset and in-game hour */
  set(dayOffset: number, hour: number): void { this.t = WORLD_EPOCH_MS + (40 + dayOffset) * DAY_MS + (((hour - 6 + 24) % 24) / 24) * DAY_MS; }
  advanceMs(ms: number): void { this.t += ms; }
}

export class FakePlayer implements PlayerRef {
  id = 'sess-' + Math.random().toString(36).slice(2);
  accountId = 'acc-' + Math.random().toString(36).slice(2);
  name = 'Tester';
  x = 0;
  y = 0;
  data: PlayerData = { inv: emptyInventory(), coins: 0, skills: { farming: 0, mining: 0, foraging: 0, fishing: 0, crafting: 0 }, recipes: new Set(), equip: { ring1: null, ring2: null, outfit: 0 }, friends: {}, buffs: {} };
  dirtied = new Set<DirtyPart>();
  toasts: string[] = [];
  dirty(...parts: DirtyPart[]): void { parts.forEach((p) => this.dirtied.add(p)); }
  toast(text: string): void { this.toasts.push(text); }
  give(id: string, n: number): void { addStack(this.data.inv, { id, n }); }
}

export function makeHost(clock = new FakeClock()) {
  const blobs = new Map<string, unknown>();
  const players: FakePlayer[] = [];
  const state = new WorldState();
  const host: VillageHost = {
    seed: SEED, store: new ChunkStore(SEED), state, clock, rand: mulberry32(7),
    players: () => players,
    loadBlob: async <T>(k: string) => (blobs.has(k) ? (JSON.parse(JSON.stringify(blobs.get(k))) as T) : null),
    saveBlob: async (k, v) => { blobs.set(k, JSON.parse(JSON.stringify(v))); },
  };
  return { host, clock, blobs, players, state };
}

export async function makeVillage(opts?: VillageOptions, clock = new FakeClock()) {
  const h = makeHost(clock);
  const village: Village = createVillage(h.host, opts);
  await village.init();
  return { ...h, village };
}

/** Run `ticks` server ticks, advancing the clock 50 ms each. */
export function run(village: Village, clock: FakeClock, ticks: number, startTick = 0): number {
  for (let i = 0; i < ticks; i++) { clock.advanceMs(50); village.tick(startTick + i + 1); }
  return startTick + ticks;
}

/** Stand a player right next to an NPC. */
export function nextTo(p: FakePlayer, village: Village, id: string): void {
  const n = village.npc(id)!;
  p.x = n.x + 1; p.y = n.y;
}
