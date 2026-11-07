import { describe, expect, it } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { ChunkStore, T, WILDLIFE_BY_ID } from '@eigenlands/shared';
import { Wildlife, WILDLIFE_LIMIT } from '../src/game/wildlife';
import type { AmbientFrame } from '../src/game/ambient';

function meadow(seed = 42) {
  const store = new ChunkStore(seed);
  // A loaded natural test meadow; using base arrays leaves the player-edit map empty.
  for (let cy = 2; cy <= 4; cy++) for (let cx = 2; cx <= 4; cx++) store.get(cx, cy).tiles.fill(T.GRASS);
  const layer = new Container();
  const wildlife = new Wildlife({ store: () => store, layer: () => layer, texture: () => Texture.EMPTY });
  const frame = (now: number, overrides: Partial<AmbientFrame> = {}): AmbientFrame => ({
    now,
    dt: 0.05,
    view: { x0: 64, y0: 64, x1: 159, y1: 159 },
    me: { x: 112, y: 112 },
    hour: 12,
    weather: 'clear',
    season: 1,
    wind: { dx: 0, dy: 0, strength: 0 },
    reduced: false,
    ...overrides,
  });
  return { store, layer, wildlife, frame };
}
describe('small wildlife layer', () => {
  it('retires unsuitable animals when weather and seasons change', () => {
    const a = meadow();
    for (let i = 0; i < 50; i++) a.wildlife.frame(a.frame(i * 50));
    expect(a.wildlife.count()).toBeGreaterThan(0);
    for (let i = 50; i < 150; i++) a.wildlife.frame(a.frame(i * 50, { weather: 'storm' }));
    for (const id of Object.keys(a.wildlife.kinds())) expect(WILDLIFE_BY_ID[id]!.rain, id).toBe(true);
    for (let i = 150; i < 200; i++) a.wildlife.frame(a.frame(i * 50, { season: 3 }));
    for (const id of Object.keys(a.wildlife.kinds())) expect(WILDLIFE_BY_ID[id]!.winter, id).toBe(true);
    expect(a.layer.children.length).toBe(a.wildlife.count());
  });
  it('populates loaded habitats reproducibly with a bounded number of noncolliding animals', () => {
    const a = meadow(),
      b = meadow();
    for (let i = 0; i < 50; i++) {
      a.wildlife.frame(a.frame(i * 50));
      b.wildlife.frame(b.frame(i * 50));
    }
    expect(a.wildlife.count()).toBeGreaterThan(0);
    expect(a.wildlife.count()).toBeLessThanOrEqual(WILDLIFE_LIMIT);
    expect(a.wildlife.kinds()).toEqual(b.wildlife.kinds());
    expect(a.layer.children.length).toBe(a.wildlife.count());
    for (let i = 50; i < 300; i++) {
      a.wildlife.frame(a.frame(i * 50));
      const actors = (a.wildlife as unknown as { actors: Map<string, { x: number; y: number }> }).actors;
      for (const animal of actors.values())
        expect(a.store.solidAt(Math.floor(animal.x), Math.floor(animal.y))).toBe(false);
    }
    expect(a.wildlife.count()).toBeLessThanOrEqual(WILDLIFE_LIMIT);
  });
  it('keeps player-edited ground clear and cleans up when the player leaves', () => {
    const a = meadow();
    for (let cy = 2; cy <= 4; cy++)
      for (let cx = 2; cx <= 4; cx++) {
        const chunk = a.store.get(cx, cy);
        for (let i = 0; i < chunk.tiles.length; i++) chunk.diff.set(i, T.GRASS);
      }
    a.wildlife.frame(a.frame(0));
    expect(a.wildlife.count()).toBe(0);
    const b = meadow();
    for (let i = 0; i < 50; i++) b.wildlife.frame(b.frame(i * 50));
    expect(b.wildlife.count()).toBeGreaterThan(0);
    b.wildlife.frame(b.frame(3000, { me: { x: 900, y: 900 }, view: { x0: 880, y0: 880, x1: 920, y1: 920 } }));
    expect(b.wildlife.count()).toBe(0);
    expect(b.layer.children.length).toBe(0);
  });
});
