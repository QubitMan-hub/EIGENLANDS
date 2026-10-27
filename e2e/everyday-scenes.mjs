// Everyday scenes proof on the solo build: visit one kingdom town and photograph each of its ordinary scenes
// (well, washing, firewood, gossip, children, pets, porter, busker, lamplighter).
// Usage: node e2e/everyday-scenes.mjs <solo-url> <output-dir>   (HOUR, SITE=<site id> and KINDS optional)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-scenes';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?dev=1&hour=${process.env.HOUR ?? 10}`);
await page.evaluate(() => {
  localStorage.setItem('eigen.tutorial2', '["all"]');
  const s = JSON.parse(localStorage.getItem('eigen.settings') || '{}');
  s.graphics = 'performance';
  localStorage.setItem('eigen.settings', JSON.stringify(s));
});
await page.reload();
await page.fill('#name', 'Neighbour').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const tp = async (x, y, wait = 5000) => {
  await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
  await page.waitForTimeout(wait);
};
const SH = `/@fs${process.cwd()}/packages/shared/src/index.ts`;
const site = await page.evaluate(
  async ([SH, want]) => {
    const sh = await import(SH);
    const s = sh.REALM_SITES.find((s) => (want ? s.id === want : s.kind === 'town'));
    return { id: s.id, name: s.name, x: s.cx, y: s.cy };
  },
  [SH, process.env.SITE ?? ''],
);
await tp(site.x, site.y + 6, 9000);
const kinds = await page.evaluate(() => window.__eigen.game.life.sceneKinds());
console.log(site.name, JSON.stringify(kinds));
const want = (process.env.KINDS ?? Object.keys(kinds).join(',')).split(',');
for (const k of want) {
  const p = await page.evaluate((k) => window.__eigen.game.life.sceneAt(k), k);
  if (!p) {
    console.log('no', k);
    continue;
  }
  // stand a few steps off so pets and pigeons are not startled
  await tp(Math.round(p.x + 3), Math.round(p.y + 3), 7000);
  // a close crop around the scene itself
  const c = await page.evaluate(([x, y]) => window.__eigen.game.life.d.toScreen(x, y), [p.x, p.y]);
  const clip = { x: Math.max(0, c.x - 180), y: Math.max(0, c.y - 150), width: 360, height: 220 };
  await page.screenshot({ path: `${out}/${k}.png`, clip });
  console.log('shot', k, JSON.stringify(p));
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await b.close();
