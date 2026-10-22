import { ABILITIES, ELEMENTS, type AbilityId } from '@eigenlands/shared';

/** A form's name with its element swapped for a tuned one ("Ember heavy bolt" tuned to Spark -> "Spark heavy bolt"). */
export function formName(a: AbilityId | null, bit: 0 | 1, hue: number): string {
  if (!a) return bit ? 'Second form' : 'First form';
  const f = ABILITIES[a].forms[bit];
  if (hue === f.hue) return f.name;
  const base = ELEMENTS[f.hue]!.name;
  const el = ELEMENTS[((hue % 8) + 8) % 8]!.name;
  return f.name.includes(base) ? f.name.replace(base, el) : `${el} ${f.name}`;
}

/** Floating cast label: "Frost twin-shot!" (sentence case, one exclamation). */
export function castShout(a: AbilityId | null, bit: 0 | 1, hue: number, misfire: boolean): string {
  if (misfire) return 'Misfire!';
  return `${formName(a, bit, hue).replace(/\s*\(.*\)$/, '')}!`;
}

export function stabilityWord(s: number): { word: string; cls: string } {
  if (s >= 0.97) return { word: 'Steady', cls: 'ok' };
  if (s >= 0.9) return { word: 'Mostly steady', cls: 'ok' };
  if (s >= 0.75) return { word: 'Shaky', cls: 'warn' };
  return { word: 'Unstable', cls: 'bad' };
}

export const orbName = (q: number): string => `Orb ${q + 1}`;
