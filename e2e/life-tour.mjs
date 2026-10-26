// Settlement life tour: node e2e/war-tour.mjs [url] [outdir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/EIGENLANDS/';
const out = process.argv[3] ?? '/tmp/shots-life';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-angle=swiftshader',
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
  ],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?dev=1&hour=${process.env.HOUR ?? 19}`);
await page.waitForSelector('#g-off:not([hidden])');
await page.fill('#name', 'Scout');
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 30000 });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
await dev({ cmd: 'level', level: 8 });
const [cx, cy] = process.env.SITE ? process.env.SITE.split(',').map(Number) : [1024, -512];
await dev({ cmd: 'tp', x: cx, y: cy + 14 });
await sleep(9000);
const info = () =>
  page.evaluate(() => ({
    at: window.__eigen.game.life.where(),
    n: window.__eigen.game.life.count(),
    k: window.__eigen.game.life.kinds(),
  }));
console.log(JSON.stringify(await info()));
await page.screenshot({ path: `${out}/1.png` });
for (const [i, role] of (process.env.ROLES ?? 'crowd,patron,smith,fisher,roofbird').split(',').entries()) {
  const p = await page.evaluate((r) => window.__eigen.game.life.find(r), role);
  if (!p) {
    console.log('no', role);
    continue;
  }
  await dev({ cmd: 'tp', x: Math.round(p.x), y: Math.round(p.y + 4) });
  await sleep(3500);
  console.log(role, JSON.stringify(await info()));
  await page.screenshot({ path: `${out}/${i}-${role}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
