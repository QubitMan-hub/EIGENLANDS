// Two browsers in one world + a phone-sized touch client. node e2e/multi.mjs [url] [outdir]
import { chromium, devices } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/?hour=12';
const out = process.argv[3] ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const errors = [];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
async function player(name, contextOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, ...contextOpts });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  await page.goto(url);
  await page.fill('#name', name);
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 25000 });
  return page;
}

const a = await player('Alice');
const b = await player('Bob');
await sleep(1500);
// both spawn together: each sees 2 players in view (entities counts players + any enemies)
const ea = await a.evaluate(() => window.__eigen.state().entities);
const eb = await b.evaluate(() => window.__eigen.state().entities);
console.log('entities seen by alice/bob', ea, eb);
if (ea < 2 || eb < 2) fail('players should see each other');
await a.screenshot({ path: `${out}/m1-alice.png` });

// Alice walks far away: Bob stops seeing Alice (interest management), Alice never sees Bob
await a.keyboard.down('KeyD');
await sleep(9000);
await a.keyboard.up('KeyD');
const ax = await a.evaluate(() => window.__eigen.state().x);
await sleep(1000);
const labelsB = await b.evaluate(() => window.__eigen.state().entities);
console.log('alice x', ax.toFixed(1), 'bob now sees entities', labelsB);

// mobile: touch device emulation
const phone = await player('Phone', { ...devices['Pixel 7'], viewport: { width: 412, height: 800 } });
await sleep(1200);
const st = await phone.evaluate(() => ({ s: window.__eigen.state(), touch: !document.getElementById('touch').hidden }));
console.log('phone', { scale: st.s.scale, touchUI: st.touch, chunks: st.s.chunks });
if (!st.touch) fail('touch controls should show on a coarse-pointer device');
await phone.screenshot({ path: `${out}/m2-phone.png` });
const box = await phone.locator('#stick').boundingBox();
await phone.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);

const bad = errors.filter((e) => !/GPU stall|swiftshader|WebGL/i.test(e));
console.log('console problems:', bad.length ? bad : 'none');
if (bad.length) fail('console errors');
await browser.close();
