/**
 * In-memory "socket": a MessageChannel per connection. Frames are copied (the encoders reuse their buffers) and
 * delivered as separate tasks in order, so timing and ordering look like a WebSocket to both ends.
 */
import type { HostEnd } from './colyseus-shim';

export interface CloseEvent { code: number; reason: string }

/** Client end; shaped like colyseus.js' Connection (send / sendUnreliable / close / isOpen / events). */
export interface ClientEnd {
  readonly isOpen: boolean;
  events: { onmessage?: (e: { data: ArrayBuffer }) => void; onclose?: (e: CloseEvent) => void; onerror?: (e: CloseEvent) => void; onopen?: () => void };
  send(data: Uint8Array | ArrayBuffer): void;
  sendUnreliable(data: Uint8Array | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  /** page unload: the server end sees the close synchronously (its onLeave runs before the page goes away) */
  abortSync(code: number): void;
  connect(): void;
}

type Wire = { d: ArrayBuffer } | { c: number; r: string };

const copy = (data: Uint8Array | ArrayBuffer): ArrayBuffer => (data instanceof ArrayBuffer ? data.slice(0) : (data.slice().buffer as ArrayBuffer));

export function createPipe(): { client: ClientEnd; host: HostEnd } {
  const ch = new MessageChannel();
  const cp = ch.port1, hp = ch.port2;
  let open = true;
  let clientClosed = false, hostClosed = false;

  const finish = () => { if (clientClosed && hostClosed) { cp.close(); hp.close(); } };

  const host: HostEnd = {
    get open() { return open; },
    send(data) { if (open) { const b = copy(data); hp.postMessage({ d: b } satisfies Wire, [b]); } },
    close(code = 1005, reason = '') {
      if (!open) return;
      open = false;
      hp.postMessage({ c: code, r: reason } satisfies Wire); // tell the client
      queueTask(() => { hostClosed = true; host.onclose?.(code); finish(); }); // and our own 'close' event
    },
    onmessage: null,
    onclose: null,
  };

  const client: ClientEnd = {
    get isOpen() { return open; },
    events: {},
    send(data) { if (open) { const b = copy(data); cp.postMessage({ d: b } satisfies Wire, [b]); } },
    sendUnreliable(data) { client.send(data); },
    close(code = 1005, reason = '') {
      if (!open) return;
      open = false;
      cp.postMessage({ c: code, r: reason } satisfies Wire);
      queueTask(() => { clientClosed = true; client.events.onclose?.({ code, reason }); finish(); });
    },
    abortSync(code) {
      if (!open && hostClosed) return;
      open = false; clientClosed = true;
      if (!hostClosed) { hostClosed = true; host.onclose?.(code); }
      finish();
    },
    connect() {},
  };

  cp.onmessage = (e: MessageEvent<Wire>) => {
    const m = e.data;
    if ('d' in m) { if (!clientClosed) client.events.onmessage?.({ data: m.d }); return; }
    if (clientClosed) return;
    open = false; clientClosed = true;
    client.events.onclose?.({ code: m.c, reason: m.r });
    finish();
  };
  hp.onmessage = (e: MessageEvent<Wire>) => {
    const m = e.data;
    if ('d' in m) { if (!hostClosed) host.onmessage?.(new Uint8Array(m.d)); return; }
    if (hostClosed) return;
    open = false; hostClosed = true;
    host.onclose?.(m.c);
    finish();
  };
  return { client, host };
}

/** A macrotask (not throttled like setTimeout). */
export function queueTask(fn: () => void): void {
  const c = new MessageChannel();
  c.port1.onmessage = () => { c.port1.close(); fn(); };
  c.port2.postMessage(0);
}
