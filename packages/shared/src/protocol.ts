import type { InputCmd, PlayerSim } from './sim';
import type { Slot, Stack } from './items';
import type { RhythmPlan } from './rhythm';
import type { SkillXp } from './skills';
import type { StationId } from './recipes';
import type { Template, ForgePreview } from './forge';
import type { WorldObj } from './objects';
import type { Weather } from './weather';
import type { QuestLog, Objective } from './quests';

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
  // ── Phase 2 (client -> server)
  USE: 'use',                 // UseMsg: use hotbar item on a tile (tools, seeds, food, placeables...)
  OPEN: 'open',               // OpenMsg: open a station / chest / shelter / sign at a tile
  INV_MOVE: 'inv_move',       // InvMoveMsg
  INV_TRASH: 'inv_trash',     // InvTrashMsg
  EQUIP: 'equip',             // EquipMsg
  CRAFT: 'craft',             // CraftMsg
  EXPERIMENT: 'experiment',   // ExperimentMsg
  FORGE_PREVIEW: 'forge_preview', // ForgePreviewMsg -> FORGE_PREVIEW_R
  FORGE_START: 'forge_start', // ForgeStartMsg -> RHYTHM_START
  RHYTHM_DONE: 'rhythm_done', // RhythmDoneMsg -> RHYTHM_RESULT
  FISH_HOOK: 'fish_hook',     // FishHookMsg: reacted to the bite -> RHYTHM_START
  TALK: 'talk',               // TalkMsg -> DIALOGUE
  GIFT: 'gift',               // GiftMsg -> DIALOGUE
  SHOP: 'shop',               // ShopMsg -> SHOP_VIEW + PROFILE
  CHEST: 'chest',             // ChestMsg -> PANEL
  SHELTER: 'shelter',         // ShelterMsg -> PANEL
  QUEST: 'quest',             // QuestMsg: accept / turn in -> DIALOGUE (npc) or PANEL (request board)
  DIALOGUE_CHAT: 'dialogue_chat', // DialogueChatMsg (optional AI layer) -> DIALOGUE
  DEV: 'dev',                 // DevMsg: test/e2e helpers; ignored unless the server runs with DEV_COMMANDS=1
  // ── Phase 2 (server -> client)
  PROFILE: 'profile',         // ProfileMsg (partial updates of private player data)
  OBJ: 'obj',                 // ObjMsg: a world object appeared / changed / vanished
  PANEL: 'panel',             // PanelMsg
  FORGE_PREVIEW_R: 'forge_preview_r',
  RHYTHM_START: 'rhythm_start',
  RHYTHM_RESULT: 'rhythm_result',
  FISH_BITE: 'fish_bite',
  FISH_CAST: 'fish_cast',
  DIALOGUE: 'dialogue',
  SHOP_VIEW: 'shop_view',
  TOAST: 'toast',
} as const;

export interface InputBatch { cmds: InputCmd[] }
export interface EditMsg { tx: number; ty: number }
export interface ChunkReq { cx: number; cy: number }
export interface ChunkMsg { cx: number; cy: number; diff: Uint8Array; objs?: WorldObj[] }
export interface TileMsg { tx: number; ty: number; tile: number }

export type FxKind = 'hit' | 'swing' | 'shot' | 'dash' | 'die' | 'levelup' | 'telegraph' | 'hurt' | 'break'
  | 'chop' | 'mine' | 'till' | 'plant' | 'water' | 'harvest' | 'splash' | 'cast' | 'catch' | 'heal' | 'craft' | 'place' | 'dust' | 'poof'
  // combat 2.0
  | 'heavy'     // charged heavy strike (v = charge level 0..1, dx/dy facing)
  | 'perfect'   // perfect dodge / phase slip (id = player)
  | 'stagger'   // poise broken (id = enemy)
  | 'slam'      // wall slam (id = enemy, v = bonus damage)
  | 'orb'       // an enemy fired an orb (id = enemy, dx/dy direction)
  | 'reflect'   // a player batted an orb back (id = player)
  | 'blast'     // an area attack went off (v = radius)
  | 'bomb'      // a volatile elite is about to burst (v = fuse s, w = radius)
  | 'crash'     // a charging brute hit a wall (id = enemy)
  | 'form'      // Shapeshifter strike form (v: 0 wolf, 1 bear)
  | 'shadow';   // Shadow Army flourish (v: 0 extracted, 1 summoned, 2 evolved, 3 dismissed, 4 failed)
export interface FxMsg {
  kind: FxKind; x: number; y: number; v?: number; dx?: number; dy?: number; id?: string;
  /** hit weight: 0 light, 1 finisher, 2 heavy, 3 full heavy (hit-stop, shake, sound) */
  w?: number;
  /** 1 = critical hit */
  c?: number;
  /** 1 = this hit broke poise (stagger) */
  s?: number;
  /** attacker session id (hit), or enemy kind that dealt a killing blow (die of a player) */
  by?: string;
}

export interface WelcomeMsg {
  seed: number;
  serverNow: number;
  playerId: string;
  name: string;
  tickRate: number;
  /** server feature flags */
  features?: { aiDialogue: boolean };
}

// ───────────────────────── Phase 2 messages ─────────────────────────

/** Private per-player data. Every field is optional: the server sends only what changed (the first PROFILE is complete). */
export interface ProfileMsg {
  inv?: Slot[];
  coins?: number;
  skills?: SkillXp;
  /** ids of recipes the player knows */
  recipes?: string[];
  equip?: EquipState;
  /** active buffs: kind -> expiry (server epoch ms) */
  buffs?: Record<string, { until: number; power: number }>;
  /** friendship per NPC: points, last day talked, last day gifted */
  friends?: Record<string, { pts: number; talked: number; gifted: number }>;
  /** quest log: state + per-objective progress */
  quests?: QuestLog;
  /** heart events seen ("npc:index"), sent with quests */
  events?: string[];
  /** derived stats from equipment/buffs */
  stats?: { hpBonus: number; atkBonus: number; luck: number; haste: number; def: number; phase: number };
  /** selected quick-bar slot is client-side; this is the server's last accepted USE slot (diagnostics) */
}

export interface UseMsg { slot: number; tx: number; ty: number }
export interface OpenMsg { tx: number; ty: number }
export interface InvMoveMsg { from: number; to: number }
export interface InvTrashMsg { slot: number; n: number }
/** What a character wears and wields. */
export interface EquipState {
  ring1: Stack | null; ring2: Stack | null; outfit: number;
  /** main hand: a staff or crossbow (null = the hotbar sword) */
  weapon: Stack | null;
  head: Stack | null; chest: Stack | null; legs: Stack | null; feet: Stack | null;
}
export const EQUIP_SLOTS = ['ring1', 'ring2', 'weapon', 'head', 'chest', 'legs', 'feet'] as const;
export type EquipSlotKey = typeof EQUIP_SLOTS[number];
export interface EquipMsg { slot: number; as: 'ring1' | 'ring2' | 'outfit' | 'weapon' | 'head' | 'chest' | 'legs' | 'feet' | `unequip_${EquipSlotKey}` }
export interface CraftMsg { station: StationId; tx: number; ty: number; recipe: string; n: number }
export interface ExperimentMsg { station: StationId; tx: number; ty: number; items: Array<{ slot: number; n: number }> }
export interface ForgePreviewMsg { materials: string[] }
export interface ForgePreviewReply { ok: boolean; preview?: ForgePreview; error?: string }
export interface ForgeStartMsg { tx: number; ty: number; template: Template; slots: number[] }
export interface RhythmStartMsg {
  id: string;
  kind: 'forge' | 'fish';
  /** times are in server epoch ms; the client converts with its server clock offset */
  plan: RhythmPlan;
  label: string;
}
export interface RhythmDoneMsg { id: string; hits: number[] }
export interface RhythmResultMsg {
  id: string;
  kind: 'forge' | 'fish';
  accuracy: number;
  ok: boolean;
  text: string;
  /** the produced item, if any */
  item?: Stack;
}
export interface FishCastMsg { tx: number; ty: number }
export interface FishBiteMsg { id: string; windowMs: number }
export interface FishHookMsg { id: string }

/** `topic` picks a dialogue branch: 'ask', 'ask:about|town|qubitman|rumor', 'quest:<id>', 'event:<n>', 'back', 'bye'. */
export interface TalkMsg { npcId: string; topic?: string }
/** A response button. The client sends TALK {topic: id}, except 'accept:<quest>' / 'turnin:<quest>' which go as QUEST. */
export interface DialogueChoice { id: string; text: string; kind?: 'quest' | 'ready' | 'ask' | 'event' | 'back' | 'accept' | 'turnin' }
export interface QuestMsg { npcId: string; quest: string; action: 'accept' | 'turnin' }
export interface GiftMsg { npcId: string; slot: number }
export interface DialogueChatMsg { npcId: string; text: string }
export interface DialogueMsg {
  npcId: string;
  name: string;
  title: string;
  text: string;
  hearts: number;
  pts: number;
  doing: string;
  /** actions available on this NPC */
  canShop: boolean;
  canGift: boolean;
  canChat: boolean;
  /** recipe ids this NPC can teach right now (friendship met) */
  teaches: string[];
  /** set when replying to a gift */
  gift?: { taste: 'love' | 'like' | 'neutral' | 'hate'; delta: number };
  /** a rumor the NPC volunteers (already woven into `text` when present) */
  rumor?: string;
  /** quests this NPC can offer / is waiting on */
  quests?: Array<{ id: string; title: string; state: 'offer' | 'active' | 'ready' }>;
  /** extra pages shown (one at a time) after `text`: heart events, the legend... */
  pages?: string[];
  /** response buttons shown after the last page */
  choices?: DialogueChoice[];
  /** heart event / cutscene title */
  event?: string;
  /** portrait mood */
  mood?: 'happy' | 'sad' | 'neutral' | 'surprised' | 'angry';
  /** shop opening hours, and whether it is open right now */
  hours?: [number, number];
  shopOpen?: boolean;
  /** the conversation is over (goodbye line): the client closes after showing it */
  end?: boolean;
}

export interface ShopMsg {
  npcId: string;
  action: 'open' | 'buy' | 'sell' | 'learn';
  item?: string;
  /** buy: quantity; sell: quantity from `slot`; learn: recipe id in `item` */
  n?: number;
  slot?: number;
}
export interface ShopViewMsg {
  npcId: string;
  name: string;
  stock: Array<{ item: string; price: number }>;
  /** what the shop pays per unit for items currently in the player's pack: slot index -> price */
  sell: Record<number, number>;
  coins: number;
}

export interface ChestMsg { tx: number; ty: number; action: 'put' | 'take'; slot: number; n: number }
export interface ShelterMsg { tx: number; ty: number; action: 'add' | 'feed' | 'collect' }

export interface PanelMsg {
  kind: 'station' | 'chest' | 'shelter' | 'sign' | 'lore' | 'board';
  tx: number;
  ty: number;
  sub: string;
  station?: StationId;
  /** chest contents (30 slots) */
  chest?: Slot[];
  shelter?: { type: 'coop' | 'barn'; animals: number; max: number; fed: boolean; ready: number };
  sign?: string;
  /** reading the statue (and other lore objects) */
  lore?: { title: string; plaque: string; epitaph: string; pages: string[]; remark?: { npc: string; text: string } };
  /** the daily request board */
  board?: { day: number; requests: BoardRequest[] };
}
export interface BoardRequest {
  id: string;
  giver: string;
  title: string;
  summary: string;
  objectives: Objective[];
  progress: number[];
  coins: number;
  state: 'open' | 'active' | 'ready' | 'done' | 'expired';
  /** world day it was posted */
  day: number;
}

export interface ObjMsg { x: number; y: number; obj: WorldObj | null }
export interface ToastMsg { text: string; kind: 'info' | 'good' | 'bad' | 'item'; item?: Stack }

export const JOIN_ROOM = 'world';

/**
 * Compact binary ack: u32 seq, u32 tick, then ACK_FIELDS.length float32 of PlayerSim (80 bytes). Sent to the owner every tick.
 * Every PlayerSim field must be listed here or prediction cannot replay exactly.
 */
export const ACK_FIELDS = [
  'x', 'y', 'faceX', 'faceY', 'dashT', 'dashCd', 'dashDx', 'dashDy', 'atkCd', 'combo', 'comboT', 'skillCd',
  'dashN', 'ifrT', 'hold', 'charge', 'atkBuf', 'slipT',
] as const satisfies ReadonlyArray<keyof PlayerSim>;
export const ACK_BYTES = 8 + ACK_FIELDS.length * 4;
export interface Ack { seq: number; tick: number; sim: PlayerSim }

export function encodeAck(a: Ack): Uint8Array {
  const out = new Uint8Array(ACK_BYTES);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, a.seq >>> 0, true);
  dv.setUint32(4, a.tick >>> 0, true);
  ACK_FIELDS.forEach((k, i) => dv.setFloat32(8 + i * 4, a.sim[k], true));
  return out;
}

export function decodeAck(buf: Uint8Array): Ack {
  if (buf.byteLength !== ACK_BYTES) throw new Error('bad ack size');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sim = {} as PlayerSim;
  ACK_FIELDS.forEach((k, i) => { sim[k] = dv.getFloat32(8 + i * 4, true); });
  sim.combo = Math.round(sim.combo);
  sim.dashN = Math.round(sim.dashN);
  sim.hold = Math.round(sim.hold);
  return { seq: dv.getUint32(0, true), tick: dv.getUint32(4, true), sim };
}

/** Dev/e2e commands. Silently ignored unless `config.devCommands` (env DEV_COMMANDS=1, never in production). */
export type DevMsg =
  | { cmd: 'tp'; x: number; y: number }
  | { cmd: 'give'; id: string; n: number; p?: import('./items').Props }
  | { cmd: 'coins'; n: number }            // ADDS n coins (negative removes, floor 0)
  | { cmd: 'time'; offsetMs: number }      // ADDS offsetMs to the world clock offset (one day = 1_440_000)
  | { cmd: 'learn'; recipe: string }       // recipe id, or '*' for every recipe
  | { cmd: 'friend'; npc: string; pts: number }  // sets friendship points
  | { cmd: 'level'; level: number }
  | { cmd: 'quest'; id: string; action: 'start' | 'done' | 'reset' }  // force quest state (e2e)
  /** combat testing: spawn n enemies of `kind` around the player (d tiles away), optionally elite / night variants */
  | { cmd: 'spawn'; kind: string; n?: number; elite?: number; night?: boolean; d?: number }
  /** defeat every enemy within d tiles as the player (drops, XP, Shadow residues) */
  | { cmd: 'kill'; d?: number };
