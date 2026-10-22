import { describe, expect, it } from 'vitest';
import { CAVE_OY, CHUNK_SIZE, T, caveLanding, caveObjectsIn, caveOfCell, chunkOf, isSolid, tileAt } from '../src';

const SEED = 1337;
function mouths(): NonNullable<ReturnType<typeof caveOfCell>>[] {
  const out = [];
  for (let gy = -4; gy <= 4; gy++) for (let gx = -4; gx <= 4; gx++) { const m = caveOfCell(SEED, gx, gy); if (m) out.push(m); }
  return out;
}

describe('undercroft caves', () => {
  it('scatters cave mouths on open ground with a dry landing chamber below', () => {
    const ms = mouths();
    expect(ms.length).toBeGreaterThan(10);
    for (const m of ms) {
      expect(isSolid(tileAt(SEED, m.x, m.y))).toBe(false);
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) expect(tileAt(SEED, m.x + i, m.y + CAVE_OY + j)).toBe(T.CAVE_FLOOR);
      const down = caveLanding(SEED, m.id, true)!, up = caveLanding(SEED, m.id, false)!;
      expect(isSolid(tileAt(SEED, Math.floor(down.x), Math.floor(down.y)))).toBe(false);
      expect(Math.floor(up.y)).toBe(m.y + 1);
    }
  });

  it('carves tunnels and caverns through solid rock', () => {
    let open = 0, wall = 0;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { if (tileAt(SEED, x + 300, y + CAVE_OY + 300) === T.CAVE_WALL) wall++; else open++; }
    const f = open / (open + wall);
    expect(f).toBeGreaterThan(0.2);
    expect(f).toBeLessThan(0.7);
  });

  it('places the mouth on the surface and the ladder below, in their own chunks', () => {
    const m = mouths()[0]!;
    const top = caveObjectsIn(SEED, chunkOf(m.x), chunkOf(m.y));
    expect(top.some((o) => o.sub === 'cave_mouth' && o.x === m.x && o.y === m.y)).toBe(true);
    const below = caveObjectsIn(SEED, chunkOf(m.x), chunkOf(m.y + CAVE_OY));
    expect(below.some((o) => o.sub === 'cave_ladder' && o.y === m.y + CAVE_OY)).toBe(true);
    expect(CHUNK_SIZE).toBeGreaterThan(0);
  });
});
