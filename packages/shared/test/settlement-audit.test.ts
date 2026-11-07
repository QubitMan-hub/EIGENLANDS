import { describe, expect, it } from 'vitest';
import { townsFor } from '../src/town';
import { frontierTownsNear } from '../src/frontier';
import { auditTown } from '../src/settlement-audit';

describe('settlement layout rules', () => {
  it('keeps every street, door and prop in order in every settlement family', () => {
    // the home town, its neighbours, upper and cave towns, the kingdoms and the frontier provinces around them
    const seed = 20260101;
    const towns = [...townsFor(seed, 7), ...frontierTownsNear(seed, -2500, -2500, 2500, 2500, 7)];
    expect(towns.length).toBeGreaterThan(40);
    const issues = towns.flatMap((t) => auditTown(t)).map((i) => `${i.town} (${i.x},${i.y}) ${i.detail}`);
    expect(issues).toEqual([]);
  });

  it('keeps the doors of the cave towns facing their lanes, not opening through a hall', () => {
    const caves = townsFor(20260101, 7).filter((t) => t.cy > 30000);
    expect(caves.length).toBeGreaterThan(0);
    for (const t of caves)
      expect(auditTown(t).filter((i) => i.rule === 'road' || i.rule.startsWith('door'))).toEqual([]);
  });
});
