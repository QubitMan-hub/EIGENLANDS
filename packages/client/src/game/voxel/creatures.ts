import { Scene, I3, mul, apply, type M3, type V3, type Mat, type MatFn } from '../../art/sprite';
import { creatureDefinition, type CritterKind, type Anim } from '../../art/foes';
import { PALETTE } from '@eigenlands/shared';
import { wildlifeModel } from '../../art/nature-models';
import { model as livestockModel, type FarmLook } from '../../art/livestock';
import { villageModel, type VillageAnimal } from '../../art/village-animals';
import { drawVoxelBoss, isVoxelBoss } from './bosses';
import { legendaryDef, type NewCreatureKey } from '../../art/legendary-fauna';
import { ART_RGB } from '../../art/creature-pixels';
import { ramp } from '../../art/sprite';
import { solidBox, type VoxelBox } from './mesh';
import { voxelHeight, VOXEL_PPU } from './camera';

/** Reads the authored 3D primitives BEFORE rasterization. No image or sprite data enters this pipeline. */
class VolumeScene extends Scene {
  private linear: M3 = I3;
  private offset: V3 = [0, 0, 0];
  private poses: Array<{ linear: M3; offset: V3 }> = [];
  readonly cells = new Map<string, { x: number; y: number; z: number; color: number }>();
  private step = 1.25;
  constructor() {
    super(0, 0, 0, 0, 0);
  }
  override push(r: M3, pivot: V3 = [0, 0, 0], move: V3 = [0, 0, 0]): void {
    this.poses.push({ linear: this.linear, offset: this.offset });
    const p = apply(this.linear, [pivot[0] + move[0], pivot[1] + move[1], pivot[2] + move[2]]);
    const linear = mul(this.linear, r),
      q = apply(linear, pivot);
    this.offset = [p[0] + this.offset[0] - q[0], p[1] + this.offset[1] - q[1], p[2] + this.offset[2] - q[2]];
    this.linear = linear;
  }
  override pop(): void {
    const p = this.poses.pop();
    if (p) {
      this.linear = p.linear;
      this.offset = p.offset;
    }
  }
  private cell(p: V3, color: number): void {
    const q = apply(this.linear, p);
    const [x, y, z] = q.map((v, i) => Math.round((v + this.offset[i]) / this.step));
    this.cells.set(`${x},${y},${z}`, { x, y, z, color });
  }
  override ell(c: V3, radii: V3, mat: Mat | MatFn, rot: M3 = I3): void {
    // Sample actual occupied volume, then remove interior faces when meshing.
    const step = this.step * 0.85;
    for (let x = -radii[0]; x <= radii[0]; x += step)
      for (let y = -radii[1]; y <= radii[1]; y += step)
        for (let z = -radii[2]; z <= radii[2]; z += step) {
          const q: V3 = [x / radii[0], y / radii[1], z / radii[2]];
          if (q[0] ** 2 + q[1] ** 2 + q[2] ** 2 > 1) continue;
          const m = typeof mat === 'function' ? mat(q) : mat;
          if (!m) continue;
          const p = apply(rot, [x, y, z]);
          this.cell([p[0] + c[0], p[1] + c[1], p[2] + c[2]], m.r.c[m.r.base]);
        }
    if (typeof mat !== 'function') this.cell(c, mat.r.c[mat.r.base]);
  }
  override sph(c: V3, r: number, mat: Mat | MatFn): void {
    this.ell(c, [r, r, r], mat);
  }
  override cap(a: V3, b: V3, ra: number, rb: number, mat: Mat): void {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / this.step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.sph(a.map((v, k) => v + (b[k] - v) * t) as V3, ra + (rb - ra) * t, mat);
    }
  }
  override dot(p: V3, color: number, w = 1, h = 1): void {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) this.cell([p[0] + x, p[1], p[2] + y], color);
  }
  override glowPx(p: V3, color: number, w = 1, h = 1): void {
    this.dot(p, color, w, h);
  }
  override line(a: V3, b: V3, color: number | ((t: number) => number)): void {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      this.cell(a.map((v, k) => v + (b[k] - v) * t) as V3, typeof color === 'function' ? color(t) : color);
    }
  }
  boxes(): VoxelBox[] {
    const offsets = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0, 1, 0],
      [0, -1, 0],
    ];
    const out: VoxelBox[] = [];
    for (const c of this.cells.values()) {
      let faces = 0;
      offsets.forEach(([dx, dy, dz], i) => {
        if (!this.cells.has(`${c.x + dx},${c.y + dy},${c.z + dz}`)) faces |= 1 << i;
      });
      if (faces)
        out.push(
          solidBox(
            (c.x * this.step) / VOXEL_PPU,
            voxelHeight(c.z * this.step),
            (c.y * this.step) / VOXEL_PPU,
            this.step / VOXEL_PPU,
            voxelHeight(this.step),
            this.step / VOXEL_PPU,
            c.color,
            faces,
          ),
        );
    }
    return out;
  }
}

export function creatureBoxes(kind: string, anim: Anim = 'idle', phase = 0): VoxelBox[] {
  const scene = new VolumeScene();
  if (['pirate', 'guild_guard'].includes(kind)) {
    const coat = { r: ramp(kind === 'pirate' ? 0x89604c : 0x65818b) },
      skin = { r: ramp(0xc89e7c) };
    const iron = { r: ramp(0x879a9d) },
      dark = { r: ramp(0x343b3e) };
    const stride = anim === 'move' ? Math.sin(phase * Math.PI * 2) * 3 : 0;
    scene.ell([0, 0, 16], [3, 5, 6], coat);
    scene.ell([0, 0, 26], [3.6, 3.6, 4], skin);
    for (const side of [-1, 1]) {
      scene.cap([0, side * 3, 12], [stride * side, side * 3, 1], 1.7, 1.4, dark);
      scene.cap([0, side * 6, 20], [-stride * side + 2, side * 6, 10], 1.7, 1.2, coat);
      scene.sph([3, side * 1.5, 27], 0.45, dark);
    }
    scene.cap([1, 6, 11], [7, 6, 25], 0.7, 0.4, iron);
    scene.ell([0, 0, 30], [4, 4.5, 2], kind === 'pirate' ? dark : iron);
    if (kind === 'guild_guard') scene.ell([1, -6, 14], [1, 3.8, 5.2], iron);
    return scene.boxes();
  }
  if (kind === 'serpent') {
    const body = { r: ramp(0x54897e) },
      fin = { r: ramp(0xb2c88a) },
      eye = { r: ramp(0xedd483) };
    for (let i = 0; i < 16; i++) {
      const a = i * 0.4 + phase * (anim === 'move' ? 0.4 : 0),
        x = -12 + i * 1.8,
        y = Math.sin(a) * 4;
      scene.ell([x, y, 3 + i * 0.12], [2.5, 2.7, 2.6], body);
      if (i % 2 === 0) scene.cap([x, y, 5], [x - 1, y, 8], 1, 0.1, fin);
    }
    scene.ell([18, 1, 7], [4, 3, 3], body);
    for (const side of [-1, 1]) scene.sph([20, side * 2, 8], 0.6, eye);
    return scene.boxes();
  }
  if (isVoxelBoss(kind)) {
    drawVoxelBoss(scene, kind, anim, phase);
    return scene.boxes();
  }
  if (['primordial_dragon', 'world_serpent', 'sealed_entity', 'forgotten_titan', 'realm_guardian'].includes(kind)) {
    const d = legendaryDef(kind as NewCreatureKey);
    d.draw(scene, anim, 0, phase, false);
    return scene.boxes();
  }
  if (['boar', 'wolf', 'badger'].includes(kind)) {
    const coat = { r: ramp(kind === 'wolf' ? ART_RGB.steel : kind === 'badger' ? ART_RGB.slate : ART_RGB.e2) };
    const bone = { r: ramp(ART_RGB.pale) },
      dark = { r: ramp(ART_RGB.ink) },
      eye = { r: ramp(ART_RGB.e6) };
    const gait = anim === 'move' ? Math.sin(phase * Math.PI * 2) * 2 : 0;
    const long = kind === 'wolf' ? 8 : 6,
      z = kind === 'badger' ? 4 : 7;
    scene.ell([0, 0, z], [long, 3, 3.5], coat);
    scene.ell([long, 0, z + 0.8], [3.1, 2.7, 2.8], coat);
    scene.ell([long + 2.8, 0, z - 0.1], [2, 1.8, 1.4], coat);
    scene.sph([long + 4, 0, z], 0.6, dark);
    for (const side of [-1, 1]) {
      for (const x of [-long + 2, long - 2])
        scene.cap([x, side * 2, z], [x + gait * side, side * 2, 0.6], 0.9, 0.7, coat);
      scene.cap(
        [long - 0.8, side * 1.5, z + 2],
        [long - 1.1, side * 2, z + (kind === 'wolf' ? 6 : 3.4)],
        0.9,
        0.2,
        coat,
      );
      scene.sph([long + 1.8, side * 2, z + 1.6], 0.45, eye);
      if (kind === 'boar') scene.cap([long + 2.5, side * 2, z - 1], [long + 4, side * 2.5, z + 2], 0.6, 0.1, bone);
      if (kind === 'badger')
        scene.cap([long - 0.5, side * 1.4, z + 2], [long + 3, side * 0.9, z + 0.8], 0.7, 0.5, bone);
    }
    scene.cap([-long, 0, z + 1], [-long - 4, 0, z + (kind === 'wolf' ? 0 : 1)], 1.1, 0.4, coat);
    return scene.boxes();
  }
  const def = creatureDefinition(kind as CritterKind);
  if (def) def.draw(scene, anim, Math.floor(phase * def.n[anim]), phase, false);
  return scene.boxes();
}

export function animalBoxes(id: string, season: number, frame = 0): VoxelBox[] {
  const farm = ['cow', 'sheep', 'pig', 'horse', 'goat', 'chicken', 'duck', 'turkey'].includes(id);
  const village = ['cat', 'dog', 'pigeon'].includes(id);
  const prims = village
    ? villageModel(id as VillageAnimal, frame)
    : farm
      ? livestockModel(id as FarmLook, frame, false)
      : wildlifeModel(id, frame, season);
  const scene = new VolumeScene();
  // SDF library uses palette indices and its own a,b,z model coordinates.
  for (const p of prims) {
    const [x0, y0, z0, x1, y1, z1] = p.box;
    for (let x = x0; x <= x1; x += 1.25)
      for (let y = y0; y <= y1; y += 1.25)
        for (let z = z0; z <= z1; z += 1.25)
          if (p.d(x, y, z) <= 0) {
            const ramp = p.ramp(x, y, z),
              color = PALETTE[ramp[Math.floor(ramp.length / 2)]];
            scene.dot([x * Math.SQRT2, y * Math.SQRT2, z], Number.parseInt(color.slice(1), 16));
          }
  }
  return scene.boxes();
}
