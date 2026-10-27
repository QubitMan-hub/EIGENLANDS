import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { BOSSES } from '../packages/shared/src/bosses.ts';
const base = process.argv[2] ?? 'http://127.0.0.1:5244/',
  out = process.argv[3] ?? '/tmp/boss-gameplay';
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync('packages/client/src/art/boss-manifest.json', 'utf8'));
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }),
    errors = [],
    requests = [],
    report = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/art/bestiary/') && r.status() !== 200)
      errors.push('Asset HTTP ' + r.status() + ' ' + r.url());
    if (r.url().includes('/art/bestiary/') && r.status() === 200) requests.push(r.url());
  });
  await page.goto(base + '?dev=1&hour=12');
  await page.evaluate(() => localStorage.setItem('eigen.tutorial2', '["all"]'));
  await page.reload();
  await page.fill('#name', 'Boss art surveyor');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await page.evaluate(async () => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 20;
    g.ext.circuit.send('p3_tutorial', { action: 'skip' });
    g.net.dev({ cmd: 'level', level: 40 });
    const r = window.__eigenSolo.raw().find((r) => r.players.size);
    await Promise.all(Array.from({ length: 9 }, (_, i) => r.ensureChunk(2 + (i % 3) - 1, 2 + Math.floor(i / 3) - 1)));
    for (let y = 60; y <= 118; y++)
      for (let x = 60; x <= 118; x++) {
        r.objects.remove(x, y);
        r.setTile(x, y, 3);
        r.store.get(Math.floor(x / 32), Math.floor(y / 32)).levels?.fill(0);
      }
    g.net.dev({ cmd: 'tp', x: 84.5, y: 84.5 });
  });
  await page.waitForFunction(() => Math.hypot(window.__eigen.state().x - 84.5, window.__eigen.state().y - 84.5) < 0.2);
  for (const [id, d] of Object.entries(manifest.atlases)) {
    const kind = BOSSES[id].kind;
    await page.evaluate(
      ({ id, sea }) => {
        const r = window.__eigenSolo.raw().find((r) => r.players.size),
          p = [...r.players.values()][0];
        p.invuln = 999;
        p.deadT = 0;
        p.hp = p.maxHp;
        r.enemies.clear();
        r.state.enemies.clear();
        for (let y = 74; y <= 104; y++)
          for (let x = 74; x <= 104; x++) {
            r.setTile(x, y, sea ? 0 : 3);
            r.store.get(Math.floor(x / 32), Math.floor(y / 32)).levels?.fill(0);
          }
        p.sim.boat = sea;
        p.sim.x = 84.5;
        p.sim.y = 84.5;
        p.sim.vx = 0;
        p.sim.vy = 0;
        const e = r.spawnEnemy(id, 92, 84.5, false, { level: 32 });
        e.mode = 'recover';
        e.t = 99;
        e.state.faceX = -1;
        e.state.faceY = 0;
      },
      { id, sea: id === 'world_serpent' },
    );
    await page.waitForFunction(
      ({ kind, w, h }) => {
        const g = window.__eigen.game,
          v = [...g.views.values()].find((v) => v.type === 'enemy' && v.kind === kind);
        return v?.sprite.texture.width === w && v.sprite.texture.height === h && v.root.visible;
      },
      { kind, w: d.w, h: d.h },
      { timeout: 30000 },
    );
    const check = await page.evaluate(
      ({ kind, ay, h }) => {
        const g = window.__eigen.game,
          v = [...g.views.values()].find((v) => v.type === 'enemy' && v.kind === kind);
        return {
          anchor: v.sprite.anchor.y,
          expected: ay / h,
          scale: [v.sprite.scale.x, v.sprite.scale.y],
          shadowAnchor: v.shadow.anchor.y,
          shadowAt: [v.shadow.x - v.root.x, v.shadow.y - v.root.y],
          atlas: window.__eigen.state().creatureAtlases,
        };
      },
      { kind, ay: d.ay, h: d.h },
    );
    assert(Math.abs(check.anchor - check.expected) < 1e-6);
    assert(Math.abs(check.shadowAnchor - check.anchor) < 1e-6);
    assert.deepEqual(check.shadowAt, [0, 0]);
    assert.deepEqual(check.scale, [1, 1]);
    await page.screenshot({ path: out + '/' + id + '-world.png' });
    // Let the real AI walk, turn, anticipate and attack; no manually swapped sprite frames.
    await page.evaluate(() => {
      const r = window.__eigenSolo.raw().find((r) => r.players.size),
        e = [...r.enemies.values()].find((e) => e.def.boss);
      e.mode = 'chase';
      e.t = 0;
    });
    const states = new Set();
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(300);
      const st = await page.evaluate(
        (kind) => [...window.__eigen.game.net.room.state.enemies.values()].find((e) => e.kind === kind)?.st,
        kind,
      );
      if (st !== undefined) states.add(st);
    }
    if (['primordial_dragon', 'world_serpent', 'sealed_entity', 'forgotten_titan', 'realm_guardian'].includes(id)) {
      await page.screenshot({ path: out + '/' + id + '-combat.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const overlaps = await page.locator('#boss-bar').evaluate((el) => {
        const a = el.getBoundingClientRect();
        return ['#hud-left', '#hud-actions'].some((sel) => {
          const e = document.querySelector(sel);
          if (!e?.getClientRects().length) return false;
          const b = e.getBoundingClientRect();
          return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
        });
      });
      assert.equal(overlaps, false, 'Mobile boss header must leave status and utility controls clear');
      await page.screenshot({ path: out + '/' + id + '-mobile.png' });
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    report.push({ id, kind, ...check, states: [...states] });
    console.log('rendered and simulated', id, [...states]);
  }
  assert.equal(report.length, 14);
  assert(
    report.some((r) => r.states.includes(2)),
    'Real AI must show windup poses',
  );
  assert(
    report.some((r) => r.states.includes(3)),
    'Real AI must show attack poses',
  );
  assert.deepEqual(errors, []);
  assert(
    requests.some((u) => u.includes('/veyr-day.png')),
    'Veyr uses the new authored atlas',
  );
  writeFileSync(
    out + '/report.json',
    JSON.stringify({ bosses: report, errors, assets: [...new Set(requests)] }, null, 2),
  );
  console.log(
    'PASS all 14 bosses in gameplay: original sprites, anchors, projected shadows, fixed proportions, AI poses, mobile and asset loads',
  );
} finally {
  await browser.close();
}
