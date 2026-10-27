// Deeper-world proof on the solo build: the three crypt floor plans, the riddle plaque, and a pitched travel tent.
// Usage: node e2e/deeper-world.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-deeper';
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
await page.fill('#name', 'Delver').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const tp = async (x, y, wait = 3500) => {
  await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
  await page.waitForTimeout(wait);
};
const toasts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent ?? ''));

// one crypt of each plan
const crypts = await page.evaluate(async () => {
  const sh = await import('/@fs/home/user/EIGENLANDS/packages/shared/src/index.ts');
  const seed = window.__eigen.game.store.seed;
  const found = {};
  for (let r = 1; r < 30 && Object.keys(found).length < 3; r++)
    for (let gy = -r; gy <= r; gy++)
      for (let gx = -r; gx <= r; gx++) {
        if (Math.max(Math.abs(gx), Math.abs(gy)) !== r) continue;
        const ru = sh.ruinOfCell(seed, gx, gy);
        const c = ru && sh.cryptOf(seed, ru);
        if (c && !found[sh.cryptPlan(c).name]) found[sh.cryptPlan(c).name] = { x: c.x, y: c.y };
      }
  return found;
});
console.log('crypts', JSON.stringify(crypts));
// the plaque by the stairs
const first = Object.values(crypts)[0];
await tp(first.x - 0.5, first.y + 0.5);
await page.evaluate(([x, y]) => window.__eigen.game.net.send('open', { tx: x, ty: y }), [first.x - 2, first.y - 1]);
await page.waitForTimeout(1200);
const plaque = (await toasts()).find((t) => /laid to rest in turn/.test(t));
console.log('plaque', plaque ?? '(no plaque toast)');
await page.screenshot({ path: `${out}/crypt-plaque.png` });

// a tent pitched in a meadow
await tp(40.5, 30.5);
await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'give', id: 'travel_tent', n: 1 }));
await page.waitForTimeout(800);
const slot = await page.evaluate(() =>
  window.__eigen.game.gameplay.profile.inv.findIndex((s) => s?.id === 'travel_tent'),
);
console.log('tent slot', slot);
await page.evaluate((s) => window.__eigen.game.net.send('use', { slot: s, tx: 42, ty: 30 }), slot);
await page.waitForTimeout(1500);
const placed = await page.evaluate(() => window.__eigen.game.store.objectAt(42, 30)?.sub ?? null);
console.log('placed', placed);
await page.screenshot({ path: `${out}/tent.png` });
for (const [name, c] of Object.entries(crypts)) {
  await tp(c.x + 0.5, c.y + 18.5);
  await page.screenshot({ path: `${out}/crypt-${name.replace(' ', '-')}.png` });
}
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
