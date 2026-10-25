// node --import tsx tools/hydrology-audit.mjs [output-directory]
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { biomeAt, sampleClimate, tileAt } from '../packages/shared/src/worldgen.ts';
import { T } from '../packages/shared/src/tiles.ts';
const out = process.argv[2] ?? '/tmp/hydrology-audit';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const results = [];
try {
  const page = await browser.newPage();
  for (const seed of [20260101, 1337, 7102025])
    for (const generation of [1, 2]) {
      const width = 320,
        wet = new Set(),
        rgba = [],
        color = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255];
      for (let y = -160; y < 160; y++)
        for (let x = -160; x < 160; x++) {
          const tile = tileAt(seed, x, y, generation),
            fen = biomeAt(seed, x, y) === 'swamp' && sampleClimate(seed, x, y).height >= -0.2;
          const water = tile === T.WATER || tile === T.DEEP_WATER;
          if (fen && tile === T.WATER) wet.add(`${x},${y}`);
          rgba.push(
            ...color(
              tile === T.LAVA ? 0xdd985f : fen && water ? 0x69aab0 : water ? 0x224555 : fen ? 0x78965e : 0x305343,
            ),
          );
        }
      const waterTiles = wet.size,
        areas = [];
      while (wet.size) {
        const start = wet.values().next().value;
        wet.delete(start);
        const queue = [start];
        for (let i = 0; i < queue.length; i++) {
          const [x, y] = queue[i].split(',').map(Number);
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const key = `${x + dx},${y + dy}`;
            if (wet.delete(key)) queue.push(key);
          }
        }
        areas.push(queue.length);
      }
      results.push({
        seed,
        generation,
        waterTiles,
        pools: areas.length,
        largestPoolTiles: Math.max(...areas),
        tilesInPoolsUnder5: areas.filter((n) => n < 5).reduce((a, b) => a + b, 0),
      });
      const png = await page.evaluate(
        ({ rgba, width }) => {
          const small = document.createElement('canvas');
          small.width = small.height = width;
          small.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), width, width), 0, 0);
          const output = document.createElement('canvas');
          output.width = output.height = width * 2;
          const ctx = output.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(small, 0, 0, output.width, output.height);
          return output.toDataURL().split(',')[1];
        },
        { rgba, width },
      );
      writeFileSync(`${out}/${seed}-v${generation}.png`, Buffer.from(png, 'base64'));
    }
  writeFileSync(
    `${out}/report.json`,
    JSON.stringify({ bounds: [-160, -160, 160, 160], step: 1, results }, null, 2) + '\n',
  );
  console.log(results);
} finally {
  await browser.close();
}
