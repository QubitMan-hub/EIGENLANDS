/** Authored eight-view pixel art, posed as cutout parts on the shared anatomical rig.
 * Direction changes select a painted view. They never mirror or rotate a frontal sprite.
 */
import { PALETTE } from '@eigenlands/shared';
import catalog from '../directional-people.json';
import { type Ctx, type Ramp } from '../shade';
import { headStamp, M_HAIR, M_BEARD, M_TRIM } from './headwear';
import { DIMS, REF_DIR, frameOf, project, restPose, solve, type BodyType, type Joints, type V3 } from './skeleton';
import type { BodyLook } from './paint';

const W = 64,
  H = 64;
type Point = { x: number; y: number; depth: number };
type Bone = { a: Point; b: Point; radius: number; name: string };
interface Rig {
  pixels: Uint8ClampedArray;
  masks: Uint8Array[];
  bones: Bone[];
}
const raws = new Map<string, Uint8ClampedArray>();
const rigs = new WeakMap<BodyLook, Map<number, Rig>>();
const rgb = (index: number) => {
  const n = parseInt(PALETTE[index]!.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
function bonesOf(j: Joints, dir: number): Bone[] {
  const fr = frameOf(dir),
    up = j.neck.map((v, i) => v - j.pelvis[i]!) as V3;
  const length = Math.hypot(...up) || 1;
  const bone = (name: string, a: V3, b: V3, radius: number): Bone => ({
    name,
    a: project(a, fr),
    b: project(b, fr),
    radius,
  });
  const list = [
    bone('torso', j.pelvis, j.neck, 4.2),
    bone('head', j.neck, add(j.neck, up.map((v) => (v * 8) / length) as V3), 5),
  ];
  for (const side of ['L', 'R'] as const)
    list.push(
      bone(`upper${side}`, j[`shoulder${side}`], j[`elbow${side}`], 2.4),
      bone(`fore${side}`, j[`elbow${side}`], j[`wrist${side}`], 2.3),
      bone(`thigh${side}`, j[`hip${side}`], j[`knee${side}`], 2.8),
      bone(`shin${side}`, j[`knee${side}`], j[`ankle${side}`], 2.3),
      bone(`foot${side}`, j[`ankle${side}`], j[`toe${side}`], 2.1),
    );
  return list;
}
function source(family: 'heroes' | 'commoners' | 'robes', body: BodyType, dir: number): Uint8ClampedArray {
  const key = `${family}-${body}` as keyof typeof catalog.frames,
    row = REF_DIR[dir]!,
    id = `${key}:${row}`;
  let pixels = raws.get(id);
  if (!pixels) {
    const frame = catalog.frames[key][row]!;
    pixels = new Uint8ClampedArray(W * H * 4);
    let at = 0;
    for (let i = 0; i < frame.runs.length; i += 2) {
      const n = frame.runs[i]!,
        index = frame.runs[i + 1]!,
        color = frame.palette[index]!;
      for (let k = 0; k < n; k++, at++)
        if (index) pixels.set([(color >> 16) & 255, (color >> 8) & 255, color & 255, 255], at * 4);
    }
    raws.set(id, pixels);
  }
  return pixels;
}
/** Gentle material tint: retain the artist's actual folds and highlight clusters. */
function tint(p: Uint8ClampedArray, at: number, ramp: Ramp, reference: number): void {
  const c = rgb(ramp[Math.floor(ramp.length / 2)]!);
  const value = (p[at]! + p[at + 1]! + p[at + 2]!) / 3;
  const light = Math.max(0.22, Math.min(1.65, value / reference));
  for (let k = 0; k < 3; k++) p[at + k] = Math.min(255, c[k]! * light);
}
function basePixels(look: BodyLook, dir: number): Uint8ClampedArray {
  const hero = !!look.plate,
    robe = !!look.skirt && look.skirt.hem < 7;
  const pixels = source(hero ? 'heroes' : robe ? 'robes' : 'commoners', look.body, dir).slice();
  if (look.referenceIdentity) return pixels;
  const bare = source('commoners', look.body, dir),
    fr = frameOf(dir);
  const bind = solve(DIMS[look.body], restPose(DIMS[look.body]));
  const neck = project(bind.neck, fr),
    hip = project(bind.pelvis, fr);
  // Armour keeps its authored construction, with the NPC/player's own face and hair.
  if (hero)
    for (let y = 0; y < Math.floor(neck.y - 1); y++)
      for (let x = 0; x < W; x++) {
        const at = (y * W + x) * 4;
        pixels.set(bare.subarray(at, at + 4), at);
      }
  if (hero && look.body === 'female')
    for (let y = Math.floor(neck.y - 1); y < hip.y - 2; y++)
      for (let x = 0; x < W; x++) {
        const at = (y * W + x) * 4,
          r = pixels[at]!,
          g = pixels[at + 1]!,
          b = pixels[at + 2]!;
        if (r > 120 && r > g * 1.5 && b > g * 0.65) pixels.fill(0, at, at + 4);
      }
  let top = H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pixels[(y * W + x) * 4 + 3]) top = Math.min(top, y);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const at = (y * W + x) * 4;
      if (!pixels[at + 3]) continue;
      const r = pixels[at]!,
        g = pixels[at + 1]!,
        b = pixels[at + 2]!,
        value = (r + g + b) / 3;
      if (value < 45) continue; // ink, eyes, closures and seams stay crisp
      const skin = r > g * 1.13 && r > b * 1.3 && r > 145 && g > 95;
      if (skin) tint(pixels, at, look.skin, 175);
      else if (y >= H - 9 || (y > hip.y + 5 && r > g * 1.08 && r > b * 1.15 && value < 150))
        tint(pixels, at, look.boots?.ramp ?? look.under, 70);
      else if (hero) {
        if (b > r * 1.08 || (Math.abs(r - g) < 18 && Math.abs(g - b) < 22)) tint(pixels, at, look.plate!.ramp, 125);
        else if (y > hip.y - 2 && y < hip.y + 6) tint(pixels, at, look.legs?.ramp ?? look.under, 85);
      } else if (!robe && y > neck.y + 5 && b > r * 1.04 && b > g) tint(pixels, at, look.legs?.ramp ?? look.under, 65);
      else if (!skin) {
        let ramp = look.top?.ramp ?? look.under;
        if (look.vest && Math.abs(x - neck.x) < 5 && y > neck.y + 2) ramp = look.vest.ramp;
        if (look.mantle && y < neck.y + 6) ramp = look.mantle;
        const front = dir === 0 || dir === 4 || dir === 5;
        if (front && look.apron && y > neck.y + 5 && Math.abs(x - neck.x) < 4) ramp = look.apron;
        if (front && look.sash && Math.abs(y - neck.y - 3 - (x - neck.x + 4) * 0.65) < 0.7) ramp = look.sash;
        tint(pixels, at, ramp, robe ? 80 : 145);
      }
    }
  // Headwear comes from real directional volumes, aligned to the authored bald skull.
  const hc = { x: neck.x, y: top + 4.5 };
  for (const p of headStamp(dir, look.gear, 1)) {
    const x = Math.round(hc.x + p.dx),
      y = Math.round(hc.y + p.dy);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    // Rear strands hide behind the face, not painted across it.
    const at = (y * W + x) * 4;
    if (p.depth < 0 && pixels[at + 3] && y > hc.y - 2) continue;
    const ramp = p.mat === M_HAIR ? look.hair : p.mat === M_BEARD ? (look.beard ?? look.hair) : (look.hat ?? look.hair);
    const c =
      p.mat === M_TRIM && look.hatTrim !== undefined
        ? rgb(look.hatTrim)
        : rgb(ramp[Math.min(ramp.length - 1, Math.round((p.tone * (ramp.length - 1)) / 3))]!);
    pixels.set([...c, 255], at);
  }
  return pixels;
}

function cape(pixels: Uint8ClampedArray, j: Joints, look: BodyLook, dir: number): void {
  if (!look.cape) return;
  const fr = frameOf(dir),
    up = j.neck.map((v, i) => v - j.pelvis[i]!) as V3;
  const right = j.shoulderR.map((v, i) => v - j.shoulderL[i]!) as V3;
  const ul = Math.hypot(...up) || 1,
    rl = Math.hypot(...right) || 1;
  const u = up.map((v) => v / ul) as V3,
    r = right.map((v) => v / rl) as V3;
  const f: V3 = [r[1] * u[2] - r[2] * u[1], r[2] * u[0] - r[0] * u[2], r[0] * u[1] - r[1] * u[0]];
  const top = j.shoulderL.map((v, i) => (v + j.shoulderR[i]!) / 2 - f[i]! * 2.8) as V3;
  for (let v = 0; v <= look.cape.length; v += 0.5)
    for (let across = -5.8; across <= 5.8; across += 0.5) {
      const p = top.map((n, i) => n - u[i]! * v + r[i]! * across - f[i]! * v * 0.05) as V3,
        q = project(p, fr);
      const x = Math.round(q.x),
        y = Math.round(q.y);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const fold = Math.cos(across * 1.3) * 0.08;
      const ramp = look.cape.ramp,
        index = Math.max(0, Math.min(ramp.length - 1, Math.round((0.5 + fold - across * 0.018) * (ramp.length - 1))));
      const c = rgb(look.cape.trim !== undefined && v > look.cape.length - 1 ? look.cape.trim : ramp[index]!);
      pixels.set([...c, 255], (y * W + x) * 4);
    }
}
function rigOf(look: BodyLook, dir: number): Rig {
  let views = rigs.get(look);
  if (!views) rigs.set(look, (views = new Map()));
  let rig = views.get(dir);
  if (rig) return rig;
  const pixels = basePixels(look, dir),
    bones = bonesOf(solve(DIMS[look.body], restPose(DIMS[look.body])), dir);
  const masks = bones.map(() => new Uint8Array(W * H));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const at = y * W + x;
      if (!pixels[at * 4 + 3]) continue;
      let best = Infinity,
        owner = 0;
      bones.forEach((b, i) => {
        const dx = b.b.x - b.a.x,
          dy = b.b.y - b.a.y,
          len = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - b.a.x) * dx + (y - b.a.y) * dy) / len));
        let score = Math.hypot(x - b.a.x - dx * t, y - b.a.y - dy * t) / b.radius;
        if (i === 1 && y < b.a.y - 1) score *= 0.4;
        if (score < best) {
          best = score;
          owner = i;
        }
      });
      masks[owner]![at] = 1;
    }
  // A one-pixel hidden overlap prevents joint cracks during bends.
  const expanded = masks.map((mask) => {
    const copy = mask.slice();
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const at = y * W + x;
        if (pixels[at * 4 + 3] && (mask[at - 1] || mask[at + 1] || mask[at - W] || mask[at + W])) copy[at] = 1;
      }
    return copy;
  });
  rig = { pixels, masks: expanded, bones };
  views.set(dir, rig);
  return rig;
}

export function paintDirectional(ctx: Ctx, dir: number, joints: Joints, look: BodyLook): void {
  const rig = rigOf(look, dir),
    target = bonesOf(joints, dir),
    image = ctx.getImageData(0, 0, W, H);
  image.data.fill(0);
  const rear = dir === 1 || dir === 6 || dir === 7;
  if (!rear) cape(image.data, joints, look, dir);
  const order = target.map((b, i) => ({ i, z: (b.a.depth + b.b.depth) / 2 })).sort((a, b) => a.z - b.z);
  for (const { i } of order) {
    const a = rig.bones[i]!,
      b = target[i]!;
    const sl = Math.hypot(a.b.x - a.a.x, a.b.y - a.a.y) || 1,
      tl = Math.hypot(b.b.x - b.a.x, b.b.y - b.a.y) || 1;
    const su = [(a.b.x - a.a.x) / sl, (a.b.y - a.a.y) / sl],
      tu = [(b.b.x - b.a.x) / tl, (b.b.y - b.a.y) / tl];
    const width = look.scale ?? 1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = x - b.a.x,
          dy = y - b.a.y;
        const along = ((dx * tu[0]! + dy * tu[1]!) * sl) / tl,
          across = (-dx * tu[1]! + dy * tu[0]!) / width;
        const sx = Math.round(a.a.x + su[0]! * along - su[1]! * across),
          sy = Math.round(a.a.y + su[1]! * along + su[0]! * across);
        if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
        const src = sy * W + sx;
        if (!rig.masks[i]![src]) continue;
        image.data.set(rig.pixels.subarray(src * 4, src * 4 + 4), (y * W + x) * 4);
      }
  }
  if (rear) cape(image.data, joints, look, dir);
  ctx.putImageData(image, 0, 0);
}
