import { describe, expect, it } from 'vitest';
import {
  ITEMS,
  RECIPES,
  STATION_IDS,
  MAX_DISC,
  DISCIPLINE_IDS,
  catalogItems,
  catalogRecipes,
  catalogSources,
  isStationId,
} from '../src';

const END_CATS = new Set([
  'weapon',
  'armor',
  'shield',
  'accessory',
  'tool',
  'pack',
  'light',
  'dish',
  'drink',
  'potion',
  'scroll',
  'rune',
  'enchant',
  'building',
  'furniture',
  'decor',
  'station',
  'farm',
  'animal',
  'crop',
  'seed',
  'explore',
  'mount',
  'artifact',
  'collectible',
]);

const END_KINDS = new Set([
  'food',
  'potion',
  'weapon',
  'armor',
  'gear',
  'tool',
  'placeable',
  'scroll',
  'rune',
  'seed',
  'crop',
  'animal',
  'ring',
  'fish',
]);

describe('catalog integrity', () => {
  const items = catalogItems();
  const recipes = catalogRecipes();

  it('has unique ids and names', () => {
    const names = new Map<string, string>();
    for (const d of items) {
      expect(ITEMS[d.id], d.id).toBe(d);
      const key = d.name.toLowerCase();
      expect(names.get(key), `duplicate name ${d.name}: ${d.id} / ${names.get(key)}`).toBeUndefined();
      names.set(key, d.id);
      expect(d.desc.length, `${d.id} desc`).toBeGreaterThan(8);
    }
  });

  it('only references real items, stations and disciplines in recipes', () => {
    const ids = new Set<string>();
    for (const r of recipes) {
      expect(ids.has(r.id), `duplicate recipe id ${r.id}`).toBe(false);
      ids.add(r.id);
      expect(isStationId(r.station), `${r.id} station`).toBe(true);
      expect(DISCIPLINE_IDS.includes(r.disc), `${r.id} disc`).toBe(true);
      expect(r.lvl, r.id).toBeGreaterThanOrEqual(1);
      expect(r.lvl, r.id).toBeLessThanOrEqual(MAX_DISC);
      expect(ITEMS[r.out.id], `${r.id} output ${r.out.id}`).toBeDefined();
      expect(r.out.n, r.id).toBeGreaterThan(0);
      expect(r.inputs.length, r.id).toBeGreaterThan(0);
      for (const i of r.inputs) {
        expect(ITEMS[i.id], `${r.id} input ${i.id}`).toBeDefined();
        expect(i.n, `${r.id} ${i.id}`).toBeGreaterThan(0);
      }
    }
    expect(STATION_IDS.length).toBeGreaterThan(10);
  });

  it('gives every item a way into the world', () => {
    const sourced = new Set(catalogSources().map((s) => s.item));
    const made = new Set(RECIPES.map((r) => r.out.id));
    for (const d of items) {
      expect(sourced.has(d.id) || made.has(d.id), `${d.id} has no recipe or source`).toBe(true);
    }
  });

  it('can be reached from raw materials', () => {
    const reach = new Set<string>(catalogSources().map((s) => s.item));
    for (const d of Object.values(ITEMS)) if (!d.cat) reach.add(d.id); // the base game's items are obtainable
    for (let pass = 0; pass < 40; pass++) {
      let grew = false;
      for (const r of RECIPES) {
        if (reach.has(r.out.id)) continue;
        if (r.inputs.every((i) => i.id.startsWith('*') || reach.has(i.id))) {
          reach.add(r.out.id);
          grew = true;
        }
      }
      if (!grew) break;
    }
    const lost = items.filter((d) => !reach.has(d.id)).map((d) => d.id);
    expect(lost).toEqual([]);
  });

  it('puts every material to use', () => {
    const used = new Set<string>();
    for (const r of RECIPES) for (const i of r.inputs) used.add(i.id);
    const idle = items
      .filter((d) => !END_CATS.has(d.cat ?? '') && !END_KINDS.has(d.kind) && !used.has(d.id) && !d.use)
      .map((d) => d.id);
    expect(idle).toEqual([]);
  });
});
