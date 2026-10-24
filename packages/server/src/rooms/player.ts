import type { Client } from 'colyseus';
import type { StateView } from '@colyseus/schema';
import {
  MSG, type InputCmd, type PlayerSim, type PlayerState, type PosSample, type RhythmPlan, type Stack, type Template,
} from '@eigenlands/shared';
import { TokenBucket } from '../rate';
import { deriveStats, profileMsg, type DerivedStats } from '../systems/profile';
import type { DirtyPart, PlayerData, PlayerRef } from '../systems/types';

export interface RhythmSession {
  id: string;
  kind: 'forge' | 'fish';
  plan: RhythmPlan;
  /** real-time expiry (Date.now) */
  expires: number;
  template?: Template;
  /** forge: material ids (one entry per consumed unit) */
  ids?: string[];
  fish?: { id: string; difficulty: number };
}

export interface CastSession {
  id: string;
  tx: number;
  ty: number;
  deep: boolean;
  ocean?: boolean;
  state: 'wait' | 'bite';
  /** real-time (Date.now) */
  biteAt: number;
  deadline: number;
}

/** A connected player: the simulation state plus the Phase 2 private profile. Implements the `PlayerRef` seen by systems. */
export class ServerPlayer implements PlayerRef {
  travelExerted = false;
  travelDamageT = 0;
  queue: InputCmd[] = [];
  lastSeq = 0;
  deadT = 0;
  invuln = 1.5;
  history: PosSample[] = [];
  inView = new Set<string>();
  hurtFlash = 0;
  /** combat lag compensation: how many ticks behind the server this client's view was (0 = unknown / none) */
  viewLag = 0;
  /** server tick the client was displaying when it sent its last processed input */
  lastViewTick = 0;
  /** wall-clock ms the equipped Focus/crossbow may fire again */
  weaponReadyAt = 0;
  heldSlot = 0;
  /** tick the current dash started, and the dash that already earned a phase slip (one per dash) */
  dashTick = -1;
  slipTick = -2;
  stats: DerivedStats;
  dirtyParts = new Set<DirtyPart>();
  toolReadyAt = 0;
  regenT = 0;
  rhythm: RhythmSession | null = null;
  cast: CastSession | null = null;
  inputBucket = new TokenBucket(80, 160);
  chunkBucket = new TokenBucket(30, 60);
  useBucket = new TokenBucket(6, 10);
  craftBucket = new TokenBucket(3, 5);
  socialBucket = new TokenBucket(4, 6);
  openBucket = new TokenBucket(6, 10);
  invBucket = new TokenBucket(20, 30);

  constructor(
    readonly client: Client,
    readonly accountId: string,
    readonly state: PlayerState,
    public sim: PlayerSim,
    public name: string,
    public hp: number,
    public maxHp: number,
    public level: number,
    public xp: number,
    readonly view: StateView,
    public data: PlayerData,
  ) {
    this.stats = deriveStats(data);
  }

  get id(): string { return this.client.sessionId; }
  get x(): number { return this.sim.x; }
  get y(): number { return this.sim.y; }

  dirty(...parts: DirtyPart[]): void {
    for (const p of parts) this.dirtyParts.add(p);
    if (parts.includes('inv') || parts.includes('equip')) { this.stats = deriveStats(this.data); this.dirtyParts.add('stats'); }
  }

  toast(text: string, kind: 'info' | 'good' | 'bad' | 'item' = 'info', item?: Stack): void {
    this.client.send(MSG.TOAST, { text, kind, ...(item ? { item } : {}) });
  }

  /** Send accumulated profile changes (called once per tick). */
  flushProfile(): void {
    if (!this.dirtyParts.size) return;
    this.client.send(MSG.PROFILE, profileMsg(this.data, this.stats, this.dirtyParts));
    this.dirtyParts.clear();
  }

  sendFullProfile(): void {
    this.client.send(MSG.PROFILE, profileMsg(this.data, this.stats, 'all'));
    this.dirtyParts.clear();
  }
}
