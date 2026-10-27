/**
 * Humanoid statues on the same skeleton and proportions as the living (art/body): each keeps its identity, pose and
 * material, carved at its own scale (the plaza monument stands about three times life size), with a modelled head in
 * place of a drawn face. Pedestals, braziers, inscriptions and glows stay with the props that own them.
 */
import { C, type Ctx, type Ramp } from '../shade';
import { paintBody, type BodyLook, type PaintOpts } from './paint';
import { DIMS, restPose, type Pose, type V3 } from './skeleton';

const STONE: Ramp = [C.slate, C.steel, C.mist, C.fog, C.pale];
const DARK: Ramp = [C.ink, C.g0, C.slate, C.steel];
/** the coat: a darker stone than the face and hands, as the original monument was painted */
const COAT: Ramp = [C.night, C.slate, C.steel, C.mist];
const UNDER: Ramp = STONE;

const toolDir = (pitch: number, yaw: number): V3 => [
  Math.cos(pitch) * Math.cos(yaw),
  Math.cos(pitch) * Math.sin(yaw),
  Math.sin(pitch),
];

/** QubitMan, Hadamere's founder: tricorn, red scarf, long coat with tails and gold buttons, a wand held low. */
const QUBITMAN: BodyLook = {
  body: 'male',
  skin: STONE,
  hair: DARK,
  eyes: C.slate,
  under: UNDER,
  gear: { cut: 'short', hat: 'tricorn' },
  hat: DARK,
  hatTrim: C.e3,
  // a pale shirt front with gold buttons, framed by the open coat
  top: { ramp: STONE, sleeve: 1, hem: -2, laces: C.e5, collar: true },
  vest: { ramp: COAT, hem: -2, trim: C.e3 },
  skirt: { ramp: COAT, hem: 3.2, flare: 1.8, open: true, trim: C.e3 },
  legs: { ramp: STONE, hem: 1 },
  boots: { ramp: DARK, top: 5.5 },
  belt: { ramp: [C.e0, C.e1, C.e3], buckle: C.e5 },
  scarf: [C.r0, C.r1, C.r2, C.r3],
  cape: { ramp: COAT, length: 17 },
};
function qubitmanPose(): Pose {
  const d = DIMS.male;
  const p = restPose(d);
  // weight on the back leg, the front foot turned out; wand in the right hand, left fist on the hip
  p.footL = [1.6, -d.hipHalf - 0.4, 0];
  p.footR = [-0.8, d.hipHalf + 0.3, 0];
  p.toeL = [1, -0.5, 0];
  p.pelvis = [0, 0.3, d.hipZ - 0.5];
  p.roll = -0.03;
  p.twist = 0.12;
  p.handR = [2.2, d.shoulderHalf + 1.2, d.hipZ + 0.6];
  p.handL = [-0.6, -d.shoulderHalf - 0.6, d.hipZ + 2.6];
  p.elbowL = [-0.4, -1, 0.1];
  p.tool = { hand: 'R', dir: toolDir(-1.15, 0.4) };
  return p;
}

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

export type StatueId = 'qubitman' | 'crypt' | 'garden';

/** Paint a statue's figure with its feet at (ax, ay) of a w×h canvas, facing game direction `dir`. */
export function paintStatue(
  ctx: Ctx,
  id: StatueId,
  dir: number,
  at: { w: number; h: number; ax: number; ay: number; k: number },
  material?: Ramp,
): void {
  const opts: PaintOpts = { ...at, sculpt: true };
  if (id === 'qubitman')
    paintBody(ctx, dir, qubitmanPose(), QUBITMAN, {
      ...opts,
      prop: { len: 10, ramp: [C.e0, C.e1, C.e3, C.e5], r: 0.4 },
    });
  else if (id === 'crypt') paintBody(ctx, dir, foldedPose(), CRYPT, opts);
  else paintBody(ctx, dir, offeringPose(), gardenLook(material ?? STONE), opts);
}
