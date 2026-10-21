import { describe, expect, it } from 'vitest';
import { T, type WorldObj } from '@eigenlands/shared';
import { describeUse, targetTile } from '../src/game/targeting';

const tool = (id: string, tier = 1) => ({ id, n: 1, p: { tier } });
describe('use targeting', () => {
  it('explains each tool on each tile', () => {
    expect(describeUse(tool('axe'), T.TREE, undefined, 0)).toMatchObject({ kind: 'tool', ok: true });
    expect(describeUse(tool('axe'), T.ROCK, undefined, 0)).toMatchObject({ kind: 'none', ok: false });
    expect(describeUse(tool('pickaxe', 1), T.ORE_IRON, undefined, 0)).toMatchObject({ ok: false });
    expect(describeUse(tool('pickaxe', 2), T.ORE_IRON, undefined, 0)).toMatchObject({ ok: true });
    expect(describeUse(tool('hoe'), T.GRASS, undefined, 0)).toMatchObject({ kind: 'till' });
    expect(describeUse(tool('can'), T.TILLED, undefined, 0)).toMatchObject({ kind: 'water', ok: true });
    expect(describeUse({ id: 'turnip_seed', n: 5 }, T.TILLED, undefined, 0)).toMatchObject({ kind: 'plant', label: 'Plant Turnip' });
    expect(describeUse(tool('rod'), T.WATER, undefined, 0)).toMatchObject({ kind: 'cast' });
    expect(describeUse(tool('net'), T.FLOWERS, undefined, 0)).toMatchObject({ kind: 'net' });
    expect(describeUse(null, T.FORAGE, undefined, 0)).toMatchObject({ kind: 'forage' });
    expect(describeUse({ id: 'healing_potion', n: 1 }, T.GRASS, undefined, 0)).toMatchObject({ kind: 'eat' });
    expect(describeUse({ id: 'chest', n: 1 }, T.GRASS, undefined, 0)).toMatchObject({ kind: 'place' });
    expect(describeUse({ id: 'chest', n: 1 }, T.WATER, undefined, 0)).toBeNull();
    expect(describeUse(null, T.GRASS, undefined, 0)).toBeNull();
  });
  it('routes objects: stations open, ripe crops harvest, unripe crops show progress', () => {
    const station: WorldObj = { x: 0, y: 0, kind: 'station', sub: 'forge' };
    expect(describeUse(tool('axe'), T.GRASS, station, 0)).toMatchObject({ kind: 'open', label: 'Use Anvil & Forge' });
    const ripe: WorldObj = { x: 0, y: 0, kind: 'crop', sub: 'turnip', data: { crop: 'turnip', planted: 0, growth: 2, watered: 0, lastDay: 0, owner: 'a' } };
    expect(describeUse(null, T.TILLED, ripe, 0)).toMatchObject({ kind: 'harvest' });
    const young = { ...ripe, data: { ...ripe.data, growth: 0 } };
    expect(describeUse(null, T.TILLED, young, 0)).toMatchObject({ kind: 'none', ok: false });
    expect(describeUse(tool('can'), T.TILLED, young, 0)).toMatchObject({ kind: 'water' });
  });
  it('targets the cursor tile when close, otherwise the tile in front', () => {
    expect(targetTile(5.5, 5.5, 1, 0, { tx: 7, ty: 5 })).toEqual({ tx: 7, ty: 5 });
    expect(targetTile(5.5, 5.5, 1, 0, { tx: 20, ty: 5 })).toEqual({ tx: 6, ty: 5 });
    expect(targetTile(5.5, 5.5, 0, 1, null)).toEqual({ tx: 5, ty: 6 });
    expect(targetTile(5.5, 5.5, 0, -1, null)).toEqual({ tx: 5, ty: 4 });
  });
});
