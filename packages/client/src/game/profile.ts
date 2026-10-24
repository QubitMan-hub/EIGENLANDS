import {
  INV_SIZE, emptyInventory, emptySkills, type EquipState, type Inventory, type ProfileMsg, type QuestLog, type SkillXp, type Stack,
} from '@eigenlands/shared';

export interface FriendView { pts: number; talked: number; gifted: number }
export interface Buffs { [kind: string]: { until: number; power: number } }

/** Client-side mirror of the private PROFILE the server sends (partial updates merge in). */
export class Profile {
  /** Public state level; private PROFILE loading remains separate. */
  level = 1;
  inv: Inventory = emptyInventory();
  coins = 0;
  skills: SkillXp = emptySkills();
  recipes = new Set<string>();
  equip: EquipState = { ring1: null, ring2: null, outfit: 0, weapon: null, head: null, chest: null, legs: null, feet: null };
  buffs: Buffs = {};
  friends: Record<string, FriendView> = {};
  stats = { hpBonus: 0, atkBonus: 0, luck: 0, haste: 0, def: 0, phase: 0 };
  quests: QuestLog = {};
  /** heart events already seen */
  events: string[] = [];
  loaded = false;
  private listeners = new Set<(changed: Set<string>) => void>();

  onChange(fn: (changed: Set<string>) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  setLevel(level: number): void {
    if (!Number.isInteger(level) || level < 1 || level === this.level) return;
    this.level = level;
    for (const listener of this.listeners) listener(new Set(['level']));
  }

  apply(m: ProfileMsg): void {
    const changed = new Set<string>();
    if (m.inv) { this.inv = Array.from({ length: INV_SIZE }, (_, i) => m.inv![i] ?? null); changed.add('inv'); }
    if (m.coins !== undefined) { this.coins = m.coins; changed.add('coins'); }
    if (m.skills) { this.skills = { ...this.skills, ...m.skills }; changed.add('skills'); }
    if (m.recipes) { this.recipes = new Set(m.recipes); changed.add('recipes'); }
    if (m.equip) { this.equip = m.equip; changed.add('equip'); }
    if (m.buffs) { this.buffs = m.buffs; changed.add('buffs'); }
    if (m.friends) { this.friends = { ...this.friends, ...m.friends }; changed.add('friends'); }
    if (m.stats) { this.stats = m.stats; changed.add('stats'); }
    if (m.quests) { this.quests = m.quests; changed.add('quests'); }
    if (m.events) this.events = m.events;
    this.loaded = true;
    for (const l of this.listeners) l(changed);
  }

  count(id: string): number { let n = 0; for (const s of this.inv) if (s && s.id === id) n += s.n; return n; }
  hotbar(i: number): Stack | null { return this.inv[i] ?? null; }
}
