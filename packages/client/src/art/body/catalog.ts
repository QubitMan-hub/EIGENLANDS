import data from '../wardrobe-catalog.json';
import { validParts } from '@eigenlands/shared';
import type { BodyLook } from './paint';
import { CUTS } from './headwear';
import type { Outfit } from '../actors';
import type { Ramp } from '../shade';
/** Apply catalog materials to the posed garment surfaces, never paste a frontal shirt over a rotated body. */
export function applyCatalog(look: BodyLook, outfit: Outfit): BodyLook {
  const p = validParts(outfit.parts);
  const item = (kind: keyof typeof data, id: number) => data[kind].items[id - 1];
  if (p.hair) {
    const h = item('hair', p.hair)!;
    look.hair = h.ramp as Ramp;
    look.gear = { ...look.gear, cut: CUTS[(p.hair - 1) % CUTS.length]!, volume: 0.94 + Math.min(1, h.aspect) * 0.1 };
  }
  if (p.eyes) look.eyes = item('eyes', p.eyes)!.ramp[0]!;
  if (p.mouths) {
    look.mouth = p.mouths;
    look.lips = item('mouths', p.mouths)!.ramp[0]!;
  }
  if (p.tops) {
    const t = item('tops', p.tops)!,
      i = p.tops - 1;
    look.top = {
      ramp: t.ramp as Ramp,
      sleeve: i >= 30 && i < 40 ? 0.6 : i % 5 === 0 ? 0.55 : 1,
      hem: -1.8,
      collar: true,
    };
    look.topPattern = t.pattern;
    look.vest = undefined;
    look.sash = undefined;
    look.apron = undefined;
    look.cape = undefined;
    look.plate = undefined;
    look.kneeGuards = undefined;
    look.bracers = undefined;
    look.mantle = undefined;
    if (i >= 30 && i < 40) look.plate = { ramp: t.ramp as Ramp, pauldrons: true };
    if (i >= 43) look.skirt = { ramp: t.ramp as Ramp, hem: 2, flare: 1.6, trim: t.ramp[3] };
    else look.skirt = undefined;
    if (i >= 20 && i < 26) look.apron = t.ramp as Ramp;
  }
  const leg = p.shorts ? item('shorts', p.shorts) : p.pants ? item('pants', p.pants) : null;
  if (leg) {
    look.legs = { ramp: leg.ramp as Ramp, hem: p.shorts ? 9 : 1 };
    look.legPattern = leg.pattern;
  }
  if (p.boots) {
    const b = item('boots', p.boots)!;
    look.boots = { ramp: b.ramp as Ramp, top: 3 + ((p.boots - 1) % 5) * 0.8, trim: b.ramp[3] };
  }
  return look;
}
/** Coordinates stay in the body's local surface space through all eight facings and animations. */
export function garmentPixel(pattern: number[] | undefined, u: number, v: number): number | undefined {
  if (!pattern) return;
  const c =
    pattern[Math.min(7, Math.max(0, Math.floor(v * 8))) * 8 + Math.min(7, Math.max(0, Math.floor((u + 1) * 4)))];
  return c !== undefined && c >= 0 ? c : undefined;
}
