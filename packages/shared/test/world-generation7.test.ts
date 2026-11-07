import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generationMeta, isWorldGeneration, WORLD_GENERATION } from '../src/world-version';
import { frontierSite, frontierSitesNear, frontierTown } from '../src/frontier';
import { ChunkStore } from '../src/chunks';
import { findPath } from '../src/path';
import { T } from '../src/tiles';
import { OTHERWORLDS } from '../src/otherworlds';
import { CRYPT_OY, CRYPT_DEEP_OY } from '../src/cryptplane';
import { GATE_OY } from '../src/gate-plane';
import { acceptPreparedWorldChunk, prepareWorldChunk, sampleClimate } from '../src/worldgen';

describe('connected world revision', () => {
  it('keeps surface provinces out of realm, crypt and dungeon interior planes', () => {
    for (const seed of [42, 20260101, 987654])
      for (const oy of [...Object.values(OTHERWORLDS).map((w) => w.oy), CRYPT_OY, CRYPT_DEEP_OY, GATE_OY])
        expect(frontierSitesNear(seed, -2000, oy - 2000, 2000, oy + 2000, 7)).toEqual([]);
    // The legacy generator is frozen, including its historical placement decisions.
    expect(
      frontierSitesNear(42, -2000, OTHERWORLDS.aetheria.oy - 2000, 2000, OTHERWORLDS.aetheria.oy + 2000, 6).length,
    ).toBeGreaterThan(0);
  });
  it('connects provincial capitals to their subordinate settlements through real generated tiles and collision', () => {
    for (const seed of [42, 20260101, 987654]) {
      let capital: ReturnType<typeof frontierSite> = null;
      for (let ry = -9; ry <= -2 && !capital; ry++)
        for (let rx = -9; rx <= 9 && !capital; rx++) {
          const s = frontierSite(seed, rx, ry, 7);
          if (s?.tier === 'capital') capital = s;
        }
      expect(capital).not.toBeNull();
      const children = frontierSitesNear(
        seed,
        capital!.cx - 300,
        capital!.cy - 150,
        capital!.cx + 300,
        capital!.cy + 150,
        7,
      ).filter((s) => s.parentId === capital!.id);
      expect(children.length).toBe(2);
      const store = new ChunkStore(seed, 128, 7);
      const town = frontierTown(seed, capital!, 7);
      const start = town.spots[`${capital!.id}.plaza`]!;
      for (const child of children) {
        const end = frontierTown(seed, child, 7).spots[`${child.id}.plaza`]!;
        const midpoint = Math.round((capital!.cx + child.cx) / 2);
        // The road outside the capital wall must be present in actual chunk generation.
        const outside = capital!.cx + (child.cx > capital!.cx ? 136 : -136);
        expect(store.getTile(outside, capital!.cy)).toBe(T.PATH);
        expect(store.levelAt(outside, capital!.cy)).toBe(0);
        const route = findPath(start.x, start.y, end.x, end.y, store.solidAt, 18000);
        expect(route, `${seed} road to ${child.id} via ${midpoint}`).not.toBeNull();
        expect(route!.every(([x, y]) => !store.solidAt(x, y))).toBe(true);
      }
    }
  }, 30000);
  it('creates generation 7 only for new worlds and preserves saved revisions', () => {
    expect(WORLD_GENERATION).toBe(7);
    expect(isWorldGeneration(7)).toBe(true);
    expect(generationMeta(null, { hasWorldData: false, fresh: 7 })).toEqual({ version: 7 });
    for (const version of [3, 4, 5, 6, 7])
      expect(generationMeta({ version }, { hasWorldData: true, fresh: 7 })).toEqual({ version });
    expect(generationMeta(null, { hasWorldData: true, fresh: 7 })).toEqual({ version: 2, migratedFrom: 1 });
    expect(() => generationMeta({ version: 8 })).toThrow('Unsupported');
  });

  it('preserves the revision-6 frontier tiles, climate, biomes and levels', () => {
    const p = prepareWorldChunk(20260101, -248, -280, 6);
    const hash = createHash('sha256');
    for (const a of [p.tiles, p.levels, p.climate, p.biomes])
      hash.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    expect(hash.digest('hex')).toBe('5ba006fa0181394b5c035aeeb39c16c6aea33acb4225ebab8bbf8e93320cab6b');
  });

  it('isolates frontier sites and prepared climate across revisions of the same seed', () => {
    const seed = 20260101;
    const legacy = frontierSite(seed, -6, -6, 6)!;
    const current = frontierSite(seed, -6, -6, 7)!;
    expect(current.tier).toBeDefined();
    expect(legacy.tier).toBeUndefined();
    expect(frontierSite(seed, -6, -6, 6)).toEqual(legacy);
    const before = sampleClimate(seed, legacy.cx, legacy.cy, 6);
    const p = prepareWorldChunk(seed, -248, -280, 7);
    acceptPreparedWorldChunk(p);
    expect(sampleClimate(seed, legacy.cx, legacy.cy, 6)).toEqual(before);
    expect(prepareWorldChunk(seed, -248, -280, 7)).toEqual(p);
  });
});
