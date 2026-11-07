import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tsImport } from 'tsx/esm/api';
const { secretSites } = await tsImport('../packages/client/src/game/secret-plan.ts', {
  parentURL: import.meta.url,
  tsconfig: 'packages/server/tsconfig.json',
});
const out = 'docs/validation/directional-people';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1100, height: 800 } }),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto((process.argv[2] ?? 'http://127.0.0.1:5244/') + '?dev=1&hour=12');
  await p.fill('#name', 'Isometric wayfarer');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 90000,
  });
  await p.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 24;
    g.ext.circuit.send('p3_tutorial', { action: 'skip' });
  });
  await p.screenshot({ path: out + '/arrival-world.png' });
  const seed = await p.evaluate(() => window.__eigen.game.seed),
    sites = [];
  for (let y = 180; y <= 1500; y += 96) for (let x = 180; x <= 1500; x += 96) sites.push(...secretSites(seed, x, y));
  const site = await p.evaluate(async (sites) => {
    const r = window.__eigenSolo.raw().find((r) => r.players.size),
      g = window.__eigen.game;
    for (const s of [...new Map(sites.map((s) => [s.id, s])).values()]) {
      await r.ensureChunk(Math.floor(s.x / 32), Math.floor(s.y / 32));
      if (
        !r.store.solidAt(s.x, s.y) &&
        !r.store.objectAt(s.x, s.y) &&
        !r.store.structureAt(s.x, s.y) &&
        ![9, 20, 22].includes(r.store.getTile(s.x, s.y))
      ) {
        g.net.dev({ cmd: 'tp', x: s.x + 0.5, y: s.y + 0.5 });
        return s;
      }
    }
    return null;
  }, sites);
  assert(site, 'At least one natural, unedited discovery site');
  await p.waitForFunction(() => document.querySelector('#world-secret:not([hidden])'), null, { timeout: 30000 });
  await p.evaluate((s) => window.__eigen.game.net.dev({ cmd: 'tp', x: s.x + 1.5, y: s.y + 0.5 }), site);
  await p.waitForTimeout(700);
  await p.screenshot({ path: out + '/discovery-world.png' });
  const discovery = await p.locator('#world-secret').innerText();
  assert(discovery.includes('small discovery'));
  await p.evaluate(async (site) => {
    const r = window.__eigenSolo.raw().find((r) => r.players.size),
      g = window.__eigen.game;
    for (let cy = Math.floor((site.y - 10) / 32); cy <= Math.floor((site.y + 10) / 32); cy++)
      for (let cx = Math.floor((site.x - 10) / 32); cx <= Math.floor((site.x + 10) / 32); cx++)
        await r.ensureChunk(cx, cy);
    for (let y = site.y - 8; y <= site.y + 8; y++)
      for (let x = site.x - 8; x <= site.x + 8; x++) {
        r.objects.remove(x, y);
        r.setTile(x, y, 3);
        r.store.get(Math.floor(x / 32), Math.floor(y / 32)).levels?.fill(0);
      }
    g.input.setMovementMode('keyboard');
    const hero = [...r.players.values()][0];
    hero.invuln = 999;
    r.enemies.clear();
    r.state.enemies.clear();
    document.activeElement?.blur();
  }, site);
  const checks = [];
  for (const [keys, row] of [
    [['d'], 3],
    [['d', 's'], 5],
    [['s'], 0],
    [['a', 's'], 4],
    [['a'], 2],
    [['a', 'w'], 6],
    [['w'], 1],
    [['d', 'w'], 7],
  ]) {
    for (const key of keys) await p.keyboard.down(key);
    await p.waitForFunction(
      (row) => {
        const g = window.__eigen.game,
          v = g.views.get(g.myId);
        return v?.sprite.texture.frame.y / 64 === row;
      },
      row,
      { timeout: 10000 },
    );
    checks.push(
      await p.evaluate(() => {
        const g = window.__eigen.game,
          v = g.views.get(g.myId);
        return {
          width: v.sprite.texture.width,
          height: v.sprite.texture.height,
          rotation: v.sprite.rotation,
          row: v.sprite.texture.frame.y / 64,
          face: [g.predictor.sim.faceX, g.predictor.sim.faceY],
          keys: [...g.input.down],
        };
      }),
    );
    for (const key of keys) await p.keyboard.up(key);
  }
  assert(checks.every((v) => v.width === 64 && v.height === 64 && v.rotation === 0));
  console.log(JSON.stringify(checks));
  assert.equal(new Set(checks.map((v) => v.row)).size, 8, 'All eight movement facings are actually selected');
  await p.evaluate(() => window.__eigen.game.net.dev({ cmd: 'tp', x: 0.5, y: 0.5 }));
  await p.waitForFunction(() => document.querySelector('#world-secret')?.hidden === true, null, { timeout: 15000 });
  assert.deepEqual(errors, []);
  writeFileSync(out + '/world.json', JSON.stringify({ site, discovery, checks, errors }, null, 2));
  console.log(
    'PASS live arrival, eight movement facings, natural discovery interaction and distance culling; no page errors',
  );
} finally {
  await b.close();
}
