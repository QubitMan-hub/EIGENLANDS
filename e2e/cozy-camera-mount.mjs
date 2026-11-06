import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'docs/validation/cozy-camera-mount';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } }),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${process.argv[2] ?? 'http://127.0.0.1:5244/'}?dev=1&hour=12`);
  await p.fill('#name', 'Cozy riding');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await p.evaluate(() => window.__eigen.game.ext.circuit.send('p3_tutorial', { action: 'skip' }));
  await p.waitForTimeout(1000);
  const before = await p.evaluate(() => {
    const g = window.__eigen.game,
      v = g.views.get(g.myId);
    return { zoom: g.settings().zoom, scale: g.scale, bodyCell: [v.sprite.texture.width, v.sprite.texture.height] };
  });
  assert.equal(before.zoom, 'normal');
  assert.equal(before.scale, 2);
  await p.screenshot({ path: `${out}/closer-world.png` });
  await p.evaluate(() => window.__eigen.game.net.dev({ cmd: 'give', id: 'horse_whistle', n: 1 }));
  await p.waitForFunction(() => window.__eigen.game.gameplay.profile.inv.some((s) => s?.id === 'horse_whistle'));
  await p.evaluate(() => {
    const g = window.__eigen.game,
      slot = g.gameplay.profile.inv.findIndex((s) => s?.id === 'horse_whistle');
    g.net.use({ slot, tx: 0, ty: 0 });
  });
  await p.waitForFunction(() => window.__eigen.game.predictor.sim.mount > 0);
  await p.waitForTimeout(600);
  const rider = await p.evaluate(() => {
    const g = window.__eigen.game,
      v = g.views.get(g.myId);
    return {
      frame: v.personFrame,
      fullCell: v.sprite.texture.height,
      reins: v.riderReins?.visible,
      held: v.held?.visible ?? false,
      mounted: g.predictor.sim.mount,
    };
  });
  assert.ok(rider.frame >= 230 && rider.frame <= 237);
  assert.equal(rider.fullCell, 48);
  assert.equal(rider.reins, true);
  assert.equal(rider.held, false);
  await p.screenshot({ path: `${out}/seated.png` });
  for (const key of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
    await p.keyboard.down(key);
    await p.waitForTimeout(250);
    await p.keyboard.up(key);
    await p.waitForTimeout(100);
  }
  await p.screenshot({ path: `${out}/riding.png` });
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.__eigen.game.predictor.sim.mount === 0);
  await p.waitForTimeout(400);
  assert.equal(
    await p.evaluate(() => window.__eigen.game.views.get(window.__eigen.game.myId).riderReins.visible),
    false,
  );
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify({ before, rider, errors }, null, 2));
  console.log('PASS closer default view, full straddling rider cell, connected reins, movement and Space dismount');
} finally {
  await b.close();
}
