import { expect, it } from 'vitest';
import { ChunkStore, T } from '@eigenlands/shared';
import { arrivalGround, arrivalPlan, arrivalNotices } from '../src/game/arrival-plan';
it('keeps the arrival plan compact, deterministic and clear of the central spawn', () => {
  for (const seed of [7, 42, 20260101]) {
    const p = arrivalPlan(seed);
    expect(arrivalPlan(seed)).toEqual(p);
    expect(p.props.length).toBeLessThan(75);
    expect(p.scenes.length).toBeLessThanOrEqual(7);
    expect(p.props.every((p) => Math.hypot(p.x, p.y) < 14)).toBe(true);
    expect(p.props.every((p) => Math.hypot(p.x, p.y) > 2.7)).toBe(true);
    expect(arrivalNotices(seed)[0]!.text).toContain('tiles');
  }
});
it('yields decoration to player edits, structures, objects and unloaded chunks without changing terrain', () => {
  const s = new ChunkStore(20260101, 128, 7);
  const c = s.get(0, 0);
  c.tiles.fill(T.GRASS);
  expect(arrivalGround(s, 5, 5)).toBe(true);
  s.setTile(5, 5, T.GRASS);
  expect(arrivalGround(s, 5, 5)).toBe(false);
  s.putObject({ x: 6, y: 5, kind: 'crop', sub: 'turnip' });
  expect(arrivalGround(s, 6, 5)).toBe(false);
  expect(arrivalGround(s, 30000, 30000)).toBe(false);
  expect(s.has(Math.floor(30000 / 32), Math.floor(30000 / 32))).toBe(false);
  expect(c.diff.size).toBe(1);
});

it('does not query ground height for hidden, unstreamed decoration', async () => {
  const { ArrivalGarden } = await import('../src/game/arrival');
  const { setLift } = await import('../src/game/iso');
  const store = new ChunkStore(20260101, 128, 7);
  const garden = Object.assign(Object.create(ArrivalGarden.prototype), {
    d: { store: () => store, seed: () => store.seed },
    key: `${store.seed}:1`,
    props: [{ at: { x: 6, y: 5, kind: 'flower' }, sp: { visible: true, position: { set: () => {} } } }],
    actors: [],
    card: { hide: () => {} },
  });
  setLift(() => {
    throw Error('Ambient overlay requested unstreamed elevation');
  });
  try {
    garden.frame({ underground: false, me: { x: 0, y: 0 }, now: 0, dt: 0.05 }, 1);
    expect(garden.props[0].sp.visible).toBe(false);
  } finally {
    setLift(null);
  }
});
