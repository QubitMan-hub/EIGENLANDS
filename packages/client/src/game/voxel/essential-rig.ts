import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type AnimationClip,
  type Bone,
  type Group,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

export const ESSENTIAL_CLIPS = ['Idle', 'Run', 'Attack', 'Hit', 'Death'] as const;
export type EssentialClip = (typeof ESSENTIAL_CLIPS)[number];
let asset: Pick<GLTF, 'scene' | 'animations'> | undefined;
let pending: Promise<void> | undefined;

export function installEssentialAsset(gltf: Pick<GLTF, 'scene' | 'animations'>): void {
  for (const name of ESSENTIAL_CLIPS) {
    const clip = gltf.animations.find((c) => c.name === name);
    if (!clip?.tracks.length) throw new Error(`Essential character animation is missing: ${name}`);
  }
  let bones = 0;
  gltf.scene.traverse((o) => {
    if ((o as Bone).isBone) bones++;
  });
  if (bones !== 25) throw new Error(`Expected the supplied 25-joint rig, found ${bones}`);
  asset = gltf;
}
export function loadEssentialRig(): Promise<void> {
  if (asset) return Promise.resolve();
  return (pending ??= new GLTFLoader()
    .loadAsync(`${import.meta.env.BASE_URL}art/voxel/essential-animation/essential.glb`)
    .then(installEssentialAsset));
}
export function cloneEssentialRig(): { scene: Group; bones: Bone[]; clips: AnimationClip[] } {
  if (!asset) throw new Error('Load the supplied essential animation rig before creating characters');
  const scene = asset.scene.clone(true),
    bones: Bone[] = [];
  scene.traverse((o) => {
    if ((o as Bone).isBone) bones.push(o as Bone);
  });
  scene.updateMatrixWorld(true);
  return { scene, bones, clips: asset.animations };
}

export interface EssentialMotion {
  guard?: boolean;
  walking?: boolean;
  attack?: boolean;
  attackProgress?: number;
  dead?: boolean;
  hp?: number;
  reduced?: boolean;
}
/** Original clips and timing; one-shot hits/attacks/death never get replaced by procedural limb sine waves. */
export class EssentialAnimator {
  readonly mixer: AnimationMixer;
  private actions = new Map<EssentialClip, AnimationAction>();
  private current: EssentialClip = 'Idle';
  private last = 0;
  private until = 0;
  private attacked = false;
  private progress = 1;
  private hp: number | undefined;
  private wasDead = false;
  constructor(root: Group, clips: AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    for (const name of ESSENTIAL_CLIPS) {
      const clip = clips.find((c) => c.name === name)!;
      const action = this.mixer.clipAction(clip);
      action.setLoop(
        name === 'Idle' || name === 'Run' ? LoopRepeat : LoopOnce,
        name === 'Idle' || name === 'Run' ? Infinity : 1,
      );
      action.clampWhenFinished = true;
      this.actions.set(name, action);
    }
    this.actions.get('Idle')!.play();
    this.mixer.update(0);
  }
  update(now: number, m: EssentialMotion): void {
    let dt = this.last ? Math.max(0, (now - this.last) / 1000) : 0;
    this.last = now;
    const hit = this.hp !== undefined && m.hp !== undefined && m.hp < this.hp;
    this.hp = m.hp ?? this.hp;
    const strike =
      !!m.attack && (!this.attacked || (m.attackProgress !== undefined && m.attackProgress < this.progress - 0.05));
    this.attacked = !!m.attack;
    this.progress = m.attackProgress ?? 1;
    let desired: EssentialClip = m.walking ? 'Run' : 'Idle';
    let restart = false;
    if (m.dead) desired = 'Death';
    else if (this.wasDead) {
      this.until = 0;
      restart = true;
    } else if (hit) {
      desired = 'Hit';
      restart = true;
    } else if (m.guard) {
      desired = 'Idle';
      this.until = 0;
    } else if (strike) {
      desired = 'Attack';
      restart = true;
    } else if (now < this.until && (this.current === 'Hit' || this.current === 'Attack')) desired = this.current;
    this.wasDead = !!m.dead;
    if (desired !== this.current || restart) {
      const old = this.actions.get(this.current)!,
        next = this.actions.get(desired)!;
      next.reset().setEffectiveWeight(1).play();
      next.crossFadeFrom(old, desired === 'Death' ? 0.06 : 0.08, false);
      this.current = desired;
      dt = 0;
      this.until = ['Attack', 'Hit'].includes(desired) ? now + next.getClip().duration * 1000 : 0;
    }
    this.mixer.update(m.reduced && (desired === 'Idle' || desired === 'Run') ? 0 : dt);
  }
  /** Deterministic original pose sampling for portraits, conversion proof and the animation inspection page. */
  sample(name: EssentialClip, time: number): void {
    this.mixer.stopAllAction();
    const action = this.actions.get(name)!;
    action.reset().setEffectiveWeight(1).play();
    action.paused = true;
    action.time = Math.min(Math.max(0, time), action.getClip().duration);
    this.mixer.update(0);
    this.current = name;
  }
  diagnostics() {
    const a = this.actions.get(this.current)!;
    return { source: 'essential-fbx', bones: 25, clip: this.current, time: a.time, duration: a.getClip().duration };
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
