import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1240 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5173/'}labs/artlab.html?lab=equipment&scale=3&motion=0`);
  await page.waitForFunction(() => window.__lab?.ready);
  const failures = await page.evaluate(async () => {
    const { HeldWeapons } = await import('/src/art/weapons.ts');
    const { WEAPONS } = await import(performance.getEntriesByType('resource').find(e => /\/packages\/shared\/src\/equipment\.ts(?:\?|$)/.test(e.name)).name);
    const art = new HeldWeapons(), failures = [];
    for (const id of Object.keys(WEAPONS)) for (let d = 0; d < 8; d++) for (let f = 0; f < 30; f++) {
      const t = art.texture(id, d, f), r = t.frame;
      const data = t.source.resource.getContext('2d').getImageData(r.x, r.y, r.width, r.height).data;
      let count = 0, edge = 0;
      for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (data[(y * r.width + x) * 4 + 3]) {
        count++; if (!x || !y || x === r.width - 1 || y === r.height - 1) edge++;
      }
      if (count < 12 || edge) failures.push({ id, d, f, count, edge });
      if (art.texture(id, d, f) !== t) failures.push({ id, cache: false });
    }
    return failures;
  });
  assert.deepEqual(failures, [], 'Held equipment has visible geometry, no cropped edges and cached frames');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: '/tmp/eigenlands-equipment.png' });
  console.log('Seven weapons × eight facings × thirty poses: bounds and texture reuse passed');
} finally { await browser.close(); }
