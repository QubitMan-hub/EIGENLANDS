import type { InputCmd, PlayerSim } from './sim';

export const MSG = {
  INPUT: 'input',
  EDIT: 'edit',
  CHUNK_REQ: 'chunk?',
  CHUNK: 'chunk',
  TILE: 'tile',
  FX: 'fx',
  PING: 'ping',
  PONG: 'pong',
  WELCOME: 'welcome',
  NOTICE: 'notice',
  ACK: 'ack',
} as const;

export interface InputBatch { cmds: InputCmd[] }
export interface EditMsg { tx: number; ty: number }
export interface ChunkReq { cx: number; cy: number }
export interface ChunkMsg { cx: number; cy: number; diff: Uint8Array }
export interface TileMsg { tx: number; ty: number; tile: number }

export type FxKind = 'hit' | 'swing' | 'shot' | 'dash' | 'die' | 'levelup' | 'telegraph' | 'hurt' | 'break';
export interface FxMsg { kind: FxKind; x: number; y: number; v?: number; dx?: number; dy?: number; id?: string }

export interface WelcomeMsg {
  seed: number;
  serverNow: number;
  playerId: string;
  name: string;
  tickRate: number;
}

export const JOIN_ROOM = 'world';

/** Compact binary ack: u32 seq, u32 tick, then 12 float32 of PlayerSim (56 bytes). Sent to the owner every tick. */
export const ACK_BYTES = 56;
export interface Ack { seq: number; tick: number; sim: PlayerSim }

export function encodeAck(a: Ack): Uint8Array {
  const out = new Uint8Array(ACK_BYTES);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, a.seq >>> 0, true);
  dv.setUint32(4, a.tick >>> 0, true);
  const s = a.sim;
  const f = [s.x, s.y, s.faceX, s.faceY, s.dashT, s.dashCd, s.dashDx, s.dashDy, s.atkCd, s.combo, s.comboT, s.skillCd];
  for (let i = 0; i < 12; i++) dv.setFloat32(8 + i * 4, f[i]!, true);
  return out;
}

export function decodeAck(buf: Uint8Array): Ack {
  if (buf.byteLength !== ACK_BYTES) throw new Error('bad ack size');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const f = (i: number) => dv.getFloat32(8 + i * 4, true);
  return {
    seq: dv.getUint32(0, true),
    tick: dv.getUint32(4, true),
    sim: {
      x: f(0), y: f(1), faceX: f(2), faceY: f(3), dashT: f(4), dashCd: f(5), dashDx: f(6), dashDy: f(7),
      atkCd: f(8), combo: Math.round(f(9)), comboT: f(10), skillCd: f(11),
    },
  };
}
