// node --import tsx e2e/worldgen3-art.mjs <dev-server-url> [output-directory]
// Same spot, revision 2 and revision 3, through the art lab's real renderer: every biome, a mountain pass, a river ford
// and a beach. The lab is served by `npm run dev -w @eigenlands/client` (default http://127.0.0.1:5299/).
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { BIOMES, biomeAt, tileAt } from '../packages/shared/src/worldgen.ts';
import { ChunkStore } from '../packages/shared/src/chunks.ts';
import { T } from '../packages/shared/src/tiles.ts';
import { massifOfCell } from '../packages/shared/src/terrain3.ts';
const base = process.argv[2] ?? 'http://127.0.0.1:5299/';
const out = process.argv[3] ?? '/tmp/worldgen3-art';
mkdirSync(out, { recursive: true });
const seed = 20260101;
const store = new ChunkStore(seed, 2000, 3);
const spots = [];
// the interior of each biome: the land tile with the most same-biome dry neighbours inside a 10-tile ring
for (const biome of BIOMES) {
  let best = null;
  for (let y = -200; y <= 200; y += 6)
    for (let x = -200; x <= 200; x += 6) {
      if (Math.hypot(x, y) > 190 || Math.hypot(x, y) < 20 || biomeAt(seed, x, y, 3) !== biome) continue;
      let n = 0,
        flat = 0;
      for (let a = 0; a < 16; a++) {
        const px = Math.round(x + Math.cos(a * 0.39) * 10),
          py = Math.round(y + Math.sin(a * 0.39) * 10);
        const t = tileAt(seed, px, py, 3);
        if (biomeAt(seed, px, py, 3) === biome && t !== T.WATER && t !== T.DEEP_WATER) n++;
        if (store.levelAt(px, py) === store.levelAt(x, y)) flat++;
      }
      const score = n * 2 + flat;
      if (!best || score > best.score) best = { x, y, score };
    }
  if (best) spots.push({ name: biome, x: best.x, y: best.y });
}
let mount = null;
for (let j = -3; j <= 3; j++)
  for (let i = -3; i <= 3; i++) {
    const m = massifOfCell(seed, i, j);
    if (m && Math.hypot(m.x, m.y) < 190 && (!mount || m.r > mount.r)) mount = m;
  }
if (mount) spots.push({ name: 'mountain', x: mount.x + 6, y: mount.y + mount.r * 0.6 });
spots.push({ name: 'river-ford', x: 130, y: -40 }, { name: 'beach', x: 170, y: 100 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => errors.push(e.message));
  for (const s of spots)
    for (const generation of [2, 3]) {
      await page.goto(
        `${base}labs/artlab.html?x=${s.x}&y=${s.y}&generation=${generation}&scale=2&hour=12&nonpc=1&motion=0`,
      );
      await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 120000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}/${s.name}-rev${generation}.png` });
    }
  writeFileSync(`${out}/spots.json`, JSON.stringify({ seed, spots }, null, 2) + '\n');
  console.log(spots.map((s) => `${s.name}@${s.x},${s.y}`).join('  '));
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
