// Realm peoples proof on the solo build: the Aerin, Hollowfolk and Archivists at home in their realms, and a war-band of
// each realm's hostile people (Gale Reavers, Gloamkin, the Sundered) with their champion.
// Usage: node e2e/realmfolk.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-realmfolk';
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
await page.fill('#name', 'Envoy').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
const tp = async (x, y, wait = 4500) => {
  for (let i = 0; i < 4; i++) {
    await dev({ cmd: 'tp', x, y });
    await page.waitForTimeout(wait);
    const at = await page.evaluate(() => window.__eigen.game.predictor.sim);
    if (Math.hypot(at.x - x, at.y - y) < 3) return;
  }
  console.log('tp did not take', x, y);
};
await dev({ cmd: 'level', level: 30 });
const homes = await page.evaluate(async () => {
  const sh = await import('/@fs/home/user/EIGENLANDS/packages/shared/src/index.ts');
  const seed = window.__eigen.game.store.seed;
  const spots = sh.realmfolkSpots(seed);
  return Object.fromEntries(
    sh.RACE_IDS.map((r) => {
      const ids = sh.REALMFOLK.filter((n) => n.race === r).map((n) => spots[n.home]);
      const x = ids.reduce((a, s) => a + s.x, 0) / ids.length,
        y = ids.reduce((a, s) => a + s.y, 0) / ids.length;
      return [r, { x, y, foes: sh.RACES[r].foes }];
    }),
  );
});
for (const [race, h] of Object.entries(homes)) {
  await tp(h.x + 0.5, h.y + 2.5);
  await page.screenshot({ path: `${out}/${race}-home.png` });
  // a war-band of their enemies, a little way off (the spawn is a dev command: the realm module also musters them)
  await tp(h.x + 0.5, h.y + 6.5);
  for (const [i, kind] of h.foes.entries()) await dev({ cmd: 'spawn', kind, n: i === 2 ? 1 : 2, d: 3 + i });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/${race}-foes.png` });
  await dev({ cmd: 'kill', d: 20 });
}
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
