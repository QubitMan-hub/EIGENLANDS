/**
 * The Colyseus 0.16 wire protocol (frame layouts copied from @colyseus/core's Protocol.getMessageBytes) built with
 * plain Uint8Arrays, so the in-browser room speaks byte-for-byte what colyseus.js expects from a real server.
 */
import { Packr, unpack } from '@colyseus/msgpackr';
import { encode as schemaEncode, decode as schemaDecode } from '@colyseus/schema';

// schema's helpers are typed for Node Buffers but only index into the array
const encode = schemaEncode as unknown as { string(b: Uint8Array, v: string, it: { offset: number }): number; number(b: Uint8Array, v: number, it: { offset: number }): number };
const decode = schemaDecode as unknown as { stringCheck(b: Uint8Array, it: { offset: number }): boolean; string(b: Uint8Array, it: { offset: number }): string; number(b: Uint8Array, it: { offset: number }): number };

export const Protocol = {
  JOIN_ROOM: 10, ERROR: 11, LEAVE_ROOM: 12, ROOM_DATA: 13, ROOM_STATE: 14, ROOM_STATE_PATCH: 15, ROOM_DATA_BYTES: 17,
  WS_CLOSE_NORMAL: 1000, WS_CLOSE_GOING_AWAY: 1001, WS_CLOSE_CONSENTED: 4000, WS_CLOSE_WITH_ERROR: 4002,
  WS_CLOSE_DEVMODE_RESTART: 4010, WS_SERVER_DISCONNECT: 4201, WS_TOO_MANY_CLIENTS: 4202,
} as const;

export const ErrorCode = {
  MATCHMAKE_NO_HANDLER: 4210, MATCHMAKE_INVALID_CRITERIA: 4211, MATCHMAKE_INVALID_ROOM_ID: 4212, MATCHMAKE_UNHANDLED: 4213,
  MATCHMAKE_EXPIRED: 4214, AUTH_FAILED: 4215, APPLICATION_ERROR: 4216, INVALID_PAYLOAD: 4217,
} as const;

// same options as the server: plain maps, no msgpackr records
const packr = new Packr({ useRecords: false });
const te = new TextEncoder();

function header(code: number, type: string | number): Uint8Array {
  const buf = new Uint8Array(16 + (typeof type === 'string' ? type.length * 3 : 0));
  buf[0] = code;
  const it = { offset: 1 };
  if (typeof type === 'string') encode.string(buf, type, it); else encode.number(buf, type, it);
  return buf.subarray(0, it.offset);
}

function join(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a); out.set(b, a.length);
  return out;
}

/** ROOM_DATA: type + msgpack payload (a Uint8Array payload is packed as msgpack bin, like the server does). */
export function dataFrame(type: string | number, message?: unknown): Uint8Array {
  const h = header(Protocol.ROOM_DATA, type);
  return message === undefined ? h.slice() : join(h, packr.pack(message));
}

/** ROOM_DATA_BYTES: type + raw bytes. */
export function bytesFrame(type: string | number, bytes: Uint8Array): Uint8Array {
  return join(header(Protocol.ROOM_DATA_BYTES, type), bytes);
}

export function joinFrame(reconnectionToken: string, serializerId: string, handshake?: Uint8Array): Uint8Array {
  const tok = te.encode(reconnectionToken), ser = te.encode(serializerId);
  const hs = handshake ?? new Uint8Array(0);
  const out = new Uint8Array(3 + tok.length + ser.length + hs.length);
  let o = 0;
  out[o++] = Protocol.JOIN_ROOM;
  out[o++] = tok.length; out.set(tok, o); o += tok.length;
  out[o++] = ser.length; out.set(ser, o); o += ser.length;
  out.set(hs, o);
  return out;
}

export function errorFrame(code: number, message = ''): Uint8Array {
  const buf = new Uint8Array(32 + message.length * 3);
  buf[0] = Protocol.ERROR;
  const it = { offset: 1 };
  encode.number(buf, code, it);
  encode.string(buf, message, it);
  return buf.slice(0, it.offset);
}

/** Decodes a client → server ROOM_DATA / ROOM_DATA_BYTES frame (mirrors Room._onMessage). */
export function readClientData(buf: Uint8Array): { type: string | number; message: unknown } {
  const it = { offset: 1 };
  const type = decode.stringCheck(buf, it) ? decode.string(buf, it) : decode.number(buf, it);
  if (buf[0] === Protocol.ROOM_DATA_BYTES) return { type, message: buf.subarray(it.offset) };
  return { type, message: buf.byteLength > it.offset ? unpack(buf.subarray(it.offset, buf.byteLength)) : undefined };
}
