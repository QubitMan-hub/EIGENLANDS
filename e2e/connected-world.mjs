import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tsImport } from 'tsx/esm/api';
const sh = Object.assign(
  {},
  ...(await Promise.all(
    ['realms', 'worldgen', 'town', 'settlement-tiers', 'chunks', 'tiles'].map((name) =>
      tsImport(`../packages/shared/src/${name}.ts`, import.meta.url),
    ),
  )),
);
const out = 'docs/validation/connected-world';
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
  await p.fill('#name', 'Ecology integration');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await p.evaluate(() => window.__eigen.game.ext.circuit.send('p3_tutorial', { action: 'skip' }));
  await p.evaluate(() => {
    window.__ecologyRasterMax = 0;
    const g = window.__eigen.game;
    g.app.ticker.add(
      () => {
        window.__ecologyRasterMax = Math.max(window.__ecologyRasterMax, g.ambient.wildlife.textureBuilds);
      },
      undefined,
      -100,
    );
  });
  const seed = await p.evaluate(() => window.__eigen.game.store.seed);
  assert.equal(await p.evaluate(() => window.__eigen.game.store.generation), 7);
  const terrain = new sh.ChunkStore(seed, 128, 7);
  const tp = async (x, y) => {
    const open = [];
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++)
        if (!terrain.solidAt(Math.floor(x + dx), Math.floor(y + dy)))
          open.push({ x: Math.floor(x + dx) + 0.5, y: Math.floor(y + dy) + 0.5, d: dx * dx + dy * dy });
    open.sort((a, b) => a.d - b.d);
    assert.ok(open.length, 'No open landing');
    ({ x, y } = open[0]);
    await p.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
    await p.waitForTimeout(6500);
    const actual = await p.evaluate(() => {
      const s = window.__eigen.game.predictor.sim;
      return { x: s.x, y: s.y };
    });
    assert.ok(Math.hypot(actual.x - x, actual.y - y) < 4, `Teleport to ${x},${y} landed at ${JSON.stringify(actual)}`);
    return actual;
  };
  const site = sh.REALM_SITES.find((s) => s.kind === 'town');
  await tp(site.cx, site.cy + 6);
  const town = await p.evaluate(() => {
    const l = window.__eigen.game.life;
    return {
      count: l.count(),
      tier: l.site?.tier,
      scenes: l.sceneKinds(),
      residents: window.__eigen.game.net.room.state.npcs.size,
    };
  });
  assert.ok(town.tier);
  assert.ok(town.count <= sh.SETTLEMENT_PROFILES[town.tier].ambientLimit);
  await p.screenshot({ path: `${out}/town-gameplay.png` });
  const candidates = [];
  for (let x = 96; x < 1000 && candidates.length < 6; x += 64)
    for (let y = 96; y < 700 && candidates.length < 6; y += 96) {
      const biome = sh.biomeAt(seed, x, y, 7);
      if (
        ['meadow', 'forest', 'autumn'].includes(biome) &&
        !sh.townAt(seed, x, y, 7) &&
        !terrain.solidAt(x, y) &&
        terrain.getTile(x, y) === sh.T.GRASS
      )
        candidates.push({ x, y, biome });
    }
  const samples = [];
  for (const at of candidates) {
    const actual = await tp(at.x, at.y);
    const sample = await p.evaluate(() => {
      const w = window.__eigen.game.ambient.wildlife;
      return {
        count: w.count(),
        kinds: w.kinds(),
        animals: [...w.actors.values()].map((a) => ({
          id: a.species.id,
          x: a.x,
          y: a.y,
          heading: a.facing,
          scale: a.sprite.scale.x,
          anchor: a.sprite.anchor.y,
          moving: a.moving,
        })),
      };
    });
    assert.ok(sample.count <= 28);
    for (const a of sample.animals) {
      assert.equal(a.scale, 1);
      assert.equal(a.anchor, 0.8);
      assert.ok(a.heading >= 0 && a.heading <= 3);
    }
    samples.push({ ...at, actual, ...sample });
    if (sample.count) {
      await p.screenshot({ path: `${out}/wildlife-gameplay.png` });
      break;
    }
  }
  assert.ok(
    samples.some((s) => s.count > 0),
    'No wildlife in sampled loaded habitats',
  );
  await p.waitForTimeout(2500);
  assert.deepEqual(errors, []);
  const maxNewRasters = await p.evaluate(() => window.__ecologyRasterMax);
  assert.ok(maxNewRasters <= 2);
  writeFileSync(
    `${out}/browser-report.json`,
    JSON.stringify({ generation: 7, seed, town, samples, maxNewRasters, errors }, null, 2),
  );
  console.log(JSON.stringify({ town, species: samples.flatMap((s) => Object.keys(s.kinds)), errors }));
} finally {
  await b.close();
}
