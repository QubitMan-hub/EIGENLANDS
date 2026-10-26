import { expect, it } from 'vitest';
import { moveBody, type SolidQuery } from '../src/sim';
it('does not kick an already grazing body backwards along an unobstructed input axis', () => {
  const solid: SolidQuery = Object.assign(() => false, { level: (_x: number, y: number) => (y >= 1 ? 3 : 0) });
  const p = { x: 0.5, y: 0.78 };
  moveBody(p, 0.1, 0, 0.3, solid);
  expect(p.x).toBeGreaterThanOrEqual(0.5);
  expect(p.x).toBeLessThanOrEqual(0.6);
  expect(p.y).toBe(0.78);
});
it('does not reverse either input direction when a new blocking object overlaps the body', () => {
  const solid: SolidQuery = () => true;
  for (const [dx, dy] of [
    [0.1, 0],
    [-0.1, 0],
    [0, 0.1],
    [0, -0.1],
  ]) {
    const p = { x: 0.5, y: 0.5 };
    moveBody(p, dx!, dy!, 0.3, solid);
    expect((p.x - 0.5) * dx!).toBeGreaterThanOrEqual(0);
    expect((p.y - 0.5) * dy!).toBeGreaterThanOrEqual(0);
    expect(Math.abs(p.x - 0.5)).toBeLessThanOrEqual(Math.abs(dx!));
    expect(Math.abs(p.y - 0.5)).toBeLessThanOrEqual(Math.abs(dy!));
  }
});
