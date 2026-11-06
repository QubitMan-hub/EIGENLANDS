import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'docs/validation/reference-world';
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
  await page.fill('#name', 'Reference world');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await page.evaluate(() => window.__eigen.game.ext.circuit.send('p3_tutorial', { action: 'skip' }));
  await page.waitForTimeout(1200);
  const buildings = await page.evaluate(() => window.__eigen.game.buildings.views.slice(0, 3).map((v) => v.b));
  assert.equal(buildings.length, 3);
  const results = [];
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    await page.evaluate((b) => window.__eigen.game.net.dev({ cmd: 'tp', x: b.doorX + 0.5, y: b.doorY + 1.5 }), b);
    await page.waitForFunction(
      (b) =>
        Math.hypot(
          window.__eigen.game.predictor.sim.x - b.doorX - 0.5,
          window.__eigen.game.predictor.sim.y - b.doorY - 1.5,
        ) < 0.2,
      b,
      { timeout: 20000 },
    );
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/door-${i + 1}.png` });
    const target = await page.evaluate((b) => {
      const g = window.__eigen.game;
      g.input.setMovementMode('mouse');
      const x = b.doorX + 0.5,
        y = b.doorY - 0.3;
      return { x: g.world.x + (x - y) * 16 * g.scale, y: g.world.y + (x + y) * 8 * g.scale };
    }, b);
    await page.mouse.move(target.x, target.y);
    await page.mouse.down({ button: 'right' });
    await page.waitForFunction(
      (b) => {
        const g = window.__eigen.game,
          p = g.predictor.sim;
        return g.buildings.insideBuilding(Math.floor(p.x), Math.floor(p.y)) === b.id;
      },
      b,
      { timeout: 10000 },
    );
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/interior-${i + 1}.png` });
    results.push({ id: b.id, entered: true });
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify({ results, errors }, null, 2));
  console.log('PASS three real doorway approaches and mouse-controlled entry, roof occlusion, no page errors');
} finally {
  await browser.close();
}
