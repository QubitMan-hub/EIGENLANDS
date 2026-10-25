import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/',
  out = process.argv[3] ?? '/tmp/gather-polish';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let p;
const errors = [];
try {
  p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(() => localStorage.setItem('eigen.settings', JSON.stringify({ graphics: 'economy' })));
  await p.goto(base + '?dev=1&hour=12');
  await p.waitForSelector('#g-off:not([hidden])');
  await p.fill('#name', 'Woodland trial');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 90000,
  });
  await p.evaluate(() => (window.__eigen.game.app.ticker.maxFPS = 20));
  const tp = async (x, y) => {
    await p.waitForFunction(() => window.__eigen.game.predictor.sim.dashT <= 0);
    await p.evaluate(({ x, y }) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), { x, y });
    await p.waitForFunction(
      ({ x, y }) => Math.hypot(window.__eigen.state().x - x, window.__eigen.state().y - y) < 0.2,
      { x, y },
      { timeout: 30000 },
    );
    await p.waitForTimeout(1000);
  };
  const select = async (id) => {
    await p.evaluate((id) => {
      const g = window.__eigen.game;
      g.gameplay.hotbar.select(g.gameplay.profile.inv.findIndex((s) => s?.id === id));
    }, id);
  };
  const aim = async (tx, ty) => {
    const q = await p.evaluate(
      ({ tx, ty }) => {
        const g = window.__eigen.game;
        return { x: g.world.x + (tx - ty) * 16 * g.scale, y: g.world.y + (tx + ty + 1) * 8 * g.scale };
      },
      { tx, ty },
    );
    await p.mouse.move(q.x, q.y);
    await p.waitForFunction(
      ({ tx, ty }) => window.__eigen.game.input.mouseTile?.tx === tx && window.__eigen.game.input.mouseTile?.ty === ty,
      { tx, ty },
    );
    return q;
  };
  const tree = await p.evaluate(() => {
    const g = window.__eigen.game;
    for (let y = -24; y < 24; y++)
      for (let x = -24; x < 24; x++)
        if (g.store.getTile(x, y) === 6 && !g.store.objectAt(x, y))
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            let ok = true;
            for (let i = 1; i <= 5; i++)
              if (g.store.solidAt(x + dx * i, y + dy * i) || g.store.objectAt(x + dx * i, y + dy * i)) ok = false;
            if (ok) return { tx: x, ty: y, x: x + dx * 5 + 0.5, y: y + dy * 5 + 0.5 };
          }
  });
  assert(tree);
  await tp(tree.x, tree.y);
  await select('axe');
  const wood = await p.evaluate(() => window.__eigen.game.gameplay.profile.count('wood'));
  const point = await p.evaluate(({ tx, ty }) => {
    const g = window.__eigen.game;
    for (const m of g.objects.chunks.values())
      for (const o of m.values())
        if (o.tx === tx && o.ty === ty) {
          const a = o.root.getBounds();
          for (let y = Math.max(170, a.minY); y < a.maxY; y += 3)
            for (let x = Math.max(280, a.minX); x < Math.min(1050, a.maxX); x += 3) {
              const hit = g.objects.pickMineable(x, y, 'axe');
              if (hit?.tx === tx && hit?.ty === ty) return { x, y };
            }
        }
  }, tree);
  assert(point);
  await p.mouse.click(point.x, point.y);
  await p.waitForFunction(({ tx, ty }) => window.__eigen.game.store.getTile(tx, ty) === 10, tree, { timeout: 25000 });
  await p.waitForFunction((n) => window.__eigen.game.gameplay.profile.count('wood') > n, wood);
  assert.equal(await p.evaluate(() => window.__eigen.game.gameplay.acts.attacked), false);
  await p.screenshot({ path: `${out}/logging.png` });
  for (let i = 0; i < 2; i++) {
    await p.waitForFunction(() => window.__eigen.game.predictor.sim.dashT <= 0);
    const n = await p.evaluate(() => window.__eigen.game.predictor.sim.dashN);
    await p.keyboard.press('ShiftLeft');
    await p.waitForFunction((n) => window.__eigen.game.predictor.sim.dashN < n, n);
  }
  await p.keyboard.press('ShiftLeft');
  assert.equal(await p.evaluate(() => window.__eigen.game.predictor.sim.dashN), 0, 'spam exhausts the two charges');
  await p.waitForTimeout(1800);
  console.log('logging and dodge passed');
  const shore = await p.evaluate(() => {
    const g = window.__eigen.game;
    for (let y = -28; y < 28; y++)
      for (let x = -28; x < 28; x++)
        if (!g.store.solidAt(x, y) && !g.store.objectAt(x, y))
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            if ([0, 1].includes(g.store.getTile(x + dx, y + dy))) return { x: x + 0.5, y: y + 0.5 };
  });
  assert(shore);
  console.log('shore', shore);
  await tp(shore.x, shore.y);
  await select('rod');
  await p.mouse.move(1100, 650);
  await p.keyboard.press('Space');
  await p.waitForFunction(() => !!window.__eigen.game.gameplay.fishing, null, { timeout: 15000 });
  const cast = await p.evaluate(() => window.__eigen.game.gameplay.fishing.id);
  await p.keyboard.press('Space');
  assert.equal(
    await p.evaluate(() => window.__eigen.game.gameplay.fishing.id),
    cast,
    'early Space must not reset the bite timer',
  );
  await p.screenshot({ path: `${out}/shore-fishing.png` });
  console.log('shore fishing passed');
  await select('axe');
  const statue = await p.evaluate(() => {
    const g = window.__eigen.game;
    for (let cy = -3; cy <= 3; cy++) for (let cx = -3; cx <= 3; cx++) g.store.get(cx, cy);
    const o = [...g.store.objects.values()].find((o) => o.sub === 'statue');
    return o && { x: o.x, y: o.y };
  });
  assert(statue);
  await tp(statue.x + 0.5, statue.y + 1.5);
  await aim(statue.x, statue.y);
  await p.keyboard.press('Space');
  await p.waitForSelector('.lore');
  const centered = () =>
    p.evaluate(() => {
      const r = document.querySelector('.lore').getBoundingClientRect(),
        w = document.querySelector('.window:has(.lore)').getBoundingClientRect();
      return {
        offset: Math.abs((r.left + r.right - w.left - w.right) / 2),
        overflow:
          document.querySelector('.window:has(.lore)').scrollWidth >
          document.querySelector('.window:has(.lore)').clientWidth,
      };
    });
  assert((await centered()).offset < 2);
  await p.screenshot({ path: `${out}/statue-desktop.png` });
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(300);
  assert((await centered()).offset < 2);
  assert.equal((await centered()).overflow, false);
  await p.getByRole('button', { name: 'Read the legend ▸', exact: true }).click();
  await p.screenshot({ path: `${out}/statue-mobile.png` });
  await p.setViewportSize({ width: 390, height: 740 });
  await p.waitForTimeout(250);
  assert((await centered()).offset < 2);
  assert.equal((await centered()).overflow, false);
  await p.screenshot({ path: `${out}/statue-portrait.png` });
  await p.keyboard.press('Escape');
  await p.setViewportSize({ width: 1280, height: 720 });
  console.log('statue passed');
  const stairs = await p.evaluate(() => {
    const o = [...window.__eigen.game.store.objects.values()].find(
      (o) => o.sub === 'stairs_up' && o.data?.building === 'hall',
    );
    return o && { x: o.x, y: o.y };
  });
  assert(stairs);
  await tp(stairs.x + 0.5, stairs.y + 0.5);
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.__eigen.state().y < -79000, null, { timeout: 30000 });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/corner-stairs.png` });
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.__eigen.state().y > -79000, null, { timeout: 30000 });
  console.log('stairs passed');
  await tp(132.5, -4.5);
  await p.evaluate(() => {
    const g = window.__eigen.game,
      s = g.predictor.sim,
      dist = [4, 5, 6, 7, 8].filter(
        (d) => !g.store.solidAt(Math.floor(s.x + Math.cos(0.3) * d), Math.floor(s.y + Math.sin(0.3) * d)),
      );
    if (dist.length < 2) throw new Error('No natural encounter fixture');
    g.net.dev({ cmd: 'spawn', kind: 'reed_stalker', n: 1, d: dist[0] });
    g.net.dev({ cmd: 'spawn', kind: 'cinder_moth', n: 1, d: dist[1] });
  });
  await p.waitForFunction(
    () => {
      const kinds = [...window.__eigen.game.views.values()].map((v) => v.kind);
      return kinds.includes(22) && kinds.includes(23);
    },
    null,
    { timeout: 20000 },
  );
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/new-encounters.png` });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: real axe/tree loot, finite dodge charges, Space shore fishing without cursor precision, centered statue at two sizes, reversible corner stairs and both new enemy sprites',
  );
} catch (e) {
  if (p) {
    console.log(
      await p.evaluate(() => ({
        state: window.__eigen?.state(),
        toasts: document.querySelector('#toasts')?.textContent,
      })),
    );
    await p.screenshot({ path: `${out}/failure.png` });
  }
  throw e;
} finally {
  await b.close();
}
