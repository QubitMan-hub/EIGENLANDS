import type { InputCmd } from './sim';

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
