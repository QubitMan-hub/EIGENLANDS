import { ENEMY_BY_KIND, type EnemyDef } from './combat';

/**
 * Shadow Army: the echoes of the creatures you defeat can be extracted, bound to you, and evolved.
 * Rules shared by the server (extraction rolls, stats) and the client (roster window, prompts).
 */
export const SHADOW_RANKS = ['Soldier', 'Knight', 'Elite', 'Commander', 'Marshal'] as const;
/** shadow level at which each rank is reached */
export const RANK_LEVEL = [1, 6, 14, 24, 38] as const;
export const RANK_HP = [1, 1.45, 2.1, 3, 4.2] as const;
export const RANK_DMG = [1, 1.35, 1.8, 2.4, 3.2] as const;
export const MAX_SHADOW_LEVEL = 50;

/** the player level at which the Shadow Sigil awakens */
export const EXTRACT_LEVEL = 5;
export const EXTRACT_RANGE = 3.5;
export const EXTRACT_SECS = 1.2;
/** how long a defeated creature's residue lingers */
export const RESIDUE_SECS = 12;
export const ROSTER_MAX = 16;
/** shadows that fall are re-formed after this long, at 60% health */
export const SHADOW_REFORM_SECS = 20;

export type Stance = 'assist' | 'guard' | 'aggressive';
export const STANCES: Stance[] = ['assist', 'guard', 'aggressive'];
export const STANCE_INFO: Record<Stance, string> = {
  assist: 'Attack what you target, and whatever threatens you.',
  guard: 'Stay close and only fight what comes near you.',
  aggressive: 'Hunt anything hostile in sight.',
};

export interface ShadowRec {
  id: string;
  /** enemy kind index (ENEMY_BY_KIND) this shadow was extracted from */
  kind: number;
  name: string;
  level: number;
  xp: number;
  /** Guild escorts use the same follow/combat slots, but their paid contract expires. */
  contractUntil?: number;
  /** A living wildlife bond, rather than an extracted echo. Valid only for companionBond kinds. */
  bonded?: true;
}

export interface ShadowRosterMsg {
  roster: ShadowRec[];
  /** ids currently summoned */
  active: string[];
  slots: number;
  stance: Stance;
  /** player level needed before the Sigil works */
  unlock: number;
}

export type ShadowEvent =
  | { kind: 'channel'; chance: number; secs: number; name: string }
  | { kind: 'extracted'; rec: ShadowRec }
  | { kind: 'failed'; reason: 'roll' | 'moved' | 'gone' | 'full' | 'level' | 'range' }
  | { kind: 'level'; id: string; level: number }
  | { kind: 'evolved'; id: string; rank: number; name: string }
  | { kind: 'fallen'; id: string; name: string }
  | { kind: 'reformed'; id: string };

export const rankOf = (level: number): number => {
  let r = 0;
  for (let i = 0; i < RANK_LEVEL.length; i++) if (level >= RANK_LEVEL[i]!) r = i;
  return r;
};
export const rankName = (level: number): string => SHADOW_RANKS[rankOf(level)]!;

/** How many shadows you can field at once. */
export const shadowSlots = (playerLevel: number): number =>
  playerLevel < EXTRACT_LEVEL ? 0 : Math.min(8, 1 + Math.floor(playerLevel / 8));

export const shadowXpNeeded = (level: number): number => 18 + level * 12;

const base = (kind: number): EnemyDef => ENEMY_BY_KIND[kind]!;
export const canExtract = (kind: number): boolean => {
  const d = ENEMY_BY_KIND[kind];
  return !!d && kind !== 21 && !d.passive && !d.sea;
};

/** Shadow stats from the source creature, its level and rank. */
export function shadowStats(kind: number, level: number): { hp: number; dmg: number; speed: number } {
  const d = base(kind),
    r = rankOf(level),
    lv = 1 + 0.06 * (level - 1);
  return {
    hp: Math.round(d.hp * lv * RANK_HP[r]! * 1.15),
    dmg: lv * RANK_DMG[r]!,
    speed: 1 + Math.min(0.25, level * 0.005),
  };
}

/**
 * Chance (0..1) that extraction succeeds: better when you outlevel the creature, worse for elites and brutes.
 * Fully deterministic so the client can show it before you commit.
 */
export function extractChance(playerLevel: number, enemyLevel: number, o: { elite?: boolean; kind: number }): number {
  const d = base(o.kind);
  let c = 0.55 + 0.035 * Math.max(-8, Math.min(10, playerLevel - enemyLevel));
  if (o.elite) c -= 0.12;
  if ((d.budget ?? 1) >= 3) c -= 0.1;
  if (d.neutral) c += 0.05;
  return Math.max(0.1, Math.min(0.92, c));
}

/** XP a shadow earns when a creature worth `enemyXp` falls nearby. */
export const shadowXpFrom = (enemyXp: number): number => Math.max(1, Math.round(enemyXp * 0.6));

/** Add XP; returns levels gained and whether the rank changed. */
export function addShadowXp(rec: ShadowRec, xp: number, playerLevel: number): { levels: number; evolved: boolean } {
  const r0 = rankOf(rec.level);
  let levels = 0;
  rec.xp += xp;
  const cap = Math.min(MAX_SHADOW_LEVEL, playerLevel + 5);
  while (rec.level < cap && rec.xp >= shadowXpNeeded(rec.level)) {
    rec.xp -= shadowXpNeeded(rec.level);
    rec.level++;
    levels++;
  }
  if (rec.level >= cap) rec.xp = Math.min(rec.xp, shadowXpNeeded(rec.level) - 1);
  return { levels, evolved: rankOf(rec.level) > r0 };
}

export function newShadow(id: string, kind: number, level: number): ShadowRec {
  return {
    id,
    kind,
    name: `Shade ${base(kind).name.replace(/^(Wisp|Glint|Phase|Decoherent|Static|Wild|Dire) /, '')}`,
    level: Math.max(1, Math.min(MAX_SHADOW_LEVEL, Math.round(level))),
    xp: 0,
  };
}
