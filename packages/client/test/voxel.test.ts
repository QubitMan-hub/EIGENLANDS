import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { voxelCamera, voxelHeight, foregroundOccludes } from '../src/game/voxel/camera';
import { modelGeometry, solidBox } from '../src/game/voxel/mesh';
import { isoX, isoYFlat, LEVEL_PX } from './voxel-test-projection';
import { creatureBoxes, animalBoxes } from '../src/game/voxel/creatures';
import { ENEMY_KEY_BY_KIND, ITEMS } from '@eigenlands/shared';
import { voxelItemBoxes } from '../src/game/voxel/items';
import { Iso, Prop, captureSolidCommands } from '../src/art/isokit';
import type { Ctx } from '../src/art/shade';
import { buildingStyle } from '../src/game/voxel/architecture';
import { roofModel } from '../src/game/voxel/models';
import { dressFurniture } from '../src/game/voxel/furnishings';

describe('orthographic world adapter', () => {
  it('matches the existing 2:1 projection at multiple zooms and large world coordinates', () => {
    for (const scale of [1.5, 3, 5]) {
      const camera = voxelCamera(1280, 720, scale, { x: 310.5, y: 70004.25, lift: 12 });
      for (const [x, y, h] of [
        [310, 70003, 0],
        [308, 70005, 2],
        [312, 70007, 5],
      ]) {
        const p = new Vector3(x, voxelHeight(h * LEVEL_PX), y).project(camera);
        expect((p.x + 1) * 640).toBeCloseTo(640 + (isoX(x, y) - isoX(310.5, 70004.25)) * scale, 5);
        expect((1 - p.y) * 360).toBeCloseTo(
          360 + (isoYFlat(x, y) - h * LEVEL_PX - (isoYFlat(310.5, 70004.25) - 12 - 6)) * scale,
          5,
        );
      }
    }
  });
  it('only cuts foreground volumes intersecting the player camera ray', () => {
    expect(foregroundOccludes(2, 2, 4, 0, 0)).toBe(true);
    expect(foregroundOccludes(-2, -2, 4, 0, 0)).toBe(false);
    expect(foregroundOccludes(5, 0, 4, 0, 0)).toBe(false);
    expect(foregroundOccludes(12, 12, 1, 0, 0)).toBe(false);
  });
});

describe('volumetric meshing', () => {
  it('keeps architecture stable while supplying distinct structural roof families', () => {
    const kinds = ['house', 'farmhouse', 'store', 'smithy', 'inn', 'hall', 'church', 'tower'] as const;
    const roofs = new Set<string>();
    for (const [i, kind] of kinds.entries())
      for (let n = 0; n < 12; n++) {
        const b = {
          id: `${kind}${n}`,
          kind,
          x: i * 20 + n,
          y: 50,
          w: 7,
          h: 6,
          doorX: i * 20 + n + 3,
          doorY: 55,
          style: n % 4,
        };
        expect(buildingStyle(b)).toEqual(buildingStyle({ ...b }));
        roofs.add(buildingStyle(b).roof);
        expect(roofModel(b).every((q) => q.w > 0 && q.h > 0 && q.d > 0)).toBe(true);
      }
    expect(roofs.size).toBeGreaterThanOrEqual(5);
  });
  it('varies table dressing by household seed and places it on a real support surface', () => {
    const table = [solidBox(0, 0.6, 0, 1, 0.1, 0.8, 0x886644)];
    const a = dressFurniture(table, 'table', 100, 'inn'),
      b = dressFurniture(table, 'table', 101, 'house');
    expect(a.length).toBeGreaterThan(3);
    expect(a).not.toEqual(b);
    expect(a).toEqual(dressFurniture(table, 'table', 100, 'inn'));
    expect(a.every((q) => q.y - q.h / 2 >= 0.65)).toBe(true);
    expect(a.every((q) => Math.abs(q.x) + q.w / 2 <= 0.5 && Math.abs(q.z) + q.d / 2 <= 0.4)).toBe(true);
  });
  it('supplies finite solid volumes for every inventory item without reading a sprite', () => {
    for (const id of Object.keys(ITEMS)) {
      const boxes = voxelItemBoxes(id);
      expect(boxes.length, id).toBeGreaterThan(0);
      expect(
        boxes.every((b) => Number.isFinite(b.x + b.y + b.z + b.w + b.h + b.d + b.color)),
        id,
      ).toBe(true);
      expect(
        boxes.every((b) => b.w > 0 && b.h > 0 && b.d > 0),
        id,
      ).toBe(true);
    }
  });
  it('converts every authored enemy volume without consulting an image or browser canvas', () => {
    const missing: string[] = [];
    for (const name of Object.values(ENEMY_KEY_BY_KIND)) {
      const boxes = creatureBoxes(name);
      if (['cow', 'sheep', 'pig', 'horse'].includes(name)) continue;
      if (!boxes.length) missing.push(name);
      expect(
        boxes.every((b) => Number.isFinite(b.x + b.y + b.z + b.w + b.h + b.d)),
        name,
      ).toBe(true);
    }
    expect(missing).toEqual([]);
  });
  it('retains village animal anatomy as occupied volumes', () => {
    for (const name of ['cat', 'dog', 'pigeon', 'cow', 'sheep', 'pig', 'horse']) {
      const boxes = animalBoxes(name, 1);
      expect(boxes.length, name).toBeGreaterThan(20);
      expect(
        boxes.some((b) => b.y > 0.2),
        name,
      ).toBe(true);
    }
  });
  it('captures solid furniture commands with dimensions and facing before rasterization', () => {
    const ctx = {} as Ctx;
    const result = captureSolidCommands(() => {
      const iso = new Iso(ctx, 0, 0);
      iso.box(1, 2, 3, 4, 5, 6, { top: 7, left: 8, right: 9 });
      const prop = new Prop(ctx, 0, 0, 'se');
      prop.box(1, 2, 3, 4, 5, 6, { ramp: [1, 2, 3] });
    });
    expect(result.groups[0]).toHaveLength(2);
    expect(result.groups[0][0]).toMatchObject({ u: 1, v: 2, z: 3, du: 4, dv: 5, dz: 6 });
    expect(result.groups[0][1]).toMatchObject({ u: 2, v: 1, z: 3, du: 5, dv: 4, dz: 6 });
  });
  it('emits real lit closed 3D geometry with volume and no texture coordinates', () => {
    const g = modelGeometry([solidBox(0, 0.5, 0, 1, 1, 1, 0x886644)]);
    g.computeBoundingBox();
    expect(g.boundingBox!.getSize(new Vector3()).toArray()).toEqual([1, 1, 1]);
    expect(g.getAttribute('normal').count).toBeGreaterThanOrEqual(24);
    expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
    expect(g.getAttribute('uv')).toBeUndefined();
    g.dispose();
  });
});
