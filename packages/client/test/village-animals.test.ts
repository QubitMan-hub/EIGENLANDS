import { expect, it } from 'vitest';
import { villageHeading, villageModel, type VillageAnimal } from '../src/art/village-animals';
import { turn, type Heading } from '../src/art/voxel';
it('faces along the world axes under the 2:1 projection, including negative coordinates', () => {
  for (const [x, y, heading] of [
    [2, 0.2, 0],
    [0.2, 2, 1],
    [-2, -0.2, 2],
    [-0.2, -2, 3],
  ]) {
    expect(villageHeading(x!, y!)).toBe(heading);
    const [u, v] = turn(heading as Heading, 1, 0);
    expect(u * x! + v * y!).toBeGreaterThan(0);
  }
});
it('keeps every small animal pose grounded, including pecking, sleeping and wingbeats', () => {
  for (const kind of ['cat', 'dog', 'chicken', 'pigeon'] as VillageAnimal[])
    for (let f = 0; f < 4; f++) {
      const parts = villageModel(kind, f);
      expect(parts.length).toBeGreaterThan(8);
      expect(parts.every((p) => p.box.every(Number.isFinite))).toBe(true);
      const lowest = Math.min(...parts.map((p) => p.box[2]));
      expect(lowest).toBeGreaterThanOrEqual(-0.5);
      expect(lowest).toBeLessThan(1);
    }
});
