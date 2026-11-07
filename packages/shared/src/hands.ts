/**
 * What a traveller fights with: the thing in their hand, not whatever happens to be equipped.
 *
 * - A weapon in the selected quick-bar slot is swung or fired. The quick-bar sword stands for the equipped weapon when
 *   one is equipped (it is the default blade the weapon slot replaces).
 * - A tool fights too, as a poorer weapon: an axe hacks like a battle-axe, a pickaxe like a warhammer, a hoe jabs like a
 *   spear, and a rod, net or can barely hurts. Better tiers hit harder.
 * - An empty hand draws the equipped weapon, or fights with bare fists when there is none.
 * - Anything else (food, materials, seeds, furniture) is not a weapon: the attack button does nothing until it is put
 *   away.
 *
 * A one-handed grip leaves the off hand free for a shield, which widens the guard, lengthens the parry window, softens
 * blocked blows and can take a blow too heavy for a bare guard (see `defend`).
 */
import { meleeFamily, type MeleeFamily } from './combat';
import { isRangedWeapon, WEAPONS, type WeaponDef } from './equipment';
import { ITEMS, type Stack } from './items';
import { setMeleeWeapon, type PlayerSim } from './sim';

export type HandKind = 'weapon' | 'tool' | 'fist' | 'none';
export interface Hand {
  kind: HandKind;
  /** the weapon whose moves and shots this hand uses (null for tools, fists and nothing) */
  weapon: WeaponDef | null;
  /** the melee moveset the shared sim swings */
  family: MeleeFamily;
  /** multiplier on the family's damage (tools and fists hit softer) */
  mult: number;
  /** the off hand is free for a shield */
  oneHanded: boolean;
  /** what the character is drawn holding (a weapon or tool art id), or null for an empty hand */
  art: string | null;
  /** the held item's name, for hints */
  name: string;
}

/** weapon families held in both hands */
const TWO_HANDED = new Set(['spear', 'battle_axe', 'warhammer', 'greatsword', 'crossbow', 'longbow']);
export const isTwoHanded = (w: WeaponDef | null | undefined): boolean =>
  !!w && (w.cls === 'staff' || TWO_HANDED.has(w.fam ?? w.id));

/** a tool used as a weapon: moveset, damage at tier 1, extra per tier, and whether it leaves a hand free */
const TOOL_HANDS: Record<string, { family: MeleeFamily; base: number; per: number; oneHanded: boolean }> = {
  axe: { family: 'battle_axe', base: 0.55, per: 0.08, oneHanded: true },
  pickaxe: { family: 'warhammer', base: 0.5, per: 0.08, oneHanded: true },
  hoe: { family: 'spear', base: 0.4, per: 0.06, oneHanded: false },
  rod: { family: 'spear', base: 0.22, per: 0.02, oneHanded: false },
  net: { family: 'dagger', base: 0.3, per: 0.02, oneHanded: true },
  can: { family: 'dagger', base: 0.25, per: 0.02, oneHanded: true },
};
export const FIST_MULT = 0.45;

function weaponHand(w: WeaponDef, name: string): Hand {
  return { kind: 'weapon', weapon: w, family: meleeFamily(w.id), mult: 1, oneHanded: !isTwoHanded(w), art: w.id, name };
}

/** The hand a player fights with, from the selected quick-bar stack and the equipped weapon. */
export function handOf(held: Stack | null | undefined, equipped: Stack | null | undefined): Hand {
  const d = held ? ITEMS[held.id] : undefined;
  if (!held || !d) {
    const wid = equipped ? ITEMS[equipped.id]?.weapon : undefined;
    const w = wid ? WEAPONS[wid] : undefined;
    if (w) return weaponHand(w, w.name);
    return { kind: 'fist', weapon: null, family: 'dagger', mult: FIST_MULT, oneHanded: true, art: null, name: 'fists' };
  }
  // an equipped weapon replaces the quick-bar sword (EquipState.weapon: null = the hotbar sword)
  if (d.id === 'sword' && equipped && ITEMS[equipped.id]?.weapon) return handOf(null, equipped);
  const wid = d.weapon ?? (d.id === 'sword' ? 'sword' : undefined);
  const w = wid ? WEAPONS[wid] : undefined;
  if (w) return weaponHand(w, d.name);
  const tool = d.tool ? TOOL_HANDS[d.tool.type] : undefined;
  if (tool) {
    const tier = Math.max(1, Math.min(6, Number(held.p?.tier ?? 1) || 1));
    return {
      kind: 'tool',
      weapon: null,
      family: tool.family,
      mult: Math.round((tool.base + tool.per * (tier - 1)) * 100) / 100,
      oneHanded: tool.oneHanded,
      art: d.tool!.type,
      name: d.name,
    };
  }
  return { kind: 'none', weapon: null, family: 'dagger', mult: 0, oneHanded: true, art: null, name: d.name };
}

/** Guard strength of an equipped shield (0 none, up to 1): heavier shields guard better. */
export function shieldStrength(shield: Stack | null | undefined): number {
  const g = shield ? ITEMS[shield.id]?.gear : undefined;
  if (!g || g.slot !== 'shield') return 0;
  return Math.min(1, 0.55 + (g.bonus.def ?? 0) * 6);
}

/** Arm the shared sim from the hand (client prediction and server do the same each step, so replays agree). */
export function armHand(p: PlayerSim, hand: Hand, shield: Stack | null | undefined): void {
  p.ranged = isRangedWeapon(hand.weapon);
  setMeleeWeapon(p, hand.weapon?.id ?? hand.family);
  p.unarmed = hand.kind === 'none';
  p.shield = hand.oneHanded && hand.kind !== 'none' ? shieldStrength(shield) : 0;
}
