/**
 * Browser implementation of the parts of the `colyseus` server package (0.16) that the game rooms use. In solo builds
 * vite.config.ts resolves `colyseus` here, so packages/server/src/rooms/GameRoom.ts runs unmodified inside the page.
 *
 * Behaviour follows @colyseus/core's Room.ts closely (seat reservation, onAuth → onJoin → JOIN_ROOM handshake, queued
 * messages until the client acknowledges, '*' and unknown-message handling, afterNextPatch, auto-dispose) and its
 * SchemaSerializer (Encoder + per-client StateView patches), so the client receives exactly the bytes a real server
 * would send. The transport is a pair of in-memory endpoints (see transport.ts) instead of a WebSocket.
 */
import { Encoder, Reflection, type StateView } from '@colyseus/schema';
import { ErrorCode, Protocol, bytesFrame, dataFrame, errorFrame, joinFrame, readClientData } from './protocol';
import { installBufferGlobal } from './shims/buffer';

export { ErrorCode, Protocol };

export enum ClientState {
  JOINING = 0,
  JOINED = 1,
  RECONNECTED = 2,
  LEAVING = 3,
  CLOSED = 4,
}

/** Server end of an in-memory connection. */
export interface HostEnd {
  readonly open: boolean;
  /** server → client frame */
  send(data: Uint8Array): void;
  close(code?: number, reason?: string): void;
  /** client → server frame */
  onmessage: ((data: Uint8Array) => void) | null;
  onclose: ((code: number) => void) | null;
}

export class ServerError extends Error {
  code: number;
  constructor(code: number = ErrorCode.MATCHMAKE_UNHANDLED, message?: string) {
    super(message);
    this.code = code;
    this.name = 'ServerError';
  }
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
export function generateId(length = 9): string {
  const r = new Uint8Array(length);
  globalThis.crypto.getRandomValues(r);
  let s = '';
  for (let i = 0; i < length; i++) s += ID_CHARS[r[i]! & 63];
  return s;
}

// ───────────────────────── clock (subset of @colyseus/timer ClockTimer) ─────────────────────────

export class Delayed {
  active = true;
  paused = false;
  elapsedTime = 0;
  constructor(
    public handler: (...a: unknown[]) => void,
    public args: unknown[],
    public time: number,
    private repeat: boolean,
  ) {}
  tick(delta: number): void {
    if (this.paused || !this.active) return;
    this.elapsedTime += delta;
    if (this.elapsedTime < this.time) return;
    this.handler(...this.args);
    if (this.repeat) this.elapsedTime -= this.time;
    else this.active = false;
  }
  clear(): void {
    this.active = false;
  }
  reset(): void {
    this.elapsedTime = 0;
  }
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }
}

export class Clock {
  running = false;
  currentTime = 0;
  elapsedTime = 0;
  deltaTime = 0;
  private last = 0;
  private delayed: Delayed[] = [];
  start(): void {
    this.running = true;
    this.last = this.currentTime = performance.now();
  }
  stop(): void {
    this.running = false;
  }
  tick(now = performance.now()): void {
    this.deltaTime = now - this.last;
    this.last = this.currentTime = now;
    this.elapsedTime += this.deltaTime;
    for (const d of [...this.delayed]) d.tick(this.deltaTime);
    this.delayed = this.delayed.filter((d) => d.active);
  }
  setInterval(handler: (...a: any[]) => void, time: number, ...args: unknown[]): Delayed {
    const d = new Delayed(handler, args, time, true);
    this.delayed.push(d);
    return d;
  }
  setTimeout(handler: (...a: any[]) => void, time: number, ...args: unknown[]): Delayed {
    const d = new Delayed(handler, args, time, false);
    this.delayed.push(d);
    return d;
  }
  duration(ms: number): Promise<void> {
    return new Promise((r) => this.setTimeout(r, ms));
  }
  clear(): void {
    for (const d of this.delayed) d.clear();
    this.delayed = [];
  }
}

// ───────────────────────── client ─────────────────────────

type AfterPatch = Array<[Client | 'broadcast', unknown[]]>;
interface SendOptions {
  afterNextPatch?: boolean;
}

export class Client {
  state = ClientState.JOINING;
  view?: StateView;
  auth?: any;
  userData?: any;
  reconnectionToken = '';
  /** @internal messages sent before the client acknowledged JOIN_ROOM */
  _enqueuedMessages: Uint8Array[] | undefined = [];
  /** @internal */
  _afterNextPatchQueue: AfterPatch = [];
  /** @internal */
  _joinedAt = 0;

  constructor(
    readonly sessionId: string,
    readonly ref: HostEnd,
  ) {}

  get id(): string {
    return this.sessionId;
  }
  get readyState(): number {
    return this.ref.open ? 1 : 3;
  }

  send(type: string | number, message?: unknown, options?: SendOptions): void {
    this.enqueueRaw(dataFrame(type, message), options);
  }

  sendBytes(type: string | number, bytes: Uint8Array, options?: SendOptions): void {
    this.enqueueRaw(bytesFrame(type, bytes), options);
  }

  enqueueRaw(data: Uint8Array, options?: SendOptions): void {
    if (options?.afterNextPatch) {
      this._afterNextPatchQueue.push([this, [data]]);
      return;
    }
    if (this.state === ClientState.JOINING) {
      this._enqueuedMessages?.push(data);
      return;
    }
    this.raw(data);
  }

  raw(data: Uint8Array): void {
    if (this.ref.open) this.ref.send(data);
  }

  error(code: number, message = ''): void {
    this.raw(errorFrame(code, message));
  }

  leave(code?: number, data?: string): void {
    this.ref.close(code, data);
  }

  /** @deprecated like the real client */
  close(code?: number, data?: string): void {
    this.leave(code, data);
  }

  toJSON(): { sessionId: string; readyState: number } {
    return { sessionId: this.sessionId, readyState: this.readyState };
  }
}

export class ClientArray<C extends Client = Client> extends Array<C> {
  getById(sessionId: string): C | undefined {
    return this.find((c) => c.sessionId === sessionId);
  }
  delete(client: C): boolean {
    const i = this.indexOf(client);
    if (i < 0) return false;
    this.splice(i, 1);
    return true;
  }
}

// ───────────────────────── schema serializer (mirror of @colyseus/core SchemaSerializer) ─────────────────────────

const SHARED_VIEW = {};

class SchemaSerializer {
  readonly id = 'schema';
  hasFilters = false;
  needFullEncode = true;
  encoder!: Encoder;
  fullEncodeBuffer: Uint8Array;
  fullEncodeCache!: Uint8Array;
  sharedOffsetCache = { offset: 0 };
  encodedViews?: Map<object, Uint8Array>;
  handshakeCache?: Uint8Array;

  constructor() {
    this.fullEncodeBuffer = new Uint8Array(Encoder.BUFFER_SIZE);
  }

  reset(state: any): void {
    this.encoder = new Encoder(state);
    this.hasFilters = this.encoder.context.hasFilters;
    this.fullEncodeBuffer[0] = Protocol.ROOM_STATE;
    if (this.hasFilters) this.encodedViews = new Map();
  }

  getFullState(client?: Client): Uint8Array {
    const root = this.encoder.root as any;
    if (this.needFullEncode || root.changes.length > 0 || root.changes.next !== undefined) {
      this.sharedOffsetCache = { offset: 1 };
      this.fullEncodeCache = this.encoder.encodeAll(this.sharedOffsetCache, this.fullEncodeBuffer as any);
      this.needFullEncode = false;
    }
    if (this.hasFilters && client?.view) {
      return this.encoder.encodeAllView(
        client.view,
        this.sharedOffsetCache.offset,
        { ...this.sharedOffsetCache },
        this.fullEncodeBuffer as any,
      );
    }
    return this.fullEncodeCache;
  }

  applyPatches(clients: Client[]): boolean {
    let n = clients.length;
    if (n === 0) {
      this.encoder.discardChanges();
      return false;
    }
    if (!this.encoder.hasChanges) {
      if (this.hasFilters) {
        const changed = clients.filter((c) => c.state === ClientState.JOINED && (c.view?.changes.size ?? 0) > 0);
        if (changed.length > 0) {
          const it = { offset: 1 };
          const sharedOffset = it.offset;
          this.encoder.sharedBuffer[0] = Protocol.ROOM_STATE_PATCH;
          for (const c of changed) c.raw(this.encoder.encodeView(c.view!, sharedOffset, it));
        }
      }
      return false;
    }
    this.needFullEncode = true;
    const it = { offset: 1 };
    this.encoder.sharedBuffer[0] = Protocol.ROOM_STATE_PATCH;
    const encodedChanges = this.encoder.encode(it);
    if (!this.hasFilters) {
      while (n--) {
        const c = clients[n]!;
        if (c.state === ClientState.JOINED) c.raw(encodedChanges);
      }
    } else {
      const sharedOffset = it.offset;
      while (n--) {
        const c = clients[n]!;
        if (c.state !== ClientState.JOINED) continue;
        const view: object = c.view || SHARED_VIEW;
        let enc = this.encodedViews!.get(view);
        if (enc === undefined) {
          enc = view === SHARED_VIEW ? encodedChanges : this.encoder.encodeView(c.view!, sharedOffset, it);
          this.encodedViews!.set(view, enc);
        }
        c.raw(enc);
      }
      this.encodedViews!.clear();
    }
    this.encoder.discardChanges();
    return true;
  }

  handshake(): Uint8Array {
    return (this.handshakeCache ??= this.encoder.state && Reflection.encode(this.encoder));
  }
}

// ───────────────────────── room ─────────────────────────

enum Internal {
  CREATING,
  CREATED,
  DISPOSING,
}

interface Seat {
  options: any;
  consumed: boolean;
  timer?: ReturnType<typeof setTimeout>;
}
type Handler = { callback: (client: Client, a: any, b?: any) => void; validate?: (m: unknown) => unknown };

/** Registry hook installed by the local host (host.ts) so rooms can unlist themselves when disposed. */
export const roomEvents = { disposed: (_room: Room) => {} };

const DEFAULT_PATCH_RATE = 1000 / 20;
const DEFAULT_SIMULATION_INTERVAL = 1000 / 60;

export abstract class Room<State extends object = any, Metadata = any> {
  clock = new Clock();
  maxClients = Infinity;
  autoDispose = true;
  clients = new ClientArray();
  roomName = '';
  roomId = '';
  seatReservationTime = 15;
  listing: {
    roomId: string;
    name: string;
    metadata: Metadata | undefined;
    locked: boolean;
    private: boolean;
    clients: number;
    maxClients: number;
  } = {
    roomId: '',
    name: '',
    metadata: undefined,
    locked: false,
    private: false,
    clients: 0,
    maxClients: Infinity,
  };
  presence: unknown = undefined;
  /** @internal */
  _internalState = Internal.CREATING;
  /** @internal */
  _afterNextPatchQueue: AfterPatch = [];
  /** @internal */
  _serializer: SchemaSerializer | null = null;
  /** @internal */
  _simulationInterval?: ReturnType<typeof setInterval>;
  /** @internal */
  reservedSeats: Record<string, Seat> = {};
  protected onMessageHandlers: Record<string, Handler> = Object.create(null);
  private _state?: State;
  private _patchRate: number | null = DEFAULT_PATCH_RATE;
  private _patchInterval?: ReturnType<typeof setInterval>;
  private _autoDisposeTimeout?: ReturnType<typeof setTimeout>;
  private _onLeaveConcurrent = 0;
  private _locked = false;
  private _inited = false;
  private _disposed?: Promise<void>;

  constructor() {
    installBufferGlobal();
    this.onMessageHandlers['__no_message_handler'] = {
      callback: (client: Client, type: string | number) => {
        console.error(`room onMessage for "${String(type)}" not registered. (roomId: ${this.roomId})`);
        client.leave(Protocol.WS_CLOSE_WITH_ERROR, `room onMessage for "${String(type)}" not registered.`);
      },
    };
  }

  get state(): State {
    return this._state as State;
  }
  set state(s: State) {
    this._state = s;
    if (s) {
      this._serializer = new SchemaSerializer();
      this._serializer.reset(s);
    }
  }

  get patchRate(): number | null {
    return this._patchRate;
  }
  set patchRate(ms: number | null) {
    this._patchRate = ms;
    if (!this._inited) return;
    if (this._patchInterval) {
      clearInterval(this._patchInterval);
      this._patchInterval = undefined;
    }
    if (ms !== null && ms !== 0 && this._internalState !== Internal.DISPOSING)
      this._patchInterval = setInterval(() => this.broadcastPatch(), ms);
  }

  get metadata(): Metadata | undefined {
    return this.listing.metadata;
  }
  get locked(): boolean {
    return this._locked;
  }

  // ── user hooks (overridden by game rooms) ──
  onCreate?(options: any): void | Promise<any>;
  onJoin?(client: Client, options?: any, auth?: any): void | Promise<any>;
  onLeave?(client: Client, consented?: boolean): void | Promise<any>;
  onDispose?(): void | Promise<any>;
  onBeforePatch?(state: State): void;
  onAuth(_client: Client, _options: any, _context?: any): any {
    return true;
  }

  // ── API used by rooms ──
  setSimulationInterval(cb?: (deltaTime: number) => void, delay = DEFAULT_SIMULATION_INTERVAL): void {
    if (this._simulationInterval) clearInterval(this._simulationInterval);
    this._simulationInterval = undefined;
    if (cb)
      this._simulationInterval = setInterval(() => {
        this.clock.tick();
        cb(this.clock.deltaTime);
      }, delay);
  }

  setPatchRate(ms: number | null): void {
    this.patchRate = ms;
  }
  setState(s: State): void {
    this.state = s;
  }
  setSeatReservationTime(seconds: number): this {
    this.seatReservationTime = seconds;
    return this;
  }

  async setMetadata(meta: Partial<Metadata>): Promise<void> {
    if (!this.listing.metadata) this.listing.metadata = { ...meta } as Metadata;
    else Object.assign(this.listing.metadata as object, meta);
  }

  async setPrivate(bool = true): Promise<void> {
    this.listing.private = bool;
  }
  async lock(): Promise<void> {
    this._locked = true;
    this.listing.locked = true;
  }
  async unlock(): Promise<void> {
    this._locked = false;
    this.listing.locked = false;
  }

  hasReachedMaxClients(): boolean {
    return (
      this.clients.length + Object.keys(this.reservedSeats).length >= this.maxClients ||
      this._internalState === Internal.DISPOSING
    );
  }

  hasReservedSeat(sessionId: string): boolean {
    return !!this.reservedSeats[sessionId] && !this.reservedSeats[sessionId]!.consumed;
  }

  onMessage<T = any>(
    type: string | number,
    callback: (client: Client, message: T) => void,
    validate?: (m: unknown) => T,
  ): () => void {
    const key = String(type);
    this.onMessageHandlers[key] = { callback: callback as Handler['callback'], validate };
    return () => {
      delete this.onMessageHandlers[key];
    };
  }

  broadcast(
    type: string | number,
    message?: unknown,
    options: { except?: Client | Client[]; afterNextPatch?: boolean } = {},
  ): void {
    if (options.afterNextPatch) {
      this._afterNextPatchQueue.push(['broadcast', [type, message, { ...options, afterNextPatch: false }]]);
      return;
    }
    this.broadcastFrame(
      message instanceof Uint8Array ? bytesFrame(type, message) : dataFrame(type, message),
      options.except,
    );
  }

  broadcastBytes(
    type: string | number,
    message: Uint8Array,
    options: { except?: Client | Client[]; afterNextPatch?: boolean } = {},
  ): void {
    this.broadcast(type, message, options);
  }

  private broadcastFrame(frame: Uint8Array, except?: Client | Client[]): void {
    const ex = except === undefined ? undefined : Array.isArray(except) ? except : [except];
    for (let i = this.clients.length - 1; i >= 0; i--) {
      const c = this.clients[i]!;
      if (!ex || !ex.includes(c)) c.enqueueRaw(frame);
    }
  }

  broadcastPatch(): boolean {
    this.onBeforePatch?.(this.state);
    if (!this._simulationInterval) this.clock.tick();
    if (!this.state || !this._serializer) return false;
    const changed = this._serializer.applyPatches(this.clients);
    this.dequeueAfterPatch();
    return changed;
  }

  sendFullState(client: Client): void {
    if (this._serializer) client.raw(this._serializer.getFullState(client));
  }

  allowReconnection(_client: Client, _seconds?: number | 'manual'): Promise<Client> {
    return Promise.reject(new Error('reconnection is not supported in single-player mode'));
  }

  /** Disconnect every client and dispose the room. */
  disconnect(closeCode: number = Protocol.WS_CLOSE_CONSENTED): Promise<void> {
    if (this._internalState === Internal.DISPOSING) return this._disposed ?? Promise.resolve();
    if (this._internalState === Internal.CREATING) throw new Error('cannot disconnect during onCreate()');
    this._internalState = Internal.DISPOSING;
    this.autoDispose = true;
    const done = new Promise<void>((resolve) => {
      this._afterDispose = resolve;
    });
    if (this.clients.length > 0) for (const c of [...this.clients]) this.forciblyClose(c, closeCode);
    else void this.dispose();
    return done;
  }

  // ───────────────────────── internals driven by the local host ─────────────────────────

  private _afterDispose: () => void = () => {};

  /** @internal called by the host right after construction (MatchMaker: __init + onCreate) */
  async __create(name: string, roomId: string, options: any): Promise<void> {
    this.roomName = name;
    this.roomId = roomId;
    this.listing.roomId = roomId;
    this.listing.name = name;
    this._inited = true;
    this.patchRate = this._patchRate;
    this.resetAutoDisposeTimeout(this.seatReservationTime);
    this.clock.start();
    try {
      if (this.onCreate) await this.onCreate(options);
    } catch (e) {
      // the real MatchMaker disposes a room whose onCreate failed and reports the error to the caller
      this._internalState = Internal.DISPOSING;
      if (this._patchInterval) clearInterval(this._patchInterval);
      if (this._simulationInterval) clearInterval(this._simulationInterval);
      clearTimeout(this._autoDisposeTimeout);
      this.clock.clear();
      roomEvents.disposed(this);
      throw e;
    }
    this._internalState = Internal.CREATED;
    this.listing.maxClients = this.maxClients;
  }

  /** @internal */
  get __disposing(): boolean {
    return this._internalState === Internal.DISPOSING;
  }

  /** @internal MatchMaker reserveSeatFor */
  __reserveSeat(sessionId: string, options: any): boolean {
    if (this.hasReachedMaxClients()) return false;
    const seat: Seat = { options, consumed: false };
    seat.timer = setTimeout(() => {
      if (this.reservedSeats[sessionId] !== seat) return;
      delete this.reservedSeats[sessionId];
      this.decrementClientCount();
    }, this.seatReservationTime * 1000);
    this.reservedSeats[sessionId] = seat;
    this.listing.clients++;
    this.resetAutoDisposeTimeout(this.seatReservationTime);
    return true;
  }

  /** @internal transport onConnection → room._onJoin; on failure the client gets an ERROR frame and is closed */
  async __connect(sessionId: string, ref: HostEnd): Promise<void> {
    const client = new Client(sessionId, ref);
    ref.onclose = () => {
      client.state = ClientState.LEAVING;
    };
    try {
      await this.onJoinInternal(client);
    } catch (e) {
      const err = e as { code?: number; message?: string };
      client.error(err.code ?? ErrorCode.APPLICATION_ERROR, err.message ?? 'join failed');
      ref.close(Protocol.WS_CLOSE_WITH_ERROR);
    }
  }

  private async onJoinInternal(client: Client): Promise<void> {
    const sid = client.sessionId;
    client.reconnectionToken = generateId();
    if (this._autoDisposeTimeout) {
      clearTimeout(this._autoDisposeTimeout);
      this._autoDisposeTimeout = undefined;
    }
    const seat = this.reservedSeats[sid];
    if (!seat || seat.consumed) throw new ServerError(ErrorCode.MATCHMAKE_EXPIRED, 'already consumed');
    seat.consumed = true;
    clearTimeout(seat.timer);
    client._afterNextPatchQueue = this._afterNextPatchQueue;
    try {
      if (this.onAuth !== Room.prototype.onAuth) {
        try {
          client.auth = await this.onAuth(client, seat.options, {
            token: seat.options?.token,
            headers: {},
            ip: '127.0.0.1',
          });
          if (!client.auth) throw new ServerError(ErrorCode.AUTH_FAILED, 'onAuth failed');
        } catch (e) {
          delete this.reservedSeats[sid];
          this.decrementClientCount();
          throw e;
        }
      }
      if (client.state === ClientState.LEAVING)
        throw new ServerError(Protocol.WS_CLOSE_GOING_AWAY, 'already disconnected');
      this.clients.push(client);
      if (this.onJoin) await this.onJoin(client, seat.options, client.auth);
      if ((client.state as ClientState) === ClientState.LEAVING) throw new Error('early_leave');
      delete this.reservedSeats[sid];
    } catch (e) {
      await this.onLeaveInternal(client, Protocol.WS_CLOSE_GOING_AWAY);
      delete this.reservedSeats[sid];
      const err = e as { code?: number };
      if (err && typeof err === 'object' && !err.code) err.code = ErrorCode.APPLICATION_ERROR;
      throw e;
    }
    if (client.state === ClientState.JOINING) {
      client.ref.onclose = (code) => {
        void this.onLeaveInternal(client, code);
      };
      client.ref.onmessage = (buf) => this.onMessageInternal(client, buf);
      client.raw(joinFrame(client.reconnectionToken, 'schema', this._serializer?.handshake()));
    }
  }

  private onMessageInternal(client: Client, buf: Uint8Array): void {
    if (client.state === ClientState.LEAVING || !buf || !buf.length) return;
    const code = buf[0];
    if (code === Protocol.ROOM_DATA || code === Protocol.ROOM_DATA_BYTES) {
      let type: string | number, message: unknown;
      try {
        ({ type, message } = readClientData(buf));
      } catch (e) {
        console.error(e);
        client.leave(Protocol.WS_CLOSE_WITH_ERROR);
        return;
      }
      const h = this.onMessageHandlers[String(type)];
      try {
        if (h?.validate) message = h.validate(message);
      } catch (e) {
        console.error(e);
        client.leave(Protocol.WS_CLOSE_WITH_ERROR);
        return;
      }
      if (h) h.callback(client, message);
      else
        (this.onMessageHandlers['*'] ?? this.onMessageHandlers['__no_message_handler']!).callback(
          client,
          type,
          message,
        );
    } else if (code === Protocol.JOIN_ROOM && client.state === ClientState.JOINING) {
      client.state = ClientState.JOINED;
      client._joinedAt = this.clock.elapsedTime;
      if (this.state) this.sendFullState(client);
      for (const m of client._enqueuedMessages ?? []) client.raw(m);
      client._enqueuedMessages = undefined;
    } else if (code === Protocol.LEAVE_ROOM) {
      this.forciblyClose(client, Protocol.WS_CLOSE_CONSENTED);
    }
  }

  private forciblyClose(client: Client, code: number): void {
    client.ref.onmessage = null;
    client.ref.onclose = null;
    void this.onLeaveInternal(client, code).then(() => client.leave(code));
  }

  private async onLeaveInternal(client: Client, code: number): Promise<void> {
    client.state = ClientState.LEAVING;
    if (!this.clients.delete(client)) return;
    if (this.onLeave) {
      this._onLeaveConcurrent++;
      try {
        await this.onLeave(client, code === Protocol.WS_CLOSE_CONSENTED);
      } catch (e) {
        console.error(`onLeave error: ${(e as Error)?.message ?? e} (roomId: ${this.roomId})`);
      } finally {
        this._onLeaveConcurrent--;
      }
    }
    this.decrementClientCount();
  }

  private dequeueAfterPatch(): void {
    const n = this._afterNextPatchQueue.length;
    if (!n) return;
    const batch = this._afterNextPatchQueue.splice(0, n);
    for (const [target, args] of batch) {
      if (target === 'broadcast') (this.broadcast as (...a: unknown[]) => void)(...args);
      else target.raw(args[0] as Uint8Array);
    }
  }

  private resetAutoDisposeTimeout(seconds = 1): void {
    clearTimeout(this._autoDisposeTimeout);
    this._autoDisposeTimeout = undefined;
    if (!this.autoDispose) return;
    this._autoDisposeTimeout = setTimeout(() => {
      this._autoDisposeTimeout = undefined;
      this.disposeIfEmpty();
    }, seconds * 1000);
  }

  private decrementClientCount(): void {
    const willDispose = this.disposeIfEmpty();
    if (this._internalState === Internal.DISPOSING) return;
    if (!willDispose) this.listing.clients = Math.max(0, this.listing.clients - 1);
  }

  private disposeIfEmpty(): boolean {
    const will =
      this._onLeaveConcurrent === 0 &&
      this.autoDispose &&
      this._autoDisposeTimeout === undefined &&
      this.clients.length === 0 &&
      Object.keys(this.reservedSeats).length === 0;
    if (will) void this.dispose();
    return will;
  }

  private dispose(): Promise<void> {
    if (this._disposed) return this._disposed;
    this._internalState = Internal.DISPOSING;
    roomEvents.disposed(this);
    this._disposed = (async () => {
      try {
        const r = this.onDispose?.();
        if (this._patchInterval) {
          clearInterval(this._patchInterval);
          this._patchInterval = undefined;
        }
        if (this._simulationInterval) {
          clearInterval(this._simulationInterval);
          this._simulationInterval = undefined;
        }
        if (this._autoDisposeTimeout) {
          clearTimeout(this._autoDisposeTimeout);
          this._autoDisposeTimeout = undefined;
        }
        this.clock.clear();
        this.clock.stop();
        await r;
      } catch (e) {
        console.error(`onDispose error: ${(e as Error)?.stack ?? e} (roomId: ${this.roomId})`);
      } finally {
        this._afterDispose();
      }
    })();
    return this._disposed;
  }
}

/** Not available in the browser: the solo host (host.ts) plays the part of Server + MatchMaker. */
export class Server {
  constructor() {
    throw new Error('colyseus Server is not available in the single-player browser build');
  }
}

/** Minimal matchMaker facade backed by the local host's room registry. */
export const matchMaker = {
  rooms: new Map<string, Room>(),
  getLocalRoomById(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  },
  async query(conditions: Record<string, unknown> = {}): Promise<Array<Room['listing']>> {
    return [...this.rooms.values()]
      .map((r) => r.listing)
      .filter((l) => Object.entries(conditions).every(([k, v]) => (l as Record<string, unknown>)[k] === v));
  },
};
