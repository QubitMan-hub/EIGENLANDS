/**
 * What the HUD says about a creature: which camp it is in, its elite modifiers and its combat state, as short chips
 * with a one-line explanation each. Pure, so the rules are tested; the target frame and the world bars share it.
 */
import { ELITE, ELITE_HP_MULT } from '@eigenlands/shared';

export type Faction = 'hostile' | 'neutral' | 'passive' | 'ally' | 'elite';

export interface EnemyChip {
  id: string;
  label: string;
  /** pixel icon name (ui/icons.ts) */
  icon: string;
  tone: 'info' | 'warn' | 'good';
  desc: string;
}

export interface EnemyFacts {
  passive?: boolean;
  neutral?: boolean;
  armor?: boolean;
  poise?: number;
}

export const FACTION_LABEL: Record<Faction, string> = {
  hostile: 'Hostile',
  neutral: 'Neutral',
  passive: 'Passive',
  ally: 'Ally',
  elite: 'Elite',
};

/** Elite wins over camp so a dangerous creature never looks routine; allies are always allies. */
export function factionOf(def: EnemyFacts | undefined, elite: number, ally: boolean): Faction {
  if (ally) return 'ally';
  if (elite) return 'elite';
  return def?.passive ? 'passive' : def?.neutral ? 'neutral' : 'hostile';
}

export const ELITE_INFO: Record<number, { label: string; icon: string; desc: string }> = {
  [ELITE.HARDENED]: {
    label: 'Hardened',
    icon: 'st_shield',
    desc: `${ELITE_HP_MULT}× health, double poise and half knockback.`,
  },
  [ELITE.SWIFT]: { label: 'Swift', icon: 'bolt', desc: 'Moves 35% faster and winds up 15% sooner.' },
  [ELITE.VOLATILE]: { label: 'Volatile', icon: 'st_heat', desc: 'Detonates shortly after it dies. Step back.' },
  [ELITE.BOUNTY]: {
    label: 'Bounty',
    icon: 'coin',
    desc: 'A town has a price on its head. It has a signature move: watch the ground for its warning.',
  },
};

export function eliteMods(elite: number): number[] {
  return [ELITE.HARDENED, ELITE.SWIFT, ELITE.VOLATILE, ELITE.BOUNTY].filter((bit) => (elite & bit) !== 0);
}

const FACTION_CHIP: Record<Faction, Omit<EnemyChip, 'id'>> = {
  hostile: { label: 'Hostile', icon: 'sword', tone: 'warn', desc: 'Attacks on sight.' },
  neutral: { label: 'Neutral', icon: 'st_ward', tone: 'info', desc: 'Ignores you until it is hurt.' },
  passive: { label: 'Passive', icon: 'st_regen', tone: 'good', desc: 'Harmless; it flees from you.' },
  ally: { label: 'Ally', icon: 'heart', tone: 'good', desc: 'Fights on your side.' },
  elite: { label: 'Elite', icon: 'st_might', tone: 'warn', desc: 'A rarer, stronger variant with modifiers.' },
};

export interface ChipInput {
  faction: Faction;
  def?: EnemyFacts;
  elite: number;
  /** enemy stance byte: 2 winding up, 4 recovering, 5 staggered */
  st: number;
  night: boolean;
}

export function enemyChips(i: ChipInput): EnemyChip[] {
  const out: EnemyChip[] = [{ id: i.faction, ...FACTION_CHIP[i.faction] }];
  for (const bit of eliteMods(i.elite)) {
    const e = ELITE_INFO[bit]!;
    out.push({ id: `elite_${bit}`, label: e.label, icon: e.icon, tone: 'warn', desc: e.desc });
  }
  if (i.def?.armor)
    out.push({
      id: 'armor',
      label: 'Armoured',
      icon: 'st_ward',
      tone: 'info',
      desc: 'Light hits do little and cannot stagger it. Use heavy hits, finishers or slams.',
    });
  if (i.night) out.push({ id: 'night', label: 'Night', icon: 'rune', tone: 'warn', desc: 'Stronger after dark.' });
  if (i.st === 2)
    out.push({ id: 'windup', label: 'Striking', icon: 'st_heat', tone: 'warn', desc: 'Preparing a strike. Dodge it.' });
  else if (i.st === 5)
    out.push({ id: 'staggered', label: 'Staggered', icon: 'st_crack', tone: 'good', desc: 'Open to attack.' });
  else if (i.st === 4)
    out.push({ id: 'recovering', label: 'Recovering', icon: 'st_chill', tone: 'good', desc: 'Between attacks.' });
  return out;
}

/** Poise/armour wording: bosses and armoured creatures show it as "Armor", the rest as "Poise". */
export function poiseLabel(def: EnemyFacts | undefined): string {
  return def?.armor ? 'Armor' : 'Poise';
}
