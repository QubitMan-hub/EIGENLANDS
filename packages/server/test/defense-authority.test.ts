import { expect, it, vi } from 'vitest';
import { newPlayerSim } from '@eigenlands/shared';
import { WorldRoom } from '../src/rooms/WorldRoom';
import type { ServerPlayer } from '../src/rooms/player';
import type { Enemy } from '../src/game/enemies';

it('authoritative melee parry prevents damage, interrupts the attacker and emits confirmation', () => {
  const p = { id: 'p', sim: newPlayerSim(0, 0), hp: 100 } as ServerPlayer;
  p.sim.faceX = 1;
  p.sim.faceY = 0;
  p.sim.guard = 1;
  p.sim.parryT = 0.15;
  const e = { def: {}, flinchT: 0 } as Enemy;
  const fx = vi.fn();
  const room = { warded: () => false, fx };
  const hurt = (
    WorldRoom.prototype as unknown as {
      hurtPlayer: (
        p: ServerPlayer,
        raw: number,
        e: Enemy,
        weight: number,
        x: number,
        y: number,
        projectile?: boolean,
      ) => boolean;
    }
  ).hurtPlayer;
  expect(hurt.call(room, p, 50, e, 1, -1, 0)).toBe(true);
  expect(p.hp).toBe(100);
  expect(e.flinchT).toBe(0.8);
  expect(p.sim.slipT).toBe(0.9);
  expect(fx).toHaveBeenCalledWith(expect.objectContaining({ kind: 'defend', v: 2, id: 'p' }));
});
it('projectile deflection does not remotely stagger its shooter', () => {
  const p = { id: 'p', sim: newPlayerSim(0, 0), hp: 100 } as ServerPlayer;
  p.sim.faceX = 1;
  p.sim.faceY = 0;
  p.sim.guard = 1;
  p.sim.parryT = 0.15;
  const e = { def: {}, flinchT: 0 } as Enemy;
  const hurt = (WorldRoom.prototype as unknown as { hurtPlayer: (...args: unknown[]) => boolean }).hurtPlayer;
  hurt.call({ warded: () => false, fx: vi.fn() }, p, 50, e, 1, -1, 0, true);
  expect(p.hp).toBe(100);
  expect(e.flinchT).toBe(0);
});
