import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? '/tmp/eigenlands-ecology';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${m.text()} ${m.location().url}`);
  });
  await page.goto(`${base}labs/artlab.html?lab=foliage&scale=3&motion=0`);
  await page.waitForFunction(() => window.__lab?.ready);
  const failures = await page.evaluate(async () => {
    const { buildTrees } = await import('/src/art/objects.ts');
    const { buildSceneryArt } = await import('/src/art/scenery.ts');
    const failures = [];
    const check = (sp, label) => {
      const w = sp.tex.width,
        h = sp.tex.height;
      const p = sp.tex.source.resource.getContext('2d').getImageData(0, 0, w, h).data;
      let opaque = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (p[(y * w + x) * 4 + 3]) {
            opaque++;
            // Root shadows intentionally touch the bottom of some tree frames.
            if ((!x || x === w - 1 || !y) && y < sp.ay - 4) failures.push(`${label}: clipped crown`);
          }
      if (opaque < 20) failures.push(`${label}: empty`);
      sp.tex.destroy(true);
    };
    for (let s = 0; s < 4; s++) buildTrees(s).forEach((sp, i) => check(sp, `tree ${s}/${i}`));
    for (const [kind, frames] of Object.entries(buildSceneryArt()))
      frames.forEach((sp, i) => check(sp, `${kind}/${i}`));
    return failures;
  });
  assert.deepEqual(failures, []);
  await page.screenshot({ path: `${out}/foliage.png` });
  // Real chunk renderer, not hand-placed display objects; include negative coordinates and seasons.
  for (const [name, query] of [
    ['woodland', 'seed=1337&x=105&y=-20&season=1'],
    ['coast', 'seed=20260101&x=115&y=-34&season=1'],
    ['autumn', 'seed=1337&x=-120&y=60&season=2'],
    ['winter', 'seed=1337&x=105&y=-20&season=3'],
    ['guardian', 'lab=town&season=1&nonpc=1'],
    ['groundcover', 'lab=wilderness&season=1'],
  ]) {
    await page.goto(`${base}labs/artlab.html?${query}&scale=3&motion=0&nonpc=1`);
    await page.waitForFunction(() => window.__lab?.ready);
    // Readiness is set inside the update callback; let Pixi submit that frame before capturing.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const shot = await page.screenshot({ path: `${out}/${name}.png` });
    assert.ok(shot.length > 12000, `${name}: expected a rendered scene rather than an empty canvas`);
  }
  assert.deepEqual(errors, [], 'No runtime or shader compilation errors');
  console.log('Ecology art: 24 seasonal tree frames, reeds/ferns, six rendered scenes and shader checks passed');
} finally {
  await browser.close();
}
