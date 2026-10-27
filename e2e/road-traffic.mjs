// Road traffic proof on the solo build: stand beside a marching column, knights, a drover, monks, a noble and market
// folk on the kingdom roads and photograph each. Usage: node e2e/road-traffic.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-road';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '?dev=1&hour=11');
await page.evaluate(() => {
  localStorage.setItem('eigen.tutorial2', '["all"]');
  const s = JSON.parse(localStorage.getItem('eigen.settings') || '{}');
  s.graphics = 'performance';
  localStorage.setItem('eigen.settings', JSON.stringify(s));
});
await page.reload();
await page.fill('#name', 'Traveller').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const SH = `/@fs${process.cwd()}/packages/shared/src/index.ts`;
const kinds = (process.env.KINDS ?? 'column,knights,drover,monks,noble,market,goatherd,swineherd').split(',');
for (const kind of kinds) {
  // where one of this kind will be a few seconds from now, out on open road
  const spot = await page.evaluate(
    async ([SH, kind]) => {
      const sh = await import(SH);
      const g = window.__eigen.game;
      const now = g.clock.serverNow(performance.now()) + 6000;
      for (const w of sh.wayfarers(g.store.seed)) {
        if (w.kind !== kind) continue;
        const p = sh.wayfarerAt(g.store.seed, w, now);
        if (!p.hidden) return { x: p.x, y: p.y, fx: p.fx, fy: p.fy };
      }
      return null;
    },
    [SH, kind],
  );
  if (!spot) {
    console.log('none', kind);
    continue;
  }
  // stand a little ahead and to the side of where they will pass
  await page.evaluate(
    ([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }),
    [Math.round(spot.x + spot.fx * 3 + 2.5), Math.round(spot.y + spot.fy * 3 + 2.5)],
  );
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${out}/${kind}.png`, clip: { x: 340, y: 160, width: 600, height: 400 } });
  console.log('shot', kind, Math.round(spot.x), Math.round(spot.y));
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await b.close();
