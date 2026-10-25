import { expect, it } from 'vitest';
import { C, PALETTE } from '@eigenlands/shared';
import { ART_RGB, contour, critterLayout, normalizeBody, paletteColor } from '../src/art/creature-pixels';

const rgba = (rgb: number, a = 255) => [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, a];

it('retains every master color exactly, including the semantic quantum accents', () => {
  for (const hex of PALETTE) {
    const rgb = parseInt(hex.slice(1), 16);
    expect(paletteColor(rgb)).toBe(rgb);
  }
  expect(ART_RGB.q7).toBe(parseInt(PALETTE[C.q7].slice(1), 16));
});

it('maps imported body pixels into the palette with crisp coverage and no dither', () => {
  const data = new Uint8ClampedArray([21, 56, 81, 255, 123, 109, 67, 150, 80, 90, 100, 127, 9, 8, 7, 0]);
  normalizeBody(data, 4, 1);
  const palette = new Set(PALETTE.map((hex) => parseInt(hex.slice(1), 16)));
  for (const i of [0, 4]) {
    expect(palette.has((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!)).toBe(true);
    expect(data[i + 3]).toBe(255);
  }
  expect(Array.from(data.slice(8))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
});

it('contours shaded edges inside the silhouette without swelling legs, filling gaps or dimming protected glow', () => {
  const data = new Uint8ClampedArray(5 * 5 * 4);
  for (const [x, y] of [
    [1, 1],
    [2, 1],
    [3, 1],
    [1, 2],
    [3, 2],
    [1, 3],
    [3, 3],
  ])
    data.set(rgba(ART_RGB.e5), (y * 5 + x) * 4);
  const alpha = data.filter((_, i) => i % 4 === 3);
  contour(data, 5, 5, (i) => i !== 18);
  expect(Array.from(data.slice((1 * 5 + 1) * 4, (1 * 5 + 1) * 4 + 4))).toEqual(rgba(ART_RGB.e5));
  expect(Array.from(data.slice((3 * 5 + 1) * 4, (3 * 5 + 1) * 4 + 4))).toEqual(rgba(ART_RGB.night));
  expect(Array.from(data.slice(18 * 4, 18 * 4 + 4))).toEqual(rgba(ART_RGB.e5));
  expect(data.filter((_, i) => i % 4 === 3)).toEqual(alpha);
});

it('never brightens existing ink into an inverted outline', () => {
  const data = new Uint8ClampedArray([...rgba(ART_RGB.ink), ...rgba(ART_RGB.ink)]);
  contour(data, 2, 1);
  expect(Array.from(data)).toEqual([...rgba(ART_RGB.ink), ...rgba(ART_RGB.ink)]);
});

it('bases species scale on visible art rather than transparent sheet padding, with integer foot contacts', () => {
  expect(critterLayout(64, 64, 0.5, 0.74, 28, 26)).toEqual({ width: 64, height: 64, ax: 0.5, ay: 47 / 64 });
  const large = critterLayout(80, 64, 0.5, 0.9, 64, 40);
  expect(large.width).toBe(40);
  expect(large.height).toBe(32);
  expect(large.ax * large.width).toBe(Math.round(large.ax * large.width));
  expect(large.ay * large.height).toBe(Math.round(large.ay * large.height));
});
