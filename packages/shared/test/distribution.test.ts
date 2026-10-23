import { expect, it } from 'vitest';
import { CAVE_OY, T, caveOfCell, caveTileAt, generateChunk, isSolid, landmarkTileAt, shrineOfRegion, ruinOfCell, tileAt } from '../src';

const ore = (t: number) => t >= T.ORE_COPPER && t <= T.ORE_GOLD;
it('leaves breathing room between naturally generated tree trunks', () => {
  let trees = 0, adjacent = 0;
  for (let y = -70; y < 58; y++) for (let x = 88; x < 216; x++) if (tileAt(1337, x, y) === T.TREE) {
    trees++;
    if (tileAt(1337, x + 1, y) === T.TREE || tileAt(1337, x, y + 1) === T.TREE) adjacent++;
  }
  expect(trees).toBeGreaterThan(50);
  expect(adjacent / trees).toBeLessThan(0.06);
});

it('does not grow new obstacles beneath existing player positions or construction', () => {
  for (let y = -64; y < 64; y++) for (let x = 64; x < 192; x++) {
    if (!isSolid(landmarkTileAt(1337, x, y))) expect(isSolid(tileAt(1337, x, y))).toBe(false);
    if (!isSolid(caveTileAt(1337, x, y + CAVE_OY, true))) expect(isSolid(tileAt(1337, x, y + CAVE_OY))).toBe(false);
  }
});

it('puts most cave ore in connected deposits of the same mineral', () => {
  let total = 0, connected = 0;
  for (let y = 256; y < 384; y++) for (let x = 256; x < 384; x++) {
    const t = tileAt(1337, x, y + CAVE_OY);
    if (!ore(t)) continue;
    total++;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(1337, x + dx!, y + CAVE_OY + dy!) === t)) connected++;
  }
  expect(total).toBeGreaterThan(20);
  expect(connected / total).toBeGreaterThan(0.55);
});

it('keeps generation independent of chunk request order at negative coordinates', () => {
  const a = generateChunk(7331, -4, -3);
  generateChunk(7331, -3, -3); generateChunk(7331, -4, -4);
  expect(generateChunk(7331, -4, -3)).toEqual(a);
  for (let y = 0; y < 32; y++) expect(a[y * 32 + 31]).toBe(tileAt(7331, -97, -96 + y));
});

it('keeps existing cave mouths, shrine and ruin centres stable', () => {
  // Known sites from the original generation; save IDs and travel destinations depend on them.
  expect(caveOfCell(1337, 0, -2)).toEqual({ id: 'cv0_-2', x: 20, y: -134, biome: 'enchanted' });
  expect(ruinOfCell(1337, 0, -2)).toEqual({ id: 'ru0_-2', x: 12, y: -125, biome: 'enchanted' });
  expect(shrineOfRegion(1337, 7, 0)).toEqual({ id: 'sh7_0', x: 1666, y: 91, type: 'sequence', pillars: [[-3, 0], [0, -3], [3, 0], [0, 3]] });
});

it('keeps undergrowth coherent across tile boundaries and aligned with the cave aboveground biome', async () => {
  const { vegetationCover } = await import('../src/worldgen');
  let near = 0, far = 0;
  for (let y = -48; y < 48; y += 3) for (let x = -48; x < 48; x += 3) {
    const a = vegetationCover(1337, x, y);
    expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(1);
    expect(vegetationCover(1337, x, y + CAVE_OY)).toBe(a);
    near += Math.abs(a - vegetationCover(1337, x + 1, y));
    far += Math.abs(a - vegetationCover(1337, x + 12, y));
  }
  expect(near).toBeLessThan(far * 0.35);
});
