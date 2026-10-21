import { DAY_MS, WORLD_EPOCH_MS, dayNumber, gameHour, seasonOfDay, weatherForDay, type Weather } from '@eigenlands/shared';
import type { WorldClock } from './types';

/** All game time (days, hours, seasons, weather, respawn timers) comes from here so tests can shift it. */
export class ServerClock implements WorldClock {
  offset = 0;
  constructor(private seed: number) {}
  now(): number { return Date.now() + this.offset; }
  day(): number { return dayNumber(this.now()); }
  hour(): number { return gameHour(this.now()); }
  season(): number { return seasonOfDay(this.day()); }
  weather(): Weather { return weatherForDay(this.seed, this.day()); }
  setOffset(ms: number): void { this.offset = ms; }
  advanceDays(n: number): void { this.offset += n * DAY_MS; }
  /** wall-clock ms at which world day `day` begins (06:00 in-game) */
  dayStart(day: number): number { return WORLD_EPOCH_MS + day * DAY_MS; }
}
