// Off-hand and hand rules in the real game: hold left click to block, let go to parry, right click attacks; a shield
// worn with a one-handed weapon is drawn on the arm and lengthens the parry; food in hand cannot attack.
// usage: node e2e/offhand.mjs [url]   (e.g. a VITE_SOLO=1 dev server, which runs the server room in the page)
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.env.OUT ?? 'test-results/offhand';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5244/'}?dev=1&hour=12`);
  await page.fill('#name', 'Shield audit');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await page.evaluate(() => window.__eigen.game.ext.circuit.send('p3_tutorial', { action: 'skip' }));
  await page.waitForTimeout(700);
  const g = (fn, arg) => page.evaluate(fn, arg);
  // select the starting sword, then put on a wooden shield
  await g(() => {
    const game = window.__eigen.game;
    const inv = game.gameplay.profile.inv;
    game.gameplay.hotbar.select(inv.findIndex((s) => s?.id === 'sword'));
    game.net.dev({ cmd: 'give', id: 'wood_shield', n: 1 });
  });
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.inv.some((s) => s?.id === 'wood_shield'));
  await g(() => {
    const game = window.__eigen.game;
    const slot = game.gameplay.profile.inv.findIndex((s) => s?.id === 'wood_shield');
    game.net.send('equip', { slot, as: 'shield' });
  });
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.equip.shield?.id === 'wood_shield');
  await page.waitForFunction(() => window.__eigen.game.predictor.sim.shield > 0);
  await page.waitForTimeout(400);
  const rest = await g(() => {
    const game = window.__eigen.game,
      v = game.views.get(game.myId);
    return { offhand: !!v.offhand?.visible, held: !!v.held?.visible, shield: game.predictor.sim.shield };
  });
  assert.ok(rest.shield > 0, 'a shield with a one-handed sword guards');
  assert.ok(rest.held, 'the sword is drawn in hand');
  await page.screenshot({ path: `${out}/1-sword-and-shield.png` });

  // hold left click: guard (block stance)
  const me = await g(() => window.__eigen.game.input.playerScreen);
  await page.mouse.move(me.x + 60, me.y + 40);
  await page.mouse.down({ button: 'left' });
  await page.waitForFunction(() => window.__eigen.game.predictor.sim.guard > 0);
  await page.waitForTimeout(250);
  const guard = await g(() => {
    const game = window.__eigen.game,
      p = game.predictor.sim;
    return { guard: p.guard, parry: p.parryT, frame: game.views.get(game.myId).personFrame };
  });
  assert.equal(guard.guard, 1);
  assert.equal(guard.parry, 0, 'holding guard blocks; it does not parry');
  await page.screenshot({ path: `${out}/2-guard.png` });
  // let go: the parry window opens and the parry clip plays
  await page.mouse.up({ button: 'left' });
  await page.waitForFunction(() => window.__eigen.game.predictor.sim.parryT > 0, null, { timeout: 2000 });
  await page.waitForTimeout(90);
  const parry = await g(() => {
    const game = window.__eigen.game;
    return { parry: game.predictor.sim.parryT, frame: game.views.get(game.myId).personFrame };
  });
  await page.screenshot({ path: `${out}/3-parry.png` });
  assert.ok(parry.frame >= 238 && parry.frame < 246, `parry pose plays (frame ${parry.frame})`);

  // right click attacks with the sword
  await page.waitForTimeout(800);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(60);
  await page.mouse.up({ button: 'right' });
  await page.waitForFunction(
    () => window.__eigen.game.predictor.sim.atkCd > 0 || window.__eigen.game.predictor.sim.combo > 0,
    null,
    { timeout: 2000 },
  );

  // seeds in hand: right click does nothing, and the game says why
  await page.waitForTimeout(800);
  await g(() => {
    const game = window.__eigen.game;
    const inv = game.gameplay.profile.inv;
    game.gameplay.hotbar.select(inv.findIndex((s) => s && /_seed$/.test(s.id)));
  });
  await page.waitForTimeout(200);
  const before = await g(() => window.__eigen.game.predictor.sim.combo);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(80);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(200);
  const unarmed = await g(() => {
    const p = window.__eigen.game.predictor.sim;
    return { unarmed: p.unarmed, atkCd: p.atkCd, combo: p.combo, shield: p.shield };
  });
  assert.equal(unarmed.unarmed, true);
  assert.equal(unarmed.atkCd, 0);
  assert.equal(unarmed.combo, before);
  assert.equal(unarmed.shield, 0, 'no shield guard with seeds in hand');
  await page.screenshot({ path: `${out}/4-seeds-in-hand.png` });
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify({ rest, guard, parry, unarmed, errors }, null, 2));
  console.log('PASS off-hand shield, hold-to-block, release-to-parry pose, right-click attack, no attack with seeds');
} finally {
  await browser.close();
}
