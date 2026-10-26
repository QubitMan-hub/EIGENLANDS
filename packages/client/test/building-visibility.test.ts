import { beforeEach, expect, it, vi } from 'vitest';
import { Container, Texture } from 'pixi.js';
const fixture = vi.hoisted(() => ({ buildings: [] as any[], bakes: [] as string[] }));
vi.mock('@eigenlands/shared', async (actual) => ({
  ...(await actual<object>()),
  townsFor: () => [{ buildings: fixture.buildings }],
}));
vi.mock('../src/art/building-worker-client', () => ({ buildingArtWorker: () => ({ available: false }) }));
vi.mock('../src/game/worldobjviews', () => ({ setBuildingLights: () => {} }));
vi.mock('../src/art/buildings', () => ({
  buildBuildingArt: (b: { id: string }) => {
    fixture.bakes.push(b.id);
    return {
      walls: [],
      roof: { tex: Texture.EMPTY, night: null, x: 0, y: 0 },
      shadow: { tex: Texture.EMPTY, x: 0, y: 0 },
      sign: null,
      chimney: null,
      windows: [{ x: 4, y: 4 }],
    };
  },
}));
import { BuildingViews } from '../src/game/buildingviews';
const house = (id: string, x: number, y: number, w = 8) => ({
  id,
  kind: 'house',
  x,
  y,
  w,
  h: 6,
  doorX: x + 3,
  doorY: y + 5,
  style: 0,
});
beforeEach(() => {
  fixture.buildings = [];
  fixture.bakes = [];
});
it('finds a doorway and interior across a chunk boundary without confusing a nearby exterior', () => {
  fixture.buildings = [house('boundary', 29, 30)];
  const views = new BuildingViews(1, new Container(), new Container(), new Container());
  expect(views.insideBuilding(32, 35)).toBe('boundary');
  expect(views.insideBuilding(35, 33)).toBe('boundary');
  expect(views.insideBuilding(29, 33)).toBeNull();
});
it('loads visible buildings before warmup and hides stale roofs after a distant camera jump', () => {
  fixture.buildings = [house('warmup', -40, -40), house('visible', 0, 0), house('destination', 1000, 1000)];
  for (let i = 0; i < 1000; i++) fixture.buildings.push(house('distant' + i, i * 64 + 3000, 3000));
  const roofs = new Container();
  const views = new BuildingViews(1, new Container(), new Container(), roofs);
  const sun = { dx: 1, len: 1, alpha: 0.3, dark: 0.7 };
  views.update(100, 3, 8, true, sun, -10, -10, 10, 10);
  expect(fixture.bakes).toEqual(['visible']);
  expect(views.lights(-10, -10, 10, 10)).toHaveLength(2);
  const previous = roofs.children[0]!;
  views.update(200, 1003, 1008, true, sun, 990, 990, 1010, 1010);
  expect(fixture.bakes).toEqual(['visible', 'destination']);
  expect(previous.visible).toBe(false);
  expect(roofs.children[1]!.visible).toBe(true);
  expect(views.lights(-10, -10, 10, 10)).toHaveLength(0);
});
