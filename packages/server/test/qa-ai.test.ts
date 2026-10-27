import { expect, it } from 'vitest';
import { createEnemy, stepEnemy, type EnemyHooks } from '../src/game/enemies';
const hooks = (): EnemyHooks => ({ telegraph: () => {}, strike: () => {} });
it('does not acquire or start a melee attack against a never-seen player through a wall', () => {
  const e = createEnemy('goblin', 0.5, 0.5, false);
  const solid = (x: number, y: number) => x === 1;
  for (let t = 0; t < 80; t++)
    stepEnemy(e, 0.05, t, [{ id: 'p', x: 2.2, y: 0.5, alive: true }], solid, () => 0.5, hooks());
  expect(e.targetId).toBeNull();
  expect(e.mode).not.toBe('windup');
});
it('routes around a blocked corner to pursue a previously visible target without tunnelling', () => {
  const e = createEnemy('bandit', 0.5, 0.5, false);
  e.mode = 'chase';
  let blocked = false;
  const solid = (x: number, y: number) => blocked && x === 2 && y >= -2 && y <= 2;
  const p = { id: 'p', x: 5.5, y: 0.5, alive: true };
  stepEnemy(e, 0.05, 0, [p], solid, () => 0.5, hooks());
  blocked = true;
  for (let t = 1; t < 160; t++) {
    stepEnemy(e, 0.05, t, [p], solid, () => 0.5, hooks());
    expect(solid(Math.floor(e.x), Math.floor(e.y))).toBe(false);
  }
  expect(e.x).toBeGreaterThan(2.8);
});
