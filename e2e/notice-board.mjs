// Notice board and longbow proof on the solo build: stand at a kingdom town's notice board and read it, then equip a
// longbow and draw a long shot. Usage: node e2e/notice-board.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-board';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '?dev=1&hour=11');
await page.evaluate(() => {
  localStorage.setItem('eigen.tutorial2', '["all"]');
  const s = JSON.parse(localStorage.getItem('eigen.settings') || '{}');
  s.graphics = 'performance';
  localStorage.setItem('eigen.settings', JSON.stringify(s));
});
await page.reload();
await page.fill('#name', 'Reader').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
const SH = `/@fs${process.cwd()}/packages/shared/src/index.ts`;
const site = await page.evaluate(async (SH) => {
  const sh = await import(SH);
  const s = sh.REALM_SITES.find((s) => s.kind === 'town');
  return { x: s.cx, y: s.cy };
}, SH);
await dev({ cmd: 'tp', x: site.x, y: site.y + 6 });
await page.waitForTimeout(8000);
const at = await page.evaluate(() => window.__eigen.game.life.boardAt());
console.log('board', JSON.stringify(at));
await dev({ cmd: 'tp', x: Math.round(at.x + 1), y: Math.round(at.y + 1) });
await page.waitForTimeout(5000);
const card = await page.evaluate(() => {
  const el = document.getElementById('noticeboard');
  return el && !el.hidden ? el.innerText : null;
});
console.log('card', JSON.stringify(card));
await page.screenshot({ path: `${out}/board.png` });

// track the wanted poster: the travel strip and atlas follow it
const tracked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('#noticeboard button')].find((b) => b.textContent.includes('Track'));
  if (!btn) return null;
  btn.click();
  return window.__eigen.game.ext.atlas.navigation();
});
console.log('tracked', JSON.stringify(tracked && { title: tracked.title, point: tracked.point }));
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/tracked.png` });

// out where it was seen: the marked beast, larger than its kind with an ember ring
if (tracked?.point) {
  await dev({ cmd: 'level', level: 10 });
  await dev({ cmd: 'tp', x: Math.round(tracked.point.x), y: Math.round(tracked.point.y) + 6 });
  await page.waitForTimeout(9000);
  const beast = await page.evaluate(() => {
    const g = window.__eigen.game;
    for (const v of g.views.values()) {
      const s = g.interp.sample(v.id, 0)?.pose;
      if (v.type === 'enemy' && s && s.elite & 8) return { x: v.lx, y: v.ly, sx: v.root.x, sy: v.root.y };
    }
    return null;
  });
  console.log('beast', JSON.stringify(beast));
  if (beast) {
    const c = await page.evaluate(([x, y]) => window.__eigen.game.life.d.toScreen(x, y), [beast.x, beast.y]);
    await page.screenshot({ path: `${out}/beast.png`, clip: { x: c.x - 120, y: c.y - 120, width: 240, height: 170 } });
  }
}

// the longbow: give, equip as the main weapon, then draw and loose
await dev({ cmd: 'level', level: 12 });
await dev({ cmd: 'give', id: 'longbow', n: 1 });
await page.waitForTimeout(800);
const slot = await page.evaluate(() => window.__eigen.game.gameplay.profile.inv.findIndex((s) => s?.id === 'longbow'));
await page.evaluate((slot) => window.__eigen.game.net.equip({ slot, as: 'weapon' }), slot);
await page.waitForTimeout(1500);
await page.mouse.move(900, 300);
await page.mouse.down();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/longbow-draw.png`, clip: { x: 540, y: 260, width: 200, height: 160 } });
await page.mouse.up();
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/longbow-loose.png`, clip: { x: 440, y: 200, width: 520, height: 260 } });
console.log('weapon', await page.evaluate(() => window.__eigen.game.gameplay.profile.equip.weapon?.id ?? null));
// the star gear: a Starlit Lantern and a Wishing Star Charm, worn at night
await dev({ cmd: 'level', level: 16 });
for (const id of ['star_lantern', 'star_charm']) await dev({ cmd: 'give', id, n: 1 });
await page.waitForTimeout(800);
const before = await page.evaluate(() => ({ ...window.__eigen.game.gameplay.profile.stats }));
for (const [id, as] of [
  ['star_lantern', 'light'],
  ['star_charm', 'charm'],
]) {
  const slot = await page.evaluate((id) => window.__eigen.game.gameplay.profile.inv.findIndex((s) => s?.id === id), id);
  await page.evaluate(([slot, as]) => window.__eigen.game.net.equip({ slot, as }), [slot, as]);
  await page.waitForTimeout(800);
}
const after = await page.evaluate(() => ({ ...window.__eigen.game.gameplay.profile.stats }));
console.log('stars', JSON.stringify({ light: [before.light, after.light], luck: [before.luck, after.luck] }));
console.log(errors.length ? errors.join('\n') : 'no errors');
await b.close();
