import { describe, expect, it } from 'vitest';
import { C, line, PixBuf } from '../src/art/shade';

describe('pixel geometry', () => {
  it('ends fractional-coordinate strokes at the nearest art pixel', () => {
    const b = new PixBuf(32, 32);
    line(b.ctx, 4.2, 5.3, 8.4, 7.2, C.white);
    const pixels = b.ctx.getImageData(0, 0, 32, 32).data;
    const lit: number[][] = [];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (pixels[(y * 32 + x) * 4 + 3]) lit.push([x, y]);
    }
    expect(lit).toEqual([[4, 5], [5, 6], [6, 6], [7, 7], [8, 7]]);
  });
});
