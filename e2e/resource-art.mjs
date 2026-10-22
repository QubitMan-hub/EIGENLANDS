import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? '/tmp/eigenlands-resource-after';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}labs/artlab.html?lab=resources&scale=3&season=3&motion=0`);
  await page.waitForFunction(() => window.__lab?.ready);
  const result = await page.evaluate(async () => {
    const { buildObjectArt, buildOre, destroyObjectArt } = await import('/src/art/objects.ts');
    const { ObjectViews, sunFor } = await import('/src/game/objectviews.ts');
    const { TOWN_DECO } = await import('/src/art/town.ts');
    const { ChunkStore, CAVE_OY, T } = await import(performance.getEntriesByType('resource').find(e => /\/packages\/shared\/src\/index\.ts(?:\?|$)/.test(e.name)).name);
    const { Container } = await import(performance.getEntriesByType('resource').find(e => /\/pixi__js\.js\?/.test(e.name)).name);
    const art = buildObjectArt(3), failures = [];
    const pixels = sp => sp.tex.source.resource.getContext('2d').getImageData(0, 0, sp.tex.width, sp.tex.height).data;
    for (const [kind, list] of Object.entries(art.cave)) {
      const summer = kind === 'rock' ? null : buildOre(kind, 1);
      for (const [f, sp] of list.entries()) {
        const a = pixels(sp), w = sp.tex.width, h = sp.tex.height;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] && (!x || !y || x === w - 1 || y === h - 1)) failures.push({ kind, f, clipped: true });
        if (summer && pixels(summer[f]).some((n, i) => n !== a[i])) failures.push({ kind, f, surfaceSnowUnderground: true });
      }
      if (summer) summer.forEach(sp => sp.tex.destroy(true));
    }
    // Exercise the real context selector and animated silver/gold path, not just standalone textures.
    const store = new ChunkStore(1337), layer = new Container(), shadows = new Container();
    store.setTile(300, CAVE_OY + 300, T.ORE_SILVER);
    const views = new ObjectViews(store, shadows, layer); views.setArt(art); views.buildChunk(9, Math.floor((CAVE_OY + 300) / 32));
    const node = [...views.chunks.values()].flatMap(m => [...m.values()]).find(o => o.tx === 300 && o.ty === CAVE_OY + 300);
    if (node?.artKey !== 'cave:ore_silver') failures.push({ undergroundContext: node?.artKey });
    views.update(2000, sunFor(12), false, 290, CAVE_OY + 290, 310, CAVE_OY + 310);
    const moving = node.root.texture;
    views.update(3000, sunFor(12), true, 290, CAVE_OY + 290, 310, CAVE_OY + 310);
    if (node.root.texture !== art.cave.ore_silver[node.variant * 2].tex) failures.push({ reducedMotion: false });
    const statue = TOWN_DECO.statue();
    for (const sp of statue.frames) {
      if (sp.ax !== 78 || sp.ay !== 202) failures.push({ statueAnchor: [sp.ax, sp.ay] });
      const a = pixels(sp), w = sp.tex.width, h = sp.tex.height;
      for (let x = 0; x < w; x++) if (a[x * 4 + 3] || a[((h - 1) * w + x) * 4 + 3]) failures.push({ statueClipped: true });
    }
    destroyObjectArt(art);
    return { failures, animated: !!moving };
  });
  assert.deepEqual(result.failures, [], 'Projected minerals, cave materials, anchors and animation bounds');
  await page.screenshot({ path: `${out}/winter-ores.png` });
  for (const [name, query] of [['ores', 'lab=resources&season=1'], ['statue', 'lab=sprite&subs=statue'], ['forest', 'x=115&y=-34&season=1'], ['cave', 'x=320&y=40320&season=1']]) {
    await page.goto(`${base}labs/artlab.html?${query}&scale=3&motion=0`);
    await page.waitForFunction(() => window.__lab?.ready);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('Resource artwork: cave seasons, mineral frames, sprite bounds, statue anchors and reduced motion passed');
} finally { await browser.close(); }
