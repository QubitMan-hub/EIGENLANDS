import { describe, expect, it } from 'vitest';
import {
  BIOMES,
  CHUNK_SIZE,
  CLIFF,
  ChunkStore,
  CONTINENT_R,
  MAX_LEVEL,
  T,
  biomeAt,
  elevationAt,
  findPath,
  generateChunk,
  generateLevels,
  isSolid,
  moveBody,
  ruinOfCell,
  caveOfCell,
  shrinesNear,
  tileAt,
  townFor,
  type SolidQuery,
} from '../src';
import { landmarkDistance, massifLevel, massifOfCell } from '../src/terrain3';

const SEEDS = [20260101, 1337, 7102025];

describe('revisions 1 and 2 are frozen', () => {
  // Fingerprints of the tiles and biomes of main before revision 3 existed.
  const FROZEN: Record<string, number> = {
    '20260101:1': 290442962,
    '20260101:2': 2141079377,
    '1337:1': 3419494417,
    '1337:2': 819764654,
    '7:1': 2380422585,
    '7:2': 1075102405,
  };
  it.each(Object.keys(FROZEN))('seed:generation %s reproduces its exact surface', (k) => {
    const [seed, gen] = k.split(':').map(Number) as [number, 1 | 2];
    let h = 2166136261;
    for (let y = -330; y < 330; y += 5)
      for (let x = -330; x < 330; x += 5) {
        h = Math.imul(h ^ tileAt(seed, x, y, gen), 16777619) >>> 0;
        h = Math.imul(h ^ BIOMES.indexOf(biomeAt(seed, x, y, gen)), 16777619) >>> 0;
      }
    expect(h).toBe(FROZEN[k]);
  });

  it('older revisions are flat and keep legacy landmark sites in revision-3 worlds too', () => {
    const old = new ChunkStore(20260101, 64, 2);
    expect(old.levelAt(120, 90)).toBe(0);
    expect(old.get(3, 3).levels).toBeUndefined();
    const sites = (seed: number) =>
      JSON.stringify([ruinOfCell(seed, 2, 1), caveOfCell(seed, 1, 2), shrinesNear(seed, 90, 70, 200)]);
    const before = sites(20260101);
    new ChunkStore(20260101, 64, 3); // registering a revision-3 world must not move any landmark id or site
    expect(sites(20260101)).toBe(before);
    expect(JSON.stringify(townFor(20260101))).toBe(JSON.stringify(townFor(20260101)));
  });
});

describe('revision 3 terrain', () => {
  it('is deterministic and seam stable: chunks do not depend on generation order', () => {
    const a = generateChunk(20260101, 4, -3, 3).slice();
    const la = generateLevels(20260101, 4, -3, 3).slice();
    // generate the neighbours first, then the chunk again from cold caches of a different seed
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) generateChunk(20260101, 4 + i, -3 + j, 3);
    generateChunk(99, 4, -3, 3);
    expect([...generateChunk(20260101, 4, -3, 3)]).toEqual([...a]);
    expect([...generateLevels(20260101, 4, -3, 3)]).toEqual([...la]);
  });

  it('grows a coherent home continent: land inside, sea outside, one landmass', () => {
    for (const seed of SEEDS) {
      let inner = 0,
        water = 0,
        outer = 0,
        outerWater = 0;
      for (let y = -300; y < 300; y += 3)
        for (let x = -300; x < 300; x += 3) {
          const r = Math.hypot(x, y),
            t = tileAt(seed, x, y, 3),
            w = t === T.WATER || t === T.DEEP_WATER;
          if (r < CONTINENT_R * 0.7) {
            inner++;
            if (w) water++;
          } else if (r > CONTINENT_R * 1.35) {
            outer++;
            if (w) outerWater++;
          }
        }
      expect(water / inner).toBeLessThan(0.1);
      expect(outerWater / outer).toBeGreaterThan(0.55);
    }
  });

  it('forms large biome regions with sensible neighbours and a latitudinal temperature gradient', () => {
    for (const seed of SEEDS) {
      const count: Record<string, number> = {};
      let flips = 0,
        samples = 0,
        hotNorth = 0,
        coldSouth = 0;
      for (let y = -200; y <= 200; y += 4) {
        let prev: string | null = null;
        for (let x = -200; x <= 200; x += 4) {
          if (Math.hypot(x, y) > 200) continue;
          const b = biomeAt(seed, x, y, 3);
          count[b] = (count[b] ?? 0) + 1;
          samples++;
          if (prev && prev !== b) flips++;
          prev = b;
          if (y < -120 && b === 'desert') hotNorth++;
          if (y > 120 && b === 'taiga') coldSouth++;
        }
      }
      // regions are broad: a 4-tile walk changes biome rarely
      expect(flips / samples).toBeLessThan(0.1);
      expect(Object.keys(count).length).toBeGreaterThanOrEqual(4);
      expect(hotNorth).toBe(0);
      expect(coldSouth).toBe(0);
      expect(count['meadow']! / samples).toBeLessThan(0.7);
    }
  });

  it('keeps the vale and Hadamere flat and dry, water at level zero, levels within range', () => {
    for (const seed of SEEDS) {
      const t = townFor(seed);
      for (let y = t.y0 - 6; y <= t.y1 + 6; y += 2)
        for (let x = t.x0 - 6; x <= t.x1 + 6; x += 2) expect(elevationAt(seed, x, y)).toBe(0);
      for (let y = -90; y <= 90; y += 3)
        for (let x = -90; x <= 90; x += 3) if (Math.hypot(x, y) <= 94) expect(elevationAt(seed, x, y)).toBe(0);
      const store = new ChunkStore(seed, 400, 3);
      for (let cy = -8; cy <= 8; cy++)
        for (let cx = -8; cx <= 8; cx++) {
          const c = store.get(cx, cy);
          expect(c.levels).toBeDefined();
          for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
            expect(c.levels![i]!).toBeLessThanOrEqual(MAX_LEVEL);
            if (c.tiles[i] === T.WATER || c.tiles[i] === T.DEEP_WATER) expect(c.levels![i]).toBe(0);
          }
        }
    }
  }, 60_000);

  it('has mountains with sheer tiers', () => {
    let massifs = 0,
      cliffEdges = 0,
      maxLevel = 0;
    for (const seed of SEEDS) {
      const store = new ChunkStore(seed, 600, 3);
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (massifOfCell(seed, i, j)) massifs++;
      for (let y = -230; y < 230; y++)
        for (let x = -230; x < 230; x++) {
          const l = store.levelAt(x, y);
          maxLevel = Math.max(maxLevel, l);
          if (Math.abs(store.levelAt(x + 1, y) - l) >= CLIFF) cliffEdges++;
        }
    }
    expect(massifs).toBeGreaterThanOrEqual(3);
    expect(maxLevel).toBeGreaterThanOrEqual(6);
    expect(cliffEdges).toBeGreaterThan(40);
  }, 120_000);
});

describe('hills', () => {
  it('stay gentle: outside massifs and landmark cones there is essentially no cliff', () => {
    for (const seed of SEEDS) {
      const store = new ChunkStore(seed, 3000, 3);
      let steep = 0,
        hill = 0;
      for (let y = -220; y < 220; y++)
        for (let x = -220; x < 220; x++) {
          if (
            massifLevel(seed, x, y).inside ||
            massifLevel(seed, x + 1, y).inside ||
            massifLevel(seed, x, y + 1).inside
          )
            continue;
          const l = store.levelAt(x, y);
          if (l > 0) hill++;
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
          ] as const)
            if (Math.abs(store.levelAt(x + dx, y + dy) - l) >= CLIFF && landmarkDistance(seed, x, y, 14) === Infinity)
              steep++;
          expect(l).toBeLessThanOrEqual(3);
        }
      expect(hill).toBeGreaterThan(2000); // there are hills to speak of
      expect(steep).toBeLessThanOrEqual(10);
    }
  }, 120_000);
});

/** walkable region reachable from the spawn using the same rules as movement and pathing */
function flood(store: ChunkStore, radius: number): { seen: Set<number>; land: number; reached: number } {
  const w = radius * 2 + 1;
  const idx = (x: number, y: number) => (y + radius) * w + (x + radius);
  const seen = new Set<number>([idx(1, 1)]);
  const queue: Array<[number, number]> = [[1, 1]];
  const ok = (x: number, y: number) => Math.abs(x) <= radius && Math.abs(y) <= radius && !store.solidAt(x, y);
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx,
        ny = y + dy;
      if (!ok(nx, ny) || seen.has(idx(nx, ny))) continue;
      if (Math.abs(store.levelAt(nx, ny) - store.levelAt(x, y)) >= CLIFF) continue;
      seen.add(idx(nx, ny));
      queue.push([nx, ny]);
    }
  }
  let land = 0,
    reached = 0;
  for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++)
      if (Math.hypot(x, y) <= radius && ok(x, y)) {
        land++;
        if (seen.has(idx(x, y))) reached++;
      }
  return { seen, land, reached };
}

describe('revision 3 accessibility', () => {
  it.each(SEEDS)(
    'seed %i: nearly all of the home continent is walkable from the spawn, plateaus included',
    (seed) => {
      const store = new ChunkStore(seed, 1200, 3);
      const radius = 200;
      const { seen, land, reached } = flood(store, radius);
      // the continent is one connected landmass: only pockets walled in by trees, rock and rivers are cut off
      console.info(`reachable ${seed}: ${((reached / land) * 100).toFixed(1)}% of ${land} tiles`);
      expect(reached / land).toBeGreaterThan(0.93);
      // every mountain top is reachable by ramp
      for (let j = -3; j <= 3; j++)
        for (let i = -3; i <= 3; i++) {
          const m = massifOfCell(seed, i, j);
          if (!m || Math.hypot(m.x, m.y) > radius - 10) continue;
          let top = -1,
            best: [number, number] | null = null;
          for (let y = m.y - m.r; y <= m.y + m.r; y++)
            for (let x = m.x - m.r; x <= m.x + m.r; x++) {
              if (store.solidAt(x, y) || Math.hypot(x - m.x, y - m.y) > m.r * 0.5) continue;
              const l = store.levelAt(x, y);
              if (l > top) {
                top = l;
                best = [x, y];
              }
            }
          if (best && top >= 2) {
            const w = radius * 2 + 1;
            expect(seen.has((best[1] + radius) * w + best[0] + radius)).toBe(true);
          }
        }
    },
    120_000,
  );

  it('authored sites stay reachable', () => {
    const seed = 20260101;
    const store = new ChunkStore(seed, 1200, 3);
    const { seen } = flood(store, 200);
    const w = 401;
    let sites = 0,
      reachable = 0;
    for (let gy = -3; gy <= 3; gy++)
      for (let gx = -3; gx <= 3; gx++) {
        const s = ruinOfCell(seed, gx, gy) ?? caveOfCell(seed, gx, gy);
        if (!s || Math.hypot(s.x, s.y) > 190) continue;
        sites++;
        let near = false;
        for (let oy = -3; oy <= 3 && !near; oy++)
          for (let ox = -3; ox <= 3 && !near; ox++) near = seen.has((s.y + oy + 200) * w + s.x + ox + 200);
        if (near) reachable++;
      }
    expect(sites).toBeGreaterThan(3);
    expect(reachable / sites).toBeGreaterThan(0.85);
  }, 120_000);
});

describe('level-aware collision and pathing', () => {
  // a 4-level plateau for x >= 10 with a ramp in the row y = 5 (x 4..9) and a cliff elsewhere
  const level = (x: number, y: number) =>
    x >= 10 ? 4 : y === 5 || y === 4 || y === 6 ? Math.max(0, Math.min(4, x - 5)) : 0;
  const solid: SolidQuery = Object.assign(() => false, { level });

  it('a body cannot walk or be pushed over a cliff but can climb a ramp', () => {
    const p = { x: 8.5, y: 1.5 };
    for (let i = 0; i < 40; i++) moveBody(p, 0.2, 0, 0.35, solid);
    // stopped short of the cliff face at x=10 (a 4 level wall; the body keeps its radius away)
    expect(p.x).toBeLessThan(9.7);
    const q = { x: 1.5, y: 5.5 };
    for (let i = 0; i < 80; i++) moveBody(q, 0.2, 0, 0.35, solid);
    expect(q.x).toBeGreaterThan(12);
  });

  it('walkers path along the ramp and not over the cliff', () => {
    const path = findPath(2, 1, 12, 1, solid, 5000);
    expect(path).not.toBeNull();
    expect(path!.some(([x, y]) => x < 10 && y >= 4 && y <= 6)).toBe(true);
    for (const [x, y] of path!) expect(isSolid(T.GRASS) || level(x, y) >= 0).toBe(true);
    // a target on the plateau with the ramp removed is unreachable
    const wall: SolidQuery = Object.assign(() => false, { level: (x: number) => (x >= 10 ? 4 : 0) });
    expect(findPath(2, 1, 12, 1, wall, 3000)).toBeNull();
  });
});
