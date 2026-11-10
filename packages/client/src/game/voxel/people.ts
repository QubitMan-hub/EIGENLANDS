import { Group, Mesh, MeshStandardMaterial, type BufferGeometry } from 'three';
import { unpackAppearance, PALETTE, ITEMS } from '@eigenlands/shared';
import { voxelItemBoxes } from './items';
import { OUTFITS, NPC_LOOKS } from '../../art/actors';
import { outfitFromAppearance } from '../../art/appearance';
import { lookOf } from '../../art/body/outfit';
import { modelGeometry, solidBox as B } from './mesh';
import { P } from './models';

export interface PersonRig {
  root: Group;
  arms: Group[];
  forearms: Group[];
  legs: Group[];
  knees: Group[];
  head: Group;
  gear: Group;
  dispose(): void;
}

/** All parts are solid meshes. Articulated pivots provide continuous gait, guard and attack motion. */
export function personRig(
  app: number,
  look: number,
  weapon: string,
  shield: string,
  material: MeshStandardMaterial,
  parts?: string,
  npcId?: string,
): PersonRig {
  const a = unpackAppearance(app),
    root = new Group(),
    arms: Group[] = [],
    legs: Group[] = [],
    gear = new Group();
  const forearms: Group[] = [],
    knees: Group[] = [];
  if (a && parts) {
    try {
      a.parts = JSON.parse(parts);
    } catch {
      /* Server already validates saved appearance parts. */
    }
  }
  const outfit = (npcId && NPC_LOOKS[npcId]) || OUTFITS[look % OUTFITS.length] || OUTFITS[0];
  const dressed = lookOf(a ? outfitFromAppearance(outfit, a, look === 0) : outfit);
  const rgb = (index: number | undefined, fallback: number) =>
    index === undefined ? fallback : Number.parseInt(PALETTE[index].slice(1), 16);
  const tone = (r: readonly number[] | undefined, fallback: number) => rgb(r?.[Math.floor(r.length * 0.65)], fallback);
  const geometries: BufferGeometry[] = [];
  const skin = tone(dressed.skin, 0xd6ad89),
    hair = tone(dressed.hair, 0x714c35);
  const cloth = tone(dressed.top?.ramp, 0x648f9d),
    trim = rgb(dressed.trim, P.gold);
  const mesh = (parent: Group, boxes: ReturnType<typeof B>[]) => {
    const g = modelGeometry(boxes),
      m = new Mesh(g, material);
    m.castShadow = true;
    m.receiveShadow = true;
    geometries.push(g);
    parent.add(m);
    return m;
  };
  mesh(root, [
    B(0, 0.72, 0, 0.36, 0.31, 0.23, cloth),
    B(0, 0.55, 0, 0.3, 0.12, 0.2, cloth),
    B(0, 0.86, 0, 0.32, 0.055, 0.21, cloth),
    B(0, 0.49, 0, 0.34, 0.055, 0.23, P.bark),
    B(0, 0.49, 0.14, 0.09, 0.07, 0.04, trim),
    B(0, 0.9, 0, 0.16, 0.1, 0.16, skin),
  ]);
  const head = new Group();
  head.position.y = 1.04;
  root.add(head);
  mesh(head, [
    B(0, 0, 0, 0.32, 0.32, 0.3, skin),
    B(0, 0.17, -0.025, 0.35, 0.1, 0.34, hair),
    B(0, 0.07, -0.15, 0.34, 0.19, 0.06, hair),
    B(-0.19, 0, 0, 0.055, 0.1, 0.1, skin),
    B(0.19, 0, 0, 0.055, 0.1, 0.1, skin),
    B(-0.075, 0.025, 0.157, 0.035, 0.045, 0.025, 0x302c2b),
    B(0.075, 0.025, 0.157, 0.035, 0.045, 0.025, 0x302c2b),
    B(0, -0.025, 0.17, 0.045, 0.05, 0.05, skin),
  ]);
  if ((a?.hairStyle ?? 0) % 4 === 1) mesh(head, [B(0, -0.12, -0.14, 0.34, 0.4, 0.1, hair)]);
  if (dressed.gear.hat) {
    const hat = tone(dressed.hat, P.iron),
      name = String(dressed.gear.hat);
    mesh(head, [B(0, 0.19, 0, 0.4, 0.1, 0.38, hat), B(0, 0.29, -0.02, 0.34, 0.13, 0.32, hat)]);
    if (/wizard|witch|point/.test(name))
      for (let i = 0; i < 5; i++)
        mesh(head, [B(-i * 0.018, 0.38 + i * 0.065, 0, 0.28 - i * 0.045, 0.07, 0.28 - i * 0.045, hat)]);
    if (/helm|knight|great/.test(name)) mesh(head, [B(0, 0.02, 0.19, 0.34, 0.05, 0.05, hat)]);
    else mesh(head, [B(0, 0.2, 0, 0.55, 0.04, 0.5, hat)]);
  }
  if (dressed.beard) mesh(head, [B(0, -0.15, 0.11, 0.26, 0.15, 0.16, tone(dressed.beard, hair))]);
  if (dressed.plate) {
    const plate = tone(dressed.plate.ramp, P.stone);
    mesh(root, [
      B(0, 0.71, 0.14, 0.38, 0.34, 0.08, plate),
      B(-0.24, 0.84, 0, 0.17, 0.14, 0.32, plate),
      B(0.24, 0.84, 0, 0.17, 0.14, 0.32, plate),
    ]);
  }
  if (dressed.skirt) mesh(root, [B(0, 0.33, 0, 0.46, 0.33, 0.32, tone(dressed.skirt.ramp, cloth))]);
  if (dressed.cape) mesh(root, [B(0, 0.57, -0.2, 0.45, 0.6, 0.06, tone(dressed.cape.ramp, cloth))]);
  if (dressed.vest) mesh(root, [B(0, 0.69, 0.145, 0.35, 0.34, 0.055, tone(dressed.vest.ramp, P.wood))]);
  if (dressed.apron) mesh(root, [B(0, 0.48, 0.18, 0.27, 0.4, 0.035, tone(dressed.apron, P.pale))]);
  for (const side of [-1, 1]) {
    const arm = new Group();
    arm.position.set(side * 0.28, 0.85, 0);
    root.add(arm);
    arms.push(arm);
    mesh(arm, [B(0, -0.095, 0, 0.125, 0.2, 0.145, cloth), B(0, 0.015, 0, 0.145, 0.075, 0.155, cloth)]);
    const elbow = new Group();
    elbow.position.y = -0.2;
    arm.add(elbow);
    forearms.push(elbow);
    mesh(elbow, [B(0, -0.085, 0, 0.105, 0.18, 0.115, skin), B(0, -0.19, 0.015, 0.115, 0.105, 0.12, skin)]);
    const leg = new Group();
    leg.position.set(side * 0.105, 0.48, 0);
    root.add(leg);
    legs.push(leg);
    mesh(leg, [B(0, -0.1, 0, 0.14, 0.21, 0.16, tone(dressed.legs?.ramp, 0x494b4b))]);
    const knee = new Group();
    knee.position.y = -0.21;
    leg.add(knee);
    knees.push(knee);
    mesh(knee, [
      B(0, -0.105, 0, 0.12, 0.22, 0.14, tone(dressed.legs?.ramp, 0x494b4b)),
      B(0, -0.22, 0.035, 0.15, 0.1, 0.23, tone(dressed.boots?.ramp, P.bark)),
    ]);
  }
  const right = forearms[1];
  right.add(gear);
  gear.position.set(0, -0.19, 0.04);
  if (weapon && ITEMS[weapon]) {
    const model = mesh(gear, voxelItemBoxes(weapon));
    model.scale.setScalar(0.75);
  } else if (weapon && weapon !== 'unarmed' && weapon !== 'none') {
    const staff = /staff|wand|rod|pole|spear/.test(weapon),
      axe = /axe|pick/.test(weapon),
      bow = /bow/.test(weapon);
    if (bow) {
      mesh(gear, [
        B(0, 0.2, 0.12, 0.065, 0.65, 0.07, P.wood),
        B(0, 0.5, 0.22, 0.065, 0.08, 0.25, P.wood),
        B(0, -0.1, 0.22, 0.065, 0.08, 0.25, P.wood),
        B(0, 0.2, 0.34, 0.018, 0.64, 0.018, P.pale),
      ]);
    } else {
      mesh(gear, [B(0, staff ? 0.25 : 0, 0.05, 0.055, staff ? 1.25 : 0.27, 0.055, P.wood)]);
      if (staff) mesh(gear, [B(0, 0.92, 0.05, 0.13, 0.18, 0.13, P.glow)]);
      else if (axe)
        mesh(gear, [
          B(0.1, 0.45, 0.05, /pick/.test(weapon) ? 0.48 : 0.3, 0.18, 0.09, P.stone),
          B(0, 0.27, 0.05, 0.06, 0.65, 0.06, P.wood),
        ]);
      else
        mesh(gear, [
          B(0, 0.39, 0.05, 0.09, 0.6, 0.045, 0xc6d6d4),
          B(0, 0.085, 0.05, 0.27, 0.055, 0.08, P.gold),
          B(0, 0.72, 0.05, 0.05, 0.08, 0.04, 0xe0e5da),
        ]);
    }
  }
  if (shield)
    mesh(arms[0], [
      B(-0.08, -0.24, 0.1, 0.11, 0.46, 0.38, P.iron),
      B(-0.15, -0.24, 0.1, 0.04, 0.33, 0.26, P.teal),
      B(-0.18, -0.24, 0.1, 0.05, 0.1, 0.1, P.gold),
    ]);
  // Adult proportions: long legs/torso, compact head. Children scale the articulated rig as a whole.
  root.scale.y = 1.4;
  head.scale.set(0.84, 0.6, 0.84);
  return { root, arms, forearms, legs, knees, head, gear, dispose: () => geometries.forEach((g) => g.dispose()) };
}
