import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CAVE_OY, MSG, NODES, T, caveOfCell, type CaveMouth } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot, hasToast, spawn, tp, until, type Probe } from './p2';

const SEED = 20260101;
let app: App;
let p: Probe;
beforeAll(async () => {
  app = await boot();
  p = await spawn(app, 'Spelunker');
});
afterAll(async () => {
  await app?.close();
});

function firstMouth(): CaveMouth {
  for (let r = 1; r < 5; r++)
    for (let gy = -r; gy <= r; gy++)
      for (let gx = -r; gx <= r; gx++) {
        const m = caveOfCell(SEED, gx, gy);
        if (m) return m;
      }
  throw new Error('no cave found');
}

describe('the Undercroft', () => {
  it('a cave mouth takes you down to its ladder, and the ladder brings you back up', async () => {
    const m = firstMouth();
    await tp(p, m.x + 0.5, m.y + 1.5);
    const k = p.toasts.length;
    p.r.send(MSG.OPEN, { tx: m.x, ty: m.y });
    await until(() => hasToast(p, /Undercroft/, k));
    expect(Math.floor(p.sp.sim.y)).toBe(m.y + CAVE_OY + 1);
    const k2 = p.toasts.length;
    p.r.send(MSG.OPEN, { tx: m.x, ty: m.y + CAVE_OY });
    await until(() => hasToast(p, /daylight/, k2));
    expect(Math.floor(p.sp.sim.y)).toBe(m.y + 1);
  });

  it('cave rock is dug for good, and spent ore leaves cave floor (never grass)', () => {
    expect(NODES[T.CAVE_WALL]!.to).toBe(T.CAVE_FLOOR);
    expect(NODES[T.CAVE_WALL]!.respawnSec).toBe(0);
  });
});
