import { expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import { T } from '@eigenlands/shared';
import { GroundMarks, type GroundFrame } from '../src/game/groundmarks';

/** a flat world of one tile kind */
const world = (tile: number) => ({ getTile: () => tile }) as never;
const tex = () =>
  Object.fromEntries(['snow', 'sand', 'mud', 'puddleS', 'puddleM', 'puddleL'].map((k) => [k, Texture.EMPTY]));
const frame = (o: Partial<GroundFrame>): GroundFrame => ({
  dt: 0.1,
  weather: 'clear',
  season: 1,
  biome: 'meadow',
  reduced: true,
  walkers: [],
  me: { x: 0, y: 0 },
  ...o,
});

it('walking on sand leaves fading footprints; dry grass leaves none', () => {
  const sand = new GroundMarks(() => world(T.SAND), tex);
  for (let i = 0; i < 40; i++) sand.frame(frame({ walkers: [{ id: 'me', x: i * 0.2, y: 0 }] }));
  expect(sand.counts().prints).toBeGreaterThan(10);
  for (let i = 0; i < 1000; i++) sand.frame(frame({ dt: 0.1 }));
  expect(sand.counts().prints).toBe(0); // all faded
  const grass = new GroundMarks(() => world(T.GRASS), tex);
  for (let i = 0; i < 40; i++) grass.frame(frame({ walkers: [{ id: 'me', x: i * 0.2, y: 0 }] }));
  expect(grass.counts().prints).toBe(0);
});

it('rain soaks the ground: mud prints on grass and puddles on paths, drying out afterwards', () => {
  const g = new GroundMarks(() => world(T.PATH), tex);
  for (let i = 0; i < 600; i++) g.frame(frame({ weather: 'rain', walkers: [{ id: 'me', x: i * 0.05, y: 0 }] }));
  const wet = g.counts();
  expect(wet.wetness).toBeGreaterThan(0.6);
  expect(wet.puddles).toBeGreaterThan(3);
  expect(wet.prints).toBeGreaterThan(0);
  for (let i = 0; i < 3000; i++) g.frame(frame({ dt: 0.1 }));
  expect(g.counts().puddles).toBe(0);
});

it('a teleport is not a step', () => {
  const g = new GroundMarks(() => world(T.SAND), tex);
  g.frame(frame({ walkers: [{ id: 'me', x: 0, y: 0 }] }));
  g.frame(frame({ walkers: [{ id: 'me', x: 50, y: 0 }] }));
  expect(g.counts().prints).toBe(0);
});
