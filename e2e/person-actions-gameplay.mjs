import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[3] ?? '/tmp/person-actions-gameplay';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }),
    errors = [],
    report = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5244/'}?dev=1&hour=12`);
  await page.evaluate(() => localStorage.setItem('eigen.tutorial2', '["all"]'));
  await page.reload();
  await page.fill('#name', 'Action surveyor');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 30;
    g.ext.circuit.send('p3_tutorial', { action: 'skip' });
    g.app.ticker.add(
      () => {
        const a = g.views.get(g.myId);
        if (a?.sprite.texture.source.width === 24)
          window.__actionCapture = {
            sourceWidth: a.sprite.texture.source.width,
            bodyY: a.sprite.y,
            rootX: a.root.x,
            rootY: a.root.y,
            held: !!a.held?.visible,
            heldWidth: a.held?.texture.source.width,
          };
      },
      undefined,
      -100,
    );
  });
  await page.waitForTimeout(750);
  for (const [kind, weapon] of [
    ['mine', 'pickaxe'],
    ['chop', 'axe'],
    ['till', 'hoe'],
    ['water', 'can'],
    ['cast', 'rod'],
    ['plant', null],
    ['harvest', null],
    ['craft', null],
    ['place', null],
  ]) {
    await page.evaluate(
      ({ kind, weapon }) => {
        const g = window.__eigen.game,
          p = g.predictor.sim;
        window.__actionCapture = null;
        const room = window.__eigenSolo.raw().find((r) => r.players.size);
        room.fx({ kind, weapon: weapon ?? undefined, id: g.myId, x: p.x + 0.8, y: p.y + 0.5 });
      },
      { kind, weapon },
    );
    try {
      await page.waitForFunction(() => !!window.__actionCapture);
    } catch (error) {
      console.log(
        'Failed action',
        kind,
        await page.evaluate(() => {
          const g = window.__eigen.game,
            a = g.views.get(g.myId);
          return {
            id: g.myId,
            swing: g.toolSwings.get(a),
            work: g.workActions.get(a),
            source: a?.sprite.texture.source.width,
            moving: a?.movingUntil,
            now: performance.now(),
            dead: g.dead,
            dash: g.predictor.sim.dashT,
            errors: window.__actionCapture,
          };
        }),
      );
      throw error;
    }
    const pose = await page.evaluate(() => window.__actionCapture);
    assert.equal(pose.sourceWidth, 24, `${kind} uses supplemental directional art`);
    if (weapon) {
      assert.equal(pose.held, true);
      assert.equal(pose.heldWidth, 56);
    } else assert.equal(pose.held, false, `${kind} doesn't carry an unrelated weapon through the hands`);
    report.push({ kind, ...pose });
    await page.waitForTimeout(750);
  }
  // Confirmed persistent state keeps the rod and body aligned after the brief cast FX has ended.
  await page.evaluate(() => {
    const g = window.__eigen.game,
      p = g.predictor.sim;
    g.gameplay.onFishCast({ id: 'pose-fixture', tx: Math.floor(p.x) + 1, ty: Math.floor(p.y) });
  });
  await page.waitForTimeout(400);
  assert.equal(
    await page.evaluate(() => {
      const g = window.__eigen.game;
      return g.views.get(g.myId).sprite.texture.source.width;
    }),
    24,
  );
  await page.screenshot({ path: `${out}/fishing.png` });
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.gameplay.fishing = null;
    g.ext.shadows.onEvent({ kind: 'channel', secs: 2, name: 'Test residue', chance: 1 });
  });
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(() => {
      const g = window.__eigen.game;
      return g.views.get(g.myId).sprite.texture.source.width;
    }),
    24,
  );
  await page.screenshot({ path: `${out}/extraction.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/mobile.png` });
  assert.deepEqual(errors, []);
  writeFileSync(
    `${out}/report.json`,
    JSON.stringify({ confirmedEvents: report, persistentFishing: true, extraction: true, errors }, null, 2),
  );
  console.log('PASS confirmed work FX, persistent fishing and extraction use production action poses; no page errors');
} finally {
  await browser.close();
}
