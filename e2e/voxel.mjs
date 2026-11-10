// CHROME=/usr/bin/chromium node e2e/voxel.mjs [solo URL] [evidence directory]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? '/tmp/eigenlands-voxel';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [],
    results = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error(e.stack);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.error(m.text());
  });
  await page.goto(`${base}?dev=1&hour=12`);
  await page.fill('#name', 'Voxel');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().voxel?.chunks > 0, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  const state = () => page.evaluate(() => window.__eigen.state());
  const spawn = await state();
  console.log('arrival', spawn.voxel);
  results.push({ area: 'arrival', ...spawn.voxel, fps: spawn.fps });
  assert.equal(spawn.voxel.orthographic, true);
  assert.equal(spawn.voxel.elevation, 30);
  assert.ok(spawn.voxel.triangles > 1000);
  assert.ok(spawn.voxel.actors > 0);
  await page.screenshot({ path: `${out}/arrival.png` });
  console.log(
    'compositor',
    await page.evaluate(() => ({
      alpha: window.__eigen.game.app.renderer.background.alpha,
      stage: window.__eigen.game.app.stage.children.map((o) => ({
        type: o.constructor.name,
        visible: o.visible,
        alpha: o.alpha,
        w: o.width,
        h: o.height,
      })),
      layers: [...document.elementsFromPoint(640, 500)]
        .map((e) => ({
          tag: e.tagName,
          id: e.id,
          bg: getComputedStyle(e).backgroundColor,
          z: getComputedStyle(e).zIndex,
        }))
        .slice(0, 8),
    })),
  );
  await page.locator('#game').evaluate((el) => (el.style.visibility = 'hidden'));
  await page.screenshot({ path: `${out}/world-only.png` });
  await page.locator('#game').evaluate((el) => (el.style.visibility = 'visible'));
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(2200);
  await page.keyboard.up('KeyS');
  const moved = await state();
  assert.ok(moved.x - spawn.x + moved.y - spawn.y > 0.5, 'Screen-down movement preserved');
  await page.mouse.move(800, 350);
  await page.mouse.click(800, 350);
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyI');
  await page.waitForTimeout(300);
  const icons = await page.locator('.hslot img').evaluateAll((imgs) =>
    imgs.map((img) => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
      filter: getComputedStyle(img).imageRendering,
    })),
  );
  assert.ok(
    icons.length > 0 && icons.every((i) => i.width === 64 && i.height === 64),
    'Hotbar uses rendered voxel thumbnails',
  );
  assert.equal(
    await page.locator('.portrait-box img').evaluate((img) => img.naturalWidth),
    160,
    'Equipment portrait uses the voxel character rig',
  );
  await page.screenshot({ path: `${out}/inventory.png` });
  await page.keyboard.press('KeyI');
  console.log(
    'after movement',
    await page.evaluate(() => ({
      fps: window.__eigen.state().fps,
      cpu: window.__eigen.game.frameMs,
      voxel: window.__eigen.state().voxel,
    })),
  );
  if (process.argv.includes('--tour')) {
    const buildings = await page.evaluate(() => window.__eigen.game.buildings.views.map((v) => v.b));
    const inn = buildings.find((b) => b.kind === 'inn') ?? buildings[0];
    const points = [
      ['town', inn.doorX + 0.5, inn.doorY + 2.5],
      ['interior', inn.x + inn.w / 2, inn.y + inn.h / 2],
      ['wilderness', 100, 100],
      ['undercroft', 36.5, 40036.5],
      ['aetheria', 0.5, -299998.5],
      ['umbra', 0.5, -399998.5],
      ['chronoria', 0.5, -499998.5],
    ];
    for (const [area, x, y] of points) {
      await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
      await page.waitForFunction(
        ([x, y]) => Math.hypot(window.__eigen.state().x - x, window.__eigen.state().y - y) < 0.5,
        [x, y],
        { timeout: 30000 },
      );
      await page.waitForTimeout(6000);
      await page.waitForFunction(
        ([x, y]) => Math.hypot(window.__eigen.state().voxel.focus.x - x, window.__eigen.state().voxel.focus.y - y) < 1,
        [x, y],
        { timeout: 30000 },
      );
      const s = await state();
      console.log(area, s.voxel);
      results.push({ area, ...s.voxel, fps: s.fps });
      assert.equal(s.voxel.orthographic, true);
      assert.deepEqual(s.voxel.missingModels, [], `${area} has model coverage`);
      assert.ok(s.voxel.triangles > 1000);
      await page.screenshot({ path: `${out}/${area}.png` });
    }
  }
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  assert.deepEqual(errors, [], 'No runtime exceptions');
  console.log('Voxel playable-area smoke passed');
} finally {
  await browser.close();
}
