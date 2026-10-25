// Run against a dev client/server or a served solo build.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? '/tmp/eigenlands-combat';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
// Observe actual rendered poses before input: a CDP round-trip may outlast a 220 ms strike in software rendering.
const watchPoses = (page, id) =>
  page.evaluate((id) => {
    window.__motionFrames ??= {};
    window.__motionFrames[id] = [];
    const g = window.__eigen.game;
    g.app.ticker.add(() => {
      const v = g.views.get(id);
      if (!v) return;
      const frame = v.sprite.texture.frame.x / 24;
      if (!window.__motionFrames[id].includes(frame)) window.__motionFrames[id].push(frame);
    });
  }, id);
const sawPose = (page, id, frame) =>
  page.waitForFunction(({ id, frame }) => window.__motionFrames[id]?.includes(frame), { id, frame });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = new URL(base);
  url.searchParams.set('dev', '1');
  url.searchParams.set('lag', '150');
  url.searchParams.set('jitter', '20');
  await page.goto(url.href);
  await page.waitForSelector('#g-off:not([hidden])');
  await page.fill('#name', 'Motion');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
  await page.locator('.p3-lumen-skip').click();
  await page.locator('.p3-lumen-skip').click();
  assert.equal(await page.locator('#chat').isVisible(), false, 'Compact screens start with chat collapsed');
  assert.ok(
    (await page.locator('#toasts .toast:visible').count()) <= 2,
    'Short desktop windows keep only two recent notifications visible',
  );
  const hintRight = await page.locator('#hint').evaluate((e) => e.getBoundingClientRect().right);
  assert.ok(hintRight < 320, 'Tutorial hint leaves the player at the centre visible');
  await page.getByRole('button', { name: 'Open chat', exact: true }).click();
  assert.equal(await page.locator('#chat').isVisible(), true, 'Chat remains available');
  await page.getByRole('button', { name: 'Hide chat', exact: true }).click();
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.net.dev({ cmd: 'level', level: 50 });
    g.settings().reducedMotion = true;
  });
  const ownId = await page.evaluate(() => window.__eigen.game.myId);
  await watchPoses(page, ownId);
  await page.keyboard.press('KeyJ');
  await sawPose(page, ownId, 12);
  assert.equal(
    await page.evaluate(() => window.__eigen.game.combat.warp),
    0,
    'Light strikes do not freeze remote movement',
  );
  await page.screenshot({ path: `${out}/strike.png` });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__eigen.game.settings().reducedMotion = false;
  });
  await page.keyboard.down('KeyD');
  await page.keyboard.press('ShiftLeft');
  await page.waitForFunction(() => {
    const g = window.__eigen.game;
    return g.views.get(g.myId).sprite.texture.frame.x >= 14 * 24;
  });
  await page.screenshot({ path: `${out}/run.png` });
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(700);
  const state = await page.evaluate(() => {
    const g = window.__eigen.game,
      v = g.views.get(g.myId);
    const scale = g.scale * g.app.renderer.resolution;
    return { frame: v.sprite.texture.frame.x / 24, x: v.root.x * scale, y: v.root.y * scale };
  });
  assert.ok(state.frame < 10, 'Player returns to locomotion/idle after striking and dashing');
  assert.ok(
    Math.abs(state.x - Math.round(state.x)) < 1e-6 && Math.abs(state.y - Math.round(state.y)) < 1e-6,
    'Motion lands on device pixels',
  );
  const paints = await page.evaluate(() => {
    const terrain = window.__eigen.game.terrain,
      renderer = terrain.renderer;
    const original = renderer.render;
    let count = 0;
    renderer.render = function (options) {
      if (options.target === terrain.rt) count++;
      return original.call(this, options);
    };
    try {
      terrain.render(0, 0, 0, 0, 0, 1, false);
      terrain.render(0, 0, 0, 0, 1, 1, false);
      const stationary = count;
      terrain.render(1, 0, 0, 0, 2, 1, false);
      terrain.render(1, 0, 0, 0, 3, 2, false);
      terrain.render(1, 0, 0, 0, 4, 2, true);
      terrain.render(1, 0, 0, 0, 5, 2, true);
      return { stationary, total: count };
    } finally {
      renderer.render = original;
    }
  });
  assert.equal(paints.stationary, 1, 'Reduced motion reuses an unchanged terrain frame');
  assert.equal(paints.total, 5, 'Camera, season and animated terrain still repaint');
  if (process.argv.includes('--peers')) {
    await page.evaluate(() => {
      window.__eigen.game.settings().reducedMotion = true;
    });
    const observer = await browser.newPage({ viewport: { width: 640, height: 480 } });
    observer.on('pageerror', (error) => errors.push(error.message));
    await observer.goto(url.href);
    await observer.waitForSelector('#g-off:not([hidden])');
    await observer.fill('#name', 'Observer');
    await observer.click('#btn-guest');
    await observer.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
    await observer.locator('.p3-lumen-skip').click();
    await observer.locator('.p3-lumen-skip').click();
    await observer.evaluate(() => {
      window.__eigen.game.settings().reducedMotion = true;
    });
    const id = await page.evaluate(() => window.__eigen.game.myId);
    await observer.waitForFunction((id) => window.__eigen.game.views.has(id), id);
    await watchPoses(observer, id);
    await page.bringToFront();
    await page.keyboard.press('KeyJ');
    await sawPose(page, id, 12);
    await observer.bringToFront();
    await sawPose(observer, id, 12);
    assert.equal(
      await observer.evaluate(() => window.__eigen.game.combat.warp),
      0,
      'Remote strikes leave observer movement unfrozen',
    );
    await observer.screenshot({ path: `${out}/remote-strike.png` });
    await page.bringToFront();
    await page.evaluate(() => {
      window.__eigen.game.net.dev({ cmd: 'give', id: 'crossbow', n: 1 });
    });
    await page.waitForFunction(() => window.__eigen.game.gameplay.profile.inv.some((s) => s?.id === 'crossbow'));
    await page.evaluate(() => {
      const g = window.__eigen.game;
      g.net.equip({ as: 'weapon', slot: g.gameplay.profile.inv.findIndex((s) => s?.id === 'crossbow') });
    });
    await page.waitForFunction(() => {
      const g = window.__eigen.game;
      return g.gameplay.profile.equip.weapon?.id === 'crossbow' && g.views.get(g.myId)?.held?.visible;
    });
    await observer.bringToFront();
    await observer.waitForFunction((id) => {
      const g = window.__eigen.game;
      return g.interp.sample(id, Number.MAX_SAFE_INTEGER)?.pose.weapon === 'crossbow' && g.views.get(id)?.held?.visible;
    }, id);
    await page.bringToFront();
    await page.keyboard.press('KeyJ');
    await sawPose(page, id, 24);
    await observer.bringToFront();
    await sawPose(observer, id, 24);
    await observer.screenshot({ path: `${out}/remote-crossbow.png` });
    await page.bringToFront();
    await page.evaluate(() => {
      window.__eigen.game.net.equip({ as: 'unequip_weapon', slot: 0 });
    });
    await page.waitForFunction(() => {
      const g = window.__eigen.game;
      return !g.gameplay.profile.equip.weapon && !g.views.get(g.myId)?.held?.visible;
    });

    await observer.close();
    console.log('Two-player authoritative strike presentation passed');
  }
  assert.deepEqual(errors, [], 'No runtime errors');
  console.log(
    'Combat input, strike/run poses, recovery, reduced motion and pixel alignment passed with 150ms simulated latency',
  );
} finally {
  await browser.close();
}
