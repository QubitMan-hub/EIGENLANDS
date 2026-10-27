// Lively-world proof on the solo build: travellers on a kingdom road, a wild worker out in the wilds and street
// life in a home town. Usage: node e2e/lively-world.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-lively';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '?dev=1&hour=12');
await page.evaluate(() => {
  localStorage.setItem('eigen.tutorial2', '["all"]');
  const s = JSON.parse(localStorage.getItem('eigen.settings') || '{}');
  s.graphics = 'performance';
  localStorage.setItem('eigen.settings', JSON.stringify(s));
});
await page.reload();
await page.fill('#name', 'Wanderer').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const tp = async (x, y, wait = 3500) => {
  await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
  await page.waitForTimeout(wait);
};
const count = () => page.evaluate(() => window.__eigen.game.ext.travel.roadLife.count());
const SH = '/@fs/home/user/EIGENLANDS/packages/shared/src/index.ts';

// 1. a kingdom road: stand beside a shepherd or a patrol a few seconds ahead of where they are now
const road = await page.evaluate(async (SH) => {
  const sh = await import(SH);
  const g = window.__eigen.game;
  const seed = g.store.seed;
  const now = g.clock.serverNow(performance.now()) + 3000;
  for (const kind of ['shepherd', 'patrol', 'carter', 'courier'])
    for (const w of sh.wayfarers(seed)) {
      if (w.kind !== kind) continue;
      const p = sh.wayfarerAt(seed, w, now);
      if (!p.hidden) return { kind, x: p.x, y: p.y };
    }
  return null;
}, SH);
console.log('road', JSON.stringify(road));
await tp(road.x + 2.5, road.y + 2.5);
console.log('road life drawn', await count());
await page.screenshot({ path: `${out}/road.png` });

// 2. a wild worker nearest the spawn
const wild = await page.evaluate(async (SH) => {
  const sh = await import(SH);
  const seed = window.__eigen.game.store.seed;
  for (let r = 60; r < 400; r += 40) {
    const f = sh.wildFolkNear(seed, 0, 0, r).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
    if (f) return f;
  }
  return null;
}, SH);
console.log('wild', JSON.stringify(wild));
await tp(wild.x + 2.5, wild.y + 2.5);
console.log('road life drawn', await count());
await page.screenshot({ path: `${out}/wild.png` });

// 3. a home town's street life
await tp(512.5, 4.5, 5000);
await page.screenshot({ path: `${out}/home-town.png` });
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
