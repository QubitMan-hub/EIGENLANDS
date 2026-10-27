/**
 * Contracts between GameRoom (Phase 3/4 room) and its modules: circuit (progression + abilities),
 * social (party, chat, trade) and shard (handoff, ghosts, relays). See docs/design/phase3-4-circuit-multiplayer.md.
 */
import type { Schema } from '@colyseus/schema';
import type { ClassId } from '@eigenlands/shared';
import type { Enemy } from '../game/enemies';
import type { ServerPlayer } from '../rooms/player';

/** Join options a client may pass (validated by GameRoom). */
export interface JoinOpts {
  shard?: string;
  ticket?: string;
}

/** Transient per-player state carried across a shard handoff inside the signed ticket. */
export interface Carry {
  /** ability id -> ms of cooldown left */
  cd?: Record<string, number>;
  res?: number;
  /** a hunter crossing between the wilds and a gate's dungeon (features/gates) */
  gate?: {
    trip?: import('@eigenlands/shared').Gate;
    back?: { x: number; y: number };
    /** a gate this hunter just closed, for the room that shows it in the wilds */
    cleared?: string;
  };
}

export type BucketName = 'cast' | 'board' | 'party' | 'chat' | 'voice' | 'trade' | 'emote';

export interface Registrar {
  /** Register a client message handler. Unknown players, rate-limited or malformed calls are dropped. */
  on<M>(type: string, bucket: BucketName, fn: (p: ServerPlayer, msg: M) => void | Promise<void>): void;
}

export interface Module {
  install(reg: Registrar): void;
  /** after the player is in the room (WELCOME and PROFILE already sent) */
  join?(p: ServerPlayer, carry: Carry | null): Promise<void> | void;
  /** before the player is removed (leave, kick or handoff); state should be saved here */
  leave?(p: ServerPlayer, reason: 'leave' | 'handoff' | 'kick'): Promise<void> | void;
  /** autosave */
  save?(p: ServerPlayer): Promise<void>;
  /** transient state to carry into another shard */
  carry?(p: ServerPlayer, into: Carry): void;
  /** every server tick (20 Hz), before interest management */
  tick?(now: number, dt: number): void;
  /** an enemy strike is about to hurt `p` by `dmg`; return the damage to apply (0 = none) */
  outgoingDamage?(p: ServerPlayer, e: Enemy, damage: number): number;
  dealtDamage?(p: ServerPlayer, e: Enemy, damage: number): void;
  incomingDamage?(p: ServerPlayer, dmg: number, e: Enemy): number;
  killed?(e: Enemy, killer: ServerPlayer | undefined): void;
  viewEntities?(push: (id: string, x: number, y: number, st: Schema) => void): void;
  dispose?(): Promise<void>;
}

/** What the circuit module exposes to others. */
export interface CircuitApi {
  classOf(sessionId: string): ClassId;
}

/** What the social module exposes to others. */
export interface PartyApi {
  /** party id of an account ('' if none) */
  partyOf(accountId: string): string;
  /** account ids in the same party (excluding the account itself) */
  partyMates(accountId: string): string[];
}
