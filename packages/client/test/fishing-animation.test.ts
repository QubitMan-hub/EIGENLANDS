import { expect, it, vi } from 'vitest';
import { Gameplay } from '../src/game/gameplay';
import type { RhythmStartMsg } from '@eigenlands/shared';
const start: RhythmStartMsg = {
  id: 'line',
  kind: 'fish',
  label: 'Trout',
  plan: { startAt: 0, intervalMs: 500, count: 3, windowMs: 100 },
};
function fixture() {
  return {
    fishing: { id: 'line', tx: 3, ty: 4, bite: true, until: 100 },
    wins: { close: vi.fn() },
    clearBang: vi.fn(),
    rhythm: { start: vi.fn(), result: vi.fn() },
    acts: {},
  };
}
it('retains the hooked water target and starts reeling instead of dropping the rod pose', () => {
  const f = fixture();
  Gameplay.prototype.onRhythmStart.call(f as unknown as Gameplay, start);
  expect(f.fishing).toMatchObject({ id: 'line', tx: 3, ty: 4, reeling: true, bite: false });
  expect(f.fishing.until).toBeGreaterThan(performance.now() + 19000);
});
it('ends the matching reel on success or interruption without clearing a newer cast', () => {
  const f = fixture();
  const result = { id: 'old', kind: 'fish' as const, accuracy: 0, ok: false, text: 'Slack' };
  Gameplay.prototype.onRhythmResult.call(f as unknown as Gameplay, result);
  expect(f.fishing).not.toBeNull();
  Gameplay.prototype.onRhythmResult.call(f as unknown as Gameplay, { ...result, id: 'line' });
  expect(f.fishing).toBeNull();
});
