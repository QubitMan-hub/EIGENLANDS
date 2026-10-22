/** Helpers for the Phase 3 (Circuit Board) integration tests. */
import { matchMaker } from 'colyseus';
import { Client, type Room } from 'colyseus.js';
import {
  MSG, MSG34, emptyBoard, type AbilityId, type Board, type CastResultMsg, type GateId, type ProgressMsg,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { DEV_MSG, type CircuitModule, type CircuitState } from '../src/p34/circuit';
import { TokenBucket } from '../src/rate';
import type { GameRoom } from '../src/rooms/GameRoom';
import type { ServerPlayer } from '../src/rooms/player';
import { tuning } from '../src/rooms/runtime';
import { guest, resetDb, sleep, startApp, until, wsUrl } from './helpers';

export interface P3 {
  r: Room<any>;
  sid: string;
  token: string;
  accountId: string;
  room: GameRoom;
  sp: ServerPlayer;
  circuit: CircuitModule;
  /** merged PROGRESS state as the client would hold it */
  prog: ProgressMsg;
  progs: ProgressMsg[];
  casts: CastResultMsg[];
  res: Array<{ v: number; max: number }>;
  toasts: Array<{ text: string; kind: string }>;
}

export async function boot3(config: Record<string, unknown> = {}): Promise<App> {
  await resetDb();
  tuning.toolCooldownMs = 0;
  return startApp({ config: { devCommands: true, ...config } });
}

export async function spawn3(
  app: App, name = 'Orbit', creds?: { token: string; accountId: string }, opts: { relax?: boolean; ticket?: string } = {},
): Promise<P3> {
  const g = creds ?? await guest(app);
  const client = new Client(wsUrl(app));
  let r!: Room<any>;
  let room!: GameRoom;
  // when the last player leaves, the old room may still hold the shard lock while it disposes: the new room then only
  // redirects (it has no modules). Wait for the lock to free up and join again.
  for (let attempt = 0; ; attempt++) {
    r = await client.joinOrCreate('world', { token: g.token, name, ...(opts.ticket ? { ticket: opts.ticket } : {}) });
    room = matchMaker.getLocalRoomById(r.roomId) as unknown as GameRoom;
    if (room?.circuit || attempt >= 30) break;
    await r.leave().catch(() => {});
    await sleep(150);
  }
  const p: P3 = {
    r, sid: r.sessionId, token: g.token, accountId: g.accountId, room, sp: undefined as unknown as ServerPlayer,
    circuit: room.circuit, prog: {}, progs: [], casts: [], res: [], toasts: [],
  };
  r.onMessage(MSG34.PROGRESS, (m: ProgressMsg) => { p.progs.push(m); Object.assign(p.prog, m); });
  r.onMessage(MSG34.CAST_R, (m: CastResultMsg) => p.casts.push(m));
  r.onMessage(MSG34.RES, (m) => p.res.push(m));
  r.onMessage(MSG.TOAST, (m) => p.toasts.push(m));
  r.onMessage('*', () => {});
  await until(() => !!room.circuit.stateOf(r.sessionId) && p.progs.length > 0, 5000);
  p.sp = room.players.get(r.sessionId)!;
  if (opts.relax !== false) relax3(p);
  return p;
}

/** Functional tests send faster than people do; the rate-limit test uses the real buckets. */
export function relax3(p: P3): void {
  const big = () => new TokenBucket(100000, 100000);
  const m = new Map(['cast', 'board', 'party', 'chat', 'trade', 'emote'].map((n) => [n, big()]));
  (p.room as unknown as { buckets: Map<string, Map<string, TokenBucket>> }).buckets.set(p.sid, m as Map<string, TokenBucket>);
  p.sp.invBucket = big();
}

export const st = (p: P3): CircuitState => p.circuit.stateOf(p.sid)!;

export type CellSpec = GateId | ['cx', number] | null;
/** Build a board: `lines[q]` lists cells from column 0; `abilities[q]` the ability on line q. */
export function mkBoard(lines: Record<number, CellSpec[]>, abilities: Record<number, AbilityId | null>, runes: Record<number, number> = {}): Board {
  const b = emptyBoard();
  for (const [q, cells] of Object.entries(lines)) {
    cells.forEach((c, i) => {
      if (!c) return;
      b.lines[Number(q)]![i] = Array.isArray(c) ? { g: 'cx', t: c[1] } : { g: c };
    });
  }
  for (const [q, a] of Object.entries(abilities)) b.abilities[Number(q)] = a;
  for (const [q, n] of Object.entries(runes)) b.runes[Number(q)] = n;
  return b;
}

/** Attune and wait for the server's answer (PROGRESS with the board, or a toast). Clears the attune cooldown first. */
export async function attune(p: P3, board: Board, skipCooldown = true): Promise<{ ok: boolean; toast?: string }> {
  if (skipCooldown) st(p).attuneReady = 0;
  await sleep(30); // let earlier messages' replies arrive first
  const np = p.progs.length, nt = p.toasts.length;
  p.r.send(MSG34.ATTUNE, { board });
  const done = () => p.progs.slice(np).some((m) => m.board) || p.toasts.slice(nt).some((x) => x.kind === 'bad');
  await until(done, 3000);
  if (p.progs.slice(np).some((m) => m.board)) return { ok: true };
  return { ok: false, toast: p.toasts.slice(nt).find((x) => x.kind === 'bad')!.text };
}

/** Cast a line and wait for CAST_R. `ready` clears cooldowns first. */
export async function cast(p: P3, line: number, aimX = 1, aimY = 0, ready = true): Promise<CastResultMsg> {
  if (ready) st(p).cd.clear();
  const n = p.casts.length;
  p.r.send(MSG34.CAST, { line, aimX, aimY });
  await until(() => p.casts.length > n, 3000, 5);
  return p.casts[n]!;
}

export const dev3 = (p: P3, msg: Record<string, unknown>) => p.r.send(DEV_MSG, msg);
export const dev = (p: P3, msg: Record<string, unknown>) => p.r.send(MSG.DEV, msg);

export async function tp(p: P3, x: number, y: number): Promise<void> {
  dev(p, { cmd: 'tp', x, y });
  await until(() => Math.abs(p.sp.sim.x - x) < 0.01 && Math.abs(p.sp.sim.y - y) < 0.01);
}

export async function setLevel(p: P3, level: number): Promise<void> {
  dev(p, { cmd: 'level', level });
  await until(() => p.sp.level === level && st(p).pr.rewardedLevel >= level && st(p).n === p.prog.qubits, 4000);
}

export async function setClass(p: P3, cls: string): Promise<void> {
  dev3(p, { cmd: 'class', cls });
  await until(() => st(p).pr.cls === cls && p.prog.cls === cls);
}

/** A flat open field around (cx, cy) so bolts and blinks do not meet generated trees or rocks. */
export function flatten(room: GameRoom, cx: number, cy: number, r = 8, tile = 3): void {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    room.objects.remove(x, y);
    room.setTile(x, y, tile);
  }
}

/** A stationary, harmless enemy (it neither walks nor notices anyone). */
export function dummy(room: GameRoom, x: number, y: number, kind: 'slime' | 'hopper' = 'slime') {
  const e = room.spawnEnemy(kind, x, y, false);
  e.def = { ...e.def, speed: 0, sight: 0.1 };
  // an unbreakable training dummy: Combat 2.0 poise breaks would add stagger damage and blur exact numbers
  e.poise = e.maxPoise = Number.POSITIVE_INFINITY;
  e.resist = 0;
  return e;
}

export function remove(room: GameRoom, id: string): void { room.enemies.delete(id); room.state.enemies.delete(id); }

/** Drop every enemy in the room (tests share one room). */
export function clearEnemies(room: GameRoom): void { for (const id of [...room.enemies.keys()]) remove(room, id); }

export { sleep, until };
