import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? '/tmp/eigenlands-combat';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}labs/artlab.html?lab=actions&scale=3&motion=0`);
  await page.waitForFunction(() => window.__lab?.ready);
  const result = await page.evaluate(async () => {
    const { buildActorSheets, OUTFITS, ATTACK_FRAME, RUN_FRAME } = await import('/src/art/actors.ts');
    const sheets = buildActorSheets(), failures = [];
    const fingerprint = (texture) => {
      const f = texture.frame, data = texture.source.resource.getContext('2d').getImageData(f.x, f.y, f.width, f.height).data;
      let hash = 2166136261;
      for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data[i], 16777619);
      return hash >>> 0;
    };
    for (let outfit = 0; outfit < OUTFITS.length; outfit++) for (let direction = 0; direction < 8; direction++) {
      const strikes = new Set(Array.from({ length: 4 }, (_, f) => fingerprint(sheets.person(outfit, direction, ATTACK_FRAME + f))));
      const running = new Set(Array.from({ length: 8 }, (_, f) => fingerprint(sheets.person(outfit, direction, RUN_FRAME + f))));
      if (strikes.size < 3 || running.size < 4) failures.push({ outfit, direction, strikes: strikes.size, running: running.size });
      if (sheets.person(outfit, direction, -1).frame.x !== 0) failures.push({ outfit, direction, idle: 'not stable' });
    }
    return { failures, outfits: OUTFITS.length };
  });
  assert.deepEqual(result.failures, [], 'All directional outfits have distinct action poses and stable reduced-motion idle');
  assert.deepEqual(errors, [], 'No runtime errors');
  await page.screenshot({ path: `${out}/actions.png` });
  console.log(`Action sprites passed for ${result.outfits} outfits in eight directions`);
} finally { await browser.close(); }
