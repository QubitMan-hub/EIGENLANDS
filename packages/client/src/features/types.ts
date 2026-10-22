import type { Container } from 'pixi.js';
import type { ChunkStore } from '@eigenlands/shared';
import type { Sheets } from '../art/actors';
import type { Audio, Sfx } from '../audio';
import type { Fx } from '../game/fx';
import type { Profile } from '../game/profile';
import type { Input } from '../input/input';
import type { EXT_ACTIONS, KeyMap } from '../input/keymap';
import type { Interpolator, Pose, ServerClock } from '../net/interp';
import type { Net } from '../net/session';
import type { Tooltip } from '../ui/dom';
import type { Toasts } from '../ui/toast';
import type { Settings } from '../ui/ui';
import type { Windows } from '../ui/windows';

/** What the Phase 3/4 client modules may use from the game. Everything is read through functions so it is always current. */
export interface P34Deps {
  net: () => Net;
  clock: ServerClock;
  audio: Audio;
  sfx: (s: Sfx) => void;
  input: Input;
  keys: () => KeyMap;
  settings: () => Settings;
  store: () => ChunkStore;
  sheets: () => Sheets;
  /** world-space layers (iso pixels): depth-sorted entities, effects above entities, shadows */
  entityLayer: () => Container;
  fxLayer: () => Container;
  /** screen-space layer for crisp labels; use `toScreen` to place things */
  labelLayer: () => Container;
  fx: () => Fx;
  /** local player (predicted) in tiles, facing */
  me: () => { x: number; y: number; fx: number; fy: number } | null;
  myId: () => string;
  /** interpolated position of any synced entity (players, enemies, npcs) at render time */
  entityPos: (id: string) => { x: number; y: number } | null;
  /** remote entity interpolation buffer (players use their session id) */
  interp: () => Interpolator<Pose & Record<string, unknown>>;
  /** render time on the server clock (now − interpolation delay) */
  renderTime: () => number;
  /** world tile coordinates -> CSS pixel position on screen */
  toScreen: (x: number, y: number) => { x: number; y: number };
  /** current aim direction in world space (mouse, right stick, auto-aim, or facing) */
  aim: () => { x: number; y: number };
  /** selected target (enemy id or other player's session id) or null; `targetKind` tells which */
  target: () => { id: string; kind: 'enemy' | 'player' } | null;
  /** select (or with null clear) the target */
  setTarget: (id: string | null) => void;
  /** shared modal windows, tooltip, toasts and private profile (inventory, coins) */
  wins: Windows;
  tip: Tooltip;
  toasts: Toasts;
  profile: Profile;
  /** player level from the synced state */
  level: () => number;
  /** true while the player is dead */
  dead: () => boolean;
}

/** A client module (circuit, social, shard). All hooks optional. */
export interface ClientModule {
  /** server message handlers: type -> handler */
  handlers?(): Record<string, (m: any) => void>;
  /** every state patch from the server (Colyseus state object) */
  onState?(s: any): void;
  onWelcome?(): void;
  /** every rendered frame */
  frame?(now: number, dt: number): void;
  /** a window or overlay of this module wants the world to stop taking input */
  blocking?(): boolean;
  /** a hint for the bottom hint box (null = none), checked after Phase 2's tutorial hints */
  hint?(): string | null;
  debug?(): Record<string, unknown>;
  /** a Phase 3/4 input action (ability1..4, ultimate, board, chat, party); return true when handled */
  action?(a: ExtAction): boolean;
  /** an armed ability fired by a left click (aim = cursor) */
  fire?(a: ExtAction): void;
}

export type ExtAction = typeof EXT_ACTIONS[number];
