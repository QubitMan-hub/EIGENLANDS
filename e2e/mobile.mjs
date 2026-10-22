// CHROME=/path/to/chromium node e2e/mobile.mjs [multiplayer or solo URL]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader'],
});
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.waitForSelector('#btn-guest');
  assert.equal(await page.locator('#rotate-device').isVisible(), true, 'Portrait prompts rotation');
  await page.click('#btn-portrait');
  assert.equal(await page.locator('#rotate-device').isVisible(), false, 'Portrait remains available');
  await page.evaluate(() => {
    window.__fullscreenRequests = 0;
    document.documentElement.requestFullscreen = async () => { window.__fullscreenRequests++; };
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#rotate-device').isVisible(), false, 'Landscape is unobstructed');
  await page.waitForFunction(() => !document.querySelector('#g-off').hidden);
  await page.fill('#name', 'Mobile');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.__fullscreenRequests), 0, 'Play respects the chosen portrait fallback instead of requesting landscape again');
  assert.equal(await page.locator('#touch').isVisible(), true);
  const zoom = await page.evaluate(() => ({ scale: window.__eigen.game.scale, resolution: window.__eigen.game.app.renderer.resolution }));
  assert.ok(zoom.scale >= 1.5, 'Landscape phones retain readable sprites and a bounded terrain render target');
  assert.equal(zoom.scale * zoom.resolution, Math.round(zoom.scale * zoom.resolution), 'World scaling uses integer device pixels');
  for (const selector of ['#stick', '#tbtns [data-a="attack"]', '#tbtns [data-a="skill"]', '#tbtns [data-a="dash"]', '#tbtns [data-a="interact"]', '#btn-settings', '#hotbar']) {
    const rect = await page.locator(selector).boundingBox();
    assert.ok(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 844 && rect.y + rect.height <= 390, `${selector} fits landscape`);
  }
  const buttons = await page.locator('#hud-btns').boundingBox();
  assert.ok(buttons.height < 60, 'HUD buttons use a horizontal row');
  await page.locator('.p3-lumen-skip').click();
  await page.locator('.p3-lumen-skip').click();
  await page.waitForTimeout(500);
  const notifications = await page.locator('#toasts .toast').evaluateAll((nodes) => nodes.filter((el) => getComputedStyle(el).display !== 'none').map((el) => el.getBoundingClientRect().top));
  assert.ok(notifications.length <= 2 && notifications.every((top) => top >= 100), 'Notification bursts leave the top HUD clear');
  const tutorial = await page.locator('#hint').boundingBox();
  if (tutorial) assert.ok(tutorial.x + tutorial.width < 844 / 2 - 24, 'Tutorial guidance leaves the player silhouette clear');
  const hint = await page.locator('#target-hint').boundingBox(), abilities = await page.locator('#p3-abar').boundingBox();
  if (hint && abilities) assert.ok(hint.y + hint.height <= abilities.y, 'Interaction prompts do not cover ability buttons');
  const coverage = await page.evaluate(() => {
    const game = window.__eigen.game, sprite = game.lighting.sprite;
    // Inspect the submitted Pixi quad; the public bounds getter recalculates it and masks this regression.
    const quad = sprite._gpuData[game.app.renderer.uid].bounds;
    return { rendered: quad.maxX * game.scale, required: innerWidth };
  });
  assert.ok(coverage.rendered >= coverage.required, 'Night lighting covers the full rotated viewport');
  assert.deepEqual(errors, [], 'No browser runtime errors');
  await page.screenshot({ path: '/tmp/eigenlands-mobile-landscape.png' });
  console.log('Mobile landscape, portrait fallback, control bounds, resized lighting and runtime checks passed');
} finally {
  await browser.close();
}
