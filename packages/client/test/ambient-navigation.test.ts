import { describe, expect, it } from 'vitest';
import { ChunkStore, T } from '@eigenlands/shared';
import { Ambient, type AmbientDeps } from '../src/game/ambient';

interface Walker {
  kind: string;
  st: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  face: number;
  route?: Array<[number, number]>;
  routeTarget?: [number, number];
}

function courtyard() {
  const store = new ChunkStore(20260101);
  for (let y = -5; y <= 10; y++)
    for (let x = -2; x <= 12; x++) store.setTile(x, y, x === -2 || x === 12 || y === -5 || y === 10 ? T.WALL : T.GRASS);
  const ambient = new Ambient({ store: () => store } as AmbientDeps);
  const move = (c: Walker, dt = 1 / 60) =>
    (ambient as unknown as { moveTo(c: Walker, dt: number, speed: number): boolean }).moveTo(c, dt, 1.3);
  const cat: Walker = { kind: 'cat', st: 'walk', x: 2.5, y: 1.5, tx: 8.5, ty: 1.5, face: 1 };
  return { store, move, cat };
}

describe('ambient navigation', () => {
  it('walks an animal around a wall to its destination without entering solid ground', () => {
    const { store, move, cat } = courtyard();
    for (let y = -4; y < 5; y++) store.setTile(5, y, T.WALL);
    let detour = false;
    for (let i = 0; i < 1500; i++) {
      if (cat.y > 4) detour = true;
      const done = move(cat);
      expect(store.solidAt(Math.floor(cat.x), Math.floor(cat.y))).toBe(false);
      if (done) break;
    }
    expect(detour).toBe(true);
    expect(Math.hypot(cat.x - 8.5, cat.y - 1.5)).toBeLessThan(0.1);
  });

  it('finds a new route when something blocks its existing path', () => {
    const { store, move, cat } = courtyard();
    for (let i = 0; i < 45; i++) move(cat);
    store.setTile(5, 1, T.FENCE);
    for (let i = 0; i < 900; i++) {
      move(cat);
      expect(store.solidAt(Math.floor(cat.x), Math.floor(cat.y))).toBe(false);
    }
    expect(Math.hypot(cat.x - 8.5, cat.y - 1.5)).toBeLessThan(0.1);
  });
});
