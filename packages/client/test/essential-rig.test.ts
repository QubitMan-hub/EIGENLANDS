import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, MeshStandardMaterial, Vector3 } from 'three';
import {
  installEssentialAsset,
  cloneEssentialRig,
  EssentialAnimator,
  ESSENTIAL_CLIPS,
} from '../src/game/voxel/essential-rig';
import { personRig } from '../src/game/voxel/people';
let gltf: GLTF;
beforeAll(async () => {
  const bytes = readFileSync(new URL('../public/art/voxel/essential-animation/essential.glb', import.meta.url));
  gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  installEssentialAsset(gltf);
});
describe('supplied essential character rig', () => {
  it('retains all 25 joints and the five original take durations', () => {
    const { bones, clips } = cloneEssentialRig();
    expect(bones.length).toBe(25);
    const expected = { Idle: 59 / 30, Run: 21 / 30, Attack: 22 / 30, Hit: 21 / 30, Death: 69 / 30 };
    for (const name of ESSENTIAL_CLIPS) {
      expect(clips.find((c) => c.name === name)!.duration).toBeCloseTo(expected[name], 5);
      expect(clips.find((c) => c.name === name)!.tracks.length).toBe(75);
    }
    expect(bones.find((b) => b.name === 'RightHand')!.parent!.name).toBe('RightForeArm');
  });
  it('binds finite solid voxel geometry to the source skeleton at human world scale', () => {
    const rig = personRig(0, 0, '', '', new MeshStandardMaterial());
    expect(rig.body.isSkinnedMesh).toBe(true);
    expect(rig.body.skeleton.bones.length).toBe(25);
    const bounds = new Box3().setFromObject(rig.root),
      size = bounds.getSize(new Vector3());
    expect(size.y).toBeGreaterThan(1.45);
    expect(size.y).toBeLessThan(2.0);
    expect(bounds.min.y).toBeGreaterThan(-0.15);
    expect(bounds.min.y).toBeLessThan(0.15);
    const weights = rig.body.geometry.getAttribute('skinWeight');
    for (let i = 0; i < weights.count; i++)
      expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(1);
    rig.dispose();
  });
  it('plays the authored run, attack, hit and clamped death with revive support', () => {
    const { scene, clips } = cloneEssentialRig(),
      anim = new EssentialAnimator(scene, clips);
    anim.update(1000, { walking: true, hp: 100 });
    expect(anim.diagnostics().clip).toBe('Run');
    anim.update(1100, { attack: true, attackProgress: 0, hp: 100 });
    expect(anim.diagnostics().clip).toBe('Attack');
    anim.update(1200, { hp: 90 });
    expect(anim.diagnostics().clip).toBe('Hit');
    anim.update(1300, { dead: true, hp: 0 });
    expect(anim.diagnostics().clip).toBe('Death');
    anim.update(5000, { dead: true, hp: 0 });
    expect(anim.diagnostics().time).toBeCloseTo(clips.find((c) => c.name === 'Death')!.duration, 5);
    anim.update(5100, { dead: false, hp: 100 });
    expect(anim.diagnostics().clip).toBe('Idle');
    anim.dispose();
  });
  it('returns to the supplied Idle stance when guarding cancels attack presentation', () => {
    const { scene, clips } = cloneEssentialRig(),
      anim = new EssentialAnimator(scene, clips);
    anim.update(1000, { attack: true, hp: 100 });
    expect(anim.diagnostics().clip).toBe('Attack');
    anim.update(1100, { guard: true, hp: 100 });
    expect(anim.diagnostics().clip).toBe('Idle');
    anim.dispose();
  });
  it('deforms the same body through every clip without detaching equipment or producing invalid vertices', () => {
    const rig = personRig(0, 0, 'sword', 'shield', new MeshStandardMaterial());
    const vertex = new Vector3();
    for (const clip of ESSENTIAL_CLIPS) {
      rig.sample(clip, 0.35);
      const count = rig.body.geometry.getAttribute('position').count;
      for (let i = 0; i < count; i += 11) {
        rig.body.getVertexPosition(i, vertex);
        expect(Number.isFinite(vertex.x + vertex.y + vertex.z)).toBe(true);
      }
      expect(rig.gear.parent!.name).toBe('RightHand');
      expect(rig.offhand.parent!.name).toBe('LeftHand');
    }
    rig.dispose();
  });
  it('gives actors independent poses without mutating their shared source clips', () => {
    const a = personRig(0, 0, '', '', new MeshStandardMaterial()),
      b = personRig(0, 0, '', '', new MeshStandardMaterial());
    a.sample('Run', 0.35);
    b.sample('Idle', 0);
    expect(a.animator.diagnostics().clip).toBe('Run');
    expect(b.animator.diagnostics().clip).toBe('Idle');
    expect(a.body.skeleton.bones[0]).not.toBe(b.body.skeleton.bones[0]);
    a.dispose();
    b.dispose();
  });
});
