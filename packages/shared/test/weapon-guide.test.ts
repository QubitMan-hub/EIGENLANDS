import { expect, it } from 'vitest';
import {
  attackDamage,
  weaponShotPower,
  weaponRecovery,
  quickbarAttack,
  equipmentLevel,
  WEAPONS,
  emptyInventory,
} from '../src';
it('shares actual melee rounding, shot scaling and the independent ranged cooldown', () => {
  expect(attackDamage(8, 4)).toBe(12);
  expect(attackDamage(8, 4, 0.25)).toBe(15);
  expect(weaponShotPower(null, 10)).toBe(1.2);
  expect(weaponShotPower(0, 0)).toBe(0.7);
  expect(weaponShotPower(1, 0)).toBe(1.2);
  expect(weaponRecovery(WEAPONS.crossbow, false, 0)).toBe(0.55);
  expect(weaponRecovery(WEAPONS.crossbow, true, 0)).toBeCloseTo(0.77);
  expect(weaponRecovery(WEAPONS.crossbow, false, 2)).toBeCloseTo(0.5);
});
it('only the strongest quick-bar sword contributes, regardless of selected slot', () => {
  const inv = emptyInventory();
  inv[0] = { id: 'sword', n: 1, p: { atk: 4 } };
  inv[9] = { id: 'sword', n: 1, p: { atk: 9 } };
  inv[10] = { id: 'sword', n: 1, p: { atk: 99 } };
  expect(quickbarAttack(inv)).toBe(9);
  inv[9] = null;
  expect(quickbarAttack(inv)).toBe(4);
});
it('shares authoritative level requirements for weapons, armour and ordinary items', () => {
  expect(equipmentLevel('crossbow')).toBe(5);
  expect(equipmentLevel('morph_staff')).toBe(16);
  expect(equipmentLevel('sword')).toBe(1);
  expect(equipmentLevel('wood')).toBe(1);
  expect(equipmentLevel('armor_iron_head')).toBeGreaterThan(1);
});
