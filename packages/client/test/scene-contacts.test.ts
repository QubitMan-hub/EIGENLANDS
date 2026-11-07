import { Container, Sprite } from 'pixi.js';
import { expect, it, vi } from 'vitest';
import { SceneLife, type SceneActor, type SceneDeps, type SceneFrame } from '../src/game/scene-life';
function fixture() {
  const a = {
    x: 1.5,
    y: 1.5,
    z: 0,
    tx: 6.5,
    ty: 1.5,
    t: 0,
    phase: 0,
    dir: 0,
    st: 'walk',
    body: new Sprite(),
    root: new Container(),
    face: 0,
  } as SceneActor;
  const findPath = vi.fn<() => Array<[number, number]> | null>(() => null);
  const d = {
    findPath,
    tex: () => a.body.texture,
    held: () => null,
    moveTo: vi.fn(() => false),
    walkFrame: () => 1,
  } as unknown as SceneDeps;
  const life = new SceneLife(d) as unknown as { walk(a: SceneActor, f: SceneFrame, s: number): boolean };
  return { a, findPath, life };
}
it('waits and retries an unreachable scene goal instead of teleporting through a wall', () => {
  const { a, findPath, life } = fixture();
  for (let now = 0; now < 2000; now += 50) expect(life.walk(a, { now, dt: 0.05 } as SceneFrame, 1)).toBe(false);
  expect([a.x, a.y]).toEqual([1.5, 1.5]);
  expect(findPath.mock.calls.length).toBeLessThanOrEqual(3);
});
it('replans a blocked route after making no progress', () => {
  const { a, findPath, life } = fixture();
  findPath.mockReturnValue([
    [1, 1],
    [2, 1],
    [3, 1],
    [6, 1],
  ]);
  for (let now = 0; now < 2200; now += 50) life.walk(a, { now, dt: 0.05 } as SceneFrame, 1);
  expect([a.x, a.y]).toEqual([1.5, 1.5]);
  expect(findPath.mock.calls.length).toBeGreaterThan(1);
  expect(findPath.mock.calls.length).toBeLessThanOrEqual(4);
});

it('anchors each carried model to the correct posed hand through every direction, body and child scale', async () => {
  const { carryPlacement, propGrip } = await import('../src/art/scene-contact');
  const { personGripOf } = await import('../src/art/body');
  const { actionKeys } = await import('../src/art/person-actions');
  for (const body of ['male', 'female'] as const)
    for (const scale of [1, 0.72])
      for (let d = 0; d < 8; d++)
        for (const f of actionKeys('carry'))
          for (const kind of ['bucket', 'sack', 'broom', 'pole', 'lute', 'lantern'] as const) {
            const p = carryPlacement(kind, d, f, 1, scale, body),
              g = propGrip(kind, 1, p.face),
              h = personGripOf(d, f, kind === 'lute' ? 'L' : 'R', body);
            expect(p.x + g.x * scale).toBeCloseTo((h.x - 32) * scale);
            expect(p.y + g.y * scale).toBeCloseTo((h.y - 64) * scale);
            expect(p.behind).toBe(d === 1 || d >= 6);
          }
});

it('keeps loaded arms steady while legs walk, with a free balancing arm for one-handed loads', async () => {
  const { poseOf } = await import('../src/art/body/poses');
  const { DIMS } = await import('../src/art/body/skeleton');
  const { actionKeys } = await import('../src/art/person-actions');
  const both = [1, 5].map((i) => poseOf(DIMS.male, actionKeys('carry')[i]!));
  expect(both[0]!.footL).not.toEqual(both[1]!.footL);
  expect(both[0]!.handR[0]).toBeCloseTo(both[1]!.handR[0]);
  expect(both[0]!.handL[0]).toBeCloseTo(both[1]!.handL[0]);
  const one = [1, 5].map((i) => poseOf(DIMS.male, actionKeys('carry_one')[i]!));
  expect(one[0]!.handL[0]).not.toBeCloseTo(one[1]!.handL[0]);
  expect(one[0]!.handR[0]).toBeCloseTo(one[1]!.handR[0]);
});
