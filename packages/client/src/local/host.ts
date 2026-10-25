/**
 * The single-player "server": hosts the real GameRoom (packages/server/src/rooms/GameRoom.ts) inside the page, plays
 * the part of Colyseus' MatchMaker (joinOrCreate / joinById with `filterBy(['shard'])`, one room per shard, rooms
 * dispose when empty, so shard handoffs work exactly like on the deployed server) and wires the room's process-wide
 * dependencies (Repo, Repo34, Presence, Bus, ShardLocks) to the browser save store.
 */
import { Encoder } from '@colyseus/schema';
import { JOIN_ROOM, WORLD_EPOCH_MS } from '@eigenlands/shared';
import { MatchMakeError } from 'colyseus.js';
import { loadConfig, type Config } from '../../../server/src/config';
import { Presence } from '../../../server/src/presence';
import { MemoryBus } from '../../../server/src/features/bus';
import { setRuntime34 } from '../../../server/src/features/runtime34';
import { ShardLocks } from '../../../server/src/features/shard/locks';
import { GameRoom } from '../../../server/src/rooms/GameRoom';
import { setRuntime, worldClock } from '../../../server/src/rooms/runtime';
import { metrics } from '../../../server/src/rooms/WorldRoom';
import type { Repo } from '../../../server/src/db/repo';
import type { Repo34 } from '../../../server/src/db/repo34';
import { ErrorCode, Protocol, generateId, matchMaker, roomEvents, type Room } from './colyseus-shim';
import { LocalDb } from './db';
import { LocalRepo, LocalRepo34 } from './repo';
import { installBufferGlobal } from './shims/buffer';
import { randomBytes } from './shims/crypto';
import { createPipe, queueTask, type ClientEnd } from './transport';

type RoomCtor = new () => Room;
interface Handler { ctor: RoomCtor; filterBy: string[] }
interface Seat { name: string; roomId: string; sessionId: string }

const LOCK = 'eigenlands-solo-world';
const CHANNEL = 'eigenlands-solo';

export class LocalHost {
  readonly config: Config;
  readonly repo: LocalRepo;
  private handlers = new Map<string, Handler>();
  private creationOpts = new Map<Room, Record<string, unknown>>();
  private creating = new Map<string, Promise<Room>>();
  private conns = new Set<ClientEnd>();
  private dead = false;
  private releaseLock: () => void = () => {};

  private constructor(readonly db: LocalDb, secret: string) {
    const dev = new URLSearchParams(location.search).get('dev') === '1';
    this.config = {
      ...loadConfig({ SESSION_SECRET: secret }),
      redisUrl: null,
      googleClientId: null,
      allowedOrigin: location.origin,
      autosaveMs: 10_000,
      devCommands: dev,
    };
    this.repo = new LocalRepo(db);
  }

  static async start(): Promise<LocalHost> {
    installBufferGlobal();
    const release = await acquireWorldLock();
    const db = await LocalDb.open();
    const existingWorld = db.has('meta:secret');
    let secret = db.get<string>('meta:secret');
    if (!secret) { secret = randomBytes(32).toString('hex'); db.put('meta:secret', secret); }
    const host = new LocalHost(db, secret);
    host.releaseLock = release.release;
    release.onTakeover(() => { void host.yieldToOtherTab(); });

    // same wiring as server/src/app.ts createApp (memory presence/bus/locks, i.e. a single-process deployment)
    Encoder.BUFFER_SIZE = 512 * 1024;
    setRuntime({ config: host.config, repo: host.repo as unknown as Repo, presence: new Presence(null), googleVerify: null, ambientSpawns: true });
    // New solo worlds begin on day 1 at dawn. Keep old worlds on their original calendar:
    // resetting that clock would invalidate planted days, quests and respawn timestamps.
    let offset=db.get<number>('meta:clock-offset');
    if(offset===undefined){offset=existingWorld?0:WORLD_EPOCH_MS-Date.now();db.put('meta:clock-offset',offset);}
    worldClock().setOffset(offset);
    setRuntime34({ repo34: new LocalRepo34(db) as unknown as Repo34, bus: new MemoryBus(), locks: new ShardLocks(null) });
    host.define(JOIN_ROOM, GameRoom as unknown as RoomCtor, ['shard']);
    roomEvents.disposed = (r) => { matchMaker.rooms.delete(r.roomId); host.creationOpts.delete(r); };
    host.installLifecycle();
    // debugging / e2e: server tick metrics (same numbers as the server's /metrics) and save-store state
    (globalThis as { __eigenSolo?: unknown }).__eigenSolo = { metrics, db: () => db.stats(), rooms: () => host.rooms.map((r) => ({ id: r.roomId, ...(r.metadata as object), clients: r.clients.length })) };
    return host;
  }

  define(name: string, ctor: RoomCtor, filterBy: string[] = []): void { this.handlers.set(name, { ctor, filterBy }); }

  get rooms(): Room[] { return [...matchMaker.rooms.values()]; }

  // ───────────────────────── matchmaking ─────────────────────────

  async matchmake(method: string, nameOrId: string, options: Record<string, unknown> = {}): Promise<Seat> {
    if (this.dead) throw new MatchMakeError('the world is open in another tab', ErrorCode.MATCHMAKE_UNHANDLED);
    for (let attempt = 0; attempt < 3; attempt++) {
      const room = await this.pickRoom(method, nameOrId, options);
      const sessionId = generateId();
      if (room.__reserveSeat(sessionId, options)) return { name: room.roomName, roomId: room.roomId, sessionId };
      if (method === 'joinById') break;
    }
    throw new MatchMakeError('room is full', ErrorCode.MATCHMAKE_INVALID_ROOM_ID);
  }

  private async pickRoom(method: string, nameOrId: string, options: Record<string, unknown>): Promise<Room> {
    if (method === 'joinById') {
      const r = matchMaker.rooms.get(nameOrId);
      if (!r || r.__disposing) throw new MatchMakeError(`room "${nameOrId}" not found`, ErrorCode.MATCHMAKE_INVALID_ROOM_ID);
      if (r.locked) throw new MatchMakeError(`room "${nameOrId}" is locked`, ErrorCode.MATCHMAKE_INVALID_ROOM_ID);
      return r;
    }
    const h = this.handlers.get(nameOrId);
    if (!h) throw new MatchMakeError(`provided room name "${nameOrId}" not defined`, ErrorCode.MATCHMAKE_NO_HANDLER);
    const fkey = `${nameOrId}|${h.filterBy.map((f) => JSON.stringify(options[f] ?? null)).join('|')}`;
    if (method !== 'create') {
      const pending = this.creating.get(fkey);
      if (pending) await pending.catch(() => {});
      const found = this.rooms.find((r) => r.roomName === nameOrId && !r.__disposing && !r.locked && !r.hasReachedMaxClients()
        && h.filterBy.every((f) => (this.creationOpts.get(r)?.[f] ?? null) === (options[f] ?? null)));
      if (found) return found;
      if (method === 'join') throw new MatchMakeError('no rooms found with provided criteria', ErrorCode.MATCHMAKE_INVALID_CRITERIA);
    }
    const pr = this.createRoom(nameOrId, h, options);
    this.creating.set(fkey, pr);
    try { return await pr; } finally { if (this.creating.get(fkey) === pr) this.creating.delete(fkey); }
  }

  private async createRoom(name: string, h: Handler, options: Record<string, unknown>): Promise<Room> {
    const room = new h.ctor();
    const roomId = generateId();
    matchMaker.rooms.set(roomId, room);
    this.creationOpts.set(room, Object.fromEntries(h.filterBy.map((f) => [f, options[f] ?? null])));
    try {
      await room.__create(name, roomId, options);
    } catch (e) {
      console.error('room onCreate failed', e);
      matchMaker.rooms.delete(roomId);
      throw new MatchMakeError((e as Error)?.message ?? 'onCreate failed', ErrorCode.MATCHMAKE_UNHANDLED);
    }
    return room;
  }

  /** The "WebSocket" for a reserved seat. */
  connect(seat: Seat): ClientEnd {
    const { client, host } = createPipe();
    this.conns.add(client);
    const prevClose = client.close.bind(client);
    client.close = (code, reason) => { this.conns.delete(client); prevClose(code, reason); };
    const room = matchMaker.rooms.get(seat.roomId);
    queueTask(() => {
      if (!room || this.dead) { host.close(Protocol.WS_CLOSE_WITH_ERROR, 'room not found'); return; }
      void room.__connect(seat.sessionId, host);
    });
    return client;
  }

  // ───────────────────────── page lifecycle ─────────────────────────

  private installLifecycle(): void {
    // 1) the page is going away: drop every connection synchronously, so each room's onLeave (save player) and
    //    onDispose (flush chunks/objects/village) run in this event's microtasks, like when a real socket closes...
    addEventListener('pagehide', () => {
      if (this.dead) return;
      for (const c of [...this.conns]) c.abortSync(Protocol.WS_CLOSE_GOING_AWAY);
      this.conns.clear();
    });
    // 2) ...then stash whatever has not reached IndexedDB yet (listeners run after the previous one's microtasks)
    addEventListener('pagehide', () => { if (!this.dead) this.db.journalSync(); });
    // restored from the back/forward cache: the old connections are gone, start fresh
    addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
    // backgrounded (mobile tabs may be killed without pagehide): save now
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden' || this.dead) return;
      for (const r of this.rooms) void (r as unknown as { autosave?: () => Promise<void> }).autosave?.();
      setTimeout(() => void this.db.flush().catch(() => {}), 0);
    });
  }

  private async yieldToOtherTab(): Promise<void> {
    if (this.dead) return;
    // like signing in elsewhere: kick (code 4001), let the rooms save, flush, hand the save over
    await Promise.all(this.rooms.map((r) => r.disconnect(4001).catch(() => {})));
    this.dead = true;
    await this.db.flush().catch(() => {});
    this.releaseLock();
  }

  /** "Delete my data": erase the whole local save and stop the world without saving it again. */
  async wipe(): Promise<void> {
    const wiping = this.db.wipe();
    this.dead = true;
    await Promise.all(this.rooms.map((r) => r.disconnect(Protocol.WS_CLOSE_CONSENTED).catch(() => {})));
    await wiping;
    this.releaseLock();
  }
}

/**
 * One tab owns the world at a time (Web Locks). A second tab asks the owner to step aside (BroadcastChannel), which
 * saves and kicks its player with "signed in elsewhere", then takes over.
 */
async function acquireWorldLock(): Promise<{ release: () => void; onTakeover: (fn: () => void) => void }> {
  let release = () => {};
  let takeover = () => {};
  const held = new Promise<void>((r) => { release = r; });
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
  const result = { release: () => release(), onTakeover: (fn: () => void) => { takeover = fn; } };
  if (bc) bc.onmessage = (e) => { if ((e.data as { t?: string })?.t === 'takeover') takeover(); };
  if (!locks) return result;
  const got = await new Promise<boolean>((resolve) => {
    locks.request(LOCK, { ifAvailable: true }, async (lock) => { if (!lock) { resolve(false); return; } resolve(true); await held; })
      .catch(() => resolve(true));
  });
  if (got) return result;
  bc?.postMessage({ t: 'takeover' });
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => { console.warn('the other tab did not hand over the world; continuing'); resolve(); }, 8000);
    locks.request(LOCK, async () => { clearTimeout(t); resolve(); await held; }).catch(() => resolve());
  });
  return result;
}

let starting: Promise<LocalHost> | null = null;
/** The page's host (started on first use). */
export const getHost = (): Promise<LocalHost> => (starting ??= LocalHost.start());
