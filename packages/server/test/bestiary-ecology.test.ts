import { expect, it } from 'vitest';
import { createEnemy, stepEnemy, stepEnemies, type EnemyHooks } from '../src/game/enemies';
const solid = () => false;
const hooks: EnemyHooks = {
  telegraph: () => {},
  strike: () => {},
  lane: () => {},
  fire: () => {},
  slam: () => {},
  crash: () => {},
};
it('regrows a troll after a respite but prevents regrowth while its burn block remains', () => {
  const e = createEnemy('troll', 0, 0, false);
  e.hp = 30;
  for (let i = 0; i < 80; i++) stepEnemy(e, 0.05, i, [], solid, () => 0.5, hooks);
  expect(e.hp).toBeGreaterThan(30);
  e.hp = 30;
  (e as any).regenBlockT = 8;
  for (let i = 0; i < 80; i++) stepEnemy(e, 0.05, i, [], solid, () => 0.5, hooks);
  expect(e.hp).toBe(30);
});
it('defends a territory instead of pursuing a target indefinitely beyond its home', () => {
  const e = createEnemy('manticore', 0, 0, false);
  e.x = 29;
  e.mode = 'chase';
  for (let i = 0; i < 40; i++)
    stepEnemy(e, 0.05, i, [{ id: 'far', x: 40, y: 0, alive: true }], solid, () => 0.5, hooks);
  expect(e.x).toBeLessThan(29);
  expect(e.targetId).toBeNull();
});
it('lets passive wildlife flee a nearby predator even without a human target', () => {
  const predator = createEnemy('dragon', 0, 0, false),
    prey = createEnemy('rabbit', 2, 0, false);
  predator.mode = 'recover';
  predator.t = 99;
  prey.t = 99;
  const before = Math.hypot(prey.x - predator.x, prey.y - predator.y);
  for (let i = 0; i < 40; i++) stepEnemies([predator, prey], 0.05, i, [], solid, () => 0.5, hooks);
  expect(Math.hypot(prey.x - predator.x, prey.y - predator.y)).toBeGreaterThan(before);
});
