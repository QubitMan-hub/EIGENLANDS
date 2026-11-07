import { expect, it } from 'vitest';
import { armHand, handOf, meleeTap, newPlayerSim, sanitizeCmd, stepPlayer, type Stack } from '../src';

const st = (id: string, tier?: number): Stack => ({ id, n: 1, ...(tier ? { p: { tier } } : {}) });

it('the hand fights with what it holds: weapons, tools by tier, fists, and never food or materials', () => {
  expect(handOf(st('sword', 1), null)).toMatchObject({ kind: 'weapon', family: 'sword', mult: 1, oneHanded: true });
  const axe1 = handOf(st('axe', 1), null),
    axe3 = handOf(st('axe', 3), null);
  expect(axe1).toMatchObject({ kind: 'tool', family: 'battle_axe', art: 'axe' });
  expect(axe3.mult).toBeGreaterThan(axe1.mult);
  expect(axe1.mult).toBeLessThan(1);
  expect(handOf(st('pickaxe'), null).family).toBe('warhammer');
  // a rod is a poor club next to an axe
  expect(handOf(st('rod'), null).mult).toBeLessThan(axe1.mult);
  const fist = handOf(null, null);
  expect(fist).toMatchObject({ kind: 'fist', art: null });
  expect(Math.round(meleeTap(fist.family, 0).damage * fist.mult)).toBeLessThan(meleeTap('sword', 0).damage);
  expect(handOf(st('fiber'), null).kind).toBe('none');
  expect(handOf(st('plank'), null).kind).toBe('none');
});

it('an empty hand draws the equipped weapon; a selected item overrides it', () => {
  const equipped = handOf(null, st('battle_axe'));
  expect(equipped).toMatchObject({ kind: 'weapon', family: 'battle_axe', oneHanded: false });
  expect(handOf(st('axe'), st('battle_axe')).kind).toBe('tool');
  // the quick-bar sword is the default blade: an equipped weapon replaces it
  expect(handOf(st('sword'), st('battle_axe')).weapon?.id).toBe('battle_axe');
  expect(handOf(st('crossbow'), null).oneHanded).toBe(false);
});

it('only a one-handed grip leaves room for a shield', () => {
  const p = newPlayerSim(0, 0);
  armHand(p, handOf(st('sword'), null), st('wood_shield'));
  expect(p.shield).toBeGreaterThan(0);
  armHand(p, handOf(st('hoe'), null), st('wood_shield'));
  expect(p.shield).toBe(0);
  armHand(p, handOf(st('sword'), null), null);
  expect(p.shield).toBe(0);
});

it('with food or materials in hand the attack button does nothing', () => {
  const p = newPlayerSim(0, 0);
  armHand(p, handOf(st('fiber'), null), null);
  expect(p.unarmed).toBe(true);
  const ev = stepPlayer(p, sanitizeCmd({ seq: 1, attack: true, aimX: 1 }), () => false);
  expect(ev.attacked).toBe(false);
  armHand(p, handOf(st('sword'), null), null);
  expect(stepPlayer(p, sanitizeCmd({ seq: 2, attack: true, aimX: 1 }), () => false).attacked).toBe(true);
});
