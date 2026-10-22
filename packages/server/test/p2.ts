import { matchMaker } from 'colyseus';
import type { Room } from 'colyseus.js';
import { DAY_MS, MSG, WORLD_EPOCH_MS, type Props } from '@eigenlands/shared';
import type { App } from '../src/app';
import { tuning, worldClock } from '../src/rooms/runtime';
import type { ServerPlayer } from '../src/rooms/player';
import type { WorldRoom } from '../src/rooms/WorldRoom';
import { TokenBucket } from '../src/rate';
import { guest, join, lastRoomId, resetDb, sleep, startApp, until } from './helpers';

/** Everything a test client received from the server, plus handy server-side handles. */
export interface Probe {
  r: Room<any>;
  sid: string;
  token: string;
  accountId: string;
  room: WorldRoom;
  sp: ServerPlayer;
  toasts: Array<{ text: string; kind: string; item?: any }>;
  objs: any[];
  tiles: any[];
  panels: any[];
  profiles: any[];
  rhythm: any[];
  results: any[];
  bites: any[];
  casts: any[];
  dialogues: any[];
  shopViews: any[];
  forgePreviews: any[];
  chunks: any[];
}

export async function boot(config: Record<string, unknown> = {}): Promise<App> {
  await resetDb();
  tuning.toolCooldownMs = 0;
  tuning.pace = 0.1;
  const app = await startApp({ config: { devCommands: true, ...config } });
  // Pin the world clock (spring, day 1, noon) so new characters, crops, shops and NPC schedules never depend on the real date.
  pinClock(1, 12);
  return app;
}

/** Set the world clock to `day` at game hour `hour` before any room exists (no rollover bookkeeping needed). */
export function pinClock(day: number, hour = 12): void {
  worldClock().setOffset(WORLD_EPOCH_MS + day * DAY_MS + ((hour - 6 + 24) % 24) * 60_000 + 5_000 - Date.now());
}

export const serverRoom = (): WorldRoom => matchMaker.getLocalRoomById(lastRoomId()) as unknown as WorldRoom;

export async function spawn(app: App, name = 'Tester', creds?: { token: string; accountId: string }, opts: { relax?: boolean } = {}): Promise<Probe> {
  const g = creds ? { token: creds.token, accountId: creds.accountId } : await guest(app);
  const r = await join(app, g.token, name);
  const room = serverRoom();
  await until(() => room.players.has(r.sessionId));
  const sp = room.players.get(r.sessionId)!;
  const pr: Probe = {
    r, sid: r.sessionId, token: g.token, accountId: g.accountId, room, sp,
    toasts: [], objs: [], tiles: [], panels: [], profiles: [], rhythm: [], results: [], bites: [], casts: [], dialogues: [], shopViews: [], forgePreviews: [], chunks: [],
  };
  r.onMessage(MSG.TOAST, (m) => pr.toasts.push(m));
  r.onMessage(MSG.OBJ, (m) => pr.objs.push(m));
  r.onMessage(MSG.TILE, (m) => pr.tiles.push(m));
  r.onMessage(MSG.PANEL, (m) => pr.panels.push(m));
  r.onMessage(MSG.PROFILE, (m) => pr.profiles.push(m));
  r.onMessage(MSG.RHYTHM_START, (m) => pr.rhythm.push(m));
  r.onMessage(MSG.RHYTHM_RESULT, (m) => pr.results.push(m));
  r.onMessage(MSG.FISH_BITE, (m) => pr.bites.push(m));
  r.onMessage(MSG.FISH_CAST, (m) => pr.casts.push(m));
  r.onMessage(MSG.DIALOGUE, (m) => pr.dialogues.push(m));
  r.onMessage(MSG.SHOP_VIEW, (m) => pr.shopViews.push(m));
  r.onMessage(MSG.FORGE_PREVIEW_R, (m) => pr.forgePreviews.push(m));
  r.onMessage(MSG.CHUNK, (m) => pr.chunks.push(m));
  r.onMessage('*', () => {});
  if (opts.relax !== false) relax(pr);
  return pr;
}

/** Pin the world clock to `day` at game hour `hour` (default noon). Also tells the room so no rollover fires. */
export function setDay(room: WorldRoom, day: number, hour = 12): void {
  const ms = WORLD_EPOCH_MS + day * DAY_MS + ((hour - 6 + 24) % 24) * 60_000 + 5_000;
  worldClock().setOffset(ms - Date.now());
  (room as unknown as { processedDay: number }).processedDay = day;
}

/** Advance the world by whole days and wait for the rollover to run. */
export async function nextDay(room: WorldRoom, n = 1): Promise<void> {
  const target = worldClock().day() + n;
  worldClock().advanceDays(n);
  await until(() => (room as unknown as { processedDay: number }).processedDay >= target, 3000, 20);
  await sleep(60);
}

/** Functional tests fire messages faster than humans; the rate-limit tests use the real buckets. */
export function relax(p: Probe): void {
  const big = () => new TokenBucket(10000, 10000);
  p.sp.useBucket = big(); p.sp.craftBucket = big(); p.sp.socialBucket = big(); p.sp.openBucket = big(); p.sp.invBucket = big();
}

export const dev = (p: Probe, msg: Record<string, unknown>) => p.r.send(MSG.DEV, msg);

export async function give(p: Probe, id: string, n = 1, props?: Props): Promise<void> {
  const before = p.sp.data.inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
  dev(p, { cmd: 'give', id, n, ...(props ? { p: props } : {}) });
  await until(() => p.sp.data.inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0) >= before + (props ? 1 : n));
}

export const count = (p: Probe, id: string): number => p.sp.data.inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
export const slotOf = (p: Probe, id: string): number => p.sp.data.inv.findIndex((s) => s?.id === id);

/** Teleport (dev) and wait until the server applied it. */
export async function tp(p: Probe, x: number, y: number): Promise<void> {
  dev(p, { cmd: 'tp', x, y });
  await until(() => Math.abs(p.sp.sim.x - x) < 0.01 && Math.abs(p.sp.sim.y - y) < 0.01);
}

/** Use the first stack of `id` on a tile and give the server a moment. */
export async function use(p: Probe, id: string, tx: number, ty: number, wait = 70): Promise<void> {
  const slot = slotOf(p, id);
  if (slot < 0) throw new Error(`no ${id} in pack`);
  p.r.send(MSG.USE, { slot, tx, ty });
  await sleep(wait);
}

export const lastToast = (p: Probe): string => p.toasts[p.toasts.length - 1]?.text ?? '';
export const hasToast = (p: Probe, re: RegExp, from = 0): boolean => p.toasts.slice(from).some((t) => re.test(t.text));

/** A flat patch of grass around (cx,cy) so fixtures do not collide with generated trees and rocks. */
export function flatten(room: WorldRoom, cx: number, cy: number, r = 6, tile = 3): void {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    room.objects.remove(x, y);
    room.setTile(x, y, tile);
  }
}

export { sleep, until };
