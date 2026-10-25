import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/',
  out = process.argv[3] ?? '/tmp/perf-controls';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let p;
try {
  p = await b.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (/ERROR:|Failed to compile|Could not initialize shader/.test(m.text())) errors.push(m.text());
  });
  await p.goto(base + '?dev=1&hour=12');
  await p.waitForSelector('#g-off:not([hidden])');
  await p.fill('#name', 'Visual budget');
  await p.click('#btn-guest');
  const ready = () =>
    p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
      timeout: 90000,
    });
  await ready();
  await p.evaluate(() => {
    const g = window.__eigen.game,
      u = g.weatherFx.update;
    g.weatherFx.update = function (...args) {
      args[1] = 'storm';
      return u.apply(this, args);
    };
    window.__camera = [];
    g.app.ticker.add(() => {
      const v = g.views.get(g.myId);
      if (v && g.input.lookHeld && g.fx.shake <= 0)
        window.__camera.push(
          Math.hypot(
            g.world.x + v.root.x * g.scale - innerWidth / 2,
            g.world.y + (v.root.y - 6) * g.scale - innerHeight / 2,
          ),
        );
    });
  });
  const settings = async () => {
    await p.click('#btn-menu');
    await p.click('#btn-settings');
  };
  const opaque = () =>
    p.evaluate(async () => {
      const g = window.__eigen.game,
        { pixels: a } = await g.app.renderer.extract.pixels({ target: g.terrain.rt });
      let n = 0;
      for (let i = 3; i < a.length; i += 4) if (a[i] === 255) n++;
      return n / (a.length / 4);
    });
  await settings();
  await p.getByLabel('Graphics', { exact: true }).selectOption('high');
  await p.getByLabel('Weather effects', { exact: true }).selectOption('full');
  await p.waitForFunction(
    () =>
      window.__eigen.game.economy === false &&
      window.__eigen.game.weatherFx.rain.filter((d) => d.s.visible).length > 30,
  );
  assert((await opaque()) > 0.99);
  await p.screenshot({ path: `${out}/high.png` });
  await p.getByLabel('Graphics', { exact: true }).selectOption('economy');
  await p.getByLabel('Weather effects', { exact: true }).selectOption('gentle');
  await p.getByLabel('Movement controls', { exact: true }).selectOption('mouse');
  await p.click('#btn-close');
  await p.waitForFunction(
    () => window.__eigen.game.economy === true && window.__eigen.game.app.renderer.resolution === 1,
  );
  assert((await opaque()) > 0.99);
  await p.screenshot({ path: `${out}/mobile.png` });
  const start = await p.evaluate(() => {
    const s = window.__eigen.state();
    return { x: s.x, y: s.y };
  });
  const feet = await p.evaluate(() => window.__eigen.game.input.feetScreen);
  await p.mouse.move(feet.x + 90, feet.y);
  await p.mouse.down({ button: 'right' });
  await p.waitForTimeout(1300);
  await p.keyboard.press('ShiftLeft');
  await p.waitForFunction(() => window.__eigen.game.predictor.sim.dashN < 2);
  await p.waitForTimeout(350);
  await p.mouse.up({ button: 'right' });
  const moved = await p.evaluate(
    (start) => Math.hypot(window.__eigen.state().x - start.x, window.__eigen.state().y - start.y),
    start,
  );
  assert(moved > 0.5, 'real RMB movement');
  const camera = await p.evaluate(() => window.__camera);
  assert(camera.length > 3);
  assert(Math.max(...camera) < 3, 'camera and cached terrain follow the player without mouse drift');
  const before = await p.evaluate(() => window.__eigen.game.predictor.sim.combo);
  await p.mouse.down();
  await p.waitForTimeout(220);
  await p.mouse.up();
  await p.waitForFunction(
    (before) => window.__eigen.game.predictor.sim.combo !== before || window.__eigen.game.predictor.sim.atkCd > 0,
    before,
  );
  await settings();
  await p.getByLabel('Weather effects', { exact: true }).selectOption('off');
  await p.click('#btn-close');
  await p.waitForFunction(() => window.__eigen.game.weatherFx.rain.every((d) => !d.s.visible));
  await p.reload();
  await ready();
  assert.equal(await p.evaluate(() => window.__eigen.game.settings().graphics), 'economy');
  assert.equal(await p.evaluate(() => window.__eigen.game.settings().weatherDetail), 'off');
  assert.equal(await p.evaluate(() => window.__eigen.game.input.movementMode), 'mouse');
  assert((await opaque()) > 0.99);
  await p.setViewportSize({ width: 1280, height: 720 });
  await settings();
  await p.getByLabel('Graphics', { exact: true }).selectOption('high');
  await p.click('#btn-close');
  await p.waitForFunction(() => !window.__eigen.game.economy);
  assert((await opaque()) > 0.99);
  await p.screenshot({ path: `${out}/desktop.png` });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: native graphics/weather settings, both shaders opaque, touch DPR2, real RMB movement/dash/attack, centered camera, saved reload and desktop High',
  );
} catch (e) {
  if (p) {
    await p.screenshot({ path: `${out}/failure.png` });
    console.log(
      await p.evaluate(() => ({
        state: window.__eigen?.state(),
        message: document.querySelector('#login-msg')?.textContent,
      })),
    );
  }
  throw e;
} finally {
  await b.close();
}
