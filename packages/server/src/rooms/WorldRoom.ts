import { generationMeta, tileAt, isSolid, validAppearance, catalogMobDrops } from '@eigenlands/shared';
import {
  DIFFICULTY_RULES,
  ENEMY_KEY_BY_KIND,
  caveBiomeAt,
  caveRegionAt,
  highGroundRange,
  injuryOnHit,
} from '@eigenlands/shared';
import { Client, Room, ServerError } from 'colyseus';
import { StateView } from '@colyseus/schema';
import {
  ATK,
  attackDamage,
  weaponShotPower,
  weaponRecovery,
  BASE_PLAYER_HP,
  ChunkStore,
  CHARGE_MIN,
  DASH_CHARGES,
  ELITE,
  ELITE_XP_MULT,
  ENEMY_DEFS,
  INTEREST_RADIUS,
  MAX_REWIND_TICKS,
  MSG,
  NAME_MAX,
  ORB_RADIUS,
  ORB_RANGE,
  ORB_SPEED,
  ORB_SPREAD,
  PLAYER_RADIUS,
  PROJECTILE_DAMAGE,
  PROJECTILE_RADIUS,
  PROJECTILE_RANGE,
  PROJECTILE_SPEED,
  CHUNK_SIZE,
  REFLECT_DAMAGE,
  REFLECT_SPEED_MULT,
  SKILL_POISE,
  SLAM_POISE,
  SLIP_SLOW_RADIUS,
  SLIP_SLOW_TIME,
  SLIP_TIME,
  BOMB_FUSE,
  BOMB_RADIUS,
  CRIT_MULT,
  moveBody,
  TICK_DT,
  enemyScale,
  eliteChance,
  hasIframes,
  meleeTap,
  meleeHeavy,
  setMeleeWeapon,
  isPerfectDodge,
  pickSpawn,
  REALM_BEAST,
  inRealmLand,
  type EnemyKindName,
  resolveHit,
  rollCrit,
  shapeHits,
  slamDamage,
  spawnBudget,
  simulationBudget,
  type ObjMsg,
  type StepEvents,
  type StrikeShape,
  TICK_MS,
  TILE_DEFS,
  PlayerState,
  ProjectileState,
  WorldState,
  chunkOf,
  encodeAck,
  encodeDiff,
  inArc,
  isNight,
  maxHpForLevel,
  newPlayerSim,
  rewindPosition,
  sanitizeCmd,
  segmentHitsCircle,
  stepPlayer,
  xpForLevel,
  T,
  buildingAt,
  type ChunkDiff,
  type FxMsg,
  type InputBatch,
  type InputCmd,
  type PlayerSim,
  type PosSample,
  type Stack,
  type WelcomeMsg,
  type ChunkReq,
  type WorldObj,
  type TalkMsg,
  type GiftMsg,
  type ShopMsg,
  type DialogueChatMsg,
  type DevMsg,
  type UseMsg,
  type OpenMsg,
  type InvMoveMsg,
  type InvTrashMsg,
  type EquipMsg,
  type CraftMsg,
  type ExperimentMsg,
  type GearMsg,
  type ForgePreviewMsg,
  type ForgeStartMsg,
  type RhythmDoneMsg,
  type FishHookMsg,
  type ChestMsg,
  type ShelterMsg,
  type NpcState,
  type SpellState,
  biomeAt,
  isCaveY,
  isUpperY,
  isDiveY,
  sanctuaryAt,
  CANNON,
  ITEMS,
  MORPH_FORMS,
  WEAPONS,
  isRangedWeapon,
  type WeaponDef,
  type WeaponShot,
} from '@eigenlands/shared';
import { verifyToken } from '../auth/token';
import { createEnemy, enemyDamage, stepEnemies, type Enemy, type EnemyKind, type SpawnOpts } from '../game/enemies';
import { TokenBucket } from '../rate';
import type { RoomApi } from '../systems/api';
import type { ServerClock } from '../systems/clock';
import { handleChest, handleOpen, handleShelter } from '../systems/containers';
import { handleCraft, handleExperiment } from '../systems/crafting';
import { handleGear, wearLight, wearOnHit, wearWeapon } from '../systems/gear';
import { dailyRollover, refreshCrop, rollShelter } from '../systems/farming';
import { handleHook, tickFishing } from '../systems/fishing';
import { handleForgePreview, handleForgeStart, handleRhythmDone } from '../systems/forging';
import { addSkillXp, giveStacks } from '../systems/helpers';
import { handleEquip, handleInvMove, handleInvTrash, lookOf } from '../systems/inventory';
import { ObjectManager } from '../systems/objects';
import { loadPlayerData, serializePlayerData } from '../systems/profile';
import { inflict, setTravelMode, tickTravelNeeds } from '../systems/travel-needs';
import { handleUse } from '../systems/tools';
import { handleDev } from '../systems/dev';
import { onKill, registerQuests } from '../systems/quests';
import type { PlayerRef, VillageHost, VillageSystem } from '../systems/types';
import { createVillage } from '../systems/village';
import { ServerPlayer } from './player';
import { runtime, worldClock } from './runtime';

interface Projectile {
  state: ProjectileState;
  x: number;
  y: number;
  dx: number;
  dy: number;
  travelled: number;
  owner: string;
  team: 'player' | 'enemy';
  speed: number;
  range: number;
  radius: number;
  /** fixed damage (enemy orbs, reflected orbs); player bolts compute theirs on impact */
  dmg: number;
  history: PosSample[];
  /** tick an enemy orb ended: kept a few ticks so lagged players can still be hit by what they saw */
  endTick: number;
  /** players that dodged it */
  passed: Set<string>;
  src: Enemy | null;
  /** terrain level the shot left from: higher ground (a cliff or more) stops it */
  level: number;
}

/** An enemy strike waiting to be resolved against players whose view lags behind (defender-favouring lag compensation). */
interface PendingStrike {
  e: Enemy;
  shape: StrikeShape;
  dmg: number;
  weight: number;
  tick: number;
  waiting: Set<string>;
  /** players already hit/dodged by this attack (charges sweep many ticks) */
  dedupe: Set<string> | null;
}

/** Combat options for a hit on an enemy. Abilities (hitEnemy) pass none: weight 0, poise from damage. */
export interface HitOpts {
  weight?: number;
  poise?: number;
  crit?: boolean;
  counter?: boolean;
}

const RESPAWN_TIME = 3;

interface Respawn {
  x: number;
  y: number;
  restore: number;
  at: number;
}

/** Live server metrics for /metrics (telemetry hook; one world room per process in Phase 1). */
export const metrics = { players: 0, enemies: 0, tickMsAvg: 0, tickMsMax: 0, ticks: 0, overBudget: 0 };

const SPAWN = { x: 0.5, y: 4.5 };
const MAX_QUEUE = 24;
const MAX_ENEMIES = 48;
const MAX_FAUNA = 24;
const key = (cx: number, cy: number) => `${cx},${cy}`;

export class WorldRoom extends Room<WorldState> implements RoomApi {
  maxClients = 100;
  state = new WorldState();

  seed = 0;
  private migrateHydrology = false;
  store!: ChunkStore;
  wclock!: ServerClock;
  objects!: ObjectManager;
  village!: VillageSystem;
  players = new Map<string, ServerPlayer>();
  enemies = new Map<string, Enemy>();
  projectiles = new Map<string, Projectile>();
  wet = new Set<string>();
  nodeHp = new Map<string, { hp: number; last: number }>();
  bugCooldown = new Set<string>();
  private respawns = new Map<string, Respawn>();
  private respawnDirty = new Map<string, Respawn>();
  private respawnGone = new Map<string, { x: number; y: number }>();
  private loaded = new Set<string>();
  private loading = new Map<string, Promise<void>>();
  private dirtyChunks = new Set<string>();
  protected byAccount = new Map<string, ServerPlayer>();
  private spawnTimer = 0;
  private encounterAt = new Map<string, number>();
  private autosaveTimer = 0;
  private projSeq = 0;
  private strikes: PendingStrike[] = [];
  private bombs: Array<{ e: Enemy; x: number; y: number; t: number }> = [];
  private processedDay = 0;
  private secondT = 0;
  /** injectable for deterministic tests */
  rand: () => number = Math.random;

  async onCreate(): Promise<void> {
    const rt = runtime();
    this.seed = rt.config.worldSeed;
    this.wclock = worldClock();
    const metaKey = `worldgen:${this.seed}`,
      saved = await rt.repo.getBlob(metaKey),
      meta = generationMeta(saved, {
        hasWorldData: saved == null ? await rt.repo.hasWorldData() : true,
        fresh: rt.config.newWorldGeneration,
      });
    this.migrateHydrology = meta.migratedFrom === 1;
    await rt.repo.putBlob(metaKey, meta);
    this.store = new ChunkStore(this.seed, 512, meta.version);
    this.objects = new ObjectManager({
      store: this.store,
      seed: this.seed,
      players: this.players,
      objectChanged: (m) => this.hookObjectChanged(m),
    });
    this.processedDay = this.wclock.day();
    this.setPatchRate(TICK_MS);
    let remainder = 0;
    this.setSimulationInterval((elapsed) => {
      const budget = simulationBudget(remainder, elapsed);
      remainder = budget.remainder;
      for (let i = 0; i < budget.steps; i++) this.tick();
    }, TICK_MS);

    const host: VillageHost = {
      seed: this.seed,
      store: this.store,
      state: this.state,
      clock: this.wclock,
      rand: () => this.rand(),
      players: () => this.players.values() as Iterable<PlayerRef>,
      loadBlob: (k) => rt.repo.getBlob(k),
      saveBlob: (k, v) => rt.repo.putBlob(k, v),
    };
    this.village = this.makeVillage(host);
    await this.village.init();

    this.onMessage(MSG.INPUT, (client, msg: InputBatch) => this.onInput(client, msg));
    this.onMessage(MSG.CHUNK_REQ, (client, msg: ChunkReq) => {
      void this.onChunkReq(client, msg);
    });
    this.onMessage(MSG.PING, (client, msg: { t: number }) => {
      client.send(MSG.PONG, { t: typeof msg?.t === 'number' ? msg.t : 0, st: this.wclock.now() });
    });

    type Bucket = 'useBucket' | 'craftBucket' | 'socialBucket' | 'openBucket' | 'invBucket';
    const on = <M>(type: string, bucket: Bucket, fn: (p: ServerPlayer, msg: M) => void | Promise<void>) => {
      this.onMessage(type, (client, msg: M) => {
        const p = this.players.get(client.sessionId);
        if (!p || !p[bucket].take() || !this.hookAccepts(p, msg)) return; // unknown player, over the rate limit or not this shard's tile: drop silently
        try {
          const r = fn(p, msg);
          if (r instanceof Promise) r.catch((e) => console.error(`${type} failed`, e));
        } catch (e) {
          console.error(`${type} failed`, e);
        }
      });
    };
    on<DevMsg>(MSG.DEV, 'invBucket', (p, m) =>
      m?.cmd === 'spawn' ? this.devSpawn(p, m) : m?.cmd === 'kill' ? this.devKill(p, m) : handleDev(this, p, m),
    );
    on<{ slot: number }>(MSG.HOLD, 'invBucket', (p, m) => {
      if (Number.isInteger(m?.slot) && m.slot >= 0 && m.slot < 10) p.heldSlot = m.slot;
    });
    on<{ mode?: unknown }>(MSG.TRAVEL_MODE, 'invBucket', (p, m) => setTravelMode(p, m));
    on<UseMsg>(MSG.USE, 'useBucket', (p, m) => handleUse(this, p, m));
    on<OpenMsg>(MSG.OPEN, 'openBucket', (p, m) => handleOpen(this, p, m));
    on<InvMoveMsg>(MSG.INV_MOVE, 'invBucket', (p, m) => handleInvMove(p, m));
    on<InvTrashMsg>(MSG.INV_TRASH, 'invBucket', (p, m) => handleInvTrash(p, m));
    on<EquipMsg>(MSG.EQUIP, 'invBucket', (p, m) => handleEquip(p, m));
    on<{ app?: unknown }>(MSG.APPEARANCE, 'invBucket', (p, m) => {
      p.data.appearance = p.state.app = validAppearance(m?.app);
      p.dirty('equip');
    });
    on<CraftMsg>(MSG.CRAFT, 'craftBucket', (p, m) => handleCraft(this, p, m));
    on<ExperimentMsg>(MSG.EXPERIMENT, 'craftBucket', (p, m) => handleExperiment(this, p, m));
    on<GearMsg>(MSG.GEAR, 'craftBucket', (p, m) => handleGear(this, p, m));
    on<ForgePreviewMsg>(MSG.FORGE_PREVIEW, 'craftBucket', (p, m) => handleForgePreview(p, m));
    on<ForgeStartMsg>(MSG.FORGE_START, 'craftBucket', (p, m) => handleForgeStart(this, p, m));
    on<RhythmDoneMsg>(MSG.RHYTHM_DONE, 'craftBucket', (p, m) => handleRhythmDone(this, p, m));
    on<FishHookMsg>(MSG.FISH_HOOK, 'craftBucket', (p, m) => handleHook(this, p, m));
    on<ChestMsg>(MSG.CHEST, 'openBucket', (p, m) => handleChest(this, p, m));
    on<ShelterMsg>(MSG.SHELTER, 'openBucket', (p, m) => handleShelter(this, p, m));
    on<TalkMsg>(MSG.TALK, 'socialBucket', (p, m) => {
      if (this.guildTalk?.(p, m?.npcId)) return;
      if (!this.npcNear(p, m?.npcId)) return;
      const d = this.village.talk(p, m.npcId, typeof m.topic === 'string' ? m.topic : undefined);
      if (d) p.client.send(MSG.DIALOGUE, d);
    });
    on<GiftMsg>(MSG.GIFT, 'socialBucket', (p, m) => {
      if (!this.npcNear(p, m?.npcId)) return;
      const d = this.village.gift(p, m.npcId, m.slot);
      if (d) p.client.send(MSG.DIALOGUE, d);
    });
    on<ShopMsg>(MSG.SHOP, 'socialBucket', (p, m) => {
      if (!this.npcNear(p, m?.npcId)) return;
      const v = this.village.shop(p, m);
      if (v) p.client.send(MSG.SHOP_VIEW, v);
    });
    registerQuests(this, on);
    on<DialogueChatMsg>(MSG.DIALOGUE_CHAT, 'socialBucket', async (p, m) => {
      if (!this.npcNear(p, m?.npcId)) return;
      const d = await this.village.chat(p, m);
      if (d) p.client.send(MSG.DIALOGUE, d);
    });
  }

  /** NPCs can only be addressed from nearby. */
  private npcNear(p: ServerPlayer, id: unknown): boolean {
    if (typeof id !== 'string') return false;
    const n = this.village.npc(id) as NpcState | undefined;
    return !!n && Math.hypot(n.x - p.sim.x, n.y - p.sim.y) <= 7;
  }

  async onAuth(_client: Client, options: { token?: string }): Promise<{ accountId: string }> {
    const rt = runtime();
    const id = verifyToken(options?.token, rt.config.sessionSecret);
    if (!id || !(await rt.repo.getAccount(id))) throw new ServerError(401, 'unauthorized');
    return { accountId: id };
  }

  async onJoin(client: Client, options: { name?: string }, auth: { accountId: string }): Promise<void> {
    const rt = runtime();
    const accountId = auth.accountId;

    // one live session per account
    const prev = this.byAccount.get(accountId);
    if (prev) {
      prev.client.send(MSG.NOTICE, { text: 'Signed in from another place.' });
      prev.client.leave(4001);
      await this.removePlayer(prev, false);
    }

    let ch = await rt.repo.getCharacter(accountId);
    if (!ch) {
      const name = sanitizeName(options?.name) || `Wanderer${Math.floor(this.rand() * 9000 + 1000)}`;
      ch = await rt.repo.createCharacter(accountId, name, SPAWN.x, SPAWN.y);
    }
    await this.ensureAround(chunkOf(Math.floor(ch.x)), chunkOf(Math.floor(ch.y)), 1);

    // Old saved cave positions can become rock after the network upgrade. Preserve edits,
    // but move a trapped traveller to the dry district junction rather than leaving them stuck.
    if (isCaveY(ch.y) && !isDiveY(ch.y) && this.store.solidAt(Math.floor(ch.x), Math.floor(ch.y))) {
      const r = caveRegionAt(this.seed, ch.x, ch.y);
      await this.ensureAround(chunkOf(r.x), chunkOf(r.y), 1);
      for (let radius = 0; radius <= 12; radius++) {
        let found = false;
        for (let dy = -radius; dy <= radius && !found; dy++)
          for (let dx = -radius; dx <= radius && !found; dx++)
            if (!this.store.solidAt(r.x + dx, r.y + dy)) {
              ch.x = r.x + dx + 0.5;
              ch.y = r.y + dy + 0.5;
              found = true;
            }
        if (found) break;
      }
    }
    const oldSurfaceTile = tileAt(this.seed, Math.floor(ch.x), Math.floor(ch.y), 1);
    const currentSurfaceTile = this.store.getTile(Math.floor(ch.x), Math.floor(ch.y));
    const drainedOldWater =
      (oldSurfaceTile === T.WATER || oldSurfaceTile === T.DEEP_WATER) &&
      currentSurfaceTile !== T.WATER &&
      currentSurfaceTile !== T.DEEP_WATER;
    if (
      this.migrateHydrology &&
      ch.data.worldGeneration !== this.store.generation &&
      Math.abs(ch.y) < 10000 &&
      (!isSolid(oldSurfaceTile) || drainedOldWater) &&
      this.store.solidAt(Math.floor(ch.x), Math.floor(ch.y))
    ) {
      const ox = Math.floor(ch.x),
        oy = Math.floor(ch.y);
      let found = false;
      for (let r = 1; r <= 48 && !found; r++)
        for (let dy = -r; dy <= r && !found; dy++)
          for (let dx = -r; dx <= r && !found; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            if (!this.store.solidAt(ox + dx, oy + dy)) {
              ch.x = ox + dx + 0.5;
              ch.y = oy + dy + 0.5;
              found = true;
            }
          }
      if (!found) {
        ch.x = SPAWN.x;
        ch.y = SPAWN.y;
      }
      await this.ensureAround(chunkOf(Math.floor(ch.x)), chunkOf(Math.floor(ch.y)), 1);
    }
    const data = loadPlayerData(ch.data, this.wclock.season(), this.wclock.now());
    data.worldGeneration = this.store.generation;
    const st = new PlayerState();
    st.id = client.sessionId;
    st.name = ch.name;
    st.x = ch.x;
    st.y = ch.y;
    st.look = data.equip.outfit;
    st.app = data.appearance ?? 0;
    const p = new ServerPlayer(
      client,
      accountId,
      st,
      newPlayerSim(ch.x, ch.y),
      ch.name,
      0,
      0,
      ch.level,
      ch.xp,
      new StateView(),
      data,
    );
    p.maxHp = maxHpForLevel(ch.level, BASE_PLAYER_HP) + p.stats.hpBonus;
    p.hp = Math.min(ch.hp > 0 ? ch.hp : p.maxHp, p.maxHp);
    st.hp = p.hp;
    st.maxHp = p.maxHp;
    st.level = p.level;
    client.view = p.view;
    this.players.set(client.sessionId, p);
    this.byAccount.set(accountId, p);
    this.state.players.set(client.sessionId, st);
    p.view.add(st);
    p.inView.add(st.id);
    await rt.presence.set(accountId, client.sessionId);

    const welcome: WelcomeMsg = {
      seed: rt.config.worldSeed,
      generation: this.store.generation,
      serverNow: this.wclock.now(),
      playerId: client.sessionId,
      name: ch.name,
      tickRate: Math.round(1000 / TICK_MS),
      features: { aiDialogue: process.env.AI_DIALOGUE === '1' && !!process.env.ANTHROPIC_API_KEY },
    };
    client.send(MSG.WELCOME, welcome);
    p.sendFullProfile();
  }

  async onLeave(client: Client): Promise<void> {
    const p = this.players.get(client.sessionId);
    if (p) await this.removePlayer(p, true);
  }

  async onDispose(): Promise<void> {
    try {
      await this.flushAll();
      await Promise.all([...this.players.values()].map((p) => this.savePlayer(p)));
      await this.village.dispose();
    } catch (e) {
      console.error('dispose failed', e);
    }
  }

  // ───────────────────────── helpers ─────────────────────────

  protected async removePlayer(p: ServerPlayer, save: boolean): Promise<void> {
    if (this.players.get(p.client.sessionId) !== p) return;
    this.players.delete(p.client.sessionId);
    if (this.byAccount.get(p.accountId) === p) this.byAccount.delete(p.accountId);
    this.state.players.delete(p.client.sessionId);
    const rt = runtime();
    await rt.presence.clear(p.accountId, p.client.sessionId).catch(() => {});
    if (save) await this.savePlayer(p).catch((e) => console.error('save failed', e));
  }

  protected async savePlayer(p: ServerPlayer): Promise<void> {
    await runtime().repo.saveCharacter({
      accountId: p.accountId,
      x: p.sim.x,
      y: p.sim.y,
      hp: Math.max(1, p.hp),
      level: p.level,
      xp: p.xp,
      data: serializePlayerData(p.data),
    });
  }

  ensureChunk(cx: number, cy: number): Promise<void> {
    const k = key(cx, cy);
    if (this.loaded.has(k)) return Promise.resolve();
    let pr = this.loading.get(k);
    if (!pr) {
      pr = this.loadChunk(cx, cy)
        .then(() => {
          this.loaded.add(k);
          this.repairHydrology(cx, cy);
          this.loading.delete(k);
        })
        .catch((e) => {
          this.loading.delete(k);
          throw e;
        });
      this.loading.set(k, pr);
    }
    return pr;
  }

  /** Preserve old dry foundations/access around durable ownership; saved tile edits always win. */
  private repairHydrology(cx: number, cy: number): void {
    if (!this.migrateHydrology || Math.abs(cy * CHUNK_SIZE) >= 10000) return;
    const legacyOwner = (x: number, y: number) => {
      const object = this.store.objectAt(x, y),
        structure = this.store.structureAt(x, y);
      return (
        (object?.owner && object.data?.worldGeneration !== this.store.generation) ||
        (structure?.owner && structure.data.worldGeneration !== this.store.generation)
      );
    };
    const repair = (x: number, y: number) => {
      const rx = chunkOf(x),
        ry = chunkOf(y);
      if (!this.loaded.has(key(rx, ry))) return;
      const c = this.store.get(rx, ry),
        index = (y - ry * CHUNK_SIZE) * CHUNK_SIZE + x - rx * CHUNK_SIZE;
      const tile = c.tiles[index];
      if (c.diff.has(index) || (tile !== T.WATER && tile !== T.DEEP_WATER && tile !== T.LAVA)) return;
      const old = tileAt(this.seed, x, y, 1);
      if (!isSolid(old)) this.setTile(x, y, old);
    };
    for (let y = cy * CHUNK_SIZE; y < (cy + 1) * CHUNK_SIZE; y++)
      for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x++) {
        const owned = legacyOwner(x, y);
        if (owned) {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) repair(x + dx, y + dy);
        } else if (
          ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE === 0 ||
          (x + 1) % CHUNK_SIZE === 0 ||
          ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE === 0 ||
          (y + 1) % CHUNK_SIZE === 0
        ) {
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (legacyOwner(x + dx, y + dy)) repair(x, y);
            }
        }
      }
  }

  /** Diff + objects + respawns, then lazy catch-up for time that passed while nobody was here. */
  private async loadChunk(cx: number, cy: number): Promise<void> {
    const repo = runtime().repo;
    const [chunk, objs, resp] = await Promise.all([
      repo.loadChunk(this.seed, cx, cy),
      repo.loadObjects(this.seed, cx, cy),
      repo.loadRespawns(this.seed, cx, cy),
    ]);
    const today = this.wclock.day();
    // edits made while loading take precedence
    const merged: ChunkDiff = new Map([...chunk.diff, ...this.store.get(cx, cy).diff]);
    let changed = false;
    for (const [idx, t] of merged) {
      if (t !== T.TILLED_WET) continue;
      if (chunk.day === null || chunk.day < today) {
        merged.set(idx, T.TILLED);
        changed = true;
      } // soil dried overnight
      else this.wet.add(`${cx * CHUNK_SIZE + (idx % CHUNK_SIZE)},${cy * CHUNK_SIZE + Math.floor(idx / CHUNK_SIZE)}`);
    }
    this.store.applyDiff(cx, cy, merged);
    if (changed) this.dirtyChunks.add(key(cx, cy));
    this.objects.load(objs);
    for (const o of this.objects.inChunk(cx, cy)) {
      let touched = false;
      if (o.kind === 'crop') touched = refreshCrop(this, o, today);
      else if (o.kind === 'shelter') touched = rollShelter(o, today);
      if (touched) this.objects.update(o);
    }
    const now = this.wclock.now();
    for (const r of resp) {
      if (r.at <= now) this.applyRespawn(r);
      else this.respawns.set(`${r.x},${r.y}`, r);
    }
  }

  private async ensureAround(cx: number, cy: number, r: number): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) jobs.push(this.ensureChunk(x, y));
    await Promise.all(jobs);
  }

  private async flushChunks(): Promise<void> {
    if (!this.dirtyChunks.size) return;
    const batch = [...this.dirtyChunks];
    this.dirtyChunks.clear();
    const diffs = batch.map((k) => {
      const [cx, cy] = k.split(',').map(Number) as [number, number];
      return { cx, cy, diff: this.store.get(cx, cy).diff };
    });
    try {
      await runtime().repo.saveChunkDiffs(this.seed, diffs, this.wclock.day());
    } catch (e) {
      batch.forEach((k) => this.dirtyChunks.add(k)); // retry next time; never lose edits
      throw e;
    }
  }

  private async flushRespawns(): Promise<void> {
    if (!this.respawnDirty.size && !this.respawnGone.size) return;
    const ups = [...this.respawnDirty.values()],
      dels = [...this.respawnGone.values()];
    this.respawnDirty.clear();
    this.respawnGone.clear();
    try {
      await runtime().repo.saveRespawns(this.seed, ups, dels);
    } catch (e) {
      for (const r of ups) this.respawnDirty.set(`${r.x},${r.y}`, r);
      throw e;
    }
  }

  private async flushAll(): Promise<void> {
    await this.flushChunks();
    await this.objects.flush(runtime().repo);
    await this.flushRespawns();
  }

  /** Change a tile (persisted in the chunk diff) and tell nearby players. */
  setTile(x: number, y: number, tile: number): void {
    const { cx, cy } = this.store.setTile(x, y, tile);
    this.dirtyChunks.add(key(cx, cy));
    for (const q of this.nearby(x, y, (INTEREST_RADIUS + 1) * CHUNK_SIZE))
      q.client.send(MSG.TILE, { tx: x, ty: y, tile });
    this.hookTileChanged(x, y, tile);
  }

  scheduleRespawn(x: number, y: number, restore: number, atMs: number): void {
    const r = { x, y, restore, at: atMs };
    this.respawns.set(`${x},${y}`, r);
    this.respawnDirty.set(`${x},${y}`, r);
    this.respawnGone.delete(`${x},${y}`);
  }

  private applyRespawn(r: Respawn): void {
    const k = `${r.x},${r.y}`;
    this.respawns.delete(k);
    this.respawnDirty.delete(k);
    this.respawnGone.set(k, { x: r.x, y: r.y });
    const cur = this.store.getTile(r.x, r.y);
    if (
      this.store.objectAt(r.x, r.y) ||
      cur === T.TILLED ||
      cur === T.TILLED_WET ||
      cur === T.FENCE ||
      cur === r.restore
    )
      return;
    this.setTile(r.x, r.y, r.restore);
  }

  nearby(x: number, y: number, radius: number): ServerPlayer[] {
    const out: ServerPlayer[] = [];
    for (const p of this.players.values()) if (Math.hypot(p.sim.x - x, p.sim.y - y) <= radius) out.push(p);
    return out;
  }

  /** Broadcast an effect to nearby players. `exceptId` skips the originator, who already predicted it locally. */
  fx(msg: FxMsg, exceptId?: string, radius = (INTEREST_RADIUS + 0.5) * CHUNK_SIZE): void {
    for (const p of this.nearby(msg.x, msg.y, radius)) if (p.client.sessionId !== exceptId) p.client.send(MSG.FX, msg);
  }

  // ───────────────────────── messages ─────────────────────────

  private onInput(client: Client, msg: InputBatch): void {
    const p = this.players.get(client.sessionId);
    if (!p || !msg || !Array.isArray(msg.cmds)) return;
    for (const raw of msg.cmds.slice(0, 6)) {
      if (!p.inputBucket.take()) return; // flooding: drop the rest
      const cmd = sanitizeCmd(raw);
      if (cmd.seq <= p.lastSeq) continue;
      if (p.queue.length >= MAX_QUEUE) p.queue.shift();
      p.queue.push(cmd);
    }
  }

  protected async onChunkReq(client: Client, msg: ChunkReq): Promise<void> {
    const p = this.players.get(client.sessionId);
    if (!p || !Number.isInteger(msg?.cx) || !Number.isInteger(msg?.cy)) return;
    if (!p.chunkBucket.take()) return;
    const pcx = chunkOf(Math.floor(p.sim.x)),
      pcy = chunkOf(Math.floor(p.sim.y));
    if (Math.abs(msg.cx - pcx) > INTEREST_RADIUS + 1 || Math.abs(msg.cy - pcy) > INTEREST_RADIUS + 1) return;
    await this.ensureChunk(msg.cx, msg.cy);
    const objs: WorldObj[] = [...this.store.townObjectsIn(msg.cx, msg.cy), ...this.objects.inChunk(msg.cx, msg.cy)];
    const chunk = this.store.get(msg.cx, msg.cy);
    client.send(MSG.CHUNK, {
      cx: msg.cx,
      cy: msg.cy,
      diff: encodeDiff(chunk.diff),
      objs,
      ...(chunk.levels ? { levels: chunk.levels } : {}),
    });
  }

  // ───────────────────────── simulation ─────────────────────────

  /** Spawn an enemy (also used by the ambient spawner and by tests). */
  spawnEnemy(kind: EnemyKind, x: number, y: number, night = isNight(this.wclock.now()), opts: SpawnOpts = {}): Enemy {
    const e = createEnemy(kind, x, y, night, opts);
    this.enemies.set(e.id, e);
    this.state.enemies.set(e.id, e.state);
    return e;
  }

  tick(): void {
    const t0 = performance.now();
    this.tickInner();
    const ms = performance.now() - t0;
    metrics.ticks++;
    metrics.players = this.players.size;
    metrics.enemies = this.enemies.size;
    metrics.tickMsAvg = metrics.tickMsAvg * 0.98 + ms * 0.02;
    metrics.tickMsMax = Math.max(ms, metrics.tickMsMax * 0.999);
    if (ms > TICK_MS) metrics.overBudget++;
  }

  private tickInner(): void {
    this.state.tick++;
    const tick = this.state.tick;
    const now = this.wclock.now();
    this.state.serverTime = now;
    const solid = this.store.solidAt;

    for (const p of this.players.values()) this.stepPlayerTick(p, tick, solid);
    this.resolveStrikes(tick);

    // Wards disperse intruders without loot, XP or kill credit; they are resting places, not farming spots.
    for (const e of this.enemies.values())
      if (!e.def.passive && !e.state.fac && this.warded(e.x, e.y)) {
        this.enemies.delete(e.id);
        this.state.enemies.delete(e.id);
      }
    const targets = [
      ...[...this.players.values()]
        .map((p) => ({
          id: p.client.sessionId,
          x: p.sim.x,
          y: p.sim.y,
          alive: p.deadT <= 0 && !this.warded(p.sim.x, p.sim.y),
        }))
        .filter((t) => !this.warded(t.x, t.y)),
      ...this.hookTargets(),
    ];
    stepEnemies(this.enemies.values(), TICK_DT, tick, targets, solid, this.rand, {
      telegraph: (en) => this.fx({ kind: 'telegraph', x: en.x, y: en.y, v: en.t, w: en.atk, id: en.id }),
      strike: (en, x, y, r, mult) => this.enemyStrike(en, x, y, r, mult),
      lane: (en, ax, ay, bx, by, w) =>
        this.queueStrike(en, { kind: 'lane', ax, ay, bx, by, w }, enemyDamage(en), 2, en.chargeHits),
      fire: (en, dx, dy) => this.fireOrbs(en, dx, dy),
      slam: (en, sp) => this.wallSlam(en, sp),
      crash: (en) => {
        this.fx({ kind: 'crash', x: en.x, y: en.y, id: en.id, dx: en.aimX, dy: en.aimY });
        this.fx({ kind: 'stagger', x: en.x, y: en.y, id: en.id });
      },
    });
    this.stepBombs();
    this.stepProjectiles(tick);

    this.spawnTimer -= TICK_DT;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1;
      if (runtime().ambientSpawns) {
        this.ambientSpawn(now);
        this.ambientFauna(now);
      }
      this.despawnFar();
    }

    // Phase 2: world clock, village, per-second upkeep, profile sync
    const day = this.wclock.day();
    if (day > this.processedDay) {
      this.processedDay = day;
      dailyRollover(this, day);
      this.village.onNewDay(day);
    }
    this.village.tick(tick);
    this.secondT += TICK_DT;
    if (this.secondT >= 1) {
      this.secondT -= 1;
      this.secondly(now);
    }
    tickFishing(this, Date.now());
    for (const p of this.players.values()) {
      p.maxHp = maxHpForLevel(p.level, BASE_PLAYER_HP) + p.stats.hpBonus;
      if (p.hp > p.maxHp) p.hp = p.maxHp;
      p.flushProfile();
    }

    this.hookTick(now);
    this.updateViews();

    this.autosaveTimer += TICK_DT * 1000;
    if (this.autosaveTimer >= runtime().config.autosaveMs) {
      this.autosaveTimer = 0;
      void this.autosave();
    }
  }

  private async autosave(): Promise<void> {
    try {
      await this.flushAll();
      await Promise.all([...this.players.values()].map((p) => this.savePlayer(p)));
    } catch (e) {
      console.error('autosave failed', e);
    }
  }

  /** Once per second: respawn timers, buff expiry and regeneration. */
  private secondly(now: number): void {
    for (const r of [...this.respawns.values()]) if (r.at <= now) this.applyRespawn(r);
    for (const p of this.players.values()) {
      tickTravelNeeds(this, p);
      // a lit lantern burns down, a little each minute it is needed (night or underground)
      if (
        p.data.equip.light &&
        (isCaveY(p.sim.y) || this.wclock.hour() < 6 || this.wclock.hour() >= 20) &&
        ++p.lightWearT >= 60
      ) {
        p.lightWearT = 0;
        wearLight(p);
      }
      let changed = false;
      for (const [k, b] of Object.entries(p.data.buffs))
        if (b.until <= now) {
          delete p.data.buffs[k];
          changed = true;
        }
      if (changed) p.dirty('buffs');
      const regen = p.data.buffs.regen;
      if (regen && p.deadT <= 0 && p.hp < p.maxHp) {
        p.regenT += 1;
        if (p.regenT >= 5) {
          p.regenT = 0;
          p.hp = Math.min(p.maxHp, p.hp + Math.round(regen.power * 4));
        }
      }
    }
    for (const [k, c] of this.nodeHp) if (Date.now() - c.last > 90_000) this.nodeHp.delete(k);
  }

  private stepPlayerTick(p: ServerPlayer, tick: number, solid: (x: number, y: number) => boolean): void {
    p.invuln = Math.max(0, p.invuln - TICK_DT);
    if (p.deadT > 0) {
      p.deadT -= TICK_DT;
      if (p.deadT <= 0) this.respawn(p);
    }
    // catch up gently if the queue backs up
    const n = p.queue.length > 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const cmd = p.queue.shift();
      if (!cmd) break;
      p.lastSeq = cmd.seq;
      if (p.deadT > 0) continue;
      // how far behind the server this client's view was (bounded; bogus values mean "no compensation")
      const lag = tick - cmd.viewTick;
      // jittery clients drift a tick or two past the window: clamp; absurd values get no compensation at all
      p.viewLag = cmd.viewTick > 0 && lag > 0 && lag <= MAX_REWIND_TICKS * 3 ? Math.min(lag, MAX_REWIND_TICKS) : 0;
      p.lastViewTick = p.viewLag > 0 ? cmd.viewTick : tick;
      const weapon = this.weaponOf(p);
      p.sim.ranged = isRangedWeapon(weapon);
      setMeleeWeapon(p.sim, weapon?.id);
      const ev = stepPlayer(p.sim, cmd, solid);
      if (cmd.dx || cmd.dy || ev.attacked || ev.skill || ev.dashed) p.travelExerted = true;
      if (ev.dashed) {
        p.dashTick = tick;
        this.fx(
          { kind: 'dash', x: p.sim.x, y: p.sim.y, dx: p.sim.faceX, dy: p.sim.faceY, id: p.id },
          p.client.sessionId,
        );
      }
      if (ev.attacked) this.attackWith(p, cmd, ev, tick);
      if (ev.skill) this.spawnProjectile(p);
    }
    p.history.push({ tick, x: p.sim.x, y: p.sim.y });
    if (p.history.length > 12) p.history.shift();

    const s = p.state;
    s.x = p.sim.x;
    s.y = p.sim.y;
    s.faceX = p.sim.faceX;
    s.faceY = p.sim.faceY;
    s.hp = p.hp;
    s.maxHp = p.maxHp;
    s.level = p.level;
    s.xp = p.xp;
    s.ack = p.lastSeq;
    s.look = lookOf(p);
    s.app = p.data.appearance ?? 0;
    s.cart = p.sim.cart > 0;
    s.mount = p.sim.mount;
    s.weapon = this.weaponOf(p)?.id ?? '';
    s.held = ITEMS[p.data.inv[p.heldSlot]?.id ?? '']?.tool?.type ?? '';
    p.client.send(MSG.ACK, encodeAck({ seq: p.lastSeq, tick, sim: p.sim }));
    const sim = p.sim;
    s.flags =
      (sim.dashT > 0 ? 1 : 0) |
      (sim.atkCd > 0.12 ? 2 : 0) |
      (p.deadT > 0 ? 4 : 0) |
      (sim.hold && sim.charge > 0 ? 8 : 0) |
      (sim.hold && sim.charge >= CHARGE_MIN ? 16 : 0) |
      (sim.slipT > 0 ? 32 : 0) |
      (sim.ifrT > 0 ? 64 : 0) |
      (sim.boat > 0 ? 128 : 0);
  }

  private weaponOf(p: ServerPlayer): WeaponDef | null {
    const id = p.data.equip.weapon ? ITEMS[p.data.equip.weapon.id]?.weapon : undefined;
    return id ? WEAPONS[id] : null;
  }

  /** The wielded weapon decides what an attack does: blades swing, crossbows and staves shoot, the Shapeshifter flips a coin. */
  private attackWith(p: ServerPlayer, cmd: InputCmd, ev: StepEvents, tick: number): void {
    if (p.sim.cart) return;
    if (p.sim.boat) {
      this.fireCannon(p, cmd, ev);
      return;
    }
    const w = this.weaponOf(p);
    if (!w || w.cls === 'blade') {
      this.resolveMelee(p, cmd, ev, tick);
      return;
    }
    if (w.id === 'morph_staff' && !ev.heavy) {
      this.resolveMelee(p, cmd, ev, tick, MORPH_FORMS[this.rand() < 0.5 ? 0 : 1]);
      return;
    }
    const shot = ev.heavy ? w.charged : w.basic;
    if (!shot) {
      this.resolveMelee(p, cmd, ev, tick);
      return;
    }
    const now = Date.now();
    if (p.weaponReadyAt > now) return;
    p.weaponReadyAt = now + weaponRecovery(w, ev.heavy, p.stats.haste) * 1000;
    const power = weaponShotPower(ev.heavy ? ev.level : null, p.stats.atkBonus);
    const aim =
      Math.hypot(cmd.aimX, cmd.aimY) > 1e-3 ? { x: cmd.aimX, y: cmd.aimY } : { x: p.sim.faceX, y: p.sim.faceY };
    if (!this.hookWeaponShot(p, shot, aim.x, aim.y, power)) this.resolveMelee(p, cmd, ev, tick);
    else
      this.fx(
        {
          kind: 'shot',
          id: p.client.sessionId,
          x: p.sim.x,
          y: p.sim.y,
          dx: aim.x,
          dy: aim.y,
          v: w.hue < 0 ? 8 : w.hue,
        },
        p.client.sessionId,
      );
  }

  /** A sloop's guns replace melee while sailing. */
  private fireCannon(p: ServerPlayer, cmd: InputCmd, ev: StepEvents): void {
    const now = Date.now();
    if (p.weaponReadyAt > now) return;
    p.weaponReadyAt = now + (CANNON.cd * (ev.heavy ? 1.5 : 1) * 1000) / (1 + p.stats.haste * 0.05);
    const aim =
      Math.hypot(cmd.aimX, cmd.aimY) > 1e-3 ? { x: cmd.aimX, y: cmd.aimY } : { x: p.sim.faceX, y: p.sim.faceY };
    const power = (ev.heavy ? 0.8 + 0.4 * ev.level : 1) * (1 + p.stats.atkBonus * 0.02);
    this.hookWeaponShot(p, ev.heavy ? CANNON.charged : CANNON.basic, aim.x, aim.y, power);
    this.fx({ kind: 'shot', x: p.sim.x, y: p.sim.y, dx: aim.x, dy: aim.y, v: 5 }, p.client.sessionId);
  }

  /** Light combo hits and charged heavies; lag-compensated against what the attacker saw. Also bats enemy orbs back. */
  private resolveMelee(
    p: ServerPlayer,
    cmd: InputCmd,
    ev: StepEvents,
    tick: number,
    form?: { name: string; dmg: number; knockback: number },
  ): void {
    const weapon = this.weaponOf(p)?.id;
    const base = ev.heavy ? meleeHeavy(weapon, ev.level) : meleeTap(weapon, ev.combo);
    const hit = form
      ? { ...base, damage: Math.round(base.damage * form.dmg), knockback: base.knockback * form.knockback }
      : base;
    if (form) this.fx({ kind: 'form', x: p.sim.x, y: p.sim.y, v: form.name === 'Bear' ? 1 : 0, id: p.id });
    const rewindTick = Math.min(tick, Math.max(cmd.viewTick, tick - MAX_REWIND_TICKS));
    const fx = p.sim.faceX,
      fy = p.sim.faceY;
    if (ev.heavy)
      this.fx(
        { kind: 'heavy', x: p.sim.x, y: p.sim.y, dx: fx, dy: fy, v: ev.level, id: p.id, weapon },
        p.client.sessionId,
      );
    else
      this.fx(
        { kind: 'swing', x: p.sim.x, y: p.sim.y, dx: fx, dy: fy, v: ev.combo, id: p.id, weapon },
        p.client.sessionId,
      );
    for (const e of [...this.enemies.values()]) {
      const pos = rewindPosition(e.history, rewindTick) ?? { x: e.x, y: e.y };
      if (!inArc(p.sim.x, p.sim.y, fx, fy, hit, { x: pos.x, y: pos.y, r: e.def.radius })) continue;
      const crit = rollCrit(this.rand(), p.stats.luck, ev.counter, true);
      this.damageEnemy(e, this.outgoing(p, hit.damage), p, fx, fy, hit.knockback, {
        weight: hit.weight,
        poise: hit.poise,
        crit,
        counter: ev.counter,
      });
    }
    for (const pr of [...this.projectiles.values()]) {
      if (pr.team !== 'enemy' || pr.endTick) continue;
      const pos = rewindPosition(pr.history, rewindTick) ?? { x: pr.x, y: pr.y };
      if (inArc(p.sim.x, p.sim.y, fx, fy, hit, { x: pos.x, y: pos.y, r: pr.radius + 0.15 })) this.reflect(pr, p);
    }
  }

  /** weapon/ring attack bonus and the Might buff */
  private outgoing(p: ServerPlayer, base: number): number {
    const might = p.data.buffs.might;
    return attackDamage(base, p.stats.atkBonus, might && might.until > this.wclock.now() ? might.power : 0);
  }

  private addProjectile(
    o: Omit<Projectile, 'state' | 'travelled' | 'history' | 'endTick' | 'passed' | 'level'>,
    kind: number,
  ): Projectile {
    const id = `p${++this.projSeq}`;
    const st = new ProjectileState();
    st.id = id;
    st.x = o.x;
    st.y = o.y;
    st.owner = o.owner;
    st.kind = kind;
    const level = this.store.levelAt(Math.floor(o.x), Math.floor(o.y));
    const pr: Projectile = {
      ...o,
      level,
      range: o.range * highGroundRange(level),
      state: st,
      travelled: 0,
      history: [{ tick: this.state.tick, x: o.x, y: o.y }],
      endTick: 0,
      passed: new Set(),
    };
    this.projectiles.set(id, pr);
    this.state.projectiles.set(id, st);
    return pr;
  }

  private spawnProjectile(p: ServerPlayer): void {
    const pr = this.addProjectile(
      {
        x: p.sim.x,
        y: p.sim.y,
        dx: p.sim.faceX,
        dy: p.sim.faceY,
        owner: p.client.sessionId,
        team: 'player',
        speed: PROJECTILE_SPEED,
        range: PROJECTILE_RANGE,
        radius: PROJECTILE_RADIUS,
        dmg: 0,
        src: null,
      },
      0,
    );
    this.fx({ kind: 'shot', x: p.sim.x, y: p.sim.y, dx: pr.dx, dy: pr.dy }, p.client.sessionId);
  }

  /** Phase Wisp attack: one slow orb (a fan of three at night). */
  fireOrbs(e: Enemy, dx: number, dy: number): void {
    const angles = e.night ? [-ORB_SPREAD, 0, ORB_SPREAD] : [0];
    for (const a of angles) {
      const c = Math.cos(a),
        s = Math.sin(a);
      const ux = dx * c - dy * s,
        uy = dx * s + dy * c;
      this.addProjectile(
        {
          x: e.x + ux * 0.4,
          y: e.y + uy * 0.4,
          dx: ux,
          dy: uy,
          owner: e.id,
          team: 'enemy',
          speed: ORB_SPEED,
          range: ORB_RANGE,
          radius: ORB_RADIUS,
          dmg: enemyDamage(e),
          src: e,
        },
        1,
      );
    }
    this.fx({ kind: 'orb', x: e.x, y: e.y, dx, dy, id: e.id });
    this.hookFire(e, dx, dy);
  }

  /** A melee swing batted an orb back: it now flies where the player faces, faster and harder. */
  private reflect(pr: Projectile, p: ServerPlayer): void {
    pr.team = 'player';
    pr.owner = p.id;
    pr.state.owner = p.id;
    pr.state.kind = 2;
    pr.dx = p.sim.faceX;
    pr.dy = p.sim.faceY;
    pr.speed = ORB_SPEED * REFLECT_SPEED_MULT;
    pr.range = ORB_RANGE;
    pr.travelled = 0;
    pr.dmg = this.outgoing(p, REFLECT_DAMAGE);
    pr.history = [{ tick: this.state.tick, x: pr.x, y: pr.y }];
    this.fx({ kind: 'reflect', x: pr.x, y: pr.y, dx: pr.dx, dy: pr.dy, id: p.id });
  }

  private removeProjectile(pr: Projectile): void {
    this.projectiles.delete(pr.state.id);
    this.state.projectiles.delete(pr.state.id);
  }

  private stepProjectiles(tick = this.state.tick): void {
    for (const pr of [...this.projectiles.values()]) {
      if (pr.endTick) {
        if (tick - pr.endTick > MAX_REWIND_TICKS) this.projectiles.delete(pr.state.id);
        continue;
      }
      const step = pr.speed * TICK_DT;
      const nx = pr.x + pr.dx * step,
        ny = pr.y + pr.dy * step;
      let done = this.store.shotBlockedAt(Math.floor(nx), Math.floor(ny), pr.level) || pr.travelled + step > pr.range;
      if (!done && pr.team === 'player') {
        for (const e of this.enemies.values()) {
          if (segmentHitsCircle(pr.x, pr.y, nx, ny, pr.radius, { x: e.x, y: e.y, r: e.def.radius })) {
            const owner = this.players.get(pr.owner) ?? null;
            const reflected = pr.state.kind === 2;
            const dmg = reflected ? pr.dmg : owner ? this.outgoing(owner, PROJECTILE_DAMAGE) : PROJECTILE_DAMAGE;
            this.damageEnemy(e, dmg, owner, pr.dx, pr.dy, reflected ? 5 : 3, {
              weight: reflected ? 1 : 0,
              poise: reflected ? 20 : SKILL_POISE,
            });
            done = true;
            break;
          }
        }
      }
      if (done) {
        if (pr.team === 'enemy') {
          pr.endTick = tick;
          this.state.projectiles.delete(pr.state.id);
        } else this.removeProjectile(pr);
        continue;
      }
      pr.x = nx;
      pr.y = ny;
      pr.travelled += step;
      pr.state.x = nx;
      pr.state.y = ny;
      pr.history.push({ tick, x: nx, y: ny });
      if (pr.history.length > 16) pr.history.shift();
    }
    // enemy orbs vs players: each player is tested against the orb where THEY saw it (defender lag compensation)
    for (const pr of [...this.projectiles.values()]) {
      if (pr.team !== 'enemy') continue;
      for (const p of this.players.values()) {
        if (p.deadT > 0 || pr.passed.has(p.id)) continue;
        const rt = tick - p.viewLag;
        if (pr.endTick && rt > pr.endTick) continue;
        const b = pr.history.find((h) => h.tick === rt);
        if (!b) continue;
        const a = pr.history.find((h) => h.tick === rt - 1) ?? b;
        if (!segmentHitsCircle(a.x, a.y, b.x, b.y, pr.radius, { x: p.sim.x, y: p.sim.y, r: PLAYER_RADIUS })) continue;
        if (hasIframes(p.sim)) {
          if (isPerfectDodge(p.sim)) this.perfectDodge(p);
          pr.passed.add(p.id);
          continue;
        }
        if (p.invuln > 0) continue;
        if (pr.src) this.hurtPlayer(p, pr.dmg, pr.src, 1, pr.dx, pr.dy);
        this.removeProjectile(pr);
        break;
      }
    }
  }

  protected damageEnemy(
    e: Enemy,
    dmg: number,
    by: ServerPlayer | null,
    dx: number,
    dy: number,
    kb: number,
    o: HitOpts = {},
  ): void {
    if (
      !this.enemies.has(e.id) ||
      e.hp <= 0 ||
      (!e.state.fac && this.warded(e.x, e.y)) ||
      (by && this.warded(by.sim.x, by.sim.y))
    )
      return;
    const weight = o.weight ?? 0;
    const crit = !!o.crit;
    const staggered = e.mode === 'stagger';
    const r = e.def.passive
      ? { damage: Math.max(1, Math.round(dmg * (crit ? CRIT_MULT : 1))), poise: 0, knockback: kb, flinch: false }
      : resolveHit(
          e.def,
          { damage: dmg, poise: o.poise ?? Math.round(dmg * 0.4), knockback: kb, weight },
          { crit, staggered, counter: o.counter },
        );
    e.hp -= r.damage;
    if (by) wearWeapon(by);
    e.state.hp = Math.max(0, e.hp);
    const res = staggered ? Math.min(1, e.resist * 2.5) : e.resist;
    e.kx += dx * r.knockback * res;
    e.ky += dy * r.knockback * res;
    if (by) e.lastHitBy = by.client.sessionId;
    if (e.def.neutral) e.provoked = true;
    let broke = false;
    if (!e.def.passive && r.poise > 0) {
      e.poise -= r.poise;
      e.poiseT = 0;
      if (e.poise <= 0 && !staggered) {
        broke = true;
        this.staggerEnemy(e);
      }
    }
    if (!broke && r.flinch && !e.def.passive && !staggered) e.flinchT = Math.max(e.flinchT, 0.12);
    this.fx({
      kind: 'hit',
      x: e.x,
      y: e.y,
      v: r.damage,
      id: e.id,
      w: weight,
      c: crit ? 1 : 0,
      s: broke ? 1 : 0,
      by: by?.id,
      dx,
      dy,
    });
    if (e.hp <= 0) this.killEnemy(e, weight);
  }

  /** Poise broken: interrupts any windup/charge; the enemy takes extra damage for a moment. */
  private staggerEnemy(e: Enemy): void {
    e.mode = 'stagger';
    e.t = e.def.staggerTime ?? 0.7;
    e.atk = ATK.NONE;
    e.state.tele = 0;
    e.poise = 0;
    this.fx({ kind: 'stagger', x: e.x, y: e.y, id: e.id });
  }

  /** Knocked into a wall hard enough: bonus damage and poise damage, credited to the last attacker. */
  private wallSlam(e: Enemy, speed: number): void {
    const bonus = slamDamage(speed);
    this.fx({ kind: 'slam', x: e.x, y: e.y, v: bonus, id: e.id });
    this.damageEnemy(e, bonus, e.lastHitBy ? (this.players.get(e.lastHitBy) ?? null) : null, 0, 0, 0, {
      weight: 1,
      poise: SLAM_POISE,
    });
  }

  private killEnemy(e: Enemy, weight = 0): void {
    this.enemies.delete(e.id);
    this.state.enemies.delete(e.id);
    this.fx({ kind: 'die', x: e.x, y: e.y, id: e.id, v: e.def.kind, w: weight });
    const killer = e.lastHitBy ? this.players.get(e.lastHitBy) : undefined;
    if (killer && !e.noRewards) {
      const xp = e.def.xp * (e.night ? 1.5 : 1) * (e.elite ? ELITE_XP_MULT : 1) * enemyScale(e.level).xp;
      this.giveXp(killer, Math.round(xp));
      const rolls = e.elite ? 2 : 1;
      for (let i = 0; i < rolls; i++) {
        for (const d of e.def.drops ?? []) {
          if (d.max <= 0 || this.rand() >= d.chance * (1 + 0.15 * killer.stats.luck)) continue;
          const stack: Stack = { id: d.item, n: d.min + Math.floor(this.rand() * (d.max - d.min + 1)) };
          if (!giveStacks(killer, [stack])) killer.toast('Your pack is full.', 'bad');
        }
        // monster parts and trophies the catalog adds (bone, scales, glands, dragon bone ...)
        for (const d of catalogMobDrops(ENEMY_KEY_BY_KIND[e.def.kind] ?? '')) {
          if (e.level < d.minLevel || this.rand() >= d.chance * (1 + 0.15 * killer.stats.luck)) continue;
          const stack: Stack = { id: d.item, n: d.min + Math.floor(this.rand() * (d.max - d.min + 1)) };
          if (!giveStacks(killer, [stack])) killer.toast('Your pack is full.', 'bad');
        }
      }
      if (e.def.passive || e.def.neutral) addSkillXp(killer, 'foraging', e.def.xp);
      onKill(killer, e.def, this.wclock.day()); // Phase 2 quests: kill objectives
    }
    // night slimes decohere into a pair of Static Mites
    if (e.night && e.def.kind === ENEMY_DEFS.slime.kind) {
      for (const s of [-1, 1]) {
        const x = e.x + s * 0.45,
          y = e.y + 0.2;
        if (!this.store.solidAt(Math.floor(x), Math.floor(y))) {
          const m = this.spawnEnemy('mite', x, y, true, { level: e.level });
          m.cd = 0.8;
        }
      }
    }
    if (e.elite & ELITE.VOLATILE) {
      this.bombs.push({ e, x: e.x, y: e.y, t: BOMB_FUSE });
      this.fx({ kind: 'bomb', x: e.x, y: e.y, v: BOMB_FUSE, w: BOMB_RADIUS, id: e.id });
    }
    if (!e.noRewards) this.hookKilled(e, killer);
  }

  private stepBombs(): void {
    if (!this.bombs.length) return;
    for (const b of this.bombs) {
      b.t -= TICK_DT;
      if (b.t <= 0) {
        this.queueStrike(b.e, { kind: 'circle', x: b.x, y: b.y, r: BOMB_RADIUS }, enemyDamage(b.e, 1.2), 2, null);
        this.fx({ kind: 'blast', x: b.x, y: b.y, v: BOMB_RADIUS });
      }
    }
    this.bombs = this.bombs.filter((b) => b.t > 0);
  }

  protected giveXp(p: ServerPlayer, xp: number): void {
    p.xp += xp;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      p.maxHp = maxHpForLevel(p.level, BASE_PLAYER_HP) + p.stats.hpBonus;
      p.hp = p.maxHp;
      this.fx({ kind: 'levelup', x: p.sim.x, y: p.sim.y, v: p.level, id: p.client.sessionId });
    }
  }

  /** A circular enemy strike (bite, slam, shockwave). */
  enemyStrike(e: Enemy, x: number, y: number, radius: number, mult = 1): void {
    const heavy = e.def.kind === ENEMY_DEFS.brute.kind;
    if (radius >= 1.5) this.fx({ kind: 'blast', x, y, v: radius, id: e.id });
    this.queueStrike(e, { kind: 'circle', x, y, r: radius }, enemyDamage(e, mult), heavy ? 2 : 1, null);
  }

  /**
   * Lag compensation for defenders: a strike lands on a player when THEY see it land (their input's viewTick reaches the
   * strike tick), bounded by MAX_REWIND_TICKS. Players without valid view info are resolved immediately.
   */
  private queueStrike(e: Enemy, shape: StrikeShape, dmg: number, weight: number, dedupe: Set<string> | null): void {
    this.hookStrike(e, shape, dmg);
    const st: PendingStrike = { e, shape, dmg, weight, tick: this.state.tick, waiting: new Set(), dedupe };
    const cx = shape.kind === 'circle' ? shape.x : (shape.ax + shape.bx) / 2,
      cy = shape.kind === 'circle' ? shape.y : (shape.ay + shape.by) / 2;
    const reach =
      shape.kind === 'circle' ? shape.r : Math.hypot(shape.bx - shape.ax, shape.by - shape.ay) / 2 + shape.w;
    for (const p of this.players.values()) {
      if (p.deadT > 0 || Math.hypot(p.sim.x - cx, p.sim.y - cy) > reach + 4) continue;
      if (p.viewLag <= 0) this.applyStrike(st, p);
      else st.waiting.add(p.id);
    }
    if (st.waiting.size) this.strikes.push(st);
  }

  private resolveStrikes(tick: number): void {
    if (!this.strikes.length) return;
    for (const st of this.strikes) {
      for (const id of [...st.waiting]) {
        const p = this.players.get(id);
        if (!p) {
          st.waiting.delete(id);
          continue;
        }
        if (p.lastViewTick >= st.tick || tick - st.tick >= MAX_REWIND_TICKS || p.viewLag <= 0) {
          st.waiting.delete(id);
          this.applyStrike(st, p);
        }
      }
    }
    this.strikes = this.strikes.filter((s) => s.waiting.size > 0);
  }

  private applyStrike(st: PendingStrike, p: ServerPlayer): void {
    if (p.deadT > 0 || st.dedupe?.has(p.id)) return;
    if (!shapeHits(st.shape, { x: p.sim.x, y: p.sim.y, r: PLAYER_RADIUS })) return;
    if (hasIframes(p.sim)) {
      // dodged
      if (isPerfectDodge(p.sim)) this.perfectDodge(p);
      st.dedupe?.add(p.id);
      return;
    }
    if (p.invuln > 0) return;
    let nx: number, ny: number;
    if (st.shape.kind === 'circle') {
      nx = p.sim.x - st.shape.x;
      ny = p.sim.y - st.shape.y;
    } else {
      const s = st.shape;
      const vx = s.bx - s.ax,
        vy = s.by - s.ay;
      nx = -vy;
      ny = vx;
      if (nx * (p.sim.x - s.ax) + ny * (p.sim.y - s.ay) < 0) {
        nx = -nx;
        ny = -ny;
      }
    }
    if (this.hurtPlayer(p, st.dmg, st.e, st.weight, nx, ny)) st.dedupe?.add(p.id);
  }

  /** Apply an enemy hit to a player (ward buff, Phase 3 hook, shove, death). Returns whether damage was dealt. */
  private hurtPlayer(p: ServerPlayer, raw: number, e: Enemy, weight: number, dirX: number, dirY: number): boolean {
    if (this.warded(p.sim.x, p.sim.y)) return false;
    // armour: a hit may pass straight through (phase), otherwise worn defence trims it
    if (p.stats.phase > 0 && this.rand() < p.stats.phase) {
      this.fx({ kind: 'shadow', x: p.sim.x, y: p.sim.y, v: 5, id: p.id });
      return false;
    }
    const ward = p.data.buffs.ward;
    const dmg = this.hookIncomingDamage(
      p,
      Math.max(
        1,
        Math.round(raw * (1 - p.stats.def) * (1 - (ward && ward.until > this.wclock.now() ? ward.power : 0))),
      ),
      e,
    );
    if (dmg <= 0) return false; // dodged or absorbed by a Phase 3 ability
    p.hp = Math.max(0, p.hp - (p.data.needs.mode === 'hardcore' ? Math.round(dmg * 1.25) : dmg));
    p.invuln = 0.5;
    wearOnHit(p, () => this.rand());
    // wounds: some creatures leave an injury behind (Adventure and Hardcore only)
    const hit = injuryOnHit(ENEMY_KEY_BY_KIND[e.def.kind] ?? '');
    if (hit && this.rand() < Math.min(0.9, hit.chance * DIFFICULTY_RULES[p.data.needs.mode].injury))
      inflict(this, p, hit.cond);
    const l = Math.hypot(dirX, dirY) || 1;
    const shove = weight >= 2 ? 0.6 : 0.3;
    moveBody(p.sim, (dirX / l) * shove, (dirY / l) * shove, PLAYER_RADIUS, this.store.solidAt); // server authoritative; the client reconciles
    p.sim.charge = 0;
    this.fx({ kind: 'hurt', x: p.sim.x, y: p.sim.y, v: dmg, id: p.client.sessionId, w: weight });
    if (p.hp <= 0) {
      p.deadT = RESPAWN_TIME;
      p.queue.length = 0;
      this.fx({ kind: 'die', x: p.sim.x, y: p.sim.y, id: p.client.sessionId, by: String(e.def.kind) });
    }
    return true;
  }

  /** Dashed through a strike in the first frames of the dash: phase slip. */
  private perfectDodge(p: ServerPlayer): void {
    if (p.slipTick === p.dashTick) return; // one per dash
    p.slipTick = p.dashTick;
    p.sim.slipT = SLIP_TIME;
    p.sim.dashN = Math.min(DASH_CHARGES, p.sim.dashN + 1);
    if (p.sim.dashN >= DASH_CHARGES) p.sim.dashCd = 0;
    p.invuln = Math.max(p.invuln, 0.35);
    for (const e of this.enemies.values())
      if (!e.def.passive && Math.hypot(e.x - p.sim.x, e.y - p.sim.y) <= SLIP_SLOW_RADIUS) e.slowT = SLIP_SLOW_TIME;
    this.fx({ kind: 'perfect', x: p.sim.x, y: p.sim.y, id: p.id });
  }

  private respawn(p: ServerPlayer): void {
    p.sim = newPlayerSim(SPAWN.x, SPAWN.y);
    p.hp = p.maxHp;
    p.invuln = 2;
    p.dashTick = -1;
    p.slipTick = -2;
  }

  /** DEV_COMMANDS only: defeat every enemy within `d` tiles as the player (drops, XP and Shadow residues work as in play). */
  private devKill(p: ServerPlayer, m: DevMsg): void {
    if (!runtime().config.devCommands || m.cmd !== 'kill') return;
    const d = typeof m.d === 'number' && Number.isFinite(m.d) ? Math.min(30, Math.max(1, m.d)) : 6;
    for (const e of [...this.enemies.values()])
      if (Math.hypot(e.x - p.sim.x, e.y - p.sim.y) <= d) this.damageEnemy(e, 99999, p, 1, 0, 0);
  }

  /** DEV_COMMANDS only: spawn enemies around the player (browser tests, tuning). */
  private devSpawn(p: ServerPlayer, m: DevMsg): void {
    if (!runtime().config.devCommands || m.cmd !== 'spawn' || typeof m.kind !== 'string' || !(m.kind in ENEMY_DEFS))
      return;
    const n = Math.max(1, Math.min(8, Math.floor(Number(m.n) || 1)));
    const d = typeof m.d === 'number' && Number.isFinite(m.d) ? Math.min(12, Math.max(1, m.d)) : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      const x = p.sim.x + Math.cos(a) * d,
        y = p.sim.y + Math.sin(a) * d;
      if (
        (ENEMY_DEFS[m.kind as EnemyKind].sea ? this.store.solidAt.sea! : this.store.solidAt)(
          Math.floor(x),
          Math.floor(y),
        )
      )
        continue;
      this.spawnEnemy(
        m.kind as EnemyKind,
        x,
        y,
        m.night === true || (m.night === undefined && isNight(this.wclock.now())),
        { level: p.level, elite: Number(m.elite) & 7 },
      );
    }
  }

  /** Wilderness encounters with shared local budgets and recovery time after each group. */
  private ambientSpawn(now: number): void {
    let total = [...this.enemies.values()].filter((e) => !e.def.passive && !e.def.neutral).length;
    for (const id of this.encounterAt.keys()) if (!this.players.has(id)) this.encounterAt.delete(id);
    for (const p of this.players.values()) {
      if (p.deadT > 0 || isUpperY(p.sim.y) || isDiveY(p.sim.y) || total >= MAX_ENEMIES) continue;
      if (sanctuaryAt(this.seed, p.sim.x, p.sim.y)) {
        this.encounterAt.set(p.id, now + 12000);
        continue;
      }
      if (!this.encounterAt.has(p.id)) this.encounterAt.set(p.id, now + 8000);
      if (now < this.encounterAt.get(p.id)!) continue;
      // Back off failed searches while keeping placement work bounded.
      this.encounterAt.set(p.id, now + 3000);
      const night = isNight(now) || isCaveY(p.sim.y),
        biome = biomeAt(this.seed, p.sim.x, p.sim.y);
      let used = 0,
        near = 0;
      for (const e of this.enemies.values())
        if (!e.def.passive && !e.def.neutral && Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 40) {
          used += e.def.budget ?? 1;
          near++;
        }
      const headroom = Math.min(6, 4 + Math.floor(p.level / 4)) - near;
      const budget = spawnBudget(p.level, night, biome);
      if (used >= budget || headroom <= 0) continue;
      for (let tries = 0; tries < 10; tries++) {
        const a = this.rand() * Math.PI * 2,
          d = 16 + this.rand() * 10;
        const x = Math.floor(p.sim.x + Math.cos(a) * d) + 0.5,
          y = Math.floor(p.sim.y + Math.sin(a) * d) + 0.5;
        const habitat = biomeAt(this.seed, x, y);
        let kind: EnemyKindName = pickSpawn(
            p.level,
            night,
            this.rand(),
            habitat,
            isCaveY(y),
            isCaveY(y) ? caveBiomeAt(this.seed, x, y) : undefined,
            this.store.generation >= 4,
          ),
          def = ENEMY_DEFS[kind];
        // the wilds of a kingdom also hold its mythical beast (revision 5)
        if (this.store.generation >= 5 && p.level >= 3 && !isCaveY(y) && this.rand() < 0.2) {
          const realm = inRealmLand(this.seed, x, y);
          if (realm) {
            kind = REALM_BEAST[realm];
            def = ENEMY_DEFS[kind];
          }
        }
        const cost = def.budget ?? 1;
        if (
          used + cost > budget ||
          Math.hypot(x, y) < 12 ||
          buildingAt(this.seed, x, y) ||
          this.store.structureAt(Math.floor(x), Math.floor(y)) ||
          sanctuaryAt(this.seed, x, y) ||
          this.store.solidAt(Math.floor(x), Math.floor(y))
        )
          continue;
        if (
          [...this.players.values()].some(
            (other) => other.deadT <= 0 && Math.hypot(x - other.sim.x, y - other.sim.y) < 14,
          )
        )
          continue;
        if ([...this.enemies.values()].some((e) => !e.def.passive && Math.hypot(x - e.x, y - e.y) < 3)) continue;
        const pack = kind === 'mite' ? 2 : kind === 'wolf' ? 2 : 1;
        const n = Math.min(pack, headroom, Math.floor((budget - used) / cost), MAX_ENEMIES - total);
        for (let i = 0; i < n; i++) {
          const px = x + i * 1.1,
            py = y + i * 0.6;
          if (
            this.store.structureAt(Math.floor(px), Math.floor(py)) ||
            sanctuaryAt(this.seed, px, py) ||
            this.store.solidAt(Math.floor(px), Math.floor(py)) ||
            [...this.players.values()].some((other) => Math.hypot(px - other.sim.x, py - other.sim.y) < 14)
          )
            continue;
          const elite =
            p.level >= 3 && n === 1 && this.rand() < eliteChance(p.level, night)
              ? [ELITE.HARDENED, ELITE.SWIFT, ELITE.VOLATILE][Math.floor(this.rand() * 3)]!
              : 0;
          this.spawnEnemy(kind, px, py, night, { level: p.level, elite });
          total++;
        }
        this.encounterAt.set(p.id, now + (night ? 12000 : 16000) + this.rand() * 6000);
        break;
      }
    }
  }

  /** Grazing animals by day, modest nocturnal wildlife at night; both stay outside wards. */
  private ambientFauna(now: number): void {
    const night = isNight(now),
      localMax = night ? 3 : 5;
    let total = 0;
    for (const e of this.enemies.values()) if (e.def.passive || e.def.neutral) total++;
    if (total >= MAX_FAUNA) return;
    for (const p of this.players.values()) {
      if (total >= MAX_FAUNA) break;
      if (p.deadT > 0 || isUpperY(p.sim.y) || isDiveY(p.sim.y)) continue;
      let near = 0;
      for (const e of this.enemies.values())
        if ((e.def.passive || e.def.neutral) && Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 40) near++;
      if (near >= localMax) continue;
      for (let tries = 0; tries < 10; tries++) {
        const a = this.rand() * Math.PI * 2,
          d = 10 + this.rand() * 8;
        const x = Math.floor(p.sim.x + Math.cos(a) * d),
          y = Math.floor(p.sim.y + Math.sin(a) * d);
        if (
          Math.hypot(x, y) < 12 ||
          buildingAt(this.seed, x, y) ||
          this.store.structureAt(Math.floor(x), Math.floor(y)) ||
          sanctuaryAt(this.seed, x, y)
        )
          continue;
        const t = this.store.getTile(x, y);
        const biome = biomeAt(this.seed, x, y);
        if (biome === 'corrupted' || isCaveY(y)) continue; // nothing gentle lives in the wastes or underground
        if (t !== T.GRASS && t !== T.GRASS_TALL && t !== T.FLOWERS && !(biome === 'desert' && t === T.SAND)) continue;
        let trees = 0;
        for (let dy = -5; dy <= 5; dy++)
          for (let dx = -5; dx <= 5; dx++) if (this.store.getTile(x + dx, y + dy) === T.TREE) trees++;
        // each biome keeps its own creatures: stag herds in the woods and tundra, boar sounders in Amberwood and the fen,
        // hares on the dunes, badgers on open ground
        const r = this.rand();
        const waterBank = [
          [3, 0],
          [-3, 0],
          [0, 3],
          [0, -3],
        ].some(([dx, dy]) => {
          const t = this.store.getTile(x + dx!, y + dy!);
          return t === T.WATER;
        });
        const kind: EnemyKind = night
          ? waterBank && r < 0.5
            ? 'otter'
            : biome === 'desert'
              ? 'rabbit'
              : trees >= 4 && r > 0.8
                ? 'owl'
                : biome === 'forest' && r < 0.25
                  ? 'fox'
                  : (biome === 'swamp' || biome === 'autumn') && r < 0.45
                    ? 'boar'
                    : 'badger'
          : waterBank && r < 0.5
            ? 'otter'
            : biome === 'desert'
              ? r < 0.35
                ? 'tortoise'
                : 'rabbit'
              : trees >= 4 && r > 0.85
                ? 'owl'
                : biome === 'forest' && r < 0.25
                  ? 'fox'
                  : biome === 'taiga'
                    ? r < 0.65
                      ? 'deer'
                      : 'badger'
                    : biome === 'swamp'
                      ? r < 0.6
                        ? 'boar'
                        : 'badger'
                      : biome === 'autumn'
                        ? r < 0.5
                          ? 'boar'
                          : r < 0.85
                            ? 'deer'
                            : 'rabbit'
                        : trees >= 6
                          ? r < 0.5
                            ? 'deer'
                            : r < 0.75
                              ? 'boar'
                              : 'rabbit'
                          : r < 0.2
                            ? 'badger'
                            : 'rabbit';
        const n = Math.min(MAX_FAUNA - total, localMax - near, kind === 'deer' || kind === 'boar' ? 2 : 1);
        let added = 0;
        for (let i = 0; i < n; i++) {
          const hx = x + 0.5 + Math.cos(i * 2.1) * 1.2,
            hy = y + 0.5 + Math.sin(i * 2.1) * 1.2;
          if (
            !sanctuaryAt(this.seed, hx, hy) &&
            !this.store.solidAt(Math.floor(hx), Math.floor(hy)) &&
            ![...this.players.values()].some((other) => Math.hypot(hx - other.sim.x, hy - other.sim.y) < 8) &&
            ![...this.enemies.values()].some((e) => Math.hypot(e.x - hx, e.y - hy) < 2)
          ) {
            this.spawnEnemy(kind, hx, hy, false);
            total++;
            added++;
          }
        }
        if (added) break;
      }
    }
  }

  private despawnFar(): void {
    for (const e of [...this.enemies.values()]) {
      let close = false;
      for (const p of this.players.values())
        if (Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < (e.def.boss ? 90 : 48)) {
          close = true;
          break;
        }
      if (!close) {
        this.enemies.delete(e.id);
        this.state.enemies.delete(e.id);
      }
    }
  }

  // ───────────────────────── extension hooks (overridden by GameRoom, Phase 3/4) ─────────────────────────
  protected makeVillage(host: VillageHost): VillageSystem {
    return createVillage(host);
  }
  protected hookAccepts(_p: ServerPlayer, _msg: unknown): boolean {
    return true;
  }
  protected hookObjectChanged(_m: ObjMsg): void {}
  protected hookTileChanged(_x: number, _y: number, _tile: number): void {}
  protected hookTick(_now: number): void {}
  protected hookViewEntities(_push: (id: string, x: number, y: number, st: SpellState) => void): void {}
  /** an adventure object (shrine altar/pillar) was opened */
  shrineInteract(_p: ServerPlayer, _o: WorldObj): void {}

  /** boss summoning (the Phase 3/4 room provides the boss module) */
  summonBoss(_p: ServerPlayer, _itemId: string, _x: number, _y: number): boolean {
    return false;
  }
  /** a vault chest was opened; true = it is still locked by a trial */
  vaultGuard(_p: ServerPlayer, _o: WorldObj): boolean {
    return false;
  }
  toggleShip(_p: ServerPlayer): void {}

  /** extra things enemies may aggro on (summoned shadows) */
  protected hookTargets(): Array<{ id: string; x: number; y: number; alive: boolean }> {
    return [];
  }
  /** an enemy strike was queued (summoned shadows in its shape take the hit) */
  protected hookStrike(_e: Enemy, _shape: StrikeShape, _dmg: number): void {}
  /** a weapon's ranged attack (Phase 3 engine); return false when unhandled */
  protected hookWeaponShot(_p: ServerPlayer, _shot: WeaponShot, _ax: number, _ay: number, _power: number): boolean {
    return false;
  }
  /** a settlement's ward holds unless a war party is assaulting it */
  protected warded(x: number, y: number): boolean {
    return !!sanctuaryAt(this.seed, x, y) && !this.hookWarZone(x, y);
  }
  protected hookWarZone(_x: number, _y: number): boolean {
    return false;
  }
  protected hookFire(_e: Enemy, _dx: number, _dy: number): void {}
  guildClear?: (p: ServerPlayer, id: string) => void;
  guildStart?: (
    p: ServerPlayer,
    id: string,
    board: WorldObj,
  ) => Promise<import('@eigenlands/shared').GuildJourney | null>;
  guildInteract?: (p: ServerPlayer, o: WorldObj) => boolean;
  guildTalk?: (p: ServerPlayer, id: string) => boolean;
  protected hookKilled(_e: Enemy, _killer: ServerPlayer | undefined): void {}
  protected hookIncomingDamage(_p: ServerPlayer, dmg: number, _e: Enemy): number {
    return dmg;
  }

  /** Interest management: each client only receives entities within INTEREST_RADIUS chunks. */
  private updateViews(): void {
    const ents: Array<{
      id: string;
      cx: number;
      cy: number;
      st: PlayerState | Enemy['state'] | ProjectileState | NpcState | SpellState;
    }> = [];
    for (const p of this.players.values())
      ents.push({
        id: p.client.sessionId,
        cx: chunkOf(Math.floor(p.sim.x)),
        cy: chunkOf(Math.floor(p.sim.y)),
        st: p.state,
      });
    for (const e of this.enemies.values())
      ents.push({ id: e.id, cx: chunkOf(Math.floor(e.x)), cy: chunkOf(Math.floor(e.y)), st: e.state });
    for (const pr of this.projectiles.values())
      ents.push({ id: pr.state.id, cx: chunkOf(Math.floor(pr.x)), cy: chunkOf(Math.floor(pr.y)), st: pr.state });
    this.state.npcs.forEach((n, id) =>
      ents.push({ id: `npc:${id}`, cx: chunkOf(Math.floor(n.x)), cy: chunkOf(Math.floor(n.y)), st: n }),
    );
    this.hookViewEntities((id, x, y, st) =>
      ents.push({ id, cx: chunkOf(Math.floor(x)), cy: chunkOf(Math.floor(y)), st }),
    );
    const alive = new Set(ents.map((e) => e.id));
    for (const p of this.players.values()) {
      const pcx = chunkOf(Math.floor(p.sim.x)),
        pcy = chunkOf(Math.floor(p.sim.y));
      for (const e of ents) {
        const inRange =
          e.id === p.client.sessionId ||
          (Math.abs(e.cx - pcx) <= INTEREST_RADIUS && Math.abs(e.cy - pcy) <= INTEREST_RADIUS);
        const has = p.inView.has(e.id);
        if (inRange && !has) {
          p.view.add(e.st);
          p.inView.add(e.id);
        } else if (!inRange && has) {
          p.view.remove(e.st);
          p.inView.delete(e.id);
        }
      }
      for (const id of p.inView) if (!alive.has(id)) p.inView.delete(id);
    }
  }
}

/** Test/admin helper used by integration tests. */
export function giveTo(room: WorldRoom, sessionId: string, stack: Stack): boolean {
  const p = room.players.get(sessionId);
  return !!p && giveStacks(p, [stack], false);
}

export function sanitizeName(n: unknown): string {
  if (typeof n !== 'string') return '';
  return n
    .replace(/[^\p{L}\p{N} _'-]/gu, '')
    .trim()
    .slice(0, NAME_MAX);
}
