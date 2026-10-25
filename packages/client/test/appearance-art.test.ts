import { describe, expect, it } from 'vitest';
import { APPEARANCE_COUNTS, packAppearance } from '@eigenlands/shared';
import { OUTFITS } from '../src/art/actors';
import {
  DRESS_RAMPS,
  DRESS_STYLES,
  EYE_COLORS,
  HAIR_RAMPS,
  HAIR_STYLES,
  SKIN_RAMPS,
  TRIM_COLORS,
  appearanceOf,
  outfitFromAppearance,
} from '../src/art/appearance';

const base = { skin: 2, hairStyle: 6, hairColor: 5, eyes: 4, dress: 4, dressColor: 7, trim: 2 };

describe('appearance art mapping', () => {
  it('has a ramp, style or colour for every shared index', () => {
    expect(SKIN_RAMPS.length).toBe(APPEARANCE_COUNTS.skin);
    expect(HAIR_RAMPS.length).toBe(APPEARANCE_COUNTS.hairColor);
    expect(HAIR_STYLES.length).toBe(APPEARANCE_COUNTS.hairStyle);
    expect(EYE_COLORS.length).toBe(APPEARANCE_COUNTS.eyes);
    expect(DRESS_STYLES.length).toBe(APPEARANCE_COUNTS.dress);
    expect(DRESS_RAMPS.length).toBe(APPEARANCE_COUNTS.dressColor);
    expect(TRIM_COLORS.length).toBe(APPEARANCE_COUNTS.trim);
  });

  it('paints the chosen dress on the default outfit', () => {
    const o = outfitFromAppearance(OUTFITS[0]!, base, true);
    expect(o.mantle).toBe(DRESS_RAMPS[7]);
    expect(o.hairStyle).toBe('spiky');
    expect(o.skin).toBe(SKIN_RAMPS[2]);
  });

  it('keeps worn outfits and armour but still applies skin, hair and eyes', () => {
    const iron = OUTFITS[8 + 2]!;
    const o = outfitFromAppearance(iron, base, false);
    expect(o.shirt).toBe(iron.shirt);
    expect(o.hatStyle).toBe(iron.hatStyle);
    expect(o.hair).toBe(HAIR_RAMPS[5]);
    expect(o.eyes).toBe(EYE_COLORS[4]);
  });

  it('decodes packed values and rejects unset ones', () => {
    expect(appearanceOf(packAppearance(base))).toEqual(base);
    expect(appearanceOf(0)).toBeNull();
  });
});
