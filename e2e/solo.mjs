// Single-player (GitHub Pages) e2e: node e2e/solo.mjs [url] [outdir]
// Serve a solo build first, e.g.
//   VITE_SOLO=1 VITE_BASE=/EIGENLANDS/ npm run build -w @eigenlands/client
//   npx vite preview --base /EIGENLANDS/ --port 5240   (in packages/client)
// The page must work with no game server: guest login, movement, combat, inventory, save across a reload.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5240/EIGENLANDS/';
// ?dev=1 turns on the server's dev commands in solo builds (used below to change the save in a checkable way)
const url = `${base}${base.includes('?') ? '&' : '?'}dev=1`;
const out = process.argv[3] ?? '/tmp/shots-solo';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const requests = [];
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
page.on('request', (r) => requests.push(r.url()));
const st = () => page.evaluate(() => window.__eigen.state());
const ready = () => page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 30000 });

// ── first visit: guest login ──
await page.goto(url);
await page.waitForSelector('#g-off:not([hidden])');
const note = await page.textContent('#g-off');
console.log('login note:', note?.trim());
if (!/Single-player preview/.test(note ?? '') || !(await page.isVisible('#g-off'))) fail('solo note not shown');
await page.screenshot({ path: `${out}/1-login.png` });
await page.fill('#name', 'Solo');
await page.click('#btn-guest');
await ready();
await sleep(1500);
const s0 = await st();
console.log('spawned', { x: s0.x?.toFixed(2), y: s0.y?.toFixed(2), chunks: s0.chunks, shard: s0.shard, fps: s0.fps?.toFixed(0) });
if (!(s0.chunks >= 9)) fail('expected >= 9 chunks drawn');
await page.screenshot({ path: `${out}/2-spawn.png` });

// ── move: S is screen-down (+x +y in world space), D is screen-right (+x −y); step off the shrine plaza first ──
// (walking is currently ~0.5 tiles/s in headless Chromium, with the real server too)
await page.keyboard.down('KeyS');
await sleep(2000);
await page.keyboard.up('KeyS');
await sleep(300);
const sS = await st();
console.log('after S', { x: sS.x?.toFixed(2), y: sS.y?.toFixed(2) });
if (!((sS.x - s0.x) + (sS.y - s0.y) > 0.5)) fail('player did not move screen-down');
await page.keyboard.down('KeyD');
await sleep(2000);
await page.keyboard.up('KeyD');
await sleep(400);
const s1 = await st();
console.log('after D', { x: s1.x?.toFixed(2), y: s1.y?.toFixed(2), correction: s1.correction, pending: s1.pending });
const moved = (s1.x - sS.x) - (s1.y - sS.y);
if (!(moved > 0.5)) fail(`player did not move screen-right (Δx=${(s1.x - sS.x).toFixed(2)} Δy=${(s1.y - sS.y).toFixed(2)})`);
// the server agrees: little or no correction and nothing left unacknowledged
if (s1.pending > 6) fail(`inputs not acknowledged by the in-page server (pending=${s1.pending})`);

// ── attack (melee + skill) ──
await page.mouse.move(800, 300);
await page.mouse.down(); await sleep(300); await page.mouse.up();
await page.keyboard.press('KeyK');
await page.keyboard.press('ShiftLeft');
await sleep(600);
await page.screenshot({ path: `${out}/3-combat.png` });

// ── inventory ──
await page.keyboard.press('KeyI');
await sleep(500);
const inv = await page.evaluate(() => {
  const w = [...document.querySelectorAll('*')].find((e) => /^Pack$/.test(e.textContent?.trim() ?? '') && e.offsetParent !== null);
  return { open: !!w, items: (window.__eigen.state().inv ?? []).filter(Boolean).length };
});
console.log('inventory', inv);
if (!inv.open) fail('inventory window did not open');
await page.screenshot({ path: `${out}/4-inventory.png` });
await page.keyboard.press('KeyI');

// walk on and change the save: coins via a dev command (server-authoritative, persisted with the character)
await page.keyboard.down('KeyS');
await sleep(2500);
await page.keyboard.up('KeyS');
const coins0 = (await st()).coins ?? 0;
await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'coins', n: 123 }));
await page.waitForFunction((c) => window.__eigen.state().coins === c + 123, coins0, { timeout: 5000 }).catch(() => fail('dev coins command had no effect'));
await sleep(600);
const s2 = await st();
console.log('before reload', { x: s2.x?.toFixed(2), y: s2.y?.toFixed(2), coins: s2.coins, hp: s2.hp, level: s2.level, chunks: s2.chunks, enemies: s2.enemies, fps: s2.fps?.toFixed(0) });

// ── reload: session resumes from the browser save ──
await page.reload();
await ready();
await sleep(800);
await page.waitForFunction(() => window.__eigen.state().coins !== undefined, null, { timeout: 5000 }).catch(() => {});
const s3 = await st();
console.log('after reload', { x: s3.x?.toFixed(2), y: s3.y?.toFixed(2), coins: s3.coins, hp: s3.hp, level: s3.level });
if (Math.hypot(s3.x - s2.x, s3.y - s2.y) > 1) fail('character position not restored after reload');
if (Math.hypot(s2.x - s0.x, s2.y - s0.y) < 1) fail('test did not move away from the spawn point');
if (s3.coins !== s2.coins) fail(`coins not restored after reload (${s3.coins} != ${s2.coins})`);
await page.screenshot({ path: `${out}/5-reload.png` });

// ── a second tab takes the world over (like signing in elsewhere); the first tab is told so ──
const page2 = await ctx.newPage();
page2.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`tab2 ${m.type()}: ${m.text()}`); });
page2.on('pageerror', (e) => errors.push(`tab2 pageerror: ${e.message}`));
await page2.goto(url);
await page2.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 30000 });
await page.waitForSelector('#lost', { state: 'visible', timeout: 10000 }).catch(() => fail('first tab was not told about the takeover'));
const lostTitle = await page.textContent('#lost-title');
const t2 = await page2.evaluate(() => window.__eigen.state());
console.log('takeover', { firstTab: lostTitle, x: t2.x?.toFixed(2), y: t2.y?.toFixed(2), coins: t2.coins });
if (lostTitle !== 'Signed in elsewhere') fail('first tab shows the wrong message');
if (Math.hypot(t2.x - s3.x, t2.y - s3.y) > 1 || t2.coins !== s3.coins) fail('second tab did not get the saved character');
await page2.close();
await page.reload();
await ready();

// ── "Delete my data": wipes the save; the next visit starts over ──
page.once('dialog', (d) => void d.accept());
await page.click('#btn-menu');
await page.click('#btn-settings');
await sleep(200);
await Promise.all([page.waitForNavigation({ timeout: 15000 }), page.click('#btn-delete')]);
await page.waitForSelector('#btn-guest', { state: 'visible' });
await sleep(1000);
const after = await page.evaluate(async () => ({
  token: localStorage.getItem('eigen.token'),
  entered: !!window.__eigen,
  keys: await new Promise((res) => { const r = indexedDB.open('eigenlands-solo'); r.onsuccess = () => { const t = r.result.transaction('kv').objectStore('kv').getAllKeys(); t.onsuccess = () => { res(t.result); r.result.close(); }; }; r.onerror = () => res(null); }),
}));
console.log('after delete', after);
if (after.token || after.entered) fail('still signed in after deleting data');
// Boot may recreate world identity and day-one clock metadata; no player/world records may survive.
if (!Array.isArray(after.keys) || after.keys.some(k => !['meta:secret', 'meta:clock-offset'].includes(k))) fail(`save not wiped (${JSON.stringify(after.keys)})`);
await page.click('#btn-guest');
await ready();
const s4 = await st();
console.log('fresh start', { x: s4.x?.toFixed(2), y: s4.y?.toFixed(2), coins: s4.coins });
if (!(s4.hour >= 6 && s4.hour < 7)) fail('new world clock did not restart at dawn');
if (Math.hypot(s4.x - s0.x, s4.y - s0.y) > 1) fail('new character did not start at the spawn point');

// ── everything stayed in the browser ──
const external = requests.filter((u) => !u.startsWith(new URL(url).origin) && !u.startsWith('data:') && !u.startsWith('blob:'));
if (external.length) fail(`unexpected network requests: ${external.slice(0, 5).join(', ')}`);
if (requests.some((u) => /:2567|\/api\//.test(u))) fail('the page tried to reach a game server');

const bad = errors.filter((e) => !/GPU stall|swiftshader|GroupMarker|WebGL|AudioContext/i.test(e));
console.log('console problems:', bad.length ? bad : 'none');
if (bad.length) fail('console errors');
await browser.close();
console.log(process.exitCode ? 'SOLO E2E FAILED' : 'SOLO E2E OK');
