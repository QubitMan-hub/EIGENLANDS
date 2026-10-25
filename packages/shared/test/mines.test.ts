import { expect, it } from 'vitest';
import {
  ChunkStore,
  caveObjectsIn,
  caveRegion,
  caveTileAt,
  T,
  mineLoopAt,
  mineRailAt,
  mineRailMask,
  minePosition,
  newPlayerSim,
  stepPlayer,
  TICK_DT,
  encodeAck,
  decodeAck,
} from '../src';
const seed = 1337;
const regions = Array.from({ length: 64 }, (_, i) => caveRegion(seed, (i % 8) - 4, Math.floor(i / 8) - 4));
const region = regions.find((r) => mineLoopAt(seed, r.x, r.y))!;
const loop = mineLoopAt(seed, region.x, region.y)!;
it('joins every mine rail to exactly two neighbours on a dry, walkable complete circuit', () => {
  expect(loop).toBeTruthy();
  const store = new ChunkStore(seed);
  let count = 0;
  for (let y = loop.y; y <= loop.y + loop.h; y++)
    for (let x = loop.x; x <= loop.x + loop.w; x++)
      if (mineRailAt(loop, x, y)) {
        expect(mineRailMask(loop, x, y).toString(2).replace(/0/g, '')).toHaveLength(2);
        expect(store.solidAt(x, y), `${x},${y}`).toBe(false);
        expect(caveTileAt(seed, x, y)).toBe(T.CAVE_FLOOR);
        count++;
      }
  expect(count).toBe(2 * (loop.w + loop.h));
  const depot = caveObjectsIn(seed, Math.floor(loop.x / 32), Math.floor(loop.y / 32)).find(
    (o) => o.sub === 'minecart' && o.x === loop.x && o.y === loop.y,
  );
  expect(depot).toBeTruthy();
});
it('predicts an entire lap without corner jumps, brakes, and blocks attacks and dodge while riding', () => {
  const store = new ChunkStore(seed),
    p = newPlayerSim(loop.x + 0.5, loop.y + 0.5);
  p.cart = 1;
  const cmd = {
    seq: 0,
    dx: 1,
    dy: 0,
    dash: true,
    attack: true,
    hold: true,
    skill: true,
    aimX: 1,
    aimY: 0,
    viewTick: 0,
  };
  let distance = 0;
  for (let i = 0; i < Math.ceil((2 * (loop.w + loop.h)) / 6.8 / TICK_DT) + 30; i++) {
    const old = { ...p },
      ev = stepPlayer(p, cmd, store.solidAt);
    const d = Math.hypot(p.x - old.x, p.y - old.y);
    expect(d).toBeLessThanOrEqual(6.8 * TICK_DT + 0.001);
    expect(ev.attacked || ev.dashed || ev.skill).toBe(false);
    expect(mineRailAt(loop, Math.floor(p.x), Math.floor(p.y))).toBe(true);
    distance += d;
  }
  expect(distance).toBeGreaterThan(2 * (loop.w + loop.h));
  const old = { ...p };
  stepPlayer(p, { ...cmd, dx: 0 }, store.solidAt);
  expect(p.x).toBe(old.x);
  expect(p.y).toBe(old.y);
  expect(decodeAck(encodeAck({ seq: 1, tick: 2, sim: p })).sim.cart).toBeCloseTo(p.cart, 4);
});
it('respects player construction or terrain edits on a track and never teleports to another loop', () => {
  const st = new ChunkStore(seed),
    p = newPlayerSim(loop.x + 0.5, loop.y + 0.5);
  p.cart = 1;
  st.setTile(loop.x + 1, loop.y, T.CAVE_WALL);
  const cmd = {
    seq: 0,
    dx: 1,
    dy: 0,
    dash: false,
    attack: false,
    hold: false,
    skill: false,
    aimX: 0,
    aimY: 1,
    viewTick: 0,
  };
  for (let i = 0; i < 20; i++) stepPlayer(p, cmd, st.solidAt);
  expect(p.x).toBeLessThan(loop.x + 1);
  expect(p.cart).toBeGreaterThan(0);
  p.y = 0;
  const x = p.x;
  stepPlayer(p, cmd, st.solidAt);
  expect(p.cart).toBe(0);
  expect(p.x).toBe(x);
  expect(minePosition(loop, 2 * (loop.w + loop.h))).toEqual(minePosition(loop, 0));
});
