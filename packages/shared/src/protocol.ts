import type { InputCmd, PlayerSim } from './sim';
import type { Slot, Stack } from './items';
import type { RhythmPlan } from './rhythm';
import type { SkillXp } from './skills';
import type { StationId } from './recipes';
import type { Template, ForgePreview } from './forge';
import type { WorldObj } from './objects';
import type { Weather } from './weather';

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
  DIALOGUE_CHAT: 'dialogue_chat', // DialogueChatMsg (optional AI layer) -> DIALOGUE
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
  | 'chop' | 'mine' | 'till' | 'plant' | 'water' | 'harvest' | 'splash' | 'cast' | 'catch' | 'heal' | 'craft' | 'place' | 'dust' | 'poof';
export interface FxMsg { kind: FxKind; x: number; y: number; v?: number; dx?: number; dy?: number; id?: string }

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
  equip?: { ring1: Stack | null; ring2: Stack | null; outfit: number };
  /** active buffs: kind -> expiry (server epoch ms) */
  buffs?: Record<string, { until: number; power: number }>;
  /** friendship per NPC: points, last day talked, last day gifted */
  friends?: Record<string, { pts: number; talked: number; gifted: number }>;
  /** derived stats from equipment/buffs */
  stats?: { hpBonus: number; atkBonus: number; luck: number; haste: number };
  /** selected quick-bar slot is client-side; this is the server's last accepted USE slot (diagnostics) */
}

export interface UseMsg { slot: number; tx: number; ty: number }
export interface OpenMsg { tx: number; ty: number }
export interface InvMoveMsg { from: number; to: number }
export interface InvTrashMsg { slot: number; n: number }
export interface EquipMsg { slot: number; as: 'ring1' | 'ring2' | 'outfit' | 'unequip_ring1' | 'unequip_ring2' }
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

export interface TalkMsg { npcId: string }
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
  kind: 'station' | 'chest' | 'shelter' | 'sign';
  tx: number;
  ty: number;
  sub: string;
  station?: StationId;
  /** chest contents (30 slots) */
  chest?: Slot[];
  shelter?: { type: 'coop' | 'barn'; animals: number; max: number; fed: boolean; ready: number };
  sign?: string;
}

export interface ObjMsg { x: number; y: number; obj: WorldObj | null }
export interface ToastMsg { text: string; kind: 'info' | 'good' | 'bad' | 'item'; item?: Stack }

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
