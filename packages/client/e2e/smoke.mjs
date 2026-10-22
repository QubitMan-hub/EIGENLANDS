// Browser smoke test: node e2e/smoke.mjs [url] [outdir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(url);
await page.screenshot({ path: `${out}/1-login.png` });
await page.fill('#name', 'Tester');
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 20000 });
await sleep(1500);
await page.screenshot({ path: `${out}/2-spawn.png` });

const s0 = await page.evaluate(() => window.__eigen.state());
console.log('spawned', { x: s0.x, y: s0.y, chunks: s0.chunks, scale: s0.scale, fps: s0.fps?.toFixed(0) });
if (!(s0.chunks >= 9)) fail('expected >= 9 chunks drawn');

await page.keyboard.down('KeyD');
await sleep(1200);
await page.keyboard.up('KeyD');
const s1 = await page.evaluate(() => window.__eigen.state());
// iso camera: D = screen-right = world (+x, -y); screen-right displacement is (dx - dy) / sqrt(2)
const screenRight = ((s1.x - s0.x) - (s1.y - s0.y)) / Math.SQRT2;
console.log('after moving right', { x: s1.x, y: s1.y, screenRight: screenRight.toFixed(2), correction: s1.correction, pending: s1.pending });
if (!(screenRight > 3)) fail('player did not move right (screen space)');
if (!(s1.x > s0.x + 1.5 && s1.y < s0.y - 1.5)) fail('screen-right should move along +x/-y in the world');

await page.keyboard.press('Space');
await sleep(100);
await page.mouse.move(800, 300);
await page.mouse.down(); await sleep(400); await page.mouse.up();
await page.keyboard.press('KeyK');
await sleep(500);
await page.screenshot({ path: `${out}/3-combat.png` });

// walk far enough to stream new chunks (infinite world)
await page.keyboard.down('KeyS');
await sleep(6000);
await page.keyboard.up('KeyS');
const s2 = await page.evaluate(() => window.__eigen.state());
console.log('after long walk', { y: s2.y, chunks: s2.chunks, enemies: s2.enemies, rtt: s2.rtt?.toFixed(1), fps: s2.fps?.toFixed(0) });
await page.screenshot({ path: `${out}/4-walked.png` });

await page.keyboard.press('F3');
await page.click('#btn-settings');
await sleep(200);
await page.screenshot({ path: `${out}/5-settings.png` });
await page.click('#btn-close');

// reload: session resumes, character persisted
await sleep(1500);
await page.reload();
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 20000 });
const s3 = await page.evaluate(() => window.__eigen.state());
console.log('after reload', { x: s3.x, y: s3.y });
if (Math.hypot(s3.x - s2.x, s3.y - s2.y) > 8) fail('character position not restored after reload');
await sleep(800);
await page.screenshot({ path: `${out}/6-reload.png` });

const bad = errors.filter((e) => !/GPU stall|swiftshader|GroupMarker|WebGL/i.test(e));
console.log('console problems:', bad.length ? bad : 'none');
if (bad.length) fail('console errors');
await browser.close();
