// Dungeon gates on the solo build: a ranked gate in the wilds, its dungeon, the master's hall, the clear and the way
// out. Usage: node e2e/gates.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-gates';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '?dev=1');
await page.evaluate(() => localStorage.setItem('eigen.tutorial2', '["all"]'));
await page.reload();
await page.fill('#name', 'Hunter').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
const sim = () => page.evaluate(() => ({ ...window.__eigen.game.predictor.sim }));
await dev({ cmd: 'level', level: 40 });
// the server's clock to mid-morning
const sh = '/@fs/home/user/EIGENLANDS/packages/shared/src/index.ts';
const shift = await page.evaluate(async (sh) => {
  const s = await import(sh);
  const now = window.__eigen.game.clock.serverNow(performance.now());
  const h = s.gameHour(now);
  return (((10 - h + 24) % 24) * s.DAY_MS) / 24;
}, sh);
await dev({ cmd: 'time', offsetMs: shift });
await page.waitForTimeout(1500);
// today's nearest gate that is not in a town
const g = await page.evaluate(async (sh) => {
  const s = await import(sh);
  const game = window.__eigen.game;
  const day = s.dayNumber(game.clock.serverNow(performance.now()));
  const all = s.gatesNear(game.store.seed, day, -700, -700, 700, 700, () => true);
  all.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  return all.find((g) => !s.townAt(game.store.seed, g.x, g.y)) ?? null;
}, sh);
console.log('gate', JSON.stringify(g));
await dev({ cmd: 'tp', x: g.x + 3.5, y: g.y + 4.5 });
await page.waitForTimeout(5000);
const shown = await page.evaluate(() => window.__eigen.state().p34?.gates ?? 0);
console.log('gates in view', shown);
await page.screenshot({ path: `${out}/1-gate.png` });
// step in
await dev({ cmd: 'tp', x: g.x + 0.5, y: g.y + 0.5 });
await page.waitForTimeout(5000);
const inside = await sim();
console.log('inside y', inside.y);
await page.screenshot({ path: `${out}/2-dungeon-entry.png` });
// the first hall, then the master's
const L = await page.evaluate(
  async ([sh, slot]) => {
    const s = await import(sh);
    const L = s.gateLayout(window.__eigen.game.store.seed, slot);
    return { ox: L.ox, oy: s.GATE_OY, rooms: L.rooms, theme: L.theme };
  },
  [sh, g.slot],
);
console.log('theme', L.theme, 'rooms', L.rooms.length);
const hall = L.rooms[1];
await dev({ cmd: 'tp', x: L.ox + hall.x + 0.5, y: L.oy + hall.y + 0.5 });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/3-hall.png` });
await dev({ cmd: 'kill', d: 20 });
const m = L.rooms.find((r) => r.kind === 'master');
await dev({ cmd: 'tp', x: L.ox + m.x + 0.5, y: L.oy + m.y + 5.5 });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/4-master.png` });
await dev({ cmd: 'kill', d: 20 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/5-cleared.png` });
// the way out
const e = L.rooms[0];
await dev({ cmd: 'tp', x: L.ox + e.x + 0.5, y: L.oy + e.y - 2.5 });
await page.waitForTimeout(5000);
const back = await sim();
console.log('back near gate', Math.hypot(back.x - g.x, back.y - g.y).toFixed(1));
await page.screenshot({ path: `${out}/6-back.png` });
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
