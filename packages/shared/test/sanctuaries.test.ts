import { expect, it } from 'vitest';
import { oceanGate, sanctuaryTileAt, DIVE_OY, T, shrineOfId, trapSafe } from '../src';

it('diving sites lead to deterministic enclosed shrines with an exit and solid room boundaries', () => {
  let n = 0;
  for (let gy = -5; gy <= 5; gy++) for (let gx = -5; gx <= 5; gx++) {
    const gate = oceanGate(1337, gx, gy); if (!gate) continue;
    n++;
    expect(oceanGate(1337, gx, gy)).toEqual(gate);
    const sh = shrineOfId(1337, `os${gx}_${gy}`)!;
    expect(sh.y).toBe(gate.y + DIVE_OY);
    expect(sanctuaryTileAt(1337, sh.x, sh.y)).toBe(T.PATH);
    expect(sanctuaryTileAt(1337, sh.x + 11, sh.y)).toBe(T.CAVE_WALL);
  }
  expect(n).toBeGreaterThan(0);
  expect(shrineOfId(1337, 'osNaN_0')).toBeNull();
});

it('trap windows have a visible two-second safe phase and repeat without clock drift', () => {
  expect(trapSafe(1000, 0)).toBe(true); expect(trapSafe(3000, 0)).toBe(false);
  expect(trapSafe(1000 + 4000, 0)).toBe(true);
});
