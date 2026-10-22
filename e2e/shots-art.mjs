// Art review screenshots of the live game: TOWN='{"cx":..,"cy":..}' node e2e/shots-art.mjs <outdir> [baseUrl] [only]
// Needs a server with DEV_COMMANDS=1. Captures spawn, the town plaza (statue), streets, fields, pond, night, phone.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? '/tmp/shots/art';
const base = process.argv[3] ?? 'http://127.0.0.1:5260/';
const only = process.argv[4] ?? '';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const errors = [];
const fps = [];
async function session(vp, query, fn) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base + '?' + query);
  await page.fill('#name', 'Artie');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 30000 });
  await sleep(1500);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(100); }
  const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
  const tp = async (x, y) => { await dev({ cmd: 'tp', x, y }); await sleep(2500); };
  await fn(page, tp, dev);
  fps.push(await page.evaluate(() => window.__eigen.state().fps));
  await page.close();
}
const shot = (page, n) => page.screenshot({ path: `${out}/${n}.png` });
const want = (n) => !only || only.split(',').includes(n);
const TOWN = JSON.parse(process.env.TOWN ?? '{"cx":0,"cy":0}');
if (want('day')) await session({ width: 1280, height: 720 }, 'hour=12&season=1', async (page, tp) => {
  await shot(page, 'a-spawn');
  await tp(TOWN.cx + 0.5, TOWN.cy + 7.5); await shot(page, 'b-plaza');
  await tp(TOWN.cx + 0.5, TOWN.cy - 6); await shot(page, 'c-street');
  await tp(TOWN.cx + 22, TOWN.cy + 10); await shot(page, 'd-field');
  await tp(TOWN.cx - 6, TOWN.cy + 17); await shot(page, 'e-pond');
  await tp(TOWN.cx - 1, TOWN.cy - 12); await shot(page, 'f-inside-hall');
});
if (want('night')) await session({ width: 1280, height: 720 }, 'hour=21&season=1', async (page, tp) => {
  await tp(TOWN.cx + 0.5, TOWN.cy + 7.5); await shot(page, 'g-plaza-night');
  await tp(TOWN.cx + 0.5, TOWN.cy - 6); await shot(page, 'h-street-night');
});
if (want('phone')) await session({ width: 390, height: 844 }, 'hour=10&season=1', async (page, tp) => {
  await shot(page, 'i-phone-spawn');
  await tp(TOWN.cx + 0.5, TOWN.cy + 8.5); await shot(page, 'j-phone-plaza');
});
if (want('seasons')) for (const s of [0, 2, 3]) await session({ width: 1280, height: 720 }, `hour=11&season=${s}`, async (page, tp) => {
  await tp(TOWN.cx + 0.5, TOWN.cy + 7.5); await shot(page, `k-season${s}`);
});
console.log('fps:', fps.map((f) => f?.toFixed(0)).join(' '));
console.log('errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
