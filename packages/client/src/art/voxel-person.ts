/**
 * Voxel people: every player, resident, guard and knight is one rigged 3D figure (voxrig.ts) in heroic chibi
 * proportions, about four heads tall: a big head with expressive eyes and full hair, broad shoulders, a belted waist,
 * sturdy legs and chunky boots. An Outfit (actors.ts) picks the colours and the parts: hair style, hat, beard, vest,
 * plate, mantle, cape, apron, scarf, sash, skirts.
 *
 * Model space: a forward (the way the figure faces), b to its left, z up; one unit is one art pixel. The ground
 * under the feet is the origin and lands at the frame's anchor (16, 45) in a 32 × 48 cell.
 *
 * Animation comes from the same frame numbers as before: 0 and 9 idle (breathing), 1–8 walk, 10–13 strike,
 * 14–21 run, 22–25 shoot, 26–29 cast, and the action clips (person-actions.ts) from 30 on. The weapon hand reaches
 * the shared grip point, so held weapons and tools line up exactly as they did.
 */
import type { Outfit } from './actors';
import { actionPose } from './person-actions';
import { C, type Ctx } from './shade';
import { capsule, ellipsoid, rbox, type Prim, type Ramp } from './voxel';
import {
  buildPart,
  drawFigure,
  hang,
  ik,
  I3,
  mul,
  rotA,
  rotB,
  rotZ,
  type M3,
  type Part,
  type Placed,
  type V3,
} from './voxrig';

// ───────────────────────── proportions ─────────────────────────
const HIP_Z = 13.6; // hip joints
const THIGH = 5.6; // hip to knee
const SHIN = 8.2; // knee to sole (the boot is part of the shin)
const WAIST_Z = 15.2; // torso pivot
const NECK_Z = 25.2; // head pivot
const SHOULDER: V3 = [0, 5.7, 23.2]; // left shoulder (mirror b for the right)
const UPPER = 4.8;
const FORE = 5.4; // elbow to the middle of the hand
const HIP_B = 2.25;

const single = (c: number): Ramp => [c, c, c, c];
const darker = (r: Ramp): Ramp => [r[0]!, r[0]!, r[1] ?? r[0]!, r[2] ?? r[1]!];

interface Rig {
  pelvis: Part;
  torso: Part;
  head: Part;
  upperL: Part;
  upperR: Part;
  foreL: Part;
  foreR: Part;
  thighL: Part;
  thighR: Part;
  shinL: Part;
  shinR: Part;
  cape: Part | null;
  skirt: Part | null;
}

const rigs = new WeakMap<Outfit, Rig>();

function rigOf(o: Outfit): Rig {
  let r = rigs.get(o);
  if (!r) {
    r = buildRig(o);
    rigs.set(o, r);
  }
  return r;
}

function buildRig(o: Outfit): Rig {
  const skin = o.skin,
    shirt = o.shirt,
    pants = o.pants,
    boots = o.boots,
    hair = o.hair,
    trim = single(o.trim ?? shirt[1]!);
  const metal = o.plate ?? (o.dress === 'plated' ? shirt : null);
  const leather = darker(boots.length > 2 ? boots.slice(1) : boots);

  // ── pelvis: hips and a belt with a buckle
  const pelvis = buildPart(
    [rbox([0, 0, -0.4], [2.3, 3.9, 1.9], 1.1, pants), rbox([0, 0, 1.1], [2.5, 4.1, 0.75], 0.4, leather)],
    [rbox([2.4, 0, 1.1], [0.5, 0.8, 0.6], 0.1, trim), rbox([0.6, -3.9, 0.2], [1.2, 0.5, 1.4], 0.2, leather)],
  );

  // ── torso: chest, shoulders, neck; vest, breastplate, mantle and scarf sit over it
  const torsoPrims: Prim[] = [
    rbox([0.2, 0, 4.6], [2.6, 4.7, 4.6], 1.9, shirt),
    ellipsoid([0, 0, 9.4], [1.3, 1.3, 1.2], skin),
  ];
  if (o.vest) torsoPrims.push(rbox([0.45, 0, 4.4], [2.45, 4, 4], 1.6, o.vest));
  if (metal) {
    torsoPrims.push(rbox([0.5, 0, 5.2], [2.5, 4.2, 3.6], 1.6, metal));
    torsoPrims.push(
      ellipsoid([0, 4.7, 7.6], [2.4, 2.1, 1.7], metal),
      ellipsoid([0, -4.7, 7.6], [2.4, 2.1, 1.7], metal),
    );
  }
  if (o.mantle || o.dress === 'mantle') {
    const m = o.mantle ?? shirt;
    torsoPrims.push(ellipsoid([-0.2, 0, 7.8], [3.2, 5.6, 1.6], m));
  }
  if (o.scarf) torsoPrims.push(rbox([0.2, 0, 9], [1.9, 2.1, 0.8], 0.6, o.scarf));
  if (o.apron) torsoPrims.push(rbox([2.55, 0, 2.6], [0.4, 3, 3.4], 0.2, o.apron));
  const torsoDecals: Prim[] = [];
  if (!metal && !o.vest) torsoDecals.push(rbox([2.6, 0, 7.4], [0.5, 1.4, 1.2], 0.2, single(skin[2]!))); // open collar
  if (o.sash) torsoDecals.push(capsule([2.4, 3.6, 8.2], [2.4, -3.4, 0.8], 0.9, o.sash));
  if (o.glow) torsoDecals.push(rbox([2.65, 1.6, 4], [0.3, 0.3, 2.4], 0.1, single(o.glow)));
  const torso = buildPart(torsoPrims, torsoDecals);

  // ── head: a big rounded head with the face painted on, hair and hat as solid shapes
  const headPrims: Prim[] = [rbox([0.2, 0, 5.4], [4.2, 4.4, 4.6], 2.5, skin)];
  const ear = (s: number) => ellipsoid([0, 4.4 * s, 5], [0.9, 0.6, 1.2], skin);
  headPrims.push(ear(1), ear(-1));
  const style = o.hairStyle ?? (o.longHair ? 'long' : 'short');
  const hatted = !!o.hat && (o.hatStyle === 'helm' || o.hatStyle === 'hood');
  if (style !== 'bald' && !hatted) {
    // the cap of hair over the crown and back, a fringe over the brow
    headPrims.push(ellipsoid([-0.5, 0, 7.3], [4.9, 5, 3.6], hair));
    headPrims.push(rbox([-2.2, 0, 4.8], [2.2, 4.8, 3.4], 1.8, hair));
    headPrims.push(rbox([3.5, 0.6, 8.3], [1.3, 4.3, 1.2], 0.8, hair));
    if (style === 'spiky')
      for (const [a, b] of [
        [1.4, 0],
        [-0.8, 2.6],
        [-0.8, -2.6],
        [-2.6, 0],
        [2.4, 2.4],
        [2.4, -2.4],
      ] as Array<[number, number]>)
        headPrims.push(capsule([a * 0.6, b * 0.6, 8.6], [a, b, 12.2], 1.5, hair, 0.3));
    if (style === 'swept') headPrims.push(capsule([3.4, -3, 9], [2.6, 3.6, 10.6], 1.4, hair, 0.9));
    if (style === 'curly')
      for (let i = 0; i < 9; i++) {
        const t = (i / 9) * Math.PI * 2;
        headPrims.push(
          ellipsoid([Math.cos(t) * 3.2 - 0.8, Math.sin(t) * 3.6, 8.8 + (i % 2) * 0.8], [1.8, 1.8, 1.6], hair),
        );
      }
    if (style === 'long') headPrims.push(rbox([-3, 0, 1.6], [1.6, 4.6, 5.4], 1.4, hair));
    if (style === 'ponytail') {
      headPrims.push(ellipsoid([-4.2, 0, 7.4], [1.6, 1.6, 1.6], hair));
      headPrims.push(capsule([-4.8, 0, 7], [-5.6, 0, -1.2], 1.4, hair, 0.8));
      headPrims.push(rbox([-4.4, 0, 7.4], [0.5, 1.2, 0.5], 0.2, trim));
    }
    if (style === 'bun') headPrims.push(ellipsoid([-3.4, 0, 9.6], [2, 2, 1.8], hair));
    if (style === 'topknot') headPrims.push(ellipsoid([-0.8, 0, 11.6], [1.7, 1.7, 1.9], hair));
    if (style === 'braids' || style === 'twintail')
      for (const s of [1, -1]) {
        headPrims.push(capsule([-1.6, 4.5 * s, 5], [-1.8, 5.2 * s, style === 'braids' ? -3 : -1], 1.2, hair, 0.8));
        headPrims.push(ellipsoid([-1.8, 5.2 * s, style === 'braids' ? -3.4 : -1.4], [0.8, 0.8, 0.7], trim));
      }
  }
  if (o.beard) headPrims.push(rbox([3.2, 0, 2], [1.6, 3.6, 2.2], 1.4, o.beard));
  if (o.hat) {
    const h = o.hat,
      hs = o.hatStyle ?? 'cap';
    if (hs === 'helm') {
      headPrims.push(rbox([0.2, 0, 6.4], [4.8, 4.9, 5.2], 2.6, h));
      headPrims.push(rbox([-0.4, 0, 11.4], [3.6, 0.7, 1.2], 0.5, darker(h))); // crest
    } else if (hs === 'hood') {
      const hood = ellipsoid([-0.7, 0, 6.6], [5.4, 5.4, 6], h);
      const d0 = hood.d;
      hood.d = (a, b, z) => Math.max(d0(a, b, z), -(3.6 - a)); // open in front
      headPrims.push(hood, rbox([-2.6, 0, 0.4], [2, 4.4, 2], 1.2, h));
    } else if (hs === 'brim') {
      headPrims.push(rbox([-0.2, 0, 9.4], [3.6, 3.8, 1.9], 1.4, h));
      headPrims.push(rbox([0, 0, 7.8], [6.6, 6.6, 0.45], 0.4, h));
    } else if (hs === 'beret') headPrims.push(ellipsoid([-0.4, 0.6, 9.4], [4.8, 5, 1.8], h));
    else if (hs === 'cap') {
      headPrims.push(ellipsoid([-0.4, 0, 8.6], [4.6, 4.8, 2.8], h));
      headPrims.push(rbox([4.4, 0, 7.6], [1.8, 3.4, 0.35], 0.3, h));
    } else if (hs === 'bandana' || hs === 'circlet' || hs === 'crown') {
      headPrims.push(rbox([0.2, 0, 8.2], [4.5, 4.6, 0.75], 0.6, h));
      if (hs === 'crown')
        for (const [a, b] of [
          [3.8, 0],
          [2.6, 3],
          [2.6, -3],
          [-1, 4],
          [-1, -4],
        ] as Array<[number, number]>)
          headPrims.push(capsule([a, b, 8.6], [a, b, 10.8], 0.6, h, 0.35));
    }
  }
  const headDecals: Prim[] = [];
  const helm = o.hat && o.hatStyle === 'helm';
  if (helm) {
    headDecals.push(rbox([4.9, 0, 5.4], [0.8, 3.2, 0.5], 0.1, single(C.ink))); // visor slit
  } else {
    const iris = o.eyes ?? C.night;
    for (const s of [1, -1]) {
      headDecals.push(rbox([4.2, 1.85 * s, 4.9], [0.9, 0.95, 1.2], 0.2, single(C.white)));
      headDecals.push(rbox([4.35, 1.5 * s, 4.75], [0.9, 0.45, 1.0], 0.1, single(iris)));
      headDecals.push(rbox([4.4, 1.45 * s, 5.2], [0.9, 0.25, 0.3], 0.1, single(C.ink)));
      headDecals.push(rbox([4.2, 2 * s, 6.6], [0.9, 1.1, 0.32], 0.1, single(hair[0]!))); // brows
    }
    if (!o.beard) headDecals.push(rbox([4.3, 0, 2.6], [0.8, 0.9, 0.3], 0.1, single(skin[0]!))); // mouth
    if (o.moustache) headDecals.push(rbox([4.3, 0, 3.3], [0.9, 1.7, 0.4], 0.1, single((o.beard ?? hair)[1]!)));
    if (o.glasses)
      for (const s of [1, -1]) headDecals.push(rbox([4.6, 1.9 * s, 4.9], [0.6, 1.3, 1.4], 0.1, single(C.steel)));
    headDecals.push(rbox([4.6, 0, 3.7], [0.6, 0.45, 0.6], 0.2, single(skin[1]!))); // nose shade
  }
  if (o.headband !== undefined) headDecals.push(rbox([0.2, 0, 7.4], [5, 5, 0.5], 0.1, single(o.headband)));
  if (o.hat && o.hatStyle === 'circlet')
    headDecals.push(rbox([4.7, 0, 8.3], [0.5, 0.5, 0.6], 0.1, single(o.glow ?? C.q6)));
  const head = buildPart(headPrims, headDecals);

  // ── arms: sleeve, then forearm with a cuff and a hand
  const cuff = metal ?? (o.trim !== undefined ? trim : leather);
  const upper = (s: number) => {
    const p: Prim[] = [capsule([0, 0, 0], [0, 0, -UPPER], 1.7, shirt, 1.5)];
    if (metal) p.push(ellipsoid([0, 0.5 * s, -0.4], [2.1, 2, 1.8], metal));
    return buildPart(p);
  };
  const fore = () =>
    buildPart([
      capsule([0, 0, 0], [0, 0, -FORE + 1.2], 1.4, shirt, 1.3),
      capsule([0, 0, -2], [0, 0, -FORE + 1.4], 1.6, cuff, 1.55),
      ellipsoid([0.2, 0, -FORE], [1.4, 1.35, 1.5], skin),
    ]);

  // ── legs: thigh, then shin with a chunky boot (sole at the end of the shin)
  const thigh = () => buildPart([capsule([0, 0, 0], [0, 0, -THIGH], 2.05, pants, 1.9)]);
  const shin = () =>
    buildPart(
      [
        capsule([0, 0, 0], [0, 0, -4.2], 1.85, pants, 1.8),
        rbox([0.7, 0, -5.9], [2.6, 2.05, 2.3], 1, boots),
        rbox([0.1, 0, -3.7], [2.15, 2.2, 0.6], 0.4, darker(boots)), // cuff
      ],
      [rbox([0.7, 0, -8], [2.7, 2.15, 0.35], 0.1, single(boots[0]!))], // sole
    );

  // ── cape and skirts
  const cape = o.cape ? buildPart([rbox([0, 0, -5.6], [0.45, 4.3, 6.4], 0.4, o.cape)]) : null;
  const long = o.dress === 'robe' ? 10.6 : o.dress === 'coat' ? 6.6 : 0;
  const skirt = long
    ? (() => {
        const sk = rbox([0, 0, -long / 2], [2.8, 4.4, long / 2], 1.2, o.dress === 'robe' ? shirt : (o.vest ?? shirt));
        const d0 = sk.d;
        // flared: wider toward the hem
        sk.d = (a, b, z) => {
          const f = 1 + Math.max(0, -z) * 0.05;
          return d0(a / f, b / f, z);
        };
        sk.box = [-4, -6, -long - 0.5, 4, 6, 0.5];
        return buildPart([sk]);
      })()
    : null;

  return {
    pelvis,
    torso,
    head,
    upperL: upper(1),
    upperR: upper(-1),
    foreL: fore(),
    foreR: fore(),
    thighL: thigh(),
    thighR: thigh(),
    shinL: shin(),
    shinR: shin(),
    cape,
    skirt,
  };
}

// ───────────────────────── posing ─────────────────────────

/** screen facing of the eight directions (actors.ts DIR_*) */
const FACING: Array<[number, number]> = [
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
  [-0.894, 0.447],
  [0.894, 0.447],
  [-0.894, -0.447],
  [0.894, -0.447],
];
/** world heading (radians from +u toward +v) of a screen direction */
export function headingOf(dir: number): number {
  const [sx, sy] = FACING[((dir % 8) + 8) % 8]!;
  return Math.atan2((2 * sy - sx) / 2, (sx + 2 * sy) / 2);
}

const AX = 16,
  AY = 45;

/** a screen point (cell pixels) to the model-space point in the view plane through `through`, `toward` nearer */
function unproject(sx: number, sy: number, through: V3, heading: number, toward: number): V3 {
  const ch = Math.cos(heading),
    sh = Math.sin(heading);
  const u0 = through[0] * ch - through[1] * sh,
    v0 = through[0] * sh + through[1] * ch,
    z0 = through[2];
  const Dx = sx - AX - (u0 - v0),
    Dy = sy - AY - ((u0 + v0) / 2 - z0);
  const s = (Dy + toward) / 1.5;
  const dz = toward - s,
    du = (s + Dx) / 2,
    dv = (s - Dx) / 2;
  const u = u0 + du,
    v = v0 + dv;
  // back from world to model
  return [u * ch + v * sh, -u * sh + v * ch, z0 + dz];
}

interface Pose {
  hip: V3; // pelvis position (between the hip joints)
  pelvisR: M3;
  torsoR: M3; // about the waist
  headR: M3;
  footL: V3;
  footR: V3;
  handL: V3;
  handR: V3;
  /** the whole figure: a fall, a seat */
  global: M3;
  globalT: V3;
  sitting: boolean;
}

function posed(dir: number, frame: number, o: Outfit, grip: { x: number; y: number }, heading: number): Pose {
  const work = actionPose(dir, frame);
  const running = frame >= 14 && frame <= 21,
    walking = frame >= 1 && frame <= 8;
  const swimming = work?.action === 'swim';
  const phase = swimming ? work.phase * Math.PI * 2 : ((running ? frame - 14 : frame - 1) * Math.PI) / 4;
  const moving = running || walking;
  const stride = moving ? Math.sin(phase) : 0,
    lift = moving ? Math.cos(phase) : 0;
  const crouch = (work?.crouch ?? 0) * 1.1 + (frame >= 22 && frame < 30 ? 0.4 : 0);
  // a breathing idle (frames 0 and 9), a walk bob, a deeper run bob
  const bob = moving ? Math.abs(Math.sin(phase * 2)) * (running ? 0.9 : 0.4) : frame === 9 ? -0.35 : 0;
  // knees stay a little soft; striding legs lower the hips so the feet can reach the ground
  const hipZ = HIP_Z - 0.5 - crouch + bob - (running ? 1.4 : walking ? 0.7 : 0);
  const lean = running
    ? 0.26
    : walking
      ? 0.06
      : work && ['slash', 'thrust', 'cleave', 'mine', 'chop'].includes(work.action)
        ? 0.12
        : 0;
  const sitting = work?.action === 'sit';
  const span = running ? 5.6 : 4.2;
  const foot = (s: number): V3 => {
    if (sitting) return [5.6, HIP_B * s, 0.6];
    const sw = stride * (s > 0 ? 1 : -1);
    const raised = Math.max(0, lift * (s > 0 ? 1 : -1));
    return [sw * span, HIP_B * s * 1.05, raised * (running ? 3.2 : 1.9)];
  };
  // hands: the weapon (right) hand reaches the shared grip; the left swings, or supports a two-handed action
  const sR: V3 = [0, -SHOULDER[1], SHOULDER[2] - crouch + bob];
  const sL: V3 = [0, SHOULDER[1], SHOULDER[2] - crouch + bob];
  const handR = unproject(grip.x, grip.y, sR, heading, 2.2);
  let handL: V3 = [-stride * 4 + 0.6, SHOULDER[1] + 1, sL[2] - 9.6];
  if (running) handL = [-stride * 5 + 1.6, SHOULDER[1] + 0.6, sL[2] - 6.4];
  if (work && work.action !== 'swim')
    handL = unproject(work.supportX * 1.25 + 0.375, work.supportY * 1.5, sL, heading, 1.4);
  else if (frame >= 22 && frame < 30)
    handL = unproject(grip.x + FACING[dir]![0] * 3, grip.y + FACING[dir]![1] * 3, sL, heading, 1.4);
  if (swimming) handL = [Math.cos(phase) * 4, SHOULDER[1] + 1.4, sL[2] - 3 + Math.sin(phase) * 2];
  let global: M3 = I3;
  let globalT: V3 = [0, 0, 0];
  if (work?.action === 'death') {
    // topple backward onto the ground
    const t = Math.min(1, work.phase * 1.2) * (Math.PI / 2) * 0.96;
    global = rotB(-t);
    globalT = [-Math.sin(t) * 2, 0, Math.sin(t) * 3.4];
  }
  return {
    hip: [0, 0, sitting ? 6.2 : hipZ],
    pelvisR: I3,
    torsoR: rotB(lean),
    headR: mul(rotB(-lean * 0.5), rotZ(work?.action === 'talk' ? 0.15 : 0)),
    footL: foot(1),
    footR: foot(-1),
    handL,
    handR,
    global,
    globalT,
    sitting,
  };
}

/** the limbs between two joints: upper part from a to j, lower part from j to b */
function limb(upper: Part, lower: Part, a: V3, j: V3, b: V3, out: Placed[]): void {
  out.push({ part: upper, R: hang([j[0] - a[0], j[1] - a[1], j[2] - a[2]]), T: a });
  out.push({ part: lower, R: hang([b[0] - j[0], b[1] - j[1], b[2] - j[2]]), T: j });
}

/**
 * Paint one frame of a voxel person into a 32 × 48 cell.
 */
export function paintVoxelPerson(
  ctx: Ctx,
  dir: number,
  frame: number,
  o: Outfit,
  grip: { x: number; y: number; angle: number },
  w = 32,
  h = 48,
): void {
  const rig = rigOf(o);
  const heading = headingOf(dir);
  const p = posed(dir, frame, o, grip, heading);
  const placed: Placed[] = [];
  const hip = p.hip;
  placed.push({ part: rig.pelvis, R: p.pelvisR, T: hip });
  const waist: V3 = [hip[0], hip[1], hip[2] + (WAIST_Z - HIP_Z)];
  placed.push({ part: rig.torso, R: p.torsoR, T: waist });
  // the torso's lean carries the shoulders and the neck with it
  const fromWaist = (v: V3): V3 => {
    const r = [v[0] - waist[0], v[1] - waist[1], v[2] - waist[2]] as V3;
    const m = p.torsoR;
    return [
      waist[0] + m[0] * r[0] + m[1] * r[1] + m[2] * r[2],
      waist[1] + m[3] * r[0] + m[4] * r[1] + m[5] * r[2],
      waist[2] + m[6] * r[0] + m[7] * r[1] + m[8] * r[2],
    ];
  };
  const neck = fromWaist([0, 0, hip[2] + (NECK_Z - HIP_Z)]);
  placed.push({ part: rig.head, R: mul(p.torsoR, p.headR), T: neck });
  if (rig.cape) placed.push({ part: rig.cape, R: mul(p.torsoR, rotB(-0.08)), T: fromWaist([-2.9, 0, hip[2] + 9.4]) });
  if (rig.skirt) placed.push({ part: rig.skirt, R: I3, T: [hip[0], hip[1], hip[2] + 0.6] });
  // legs
  for (const s of [1, -1]) {
    const root: V3 = [hip[0], HIP_B * s, hip[2] - 0.4];
    const f = s > 0 ? p.footL : p.footR;
    const knee = ik(root, f, THIGH, SHIN, [1, 0.1 * s, 0]);
    limb(s > 0 ? rig.thighL : rig.thighR, s > 0 ? rig.shinL : rig.shinR, root, knee, f, placed);
  }
  // arms
  for (const s of [1, -1]) {
    const sh = fromWaist([SHOULDER[0], SHOULDER[1] * s, hip[2] + (SHOULDER[2] - HIP_Z)]);
    const hand = s > 0 ? p.handL : p.handR;
    const elbow = ik(sh, hand, UPPER, FORE, [-0.6, 0.5 * s, -0.2]);
    limb(s > 0 ? rig.upperL : rig.upperR, s > 0 ? rig.foreL : rig.foreR, sh, elbow, hand, placed);
  }
  const k = 1 - (o.shorten ?? 0) / 14;
  drawFigure(ctx, w, h, placed, heading, AX, AY, k, p.global, p.globalT);
}

/** the eight headings' model rotation (exported for tests and previews) */
export const PERSON_ANCHOR = { x: AX, y: AY };
void rotA;
