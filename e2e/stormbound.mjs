import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5240/';
const out = process.argv[3] ?? '/tmp/stormbound-play';
const touch = process.argv.includes('touch');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({
    viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 },
    hasTouch: touch,
    isMobile: touch,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    (reducedMotion) => localStorage.setItem('eigen.settings', JSON.stringify({ graphics: 'economy', reducedMotion })),
    touch,
  );
  await page.goto(`${base}?dev=1&hour=12`);
  await page.fill('#name', 'Storm challenger');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 90000,
  });
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 20;
    g.net.dev({ cmd: 'level', level: 22 });
    g.net.dev({ cmd: 'give', id: 'storm_beacon', n: 2 });
    g.net.dev({ cmd: 'tp', x: 132.5, y: -4.5 });
  });
  await page.waitForFunction(() => Math.hypot(window.__eigen.state().x - 132.5, window.__eigen.state().y + 4.5) < 0.2);
  await page.waitForTimeout(1200);
  const point = await page.evaluate(() => {
    const g = window.__eigen.game,
      s = g.predictor.sim;
    for (let y = -24; y < 24; y++)
      for (let x = 149; x >= 115; x--) {
        const bx = x + 0.5 + s.faceX * 4,
          by = y + 0.5 + s.faceY * 4;
        if (g.store.solidAt(x, y)) continue;
        if (
          [
            [0, 0],
            [2, 0],
            [-2, 0],
            [0, 2],
            [0, -2],
          ].every(([dx, dy]) => !g.store.solidAt(Math.floor(bx + dx), Math.floor(by + dy)))
        )
          return { x: x + 0.5, y: y + 0.5 };
      }
    throw Error('No natural Veyr clearing');
  });
  await page.evaluate((point) => window.__eigen.game.net.dev({ cmd: 'tp', ...point }), point);
  await page.waitForFunction(
    (point) => Math.hypot(window.__eigen.state().x - point.x, window.__eigen.state().y - point.y) < 0.2,
    point,
  );
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.count('storm_beacon') === 2);
  await page.evaluate(() => {
    const g = window.__eigen.game,
      s = g.predictor.sim;
    g.net.use({
      slot: g.gameplay.profile.inv.findIndex((item) => item?.id === 'storm_beacon'),
      tx: Math.floor(s.x),
      ty: Math.floor(s.y),
    });
  });
  await page.waitForFunction(
    () => [...window.__eigen.game.views.values()].some((v) => v.kind === 33 && v.sprite.texture.width === 96),
    null,
    { timeout: 15000 },
  );
  assert.equal(await page.evaluate(() => window.__eigen.game.gameplay.profile.count('storm_beacon')), 1);
  await page.screenshot({ path: `${out}/summoned.png` });
  await page.waitForTimeout(6500);
  await page.screenshot({ path: `${out}/lightning.png` });
  await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'kill', d: 30 }));
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.count('storm_heart') > 0, null, {
    timeout: 15000,
  });
  await page.screenshot({ path: `${out}/reward.png` });
  assert.deepEqual(errors, []);
  console.log('PASS Veyr summoned with a real beacon, isometric atlas, lightning fight and unique loot', { touch });
} finally {
  await browser.close();
}
