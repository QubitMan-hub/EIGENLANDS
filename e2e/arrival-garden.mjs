import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'docs/validation/arrival-garden';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } }),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${process.argv[2] ?? 'http://localhost:5244/'}?dev=1&hour=12`);
  await p.fill('#name', 'Glade review');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await p.evaluate(() => window.__eigen.game.ext.circuit.send('p3_tutorial', { action: 'skip' }));
  await p.waitForTimeout(8500);
  const garden = await p.evaluate(() => window.__eigen.game.arrival.debug());
  const hiddenWorkers = await p.evaluate(() =>
    window.__eigen.game.arrival.actors
      .filter((a) => a.root.visible && !a.animal && !a.body.visible)
      .map((a) => a.sc.kind),
  );
  assert.deepEqual(hiddenWorkers, [], 'Active workers must render their own bodies after warm-up');
  assert.ok(garden.props > 20);
  assert.ok(garden.actors >= 4);
  const before = await p.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.stop();
    const a = g.arrival;
    window.__arrivalHidden = [...a.props.map((p) => p.sp), ...a.actors.map((p) => p.root)].map((sp) => {
      const visible = sp.visible;
      sp.visible = false;
      return { sp, visible };
    });
    g.app.renderer.render(g.app.stage);
    return { x: g.predictor.sim.x, y: g.predictor.sim.y, scale: g.scale };
  });
  await p.screenshot({ path: `${out}/before.png` });
  await p.evaluate(() => {
    for (const { sp, visible } of window.__arrivalHidden) sp.visible = visible;
    window.__eigen.game.app.renderer.render(window.__eigen.game.app.stage);
  });
  await p.screenshot({ path: `${out}/after.png` });
  await p.evaluate(() => window.__eigen.game.app.ticker.start());
  await p.evaluate(() => window.__eigen.game.net.dev({ cmd: 'tp', x: -3.5, y: 1.5 }));
  await p.waitForSelector('#arrival-guide:not([hidden])', { timeout: 20000 });
  assert.ok((await p.locator('#arrival-guide').textContent()).includes('Hadamere'));
  await p.screenshot({ path: `${out}/guide.png` });
  const motion = await p.evaluate(async () => {
    const g = window.__eigen.game,
      a = g.arrival.actors.find((a) => a.sc.kind === 'porter');
    const points = [];
    for (let i = 0; i < 30; i++) {
      points.push({ x: a.x, y: a.y, frame: a.personFrame, carry: a.carryKind });
      await new Promise((r) => setTimeout(r, 100));
    }
    return points;
  });
  assert.ok(new Set(motion.map((p) => p.frame)).size > 1);
  const yielded = await p.evaluate(() => {
    const g = window.__eigen.game,
      a = g.arrival.props.find((p) => p.at.kind === 'flower' && p.sp.visible);
    const { x, y } = a.at;
    const old = g.store.getTile(x, y);
    g.store.setTile(x, y, old);
    return { x, y };
  });
  await p.waitForTimeout(250);
  assert.equal(
    await p.evaluate(
      ({ x, y }) =>
        window.__eigen.game.arrival.props.find((p) => p.at.x === x && p.at.y === y && p.at.kind === 'flower').sp
          .visible,
      yielded,
    ),
    false,
  );
  // Night watch uses the same game clock as the other ambient scenes.
  await p.evaluate(() => (window.__eigen.game.hourOverride = 22));
  await p.waitForTimeout(1500);
  const night = await p.evaluate(() => {
    const a = window.__eigen.game.arrival.actors;
    return {
      watch: a.find((a) => a.sc.kind === 'watchman').root.visible,
      busker: a.find((a) => a.sc.kind === 'busker').root.visible,
    };
  });
  assert.equal(night.watch, true);
  assert.equal(night.busker, false);
  await p.evaluate(() => window.__eigen.game.net.dev({ cmd: 'tp', x: 0.5, y: 4.5 }));
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/night.png` });
  await p.evaluate(() => window.__eigen.game.net.dev({ cmd: 'tp', x: 32.5, y: 4.5 }));
  await p.waitForTimeout(2000);
  assert.deepEqual(await p.evaluate(() => window.__eigen.game.arrival.debug()), { props: 0, actors: 0 });
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify({ garden, before, motion, yielded, night, errors }, null, 2));
  console.log(
    'PASS arrival garden, same-camera comparison, guide, work animation, edit exclusion, night watch and cleanup',
  );
} finally {
  await b.close();
}
