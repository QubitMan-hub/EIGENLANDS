/**
 * Contracts between the world room and the Phase 2 systems. See docs/phase2-design.md.
 * `PlayerRef` is the only way systems touch a connected player; `VillageSystem` is what the room calls for NPCs.
 */
import type {
  ChunkStore, DialogueChatMsg, DialogueMsg, Inventory, NpcState, ShopMsg, ShopViewMsg, SkillXp, Stack, Weather, WorldState,
} from '@eigenlands/shared';

export interface FriendRec { pts: number; talked: number; gifted: number }
export interface Buff { until: number; power: number }

/** Persisted, private per-character data (characters.data JSONB). */
export interface PlayerData {
  inv: Inventory;
  coins: number;
  skills: SkillXp;
  recipes: Set<string>;
  equip: { ring1: Stack | null; ring2: Stack | null; outfit: number };
  friends: Record<string, FriendRec>;
  buffs: Record<string, Buff>;
}

export type DirtyPart = 'inv' | 'coins' | 'skills' | 'recipes' | 'equip' | 'friends' | 'buffs' | 'stats';

export interface PlayerRef {
  /** colyseus session id */
  id: string;
  accountId: string;
  name: string;
  x: number;
  y: number;
  data: PlayerData;
  /** mark parts of the profile as changed so a PROFILE message is sent and the character is saved */
  dirty(...parts: DirtyPart[]): void;
  toast(text: string, kind?: 'info' | 'good' | 'bad' | 'item', item?: Stack): void;
}

/** Game time, driven by the server clock (tests can shift it). */
export interface WorldClock {
  now(): number;
  /** world day number (24 real minutes each) */
  day(): number;
  /** in-game hour 0..24 */
  hour(): number;
  /** 0 spring .. 3 winter */
  season(): number;
  weather(): Weather;
}

export interface VillageHost {
  seed: number;
  store: ChunkStore;
  state: WorldState;
  clock: WorldClock;
  rand: () => number;
  players(): Iterable<PlayerRef>;
  /** persist/restore small JSON blobs (market supply, rumors...) */
  loadBlob<T>(key: string): Promise<T | null>;
  saveBlob(key: string, value: unknown): Promise<void>;
}

export interface VillageSystem {
  /** create the 10 NpcState entries in `host.state.npcs` at their scheduled positions */
  init(): Promise<void>;
  /** called every server tick (20 Hz): move NPCs along schedules */
  tick(tick: number): void;
  /** world day rolled over */
  onNewDay(day: number): void;
  talk(p: PlayerRef, npcId: string): DialogueMsg | null;
  gift(p: PlayerRef, npcId: string, slot: number): DialogueMsg | null;
  shop(p: PlayerRef, msg: ShopMsg): ShopViewMsg | null;
  chat(p: PlayerRef, msg: DialogueChatMsg): Promise<DialogueMsg | null>;
  /** record a notable player deed so NPCs can gossip about it */
  rumor(kind: string, who: string, what?: string): void;
  /** NPC positions for interest management / tests */
  npc(id: string): NpcState | undefined;
  dispose(): Promise<void>;
}
