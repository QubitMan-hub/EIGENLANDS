import type { ChunkStore, FxMsg, WorldState } from '@eigenlands/shared';
import type { ServerPlayer } from '../rooms/player';
import type { ObjectManager } from './objects';
import type { ServerClock } from './clock';
import type { VillageSystem } from './types';

/** What the Phase 2 systems may use from the world room. */
export interface RoomApi {
  guildClear?: (p: ServerPlayer, id: string) => void;
  guildStart?: (
    p: ServerPlayer,
    id: string,
    board: import('@eigenlands/shared').WorldObj,
  ) => Promise<import('@eigenlands/shared').GuildJourney | null>;
  guildInteract?: (p: ServerPlayer, o: import('@eigenlands/shared').WorldObj) => boolean;
  seed: number;
  store: ChunkStore;
  state: WorldState;
  wclock: ServerClock;
  rand: () => number;
  players: Map<string, ServerPlayer>;
  objects: ObjectManager;
  village: VillageSystem;
  /** tiles that are currently TILLED_WET (dried at the next day rollover) */
  wet: Set<string>;
  /** per-tile hit points of gatherable nodes being worked on */
  nodeHp: Map<string, { hp: number; last: number }>;
  /** (tile,day) cooldowns for bug catching */
  bugCooldown: Set<string>;
  ensureChunk(cx: number, cy: number): Promise<void>;
  /** change a tile: persists in the chunk diff and tells nearby players */
  setTile(x: number, y: number, tile: number): void;
  /** restore `tile` at (x,y) when clock.now() >= atMs (persisted) */
  scheduleRespawn(x: number, y: number, restoreTile: number, atMs: number): void;
  fx(msg: FxMsg, exceptId?: string): void;
  nearby(x: number, y: number, radius: number): ServerPlayer[];
  /** call a boss at (x, y); false = refused (the module toasts why) */
  shrineInteract?(p: ServerPlayer, o: import('@eigenlands/shared').WorldObj): void;
  toggleShip?(p: ServerPlayer): void;
  summonBoss?(p: ServerPlayer, itemId: string, x: number, y: number): boolean;
  vaultGuard?(p: ServerPlayer, o: import('@eigenlands/shared').WorldObj): boolean;
}
