// CHROME=/path/to/chromium node e2e/architecture.mjs [Vite URL] [capture directory]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? '/tmp/eigenlands-architecture';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [name, query] of [['day', 'hour=12'], ['night', 'hour=21'], ['inside', 'hour=12&px=60&py=-4']]) {
    await page.goto(`${base}labs/artlab.html?lab=town&dx=0&dy=-12&scale=3&motion=0&${query}`);
    await page.waitForFunction(() => window.__lab?.buildings?.views.find((v) => v.b.id === 'hall')?.art);
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => {
      const v = window.__lab.buildings.views.find((v) => v.b.id === 'hall');
      const day = v.art.roof.tex.source.resource, night = v.art.roof.night.source.resource;
      const a = day.getContext('2d').getImageData(0, 0, day.width, day.height).data;
      const b = night.getContext('2d').getImageData(0, 0, night.width, night.height).data;
      let changed = 0, alphaChanged = 0, clipped = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) changed++;
        if (a[i + 3] !== b[i + 3]) alphaChanged++;
        const x = (i / 4) % day.width, y = Math.floor(i / 4 / day.width);
        if (a[i + 3] && (x === 0 || y === 0 || x === day.width - 1 || y === day.height - 1)) clipped++;
      }
      return { changed, alphaChanged, clipped, roofVisible: v.roof.visible, cut: v.cut, night: v.roof.texture === v.art.roof.night, windows: v.art.windows.filter((w) => w.x > v.b.x && w.x < v.b.x + v.b.w && w.y > v.b.y && w.y < v.b.y + v.b.h).length };
    });
    assert.ok(result.changed >= 10, 'Dormer panes have distinct night colours');
    assert.equal(result.alphaChanged, 0, 'Night texture preserves silhouette and anchors');
    assert.equal(result.clipped, 0, 'Roof and entry canopy fit their canvas');
    assert.equal(result.windows, 2, 'Both dormer lights reach the building light registry');
    assert.equal(result.night, name === 'night', 'Roof selects the correct day/night texture');
    assert.equal(result.cut, name === 'inside', 'Existing interior cutaway remains functional');
    if (name === 'inside') assert.equal(result.roofVisible, false, 'Roof and canopy lift inside');
    await page.screenshot({ path: `${out}/${name}.png` });
  }
  const variants = await page.evaluate(async () => {
    const { buildBuildingArt } = await import('/src/art/buildings.ts');
    const original = window.__lab.buildings.views.find((v) => v.b.id === 'hall').b;
    const results = [];
    for (const style of [0, 1, 2, 3]) for (const tall of [false, true]) {
      const b = { ...original, style, w: tall ? 6 : 11, h: tall ? 11 : 6, doorX: original.x + (tall ? 3 : 5) };
      b.doorY = b.y + b.h - 1;
      const art = buildBuildingArt(b), canvas = art.roof.tex.source.resource;
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let clipped = false;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if ((x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) && pixels[(y * canvas.width + x) * 4 + 3]) clipped = true;
      }
      results.push({ style, tall, clipped, night: !!art.roof.night, lights: art.windows.filter((w) => w.x > b.x && w.x < b.x + b.w && w.y > b.y && w.y < b.y + b.h).length });
    }
    return results;
  });
  for (const v of variants) {
    assert.equal(v.clipped, false, `Style ${v.style}, tall=${v.tall}: geometry fits its sprite`);
    assert.equal(v.night, true, 'Both ridge directions retain lit dormers');
    assert.ok(v.lights >= 2, 'Both ridge directions retain window lights');
  }
  assert.deepEqual(errors, [], 'No runtime errors');
  console.log('Architecture: day/night panes, canvas bounds, lights and interior cutaways passed');
} finally {
  await browser.close();
}
