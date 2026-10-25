import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
let page;
const base = process.argv[2] ?? 'http://127.0.0.1:5240/';
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = (page = await b.newPage({ viewport: { width: 1000, height: 650 } })),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + '?dev=1&hour=12');
  await p.waitForSelector('#g-off:not([hidden])');
  await p.fill('#name', 'Tool artisan');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 60000,
  });
  await p.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 10;
    g.settings().reducedMotion = false;
    g.net.dev({ cmd: 'level', level: 20 });
    g.net.dev({ cmd: 'give', id: 'crossbow', n: 1 });
  });
  await p.waitForFunction(() => window.__eigen.game.gameplay.profile.count('crossbow') === 1);
  await p.evaluate(() => {
    const g = window.__eigen.game;
    g.net.equip({ as: 'weapon', slot: g.gameplay.profile.inv.findIndex((s) => s?.id === 'crossbow') });
    window.__tools = [];
    window.__toolFx = [];
    g.net.room.onMessage('fx', (f) => window.__toolFx.push(f));
    g.app.ticker.add(() => {
      const v = g.views.get(g.myId),
        s = g.toolSwings.get(v);
      if (
        s &&
        v.sprite.texture.frame.x / 24 >= 10 &&
        v.sprite.texture.frame.x / 24 < 14 &&
        v.held?.texture.source === g.heldWeapons.texture(s.tool, 0, 0).source
      )
        window.__tools.push({ tool: s.tool, frame: v.sprite.texture.frame.x / 24 });
    });
  });
  for (const [tile, tool] of [
    [6, 'axe'],
    [7, 'pickaxe'],
  ]) {
    await p.evaluate((tool) => (window.__eigen.game.settings().reducedMotion = tool === 'pickaxe'), tool);
    const target = await p.evaluate((tile) => {
      const g = window.__eigen.game,
        m = g.predictor.sim;
      for (let y = Math.floor(m.y) - 24; y < Math.floor(m.y) + 24; y++)
        for (let x = Math.floor(m.x) - 24; x < Math.floor(m.x) + 24; x++)
          if (g.store.getTile(x, y) === tile)
            for (const [dx, dy] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ])
              if (!g.store.solidAt(x + dx, y + dy)) return { x, y, px: x + dx + 0.5, py: y + dy + 0.5 };
      return null;
    }, tile);
    assert(target, `generated ${tool} resource`);
    await p.evaluate((t) => window.__eigen.game.net.dev({ cmd: 'tp', x: t.px, y: t.py }), target);
    await p.waitForFunction(
      (t) => Math.hypot(window.__eigen.state().x - t.px, window.__eigen.state().y - t.py) < 0.2,
      target,
    );
    const slot = await p.evaluate(
      (tool) => window.__eigen.game.gameplay.profile.inv.findIndex((s) => s?.id === tool),
      tool,
    );
    assert(slot >= 0);
    await p.locator(`.hslot[data-i="${slot}"]`).click();
    await p.evaluate(({ slot, target }) => window.__eigen.game.net.use({ slot, tx: target.x, ty: target.y }), {
      slot,
      target,
    });
    await p.waitForFunction(
      (tool) =>
        window.__tools.some(
          (s) => s.tool === tool && (tool === 'pickaxe' ? s.frame === 12 : s.frame >= 10 && s.frame < 14),
        ),
      tool,
      { timeout: 15000 },
    );
  }
  assert.deepEqual(errors, []);
  await p.screenshot({ path: '/tmp/harvesting-tools.png' });
  console.log(
    'Real axe/pickaxe use plays correct held tool and harvesting body pose with a crossbow equipped; reduced motion passes',
  );
} catch (e) {
  if (page) {
    console.log(
      await page.evaluate(() => {
        const g = window.__eigen.game,
          v = g.views.get(g.myId);
        return JSON.stringify({
          fx: window.__toolFx,
          seen: window.__tools,
          swing: g.toolSwings.get(v),
          frame: v.sprite.texture.frame.x / 24,
          selected: g.gameplay.selected(),
          equip: g.gameplay.profile.equip,
          pose: g.predictor.sim,
        });
      }),
    );
    await page.screenshot({ path: '/tmp/harvest-failure.png' });
  }
  throw e;
} finally {
  await b.close();
}
