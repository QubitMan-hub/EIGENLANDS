import { expect, it } from 'vitest';
import { newPlayerSim, sanitizeCmd, stepPlayer, TICK_DT } from '../src';
const open = () => false;
const cmd = (v = {}) => sanitizeCmd({ seq: 1, ...v });

it('stationary dodge follows aim while a moving dodge follows the movement stick', () => {
  const p = newPlayerSim(0, 0);
  stepPlayer(p, cmd({ dash: true, aimX: 1 }), open);
  expect(p.dashDx).toBe(1);
  expect(p.dashDy).toBe(0);
  const q = newPlayerSim(0, 0);
  stepPlayer(q, cmd({ dash: true, dx: -1, aimX: 1 }), open);
  expect(q.dashDx).toBe(-1);
});
it('dodging discards an old buffered strike but permits a fresh follow-up', () => {
  const p = newPlayerSim(0, 0);
  p.atkCd = 0.4;
  stepPlayer(p, cmd({ attack: true }), open);
  stepPlayer(p, cmd({ dash: true }), open);
  for (let i = 0; i < 8; i++) expect(stepPlayer(p, cmd(), open).attacked).toBe(false);
  expect(stepPlayer(p, cmd({ attack: true }), open).attacked).toBe(true);
});
it('heavy weapon recovery leaves the full decision window for the next combo hit', () => {
  const p = newPlayerSim(0, 0);
  p.melee = 'greatsword';
  stepPlayer(p, cmd({ attack: true }), open);
  const window = p.comboT;
  stepPlayer(p, cmd(), open);
  expect(p.comboT).toBe(window);
  while (p.atkCd > 0) stepPlayer(p, cmd(), open);
  for (let i = 0; i < Math.floor(0.3 / TICK_DT); i++) stepPlayer(p, cmd(), open);
  expect(stepPlayer(p, cmd({ attack: true }), open).combo).toBe(1);
});
it('movement accelerates gradually out of swing recovery instead of snapping to full speed', () => {
  const distance = (cooldown: number) => {
    const p = newPlayerSim(0, 0);
    p.atkCd = cooldown;
    stepPlayer(p, cmd({ dx: 1 }), open);
    return p.x;
  };
  const a = distance(0.3),
    b = distance(0.2),
    c = distance(0.1),
    free = distance(0);
  expect(b).toBeGreaterThan(a);
  expect(c).toBeGreaterThan(b);
  expect(c).toBeLessThan(free);
});
it('strafing during recovery preserves strike facing without locking movement', () => {
  const p = newPlayerSim(0, 0);
  stepPlayer(p, cmd({ attack: true, aimX: 1 }), open);
  const y = p.y;
  stepPlayer(p, cmd({ dy: 1 }), open);
  expect(p.faceX).toBe(1);
  expect(p.faceY).toBe(0);
  expect(p.y).toBeGreaterThan(y);
});
