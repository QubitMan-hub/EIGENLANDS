// Real stairs and diving transitions, shared by the solo build and multiplayer dev server.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { tsImport } from 'tsx/esm/api';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/';
const out = process.argv[3] ?? '/tmp/eigenlands-realms';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  console.log('Loading', base);
  await page.goto(`${base}?dev=1&hour=12`);
  console.log('Login');
  await page.waitForSelector('#g-off:not([hidden])');
  await page.fill('#name', 'Realms');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
  for (let i = 0; i < 2 && (await page.locator('.p3-lumen-skip').isVisible()); i++)
    await page.locator('.p3-lumen-skip').click();
  console.log('Ready');
  const seed = await page.evaluate(() => window.__eigen.game.seed);
  const { townsFor } = await tsImport('../packages/shared/src/town.ts', import.meta.url);
  const { oceanShrine, DIVE_OY } = await tsImport('../packages/shared/src/sanctuaries.ts', import.meta.url);
  const upSite = townsFor(seed)[0].objects.find((o) => o.sub === 'stairs_up');
  let shrine;
  for (let y = -12; y <= 12 && !shrine; y++)
    for (let x = -12; x <= 12 && !shrine; x++) {
      const v = oceanShrine(seed, x, y);
      if (v?.type === 'platform') shrine = v;
    }
  const data = { up: upSite, sh: shrine, dive: DIVE_OY };
  console.log('Sites', data);
  assert.ok(data.up && data.sh);
  const { shardAt } = await tsImport('../packages/shared/src/shards.ts', import.meta.url);
  const tp = async (x, y) => {
    await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
    await page.waitForFunction(
      ([x, y]) => {
        const s = window.__eigen.state();
        return Math.hypot(s.x - x, s.y - y) < 0.2;
      },
      [x, y],
      { timeout: 40000 },
    );
    await page.waitForFunction(
      (shard) => !window.__eigen.game.net.switching && window.__eigen.state().shard === shard,
      shardAt(x, y),
      { timeout: 40000 },
    );
    await page.waitForTimeout(300);
  };
  const { up, sh, dive } = data;
  console.log('Stairs');
  await tp(up.x + 0.5, up.y + 0.5);
  console.log(
    'Stair state',
    await page.evaluate(
      ([x, y]) => {
        const g = window.__eigen.game;
        return {
          object: g.store.objectAt(x, y),
          switching: g.net.switching,
          blocking: g.gameplay.blocking,
          focus: document.activeElement?.tagName,
        };
      },
      [up.x, up.y],
    ),
  );
  await page.waitForFunction(([x, y]) => window.__eigen.game.store?.objectAt(x, y)?.sub === 'stairs_up', [up.x, up.y], {
    timeout: 30000,
  });
  assert.equal(
    await page.evaluate(() => window.__eigen.game.gameplay.interact()),
    true,
    'E interaction handler accepts the target',
  );
  await page.waitForFunction((y) => Math.abs(window.__eigen.state().y - y) < 0.3, up.data.to.y, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#townhint').textContent.includes('Upper floor'));
  await page.screenshot({ path: `${out}/upper-floor.png` });
  console.log('Upper saved');
  await page.reload();
  await page.waitForFunction(
    (y) => window.__eigen?.state().ready && Math.abs(window.__eigen.state().y - y) < 0.3,
    up.data.to.y,
    { timeout: 60000 },
  );
  await page.waitForFunction(
    ([x, y]) => window.__eigen.game.store?.objectAt(x, y)?.sub === 'stairs_down',
    [up.x, Math.floor(up.data.to.y)],
    { timeout: 30000 },
  );
  assert.equal(
    await page.evaluate(() => window.__eigen.game.gameplay.interact()),
    true,
    'E interaction handler accepts the target',
  );
  await page.waitForFunction((y) => Math.abs(window.__eigen.state().y - y) < 0.3, up.y + 0.5, { timeout: 30000 });
  await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'give', id: 'sloop', n: 1 }));
  console.log('Diving');
  await tp(sh.x + 0.5, sh.y - dive + 0.5);
  await page.evaluate(([x, y]) => window.__eigen.game.net.send('open', { tx: x, ty: y }), [sh.x, sh.y - dive]);
  await page.waitForFunction((y) => Math.abs(window.__eigen.state().y - y) < 0.3, sh.y + 7.5, { timeout: 40000 });
  await page.waitForFunction(() => document.querySelector('#townhint').textContent.includes('Submerged sanctuary'));
  await page.screenshot({ path: `${out}/sanctuary.png` });
  await tp(sh.x + 0.5, sh.y + 0.5);
  await page.evaluate(([x, y]) => window.__eigen.game.net.send('open', { tx: x, ty: y }), [sh.x, sh.y]);
  await page.waitForFunction((y) => Math.abs(window.__eigen.state().y - y) < 0.3, sh.y + 4.5);
  await page.screenshot({ path: `${out}/phase-platform.png` });
  await tp(sh.x + 0.5, sh.y + 7.5);
  assert.equal(
    await page.evaluate(() => window.__eigen.game.gameplay.interact()),
    true,
    'E interaction handler accepts the target',
  );
  await page.waitForFunction(
    (y) => Math.abs(window.__eigen.state().y - y) < 0.3 && window.__eigen.game.predictor.sim.boat === 1,
    sh.y - dive + 0.5,
    { timeout: 40000 },
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/surfaced.png` });
  assert.deepEqual(errors, []);
  console.log('Realms browser passed: stairs, saved upper floor, return, dive, chamber, sloop surface; no page errors');
} catch (e) {
  for (const p of browser.contexts().flatMap((c) => c.pages()))
    await p.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
