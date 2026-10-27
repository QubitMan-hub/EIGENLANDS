import { describe, expect, it } from 'vitest';
import { isSolid, realmTowns, tileAt } from '@eigenlands/shared';
import { SCENE_HOURS, planScenes, sceneSheltered } from '../src/game/scenes';
import { sceneOut } from '../src/game/scene-life';

const SEED = 20260101;
const towns = realmTowns(SEED);
const free = (x: number, y: number) => !isSolid(tileAt(SEED, x, y, 5));
// realmTowns() leaves `site` unset; building count stands in for capital/town/village
const size = (n: number) => (n > 40 ? 1.8 : n > 10 ? 1.2 : 1);
const plans = towns.map((t) => ({ t, plan: planScenes(t, SEED, { free, size: size(t.buildings.length) }) }));

describe('everyday scenes', () => {
  it('fills every lived-in settlement with ordinary life, on open ground', () => {
    for (const { t, plan } of plans) {
      if (t.abandoned || t.buildings.length < 3) continue;
      expect(plan.length, t.name).toBeGreaterThanOrEqual(2);
      for (const s of plan) {
        expect(free(Math.floor(s.x), Math.floor(s.y)), `${t.name} ${s.kind}`).toBe(true);
        expect(free(Math.floor(s.x2), Math.floor(s.y2)), `${t.name} ${s.kind} second spot`).toBe(true);
        // out of doors: never under a roof
        const inside = t.buildings.some((b) => s.x >= b.x && s.x < b.x + b.w && s.y >= b.y && s.y < b.y + b.h);
        expect(inside, `${t.name} ${s.kind} indoors`).toBe(false);
      }
    }
  });

  it('is deterministic and never stacks two scenes on one tile', () => {
    for (const { t, plan } of plans) {
      expect(planScenes(t, SEED, { free, size: size(t.buildings.length) })).toEqual(plan);
      const at = plan.filter((s) => s.kind !== 'lamplighter').map((s) => `${Math.floor(s.x)},${Math.floor(s.y)}`);
      expect(new Set(at).size, t.name).toBe(at.length);
    }
  });

  it('covers the chores of a real street across the kingdoms', () => {
    const kinds = new Set(plans.flatMap(({ plan }) => plan.map((s) => s.kind)));
    for (const k of [
      'well',
      'chat',
      'kids',
      'sweep',
      'porter',
      'cat',
      'dog',
      'laundry',
      'woodchop',
      'lamplighter',
      'watchman',
      'stablehand',
      'hens',
    ])
      expect(kinds.has(k as never), k).toBe(true);
    // a capital is busier than a village
    const cap = plans.find((p) => p.t.buildings.length > 40)!,
      vil = plans.find((p) => p.t.buildings.length <= 4 && p.t.buildings.length >= 3)!;
    expect(cap.plan.length).toBeGreaterThan(vil.plan.length);
  });

  it('keeps sensible hours and weather', () => {
    expect(SCENE_HOURS.sweep[1]).toBeLessThanOrEqual(10); // the step is swept in the morning
    expect(SCENE_HOURS.lamplighter[0]).toBeGreaterThan(17); // lamps are lit at dusk
    expect(sceneSheltered('laundry', 'rain')).toBe(true); // nobody hangs washing in the rain
    expect(sceneSheltered('kids', 'rain')).toBe(true);
    expect(sceneSheltered('well', 'rain')).toBe(false); // water is still needed
    expect(sceneSheltered('cat', 'storm')).toBe(false);
    const well = plans.flatMap(({ plan }) => plan).find((s) => s.kind === 'well')!;
    expect(sceneOut(well, 7, 'clear')).toBe(true);
    expect(sceneOut(well, 23, 'clear')).toBe(false);
  });

  it('dresses doorsteps in order: a matching pair either side of the door, chosen by the building', () => {
    let pairs = 0;
    for (const { t, plan } of plans)
      for (const s of plan.filter((p) => p.kind === 'dressing')) {
        const fx = Math.floor(s.x),
          fy = Math.floor(s.y);
        // right beside a door, on the step in front of the wall: never somewhere at random
        const door = t.buildings.find((b) => b.doorY + 1 === fy && Math.abs(b.doorX - fx) === 1);
        expect(door, `${t.name} dressing at ${fx},${fy}`).toBeTruthy();
        // what stands there fits the building
        const want: Record<string, number[]> = { inn: [1], store: [4, 2], smithy: [3, 1], farmhouse: [6, 3] };
        if (want[door!.kind]) expect(want[door!.kind]).toContain(s.set);
        const twin = plan.find(
          (p) => p.kind === 'dressing' && p !== s && Math.floor(p.y) === fy && Math.abs(Math.floor(p.x) - fx) === 2,
        );
        if (twin) pairs++;
      }
    expect(pairs).toBeGreaterThan(40);
  });

  it('keeps a night watch from dusk to first light', () => {
    const w = plans.flatMap(({ plan }) => plan).find((s) => s.kind === 'watchman')!;
    expect(sceneOut(w, 23, 'clear')).toBe(true);
    expect(sceneOut(w, 3, 'storm')).toBe(true);
    expect(sceneOut(w, 12, 'clear')).toBe(false);
    expect(w.route!.length).toBeGreaterThanOrEqual(2);
  });
});
