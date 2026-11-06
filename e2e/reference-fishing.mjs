// Presentation fixture; authority and rewards remain covered by the server fishing tests.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'docs/validation/reference-fishing';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${process.argv[2] ?? 'http://127.0.0.1:5244/'}?dev=1&hour=12`);
  await p.fill('#name', 'Fishing presentation');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await p.evaluate(() => window.__eigen.game.ext.circuit.send('p3_tutorial', { action: 'skip' }));
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const g = window.__eigen.game,
      m = g.predictor.sim;
    window.__fishFrames = [];
    g.app.ticker.add(() => window.__fishFrames.push(g.views.get(g.myId).personFrame), undefined, -100);
    g.gameplay.onFishCast({ id: 'visual-reel', tx: Math.floor(m.x) + 2, ty: Math.floor(m.y) });
    g.gameplay.onRhythmStart({
      id: 'visual-reel',
      kind: 'fish',
      label: 'Reeling fixture',
      plan: { startAt: Date.now() + 10000, intervalMs: 600, count: 3, windowMs: 180 },
    });
  });
  await p.waitForFunction(() => window.__fishFrames.some((f) => f >= 206 && f <= 213));
  assert.equal(await p.evaluate(() => window.__eigen.game.views.get(window.__eigen.game.myId).held.visible), true);
  await p.screenshot({ path: `${out}/reel.png` });
  await p.evaluate(() => {
    const g = window.__eigen.game,
      m = g.predictor.sim;
    g.gameplay.onRhythmResult({
      id: 'visual-reel',
      kind: 'fish',
      accuracy: 1,
      ok: true,
      text: 'Presentation fixture; no reward granted',
    });
    g.fxFromServer({ kind: 'catch', id: g.myId, weapon: 'rod', x: m.x, y: m.y });
  });
  await p.getByRole('button', { name: 'Continue', exact: true }).click();
  await p.waitForFunction(() => window.__fishFrames.some((f) => f >= 214 && f <= 221));
  await p.screenshot({ path: `${out}/land.png` });
  await p.evaluate(() => {
    const g = window.__eigen.game,
      m = g.predictor.sim;
    g.fxFromServer({ kind: 'plant', id: g.myId, x: m.x + 1, y: m.y });
  });
  await p.waitForFunction(() => window.__fishFrames.some((f) => f >= 222 && f <= 229));
  assert.deepEqual(errors, []);
  writeFileSync(
    `${out}/report.json`,
    JSON.stringify({ frames: await p.evaluate(() => Array.from(new Set(window.__fishFrames))), errors }, null, 2),
  );
  console.log('PASS retained rod/reel, distinct landing after result, kneeling planting and no page errors');
} finally {
  await browser.close();
}
