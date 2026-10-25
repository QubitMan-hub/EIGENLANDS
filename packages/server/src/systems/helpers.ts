import {
  INV_SIZE,
  SKILL_NAMES,
  addStack,
  cloneStack,
  skillLevel,
  type Inventory,
  type SkillId,
  type Stack,
} from '@eigenlands/shared';
import type { ServerPlayer } from '../rooms/player';
import { questEvent, syncQuests } from './quests';

export const isInt = (n: unknown, lo: number, hi: number): n is number =>
  Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;
export const validSlot = (n: unknown): n is number => isInt(n, 0, INV_SIZE - 1);

export const cloneInv = (inv: Inventory): Inventory => inv.map((s) => (s ? cloneStack(s) : null));

/** Would all `stacks` fit into the pack (without mutating it)? */
export function fitsAll(inv: Inventory, stacks: Stack[]): boolean {
  const sim = cloneInv(inv);
  for (const s of stacks) if (addStack(sim, s) > 0) return false;
  return true;
}

/** Atomically add stacks to a player's pack; false (and no change) if they do not all fit. */
export function giveStacks(p: ServerPlayer, stacks: Stack[], announce = true): boolean {
  if (!fitsAll(p.data.inv, stacks)) return false;
  for (const s of stacks) {
    addStack(p.data.inv, s);
    if (announce) p.toast(`+${s.n} ${s.id.replace(/_/g, ' ')}`, 'item', s);
    questEvent(p, { type: 'gain', target: s.id, n: s.n });
  }
  p.dirty('inv');
  syncQuests(p);
  return true;
}

export const skillLv = (p: ServerPlayer, skill: SkillId): number => skillLevel(p.data.skills[skill]);

export function addSkillXp(p: ServerPlayer, skill: SkillId, amount: number): void {
  if (amount <= 0) return;
  const before = skillLevel(p.data.skills[skill]);
  p.data.skills[skill] += Math.round(amount);
  const after = skillLevel(p.data.skills[skill]);
  p.dirty('skills');
  if (after > before) p.toast(`${SKILL_NAMES[skill]} level ${after}!`, 'good');
}

/** Distance from the player to the centre of a tile. */
export const distToTile = (p: ServerPlayer, tx: number, ty: number): number =>
  Math.hypot(tx + 0.5 - p.sim.x, ty + 0.5 - p.sim.y);

export const itemLabel = (id: string): string => id.replace(/_/g, ' ');
