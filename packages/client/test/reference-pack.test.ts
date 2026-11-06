import { expect, it } from 'vitest';
import catalog from '../src/art/reference-trees.json';
import { DIMS } from '../src/art/body/skeleton';
import { DOOR_H, WALL_H } from '../src/art/buildings';
it('keeps long-legged adult bodies taller than the previous foundations with natural doorway headroom', () => {
  expect(DIMS.male.height).toBeGreaterThanOrEqual(29);
  expect(DIMS.female.height).toBeGreaterThanOrEqual(28);
  for (const d of Object.values(DIMS)) {
    expect(d.hipZ / d.height).toBeGreaterThanOrEqual(0.48);
    expect(d.height / (d.height - d.neckZ)).toBeGreaterThanOrEqual(5);
    expect(DOOR_H).toBeGreaterThanOrEqual(42);
    expect(DOOR_H).toBeLessThanOrEqual(46);
    expect(WALL_H).toBeGreaterThan(DOOR_H + 4);
  }
});
it('ships complete named tree assets with exact decoded coverage and ground anchors', () => {
  expect(Object.keys(catalog.frames)).toHaveLength(16);
  for (const frame of Object.values(catalog.frames)) {
    expect(frame.ax).toBeGreaterThanOrEqual(0);
    expect(frame.ax).toBeLessThan(frame.w);
    expect(frame.ay).toBe(frame.h - 1);
    let total = 0;
    for (let i = 0; i < frame.runs.length; i += 2) {
      total += frame.runs[i]!;
      expect(frame.runs[i + 1]).toBeLessThan(frame.palette.length);
    }
    expect(total).toBe(frame.w * frame.h);
  }
});
it('plants a rider’s hips on the saddle while retaining bent legs and distinct rein grips', async () => {
  const { poseOf, RIDER_SEAT_OFFSET } = await import('../src/art/body/poses');
  const { solve, project, frameOf, AY } = await import('../src/art/body/skeleton');
  for (const d of Object.values(DIMS))
    for (let dir = 0; dir < 8; dir++) {
      const pose = poseOf(d, 234, dir),
        j = solve(d, pose),
        hip = project(j.pelvis, frameOf(dir));
      expect(hip.y - AY).toBeCloseTo(-10);
      expect(hip.y - 48 + RIDER_SEAT_OFFSET).toBeCloseTo(0);
      expect(j.ankleL[1]).toBeLessThan(j.hipL[1]);
      expect(j.ankleR[1]).toBeGreaterThan(j.hipR[1]);
      expect(Math.hypot(...j.wristL.map((v, i) => v - j.wristR[i]!))).toBeGreaterThan(2);
    }
});
