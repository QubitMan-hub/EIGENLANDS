import { describe, expect, it } from 'vitest';
import { FLORA, WILDLIFE } from '@eigenlands/shared';
import { PixBuf } from '../src/art/shade';
import { paintFlora, paintWildlife } from '../src/art/nature';

function raster(draw: (ctx: PixBuf['ctx']) => void) {
  const b = new PixBuf(40, 40);
  draw(b.ctx);
  return b.ctx.getImageData(0, 0, 40, 40).data;
}
describe('native pixel biodiversity', () => {
  it('gives every species a visible, bounded, crisp sprite and varied silhouettes', () => {
    for (const [catalog, paint] of [
      [FLORA, (id: string, ctx: PixBuf['ctx']) => paintFlora(ctx, id, 0, 1)],
      [WILDLIFE, (id: string, ctx: PixBuf['ctx']) => paintWildlife(ctx, id, 1, 1)],
    ] as const) {
      const unique = new Set<string>();
      for (const species of catalog) {
        const pixels = raster((ctx) => paint(species.id, ctx));
        let coverage = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          expect([0, 255]).toContain(pixels[i]);
          if (pixels[i]) coverage++;
        }
        expect(coverage, species.id).toBeGreaterThan(8);
        for (let p = 0; p < 40; p++) {
          expect(pixels[p * 4 + 3], `${species.id} top`).toBe(0);
          expect(pixels[(39 * 40 + p) * 4 + 3], `${species.id} bottom`).toBe(0);
          expect(pixels[p * 40 * 4 + 3], `${species.id} left`).toBe(0);
          expect(pixels[(p * 40 + 39) * 4 + 3], `${species.id} right`).toBe(0);
        }
        unique.add(Array.from(pixels).join(','));
      }
      expect(unique.size).toBeGreaterThanOrEqual(catalog.length * 0.8);
    }
  });
  it('shows seasonal dormancy and animal motion rather than static recolors', () => {
    const summer = raster((ctx) => paintFlora(ctx, 'poppy', 0, 1));
    const winter = raster((ctx) => paintFlora(ctx, 'poppy', 0, 3));
    expect(summer).not.toEqual(winter);
    for (const id of ['squirrel', 'hare', 'heron', 'frog', 'bee', 'moth', 'crab'])
      expect(
        raster((ctx) => paintWildlife(ctx, id, 1, 1)),
        id,
      ).not.toEqual(raster((ctx) => paintWildlife(ctx, id, 2, 1)));
  });
});

it('keeps every seasonal plant variant and every wildlife heading inside its frame', () => {
  const clipped: string[] = [];
  const check = (pixels: Uint8ClampedArray, name: string) => {
    for (let i = 0; i < 40; i++)
      if ([i, 39 * 40 + i, i * 40, i * 40 + 39].some((p) => pixels[p * 4 + 3])) {
        clipped.push(name);
        break;
      }
  };
  for (const s of FLORA)
    for (let season = 0; season < 4; season++)
      for (let variant = 0; variant < 3; variant++)
        check(
          raster((ctx) => paintFlora(ctx, s.id, variant, season)),
          `${s.id}:${season}:${variant}`,
        );
  for (const s of WILDLIFE)
    for (const season of [1, 3])
      for (let heading = 0; heading < 4; heading++)
        for (let frame = 0; frame < 4; frame++)
          check(
            raster((ctx) => paintWildlife(ctx, s.id, frame, season, heading as 0 | 1 | 2 | 3)),
            `${s.id}:${season}:${heading}:${frame}`,
          );
  expect(clipped).toEqual([]);
});
it('renders true headings with world-space lighting instead of mirrored side views', () => {
  for (const s of WILDLIFE) {
    const views = new Set(
      [0, 1, 2, 3].map((h) =>
        Array.from(raster((ctx) => paintWildlife(ctx, s.id, 1, 1, h as 0 | 1 | 2 | 3))).join(','),
      ),
    );
    expect(views.size, s.id).toBeGreaterThanOrEqual(3);
  }
});
