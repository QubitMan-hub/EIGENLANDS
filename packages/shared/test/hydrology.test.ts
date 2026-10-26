import { expect, it } from 'vitest';
import { biomeAt, generateChunk, sampleClimate, tileAt } from '../src/worldgen';
import { generationMeta } from '../src/world-version';
import { T } from '../src/tiles';

function pools(seed: number, version: 1 | 2) {
  const wet = new Set<string>();
  for (let y = -160; y < 160; y++)
    for (let x = -160; x < 160; x++) {
      if (
        biomeAt(seed, x, y) === 'swamp' &&
        sampleClimate(seed, x, y).height >= -0.2 &&
        tileAt(seed, x, y, version) === T.WATER
      )
        wet.add(`${x},${y}`);
    }
  const total = wet.size,
    sizes: number[] = [];
  while (wet.size) {
    const first = wet.values().next().value!;
    wet.delete(first);
    const queue = [first];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!.split(',').map(Number);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const next = `${x! + dx!},${y! + dy!}`;
        if (wet.delete(next)) queue.push(next);
      }
    }
    sizes.push(queue.length);
  }
  return {
    total,
    count: sizes.length,
    largest: Math.max(...sizes),
    tiny: sizes.filter((n) => n < 5).reduce((a, b) => a + b, 0),
  };
}

it.each([20260101, 1337, 7102025])(
  'makes coherent wetland lakes with fewer fragments and more dry ground for seed %s',
  (seed) => {
    const old = pools(seed, 1),
      next = pools(seed, 2);
    expect(next.count).toBeLessThan(old.count * 0.35);
    expect(next.largest).toBeGreaterThan(old.largest * 2);
    expect(next.tiny).toBeLessThan(old.tiny * 0.35);
    expect(next.total).toBeLessThan(old.total);
  },
);

it('keeps revisioned chunks separate in the cache and reproduces their tile queries at seams', () => {
  const a = generateChunk(1337, -4, -5, 1),
    b = generateChunk(1337, -4, -5, 2);
  expect(a).not.toEqual(b);
  expect(generateChunk(1337, -4, -5, 1)).toEqual(a);
  for (let y = 0; y < 32; y++) {
    expect(b[y * 32 + 31]).toBe(tileAt(1337, -97, -160 + y, 2));
    expect(a[y * 32]).toBe(tileAt(1337, -128, -160 + y, 1));
  }
});

it('adds sparse surface lava pockets with scree margins while leaving revision 1 unchanged', () => {
  let lava = 0,
    scree = 0;
  for (let y = 400; y < 432; y++)
    for (let x = -416; x < -384; x++) {
      const t = tileAt(20260101, x, y, 2);
      if (t === T.LAVA) lava++;
      if (t === T.SCORIA) scree++;
      expect(tileAt(20260101, x, y, 1)).not.toBe(T.LAVA);
    }
  expect(lava).toBeGreaterThan(10);
  expect(lava).toBeLessThan(70);
  expect(scree).toBeGreaterThan(10);
  for (let y = -64; y < 64; y++) for (let x = -64; x < 64; x++) expect(tileAt(20260101, x, y, 2)).not.toBe(T.LAVA);
});

it('pins saved worlds to their revision and only lets brand-new worlds start at revision 3', () => {
  // saved metadata is never upgraded automatically
  expect(generationMeta({ version: 2 }, { hasWorldData: true, fresh: 3 })).toEqual({ version: 2 });
  expect(generationMeta({ version: 2, migratedFrom: 1 }, { fresh: 3 })).toEqual({ version: 2, migratedFrom: 1 });
  expect(generationMeta({ version: 3 }, { fresh: 2 })).toEqual({ version: 3 });
  // a world without metadata is brand new only when it has no characters
  expect(generationMeta(null, { hasWorldData: false, fresh: 3 })).toEqual({ version: 3 });
  expect(generationMeta(null, { hasWorldData: true, fresh: 3 })).toEqual({ version: 2, migratedFrom: 1 });
  expect(generationMeta(undefined, { fresh: 3 })).toEqual({ version: 2, migratedFrom: 1 });
  // an operator can keep creating revision-2 worlds
  expect(generationMeta(null, { hasWorldData: false, fresh: 2 })).toEqual({ version: 2, migratedFrom: 1 });
});

it('upgrades known metadata conservatively and refuses future or corrupt versions', () => {
  expect(generationMeta(null)).toEqual({ version: 2, migratedFrom: 1 });
  expect(generationMeta({ version: 1 })).toEqual({ version: 2, migratedFrom: 1 });
  expect(generationMeta({ version: 2 })).toEqual({ version: 2 });
  expect(generationMeta({ version: 3 })).toEqual({ version: 3 });
  expect(generationMeta({ version: 4 })).toEqual({ version: 4 });
  expect(generationMeta({ version: 5 })).toEqual({ version: 5 });
  expect(generationMeta({ version: 6 })).toEqual({ version: 6 });
  expect(() => generationMeta({ version: 7 })).toThrow('Unsupported');
  expect(() => generationMeta({ version: '2' })).toThrow('Unsupported');
});
