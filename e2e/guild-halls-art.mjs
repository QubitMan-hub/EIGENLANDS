import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { realmTowns } from '../packages/shared/src/realm-towns.ts';
const base = process.argv[2] ?? 'http://127.0.0.1:5186/',
  out = process.argv[3] ?? '/tmp/guild-halls-art';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const halls = realmTowns(20260101, 6)
    .filter((t) => t.buildings.some((b) => b.id.endsWith('.palace')))
    .map((t) => ({ town: t.name, b: t.buildings.find((b) => b.guild) }));
  assert.equal(halls.length, 6);
  assert(halls.every((h) => h.b));
  await page.goto(new URL('labs/uilab.html?panel=none', base).href);
  const report = await page.evaluate(async (halls) => {
    const { buildBuildingArt } = await import('/src/art/buildings.ts');
    document.body.innerHTML = '';
    document.documentElement.style = 'height:auto;overflow:auto';
    document.body.style =
      'background:#283e37;color:#efdfbd;display:flex;flex-wrap:wrap;gap:14px;padding:14px;overflow:auto;height:auto';
    const results = [];
    for (const { town, b } of halls)
      for (const night of [false, true]) {
        const art = buildBuildingArt(b);
        if (!art.sign) throw Error('Guild sign missing');
        const pieces = [
          ...art.walls.sort((a, b) => a.tx + a.ty - b.tx - b.ty).map((p) => ({ ...p, tex: night ? p.night : p.day })),
          { ...art.roof, tex: night && art.roof.night ? art.roof.night : art.roof.tex },
          art.sign,
        ];
        const x = Math.floor(Math.min(...pieces.map((p) => p.x))) - 4,
          y = Math.floor(Math.min(...pieces.map((p) => p.y))) - 4;
        const c = document.createElement('canvas');
        c.width = Math.ceil(Math.max(...pieces.map((p) => p.x + p.tex.width))) - x + 4;
        c.height = Math.ceil(Math.max(...pieces.map((p) => p.y + p.tex.height))) - y + 4;
        const ctx = c.getContext('2d');
        for (const p of pieces) ctx.drawImage(p.tex.source.resource, p.x - x, p.y - y);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let pixels = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]) pixels++;
        if (pixels < 5000) throw Error('Empty guild ' + town);
        const fig = document.createElement('figure'),
          label = document.createElement('figcaption');
        fig.style = 'margin:0;max-width:680px';
        label.textContent = town + ' · ' + (night ? 'night' : 'day');
        c.style = 'max-width:680px;image-rendering:pixelated';
        fig.append(label, c);
        document.body.append(fig);
        results.push({ town, night, pixels, sign: true });
      }
    return results;
  }, halls);
  await page.screenshot({ path: out + '/regional-halls.png', fullPage: true });
  for (const [i, { b }] of halls.entries()) {
    await page.setViewportSize(i === 0 ? { width: 844, height: 390 } : { width: 1280, height: 720 });
    await page.goto(
      new URL(
        `labs/artlab.html?x=${b.doorX}&y=${b.doorY - 2}&px=${b.doorX}&py=${b.doorY - 2}&generation=6&scale=2&hour=${i % 2 ? 23 : 12}&season=1&motion=0`,
        base,
      ).href,
    );
    await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 120000 });
    await page.screenshot({ path: `${out}/interior-${i}.png` });
  }
  assert.deepEqual(errors, []);
  writeFileSync(out + '/report.json', JSON.stringify({ models: report, interiors: halls.length, errors }, null, 2));
  console.log('PASS 12 regional day/night halls, projected signs and six furnished interiors');
} finally {
  await browser.close();
}
