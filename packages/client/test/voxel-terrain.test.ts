import { describe, expect, it } from 'vitest';
import { T, LEVEL_PX } from '@eigenlands/shared';
import {
  buildVoxelTerrain,
  steppingStone,
  terrainChunkKeys,
  type TerrainSource,
  type TerrainPatch,
} from '../src/game/voxel/terrain';
import { voxelHeight } from '../src/game/voxel/camera';
import { modelGeometry } from '../src/game/voxel/mesh';
const grass: TerrainSource = { seed: 1234, at: () => ({ tile: T.GRASS, level: 0, color: 0x6c9b43 }) };
const surface = (patch: TerrainPatch, x: number, z: number) => {
  const boxes = patch.boxes.filter(
    (b) => (b.faces ?? 63) & 4 && Math.abs(x - b.x) < b.w / 2 - 1e-8 && Math.abs(z - b.z) < b.d / 2 - 1e-8,
  );
  const b = boxes.sort((a, b) => b.y + b.h / 2 - a.y - a.h / 2)[0];
  return b ? { height: b.y + b.h / 2, color: b.color } : undefined;
};
describe('physical voxel terrain', () => {
  it('creates deterministic stepped surfaces rather than one flat colored tile', () => {
    const a = buildVoxelTerrain(grass, 0, 0, 2),
      b = buildVoxelTerrain(grass, 0, 0, 2);
    expect(a).toEqual(b);
    expect(a.topFaces).toBeGreaterThan(4);
    expect(new Set(a.boxes.filter((b) => b.faces === 4).map((b) => b.y + b.h / 2)).size).toBeGreaterThan(1);
    expect(a.boxes.every((b) => b.w > 0 && b.h > 0 && b.d > 0 && Number.isFinite(b.x + b.y + b.z))).toBe(true);
    expect(Math.max(...a.boxes.map((b) => b.y + b.h / 2))).toBeLessThanOrEqual(1e-8);
    const geometry = modelGeometry(a.boxes);
    expect(geometry.getAttribute('uv')).toBeUndefined();
    geometry.dispose();
  });
  it('keeps the same world-space cap heights/colors across negative and positive chunk origins', () => {
    const whole = buildVoxelTerrain(grass, -1, -1, 2);
    for (const ox of [-1, 0])
      for (const oz of [-1, 0]) {
        const part = buildVoxelTerrain(grass, ox, oz, 1);
        for (let z = 0; z < 8; z++)
          for (let x = 0; x < 8; x++) {
            const a = surface(part, (x + 0.5) / 8, (z + 0.5) / 8),
              b = surface(whole, ox + 1 + (x + 0.5) / 8, oz + 1 + (z + 0.5) / 8);
            expect(a).toBeDefined();
            expect(a!.height).toBeCloseTo(b!.height, 10);
            expect(a!.color).toBe(b!.color);
          }
      }
  });
  it('exposes layered turf, soil and bedrock only along actual height differences', () => {
    const source: TerrainSource = {
      seed: 2,
      at: (x, y) => ({ tile: T.GRASS, level: x === 0 && y === 0 ? 3 : 0, color: 0x66963e }),
    };
    const a = buildVoxelTerrain(source, 0, 0, 1);
    const sides = a.boxes.filter((b) => b.faces !== 4);
    expect(sides.length).toBeGreaterThan(20);
    expect(new Set(sides.map((b) => b.color)).size).toBeGreaterThan(8);
    expect(a.boxes.every((b) => !((b.faces ?? 0) & 8))).toBe(true);
    expect(Math.max(...a.boxes.map((b) => b.y + b.h / 2))).toBeCloseTo(voxelHeight(3 * LEVEL_PX));
    expect(
      a.boxes.every(
        (b) =>
          b.x - b.w / 2 >= -1e-9 && b.z - b.d / 2 >= -1e-9 && b.x + b.w / 2 <= 1 + 1e-9 && b.z + b.d / 2 <= 1 + 1e-9,
      ),
    ).toBe(true);
  });
  it('builds a physical bank beside same-level recessed water', () => {
    const source: TerrainSource = {
      seed: 3,
      at: (x) => ({ tile: x > 0 ? T.WATER : T.GRASS, level: 0, color: x > 0 ? 0x3195a8 : 0x66963e }),
    };
    const a = buildVoxelTerrain(source, 0, 0, 1);
    expect(a.boxes.some((b) => b.faces === 1 && Math.abs(b.x + b.w / 2 - 1) < 1e-8 && b.h > 0.06)).toBe(true);
  });
  it('uses distinct solid treads for rooms, cave paving, fields, and water without changing elevation', () => {
    for (const tile of [T.FLOOR, T.CAVE_FLOOR, T.PATH, T.TILLED, T.TILLED_WET, T.WATER]) {
      const a = buildVoxelTerrain({ seed: 43, at: () => ({ tile, level: 2, color: 0x9a825a, urban: true }) }, 0, 0, 1);
      expect(a.boxes.length).toBeGreaterThan(4);
      expect(a.boxes.every((b) => b.y + b.h / 2 <= voxelHeight(2 * LEVEL_PX) + 1e-8)).toBe(true);
    }
    expect(steppingStone(2)).not.toEqual(steppingStone(4));
  });
  it('keeps crop rows and occupied turf anchored while using only cliff cores for terrain shadows', () => {
    const crops = buildVoxelTerrain(
      { seed: 23, at: () => ({ tile: T.TILLED, level: 0, color: 0x886644, occupied: true }) },
      0,
      0,
      1,
    );
    expect(surface(crops, 0.4375, 0.4375)!.height).toBeCloseTo(0);
    const occupied = buildVoxelTerrain(
      { seed: 23, at: () => ({ tile: T.GRASS, level: 0, color: 0x669944, occupied: true }) },
      0,
      0,
      1,
    );
    expect(surface(occupied, 0.4375, 0.4375)!.height).toBeCloseTo(0);
    expect(occupied.shadowBoxes).toEqual([]);
    const cliff = buildVoxelTerrain(
      { seed: 23, at: (x) => ({ tile: T.GRASS, level: x === 0 ? 2 : 0, color: 0x669944 }) },
      0,
      0,
      1,
    );
    expect(cliff.shadowBoxes.length).toBeGreaterThan(0);
  });
  it('invalidates both sides of edited borders, including negative coordinates', () => {
    expect(terrainChunkKeys(8, 8)).toEqual(['0,0']);
    expect(terrainChunkKeys(15, 8)).toEqual(['0,0', '1,0']);
    expect(terrainChunkKeys(-1, -1)).toEqual(['-1,-1', '0,-1', '-1,0', '0,0']);
  });
  it('bounds surface geometry and provides a cheaper performance tier', () => {
    const high = buildVoxelTerrain(grass, 0, 0, 16, 8),
      low = buildVoxelTerrain(grass, 0, 0, 16, 4);
    console.info('Terrain quad budget', {
      high: high.topFaces + high.sideFaces,
      performance: low.topFaces + low.sideFaces,
    });
    expect(high.topFaces + high.sideFaces).toBeLessThan(24000);
    expect(low.topFaces + low.sideFaces).toBeLessThan(6000);
    expect(low.boxes.length).toBeLessThan(high.boxes.length);
  });
});
