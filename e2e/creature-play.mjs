import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'http://127.0.0.1:5240/';
const out = process.argv[3] ?? '/tmp/creature-play';
const touch = process.argv.includes('touch');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({
    viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 },
    hasTouch: touch,
    isMobile: touch,
  });
  const errors = [],
    report = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    (reducedMotion) => localStorage.setItem('eigen.settings', JSON.stringify({ graphics: 'economy', reducedMotion })),
    touch,
  );
  await page.goto(`${base}?dev=1&hour=12`);
  await page.fill('#name', 'Creature field test');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 90000,
  });
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 20;
    g.net.dev({ cmd: 'level', level: 60 });
    g.net.dev({ cmd: 'tp', x: 132.5, y: -4.5 });
  });
  await page.waitForFunction(() => Math.hypot(window.__eigen.state().x - 132.5, window.__eigen.state().y + 4.5) < 0.2);
  await page.waitForTimeout(1200);
  for (const [name, kind] of [
    ['boar', 7],
    ['badger', 9],
    ['deer', 3],
    ['wolf', 8],
    ['fox', 15],
    ['reed_stalker', 22],
    ['cinder_moth', 23],
  ]) {
    await page.evaluate((name) => {
      const g = window.__eigen.game,
        s = g.predictor.sim;
      const distance = [4, 5, 6, 7, 8].find(
        (d) => !g.store.solidAt(Math.floor(s.x + Math.cos(0.3) * d), Math.floor(s.y + Math.sin(0.3) * d)),
      );
      if (!distance) throw Error('No valid field-test spawn');
      g.net.dev({ cmd: 'spawn', kind: name, n: 1, d: distance });
    }, name);
    await page.waitForFunction(
      (kind) => [...window.__eigen.game.views.values()].some((v) => v.kind === kind && v.sprite.texture.width > 1),
      kind,
      { timeout: 15000 },
    );
    const poses = new Set();
    for (let i = 0; i < 10; i++) {
      const pose = await page.evaluate((kind) => {
        const g = window.__eigen.game,
          v = [...g.views.values()].find((v) => v.kind === kind),
          f = v?.sprite.texture.frame;
        return (
          v && {
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            anchorX: v.sprite.anchor.x,
            anchorY: v.sprite.anchor.y,
            filtering: v.sprite.texture.source.scaleMode,
          }
        );
      }, kind);
      if (pose) {
        assert.equal(pose.filtering, 'nearest');
        if (kind < 15) {
          assert.equal(pose.anchorX * pose.width, Math.round(pose.anchorX * pose.width));
          assert.equal(pose.anchorY * pose.height, Math.round(pose.anchorY * pose.height));
          if (touch) assert.equal(pose.x, 0, `${name} should hold frame zero with reduced motion`);
        }
        poses.add(JSON.stringify(pose));
      }
      await page.waitForTimeout(120);
    }
    await page.screenshot({ path: `${out}/${name}.png` });
    report.push({ name, observedPoses: poses.size });
    await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'kill', d: 30 }));
    await page.waitForTimeout(400);
  }
  if (!touch)
    assert.ok(
      report.some((r) => r.observedPoses > 1),
      'live creatures should animate',
    );
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify({ touch, report }, null, 2));
  console.log('PASS actual creature rendering', { touch, report });
} finally {
  await browser.close();
}
