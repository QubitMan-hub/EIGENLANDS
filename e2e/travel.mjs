// Travel proof on the solo build: attune the Hadamere gate and two wild stones by walking up, open the gate,
// travel, then ride a horse. Usage: node e2e/travel.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-travel';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base + '?dev=1&hour=12');
await page.evaluate(() => {
  localStorage.setItem('eigen.tutorial2', '["all"]');
  const s = JSON.parse(localStorage.getItem('eigen.settings') || '{}');
  s.graphics = 'performance';
  localStorage.setItem('eigen.settings', JSON.stringify(s));
});
await page.reload();
await page.fill('#name', 'Wayfarer').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
await page.waitForTimeout(2500);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const state = () =>
  page.evaluate(() => {
    const g = window.__eigen.game;
    const s = g.debugState();
    return {
      x: +s.x.toFixed(2),
      y: +s.y.toFixed(2),
      travel: g.ext.travel.debug(),
      list: g.ext.travel.list().map((w) => w.name),
      coins: g.gameplay.profile.coins,
    };
  });
const tp = async (x, y, wait = 2500) => {
  await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
  await page.waitForTimeout(wait);
};
const stones = await page.evaluate(() => window.__eigen.game.ext.travel.nearby(400).map((s) => ({ ...s })));
console.log(
  'stones within 400:',
  stones.length,
  stones
    .slice(0, 6)
    .map((s) => `${s.name}@${s.x},${s.y}`)
    .join(' | '),
);
const gate = stones.find((s) => s.kind === 'gate');
const wilds = stones.filter((s) => s.wild).slice(0, 2);
// 1. attune the gate by walking up to it, then two wild stones
for (const s of [gate, ...wilds]) {
  await tp(s.x + 0.5, s.y + (s.kind === 'gate' ? 2.5 : 1.5));
  console.log('at', s.name, JSON.stringify((await state()).travel));
  await shot(`1-${s.name.replace(/\W+/g, '_')}`);
}
console.log('attuned', JSON.stringify(await state()));
// 2. back at the gate: open its travel window
await tp(gate.x + 0.5, gate.y + 2.5);
await page.evaluate(([x, y]) => window.__eigen.game.net.open(x, y), [gate.x, gate.y]);
await page.waitForTimeout(1200);
await shot('2-travel-window');
const rows = await page.locator('.travel-row').count();
console.log('travel rows', rows, await page.locator('.travel-here').textContent());
// 3. travel to the first wild stone
const before = await state();
await page.locator('.travel-row button:not([disabled])').first().click();
await page.waitForTimeout(800);
await shot('3-channel');
await page.waitForTimeout(3500);
const after = await state();
console.log(
  'jump',
  JSON.stringify({ before: [before.x, before.y, before.coins], after: [after.x, after.y, after.coins] }),
);
await shot('4-arrived');
// 4. mount a horse and ride
await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'give', id: 'horse_whistle', n: 1 }));
await page.waitForTimeout(800);
const slot = await page.evaluate(() =>
  window.__eigen.game.gameplay.profile.inv.findIndex((s) => s?.id === 'horse_whistle'),
);
await page.evaluate((slot) => window.__eigen.game.net.use({ slot, tx: 0, ty: 0 }), slot);
await page.waitForTimeout(800);
const r0 = await state();
await page.keyboard.down('KeyD');
await page.waitForTimeout(1500);
await shot('5-riding');
await page.keyboard.up('KeyD');
const r1 = await state();
console.log(
  'ride 1.5s moved',
  Math.hypot(r1.x - r0.x, r1.y - r0.y).toFixed(2),
  'mount',
  await page.evaluate(() => window.__eigen.game.predictor.sim.mount),
);
await page.waitForTimeout(400);
await shot('6-standing-mounted');
await b.close();
console.log('errors', errors.slice(0, 8));
