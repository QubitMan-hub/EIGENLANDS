import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'test-results/guard';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5244/'}?dev=1&hour=12`);
  await page.fill('#name', 'Guard audit');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await page.evaluate(() => window.__eigen.game.ext.circuit.send('p3_tutorial', { action: 'skip' }));
  await page.waitForTimeout(700);
  await page.keyboard.down('ControlLeft');
  await page.waitForFunction(() => window.__eigen.game.predictor.sim.guard > 0);
  await page.waitForTimeout(350);
  const guarded = await page.evaluate(() => {
    const g = window.__eigen.game,
      p = g.predictor.sim,
      v = g.views.get(g.myId);
    return { guard: p.guard, frame: v.personFrame, stamina: p.stamina, charge: p.charge, parry: p.parryT };
  });
  assert.equal(guarded.guard, 1);
  assert.equal(guarded.frame, 202);
  assert.equal(guarded.charge, 0);
  assert.equal(guarded.parry, 0);
  assert.ok(guarded.stamina < 100);
  await page.screenshot({ path: `${out}/stance.png` });
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(60);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('ControlLeft');
  await page.waitForFunction(() => window.__eigen.game.predictor.sim.guard === 0);
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify({ guarded, errors }, null, 2));
  console.log('PASS guard input, dedicated pose, stamina drain, parry expiry and dodge/release handoff');
} finally {
  await browser.close();
}
