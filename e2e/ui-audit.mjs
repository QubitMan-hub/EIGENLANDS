// UI/art audit shots: node e2e/ui-audit.mjs [url] [outdir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/EIGENLANDS/';
const out = process.argv[3] ?? '/tmp/shots-ui';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`${base}?dev=1${process.env.HOUR ? '&hour=' + process.env.HOUR : ''}`);
await page.waitForSelector('#g-off:not([hidden])');
await page.screenshot({ path: `${out}/0-login.png` });
await page.fill('#name', 'Tour');
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 30000 });
await sleep(3000);
await page.screenshot({ path: `${out}/1-play.png` });
const [px, py] = process.env.TP ? process.env.TP.split(',').map(Number) : [null, null];
if (px !== null) {
  await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [px, py]);
  await sleep(8000);
  await page.screenshot({ path: `${out}/1b-spot.png` });
}
await page.keyboard.press('i');
await sleep(800);
await page.screenshot({ path: `${out}/2-inventory.png` });
await page.keyboard.press('Escape');
await page.click('text=Journal');
await sleep(800);
await page.screenshot({ path: `${out}/3-journal.png` });
await page.keyboard.press('Escape');
await page.click('text=Menu');
await sleep(600);
await page.screenshot({ path: `${out}/4-menu.png` });
await page.keyboard.press('Escape');
await page.keyboard.press('m');
await sleep(1200);
await page.screenshot({ path: `${out}/5-map.png` });
await browser.close();
