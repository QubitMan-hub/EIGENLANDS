import {
  Group,
  Mesh,
  SkinnedMesh,
  Skeleton,
  Vector3,
  Matrix4,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  type BufferGeometry,
  type MeshStandardMaterial,
  Sphere,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { unpackAppearance, PALETTE, ITEMS } from '@eigenlands/shared';
import { voxelItemBoxes } from './items';
import { OUTFITS, NPC_LOOKS } from '../../art/actors';
import { outfitFromAppearance } from '../../art/appearance';
import { lookOf } from '../../art/body/outfit';
import { modelGeometry, solidBox as B, type VoxelBox } from './mesh';
import { P } from './models';
import { cloneEssentialRig, EssentialAnimator, type EssentialMotion, type EssentialClip } from './essential-rig';

export interface PersonRig {
  root: Group;
  gear: Group;
  offhand: Group;
  animator: EssentialAnimator;
  body: SkinnedMesh;
  update(now: number, motion: EssentialMotion): void;
  sample(clip: EssentialClip, time: number): void;
  dispose(): void;
}

/** The uploaded FBXs contain joints, not a mesh. Solid voxel anatomy binds rigidly to those exact 25 joints. */
export function personRig(
  app: number,
  look: number,
  weapon: string,
  shield: string,
  material: MeshStandardMaterial,
  parts?: string,
  npcId?: string,
  role?: string,
): PersonRig {
  const { scene, bones, clips } = cloneEssentialRig();
  const a = unpackAppearance(app);
  if (a && parts) {
    try {
      a.parts = JSON.parse(parts);
    } catch {
      /* Validated by the server. */
    }
  }
  const outfit = (role ? OUTFITS[2] : npcId && NPC_LOOKS[npcId]) || OUTFITS[look % OUTFITS.length] || OUTFITS[0];
  const dressed = lookOf(a ? outfitFromAppearance(outfit, a, look === 0) : outfit);
  const rgb = (index: number | undefined, fallback: number) =>
    index === undefined ? fallback : Number.parseInt(PALETTE[index].slice(1), 16);
  const tone = (r: readonly number[] | undefined, fallback: number) => rgb(r?.[Math.floor(r.length * 0.65)], fallback);
  const skin = tone(dressed.skin, 0xd6ad89),
    hair = tone(dressed.hair, 0x714c35),
    cloth = role === 'pirate' ? 0x89604c : role === 'guild_guard' ? 0x65818b : tone(dressed.top?.ramp, 0x648f9d),
    trim = rgb(dressed.trim, P.gold);
  const pants = tone(dressed.legs?.ramp, 0x494b4b),
    boots = tone(dressed.boots?.ramp, P.bark);
  const bone = (name: string) => {
    const b = bones.find((b) => b.name === name);
    if (!b) throw new Error(`Missing source joint: ${name}`);
    return b;
  };
  const point = (name: string) => bone(name).getWorldPosition(new Vector3());
  const forward = point('LeftToe_End')
    .sub(point('LeftFoot'))
    .add(point('RightToe_End').sub(point('RightFoot')));
  forward.y = 0;
  forward.normalize();
  const up = new Vector3(0, 1, 0),
    fragments: BufferGeometry[] = [],
    owned: BufferGeometry[] = [];
  const frame = (start: Vector3, end: Vector3) => {
    const y = end.clone().sub(start).normalize();
    const z = forward.clone().addScaledVector(y, -forward.dot(y)).normalize();
    const x = y.clone().cross(z).normalize();
    return new Matrix4().makeBasis(x, y, z).setPosition(start);
  };
  const add = (name: string, boxes: VoxelBox[], transform: Matrix4) => {
    const geometry = modelGeometry(boxes);
    geometry.applyMatrix4(transform);
    const count = geometry.getAttribute('position').count,
      index = bones.indexOf(bone(name));
    const indices = new Uint16Array(count * 4),
      weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      indices[i * 4] = index;
      weights[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    fragments.push(geometry);
  };
  const segment = (name: string, end: string, width: number, depth: number, color: number) => {
    const p = point(name),
      q = point(end),
      len = p.distanceTo(q);
    add(name, [B(0, len / 2, 0, width, len * 0.96, depth, color)], frame(p, q));
  };
  segment('Hips', 'Spine', 0.27, 0.18, cloth);
  segment('Spine', 'Spine1', 0.27, 0.18, cloth);
  segment('Spine1', 'Spine2', 0.3, 0.2, cloth);
  segment('Spine2', 'Neck', 0.32, 0.21, cloth);
  segment('Neck', 'Head', 0.105, 0.11, skin);
  const pelvisFrame = frame(point('Hips'), point('Spine'));
  add(
    'Hips',
    [
      B(0, -0.045, 0, 0.29, 0.15, 0.19, pants),
      B(0, 0.015, 0, 0.29, 0.045, 0.2, P.bark),
      B(0, 0.015, 0.11, 0.07, 0.05, 0.035, trim),
    ],
    pelvisFrame,
  );
  const headP = point('Head'),
    headEnd = point('HeadTop_End'),
    headLength = headP.distanceTo(headEnd);
  const headFrame = frame(headP, headEnd),
    headBoxes = [
      B(0, headLength * 0.5, 0, 0.225, headLength * 0.9, 0.22, skin),
      B(0, headLength * 0.94, -0.012, 0.24, 0.06, 0.24, hair),
      B(0, headLength * 0.65, -0.115, 0.235, headLength * 0.55, 0.035, hair),
      B(-0.126, headLength * 0.48, 0, 0.035, 0.07, 0.065, skin),
      B(0.126, headLength * 0.48, 0, 0.035, 0.07, 0.065, skin),
      B(-0.052, headLength * 0.57, 0.116, 0.025, 0.028, 0.018, 0x302c2b),
      B(0.052, headLength * 0.57, 0.116, 0.025, 0.028, 0.018, 0x302c2b),
      B(0, headLength * 0.44, 0.128, 0.035, 0.05, 0.04, skin),
      B(0, headLength * 0.26, 0.116, 0.06, 0.012, 0.014, 0x936348),
    ];
  if ((a?.hairStyle ?? 0) % 4 === 1)
    headBoxes.push(B(0, headLength * 0.3, -0.13, 0.24, headLength * 0.85, 0.065, hair));
  if (dressed.beard) headBoxes.push(B(0, headLength * 0.18, 0.08, 0.19, 0.11, 0.12, tone(dressed.beard, hair)));
  if (dressed.gear.hat) {
    const c = tone(dressed.hat, P.iron),
      name = String(dressed.gear.hat);
    headBoxes.push(
      B(0, headLength + 0.015, 0, 0.28, 0.065, 0.27, c),
      B(0, headLength + 0.075, -0.01, 0.24, 0.09, 0.23, c),
    );
    if (/wizard|witch|point/.test(name))
      for (let i = 0; i < 5; i++)
        headBoxes.push(B(-i * 0.012, headLength + 0.15 + i * 0.04, 0, 0.2 - i * 0.03, 0.045, 0.2 - i * 0.03, c));
    else if (/helm|knight|great/.test(name)) headBoxes.push(B(0, headLength * 0.6, 0.14, 0.23, 0.035, 0.035, c));
    else headBoxes.push(B(0, headLength + 0.025, 0, 0.37, 0.025, 0.34, c));
  }
  if (role === 'pirate')
    headBoxes.push(
      B(0, headLength * 0.85, 0, 0.24, 0.06, 0.24, 0xa3473c),
      B(-0.052, headLength * 0.57, 0.13, 0.05, 0.045, 0.025, P.iron),
    );
  if (role === 'guild_guard')
    headBoxes.push(
      B(0, headLength + 0.015, 0, 0.25, 0.1, 0.25, P.iron),
      B(0, headLength * 0.67, 0.14, 0.22, 0.035, 0.035, P.iron),
    );
  add('Head', headBoxes, headFrame);
  for (const side of ['Left', 'Right']) {
    segment(`${side}Arm`, `${side}ForeArm`, 0.105, 0.12, cloth);
    segment(`${side}ForeArm`, `${side}Hand`, 0.085, 0.1, skin);
    segment(`${side}UpLeg`, `${side}Leg`, 0.125, 0.15, pants);
    segment(`${side}Leg`, `${side}Foot`, 0.105, 0.13, pants);
    const hand = point(`${side}Hand`),
      handEnd = hand.clone().add(
        hand
          .clone()
          .sub(point(`${side}ForeArm`))
          .normalize()
          .multiplyScalar(0.08),
      );
    add(
      `${side}Hand`,
      [B(0, 0.035, 0, 0.09, 0.1, 0.07, skin), B(-0.05, 0.02, 0.015, 0.035, 0.06, 0.04, skin)],
      frame(hand, handEnd),
    );
    const foot = point(`${side}Foot`),
      toe = point(`${side}Toe_End`);
    const footFrame = frame(foot, foot.clone().add(up));
    const reach = Math.max(0.15, new Vector3().subVectors(toe, foot).dot(forward) + 0.045);
    add(
      `${side}Foot`,
      [B(0, -0.015, reach * 0.3, 0.13, 0.095, reach, boots), B(0, 0.03, 0, 0.12, 0.1, 0.13, boots)],
      footFrame,
    );
    if (dressed.plate)
      add(
        `${side}Arm`,
        [B(0, 0.025, 0, 0.16, 0.09, 0.16, tone(dressed.plate.ramp, P.stone))],
        frame(point(`${side}Arm`), point(`${side}ForeArm`)),
      );
  }
  const chestFrame = frame(point('Spine1'), point('Spine2'));
  if (role === 'guild_guard') add('Spine1', [B(0, 0.1, 0.115, 0.31, 0.25, 0.045, P.iron)], chestFrame);
  if (dressed.plate)
    add('Spine1', [B(0, 0.1, 0.115, 0.31, 0.25, 0.045, tone(dressed.plate.ramp, P.stone))], chestFrame);
  if (dressed.vest) add('Spine1', [B(0, 0.08, 0.11, 0.27, 0.25, 0.025, tone(dressed.vest.ramp, P.wood))], chestFrame);
  if (dressed.apron) add('Hips', [B(0, -0.02, 0.12, 0.23, 0.35, 0.025, tone(dressed.apron, P.pale))], pelvisFrame);
  if (dressed.skirt) add('Hips', [B(0, -0.12, 0, 0.34, 0.3, 0.25, tone(dressed.skirt.ramp, cloth))], pelvisFrame);
  if (dressed.cape) add('Spine1', [B(0, -0.04, -0.13, 0.36, 0.52, 0.03, tone(dressed.cape.ramp, cloth))], chestFrame);
  const geometry = mergeGeometries(fragments)!;
  fragments.forEach((g) => g.dispose());
  owned.push(geometry);
  const body = new SkinnedMesh(geometry, material),
    skeleton = new Skeleton(bones);
  body.name = 'EssentialVoxelBody';
  body.castShadow = true;
  body.receiveShadow = true;
  body.frustumCulled = false;
  body.boundingSphere = new Sphere(new Vector3(0, 0.8, 0), 2.5);
  scene.add(body);
  body.bind(skeleton, new Matrix4());
  const socket = (name: string) => {
    const g = new Group(),
      p = point(name),
      f = frame(p, p.clone().add(up));
    g.position.copy(p);
    g.quaternion.setFromRotationMatrix(f);
    scene.add(g);
    bone(name).attach(g);
    return g;
  };
  const gear = socket('RightHand'),
    offhand = socket('LeftHand');
  const prop = (parent: Group, boxes: VoxelBox[], scale = 1) => {
    const g = modelGeometry(boxes),
      m = new Mesh(g, material);
    owned.push(g);
    m.scale.setScalar(scale);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  if (weapon && ITEMS[weapon]) prop(gear, voxelItemBoxes(weapon), 0.65);
  else if (weapon && weapon !== 'none' && weapon !== 'unarmed') {
    const staff = /staff|wand|rod|pole|spear/.test(weapon);
    prop(gear, [
      B(0, 0.22, 0, 0.05, staff ? 1.1 : 0.3, 0.05, P.wood),
      B(0, staff ? 0.8 : 0.5, 0, staff ? 0.12 : 0.08, staff ? 0.15 : 0.55, 0.06, staff ? P.glow : P.iron),
    ]);
  }
  if (shield)
    prop(offhand, [
      B(-0.05, 0.03, 0.1, 0.32, 0.43, 0.075, P.iron),
      B(-0.05, 0.03, 0.15, 0.24, 0.32, 0.035, P.teal),
      B(-0.05, 0.03, 0.18, 0.08, 0.08, 0.04, P.gold),
    ]);
  geometry.computeBoundingBox();
  const ground = geometry.boundingBox!.min.y,
    top = headEnd.y;
  const root = new Group(),
    orientation = new Group(),
    anchor = new Group();
  root.name = 'EssentialHumanoid';
  orientation.rotation.y = -Math.atan2(forward.x, forward.z);
  orientation.scale.setScalar(1.7 / (top - ground));
  anchor.add(scene);
  orientation.add(anchor);
  root.add(orientation);
  const animator = new EssentialAnimator(scene, clips);
  const anchorPose = () => {
    root.updateMatrixWorld(true);
    const hip = scene.worldToLocal(bone('Hips').getWorldPosition(new Vector3()));
    anchor.position.set(-hip.x, -ground, -hip.z);
    root.updateMatrixWorld(true);
    skeleton.update();
  };
  anchorPose();
  return {
    root,
    gear,
    offhand,
    animator,
    body,
    update(now, motion) {
      animator.update(now, motion);
      anchorPose();
    },
    sample(clip, time) {
      animator.sample(clip, time);
      anchorPose();
      body.computeBoundingBox();
    },
    dispose() {
      animator.dispose();
      skeleton.dispose();
      owned.forEach((g) => g.dispose());
    },
  };
}
