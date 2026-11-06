import { afterEach, expect, it } from 'vitest';
import { castProjection } from '../src/game/grounding';
import { ObjectViews } from '../src/game/objectviews';
import { setLift } from '../src/game/iso';
afterEach(() => setLift(null));
it('projects sunlight with independent horizontal length and flattening around a fixed foot point', () => {
  for (const dx of [-1, -0.3, 0, 0.3, 1])
    for (const len of [0.2, 1, 2]) {
      const p = castProjection(dx, len);
      expect(Math.sin(p.skewX) * p.scaleY).toBeCloseTo(-dx * len * 0.55);
      expect(Math.cos(p.skewX) * p.scaleY).toBeCloseTo(-(0.22 + 0.14 * len));
    }
});
it('updates the tree and both shadows together when streamed terrain changes the lifted ground height', () => {
  let height = 0;
  setLift(() => height);
  const root = { x: 16, y: 0, visible: true, skew: { x: 0 } };
  const position = {
    x: 0,
    y: 0,
    copyFrom(p: { x: number; y: number }) {
      this.x = p.x;
      this.y = p.y;
    },
  };
  const shadow = { position: { ...position }, visible: true, scale: { y: 0 }, skew: { x: 0 }, alpha: 0 };
  const contact = { position: { ...position }, visible: true, alpha: 0 };
  const o = {
    root,
    shadow,
    contact,
    echo: null,
    tx: 1,
    ty: 1,
    groundX: 1.5,
    groundY: 1.5,
    kind: 'tree',
    phase: 0,
    frames: 1,
    hidden: false,
  };
  const views = Object.assign(Object.create(ObjectViews.prototype), {
    chunks: new Map([['0,0', new Map([[0, o]])]]),
    visibleBounds: '',
  }) as ObjectViews;
  const sun = { dx: 0.5, len: 1, alpha: 0.3 };
  views.update(0, sun, true, 0, 0, 3, 3);
  expect(root.y).toBe(24);
  height = 12;
  views.update(100, sun, true, 0, 0, 3, 3);
  expect(root.y).toBe(12);
  expect(shadow.position.y).toBe(12);
  expect(contact.position.y).toBe(12);
  expect(contact.alpha).toBeGreaterThan(0);
  views.update(200, sun, true, 4, 4, 6, 6);
  expect(contact.visible).toBe(false);
});
