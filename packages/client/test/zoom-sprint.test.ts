import { describe, expect, it } from 'vitest';
import { ACTIONS, DEFAULT_KEYS } from '../src/input/keymap';
import { ZOOM_LEVELS, ZOOM_TILES, validZoom } from '../src/ui/ui';

describe('camera distance', () => {
  it('only accepts known steps and defaults to normal', () => {
    expect(ZOOM_LEVELS).toEqual(['close', 'normal', 'far']);
    expect(validZoom('far')).toBe('far');
    expect(validZoom('huge')).toBe('normal');
    expect(validZoom(undefined)).toBe('normal');
  });
  it('shows more tiles the further out it is', () => {
    expect(ZOOM_TILES.close).toBeLessThan(ZOOM_TILES.normal);
    expect(ZOOM_TILES.normal).toBe(1);
    expect(ZOOM_TILES.far).toBeGreaterThan(ZOOM_TILES.normal);
  });
});

describe('sprint control', () => {
  it('is a remappable action with its own default key, free of conflicts', () => {
    expect(ACTIONS).toContain('sprint');
    const owner = new Map<string, string>();
    for (const a of ACTIONS)
      for (const k of DEFAULT_KEYS[a]) {
        expect(owner.get(k), `${k} used by ${owner.get(k)} and ${a}`).toBeUndefined();
        owner.set(k, a);
      }
  });
});
