/**
 * The base body and everything worn on it, painted from a solved pose.
 *
 * Every surface is sampled in the body's 3D space and projected with the game's camera into a z-buffered material
 * grid (body/grid.ts), so clothes, armour, capes and hair follow every pose and facing by construction and overlap
 * the way they would in the round: the far arm passes behind the torso, a cape hangs behind the back, a skirt hides
 * the thighs, long hair falls behind the shoulders when the figure faces the camera. The head itself is the
 * reference's hand-cleaned pixel map (body/heads.ts) so faces keep the drawn look rather than a computed one.
 *
 * Clothing is chosen by *where on the body* a sample lies (height on the torso, distance down an arm, height of a
 * leg point), which is how a shirt, a pair of trousers or a boot is cut in the first place.
 */
import { C, type Ctx, type Ramp } from '../shade';
import { Grid, lightTone } from './grid';
import { HEADS } from './heads';
import { headStamp, M_BEARD, M_EYE, M_HAIR, M_SKIN, M_TRIM, type HeadGear } from './headwear';
import {
  AX,
  AY,
  DIMS,
  REF_DIR,
  frameOf,
  project,
  solve,
  torsoAt,
  type BodyType,
  type Dims,
  type Joints,
  type Pose,
  type V3,
} from './skeleton';

export interface Garments {
  /** shirt / tunic: sleeve covers this fraction of the arm (0 sleeveless, ~0.45 short, 1 long); hem: height above the
   * hips of its lower edge (negative hangs below the waist) */
  top?: { ramp: Ramp; sleeve: number; hem: number; trim?: number; collar?: boolean; laces?: number };
  /** a vest / bodice over the top (open at the front centre unless `closed`) */
  vest?: { ramp: Ramp; hem: number; closed?: boolean; trim?: number; laces?: number };
  /** legwear: covers each leg from the hips down to `hem` (height above the ground: 1 trousers, ~6 shorts) */
  legs?: { ramp: Ramp; hem: number; cuff?: number };
  /** a hanging garment from the waist: skirt, dress, robe or coat skirts (`open` front) */
  skirt?: { ramp: Ramp; hem: number; flare: number; open?: boolean; trim?: number };
  boots?: { ramp: Ramp; top: number; trim?: number; cuff?: Ramp };
  gloves?: { ramp: Ramp; cuff: number };
  belt?: { ramp: Ramp; buckle?: number };
  /** breastplate (and pauldrons) */
  plate?: { ramp: Ramp; pauldrons?: boolean; trim?: number };
  mantle?: Ramp;
  sash?: Ramp;
  scarf?: Ramp;
  apron?: Ramp;
  cape?: { ramp: Ramp; length: number; trim?: number };
  /** glowing quantum seams (palette index) */
  glow?: number;
  /** hems, collars and buckles (palette index) */
  trim?: number;
}

export interface BodyLook extends Garments {
  body: BodyType;
  skin: Ramp;
  hair: Ramp;
  /** iris (palette index) */
  eyes: number;
  under: Ramp;
  gear: HeadGear;
  hat?: Ramp;
  hatTrim?: number;
  beard?: Ramp;
  /** < 1 for children (limbs and torso shrink, the head keeps its size) */
  scale?: number;
  glasses?: boolean;
}

type Mat = { ramp: Ramp; tone?: number; ink?: number };

const scaled = new Map<string, Dims>();
function dimsOf(body: BodyType, k = 1): Dims {
  if (k === 1) return DIMS[body];
  const key = `${body}${k}`;
  let d = scaled.get(key);
  if (!d) {
    const b = DIMS[body],
      r = Math.sqrt(k);
    const head = b.height - b.neckZ;
    d = {
      ...b,
      height: (b.height - head) * k + head,
      hipZ: b.hipZ * k,
      hipHalf: b.hipHalf * r,
      thigh: b.thigh * k,
      shin: b.shin * k,
      ankleZ: b.ankleZ * k,
      foot: b.foot * r,
      shoulderZ: b.shoulderZ * k,
      shoulderHalf: b.shoulderHalf * r,
      neckZ: b.neckZ * k,
      upperArm: b.upperArm * k,
      forearm: b.forearm * k,
      hand: b.hand * r,
      rThigh: [b.rThigh[0] * r, b.rThigh[1] * r],
      rShin: [b.rShin[0] * r, b.rShin[1] * r],
      rUpper: [b.rUpper[0] * r, b.rUpper[1] * r],
      rFore: [b.rFore[0] * r, b.rFore[1] * r],
      torso: b.torso.map(([z, w, dd]) => [z * k, w * r, dd * r] as [number, number, number]),
    };
    scaled.set(key, d);
  }
  return d;
}
export { dimsOf };

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const UNDER: Ramp = [C.night, C.slate, C.steel, C.mist];

/** Where and how large to paint: a person cell by default; statues paint larger into their own canvas. */
export interface PaintOpts {
  /** magnification (a monument is several times life size); radii and sampling follow */
  k?: number;
  /** canvas size and the ground point under the figure */
  w?: number;
  h?: number;
  ax?: number;
  ay?: number;
  /** a carved head (statues): the skull is modelled, nose and eye sockets included, instead of the drawn face */
  sculpt?: boolean;
  /** something held along the pose's tool direction (a statue's wand or sword) */
  prop?: { len: number; ramp: Ramp; r?: number; tip?: Ramp };
}

/** the current magnification, read by the surface samplers below */
let K = 1;

/**
 * Paint a body in a pose. `dir` is the game's DIR_*; returns the solved joints (for held items and effects).
 */
export function paintBody(ctx: Ctx, dir: number, pose: Pose, look: BodyLook, opts: PaintOpts = {}): Joints {
  const d = dimsOf(look.body, look.scale ?? 1);
  const j = solve(d, pose);
  const fr = frameOf(dir);
  K = opts.k ?? 1;
  const g = new Grid(opts.w, opts.h);
  const ox0 = opts.ax ?? AX,
    oy0 = opts.ay ?? AY;
  const P = (p: V3) => {
    const q = project(p, fr);
    return { x: ox0 + (q.x - AX) * K, y: oy0 + (q.y - AY) * K, depth: q.depth * K };
  };
  const skin = look.skin;

  // ── torso: stacked elliptical cross-sections along the spine, each turned with the shoulders' twist ─────────────
  const spineUp = norm(sub(j.neck, j.pelvis));
  const hipAxis = norm(sub(j.hipR, j.hipL)),
    shAxis = norm(sub(j.shoulderR, j.shoulderL));
  const shoulderH = d.shoulderZ - d.hipZ;
  const torsoPart = g.part();
  const torsoMat = (dz: number, u: number, v: number): Mat => {
    // u: across (−1 left .. 1 right), v: front (1) to back (−1)
    const gm = look;
    if (gm.glow !== undefined && gm.top && Math.abs(u) < 0.1 && v > 0.6 && dz > 0.5 && dz < shoulderH - 1)
      return { ramp: skin, ink: gm.glow };
    if (gm.sash && v > -0.2 && Math.abs(dz - (shoulderH - 1.4 - (u + 1) * 0.5 * (shoulderH - 1.4))) < 0.75)
      return { ramp: gm.sash };
    if (gm.belt && dz >= -0.3 && dz <= 0.7) {
      if (gm.belt.buckle !== undefined && v > 0.75 && Math.abs(u) < 0.22)
        return { ramp: gm.belt.ramp, ink: gm.belt.buckle };
      return { ramp: gm.belt.ramp };
    }
    if (gm.apron && v > 0.15 && dz < shoulderH - 2.5 && dz > -1.6) return { ramp: gm.apron };
    if (gm.plate && dz >= 0.9) {
      if (gm.plate.trim !== undefined && (dz < 1.5 || (v > 0.8 && Math.abs(u) < 0.12)))
        return { ramp: gm.plate.ramp, ink: gm.plate.trim };
      return { ramp: gm.plate.ramp };
    }
    if (gm.vest && dz >= gm.vest.hem && dz < shoulderH - 0.2) {
      const open = !gm.vest.closed && v > 0.55 && Math.abs(u) < 0.22;
      if (!open) {
        if (gm.vest.laces !== undefined && v > 0.6 && Math.abs(u) < 0.3 && Math.round(dz * 1.5) % 2 === 0)
          return { ramp: gm.vest.ramp, ink: gm.vest.laces };
        if (gm.vest.trim !== undefined && (dz < gm.vest.hem + 0.5 || (v > 0.6 && Math.abs(Math.abs(u) - 0.24) < 0.08)))
          return { ramp: gm.vest.ramp, ink: gm.vest.trim };
        return { ramp: gm.vest.ramp };
      }
    }
    if (gm.top && dz >= gm.top.hem) {
      if (
        gm.top.laces !== undefined &&
        v > 0.75 &&
        Math.abs(u) < 0.12 &&
        dz > shoulderH - 3.5 &&
        dz < shoulderH - 0.4 &&
        Math.round(dz * 1.25) % 2 === 0
      )
        return { ramp: gm.top.ramp, ink: gm.top.laces };
      if (gm.top.collar && dz > shoulderH - 0.9 && v > 0.3 && Math.abs(u) < 0.45) return { ramp: gm.top.ramp, tone: 3 };
      if (gm.top.trim !== undefined && dz < gm.top.hem + 0.5) return { ramp: gm.top.ramp, ink: gm.top.trim };
      return { ramp: gm.top.ramp };
    }
    if (gm.legs && dz < 0.9) return { ramp: gm.legs.ramp };
    // underwear: briefs; a chest wrap for the women's body
    if (dz < 0.9) return { ramp: look.under ?? UNDER };
    if (look.body === 'female' && dz > shoulderH - 4.6 && dz < shoulderH - 2.2 && !gm.top)
      return { ramp: look.under ?? UNDER };
    return { ramp: skin };
  };
  // the torso's top tapers into the neck; sample the cross-section table from the crotch to the shoulder tops
  const t0 = d.torso[0]![0],
    t1 = d.torso[d.torso.length - 1]![0];
  for (let dz = t0; dz <= t1 + 0.01; dz += 0.4 / K) {
    const k = Math.max(0, Math.min(1, dz / shoulderH));
    const right = norm(lerp(hipAxis, shAxis, k));
    const fwd = norm(cross(right, spineUp));
    const c = add(j.pelvis, mul(spineUp, dz));
    const [w, dd] = torsoAt(d, dz);
    ellipse(g, P, c, right, fwd, w, dd, torsoPart, (u, v) => torsoMat(dz, u, v), dz > t1 - 0.4 / K);
  }
  // the neck
  const neckPart = g.part();
  capsule(g, P, add(j.neck, mul(spineUp, -1.2)), add(j.neck, mul(spineUp, 0.8)), 1.1, 1.0, neckPart, () =>
    look.scarf ? { ramp: look.scarf } : look.plate && look.plate.pauldrons ? { ramp: look.plate.ramp } : { ramp: skin },
  );
  if (look.scarf)
    ellipse(g, P, add(j.neck, mul(spineUp, -0.6)), shAxis, norm(cross(shAxis, spineUp)), 2.1, 1.7, neckPart, () => ({
      ramp: look.scarf!,
    }));

  // mantle: a short shoulder cape over the top of the torso
  if (look.mantle) {
    const part = g.part();
    for (let dz = shoulderH - 3.2; dz <= shoulderH + 0.4; dz += 0.4 / K) {
      const right = shAxis,
        fwd = norm(cross(right, spineUp));
      const c = add(j.pelvis, mul(spineUp, dz));
      const [w, dd] = torsoAt(d, Math.min(dz, shoulderH - 0.6));
      const grow = 0.9 + (shoulderH - dz) * 0.18;
      ellipse(
        g,
        P,
        c,
        right,
        fwd,
        w + grow,
        dd + grow,
        part,
        (u, v) =>
          look.trim !== undefined && dz < shoulderH - 2.8
            ? { ramp: look.mantle!, ink: look.trim }
            : v > 0.85 && Math.abs(u) < 0.1 && dz > shoulderH - 0.8
              ? { ramp: look.mantle!, ink: C.e6 }
              : { ramp: look.mantle! },
        dz > shoulderH,
      );
    }
  }

  // ── legs ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const legMat = (z: number): Mat => {
    if (look.boots && z <= look.boots.top) {
      if (look.boots.cuff && z > look.boots.top - 0.9) return { ramp: look.boots.cuff };
      if (look.boots.trim !== undefined && z > look.boots.top - 0.6)
        return { ramp: look.boots.ramp, ink: look.boots.trim };
      return { ramp: look.boots.ramp };
    }
    if (look.legs && z >= look.legs.hem) {
      if (look.legs.cuff !== undefined && z < look.legs.hem + 0.6)
        return { ramp: look.legs.ramp, tone: look.legs.cuff };
      return { ramp: look.legs.ramp };
    }
    if (z >= d.hipZ - 1.6) return { ramp: look.under ?? UNDER };
    return { ramp: skin };
  };
  for (const side of ['L', 'R'] as const) {
    const hip = side === 'L' ? j.hipL : j.hipR,
      knee = side === 'L' ? j.kneeL : j.kneeR,
      ankle = side === 'L' ? j.ankleL : j.ankleR,
      toe = side === 'L' ? j.toeL : j.toeR;
    const part = g.part();
    capsule(g, P, hip, knee, d.rThigh[0], d.rThigh[1], part, (p) => legMat(p[2]));
    capsule(g, P, knee, ankle, d.rShin[0], d.rShin[1], part, (p) => legMat(p[2]));
    // the foot: heel under the ankle to the toes
    const heel: V3 = [
      ankle[0] - (toe[0] - ankle[0]) * 0.18,
      ankle[1] - (toe[1] - ankle[1]) * 0.18,
      Math.max(0.5, ankle[2] - d.ankleZ + 0.5),
    ];
    const fp = g.part();
    capsule(g, P, heel, toe, look.boots ? 1.0 : 0.85, look.boots ? 0.95 : 0.75, fp, (p) => legMat(Math.min(p[2], 0.5)));
  }

  // ── hanging garments: skirts, robes, coat tails (they enclose the legs, so they follow the stride) ───────────────
  if (look.skirt) {
    const sk = look.skirt;
    const part = g.part();
    const top = d.hipZ + 0.6;
    const fwd0 = norm(cross(hipAxis, [0, 0, 1]));
    for (let z = top; z >= sk.hem - 0.01; z -= 0.4 / K) {
      const k = (top - z) / Math.max(1, top - sk.hem);
      // where the legs are at this height: the cloth must contain them
      const legAt = (hip: V3, knee: V3, ankle: V3): V3 => {
        if (z >= knee[2]) return lerp(hip, knee, (hip[2] - z) / Math.max(0.01, hip[2] - knee[2]));
        return lerp(knee, ankle, Math.min(1, (knee[2] - z) / Math.max(0.01, knee[2] - ankle[2])));
      };
      const a = legAt(j.hipL, j.kneeL, j.ankleL),
        b = legAt(j.hipR, j.kneeR, j.ankleR);
      const mid = lerp(a, b, 0.5);
      const c: V3 = [j.pelvis[0] * (1 - k) + mid[0] * k, j.pelvis[1] * (1 - k) + mid[1] * k, z];
      const spreadF = Math.abs((a[0] - b[0]) * fwd0[0] + (a[1] - b[1]) * fwd0[1]) / 2;
      const spreadR = Math.abs((a[0] - b[0]) * hipAxis[0] + (a[1] - b[1]) * hipAxis[1]) / 2;
      const [w0, d0] = torsoAt(d, -1.2);
      const w = Math.max(w0 + sk.flare * k, spreadR + d.rShin[0] + 0.6),
        dd = Math.max(d0 + sk.flare * 0.8 * k, spreadF + d.rShin[0] + 0.6);
      ellipse(g, P, c, hipAxis, fwd0, w, dd, part, (u, v) => {
        if (sk.open && v > 0.7 && Math.abs(u) < 0.25 && z < top - 1.5) return null;
        if (sk.trim !== undefined && z < sk.hem + 0.5) return { ramp: sk.ramp, ink: sk.trim };
        return { ramp: sk.ramp };
      });
    }
  }

  // ── arms ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const armLen = d.upperArm + d.forearm;
  for (const side of ['L', 'R'] as const) {
    const sh = side === 'L' ? j.shoulderL : j.shoulderR,
      el = side === 'L' ? j.elbowL : j.elbowR,
      wr = side === 'L' ? j.wristL : j.wristR;
    const part = g.part();
    const armMat = (s: number): Mat => {
      if (look.gloves && s >= 1 - look.gloves.cuff) return { ramp: look.gloves.ramp };
      if (look.top && s <= look.top.sleeve) {
        if (look.top.trim !== undefined && s > look.top.sleeve - 0.08 && look.top.sleeve < 1)
          return { ramp: look.top.ramp, ink: look.top.trim };
        return { ramp: look.top.ramp };
      }
      return { ramp: skin };
    };
    capsule(g, P, sh, el, d.rUpper[0], d.rUpper[1], part, (_p, t) => armMat((t * d.upperArm) / armLen));
    capsule(g, P, el, wr, d.rFore[0], d.rFore[1], part, (_p, t) => armMat((d.upperArm + t * d.forearm) / armLen));
    // the hand: a small ball just past the wrist
    const hand = add(wr, mul(norm(sub(wr, el)), d.hand * 0.6));
    capsule(g, P, wr, hand, d.hand, d.hand, g.part(), () =>
      look.gloves ? { ramp: look.gloves.ramp } : { ramp: skin },
    );
    if (look.plate?.pauldrons) {
      const pp = g.part();
      const c = add(sh, [0, 0, 0.3]);
      sphere(g, P, c, 1.9, pp, (n) =>
        look.plate!.trim !== undefined && n[2] < -0.3
          ? { ramp: look.plate!.ramp, ink: look.plate!.trim }
          : { ramp: look.plate!.ramp },
      );
    }
  }

  // ── a held prop (statues: a wand, a sword) along the pose's tool direction ─────────────────────────────────────
  if (opts.prop && pose.tool) {
    const wr = pose.tool.hand === 'R' ? j.wristR : j.wristL,
      el = pose.tool.hand === 'R' ? j.elbowR : j.elbowL;
    const hand = add(wr, mul(norm(sub(wr, el)), d.hand * 0.6));
    const t = pose.tool.dir;
    const r = opts.prop.r ?? 0.35;
    const tip = add(hand, mul(t, opts.prop.len));
    const pp = g.part();
    capsule(g, P, add(hand, mul(t, -1.2)), tip, r, r * 0.8, pp, (_p, u) =>
      opts.prop!.tip && u > 0.9 ? { ramp: opts.prop!.tip } : { ramp: opts.prop!.ramp },
    );
  }

  // ── cape: a cloth sheet from the shoulders' back, hanging and trailing with the motion ─────────────────────────
  if (look.cape) {
    const cp = look.cape;
    const part = g.part();
    const back = mul(norm(cross(shAxis, spineUp)), -1);
    const trail = 0.6 + Math.max(0, pose.lean) * 6;
    for (let v = 0; v <= 1.0001; v += 0.04 / K)
      for (let u = -1; u <= 1.0001; u += 0.06 / K) {
        const top = add(lerp(j.shoulderL, j.shoulderR, (u + 1) / 2), mul(back, 1.6));
        const drop = v * cp.length;
        // cloth hangs under gravity, but along the body once it has tipped over (a fall, a roll)
        const down = norm(lerp([0, 0, -1], mul(spineUp, -1), Math.max(0, 1 - spineUp[2]) * 0.9));
        const p = add(add(top, mul(back, v * trail + 0.4 * Math.sin(u * 2.4) * v)), mul(down, drop));
        const widen = 1 + v * 0.25;
        const q = add(p, mul(shAxis, u * 0.4 * widen));
        const s = P(q);
        const mat = cp.trim !== undefined && v > 0.94 ? { ramp: cp.ramp, ink: cp.trim } : { ramp: cp.ramp };
        g.zset(s.x, s.y, s.depth - 0.2, part, mat.ramp, -1, mat.ink ?? -1);
      }
  }

  // ── head: the reference's pixel map with the chin on the neck, then hair, hat and beard ───────────────────────────
  const hm = HEADS[look.body][REF_DIR[dir]!]!;
  const chin = add(j.neck, mul(spineUp, 0.6));
  const centre = add(chin, mul(spineUp, 4));
  const hc = P(centre);
  const headPart = g.part();
  const x0 = Math.round(hc.x - hm.cx - 0.5),
    y0 = Math.round(hc.y) - 4;
  const toneOf: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3 };
  if (opts.sculpt || K !== 1) {
    // a carved head: skull, nose and eye sockets modelled at the figure's scale, with its hair or hat
    const ox = Math.round(hc.x - 0.5),
      oy = Math.round(hc.y);
    const parts: Record<number, number> = {};
    for (const px of headStamp(dir, look.gear, K, true)) {
      const ramp =
        px.mat === M_SKIN || px.mat === M_EYE
          ? skin
          : px.mat === M_HAIR
            ? look.hair
            : px.mat === M_BEARD
              ? (look.beard ?? look.hair)
              : (look.hat ?? look.hair);
      const part = (parts[px.mat] ??= g.part());
      const ink = px.mat === M_TRIM && look.hatTrim !== undefined ? look.hatTrim : px.mat === M_EYE ? look.eyes : -1;
      g.zset(ox + px.dx, oy + px.dy, hc.depth + px.depth, part, ramp, 10 + [0, 1, 2, 4][px.tone]!, ink);
    }
    g.render(ctx);
    return j;
  }
  if (spineUp[2] < 0.55) {
    // tumbling or lying: the drawn (upright) face would read upside down, so the head is a round skull whose crown
    // (toward the spine's up) carries the hair colour
    const a = P(centre),
      b = P(add(centre, spineUp));
    const ux = b.x - a.x,
      uy = b.y - a.y;
    const haired = !!look.gear.cut && look.gear.cut !== 'bald';
    sphere(g, P, centre, 3.6, headPart, (n) =>
      haired && n[0] * ux - n[2] * uy > -0.1 ? { ramp: look.hair } : { ramp: skin },
    );
    g.render(ctx);
    return j;
  }
  hm.rows.forEach((row, y) => {
    const e0 = row.indexOf('e'),
      e1 = row.lastIndexOf('e');
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const depth = hc.depth + 3.2;
      // spectacles: glinting lenses joined by a dark bridge
      if (look.glasses && e0 >= 0 && x >= e0 && x <= e1)
        g.zset(x0 + x, y0 + y, depth, headPart, skin, -1, ch === 'e' ? C.fog : C.night);
      else if (ch === 'e') g.zset(x0 + x, y0 + y, depth, headPart, skin, -1, look.eyes);
      else if (ch === 'b') g.zset(x0 + x, y0 + y, depth, headPart, look.hair, 0);
      else if (ch === 'm') g.zset(x0 + x, y0 + y, depth, headPart, skin, 1);
      else g.zset(x0 + x, y0 + y, depth, headPart, skin, toneOf[ch] ?? 2);
    }
  });
  const stamp = headStamp(dir, look.gear);
  if (stamp.length) {
    const hairPart = g.part(),
      hatPart = g.part(),
      beardPart = g.part();
    const ox = Math.round(hc.x - 0.5),
      oy = Math.round(hc.y);
    for (const px of stamp) {
      const ramp =
        px.mat === M_HAIR ? look.hair : px.mat === M_BEARD ? (look.beard ?? look.hair) : (look.hat ?? look.hair);
      const part = px.mat === M_HAIR ? hairPart : px.mat === M_BEARD ? beardPart : hatPart;
      const ink = px.mat === M_TRIM && look.hatTrim !== undefined ? look.hatTrim : -1;
      g.zset(ox + px.dx, oy + px.dy, hc.depth + px.depth, part, ramp, 10 + [0, 1, 2, 4][px.tone]!, ink, headPart);
    }
  }
  g.render(ctx);
  return j;
}

/** fill an elliptical cross-section (centre c, axes right/fwd with half-sizes w/dd) as a surface into the grid */
function ellipse(
  g: Grid,
  P: (p: V3) => { x: number; y: number; depth: number },
  c: V3,
  right: V3,
  fwd: V3,
  w: number,
  dd: number,
  part: number,
  mat: (u: number, v: number) => Mat | null,
  cap = false,
): void {
  const steps = Math.max(10, Math.ceil(Math.max(w, dd) * 7 * K));
  for (let i = 0; i <= steps; i++)
    for (let k = 0; k <= steps; k++) {
      const u = (i / steps) * 2 - 1,
        v = (k / steps) * 2 - 1;
      const r2 = u * u + v * v;
      if (r2 > 1) continue;
      // a stacked cross-section shows only its wall (a solid's top slice is filled with `cap`); hollow garments too,
      // so the legs inside stay visible through a hem's opening from above
      if (!cap && r2 < 0.5) continue;
      const p = add(add(c, mul(right, u * w)), mul(fwd, v * dd));
      const s = P(p);
      const m = mat(u, v);
      if (!m) continue;
      const up = cap ? Math.sqrt(Math.max(0, 1 - r2)) * 1.6 : 0.2;
      g.zset(
        s.x,
        s.y,
        s.depth,
        part,
        m.ramp,
        m.tone ?? 10 + toneOf3(P, c, add(mul(right, u / w), mul(fwd, v / dd)), up),
        m.ink ?? -1,
      );
    }
}

/** the lit tone of a cross-section sample with horizontal outward normal `n` (body space) tipped up by `up` */
function toneOf3(P: (p: V3) => { x: number; y: number; depth: number }, c: V3, n: V3, up: number): number {
  const N = norm([n[0], n[1], n[2] + up]);
  const o = P(c),
    q = P(add(c, N));
  return lightTone(q.x - o.x, q.y - o.y, q.depth - o.depth);
}

/** a round-ended limb segment from a to b (radii r0 to r1): the surface toward the camera */
function capsule(
  g: Grid,
  P: (p: V3) => { x: number; y: number; depth: number },
  a: V3,
  b: V3,
  r0: number,
  r1: number,
  part: number,
  mat: (p: V3, t: number) => Mat,
): void {
  const A = P(a),
    B = P(b);
  r0 *= K;
  r1 *= K;
  const dx = B.x - A.x,
    dy = B.y - A.y,
    l2 = Math.max(1e-6, dx * dx + dy * dy);
  const R = Math.max(r0, r1) + 1;
  for (let y = Math.floor(Math.min(A.y, B.y) - R); y <= Math.ceil(Math.max(A.y, B.y) + R); y++)
    for (let x = Math.floor(Math.min(A.x, B.x) - R); x <= Math.ceil(Math.max(A.x, B.x) + R); x++) {
      const qx = x + 0.5 - A.x,
        qy = y + 0.5 - A.y;
      const t = Math.max(0, Math.min(1, (qx * dx + qy * dy) / l2));
      const r = r0 + (r1 - r0) * t;
      const d2 = (qx - dx * t) ** 2 + (qy - dy * t) ** 2;
      if (d2 > r * r) continue;
      const p = lerp(a, b, t);
      const depth = A.depth + (B.depth - A.depth) * t + Math.sqrt(Math.max(0, r * r - d2));
      const m = mat(p, t);
      const ox = qx - dx * t,
        oy = qy - dy * t;
      g.zset(
        x,
        y,
        depth,
        part,
        m.ramp,
        m.tone ?? 10 + lightTone(ox / r, oy / r, Math.sqrt(Math.max(0, 1 - d2 / (r * r)))),
        m.ink ?? -1,
      );
    }
}

function sphere(
  g: Grid,
  P: (p: V3) => { x: number; y: number; depth: number },
  c: V3,
  r: number,
  part: number,
  mat: (n: V3) => Mat,
): void {
  const C0 = P(c);
  r *= K;
  for (let y = Math.floor(C0.y - r - 1); y <= Math.ceil(C0.y + r + 1); y++)
    for (let x = Math.floor(C0.x - r - 1); x <= Math.ceil(C0.x + r + 1); x++) {
      const qx = x + 0.5 - C0.x,
        qy = y + 0.5 - C0.y;
      const d2 = qx * qx + qy * qy;
      if (d2 > r * r) continue;
      const m = mat([qx / r, 0, -qy / r]);
      g.zset(
        x,
        y,
        C0.depth + Math.sqrt(r * r - d2) + 0.6,
        part,
        m.ramp,
        m.tone ?? 10 + lightTone(qx / r, qy / r, Math.sqrt(1 - d2 / (r * r))),
        m.ink ?? -1,
      );
    }
}
