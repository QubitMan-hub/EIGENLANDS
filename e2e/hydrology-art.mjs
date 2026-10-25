import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const out = process.argv[2] ?? '/tmp/hydrology-art';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const hashes = [];
  for (const generation of [1, 2]) {
    await page.goto(
      `http://127.0.0.1:5174/labs/artlab.html?x=132&y=-4&seed=20260101&scale=3&hour=12&motion=0&generation=${generation}`,
    );
    await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
    await page.waitForTimeout(400);
    const bytes = await page.screenshot({ path: `${out}/wetland-v${generation}.png` });
    hashes.push(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.notEqual(hashes[0], hashes[1]);
  await page.goto(
    'http://127.0.0.1:5174/labs/artlab.html?x=-400&y=416&seed=20260101&scale=4&hour=20&motion=0&generation=2',
  );
  await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/surface-lava.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: `${out}/lava-landscape.png` });
  assert.deepEqual(errors, []);
  console.log('PASS actual terrain shader wetland before/after and sparse surface lava');
} finally {
  await browser.close();
}
