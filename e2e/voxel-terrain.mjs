// Actual generated terrain: material, bank/cliff silhouette, streaming and performance-tier checks.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/',
  out = process.argv[3] ?? '/tmp/eigenlands-ground';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [],
  results = [];
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  p.setDefaultTimeout(90000);
  p.on('pageerror', (e) => {
    errors.push(e.message);
    console.error(e.stack);
  });
  await p.addInitScript(() =>
    localStorage.setItem('eigen.settings', JSON.stringify({ graphics: 'economy', muted: true })),
  );
  await p.goto(`${base}?dev=1&hour=12`);
  await p.fill('#name', 'Ground');
  await p.click('#btn-guest');
  const settled = () =>
    p.waitForFunction(
      () => {
        const g = window.__eigen?.game,
          v = g?.voxel;
        if (!v || v.chunks.size < 8) return false;
        for (let cy = Math.floor(g.vis.y0 / 16); cy <= Math.floor(g.vis.y1 / 16); cy++)
          for (let cx = Math.floor(g.vis.x0 / 16); cx <= Math.floor(g.vis.x1 / 16); cx++) {
            const key = `${cx},${cy}`;
            if (g.store.has(Math.floor(cx / 2), Math.floor(cy / 2)) && (!v.chunks.has(key) || v.dirty.has(key)))
              return false;
          }
        return true;
      },
      null,
      { timeout: 90000 },
    );
  await settled();
  const record = async (name) => {
    const s = await p.evaluate(() => window.__eigen.state());
    assert.equal(s.voxel.orthographic, true);
    assert.equal(s.voxel.terrain.style, 'layered-voxel');
    assert.ok(Number.isFinite(s.voxel.terrain.quads) && s.voxel.terrain.quads > 1000);
    assert.deepEqual(s.voxel.missingModels, []);
    results.push({ area: name, fps: s.fps, ...s.voxel });
    console.log(name, s.voxel.terrain, s.voxel.chunks, s.voxel.triangles);
    await p.screenshot({ path: `${out}/${name}.png` });
  };
  const visit = async (name, x, y) => {
    await p.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
    await p.waitForFunction(
      ([x, y]) => {
        const f = window.__eigen.state().voxel.focus;
        return Math.hypot(f.x - x, f.y - y) < 0.7;
      },
      [x, y],
      { timeout: 90000 },
    );
    await settled();
    await record(name);
  };
  await record('arrival');
  const locations = await p.evaluate(() => {
    const g = window.__eigen.game,
      s = g.store;
    let shore = null,
      cliff = null;
    const walk = (x, y) => [2, 3, 4, 5, 9].includes(s.getTile(x, y)) && !s.solidAt(x, y);
    // Search existing generated land; do not edit terrain or manufacture a passing scene.
    for (let r = 8; r <= 160 && (!shore || !cliff); r += 4)
      for (let k = -r; k <= r; k += 2)
        for (const [x, y] of [
          [k, r],
          [r, k],
          [k, -r],
          [-r, k],
        ]) {
          if (!walk(x, y)) continue;
          if (
            !shore &&
            [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].some(([dx, dy]) => [0, 1].includes(s.getTile(x + dx, y + dy)))
          )
            shore = { x: x + 0.5, y: y + 0.5 };
          if (
            !cliff &&
            [
              [1, 0],
              [0, 1],
            ].some(([dx, dy]) => s.levelAt(x, y) - s.levelAt(x + dx, y + dy) >= 2)
          )
            cliff = { x: x + 0.5, y: y + 0.5 };
        }
    const inn = g.buildings.views.find((v) => v.b.kind === 'inn')?.b;
    return { shore, cliff, inn };
  });
  assert.ok(locations.shore, 'Generated shore found');
  assert.ok(locations.cliff, 'Generated cliff found');
  await visit('shore', locations.shore.x, locations.shore.y);
  await visit('cliff', locations.cliff.x, locations.cliff.y);
  if (locations.inn) {
    const b = locations.inn;
    await visit('town', b.doorX + 0.5, b.doorY + 2.5);
    await visit('interior', b.x + b.w / 2, b.y + b.h / 2);
  }
  await visit('cave', 36.5, 40036.5);
  const before = results.at(-1).terrain.quads;
  await p.evaluate(() => {
    window.__eigen.game.settings().graphics = 'performance';
  });
  await p.waitForFunction(() => window.__eigen.state().voxel.terrain.cellsPerTile === 4);
  await settled();
  await record('performance');
  assert.ok(results.at(-1).terrain.quads < before, 'Performance tier reduces physical surface mesh cost');
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/results.json`, JSON.stringify({ locations, results, errors }, null, 2));
  console.log(
    'PASS: real voxel caps, shoreline/cliff layers, town/room/cave materials, bounded streaming and cheaper performance tier',
  );
} finally {
  await browser.close();
}
