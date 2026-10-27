// Realm room themes on the solo build: one room of each realm's more striking themes, seen in the game.
// Usage: node e2e/realm-themes.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-realm-themes';
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
await page.fill('#name', 'Cartographer').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
await dev({ cmd: 'level', level: 30 });
const want = {
  aetheria: ['lake', 'crystal', 'grove'],
  umbra: ['ember', 'crystal', 'flooded'],
  chronoria: ['dunes', 'stilled'],
};
const spots = await page.evaluate(async (want) => {
  const sh = await import('/@fs/home/user/EIGENLANDS/packages/shared/src/index.ts');
  const seed = window.__eigen.game.store.seed;
  const out = [];
  for (const [w, themes] of Object.entries(want)) {
    const def = sh.OTHERWORLDS[w];
    for (const t of themes) {
      let best = null;
      for (let gy = -def.span; gy <= def.span; gy++)
        for (let gx = -def.span; gx <= def.span; gx++) {
          const r = sh.roomOf(seed, w, gx, gy);
          if (!r || sh.roomTheme(seed, w, r) !== t) continue;
          if (!best || r.r > best.r || (r.r === best.r && Math.hypot(r.x, r.y) < Math.hypot(best.x, best.y))) best = r;
        }
      if (best) out.push({ w, t, x: best.x + 0.5, y: best.y + def.oy + 0.5 });
    }
  }
  return out;
}, want);
for (const s of spots) {
  await dev({ cmd: 'tp', x: s.x, y: s.y });
  await page.waitForTimeout(5000);
  await dev({ cmd: 'kill', d: 30 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${s.w}-${s.t}.png` });
}
console.log('rooms', JSON.stringify(spots.map((s) => `${s.w}:${s.t}`)));
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
