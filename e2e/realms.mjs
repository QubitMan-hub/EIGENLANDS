// Realms proof on the solo build: the three realm portals near Hadamere, each realm's arrival, a gathering node,
// a realm creature up close and its guardian's arena. Usage: node e2e/realms.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-realms';
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
await page.fill('#name', 'Realmwalker').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
const tp = async (x, y, wait = 4000) => {
  for (let i = 0; i < 4; i++) {
    await dev({ cmd: 'tp', x, y });
    await page.waitForTimeout(wait);
    const at = await page.evaluate(() => window.__eigen.game.predictor.sim);
    if (Math.hypot(at.x - x, at.y - y) < 3) return;
  }
  console.log('tp did not take', x, y);
};
await dev({ cmd: 'level', level: 20 });
const info = await page.evaluate(async () => {
  const sh = await import('/@fs/home/user/EIGENLANDS/packages/shared/src/index.ts');
  const g = window.__eigen.game;
  const seed = g.store.seed,
    gen = g.store.generation;
  const portals = sh.realmPortals(`${seed}:${gen}`, (x, y) => sh.tileAt(seed, x, y, gen));
  const arenas = Object.fromEntries(sh.OTHERWORLD_IDS.map((w) => [w, sh.otherworldArena(seed, w)]));
  const arrivals = Object.fromEntries(sh.OTHERWORLD_IDS.map((w) => [w, sh.otherworldArrival(w)]));
  return { portals, arenas, arrivals };
});
console.log('portals', JSON.stringify(info.portals));
// the portals on the surface
const pa = info.portals.aetheria;
await tp(pa.x + 1.5, pa.y + 2.5);
await page.screenshot({ path: `${out}/portal-aetheria.png` });
for (const w of ['aetheria', 'umbra', 'chronoria']) {
  const a = info.arrivals[w];
  await tp(a.x, a.y);
  await page.screenshot({ path: `${out}/${w}-arrival.png` });
  const creature = await page.evaluate(() => {
    const me = window.__eigen.game.predictor.sim;
    let best = null;
    for (const e of window.__eigen.game.room?.state?.enemies?.values?.() ?? []) {
      const d = Math.hypot(e.x - me.x, e.y - me.y);
      if (!best || d < best.d) best = { x: e.x, y: e.y, kind: e.kind, d };
    }
    return best;
  });
  console.log(w, 'nearest creature', JSON.stringify(creature));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}/${w}-roam.png` });
  const ar = info.arenas[w];
  await tp(ar.x + 0.5, ar.y + 3.5, 6000);
  await page.screenshot({ path: `${out}/${w}-arena.png` });
}
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
