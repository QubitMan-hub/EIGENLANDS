import {
  CROPS, ITEMS, RECIPES, addStack, emptyInventory, validInventory, validSkills,
  type Inventory, type ProfileMsg, type Stack,
} from '@eigenlands/shared';
import type { Buff, DirtyPart, FriendRec, PlayerData } from './types';

export interface DerivedStats { hpBonus: number; atkBonus: number; luck: number; haste: number }

const BUFF_KINDS = new Set(['regen', 'might', 'ward', 'lantern']);

export function startRecipes(): string[] {
  return RECIPES.filter((r) => r.learn === 'start').map((r) => r.id);
}

/** The cheapest seed whose crop grows in `season` (used for the starter kit). */
export function starterSeed(season: number): string {
  let best = 'turnip', cost = Infinity;
  for (const c of Object.values(CROPS)) {
    const v = ITEMS[`${c.id}_seed`]?.value ?? Infinity;
    if (c.seasons.includes(season) && v < cost) { best = c.id; cost = v; }
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
    inv, coins: 100, skills: validSkills(null), recipes: new Set(startRecipes()),
    equip: { ring1: null, ring2: null, outfit: 0 }, friends: {}, buffs: {},
  };
}

const isRing = (s: unknown): s is Stack => !!s && typeof (s as Stack).id === 'string' && ITEMS[(s as Stack).id]?.kind === 'ring';

/** Never trust stored shapes: every field is re-validated (old characters with empty data get the starter kit). */
export function loadPlayerData(raw: unknown, season: number, nowMs: number): PlayerData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (!Array.isArray(r.inv)) return newPlayerData(season);
  const known = new Set(startRecipes());
  if (Array.isArray(r.recipes)) for (const id of r.recipes) if (typeof id === 'string' && RECIPES.some((x) => x.id === id)) known.add(id);
  const eq = (r.equip ?? {}) as Record<string, unknown>;
  const ring = (v: unknown): Stack | null => (isRing(v) ? { id: v.id, n: 1, ...(v.p ? { p: v.p } : {}) } : null);
  const outfit = typeof eq.outfit === 'number' && Number.isInteger(eq.outfit) && eq.outfit >= 0 && eq.outfit < 8 ? eq.outfit : 0;
  const friends: Record<string, FriendRec> = {};
  if (r.friends && typeof r.friends === 'object') {
    for (const [id, v] of Object.entries(r.friends as Record<string, unknown>)) {
      const f = v as Partial<FriendRec>;
      if (f && Number.isFinite(f.pts) && Number.isFinite(f.talked) && Number.isFinite(f.gifted)) friends[id] = { pts: Math.max(0, f.pts!), talked: f.talked!, gifted: f.gifted! };
    }
  }
  const buffs: Record<string, Buff> = {};
  if (r.buffs && typeof r.buffs === 'object') {
    for (const [k, v] of Object.entries(r.buffs as Record<string, unknown>)) {
      const b = v as Partial<Buff>;
      if (BUFF_KINDS.has(k) && Number.isFinite(b?.until) && Number.isFinite(b?.power) && b.until! > nowMs) buffs[k] = { until: b.until!, power: b.power! };
    }
  }
  const coins = typeof r.coins === 'number' && Number.isFinite(r.coins) ? Math.max(0, Math.floor(r.coins)) : 0;
  return {
    inv: validInventory(r.inv), coins, skills: validSkills(r.skills), recipes: known,
    equip: { ring1: ring(eq.ring1), ring2: ring(eq.ring2), outfit }, friends, buffs,
  };
}

export function serializePlayerData(d: PlayerData): Record<string, unknown> {
  return { inv: d.inv, coins: d.coins, skills: d.skills, recipes: [...d.recipes], equip: d.equip, friends: d.friends, buffs: d.buffs };
}

export function deriveStats(d: PlayerData): DerivedStats {
  const s: DerivedStats = { hpBonus: 0, atkBonus: 0, luck: 0, haste: 0 };
  for (const r of [d.equip.ring1, d.equip.ring2]) {
    if (!r?.p?.stat || !Number.isFinite(r.p.val)) continue;
    const v = r.p.val!;
    if (r.p.stat === 'hp') s.hpBonus += v; else if (r.p.stat === 'atk') s.atkBonus += v; else if (r.p.stat === 'luck') s.luck += v; else if (r.p.stat === 'haste') s.haste += v;
  }
  let best = 0;
  for (let i = 0; i < 10; i++) { const st = d.inv[i]; if (st && st.id === 'sword') best = Math.max(best, st.p?.atk ?? 0); }
  s.atkBonus += best;
  return s;
}

export function profileMsg(d: PlayerData, stats: DerivedStats, parts: Iterable<DirtyPart> | 'all'): ProfileMsg {
  const set = parts === 'all' ? new Set<DirtyPart>(['inv', 'coins', 'skills', 'recipes', 'equip', 'friends', 'buffs', 'stats']) : new Set(parts);
  const m: ProfileMsg = {};
  if (set.has('inv')) m.inv = d.inv as Inventory;
  if (set.has('coins')) m.coins = d.coins;
  if (set.has('skills')) m.skills = d.skills;
  if (set.has('recipes')) m.recipes = [...d.recipes];
  if (set.has('equip')) m.equip = d.equip;
  if (set.has('friends')) m.friends = d.friends;
  if (set.has('buffs')) m.buffs = d.buffs;
  if (set.has('stats')) m.stats = stats;
  return m;
}
