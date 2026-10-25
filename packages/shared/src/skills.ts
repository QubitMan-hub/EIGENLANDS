import type { SkillId } from './nodes';

export const SKILLS: SkillId[] = ['farming', 'mining', 'foraging', 'fishing', 'crafting'];
export const SKILL_NAMES: Record<SkillId, string> = {
  farming: 'Farming',
  mining: 'Mining',
  foraging: 'Foraging',
  fishing: 'Fishing',
  crafting: 'Crafting',
};
export const MAX_SKILL = 10;
export type SkillXp = Record<SkillId, number>;
export const emptySkills = (): SkillXp => ({ farming: 0, mining: 0, foraging: 0, fishing: 0, crafting: 0 });

/** Total XP required to reach `level` (level 1 = 0). */
export const xpForSkillLevel = (level: number): number =>
  level <= 1 ? 0 : Math.round(25 * Math.pow(level - 1, 1.6) * 2);
export function skillLevel(xp: number): number {
  let l = 1;
  while (l < MAX_SKILL && xp >= xpForSkillLevel(l + 1)) l++;
  return l;
}
export const SKILL_PERKS: Record<SkillId, string> = {
  farming: '+5% chance of an extra crop per level',
  mining: '+5% tool damage per level and more ore',
  foraging: '+5% tool damage per level and double forage chance',
  fishing: 'Rarer fish and a gentler reel per level',
  crafting: '+4% chance to save an ingredient per level',
};
export function validSkills(v: unknown): SkillXp {
  const out = emptySkills();
  if (v && typeof v === 'object')
    for (const k of SKILLS) {
      const n = (v as Record<string, unknown>)[k];
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[k] = Math.floor(n);
    }
  return out;
}
