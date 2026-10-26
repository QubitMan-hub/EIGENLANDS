// Caravan proof on the solo build: find a road caravan in Aurelion, stand beside it and open its wagon shop.
// Usage: node e2e/caravans.mjs <solo-url> <output-dir>
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-caravan';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base + '?dev=1&hour=12');
await page.evaluate(() => {
  localStorage.setItem('eigen.tutorial2', '["all"]');
  const s = JSON.parse(localStorage.getItem('eigen.settings') || '{}');
  s.graphics = 'performance';
  localStorage.setItem('eigen.settings', JSON.stringify(s));
});
await page.reload();
await page.fill('#name', 'Trader').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'level', level: 6 }));
const tp = async (x, y, wait = 2500) => {
  await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
  await page.waitForTimeout(wait);
};
// walk the four Aurelion roads until a caravan is in view
let found = null;
// walk Aurelion's roads until a caravan is in view (rolling, if possible)
for (const [x, y] of [
  [1024.5, -620.5],
  [1130.5, -511.5],
  [1024.5, -400.5],
  [920.5, -511.5],
  [1024.5, -760.5],
  [1270.5, -511.5],
  [1024.5, -300.5],
  [800.5, -511.5],
]) {
  await tp(x, y, 3000);
  const list = await page.evaluate(() =>
    window.__eigen.game.ext.travel.caravans
      .list()
      .map((c) => ({ id: c.route.id, x: c.x, y: c.y, moving: c.moving, fx: c.fx, fy: c.fy })),
  );
  console.log('at', x, y, JSON.stringify(list));
  const mv = list.find((c) => c.moving);
  if (mv) {
    found = mv;
    break;
  }
  if (list.length && !found) found = list[0];
}
if (!found) throw new Error('no caravan found');
// stand beside it (it moves: aim a little ahead)
await tp(found.x + found.fx * 2 - found.fy * 1.6, found.y + found.fy * 2 + found.fx * 1.6, 1500);
await page.screenshot({ path: `${out}/1-caravan.png` });
const near = await page.evaluate(() => window.__eigen.game.ext.travel.caravanNear());
console.log('in reach', JSON.stringify(near));
assert(near, 'caravan must be in interaction reach');
if (near) {
  console.log(
    'server side',
    JSON.stringify(
      await page.evaluate((id) => {
        const rooms = globalThis.__eigenSolo.raw();
        return rooms.map((r) => {
          const p = [...r.players.values()][0];
          const has = !!r.caravans;
          return {
            shard: r.shard,
            has,
            gen: r.store?.generation,
            pos: p ? [p.sim.x, p.sim.y] : null,
            now: r.wclock.now(),
          };
        });
      }, near.id),
    ),
  );
  await page.evaluate((id) => window.__eigen.game.net.shop({ npcId: `caravan:${id}`, action: 'open' }), near.id);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/2-shop.png` });
  const title = await page.locator('#window-title').textContent();
  console.log('shop title', title);
  assert(title?.includes(near.name), 'the actual caravan shop must open');
  console.log(
    'toasts',
    await page.evaluate(() => [...document.querySelectorAll('#toasts *, .toast')].map((e) => e.textContent).slice(-5)),
  );
  console.log(
    'me',
    JSON.stringify(
      await page.evaluate(() => {
        const s = window.__eigen.game.debugState();
        return [s.x, s.y];
      }),
    ),
    'caravans',
    JSON.stringify(await page.evaluate(() => window.__eigen.game.ext.travel.caravans.list().map((c) => [c.x, c.y]))),
  );
}
await b.close();
console.log('errors', errors.slice(0, 6));
assert.deepEqual(errors, [], 'no browser errors');
