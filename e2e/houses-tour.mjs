// Screenshots of kingdom houses: node e2e/houses-tour.mjs  (env SPOTS="x,y;x,y", HOUR)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.env.URL ?? 'http://127.0.0.1:5240/EIGENLANDS/';
const out = '/tmp/shots-houses';
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
await page.goto(`${base}?dev=1&hour=${process.env.HOUR ?? 12}`);
await page.waitForSelector('#g-off:not([hidden])');
await page.fill('#name', 'Scout');
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 30000 });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
await dev({ cmd: 'level', level: 8 });
const spots = (process.env.SPOTS ?? '1024,-512').split(';').map((p) => p.split(',').map(Number));
for (const [i, [x, y]] of spots.entries()) {
  await dev({ cmd: 'tp', x, y });
  await sleep(Number(process.env.WAIT ?? 9000));
  await page.screenshot({ path: `${out}/h${i}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
