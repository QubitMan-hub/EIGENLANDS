import { expect, it } from 'vitest';
import {
  COMBO,
  heavyHit,
  MELEE_COMBOS,
  meleeFamily,
  meleeTap,
  meleeHeavy,
  newPlayerSim,
  setMeleeWeapon,
  stepPlayer,
  inArc,
  sanitizeCmd,
  WEAPONS,
  ITEMS,
  RECIPES,
} from '../src';
const open = () => false;
const cmd = (extra: object = {}) =>
  sanitizeCmd({ seq: 1, viewTick: 0, dx: 0, dy: 0, attack: false, hold: false, aimX: 1, aimY: 0, ...extra });
it('retains exact sword and morph-fallback attacks while giving three distinct balanced melee roles', () => {
  expect(meleeFamily('morph_staff')).toBe('sword');
  expect(meleeFamily('axe')).toBe('sword');
  expect(meleeFamily('spear')).toBe('spear');
  for (let i = 0; i < 3; i++) expect(meleeTap('sword', i)).toBe(COMBO[i]);
  expect(meleeHeavy('sword', 0.6)).toEqual(heavyHit(0.6));
  expect(meleeTap('spear', 0).range).toBeGreaterThan(COMBO[0]!.range);
  expect(meleeTap('spear', 0).arc).toBeGreaterThan(COMBO[0]!.arc);
  expect(meleeTap('battle_axe', 0).arc).toBeLessThan(COMBO[0]!.arc);
  expect(meleeTap('warhammer', 2).poise).toBeGreaterThanOrEqual(COMBO[2]!.poise * 2);
  expect(meleeTap('warhammer', 2).weight).toBe(2);
  const dps = (hits: readonly { damage: number; recovery: number }[]) =>
    hits.reduce((n, h) => n + h.damage, 0) / hits.reduce((n, h) => n + h.recovery, 0);
  for (const id of ['spear', 'battle_axe', 'warhammer'])
    expect(dps(MELEE_COMBOS[meleeFamily(id)])).toBeLessThan(dps(COMBO));
  expect(meleeHeavy('warhammer', 1).poise).toBe(60);
  expect(meleeHeavy('spear', 99)).toEqual(meleeHeavy('spear', 1));
  expect(meleeHeavy('battle_axe', -2)).toEqual(meleeHeavy('battle_axe', 0));
});
it('uses true narrow/long and wide/short hit geometry rather than cosmetic weapon names', () => {
  const hit = (id: string, x: number, y: number) => inArc(0, 0, 1, 0, meleeTap(id, 0), { x, y, r: 0 });
  expect(hit('spear', 2.2, 0)).toBe(true);
  expect(hit('sword', 2.2, 0)).toBe(false);
  expect(hit('spear', 0.4, 1.2)).toBe(false);
  expect(hit('sword', 0.4, 1.2)).toBe(false);
  expect(hit('battle_axe', 0.4, 1.2)).toBe(true);
});
it('runs family cadence/lunge in the shared simulation and preserves recovery when swapping', () => {
  const p = newPlayerSim(0, 0);
  setMeleeWeapon(p, 'warhammer');
  let ev = stepPlayer(p, cmd({ attack: true }), open);
  expect(ev.attacked).toBe(true);
  expect(p.atkCd).toBeCloseTo(meleeTap('warhammer', 0).recovery);
  const recovering = p.atkCd;
  p.charge = 0.7;
  p.hold = 1;
  setMeleeWeapon(p, 'spear');
  expect(p.atkCd).toBe(recovering);
  expect(p.combo).toBe(0);
  expect(p.charge).toBe(0);
  expect(p.hold).toBe(0);
  ev = stepPlayer(p, cmd({ attack: true }), open);
  expect(ev.attacked).toBe(false);
  p.atkCd = 0;
  p.atkBuf = 0;
  p.charge = 1;
  p.hold = 1;
  ev = stepPlayer(p, cmd(), open);
  expect(ev.heavy).toBe(true);
  expect(p.atkCd).toBeCloseTo(meleeHeavy('spear', 1).recovery);
});
it('provides real equipped items, known forge recipes and level gates, without replacing the sword tool bonus', () => {
  for (const [id, level] of [
    ['spear', 3],
    ['battle_axe', 6],
    ['warhammer', 10],
  ] as const) {
    expect(WEAPONS[id]).toMatchObject({ cls: 'blade', level });
    expect(ITEMS[id]?.weapon).toBe(id);
    expect(RECIPES.find((r) => r.id === id)).toMatchObject({ station: 'forge', learn: 'start', out: { id, n: 1 } });
  }
  expect(ITEMS.sword?.weapon).toBeUndefined();
});
