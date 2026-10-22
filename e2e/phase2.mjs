// Phase 2 browser e2e. Needs: server with DEV_COMMANDS=1 on :2567, vite on :5173.
//   node e2e/phase2.mjs [outdir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? '/tmp/shots/p2';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failed = false;
const check = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); failed = true; } else console.log('ok  :', msg); };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const st = () => page.evaluate(() => { const s = window.__eigen.state(); return { ...s, tile: undefined }; });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
const count = (id) => page.evaluate((id) => (window.__eigen.game.gameplay.profile.inv.filter((s) => s && s.id === id).reduce((a, s) => a + s.n, 0)), id);
const press = async (code) => { await page.keyboard.press(code); await sleep(120); };
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const tp = async (x, y) => { await dev({ cmd: 'tp', x, y }); await sleep(900); };

await page.goto('http://127.0.0.1:5173/?hour=12&season=0');
await page.fill('#name', 'Farmer');
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 25000 });
await sleep(1500);

// ── profile & starter kit
await page.waitForFunction(() => window.__eigen.game.gameplay.profile.loaded, null, { timeout: 8000 });
check((await count('axe')) === 1 && (await count('hoe')) === 1, 'starter tools received');
check((await page.evaluate(() => window.__eigen.game.gameplay.profile.coins)) >= 50, 'starter coins');
await shot('01-start');

// ── inventory + hotbar
await press('KeyI'); await sleep(300);
check(await page.isVisible('.inv-win'), 'pack opens with I');
await shot('02-pack');
await press('Escape');

// ── field crafting a workbench
await dev({ cmd: 'give', id: 'wood', n: 40 }); await dev({ cmd: 'give', id: 'stone', n: 30 }); await sleep(400);
await press('KeyC'); await sleep(300);
check(await page.isVisible('.station'), 'field crafting opens with C');
await page.click('.recipe.can >> text=Workbench').catch(() => {});
const rows = await page.$$('.recipe');
for (const r of rows) { const t = await r.innerText(); if (/^Workbench/m.test(t)) { await (await r.$('button')).click(); break; } }
await sleep(500);
check((await count('workbench')) >= 1, 'crafted a workbench by hand');
await shot('03-craft');
await press('Escape');

// ── go to Hadamere and talk / shop
const town = await page.evaluate(() => { const g = window.__eigen.game; return null; });
void town;
console.log('(town e2e continues after server delivery)');

const bad = errors.filter((e) => !/GPU stall|swiftshader|WebGL|404/i.test(e));
console.log('console problems:', bad.length ? bad : 'none');
if (bad.length) failed = true;
await browser.close();
process.exit(failed ? 1 : 0);
