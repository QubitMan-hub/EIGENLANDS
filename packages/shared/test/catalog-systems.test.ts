import { describe, expect, it } from 'vitest';
import {
  ARMOR_SETS,
  ARMOR_SLOTS,
  CROPS,
  CROP_ROWS,
  ENCHANTS,
  FARM_ANIMALS,
  FISH_TABLE,
  FORAGE_EXTRA_BY_SEASON,
  ITEMS,
  MAX_DISC,
  PEN_DATA,
  RECIPES,
  WEAPONS,
  armorId,
  catalogMobDrops,
  catalogShopStock,
  catalogVaultDrops,
  craftQuality,
  discLevel,
  enchantBlock,
  equipmentStats,
  gearClassOf,
  gearPower,
  isBroken,
  maxDurability,
  meleeFamily,
  newGearProps,
  recipeBlock,
  recipeById,
  recipeKnown,
  recipesMaking,
  repairCost,
  sourceLines,
  upgradeCost,
  validDisc,
  xpForDiscLevel,
  type EquipState,
} from '../src';

const equip = (o: Partial<EquipState> = {}): EquipState => ({
  ring1: null,
  ring2: null,
  outfit: 0,
  weapon: null,
  head: null,
  chest: null,
  legs: null,
  feet: null,
  ...o,
});
const who = (xp: Record<string, number> = {}, rep: Record<string, number> = {}, learned: string[] = []) => ({
  learned: new Set(learned),
  disc: { ...validDisc(null), ...xp },
  rep,
});

describe('disciplines and recipe knowledge', () => {
  it('level curve rises steadily and caps', () => {
    let last = 0;
    for (let l = 2; l <= MAX_DISC; l++) {
      expect(xpForDiscLevel(l)).toBeGreaterThan(last);
      last = xpForDiscLevel(l);
      expect(discLevel(last)).toBe(l);
    }
    expect(discLevel(1e9)).toBe(MAX_DISC);
  });
  it('start recipes are known, levelled ones unlock with skill, kingdom ones need standing, scrolls need the scroll', () => {
    const start = RECIPES.find((r) => r.learn === 'start')!;
    expect(recipeKnown(start, who())).toBe(true);
    const lv = RECIPES.find((r) => r.learn === 'level' && r.lvl >= 8)!;
    expect(recipeKnown(lv, who())).toBe(false);
    expect(recipeKnown(lv, who({ [lv.disc]: xpForDiscLevel(lv.lvl) }))).toBe(true);
    const realm = recipeById('armor_skysteel_head')!;
    const skilled = { [realm.disc]: xpForDiscLevel(realm.lvl) };
    expect(recipeKnown(realm, who(skilled))).toBe(false);
    expect(recipeKnown(realm, who(skilled, { aurelion: 400 }))).toBe(true);
    expect(recipeBlock(realm, who(skilled))).toMatch(/standing/);
    const scroll = RECIPES.find((r) => r.learn === 'scroll')!;
    expect(recipeKnown(scroll, who({ [scroll.disc]: 1e6 }))).toBe(false);
    expect(recipeKnown(scroll, who({}, {}, [scroll.id]))).toBe(true);
  });
  it('quality follows skill over the recipe level and never leaves 0..4', () => {
    for (let lvl = 1; lvl < 30; lvl += 3)
      for (const roll of [0, 0.5, 1]) {
        const q = craftQuality(lvl, 5, 1, 2, roll);
        expect(q).toBeGreaterThanOrEqual(0);
        expect(q).toBeLessThanOrEqual(4);
      }
    expect(craftQuality(30, 5, 0, 0, 0.5)).toBeGreaterThan(craftQuality(5, 5, 0, 0, 0.5));
  });
});

describe('catalog gear', () => {
  it('every armour set has four craftable, wearable pieces with the right slot', () => {
    for (const set of ARMOR_SETS) {
      for (const slot of ARMOR_SLOTS) {
        const id = armorId(set.id, slot);
        expect(ITEMS[id]?.armor).toEqual({ slot, set: set.id });
        if (set.look < 0) expect(recipesMaking(id).length, id).toBeGreaterThan(0);
      }
    }
  });
  it('weapon variants borrow their base weapon’s moves and are all craftable', () => {
    for (const w of Object.values(WEAPONS)) {
      if (!w.fam) continue;
      expect(meleeFamily(w.id) === w.fam || w.cls !== 'blade', w.id).toBe(true);
      expect(ITEMS[w.id]?.weapon).toBe(w.id);
      expect(recipesMaking(w.id).length, w.id).toBeGreaterThan(0);
    }
    expect(meleeFamily('spear_steel')).toBe('spear');
    expect(meleeFamily('battle_axe_mithril')).toBe('battle_axe');
    expect(meleeFamily('sword')).toBe('sword');
  });
  it('gear items carry a level, durability and a slot', () => {
    for (const d of Object.values(ITEMS)) {
      if (!d.gear) continue;
      expect(d.gear.dur, d.id).toBeGreaterThan(20);
      expect(d.gear.level, d.id).toBeGreaterThanOrEqual(1);
    }
  });
  it('quality and upgrades scale stats; broken gear gives nothing', () => {
    const id = 'shield_steel';
    const base = equipmentStats(equip({ shield: { id, n: 1 } } as Partial<EquipState>));
    const fine = equipmentStats(equip({ shield: { id, n: 1, p: { qt: 3 } } } as Partial<EquipState>));
    const up = equipmentStats(equip({ shield: { id, n: 1, p: { up: 5 } } } as Partial<EquipState>));
    const broken = equipmentStats(equip({ shield: { id, n: 1, p: { maxDur: 100, dur: 0 } } } as Partial<EquipState>));
    expect(fine.def).toBeGreaterThan(base.def);
    expect(up.def).toBeGreaterThan(base.def);
    expect(broken.def).toBe(0);
    expect(gearPower({ qt: 4, up: 5 })).toBeGreaterThan(gearPower({ qt: 1, up: 0 }));
    // garbage props never produce NaN
    expect(Number.isFinite(gearPower({ qt: 99, up: -3 } as never))).toBe(true);
  });
  it('durability, repair and upgrade costs follow what the piece is made of', () => {
    const id = 'armor_steel_chest';
    const props = newGearProps(id, 1);
    expect(props.maxDur).toBe(maxDurability(id, props));
    expect(repairCost(id, props)).toEqual([]);
    const worn = { ...props, dur: 1 };
    const cost = repairCost(id, worn);
    expect(cost.length).toBeGreaterThan(0);
    for (const [item, n] of cost) {
      expect(ITEMS[item]).toBeTruthy();
      expect(n).toBeGreaterThan(0);
    }
    expect(upgradeCost(id, props).length).toBeGreaterThan(0);
    expect(upgradeCost(id, { ...props, up: 5 })).toEqual([]);
    expect(isBroken({ maxDur: 50, dur: 0 })).toBe(true);
    expect(isBroken({})).toBe(false);
    expect(gearClassOf('wood')).toBeNull();
  });
  it('enchantments fit only the gear they are for', () => {
    expect(enchantBlock('spear_steel', 'flame')).toBeNull();
    expect(enchantBlock('armor_steel_chest', 'flame')).toMatch(/weapon/);
    expect(enchantBlock('wood_shield', 'vitality')).toBeNull();
    expect(enchantBlock('wood', 'vitality')).toBeTruthy();
    for (const e of ENCHANTS) expect(ITEMS[`rune_${e.key}`], e.key).toBeTruthy();
  });
});

describe('world hooks', () => {
  it('monsters and bosses drop the parts their recipes ask for', () => {
    expect(catalogMobDrops('cinder_drake').some((d) => d.item === 'wyrm_scale')).toBe(true);
    expect(catalogMobDrops('wolf').some((d) => d.item === 'pelt')).toBe(true);
    expect(catalogMobDrops('cinder_wyrm').some((d) => d.item === 'dragon_bone')).toBe(true);
    expect(catalogMobDrops('nothing_here')).toEqual([]);
  });
  it('forage, fish, vaults and shops carry catalog goods', () => {
    expect(FORAGE_EXTRA_BY_SEASON.flat().some((e) => e.item === 'sage')).toBe(true);
    expect(FISH_TABLE.some((f) => f.id === 'salmon')).toBe(true);
    expect(catalogVaultDrops('crystal').some((d) => d.item.startsWith('scroll_'))).toBe(true);
    expect(catalogShopStock('general').some((s) => s.item === 'carrot_seed')).toBe(true);
    expect(catalogShopStock('farm', 'raijin').some((s) => s.item === 'rice_seed')).toBe(true);
    expect(catalogShopStock('farm', 'aurelion').some((s) => s.item === 'rice_seed')).toBe(false);
  });
  it('every catalog crop, seed and pen is consistent', () => {
    for (const row of CROP_ROWS) {
      const d = row.def;
      expect(CROPS[d.id], d.id).toBe(d);
      expect(ITEMS[`${d.id}_seed`]?.crop, d.id).toBe(d.id);
      expect(ITEMS[d.id]?.kind, d.id).toBe('crop');
      expect(
        d.seasons.every((s) => s >= 0 && s <= 3),
        d.id,
      ).toBe(true);
      expect(d.days, d.id).toBeGreaterThan(0);
      expect(d.yieldMax, d.id).toBeGreaterThanOrEqual(d.yieldMin);
    }
    for (const pen of PEN_DATA) {
      expect(FARM_ANIMALS[pen.sub]?.animal).toBe(pen.animal);
      expect(ITEMS[pen.animal]?.kind).toBe('animal');
      expect(ITEMS[pen.product]).toBeTruthy();
      expect(ITEMS[pen.sub]?.place?.kind).toBe('shelter');
    }
  });
  it('explains where an item comes from', () => {
    expect(sourceLines('wyrm_scale').join(' ')).toMatch(/cinder drake/);
    expect(sourceLines('steel_plate').join(' ')).toMatch(/Anvil/);
  });
  it('food profiles give distinct, balanced effects', () => {
    const dishes = Object.values(ITEMS).filter((d) => d.cat === 'dish' || d.cat === 'drink');
    expect(dishes.length).toBeGreaterThan(150);
    const kinds = new Set(dishes.map((d) => d.buff?.kind).filter(Boolean));
    expect(kinds.size).toBeGreaterThanOrEqual(8);
    for (const d of dishes) {
      expect(d.heal, d.id).toBeGreaterThan(0);
      expect(d.buff ? d.buff.secs : 1, d.id).toBeGreaterThan(0);
    }
  });
});
