import { expect, it } from 'vitest';
import { emptyInventory } from '@eigenlands/shared';
import { inventorySlots } from '../src/ui/inventory-query';

it('filters by readable item names and purpose without changing authoritative slots', () => {
  const inv = emptyInventory();
  inv[2] = { id: 'sword', n: 1 };
  inv[12] = { id: 'healing_potion', n: 2 };
  inv[18] = { id: 'wood', n: 9 };
  expect(inventorySlots(inv, 'HEAL', 'all', 'slot')).toEqual([12]);
  expect(inventorySlots(inv, '', 'equipment', 'name')).toEqual([2]);
  expect(inventorySlots(inv, '', 'supplies', 'name')).toEqual([12]);
  expect(inventorySlots(inv, '', 'materials', 'name')).toEqual([18]);
  expect(inv[18]?.n).toBe(9);
  expect(inv[2]?.id).toBe('sword');
});
it('keeps hotbar positions stable and sorts pack views without moving items', () => {
  const inv = emptyInventory();
  inv[0] = { id: 'wood', n: 1 };
  inv[10] = { id: 'wood', n: 9 };
  inv[11] = { id: 'coal', n: 2 };
  const result = inventorySlots(inv, '', 'all', 'name');
  expect(result.slice(0, 10)).toEqual(Array.from({ length: 10 }, (_, i) => i));
  expect(result.slice(10, 12)).toEqual([11, 10]);
  expect(result).toHaveLength(30);
  expect(inv[10]?.id).toBe('wood');
});
