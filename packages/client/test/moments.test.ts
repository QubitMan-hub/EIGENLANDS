import { describe, expect, it } from 'vitest';
import { isRareStack, levelMoment, momentFromToast } from '../src/ui/moments';

describe('celebration moments', () => {
  it('recognises the server messages that deserve a card', () => {
    expect(momentFromToast('Quest complete: Welcome to Hadamere! (50 coins)')).toEqual({
      kind: 'quest',
      title: 'Quest complete',
      sub: 'Welcome to Hadamere · 50 coins',
    });
    expect(momentFromToast('New gate: Split')?.kind).toBe('skill');
    expect(momentFromToast('New gates: Split ×2')?.title).toBe('Gate unlocked');
    expect(momentFromToast('You discovered Hearty Stew!')).toMatchObject({ kind: 'recipe', sub: 'Hearty Stew' });
    expect(momentFromToast('Mayor Orla taught you a recipe: Loaf!')?.title).toBe('Recipe learned');
    expect(momentFromToast('Mining level 4!')).toMatchObject({ kind: 'skill', title: 'Mining level 4' });
    expect(momentFromToast('Your heart grows: +10 maximum health (2/10).')?.kind).toBe('heart');
  });

  it('leaves ordinary toasts alone', () => {
    for (const t of [
      'Crafted 1 Plank',
      'New quest: Seeds',
      'Bought 2 Wood for 10.',
      '✓ Chop 5 trees',
      'Not enough room',
    ])
      expect(momentFromToast(t)).toBeNull();
  });

  it('describes level-ups', () => {
    expect(levelMoment(7)).toMatchObject({ kind: 'levelup', title: 'Level 7' });
  });

  it('marks forged quality, high tiers and valuable finds as rare, but not food or plain tools', () => {
    expect(isRareStack({ id: 'sword', n: 1, p: { qname: 'Superior' } })).toBe(true);
    expect(isRareStack({ id: 'axe', n: 1, p: { tier: 3 } })).toBe(true);
    expect(isRareStack({ id: 'axe', n: 1, p: { tier: 1 } })).toBe(false);
    expect(isRareStack({ id: 'wood', n: 5 })).toBe(false);
    expect(isRareStack({ id: 'qubit_tea', n: 1 })).toBe(false);
    expect(isRareStack({ id: 'nonexistent_item', n: 1 })).toBe(false);
  });
});
