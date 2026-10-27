import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_COUNTS,
  packAppearance,
  randomAppearance,
  unpackAppearance,
  validAppearance,
  type Appearance,
} from '../src/appearance';

describe('appearance packing', () => {
  it('round-trips every field at its extremes', () => {
    const a: Appearance = {
      skin: APPEARANCE_COUNTS.skin - 1,
      hairStyle: APPEARANCE_COUNTS.hairStyle - 1,
      hairColor: APPEARANCE_COUNTS.hairColor - 1,
      eyes: APPEARANCE_COUNTS.eyes - 1,
      dress: APPEARANCE_COUNTS.dress - 1,
      dressColor: APPEARANCE_COUNTS.dressColor - 1,
      trim: APPEARANCE_COUNTS.trim - 1,
      body: APPEARANCE_COUNTS.body - 1,
      cut: APPEARANCE_COUNTS.cut - 1,
    };
    expect(unpackAppearance(packAppearance(a))).toEqual(a);
  });

  it('decodes looks saved before body type and haircut existed unchanged (both 0)', () => {
    // the original 24-bit layout plus the "chosen" bit: skin 2, hair style 5, every other field 1
    const old = ((1 << 24) | 2 | (5 << 3) | (1 << 7) | (1 << 11) | (1 << 14) | (1 << 17) | (1 << 21)) >>> 0;
    const a = unpackAppearance(old)!;
    expect(a).toMatchObject({ skin: 2, hairStyle: 5, hairColor: 1, eyes: 1, dress: 1, dressColor: 1, trim: 1 });
    expect(a.body).toBe(0);
    expect(a.cut).toBe(0);
    expect(validAppearance(old)).toBe(old);
  });

  it('treats 0 and foreign values as never chosen', () => {
    expect(unpackAppearance(0)).toBeNull();
    expect(validAppearance(0)).toBe(0);
    expect(validAppearance('x')).toBe(0);
    expect(validAppearance(-1)).toBe(0);
    expect(validAppearance(1.5)).toBe(0);
    expect(validAppearance(2 ** 40)).toBe(0);
  });

  it('clamps out-of-range indices instead of trusting them', () => {
    const packed = packAppearance({
      skin: 99,
      hairStyle: -4,
      hairColor: 2,
      eyes: 1,
      dress: 1,
      dressColor: 1,
      trim: 1,
      body: 7,
      cut: 99,
    });
    const a = unpackAppearance(packed)!;
    expect(a.skin).toBe(0);
    expect(a.hairStyle).toBe(0);
    expect(a.body).toBe(0);
    expect(a.cut).toBe(0);
    expect(validAppearance(packed)).toBe(packed);
  });

  it('only ever produces valid random looks', () => {
    let seed = 1;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 200; i++) {
      const a = randomAppearance(rand);
      for (const k of Object.keys(APPEARANCE_COUNTS) as Array<keyof Appearance>) {
        expect(a[k]).toBeGreaterThanOrEqual(0);
        expect(a[k]).toBeLessThan(APPEARANCE_COUNTS[k]);
      }
      expect(unpackAppearance(packAppearance(a))).toEqual(a);
    }
  });
});
