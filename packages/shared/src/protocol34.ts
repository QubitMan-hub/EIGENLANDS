/**
 * Phase 3 (Circuit Board) and Phase 4 (multiplayer) messages. Kept apart from Phase 2's `MSG` so the two
 * phases never edit the same lines. Every client message is validated and rate limited by the server.
 */
import type { AbilityId, ClassId } from './classes';
import type { Board, GateCounts, Locks } from './circuit';
import type { Stack } from './items';

export const MSG34 = {
  // ── Phase 3: client -> server
  ATTUNE: 'p3_attune', // AttuneMsg -> PROGRESS (or TOAST error)
  CAST: 'p3_cast', // CastMsg -> CAST_R
  ULT: 'p3_ult', // UltMsg -> CAST_R
  CHOOSE: 'p3_choose', // ChooseMsg: class / spec / second class
  BUY_RUNE: 'p3_buy_rune', // {} -> PROGRESS
  TUTORIAL: 'p3_tutorial', // TutorialMsg
  // ── Phase 3: server -> client
  PROGRESS: 'p3_progress', // ProgressMsg (partial updates; the first is complete)
  CAST_R: 'p3_cast_r', // CastResultMsg
  RES: 'p3_res', // ResourceMsg (class resource bar)
  // ── Phase 4: client -> server
  PARTY: 'p4_party', // PartyMsg
  CHAT: 'p4_chat', // ChatSendMsg
  REPORT: 'p4_report', // ReportMsg
  EMOTE: 'p4_emote', // EmoteMsg
  TRADE: 'p4_trade', // TradeMsg
  // ── Shadow Army: client -> server
  BOARD: 'sea_board', // {} toggle boarding your sloop (needs the Sloop Charter)
  EXTRACT: 'sh_extract', // {} extract the nearest residue of yours
  SHADOW_CMD: 'sh_cmd', // ShadowCmd
  // ── Shadow Army: server -> client
  SHADOW_ROSTER: 'sh_roster', // ShadowRosterMsg
  SHADOW_EV: 'sh_ev', // ShadowEvent
  // ── Adventure: server -> client
  BOSS_EV: 'ad_boss', // BossEvent
  SHRINE_EV: 'ad_shrine', // ShrineEvent
  SEA_EV: 'sea_ev', // SeaEvent
  VOICE: 'voice_sig', // VoiceSig (client -> server: {to, d}; server -> client: {from, d})
  // ── Adventure: client -> server
  SHRINE_HIT: 'ad_shrine_hit', // { shrine, idx }
  // ── Phase 4: server -> client
  PARTY_STATE: 'p4_party_state', // PartyStateMsg | { id: null }
  PARTY_INVITE: 'p4_party_invite', // PartyInviteMsg
  CHAT_MSG: 'p4_chat_msg', // ChatMsg
  EMOTE_EV: 'p4_emote_ev', // EmoteEvent
  TRADE_STATE: 'p4_trade_state', // TradeStateMsg | { id: null, reason? }
  TRADE_REQ: 'p4_trade_req', // TradeRequestMsg
  HANDOFF: 'p4_handoff', // HandoffMsg
  GHOSTS: 'p4_ghosts', // GhostsMsg
  SHARD: 'p4_shard', // ShardInfoMsg
} as const;

// ───────────────────────── Phase 3 ─────────────────────────

export interface AttuneMsg {
  board: Board;
}
/** `line` 0..3 (action bar); aim is a world-space direction (normalised by the server). */
/** `target`: optional selected enemy id or party mate's session id; the server aims at it and heals/links it (validated). */
export interface CastMsg {
  line: number;
  aimX: number;
  aimY: number;
  target?: string;
}
export interface UltMsg {
  aimX: number;
  aimY: number;
  target?: string;
}
export type ChooseMsg =
  { what: 'class'; cls: ClassId } | { what: 'spec'; spec: string } | { what: 'second'; cls: ClassId };
export type TutorialMsg = { action: 'board_open' } | { action: 'skip' } | { action: 'restart' };

export interface TutorialProgress {
  step: number;
  count: number;
  skipped: boolean;
}

/** Private progression state. Every field optional: the server sends only what changed (the first is complete). */
export interface ProgressMsg {
  cls?: ClassId;
  spec?: string | null;
  second?: ClassId | null;
  board?: Board;
  /** stored Lock-in outcomes of the attuned board */
  locks?: Locks;
  /** gate tokens owned (placed ones included) */
  gates?: GateCounts;
  runes?: number;
  /** unlocked orbs */
  qubits?: number;
  codex?: string[];
  tutorial?: TutorialProgress;
  /** server epoch ms when the next attune is allowed */
  attuneReady?: number;
  /** ability id -> server epoch ms when ready again */
  cd?: Partial<Record<AbilityId | 'ult', number>>;
}

export interface CastLineResult {
  q: number;
  ability: AbilityId | null;
  bit: 0 | 1;
  hue: number;
  misfire: boolean;
  /** fired through a Link */
  link: boolean;
  locked: boolean;
}
export interface CastResultMsg {
  ok: boolean;
  /** why the cast did not happen (cooldown, dead, no ability...) */
  error?: string;
  line: number;
  ult?: boolean;
  results: CastLineResult[];
  cd?: Partial<Record<AbilityId | 'ult', number>>;
}
export interface ResourceMsg {
  v: number;
  max: number;
}

// ───────────────────────── Phase 4 ─────────────────────────

export type PartyMsg =
  | { action: 'invite'; name: string }
  | { action: 'accept'; partyId: string }
  | { action: 'decline'; partyId: string }
  | { action: 'leave' }
  | { action: 'kick'; accountId: string }
  | { action: 'promote'; accountId: string };

export interface PartyMember {
  accountId: string;
  name: string;
  level: number;
  cls: ClassId;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  shard: string;
  online: boolean;
  /** colyseus session id when on the receiver's shard (for nameplates), else '' */
  sid: string;
}
export interface PartyStateMsg {
  id: string | null;
  leader?: string;
  members?: PartyMember[];
}
export interface PartyInviteMsg {
  partyId: string;
  from: string;
}

export type ChatChannel = 'local' | 'global' | 'party' | 'whisper' | 'system';
export interface ChatSendMsg {
  ch: Exclude<ChatChannel, 'system'>;
  text: string;
  to?: string;
}
export interface ChatMsg {
  ch: ChatChannel;
  from: string;
  /** sender account id (lets clients block); '' for system */
  fromId: string;
  to?: string;
  text: string;
  t: number;
}
export interface ReportMsg {
  name: string;
  reason: string;
}

export const EMOTES = ['wave', 'dance', 'cheer', 'sit', 'bow', 'laugh', 'heart', 'think'] as const;
export type Emote = (typeof EMOTES)[number];
export const EMOTE_GLYPH: Record<Emote, string> = {
  wave: '👋',
  dance: '💃',
  cheer: '🎉',
  sit: '🪑',
  bow: '🙇',
  laugh: '😄',
  heart: '❤',
  think: '💭',
};
export interface EmoteMsg {
  e: Emote;
}
export interface EmoteEvent {
  id: string;
  e: Emote;
}

export interface TradeOffer {
  items: Array<{ slot: number; stack: Stack }>;
  coins: number;
}
export type TradeMsg =
  | { action: 'request'; name: string }
  | { action: 'accept'; id: string }
  | { action: 'decline'; id: string }
  | { action: 'offer'; items: Array<{ slot: number; n: number }>; coins: number }
  | { action: 'confirm' }
  | { action: 'cancel' };
export interface TradeRequestMsg {
  id: string;
  from: string;
}
export interface TradeStateMsg {
  id: string | null;
  /** when closing: 'done' | 'cancelled' | an explanation */
  reason?: string;
  other?: string;
  mine?: TradeOffer;
  theirs?: TradeOffer;
  myConfirm?: boolean;
  theirConfirm?: boolean;
}

/** `roomId` is set when the target shard already runs somewhere (join it directly). */
export interface HandoffMsg {
  shard: string;
  ticket: string;
  roomId?: string;
}
export interface ShardInfoMsg {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Ghost {
  id: string;
  name: string;
  x: number;
  y: number;
  faceX: number;
  faceY: number;
  look: number;
  level: number;
  cls: number;
  hp: number;
  maxHp: number;
  flags: number;
}
export interface GhostsMsg {
  t: number;
  list: Ghost[];
}

export const CHAT_MAX = 200;
export const PARTY_MAX = 5;
export const TRADE_MAX_ITEMS = 8;
export const TRADE_RANGE = 6;
export const LOCAL_CHAT_RANGE = 24;

// ───────────────────────── Shadow Army ─────────────────────────

import type { Stance } from './shadows';
export type ShadowCmd =
  | { act: 'befriend'; target: string }
  | { act: 'summon'; id: string }
  | { act: 'dismiss'; id: string }
  | { act: 'dismiss_all' }
  | { act: 'stance'; stance: Stance }
  | { act: 'focus'; target: string | null }
  | { act: 'rename'; id: string; name: string }
  | { act: 'release'; id: string }
  | { act: 'extend'; id: string }
  /** trade places with a summoned shadow (the farthest one when no id is given) */
  | { act: 'exchange'; id?: string }
  | { act: 'domain' };

/** Seafaring notices to the sailor (the ship itself is PlayerSim.boat). */
export type SeaEvent = { kind: 'board' } | { kind: 'land' };

/** Proximity voice chat: peers connect over WebRTC; the room only relays handshakes between players who are close. */
export const VOICE_RELAY_RANGE = 40;
/** full volume inside this many tiles, silent beyond VOICE_FAR */
export const VOICE_NEAR = 5;
export const VOICE_FAR = 28;
export type VoiceSignal =
  | { t: 'offer' | 'answer'; sdp: string }
  | { t: 'ice'; c: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } }
  | { t: 'bye' };
export interface VoiceMsg {
  to: string;
  d: VoiceSignal;
}
export interface VoiceIn {
  from: string;
  d: VoiceSignal;
}

/** Voice gain for a listener `dist` tiles from the speaker: flat up close, then a smooth fall to silence. */
export function voiceGain(dist: number): number {
  if (dist <= VOICE_NEAR) return 1;
  if (dist >= VOICE_FAR) return 0;
  const t = (dist - VOICE_NEAR) / (VOICE_FAR - VOICE_NEAR);
  return (1 - t) * (1 - t);
}
