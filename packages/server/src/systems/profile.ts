import { guildContract, validGuildJourney, contractKind } from '@eigenlands/shared';
import {
  REALM_IDS,
  REP_MIN,
  REP_MAX,
  validTravelNeeds,
  WORLD_GENERATION,
  BUFF_KIND_LIST,
  isWorldGeneration,
  CROPS,
  DEED_KINDS,
  ITEMS,
  NPC_BY_ID,
  QUEST_BY_ID,
  RECIPES,
  WEAPONS,
  quickbarAttack,
  addStack,
  armorTotals,
  dayNumber,
  emptyInventory,
  pruneRequests,
  validAppearance,
  validInventory,
  validSkills,
  type EquipSlotKey,
  type EquipState,
  type Inventory,
  type ProfileMsg,
  type QuestLog,
  type Stack,
  recipeById,
  equipmentStats,
  validDisc,
} from '@eigenlands/shared';
import type { Buff, DirtyPart, FriendRec, PlayerData } from './types';

export interface DerivedStats {
  hpBonus: number;
  atkBonus: number;
  luck: number;
  haste: number;
  /** damage reduction 0..0.6 */ def: number;
  /** chance a hit passes straight through */ phase: number;
  /** catalog gear extras (see ProfileMsg.stats) */
  warm: number;
  cool: number;
  drain: number;
  light: number;
  craft: number;
  stamina: number;
}

const BUFF_KINDS = new Set<string>(BUFF_KIND_LIST);

export function startRecipes(): string[] {
  return RECIPES.filter((r) => r.learn === 'start').map((r) => r.id);
}

/** The cheapest seed whose crop grows in `season` (used for the starter kit). */
export function starterSeed(season: number): string {
  let best = 'turnip',
    cost = Infinity;
  for (const c of Object.values(CROPS)) {
    const v = ITEMS[`${c.id}_seed`]?.value ?? Infinity;
    if (c.seasons.includes(season) && v < cost) {
      best = c.id;
      cost = v;
    }
  }
  return `${best}_seed`;
}

export function newPlayerData(season: number): PlayerData {
  const inv = emptyInventory();
  for (const id of ['axe', 'pickaxe', 'hoe', 'can', 'rod', 'net']) addStack(inv, { id, n: 1, p: { tier: 1 } });
  addStack(inv, { id: 'sword', n: 1, p: { tier: 1, atk: 0 } });
  addStack(inv, { id: starterSeed(season), n: 12 });
  addStack(inv, { id: 'fiber', n: 5 });
  return {
    worldGeneration: WORLD_GENERATION,
    needs: validTravelNeeds(null),
    inv,
    coins: 100,
    skills: validSkills(null),
    recipes: new Set(startRecipes()),
    disc: validDisc(null),
    equip: emptyEquip(),
    friends: {},
    rep: {},
    buffs: {},
    quests: {},
    deeds: {},
    events: [],
    appearance: 0,
    prog: { hearts: 0, bosses: [], shrines: [], ruins: [] },
  };
}

/** Quest log from storage: known quests only, progress arrays of the right length, bounded numbers. */
export function validQuests(v: unknown, today: number): QuestLog {
  const out: QuestLog = {};
  if (!v || typeof v !== 'object') return out;
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    const s = raw as { state?: unknown; progress?: unknown; journey?: unknown };
    if (!s || (s.state !== 'active' && s.state !== 'done') || !Array.isArray(s.progress) || s.progress.length > 8)
      continue;
    if (!QUEST_BY_ID[id] && !guildContract(0, id) && !/^req:-?\d+:\d$/.test(id)) continue;
    const journey = validGuildJourney(s.journey);
    if (guildContract(0, id) && s.state === 'active' && (!journey || journey.kind !== contractKind(id))) continue;
    const n = (QUEST_BY_ID[id] ?? guildContract(0, id))?.objectives.length ?? s.progress.length;
    out[id] = {
      state: s.state,
      ...(journey ? { journey } : {}),
      progress: Array.from({ length: n }, (_, i) => {
        const x = (s.progress as unknown[])[i];
        return typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(999, Math.floor(x))) : 0;
      }),
    };
  }
  pruneRequests(out, today);
  return out;
}

export const emptyEquip = (): EquipState => ({
  ring1: null,
  ring2: null,
  outfit: 0,
  weapon: null,
  head: null,
  chest: null,
  legs: null,
  feet: null,
});

/** Is `v` a stack of an item that fits this equipment slot? (stored data is never trusted) */
export function fitsSlot(slot: EquipSlotKey, v: unknown): v is Stack {
  const s = v as Stack | null;
  if (!s || typeof s.id !== 'string') return false;
  const d = ITEMS[s.id];
  if (!d) return false;
  if (slot === 'ring1' || slot === 'ring2') return d.kind === 'ring';
  if (slot === 'weapon') return d.kind === 'weapon' && !!d.weapon;
  if (slot === 'head' || slot === 'chest' || slot === 'legs' || slot === 'feet')
    return d.kind === 'armor' && d.armor?.slot === slot;
  return d.kind === 'gear' && d.gear?.slot === slot;
}

const isRing = (s: unknown): s is Stack =>
  !!s && typeof (s as Stack).id === 'string' && ITEMS[(s as Stack).id]?.kind === 'ring';

/** Never trust stored shapes: every field is re-validated (old characters with empty data get the starter kit). */
export function loadPlayerData(raw: unknown, season: number, nowMs: number): PlayerData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (!Array.isArray(r.inv)) return newPlayerData(season);
  const known = new Set(startRecipes());
  if (Array.isArray(r.recipes)) for (const id of r.recipes) if (typeof id === 'string' && recipeById(id)) known.add(id);
  const eq = (r.equip ?? {}) as Record<string, unknown>;
  const slotStack = (slot: EquipSlotKey, v: unknown): Stack | null =>
    fitsSlot(slot, v) ? { id: v.id, n: 1, ...(v.p ? { p: v.p } : {}) } : null;
  const ring = (v: unknown): Stack | null => (isRing(v) ? { id: v.id, n: 1, ...(v.p ? { p: v.p } : {}) } : null);
  const outfit =
    typeof eq.outfit === 'number' && Number.isInteger(eq.outfit) && eq.outfit >= 0 && eq.outfit < 8 ? eq.outfit : 0;
  const friends: Record<string, FriendRec> = {};
  if (r.friends && typeof r.friends === 'object') {
    for (const [id, v] of Object.entries(r.friends as Record<string, unknown>)) {
      const f = v as Partial<FriendRec>;
      if (!NPC_BY_ID[id] || !f || !Number.isFinite(f.pts) || !Number.isFinite(f.talked) || !Number.isFinite(f.gifted))
        continue;
      friends[id] = { pts: Math.max(0, Math.min(400, f.pts!)), talked: f.talked!, gifted: f.gifted! };
      if (typeof f.lastGift === 'string' && ITEMS[f.lastGift]) friends[id]!.lastGift = f.lastGift;
      if (Array.isArray(f.noted))
        friends[id]!.noted = f.noted.filter((x): x is string => typeof x === 'string').slice(-6);
    }
  }
  const rep: PlayerData['rep'] = {};
  if (r.rep && typeof r.rep === 'object')
    for (const id of REALM_IDS) {
      const v = (r.rep as Record<string, unknown>)[id];
      if (typeof v === 'number' && Number.isFinite(v) && v !== 0)
        rep[id] = Math.max(REP_MIN, Math.min(REP_MAX, Math.round(v)));
    }
  const buffs: Record<string, Buff> = {};
  if (r.buffs && typeof r.buffs === 'object') {
    for (const [k, v] of Object.entries(r.buffs as Record<string, unknown>)) {
      const b = v as Partial<Buff>;
      if (BUFF_KINDS.has(k) && Number.isFinite(b?.until) && Number.isFinite(b?.power) && b.until! > nowMs)
        buffs[k] = { until: b.until!, power: b.power! };
    }
  }
  const coins = typeof r.coins === 'number' && Number.isFinite(r.coins) ? Math.max(0, Math.floor(r.coins)) : 0;
  const deeds: PlayerData['deeds'] = {};
  if (r.deeds && typeof r.deeds === 'object') {
    for (const k of DEED_KINDS) {
      const d = (r.deeds as Record<string, { day?: unknown; what?: unknown }>)[k];
      if (d && typeof d.day === 'number' && Number.isFinite(d.day) && typeof d.what === 'string')
        deeds[k] = { day: d.day, what: d.what.slice(0, 60) };
    }
  }
  const events = Array.isArray(r.events)
    ? r.events.filter((x): x is string => typeof x === 'string' && /^[a-z]+:\d$/.test(x)).slice(0, 64)
    : [];
  return {
    worldGeneration: isWorldGeneration(r.worldGeneration) ? r.worldGeneration : 1,
    needs: validTravelNeeds(r.needs),
    inv: validInventory(r.inv),
    coins,
    skills: validSkills(r.skills),
    recipes: known,
    disc: validDisc(r.disc),
    equip: {
      ring1: ring(eq.ring1),
      ring2: ring(eq.ring2),
      outfit,
      weapon: slotStack('weapon', eq.weapon),
      head: slotStack('head', eq.head),
      chest: slotStack('chest', eq.chest),
      legs: slotStack('legs', eq.legs),
      feet: slotStack('feet', eq.feet),
      shield: slotStack('shield', eq.shield),
      back: slotStack('back', eq.back),
      neck: slotStack('neck', eq.neck),
      belt: slotStack('belt', eq.belt),
      charm: slotStack('charm', eq.charm),
      light: slotStack('light', eq.light),
    },
    friends,
    rep,
    buffs,
    quests: validQuests(r.quests, dayNumber(nowMs)),
    deeds,
    events,
    appearance: validAppearance(r.appearance),
    prog: validProg(r.prog),
  };
}

export function validProg(raw: unknown): PlayerData['prog'] {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ids = (v: unknown): string[] =>
    Array.isArray(v)
      ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length <= 40))].slice(0, 400)
      : [];
  return {
    hearts:
      typeof r.hearts === 'number' && Number.isFinite(r.hearts) ? Math.max(0, Math.min(40, Math.floor(r.hearts))) : 0,
    bosses: ids(r.bosses),
    shrines: ids(r.shrines),
    ruins: ids(r.ruins),
    ways: ids(r.ways),
    home: typeof r.home === 'string' && r.home.length <= 40 ? r.home : null,
    mounts: ids(r.mounts).filter((m) => m === 'horse' || m === 'stag'),
  };
}

export function serializePlayerData(d: PlayerData): Record<string, unknown> {
  return {
    worldGeneration: d.worldGeneration,
    needs: d.needs,
    prog: d.prog,
    inv: d.inv,
    coins: d.coins,
    skills: d.skills,
    recipes: [...d.recipes],
    disc: d.disc,
    equip: d.equip,
    friends: d.friends,
    rep: d.rep,
    buffs: d.buffs,
    quests: d.quests,
    deeds: d.deeds,
    events: d.events,
    appearance: d.appearance ?? 0,
  };
}

export function deriveStats(d: PlayerData): DerivedStats {
  // worn and wielded gear (see equipmentStats), then the quick-bar sword, food and potion effects, and Heart Crystals
  const s: DerivedStats = equipmentStats(d.equip);
  s.atkBonus += quickbarAttack(d.inv);
  // food and potion effects that change stats while they last (expired buffs are removed by the room each second)
  const bp = (k: string): number => d.buffs[k]?.power ?? 0;
  s.hpBonus += Math.round(bp('vigor'));
  s.luck += bp('fortune');
  s.haste += bp('swift');
  s.atkBonus += Math.round(bp('fury'));
  s.def += bp('bulwark');
  s.stamina += bp('steady');
  s.craft += bp('focus');
  s.hpBonus += d.prog.hearts * 10;
  s.def = Math.min(0.6, s.def);
  return s;
}

export function profileMsg(d: PlayerData, stats: DerivedStats, parts: Iterable<DirtyPart> | 'all'): ProfileMsg {
  const set =
    parts === 'all'
      ? new Set<DirtyPart>([
          'inv',
          'coins',
          'skills',
          'disc',
          'recipes',
          'equip',
          'friends',
          'rep',
          'buffs',
          'stats',
          'quests',
          'needs',
        ])
      : new Set(parts);
  const m: ProfileMsg = {};
  if (set.has('needs')) m.needs = d.needs;
  if (set.has('inv')) m.inv = d.inv as Inventory;
  if (set.has('coins')) m.coins = d.coins;
  if (set.has('skills')) m.skills = d.skills;
  if (set.has('disc')) m.disc = d.disc;
  if (set.has('recipes')) m.recipes = [...d.recipes];
  if (set.has('equip')) m.equip = d.equip;
  if (set.has('friends')) m.friends = d.friends;
  if (set.has('rep')) m.rep = d.rep;
  if (set.has('buffs')) m.buffs = d.buffs;
  if (set.has('stats')) m.stats = stats;
  if (set.has('quests')) {
    m.quests = d.quests;
    m.events = d.events;
  }
  return m;
}
