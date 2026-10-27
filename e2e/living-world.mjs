// Living-world proof on the solo build: walk to a story scene in the wild and read it, then open the Journal's
// Kingdoms page with its Festivals & tournaments card. Usage: node e2e/living-world.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-living';
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
await page.fill('#name', 'Wanderer').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
// the nearest story scene to the spawn
const site = await page.evaluate(async () => {
  const sh = await import('/@fs/home/user/EIGENLANDS/packages/shared/src/index.ts');
  const seed = window.__eigen.game.store.seed;
  for (let r = 2; r < 12; r++)
    for (let gy = -r; gy <= r; gy++)
      for (let gx = -r; gx <= r; gx++) {
        const s = sh.storyOfCell(seed, gx, gy);
        if (s) return { ...s, read: sh.STORY_READ[s.kind], open: sh.MSG.OPEN };
      }
  return null;
});
console.log('story', JSON.stringify(site));
await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [site.x + 0.5, site.y + 2.5]);
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/story-scene.png` });
const prop = await page.evaluate((site) => {
  const st = window.__eigen.game.store;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const o = st.objectAt(site.x + dx, site.y + dy);
      if (o?.sub === site.read) return { x: o.x, y: o.y };
    }
  return null;
}, site);
console.log('prop', JSON.stringify(prop));
await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [prop.x + 0.5, prop.y + 1.5]);
await page.waitForTimeout(800);
await page.evaluate(([t, x, y]) => window.__eigen.game.net.send(t, { tx: x, ty: y }), [site.open, prop.x, prop.y]);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/story-read.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.getByText('Journal', { exact: true }).first().click();
await page.waitForTimeout(800);
await page
  .getByText('Kingdoms', { exact: true })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/journal-festivals.png` });
console.log('festivals card', await page.getByText('Festivals & tournaments').count());
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
