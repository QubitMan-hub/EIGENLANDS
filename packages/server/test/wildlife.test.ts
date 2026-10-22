import { describe, expect, it } from 'vitest';
import { ENEMY_BY_KIND, ENEMY_DEFS } from '@eigenlands/shared';
import { createEnemy, stepEnemy, type Enemy } from '../src/game/enemies';

const open = () => false;
const hooks = { strike() {}, telegraph() {} };
const run = (e: Enemy, target: { x: number; y: number }, secs: number) => {
  for (let i = 0; i < secs * 20; i++) stepEnemy(e, 0.05, i, [{ id: 'p', x: target.x, y: target.y, alive: true }], open, () => 0.5, hooks);
};

describe('wildlife', () => {
  it('registers every kind at its own index', () => {
    ENEMY_BY_KIND.forEach((d, i) => expect(d.kind).toBe(i));
    expect(Object.keys(ENEMY_DEFS)).toHaveLength(ENEMY_BY_KIND.length);
  });

  it('a boar ignores a player at a distance, then charges once hurt', () => {
    const e = createEnemy('boar', 0, 0, false);
    run(e, { x: 4, y: 0 }, 3);
    expect(e.mode === 'idle' || e.mode === 'wander').toBe(true);
    expect(e.provoked).toBe(false);
    e.provoked = true;
    run(e, { x: 5, y: 0 }, 3);
    expect(['chase', 'windup', 'charge', 'recover']).toContain(e.mode);
  });

  it('crowding a neutral animal provokes it; passive deer just run', () => {
    const b = createEnemy('badger', 0, 0, false);
    run(b, { x: 1.5, y: 0 }, 0.2);
    expect(b.provoked).toBe(true);
    const d = createEnemy('deer', 0, 0, false);
    run(d, { x: 2, y: 0 }, 2);
    expect(d.x).toBeLessThan(-1);
    expect(d.provoked).toBe(false);
  });

  it('wolves hunt on sight', () => {
    const w = createEnemy('wolf', 0, 0, true);
    run(w, { x: 6, y: 0 }, 1);
    expect(w.mode).not.toBe('idle');
  });
});
