import { expect, it } from 'vitest';
import { rasterPixels, put, C } from '../src/art/shade';
import { PALETTE } from '@eigenlands/shared';
it('writes clipped opaque art pixels with correct palette bytes and restores ordinary Canvas painting', () => {
  let result: ImageData | undefined,
    native = 0;
  const ctx = {
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (img: ImageData) => {
      result = img;
    },
    fillRect: () => {
      native++;
    },
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
  rasterPixels(ctx, 3, 2, () => {
    put(ctx, -5, 0, C.white, 2, 1);
    put(ctx, -1, 0, C.e4, 3, 1);
    put(ctx, 2, 1, C.q5);
  });
  expect(native).toBe(0);
  expect([...result!.data.slice(8, 12)]).toEqual([0, 0, 0, 0]);
  const rgb = parseInt(PALETTE[C.q5]!.slice(1), 16);
  expect([...result!.data.slice(20, 24)]).toEqual([rgb >>> 16, (rgb >>> 8) & 255, rgb & 255, 255]);
  put(ctx, 0, 0, C.white);
  expect(native).toBe(1);
});
