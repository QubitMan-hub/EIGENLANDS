import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { CREATURE_YAW, orientWallProp, objectLayout } from '../src/game/voxel/orientation';
import { voxelCamera, voxelHeight, foregroundOccludes } from '../src/game/voxel/camera';
import { modelGeometry, solidBox } from '../src/game/voxel/mesh';
import { isoX, isoYFlat, LEVEL_PX } from './voxel-test-projection';
import { creatureBoxes, animalBoxes } from '../src/game/voxel/creatures';
import { ENEMY_KEY_BY_KIND, ITEMS, T } from '@eigenlands/shared';
import { voxelItemBoxes } from '../src/game/voxel/items';
import { Iso, Prop, captureSolidCommands } from '../src/art/isokit';
import type { Ctx } from '../src/art/shade';
import { buildingStyle } from '../src/game/voxel/architecture';
import { roofModel } from '../src/game/voxel/models';
import { uiIconBoxes, UI_ICONS, uiPlateBoxes, uiGaugeBoxes } from '../src/game/voxel/ui-models';
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
  it('aligns authored creature noses with the actor forward vector in every heading', () => {
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const nose = new Vector3(1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), CREATURE_YAW + angle);
      expect(nose.x).toBeCloseTo(Math.sin(angle));
      expect(nose.z).toBeCloseTo(Math.cos(angle));
    }
  });
  it('exchanges wall axes without reversing a cupboard front or its anchor', () => {
    const root = new Group();
    orientWallProp(root, 'se');
    root.updateMatrixWorld();
    const front = new Vector3(0.2, 0.4, -0.3).applyMatrix4(root.matrixWorld);
    expect(front.x).toBeCloseTo(-0.3);
    expect(front.y).toBeCloseTo(0.4);
    expect(front.z).toBeCloseTo(0.2);
    orientWallProp(root, 'sw');
    root.updateMatrixWorld();
    expect(new Vector3(0.2, 0.4, -0.3).applyMatrix4(root.matrixWorld).toArray()).toEqual([0.2, 0.4, -0.3]);
  });
  it('backs furniture onto the same wall as collision and points seats toward a table', () => {
    const o = { x: 10, y: 20, kind: 'furniture' as const, sub: 'chair' };
    const store = {
      getTile: (x: number, y: number) => (x === 9 && y === 20 ? T.WALL : T.GRASS),
      objectAt: (x: number, y: number) => (x === 11 && y === 20 ? { ...o, x, sub: 'table' } : undefined),
    };
    expect(objectLayout(store, o)).toEqual({ facing: 'se', seatTurn: 3 });
    expect(objectLayout(store, { ...o, data: { facing: 'sw', seatTurn: 1 } })).toEqual({ facing: 'sw', seatTurn: 1 });
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
  it('keeps clutter on narrow shelves and below the board above', () => {
    const shelf = [solidBox(0, 0.5, 0, 0.5, 0.06, 0.32, 0x886644), solidBox(0, 0.77, 0, 0.5, 0.06, 0.32, 0x886644)];
    for (let seed = 0; seed < 20; seed++) {
      const props = dressFurniture(shelf, 'bookcase', seed);
      expect(props.length).toBeGreaterThan(0);
      for (const b of props) {
        expect(Math.abs(b.x) + b.w / 2).toBeLessThanOrEqual(0.25);
        expect(Math.abs(b.z) + b.d / 2).toBeLessThanOrEqual(0.16);
        if (b.y < 0.74) expect(b.y + b.h / 2).toBeLessThanOrEqual(0.74);
      }
    }
  });
  it('supplies actual positive-volume geometry for every HUD icon and panel material', () => {
    for (const boxes of [
      ...UI_ICONS.map(uiIconBoxes),
      ...(['timber', 'stone', 'jade', 'slot'] as const).map(uiPlateBoxes),
    ]) {
      expect(boxes.length).toBeGreaterThan(1);
      expect(boxes.every((b) => b.w > 0 && b.h > 0 && b.d > 0 && Number.isFinite(b.x + b.y + b.z))).toBe(true);
    }
  });
  it('models an empty and full gauge without negative fill volumes', () => {
    const spec = {
      id: 'health' as const,
      shown: 0,
      trail: 0,
      flash: 0,
      gain: 0,
      low: false,
      tone: 'ok' as const,
      aura: null,
      pips: 0,
      pipMax: 0,
      ready: false,
      t: 0,
    };
    const empty = uiGaugeBoxes(spec),
      full = uiGaugeBoxes({ ...spec, shown: 1, trail: 1 });
    expect(full.length).toBeGreaterThan(empty.length);
    expect([...empty, ...full].every((b) => b.w > 0 && b.h > 0 && b.d > 0)).toBe(true);
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
