/**
 * Humanoid statues on the same skeleton and proportions as the living (art/body): each keeps its identity, pose and
 * material, carved at its own scale (the plaza monument stands about three times life size), with a modelled head in
 * place of a drawn face. Pedestals, braziers, inscriptions and glows stay with the props that own them.
 */
import { C, PixBuf, type Ctx, type Ramp } from '../shade';
import type { BodyLook } from './paint';
import { paintDirectional } from './directional';
import { AX, AY, DIMS, restPose, solve, type Pose } from './skeleton';

const STONE: Ramp = [C.slate, C.steel, C.mist, C.fog, C.pale];
const COAT: Ramp = [C.night, C.slate, C.steel, C.mist];
const UNDER: Ramp = STONE;

/** A hooded stone figure in a robe, hands folded, eyes lit. */
const CRYPT: BodyLook = {
  body: 'male',
  skin: STONE,
  hair: STONE,
  eyes: C.q5,
  under: UNDER,
  gear: { cut: 'bald', hat: 'hood' },
  hat: COAT,
  top: { ramp: STONE, sleeve: 1, hem: -2 },
  mantle: COAT,
  skirt: { ramp: STONE, hem: 0.6, flare: 2.4 },
  belt: { ramp: COAT },
  boots: { ramp: STONE, top: 1.5 },
};
function foldedPose(): Pose {
  const d = DIMS.male;
  const p = restPose(d);
  p.handR = [2.3, 0.7, d.hipZ + 2.2];
  p.handL = [2.3, -0.7, d.hipZ + 2.2];
  p.lean = 0.05;
  return p;
}

/** A garden statue: a robed figure holding a bowl to the sky (material ramp from the prop's style). */
function gardenLook(main: Ramp): BodyLook {
  return {
    body: 'female',
    skin: main,
    hair: main,
    eyes: main[1]!,
    under: main,
    gear: { cut: 'bun' },
    top: { ramp: main, sleeve: 0.45, hem: -2 },
    skirt: { ramp: main, hem: 0.5, flare: 2.2 },
    boots: { ramp: main, top: 1 },
  };
}
function offeringPose(): Pose {
  const d = DIMS.female;
  const p = restPose(d);
  p.handR = [1.4, 1.4, d.shoulderZ + 3.2];
  p.handL = [1.4, -1.4, d.shoulderZ + 3.2];
  p.elbowR = [0, 1, -0.4];
  p.elbowL = [0, -1, -0.4];
  p.shrug = 0.2;
  return p;
}

export type StatueId = 'crypt' | 'garden';

/** Paint a statue's figure with its feet at (ax, ay) of a w×h canvas, facing game direction `dir`. */
export function paintStatue(
  ctx: Ctx,
  id: StatueId,
  dir: number,
  at: { w: number; h: number; ax: number; ay: number; k: number },
  material?: Ramp,
): void {
  const look = id === 'crypt' ? CRYPT : gardenLook(material ?? STONE);
  const pose = id === 'crypt' ? foldedPose() : offeringPose();
  const source = new PixBuf(64, 64);
  paintDirectional(source.ctx, dir, solve(DIMS[look.body], pose), look);
  const pixels = new Uint8ClampedArray(source.px.buffer),
    image = ctx.getImageData(0, 0, at.w, at.h);
  for (let y = 0; y < at.h; y++)
    for (let x = 0; x < at.w; x++) {
      const sx = Math.floor((x - at.ax) / at.k + AX),
        sy = Math.floor((y - at.ay) / at.k + AY);
      if (sx < 0 || sx >= 64 || sy < 0 || sy >= 64) continue;
      const i = (sy * 64 + sx) * 4;
      if (pixels[i + 3]) image.data.set(pixels.subarray(i, i + 4), (y * at.w + x) * 4);
    }
  ctx.putImageData(image, 0, 0);
}
