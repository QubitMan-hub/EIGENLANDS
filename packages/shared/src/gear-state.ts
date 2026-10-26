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
import { SET_BY_ID, WEAPONS } from './equipment';
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

export const gearPower = (p: Props | undefined): number => QUALITY_POWER[p?.qt ?? 1]! * (1 + 0.06 * (p?.up ?? 0));
export function maxDurability(id: string, p: Props | undefined): number {
  const q = 1 + ((p?.qt ?? 1) - 1) * 0.12;
  return Math.round(baseDurability(id) * q * (1 + 0.1 * (p?.up ?? 0)));
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
export const qualityLabel = (p: Props | undefined): string => CRAFT_QUALITY[p?.qt ?? 1]!;

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
  const q = s.p?.qt;
  if (q !== undefined) out.push(`${CRAFT_QUALITY[q]} quality`);
  if (s.p?.up) out.push(`Upgraded +${s.p.up}`);
  const e = enchantOf(s.p);
  if (e) out.push(`Enchanted: ${e.name}. ${e.blurb}`);
  const du = durabilityOf(s.p);
  if (du) out.push(du.dur <= 0 ? 'Broken: repair it to use it again.' : `Durability ${du.dur}/${du.max}`);
  return out;
}
