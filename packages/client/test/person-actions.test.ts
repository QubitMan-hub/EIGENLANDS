import { expect, it } from 'vitest';
import { ACTION_START, actionFrame, actionPose } from '../src/art/person-actions';

it('has distinct directional work contacts and finite bounded joint coordinates', () => {
  const signatures = new Set<string>();
  for (const start of Object.values(ACTION_START)) {
    const poses = [];
    for (let d = 0; d < 8; d++)
      for (let k = 0; k < 4; k++) {
        const p = actionPose(d, start + k)!;
        expect(p).toBeTruthy();
        for (const n of [p.x, p.y, p.angle, p.supportX, p.supportY, p.crouch]) expect(Number.isFinite(n)).toBe(true);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(24);
        expect(p.y).toBeGreaterThan(3);
        expect(p.y).toBeLessThan(30);
        poses.push([p.x, p.y, p.crouch]);
      }
    signatures.add(JSON.stringify(poses));
  }
  expect(signatures.size).toBe(Object.keys(ACTION_START).length);
  expect(actionPose(0, 10)).toBeNull();
});

it('holds anticipation and recovery longer than impact, and respects reduced motion', () => {
  expect(actionFrame('mine', 0)).toBe(ACTION_START.mine);
  expect(actionFrame('mine', 0.3)).toBe(ACTION_START.mine);
  expect(actionFrame('mine', 0.4)).toBe(ACTION_START.mine + 1);
  expect(actionFrame('mine', 0.55)).toBe(ACTION_START.mine + 2);
  expect(actionFrame('mine', 1)).toBe(ACTION_START.mine + 3);
  expect(actionFrame('mine', 0, true)).toBe(ACTION_START.mine + 2);
});
