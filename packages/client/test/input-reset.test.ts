import { afterEach, expect, it, vi } from 'vitest';
import { Input } from '../src/input/input';
import { DEFAULT_KEYS } from '../src/input/keymap';

afterEach(() => vi.unstubAllGlobals());
it('clears held touch actions and queued presses when the viewport loses focus', () => {
  const listeners = new Map<string, () => void>();
  vi.stubGlobal('window', { addEventListener: (name: string, fn: () => void) => listeners.set(name, fn) });
  vi.stubGlobal('navigator', { getGamepads: () => [] });
  const input = new Input({ addEventListener: () => {} } as unknown as HTMLElement, DEFAULT_KEYS);
  input.setStick(1, 0);
  input.touch('attack', true);
  input.touch('interact', true);
  expect(input.read().dx).toBeGreaterThan(0);
  input.touch('dash', true);
  input.arm('ability1');
  listeners.get('blur')!();
  const state = input.read();
  expect([state.dx, state.dy]).toEqual([0, 0]);
  expect([state.attack, state.hold, state.dash, state.interact]).toEqual([false, false, false, false]);
  expect(input.interactHeld).toBe(false);
  expect(input.armed).toBe(null);
});
