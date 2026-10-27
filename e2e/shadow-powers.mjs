// Shadow powers on the solo build: extract two shadows, trade places with one (Shadow Exchange, G), then raise
// Monarch's Domain (U) over a pack of foes.
// Usage: node e2e/shadow-powers.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-shadow-powers';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '?dev=1&hour=12');
await page.evaluate(() => localStorage.setItem('eigen.tutorial2', '["all"]'));
await page.reload();
await page.fill('#name', 'Monarch').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
await dev({ cmd: 'level', level: 40 });
await dev({ cmd: 'tp', x: 900.5, y: 900.5 });
await page.waitForTimeout(4000);
// extract shadows from wolves until two stand with us
for (let i = 0; i < 14; i++) {
  const n = await page.evaluate(() => window.__eigen.state().p34?.summoned ?? 0);
  if (n >= 2) break;
  await dev({ cmd: 'spawn', kind: 'wolf', n: 1, d: 1.5 });
  await page.waitForTimeout(300);
  await dev({ cmd: 'kill', d: 3 });
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(1800);
}
const count = await page.evaluate(() => window.__eigen.state().p34?.summoned ?? 0);
console.log('shadows summoned', count);
await page.screenshot({ path: `${out}/1-army.png` });
// walk away from them, then trade places
const before = await page.evaluate(() => ({ ...window.__eigen.game.predictor.sim }));
await page.keyboard.press('KeyG');
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/2-exchange.png` });
await page.waitForTimeout(1500);
const after = await page.evaluate(() => ({ ...window.__eigen.game.predictor.sim }));
console.log('exchange moved', Math.hypot(after.x - before.x, after.y - before.y).toFixed(2));
// a pack of foes, then the domain
await dev({ cmd: 'spawn', kind: 'brute', n: 4, d: 5 });
await page.waitForTimeout(600);
await page.keyboard.press('KeyU');
await page.waitForTimeout(450);
await page.screenshot({ path: `${out}/3-domain.png` });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/4-domain-holds.png` });
await page.keyboard.press('KeyY');
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/5-window.png` });
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
