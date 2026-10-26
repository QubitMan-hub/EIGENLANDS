import { expect, it } from 'vitest';
import { readHerd, advanceHerd, breedHerd, LIVESTOCK } from '../src/livestock';
import { ITEMS } from '../src/items';
it('migrates legacy shelters without losing animals, food or collected stock', () => {
  const d = readHerd({ animals: 2, fed: true, ready: 5 }, 'coop', 10);
  expect(d.herd).toHaveLength(2);
  expect(d.stock.egg).toBe(5);
  const n = advanceHerd(d, 11);
  expect(n.stock.egg).toBe(7);
  expect(advanceHerd(n, 11)).toEqual(n);
});
it('needs food, adulthood and happiness to produce and bounds offline stock', () => {
  const d = readHerd({ animals: 1, fed: false, ready: 0 }, 'barn', 4);
  expect(advanceHerd(d, 5).stock.milk ?? 0).toBe(0);
  d.fed = true;
  d.herd[0]!.born = 4;
  expect(advanceHerd(d, 5).stock.milk ?? 0).toBe(0);
  d.herd[0]!.born = 0;
  d.stock.milk = 99;
  expect(advanceHerd(d, 5).stock.milk).toBe(99);
  for (const s of Object.values(LIVESTOCK)) expect(ITEMS[s.product]).toBeTruthy();
});
it('breeds only fed happy adults of the same species with capacity and cooldown', () => {
  const d = readHerd({ animals: 2, fed: true, ready: 0 }, 'barn', 10);
  d.herd.forEach((a) => {
    a.happy = 85;
  });
  const next = breedHerd(d, 'cow', 10);
  expect(next?.herd).toHaveLength(3);
  expect(next?.herd[2]?.born).toBe(10);
  expect(breedHerd(next!, 'cow', 10)).toBeNull();
  expect(breedHerd({ ...d, fed: false }, 'cow', 10)).toBeNull();
  expect(breedHerd(d, 'sheep', 10)).toBeNull();
});
