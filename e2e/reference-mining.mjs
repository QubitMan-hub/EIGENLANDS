import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'docs/validation/reference-mining';
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
  await p.fill('#name', 'Reference mining');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await p.evaluate(() => window.__eigen.game.ext.circuit.send('p3_tutorial', { action: 'skip' }));
  await p.waitForTimeout(800);
  const target = await p.evaluate(() => {
    const g = window.__eigen.game;
    for (const m of g.objects.chunks.values())
      for (const o of m.values())
        if (o.kind === 'rock' && Math.abs(o.tx) < 70 && Math.abs(o.ty) < 70) {
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            if (!g.store.solidAt(o.tx + dx, o.ty + dy) && !g.store.objectAt(o.tx + dx, o.ty + dy))
              return { tx: o.tx, ty: o.ty, x: o.tx + dx + 0.5, y: o.ty + dy + 0.5 };
        }
  });
  assert.ok(target, 'a real surface boulder with a walkable approach exists');
  await p.evaluate((t) => window.__eigen.game.net.dev({ cmd: 'tp', x: t.x, y: t.y }), target);
  await p.waitForFunction(
    (t) => Math.hypot(window.__eigen.game.predictor.sim.x - t.x, window.__eigen.game.predictor.sim.y - t.y) < 0.2,
    target,
    { timeout: 20000 },
  );
  const before = await p.evaluate(() => {
    const g = window.__eigen.game;
    g.gameplay.hotbar.select(g.gameplay.profile.inv.findIndex((s) => s?.id === 'pickaxe'));
    return g.gameplay.profile.count('stone');
  });
  await p.waitForTimeout(500);
  const point = await p.evaluate((t) => {
    const g = window.__eigen.game;
    for (const m of g.objects.chunks.values())
      for (const o of m.values())
        if (o.tx === t.tx && o.ty === t.ty) {
          const tex = o.root.texture,
            c = tex.source.resource,
            data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let best = null,
            dist = Infinity;
          for (let y = 0; y < c.height; y++)
            for (let x = 0; x < c.width; x++)
              if (data[(y * c.width + x) * 4 + 3]) {
                const d = Math.hypot(x - c.width / 2, y - c.height / 2);
                if (d < dist) {
                  best = { x, y };
                  dist = d;
                }
              }
          return o.root.toGlobal({ x: best.x - o.root.anchor.x * c.width, y: best.y - o.root.anchor.y * c.height });
        }
  }, target);
  await p.screenshot({ path: `${out}/before.png` });
  await p.mouse.click(point.x, point.y);
  await p.waitForFunction(() => window.__eigen.game.gameplay.profile.count('stone') > 0, null, { timeout: 15000 });
  await p.waitForFunction(
    (t) => {
      const g = window.__eigen.game;
      return [...g.objects.chunks.values()].some((m) =>
        [...m.values()].some((o) => o.tx === t.tx && o.ty === t.ty && o.kind === 'rock_depleted'),
      );
    },
    target,
    { timeout: 20000 },
  );
  const after = await p.evaluate(() => window.__eigen.game.gameplay.profile.count('stone'));
  assert.ok(after > before);
  await p.screenshot({ path: `${out}/depleted.png` });
  await p.waitForTimeout(1000);
  assert.equal(await p.evaluate(() => window.__eigen.game.gameplay.profile.count('stone')), after);
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify({ target, before, after, errors }, null, 2));
  console.log('PASS opaque-pixel click mines a real rock, awards stone once, renders nonblocking depleted rubble');
} finally {
  await b.close();
}
