import { expect, it, vi } from 'vitest';
import { CAVE_OY } from '@eigenlands/shared';
import { BossModule } from '../src/features/bosses';
import { createEnemy } from '../src/game/enemies';
import type { GameRoom } from '../src/rooms/GameRoom';
import type { ServerPlayer } from '../src/rooms/player';

function field() {
  const player = {
    id: 'challenger',
    level: 22,
    deadT: 0,
    sim: { x: 700, y: 600 },
    toast: vi.fn(),
    client: { send: vi.fn() },
    data: { prog: { bosses: [] } },
    dirty: vi.fn(),
  };
  const enemies = new Map();
  const room = {
    seed: 1337,
    players: new Map([[player.id, player]]),
    enemies,
    store: { solidAt: vi.fn(() => false) },
    fx: vi.fn(),
    enemyStrike: vi.fn(),
    fireOrbs: vi.fn(),
    nearby: () => [player],
    spawnEnemy: vi.fn((kind, x, y, night, opts) => {
      const e = createEnemy(kind, x, y, night, opts);
      enemies.set(e.id, e);
      return e;
    }),
  };
  const bosses = new BossModule(room as unknown as GameRoom);
  const summon = (x = 700, y = 600) => bosses.summon(player as unknown as ServerPlayer, 'storm_beacon', x, y);
  return { player, room, bosses, summon };
}

it('requires open sky, level 22, a clearing and distance from settlements; prevents duplicate nearby calls', () => {
  const f = field();
  expect(f.summon(0, 0)).toBe(false);
  expect(f.summon(700, CAVE_OY + 600)).toBe(false);
  f.player.level = 21;
  expect(f.summon()).toBe(false);
  f.player.level = 22;
  f.room.store.solidAt.mockReturnValue(true);
  expect(f.summon()).toBe(false);
  f.room.store.solidAt.mockReturnValue(false);
  expect(f.summon()).toBe(true);
  expect(f.summon()).toBe(false);
  expect(f.room.enemies.size).toBe(1);
});

it('marks fixed lightning sites before damage and exposes a stationary recovery', () => {
  const f = field();
  expect(f.summon()).toBe(true);
  f.bosses.tick(0, 6.01);
  const marks = f.room.fx.mock.calls.map(([fx]) => fx).filter((fx) => fx.kind === 'bomb');
  expect(marks).toHaveLength(3);
  expect(marks.every((fx) => fx.v >= 1.35)).toBe(true);
  expect(f.room.enemyStrike).not.toHaveBeenCalled();
  f.player.sim.x += 20;
  f.bosses.tick(0, 1.61);
  expect([...f.room.enemies.values()][0].mode).toBe('recover');
  expect(f.room.enemyStrike).not.toHaveBeenCalled();
  f.bosses.tick(0, 0.1);
  expect(f.room.enemyStrike).toHaveBeenCalledTimes(3);
  expect(f.room.enemyStrike.mock.calls.map(([, x, y]) => ({ x, y }))).toEqual(marks.map(({ x, y }) => ({ x, y })));
});

it('lets a poise break cancel warned strikes instead of overwriting the stagger', () => {
  const f = field();
  expect(f.summon()).toBe(true);
  f.bosses.tick(0, 6.01);
  const e = [...f.room.enemies.values()][0];
  e.mode = 'stagger';
  f.bosses.tick(0, 2);
  expect(e.mode).toBe('stagger');
  expect(f.room.enemyStrike).not.toHaveBeenCalled();
});

it('changes to cardinal warning sites plus a delayed targeted echo in overcharge, without spawning adds', () => {
  const f = field();
  expect(f.summon()).toBe(true);
  const e = [...f.room.enemies.values()][0];
  e.hp = e.maxHp * 0.2;
  f.bosses.tick(0, 6.01);
  const marks = f.room.fx.mock.calls.map(([fx]) => fx).filter((fx) => fx.kind === 'bomb');
  expect(marks).toHaveLength(5);
  expect(f.room.enemies.size).toBe(1);
  expect(marks[4].v).toBeGreaterThan(marks[0].v);
  expect(marks.slice(0, 4).map(({ x, y }) => Math.hypot(x - e.x, y - e.y))).toEqual([4, 4, 4, 4]);
});
