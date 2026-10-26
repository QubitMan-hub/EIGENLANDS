import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { townsFor } from '../packages/shared/src/town.ts';
const base = process.argv[2] ?? 'http://localhost:5186/',
  out = process.argv[3] ?? '/tmp/cozy-town-art';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const report = { models: [], scenes: [] },
  errors = [];
try {
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(new URL('labs/uilab.html?panel=none', base).href);
  report.models = await page.evaluate(async () => {
    const { buildBuildingArt } = await import('/src/art/buildings.ts');
    document.body.innerHTML = '';
    document.documentElement.style = 'height:auto;overflow:auto';
    document.body.style =
      'background:#283e37;color:#efdfbd;display:flex;flex-wrap:wrap;gap:16px;padding:16px;overflow:auto;height:auto';
    const entries = [];
    const styles = [0, 1, 2, 3, 4, 9, 14, 19, 24, 29];
    for (const [i, style] of styles.entries())
      for (const night of [false, true]) {
        const model = {
          id: 'cozy:' + style,
          kind: i % 3 === 0 ? 'inn' : 'house',
          x: 0,
          y: 0,
          w: 7 + (i % 2),
          h: 6 + (i % 3 === 1 ? 2 : 0),
          doorX: 3,
          doorY: 5 + (i % 3 === 1 ? 2 : 0),
          style,
        };
        const art = buildBuildingArt(model),
          pieces = [
            ...art.walls
              .sort((a, b) => a.tx + a.ty - b.tx - b.ty)
              .map((p) => ({ tex: night ? p.night : p.day, x: p.x, y: p.y })),
            { ...art.roof, tex: night && art.roof.night ? art.roof.night : art.roof.tex },
          ];
        const x = Math.floor(Math.min(...pieces.map((p) => p.x))) - 6,
          y = Math.floor(Math.min(...pieces.map((p) => p.y))) - 6;
        const c = document.createElement('canvas');
        c.width = Math.ceil(Math.max(...pieces.map((p) => p.x + p.tex.width))) - x + 6;
        c.height = Math.ceil(Math.max(...pieces.map((p) => p.y + p.tex.height))) - y + 6;
        const ctx = c.getContext('2d');
        for (const p of pieces) ctx.drawImage(p.tex.source.resource, p.x - x, p.y - y);
        let pixels = 0;
        const a = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let j = 3; j < a.length; j += 4) if (a[j]) pixels++;
        if (pixels < 3000) throw Error('Empty building ' + style);
        const f = document.createElement('figure');
        f.style = 'margin:0;background:#314c43;padding:10px';
        const label = document.createElement('figcaption');
        label.textContent = `Style ${style} · ${night ? 'night' : 'day'}`;
        f.append(label, c);
        c.style = `width:${c.width * 2}px;height:${c.height * 2}px;image-rendering:pixelated`;
        document.body.append(f);
        entries.push({ style, night, pixels, lights: art.windows.length });
      }
    return entries;
  });
  await page.screenshot({ path: out + '/roof-gallery.png', fullPage: true });
  const towns = townsFor(20260101, 6),
    home = towns[0],
    capital =
      towns.find((t) => t.buildings.some((b) => b.id === 'aurelion.palace')) ?? towns.find((t) => t.name === 'Solmere');
  const samples = [
    ['home', home],
    ['capital', capital ?? towns.find((t) => t.buildings.some((b) => b.id.endsWith('.palace')))],
    ['harbour', towns.find((t) => t.name.includes('Brine')) ?? towns[1]],
  ];
  for (const [name, t] of samples) {
    assert.ok(t);
    const building = t.buildings.find((b) => b.kind === 'inn' || b.kind === 'house') ?? t.buildings[0];
    for (const hour of [12, 23]) {
      const x = building.x + building.w / 2,
        y = building.y + building.h - 1;
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(
        new URL(`labs/artlab.html?x=${x}&y=${y}&generation=6&scale=2&hour=${hour}&season=1&motion=0`, base).href,
      );
      await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 120000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/${name}-${hour}.png` });
      report.scenes.push({ name, hour, x, y });
    }
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(
    new URL(`labs/artlab.html?x=${home.cx}&y=${home.cy}&generation=6&scale=2&hour=18&season=1&motion=0`, base).href,
  );
  await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 120000 });
  await page.screenshot({ path: out + '/home-mobile.png' });
  report.scenes.push({ name: 'home-mobile', hour: 18, x: home.cx, y: home.cy });
  assert.deepEqual(errors, []);
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(
    'PASS original isometric roof gallery, porch night light and furnished settlement scenes',
    JSON.stringify({ models: report.models.length, scenes: report.scenes.length }),
  );
} finally {
  await b.close();
}
