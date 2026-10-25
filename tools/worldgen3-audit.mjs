// node --import tsx tools/worldgen3-audit.mjs [output-directory] [half-extent=300]
// Revision-3 evidence next to revision 2: biome and elevation maps, region sizes, connectivity from the spawn and cliff
// statistics for three seeds. Maps are 2-tile samples (3 px per sample); statistics are exact over the home continent.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { BIOMES, tileAt, biomeAt } from '../packages/shared/src/worldgen.ts';
import { ChunkStore } from '../packages/shared/src/chunks.ts';
import { CHUNK_SIZE, CLIFF } from '../packages/shared/src/constants.ts';
import { T } from '../packages/shared/src/tiles.ts';
const out = process.argv[2] ?? '/tmp/worldgen3-audit';
const half = Number(process.argv[3] ?? 300);
mkdirSync(out, { recursive: true });
const BIOME_RGB = ['#708b4f', '#37543e', '#a27644', '#748d92', '#52695a', '#c2a16a', '#655b85', '#493847'].map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const results = [];
try {
  const page = await browser.newPage();
  for (const [seed, gen] of [20260101, 1337, 7102025].flatMap((sd) => [
    [sd, 2],
    [sd, 3],
  ])) {
    const store = new ChunkStore(seed, 2000, gen);
    const n = half;
    const biomeRgba = [],
      levelRgba = [];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = -half + i * 2,
          y = -half + j * 2,
          t = tileAt(seed, x, y, gen),
          level = store.levelAt(x, y),
          water = t === T.WATER || t === T.DEEP_WATER;
        const [r, g, b] = water
          ? t === T.DEEP_WATER
            ? [20, 40, 100]
            : [40, 90, 160]
          : BIOME_RGB[BIOMES.indexOf(biomeAt(seed, x, y, gen))];
        const shade = 1 + level * 0.07;
        biomeRgba.push(Math.min(255, r * shade), Math.min(255, g * shade), Math.min(255, b * shade), 255);
        const v = water ? 0 : 50 + level * 22;
        levelRgba.push(water ? 20 : v, water ? 40 : v, water ? 100 : v + 20, 255);
      }
    // connectivity from the spawn over the home continent, exactly as movement and pathing treat levels
    const R = 200,
      w = R * 2 + 1,
      idx = (x, y) => (y + R) * w + x + R,
      seen = new Uint8Array(w * w),
      ok = (x, y) => Math.hypot(x, y) <= R && !store.solidAt(x, y),
      stack = [[1, 1]];
    seen[idx(1, 1)] = 1;
    let land = 0,
      reached = 0,
      cliffEdges = 0,
      maxLevel = 0;
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (!ok(nx, ny) || seen[idx(nx, ny)] || Math.abs(store.levelAt(nx, ny) - store.levelAt(x, y)) >= CLIFF)
          continue;
        seen[idx(nx, ny)] = 1;
        stack.push([nx, ny]);
      }
    }
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        if (!ok(x, y)) continue;
        land++;
        if (seen[idx(x, y)]) reached++;
        maxLevel = Math.max(maxLevel, store.levelAt(x, y));
        if (Math.abs(store.levelAt(x + 1, y) - store.levelAt(x, y)) >= CLIFF) cliffEdges++;
      }
    // biome region sizes on a 4-tile grid inside the continent
    const label = new Map();
    const sizes = [];
    const at = (x, y) => (Math.hypot(x, y) <= 200 ? biomeAt(seed, x, y, gen) : null);
    for (let y = -200; y <= 200; y += 4)
      for (let x = -200; x <= 200; x += 4) {
        const b = at(x, y);
        if (!b || label.has(`${x},${y}`)) continue;
        let size = 0;
        const q = [[x, y]];
        label.set(`${x},${y}`, 1);
        while (q.length) {
          const [a, c] = q.pop();
          size++;
          for (const [dx, dy] of [
            [4, 0],
            [-4, 0],
            [0, 4],
            [0, -4],
          ]) {
            const k = `${a + dx},${c + dy}`;
            if (!label.has(k) && at(a + dx, c + dy) === b) {
              label.set(k, 1);
              q.push([a + dx, c + dy]);
            }
          }
        }
        sizes.push({ biome: b, tiles: size * 16 });
      }
    sizes.sort((p, q) => q.tiles - p.tiles);
    results.push({
      seed,
      revision: gen,
      landTilesWithin200: land,
      reachablePercent: +((reached / land) * 100).toFixed(2),
      maxLevel,
      cliffEdges,
      regionsOver1000Tiles: sizes.filter((s) => s.tiles >= 1000).length,
      fragmentsUnder200Tiles: sizes.filter((s) => s.tiles < 200).length,
      biomeRegions: sizes.length,
      largestRegions: sizes.slice(0, 6),
    });
    for (const [name, rgba] of [
      ['biomes', biomeRgba],
      ['levels', levelRgba],
    ]) {
      const png = await page.evaluate(
        ({ rgba, n }) => {
          const small = document.createElement('canvas');
          small.width = small.height = n;
          small.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), n, n), 0, 0);
          const big = document.createElement('canvas');
          big.width = big.height = n * 3;
          const ctx = big.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(small, 0, 0, big.width, big.height);
          return big.toDataURL().split(',')[1];
        },
        { rgba, n },
      );
      writeFileSync(`${out}/${seed}-rev${gen}-${name}.png`, Buffer.from(png, 'base64'));
    }
  }
  writeFileSync(`${out}/report.json`, JSON.stringify({ half, chunk: CHUNK_SIZE, results }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 1));
} finally {
  await browser.close();
}
