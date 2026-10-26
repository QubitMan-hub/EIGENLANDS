// A garrison patrol and a raid in a capital: node e2e/war-tour.mjs [url] [outdir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/EIGENLANDS/';
const out = process.argv[3] ?? '/tmp/shots-war';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?dev=1&hour=12`);
await page.waitForSelector('#g-off:not([hidden])');
await page.fill('#name', 'Scout');
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 30000 });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
await dev({ cmd: 'level', level: 8 });
const [cx, cy] = process.env.SITE ? process.env.SITE.split(',').map(Number) : [1024, -512];
await dev({ cmd: 'tp', x: cx, y: cy + 14 });
await sleep(12000);
await page.screenshot({ path: `${out}/1-garrison.png` });
await dev({ cmd: 'raid', site: process.env.SITEID ?? 'aurelion_capital', attacker: process.env.ATT ?? 'nethrakar', scale: 2 });
await sleep(9000);
await page.screenshot({ path: `${out}/2-raid-spawn.png` });
await sleep(Number(process.env.FIGHT ?? 14000));
await page.screenshot({ path: `${out}/3-raid-fight.png` });
await sleep(8000);
await page.screenshot({ path: `${out}/4-raid-later.png` });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
