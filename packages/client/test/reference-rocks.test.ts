import { expect, it, vi } from 'vitest';
import { T } from '@eigenlands/shared';
import catalog from '../src/art/reference-rocks.json';
import { ObjectViews } from '../src/game/objectviews';
it('decodes all source rocks and the derived silver material with bounded ground anchors', () => {
  expect(Object.keys(catalog.frames)).toHaveLength(25);
  for (const f of Object.values(catalog.frames)) {
    let count = 0;
    for (let i = 0; i < f.runs.length; i += 2) {
      count += f.runs[i]!;
      expect(f.runs[i + 1]).toBeLessThan(f.palette.length);
    }
    expect(count).toBe(f.w * f.h);
    expect(f.ax).toBeGreaterThan(0);
    expect(f.ax).toBeLessThan(f.w);
    expect(f.ay).toBeGreaterThan(0);
    expect(f.ay).toBeLessThan(f.h);
  }
  expect(catalog.frames.silver.runs).toEqual(catalog.frames.iron.runs);
  expect(catalog.frames.silver.palette).not.toEqual(catalog.frames.iron.palette);
});
it('renders only cosmetic debris for a depleted surface node and replaces it when the resource returns', () => {
  let tile: number = T.GRASS;
  const object = (kind: string) => ({
    kind,
    root: { destroy: vi.fn(), visible: true },
    shadow: { destroy: vi.fn() },
    echo: null,
    tx: 0,
    ty: 0,
  });
  const old = object('ore_copper'),
    m = new Map([[0, old]]),
    makeObj = vi.fn((_x: number, _y: number, kind: string) => object(kind));
  const views = Object.assign(Object.create(ObjectViews.prototype), {
    store: { seed: 1, getTile: () => tile },
    chunks: new Map([['0,0', m]]),
    makeObj,
  }) as ObjectViews;
  views.refreshTile(0, 0);
  expect(old.root.destroy).toHaveBeenCalledOnce();
  expect(m.get(0)?.kind).toBe('rock_depleted');
  expect(views.pickMineable(0, 0)).toBeNull();
  tile = T.ROCK;
  views.refreshTile(0, 0);
  expect(m.get(0)?.kind).toBe('rock');
});
