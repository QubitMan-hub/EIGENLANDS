/**
 * `colyseus.js` for solo builds (vite.config.ts resolves the game's `colyseus.js` imports here). Everything is the real
 * SDK — Room, its msgpack messages and its schema Decoder/Reflection state sync — except that the matchmaking request
 * and the socket go to the in-page host (host.ts) instead of the network.
 */
import { Client as SdkClient, MatchMakeError, Room, ServerError } from 'colyseus.js';
import type { ClientEnd } from './transport';

export * from 'colyseus.js';

type CloseEvent = { code: number; reason: string };

export class Client extends SdkClient {
  protected override async createMatchMakeRequest<T = any>(method: string, roomName: string, options: any = {}, rootSchema?: any): Promise<Room<T>> {
    const { getHost } = await import('./host');
    const host = await getHost();
    let seat;
    try {
      seat = await host.matchmake(method, roomName, JSON.parse(JSON.stringify(options ?? {})) as Record<string, unknown>);
    } catch (e) {
      throw e instanceof MatchMakeError ? e : new MatchMakeError((e as Error)?.message ?? String(e), 4213);
    }
    const room = this.createRoom<T>(seat.name, rootSchema);
    room.roomId = seat.roomId;
    room.sessionId = seat.sessionId;
    const conn: ClientEnd = host.connect(seat);
    attach(room, conn);
    return new Promise((resolve, reject) => {
      const onError = (code: number, message?: string) => reject(new ServerError(code, message ?? ''));
      room.onError.once(onError);
      (room as any).onJoin.once(() => { room.onError.remove(onError); resolve(room); });
    });
  }
}

/** Same wiring as Room.connect() in colyseus.js, with our in-memory connection in place of a WebSocket. */
function attach(room: Room, conn: ClientEnd): void {
  const r = room as any;
  r.connection = conn;
  conn.events.onmessage = Room.prototype['onMessageCallback' as keyof Room].bind(room) as (e: { data: ArrayBuffer }) => void;
  conn.events.onclose = (e: CloseEvent) => {
    if (!r.hasJoined) {
      console.warn?.(`Room connection was closed unexpectedly (${e.code}): ${e.reason}`);
      room.onError.invoke(e.code, e.reason);
      return;
    }
    room.onLeave.invoke(e.code, e.reason);
    r.destroy();
  };
  conn.events.onerror = (e: CloseEvent) => {
    console.warn?.(`Room, onError (${e.code}): ${e.reason}`);
    room.onError.invoke(e.code, e.reason);
  };
}
