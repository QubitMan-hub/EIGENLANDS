// Combat 2.0 browser check: node e2e/combat.mjs [url] [outdir]
// Needs a server with DEV_COMMANDS=1. Takes frame sequences of combos, the charged heavy, telegraphs, dodges and new foes.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5270/?hour=12';
const out = process.argv[3] ?? '/tmp/combat-shots';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const st = () => page.evaluate(() => { const s = window.__eigen.state(); return { x: s.x, y: s.y, hp: s.hp, dead: s.dead, correction: s.correction, pending: s.pending, rtt: s.rtt, combat: s.combat }; });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const seq = async (name, n, gap) => { for (let i = 0; i < n; i++) { await shot(`${name}-${i}`); await sleep(gap); } };
const clearFoes = () => page.evaluate(() => 0);
/** point the mouse at a world position (aims attacks there) */
const aimAt = async (wx, wy) => {
  const p = await page.evaluate(([wx, wy]) => {
    const g = window.__eigen.game; const s = window.__eigen.state(); const S = s.scale;
    const ix = (x, y) => (x - y) * 16, iy = (x, y) => (x + y) * 8;
    return { x: innerWidth / 2 + (ix(wx, wy) - ix(s.x, s.y)) * S, y: innerHeight / 2 + (iy(wx, wy) - 8 - (iy(s.x, s.y) - 6)) * S, g: !!g };
  }, [wx, wy]);
  await page.mouse.move(p.x, p.y);
};
const nearestFoe = async (kind) => { const s = await st(); const f = (s.combat?.foes ?? []).filter((e) => kind === undefined || e.kind === kind); f.sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y)); return f[0]; };

await page.goto(url);
await page.fill('#name', 'Duelist');
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 25000 });
await sleep(1200);
// open meadow north-east of the shrine
await dev({ cmd: 'tp', x: 30.5, y: -20.5 }); await sleep(1500);
await dev({ cmd: 'level', level: 5 }); await sleep(300);

// 1) three-hit combo on a slime
await dev({ cmd: 'spawn', kind: 'slime', n: 1, d: 1.6 }); await sleep(600);
let foe = await nearestFoe(0);
if (!foe) fail('no slime spawned');
else {
  await aimAt(foe.x, foe.y);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyJ'); await shot(`1-combo-hit${i + 1}`); await sleep(i === 2 ? 60 : 280); }
  await seq('1-combo-after', 3, 80);
}

// 2) charged heavy: hold, watch the ring fill, release
await sleep(600);
foe = await nearestFoe();
if (foe) await aimAt(foe.x, foe.y);
await page.keyboard.down('KeyJ');
await sleep(350); await shot('2-charge-0');
await sleep(400); await shot('2-charge-ready');
await sleep(500); await shot('2-charge-full');
const charging = await st();
if (!(charging.combat?.charge > 0.5)) fail(`heavy did not charge (charge=${charging.combat?.charge})`);
await page.keyboard.up('KeyJ');
await seq('2-heavy', 4, 50);

// 3) Decoherent Brute: charge telegraph lane, then dash through it
await dev({ cmd: 'spawn', kind: 'brute', n: 1, d: 5.5 }); await sleep(300);
let lane = false;
for (let i = 0; i < 80 && !lane; i++) { const b = await nearestFoe(5); if (b && b.st === 2) lane = true; else await sleep(50); }
if (!lane) fail('brute never telegraphed');
await seq('3-brute-windup', 3, 150);
await page.keyboard.down('KeyW'); await page.keyboard.press('Space'); await page.keyboard.up('KeyW');
await seq('3-brute-dodge', 4, 70);

// 4) Phase Wisp: aim line, orb in flight
await dev({ cmd: 'spawn', kind: 'wisp', n: 2, d: 6 }); await sleep(400);
for (let i = 0; i < 60; i++) { const w = await nearestFoe(4); if (w && w.st === 2) break; await sleep(50); }
await seq('4-wisp', 5, 160);

// 5) Static Mite swarm + a volatile elite slime
await dev({ cmd: 'spawn', kind: 'mite', n: 6, d: 3 }); await sleep(200);
await dev({ cmd: 'spawn', kind: 'slime', n: 1, d: 2.5, elite: 4 }); await sleep(500);
await shot('5-swarm');
for (let i = 0; i < 8; i++) { foe = await nearestFoe(); if (foe) await aimAt(foe.x, foe.y); await page.keyboard.press('KeyJ'); await sleep(140); }
await seq('5-swarm-fight', 3, 120);

// 6) night variants
await dev({ cmd: 'spawn', kind: 'wisp', n: 1, d: 5, night: true });
await dev({ cmd: 'spawn', kind: 'brute', n: 1, d: 7, night: true });
await sleep(1500);
await shot('6-night-variants');
const end = await st();
console.log('state', JSON.stringify({ hp: end.hp, dead: end.dead, correction: end.correction, pending: end.pending, rtt: end.rtt, foes: end.combat?.foes?.length, dashN: end.combat?.dashN }));
void clearFoes;

if (errors.length) { console.log('console errors:\n' + errors.join('\n')); fail('console errors'); }
await browser.close();
