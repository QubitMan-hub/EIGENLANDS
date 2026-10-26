// Visual tour of the six kingdoms (revision 5): node e2e/kingdoms-art.mjs [url] [outdir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5240/EIGENLANDS/';
const url = `${base}${base.includes('?') ? '&' : '?'}dev=1`;
const out = process.argv[3] ?? '/tmp/shots-kingdoms';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
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
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url);
await page.waitForSelector('#g-off:not([hidden])');
await page.fill('#name', 'Tour');
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 30000 });
await sleep(1500);
const CAPITALS = {
  aurelion: [1024, -512],
  sylvaris: [256, -1024],
  khardum: [-768, -768],
  raijin: [768, 768],
  thalassara: [-256, 1024],
  nethrakar: [-1024, 256],
};
for (const [name, [x, y]] of Object.entries(CAPITALS)) {
  await page.evaluate(
    ([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }),
    [x, y + Number(process.env.DY ?? 0)],
  );
  await sleep(Number(process.env.WAIT ?? 6000));
  const s = await page.evaluate(() => window.__eigen.state());
  console.log(
    name,
    JSON.stringify({ g: s.generation, b: s.buildings }),
    s.x?.toFixed(1),
    s.y?.toFixed(1),
    'chunks',
    s.chunks,
  );
  await page.screenshot({ path: `${out}/${name}.png` });
}
console.log(errors.length ? `errors:\n${errors.slice(0, 10).join('\n')}` : 'no errors');
await browser.close();
