// Compare every joint at every source frame against the supplied FBXs, in metres, without a browser.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer, LoopOnce, Vector3 } from 'three';
const dir = process.argv[2],
  file = process.argv[3];
if (!dir || !file)
  throw new Error(
    'Usage: node tools/voxel/verify-essential-animation.mjs extracted-fbx-directory essential.glb [report.json]',
  );
const buffer = (p) => {
  const b = readFileSync(p);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const report = { toleranceMetres: 0.00002, clips: {} };
for (const name of ['Idle', 'Run', 'Attack', 'Hit', 'Death']) {
  const source = new FBXLoader().parse(buffer(resolve(dir, `${name}.fbx`)), '');
  source.scale.setScalar(0.01);
  const target = await new GLTFLoader().parseAsync(buffer(file), '');
  const a = source.animations[0],
    b = target.animations.find((c) => c.name === name);
  assert.ok(b, `Missing ${name}`);
  const start = Math.min(...a.tracks.map((t) => t.times[0])),
    duration = a.duration - start;
  assert.ok(Math.abs(b.duration - duration) < 0.00001, `${name} retains its timing`);
  const sm = new AnimationMixer(source),
    tm = new AnimationMixer(target.scene);
  for (const [m, c] of [
    [sm, a],
    [tm, b],
  ]) {
    const action = m.clipAction(c);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
  }
  const names = [];
  target.scene.traverse((o) => {
    if (o.isBone) names.push(o.name);
  });
  assert.equal(names.length, 25);
  let error = 0,
    samples = 0;
  const frames = Math.round(duration * 30) + 1;
  for (let frame = 0; frame < frames; frame++) {
    const t = Math.min(duration - 0.000001, frame / 30);
    sm.setTime(t + start);
    tm.setTime(t);
    source.updateMatrixWorld(true);
    target.scene.updateMatrixWorld(true);
    for (const joint of names) {
      const s = source.getObjectByName(joint).getWorldPosition(new Vector3()),
        g = target.scene.getObjectByName(joint).getWorldPosition(new Vector3());
      error = Math.max(error, s.distanceTo(g));
      samples++;
    }
  }
  assert.ok(error < report.toleranceMetres, `${name} pose error: ${error}m`);
  report.clips[name] = { duration: b.duration, joints: 25, frames, samples, maximumJointErrorMetres: error };
}
if (process.argv[4]) writeFileSync(process.argv[4], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
