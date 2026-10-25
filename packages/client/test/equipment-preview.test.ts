import { expect, it } from 'vitest';
import { Profile } from '../src/game/profile';
import { equipmentPreview } from '../src/ui/equipment-preview';

it('includes set bonuses gained or lost by replacing a piece', () => {
  const p = new Profile();
  p.equip.head = { id: 'armor_leather_head', n: 1 };
  p.stats.hpBonus = 5;
  p.stats.def = 0.02;
  p.inv[10] = { id: 'armor_leather_chest', n: 1 };
  const next = equipmentPreview(p, 10, 'chest');
  expect(next.hpBonus).toBe(10);
  expect(next.luck).toBe(1);
  p.equip.chest = p.inv[10];
  p.stats = next;
  p.inv[10] = { id: 'armor_iron_head', n: 1 };
  expect(equipmentPreview(p, 10, 'head').luck).toBe(0);
});
it('compares the chosen ring and preserves progression health', () => {
  const p = new Profile();
  p.equip.ring1 = { id: 'ring_hp', n: 1, p: { stat: 'hp', val: 12 } };
  p.stats.hpBonus = 42;
  p.inv[11] = { id: 'ring_atk', n: 1, p: { stat: 'atk', val: 4 } };
  expect(equipmentPreview(p, 11, 'ring1')).toMatchObject({ hpBonus: 30, atkBonus: 4 });
  expect(equipmentPreview(p, 11, 'ring2')).toMatchObject({ hpBonus: 42, atkBonus: 4 });
});
it('uses focus bonuses and rejects invalid equipment slots', () => {
  const p = new Profile();
  p.inv[10] = { id: 'rime_staff', n: 1 };
  expect(equipmentPreview(p, 10, 'weapon').hpBonus).toBe(8);
  expect(equipmentPreview(p, 10, 'head')).toEqual(p.stats);
});
