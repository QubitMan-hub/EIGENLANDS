/**
 * Contracts between the world room and the Phase 2 systems. See docs/design/phase2-village.md.
 * `PlayerRef` is the only way systems touch a connected player; `VillageSystem` is what the room calls for NPCs.
 */
import type {
  ChunkStore,
  DeedKind,
  DialogueChatMsg,
  DialogueMsg,
  EquipState,
  Inventory,
  NpcState,
  QuestLog,
  QuestMsg,
  ShopMsg,
  ShopViewMsg,
  SkillXp,
  Stack,
  Weather,
  WorldState,
} from '@eigenlands/shared';

export interface FriendRec {
  pts: number;
  talked: number;
  gifted: number;
  /** last item id gifted to this NPC (NPC memory) */
  lastGift?: string;
  /** deeds this NPC already commented on ("kind:day") */
  noted?: string[];
}
export interface Buff {
  until: number;
  power: number;
}

/** Persisted, private per-character data (characters.data JSONB). */
export interface PlayerData {
  worldGeneration?: number;
  needs: import('@eigenlands/shared').TravelNeeds;
  inv: Inventory;
  coins: number;
  skills: SkillXp;
  recipes: Set<string>;
  /** crafting discipline XP */
  disc: import('@eigenlands/shared').DiscXp;
  equip: EquipState;
  friends: Record<string, FriendRec>;
  /** standing with each kingdom (world revision 5) */
  rep: Partial<Record<import('@eigenlands/shared').RealmId, number>>;
  buffs: Record<string, Buff>;
  /** quest log (story quests + request-board jobs) */
  quests: QuestLog;
  /** recent notable deeds, for NPC memory */
  deeds: Partial<Record<DeedKind, { day: number; what: string }>>;
  /** packed cosmetic Appearance (0 = never chosen) */
  appearance?: number;
  /** heart events already seen ("npc:index") */
  events: string[];
  /** adventure progress: Heart Crystals used, bosses defeated, shrines solved */
  prog: {
    bestiary?: string[];
    hearts: number;
    bosses: string[];
    shrines: string[];
    ruins: string[];
    /** attuned waystones, realm gates and ferry posts (travel.ts ids) */
    ways?: string[];
    /** the stone a Recall Shard returns to */
    home?: string | null;
    /** mounts owned ('horse', 'stag') */
    mounts?: string[];
    /** road caravans met (caravans.ts route ids) */
    caravans?: string[];
    /** festival feasts shared and tournaments won ("f:host:day", "t:realm:day"; the last 40) */
    fest?: string[];
    /** titles won (tournament champion titles) */
    titles?: string[];
    /** story scenes read (stories.ts ids) */
    lore?: string[];
    /** mount names and well-fed-until times (world clock ms) */
    mountNames?: Partial<Record<'horse' | 'stag' | 'griffin', string>>;
    mountFed?: Partial<Record<'horse' | 'stag' | 'griffin', number>>;
    /** food groups eaten lately (balanced-diet bonus) */
    meals?: Array<['produce' | 'protein' | 'hearty', number]>;
    /** how worn out each mount is, 0..100 */
    mountWorn?: Partial<Record<'horse' | 'stag' | 'griffin', number>>;
  };
}

export type DirtyPart =
  | 'bestiary'
  | 'inv'
  | 'coins'
  | 'skills'
  | 'disc'
  | 'recipes'
  | 'equip'
  | 'friends'
  | 'rep'
  | 'buffs'
  | 'stats'
  | 'quests'
  | 'needs';

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
  hire?: (player: PlayerRef, npcId: string) => string;
  /** a resident out on a hired contract (they keep to their home until it ends) */
  away?: (npcId: string) => boolean;
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
  /** `topic` picks a dialogue branch (see TalkMsg) */
  talk(p: PlayerRef, npcId: string, topic?: string): DialogueMsg | null;
  gift(p: PlayerRef, npcId: string, slot: number): DialogueMsg | null;
  shop(p: PlayerRef, msg: ShopMsg): ShopViewMsg | null;
  chat(p: PlayerRef, msg: DialogueChatMsg): Promise<DialogueMsg | null>;
  /** accept / turn in a quest with this villager (optional: shards without the town have no village) */
  quest?(p: PlayerRef, msg: QuestMsg): DialogueMsg | null;
  /** record a notable player deed so NPCs can gossip about it */
  rumor(kind: string, who: string, what?: string): void;
  /** NPC positions for interest management / tests */
  npc(id: string): NpcState | undefined;
  dispose(): Promise<void>;
}
