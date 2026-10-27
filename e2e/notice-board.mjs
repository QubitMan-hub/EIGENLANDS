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
console.log(errors.length ? errors.join('\n') : 'no errors');
await b.close();
