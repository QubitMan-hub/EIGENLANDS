/**
 * What happens to a piece of gear after it is made: its crafted quality, wear, upgrades and enchantment. Pure rules shared
 * by the server (which applies them), the client (tooltips and the gear bench) and the tests.
 *
 * - Quality (`qt` 0..4, Crude..Masterwork) comes from the crafter's skill and scales stats and durability.
 * - Durability (`dur` / `maxDur`) wears with use. Gear with no `maxDur` (everything from before this system) never wears.
 *   A piece at 0 is broken: it stays in the pack and on the body but gives nothing until repaired.
 * - Upgrades (`up` 0..5) add 6% stats and 10% durability each and cost a share of the materials it was made from.
 * - One enchantment (`ench`) can be bound to a piece; binding a new one replaces the old.
 */
import { CRAFT_QUALITY, QUALITY_POWER, type Discipline } from './crafting';
import { ENCHANT_BY_KEY, type EnchantDef, type GearBonus } from './catalog';
import { SET_BY_ID, WEAPONS, armorClimate, armorTotals, parseArmorId } from './equipment';
import { GEAR_SLOTS } from './catalog';
import type { EquipState } from './protocol';
import { ITEMS, type Props, type Stack } from './items';
import { recipesMaking } from './recipes';

export const MAX_UPGRADE = 5;
export type GearClass = 'weapon' | 'armor' | 'gear';

export function gearClassOf(id: string): GearClass | null {
  const d = ITEMS[id];
  if (!d) return null;
  if (d.weapon) return 'weapon';
  if (d.armor) return 'armor';
  if (d.gear) return 'gear';
  return null;
}

/** Durability of a plain (quality 1, no upgrades) piece. */
export function baseDurability(id: string): number {
  const d = ITEMS[id];
  if (!d) return 0;
  if (d.gear) return d.gear.dur;
  if (d.weapon) return 140 + (WEAPONS[d.weapon]?.level ?? 1) * 7;
  if (d.armor) return 120 + (SET_BY_ID[d.armor.set]?.level ?? 1) * 6;
  return 0;
}

const tierOf = (p: Props | undefined): number =>
  Number.isFinite(p?.qt) ? Math.max(0, Math.min(4, Math.round(p!.qt!))) : 1;
const upOf = (p: Props | undefined): number =>
  Number.isFinite(p?.up) ? Math.max(0, Math.min(MAX_UPGRADE, Math.round(p!.up!))) : 0;
export const gearPower = (p: Props | undefined): number => QUALITY_POWER[tierOf(p)]! * (1 + 0.06 * upOf(p));
export function maxDurability(id: string, p: Props | undefined): number {
  const q = 1 + (tierOf(p) - 1) * 0.12;
  return Math.round(baseDurability(id) * q * (1 + 0.1 * upOf(p)));
}
export const isBroken = (p: Props | undefined): boolean => !!p && p.maxDur !== undefined && (p.dur ?? p.maxDur) <= 0;
export const durabilityOf = (p: Props | undefined): { dur: number; max: number } | null =>
  p && p.maxDur !== undefined ? { dur: Math.max(0, Math.min(p.maxDur, p.dur ?? p.maxDur)), max: p.maxDur } : null;
/** The props a freshly crafted piece starts with. */
export function newGearProps(id: string, qt: number): Props {
  const p: Props = { qt };
  p.maxDur = maxDurability(id, p);
  p.dur = p.maxDur;
  return p;
}
export const qualityLabel = (p: Props | undefined): string => CRAFT_QUALITY[tierOf(p)]!;

/** The enchantment bound to a stack (a known one only). */
export const enchantOf = (p: Props | undefined): EnchantDef | null =>
  p?.ench ? (ENCHANT_BY_KEY[p.ench] ?? null) : null;
export function enchantBonus(p: Props | undefined): GearBonus | null {
  if (isBroken(p)) return null;
  return enchantOf(p)?.bonus ?? null;
}
/** May this rune be bound to this item? Returns the reason it may not, or null. */
export function enchantBlock(id: string, key: string): string | null {
  const e = ENCHANT_BY_KEY[key],
    cls = gearClassOf(id),
    d = ITEMS[id];
  if (!e || !cls || !d) return 'That cannot be enchanted.';
  if (!e.on.includes(cls)) return `A rune of ${e.name.toLowerCase()} fits ${e.on.join(' or ')} only.`;
  if ((d.rarity ?? 0) < e.minRarity) return `Needs gear of higher rarity (${e.minRarity}+).`;
  return null;
}

/** Wear-out: the materials to mend a piece, a share of what it was made from in proportion to the damage. */
export function repairCost(id: string, p: Props | undefined): Array<[string, number]> {
  const du = durabilityOf(p);
  if (!du || du.dur >= du.max) return [];
  const missing = 1 - du.dur / du.max;
  const rec = recipesMaking(id)[0];
  if (!rec) return [];
  return rec.inputs
    .filter((i) => !i.id.startsWith('*'))
    .map((i): [string, number] => [i.id, Math.max(1, Math.ceil(i.n * missing * 0.5))])
    .slice(0, 3);
}
/** Upgrade: another share of the materials, more each level. */
export function upgradeCost(id: string, p: Props | undefined): Array<[string, number]> {
  const up = p?.up ?? 0;
  const rec = recipesMaking(id)[0];
  if (!rec || up >= MAX_UPGRADE) return [];
  return rec.inputs
    .filter((i) => !i.id.startsWith('*'))
    .map((i): [string, number] => [i.id, Math.max(1, Math.ceil(i.n * (0.4 + 0.3 * up)))]);
}
/** Discipline and level needed to upgrade this piece to its next level. */
export function upgradeNeed(id: string, p: Props | undefined): { disc: Discipline; lvl: number } | null {
  const rec = recipesMaking(id)[0];
  if (!rec) return null;
  return { disc: rec.disc, lvl: rec.lvl + (p?.up ?? 0) * 2 };
}

/** One-line description of a piece's condition for tooltips. */
export function conditionLines(s: Stack): string[] {
  const out: string[] = [];
  if (s.p?.qt !== undefined) out.push(`${CRAFT_QUALITY[tierOf(s.p)]} quality`);
  if (s.p?.up) out.push(`Upgraded +${s.p.up}`);
  const e = enchantOf(s.p);
  if (e) out.push(`Enchanted: ${e.name}. ${e.blurb}`);
  const du = durabilityOf(s.p);
  if (du) out.push(du.dur <= 0 ? 'Broken: repair it to use it again.' : `Durability ${du.dur}/${du.max}`);
  return out;
}

// ───────────────────────── what a set of equipment gives ─────────────────────────

export interface StatBlock {
  hpBonus: number;
  atkBonus: number;
  luck: number;
  haste: number;
  /** damage reduction 0..1 (the caller caps it) */
  def: number;
  phase: number;
  warm: number;
  cool: number;
  drain: number;
  light: number;
  craft: number;
  stamina: number;
}
export const emptyStatBlock = (): StatBlock => ({
  hpBonus: 0,
  atkBonus: 0,
  luck: 0,
  haste: 0,
  def: 0,
  phase: 0,
  warm: 0,
  cool: 0,
  drain: 0,
  light: 0,
  craft: 0,
  stamina: 0,
});

/**
 * Everything worn and wielded, added up: rings, armour with set bonuses, weapon, shields, cloaks, amulets, belts, charms
 * and lanterns, scaled by each piece's quality and upgrades, minus broken pieces, plus enchantments. The server derives a
 * player's stats from it and the client previews a swap with it, so the two always agree.
 */
export function equipmentStats(e: EquipState): StatBlock {
  const s = emptyStatBlock();
  const live = (st: Stack | null | undefined): Stack | null => (st && !isBroken(st.p) ? st : null);
  const add = (b: GearBonus | null | undefined, k = 1): void => {
    if (!b) return;
    s.hpBonus += Math.round((b.hp ?? 0) * k);
    s.atkBonus += Math.round((b.atk ?? 0) * k);
    s.def += (b.def ?? 0) * k;
    s.luck += (b.luck ?? 0) * k;
    s.haste += (b.haste ?? 0) * k;
    s.phase += (b.phase ?? 0) * k;
    s.warm += b.warm ?? 0;
    s.cool += b.cool ?? 0;
    s.drain += b.drain ?? 0;
    s.light = Math.max(s.light, b.light ?? 0);
    s.craft += b.craft ?? 0;
    s.stamina += b.stamina ?? 0;
  };
  for (const r of [e.ring1, e.ring2]) {
    if (!r?.p?.stat || !Number.isFinite(r.p.val)) continue;
    const v = r.p.val!;
    if (r.p.stat === 'hp') s.hpBonus += v;
    else if (r.p.stat === 'atk') s.atkBonus += v;
    else if (r.p.stat === 'luck') s.luck += v;
    else if (r.p.stat === 'haste') s.haste += v;
  }
  const worn = (['head', 'chest', 'legs', 'feet'] as const).map((k) => live(e[k]));
  const a = armorTotals({
    head: worn[0]?.id ?? null,
    chest: worn[1]?.id ?? null,
    legs: worn[2]?.id ?? null,
    feet: worn[3]?.id ?? null,
  });
  const present = worn.filter((x): x is Stack => !!x);
  const ak = present.length ? present.reduce((t, x) => t + gearPower(x.p), 0) / present.length : 1;
  add(a.bonus, ak);
  // what the armour is made of keeps out the cold or the heat (unscaled: a worn fur coat is warm whatever its grade)
  for (const st of present) {
    const set = parseArmorId(st.id)?.set;
    if (set) add(armorClimate(set));
  }
  const weapon = live(e.weapon);
  const w = weapon ? ITEMS[weapon.id]?.weapon : undefined;
  if (weapon && w) add(WEAPONS[w]?.bonus, gearPower(weapon.p));
  for (const slot of GEAR_SLOTS) {
    const g = live(e[slot]);
    const spec = g ? ITEMS[g.id]?.gear : undefined;
    if (g && spec) add(spec.bonus, gearPower(g.p));
  }
  for (const slot of ['weapon', 'head', 'chest', 'legs', 'feet', ...GEAR_SLOTS] as const)
    add(enchantBonus(live(e[slot])?.p));
  return s;
}
