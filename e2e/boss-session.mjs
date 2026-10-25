// Real authoritative summon → replicated boss → selected boss HUD, usable with solo and multiplayer.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/';
const { tileAt } = await tsImport('../packages/shared/src/worldgen.ts', import.meta.url);
const { TILE_DEFS } = await tsImport('../packages/shared/src/tiles.ts', import.meta.url);
const { townFor } = await tsImport('../packages/shared/src/town.ts', import.meta.url);
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?dev=1&hour=12`);
  await page.waitForSelector('#g-off:not([hidden])');
  await page.fill('#name', 'Summoner');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
  for (let i = 0; i < 2 && (await page.locator('.p3-lumen-skip').isVisible()); i++)
    await page.locator('.p3-lumen-skip').click();
  const seed = await page.evaluate(() => window.__eigen.game.seed),
    town = townFor(seed);
  let site;
  for (let y = 40; y < 110 && !site; y++)
    for (let x = 90; x < 140 && !site; x++) {
      if (Math.hypot(x - town.cx, y - town.cy) < 65) continue;
      let open = true;
      for (let dy = -4; dy <= 4 && open; dy++)
        for (let dx = -4; dx <= 4; dx++)
          if (TILE_DEFS[tileAt(seed, x + dx, y + dy)].solid) {
            open = false;
            break;
          }
      if (open) site = { x: x + 0.5, y: y + 0.5 };
    }
  assert.ok(site, 'A deterministic open summoning site exists');
  await page.evaluate((p) => {
    const n = window.__eigen.game.net;
    n.dev({ cmd: 'level', level: 30 });
    n.dev({ cmd: 'give', id: 'slime_crown', n: 1 });
    n.dev({ cmd: 'tp', ...p });
  }, site);
  await page.waitForFunction(
    (p) => {
      const s = window.__eigen.state();
      return (
        s.level === 30 &&
        Math.hypot(s.x - p.x, s.y - p.y) < 0.2 &&
        window.__eigen.game.gameplay.profile.count('slime_crown') === 1
      );
    },
    site,
    { timeout: 40000 },
  );
  await page.waitForFunction(
    () => {
      const g = window.__eigen.game,
        p = g.predictor.sim;
      return [...g.views.values()].some(
        (v) => v.type === 'enemy' && ![10, 11, 12].includes(v.kind) && Math.hypot(v.lx - p.x, v.ly - p.y) < 24,
      );
    },
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    const g = window.__eigen.game,
      p = g.predictor.sim,
      v = [...g.views.values()].find(
        (v) => v.type === 'enemy' && ![10, 11, 12].includes(v.kind) && Math.hypot(v.lx - p.x, v.ly - p.y) < 24,
      );
    g.setTarget(v.id);
  });
  await page.locator('#target-frame').waitFor({ state: 'visible' });
  assert.ok(
    !(await page.locator('.tf-name').innerText()).includes('Lv'),
    'Replicated creatures do not acquire invented levels',
  );
  await page.evaluate(() => window.__eigen.game.setTarget(null));
  await page.evaluate(() => {
    const g = window.__eigen.game,
      slot = g.gameplay.profile.inv.findIndex((s) => s?.id === 'slime_crown');
    g.net.use({ slot, tx: Math.floor(g.predictor.sim.x), ty: Math.floor(g.predictor.sim.y) });
  });
  await page.waitForFunction(
    () => window.__eigen.state().p34.boss === 10 && !document.querySelector('#boss-bar').hidden,
    null,
    { timeout: 30000 },
  );
  assert.equal(await page.locator('.bb-name').innerText(), 'Gelatinous Sovereign');
  const max = Number(
    await page.getByRole('progressbar', { name: 'Gelatinous Sovereign health' }).getAttribute('aria-valuemax'),
  );
  assert.ok(max > 100);
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.setTarget(g.ext.adventure.boss.id);
  });
  await page.waitForTimeout(200);
  assert.equal(
    await page.locator('#target-frame').isVisible(),
    false,
    'Selected boss uses one authoritative encounter header',
  );
  assert.equal(
    await page.evaluate(() => window.__eigen.game.gameplay.profile.count('slime_crown')),
    0,
    'Successful summon consumed the item',
  );
  assert.deepEqual(errors, []);
  console.log(
    'Real boss session passed: authoritative summon, consumed item, scaled health, replicated encounter, selected boss without duplicate header.',
  );
} finally {
  await browser.close();
}
