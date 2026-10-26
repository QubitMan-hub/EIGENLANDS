import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:5175/';
const out = process.argv[3] ?? '/tmp/kingdom-materials';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(
  new URL('labs/artlab.html?lab=sprite&subs=statue,stall_red_produce,fountain&scale=3&motion=0', base).href,
);
await page.waitForFunction(() => window.__lab?.ready);
await page.screenshot({ path: out + '/props.png' });
const report = await page.evaluate(async () => {
  const report = [];
  const { buildBuildingArt } = await import('/src/art/buildings.ts');
  const { BuildingArtWorker } = await import('/src/art/building-worker-client.ts');
  const worker = new BuildingArtWorker();
  const digest = (tex) => {
    const c = document.createElement('canvas');
    c.width = tex.width;
    c.height = tex.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(tex.source.resource, 0, 0);
    const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261;
    for (const p of pixels) h = Math.imul(h ^ p, 16777619);
    return h;
  };
  const { PROPS, STALL_AWNINGS, STALL_GOODS } = await import('/src/art/props.ts');
  const market = document.createElement('section');
  market.id = 'markets';
  market.style = 'display:flex;flex-wrap:wrap;gap:8px;padding:16px';
  for (const awn of STALL_AWNINGS)
    for (const goods of STALL_GOODS)
      for (const face of ['sw', 'se']) {
        const def = PROPS[`stall_${awn}_${goods}`](face);
        const sp = def.frames[0];
        const source = sp.tex.source.resource;
        const data = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
        for (let y = 0; y < source.height; y++)
          for (let x = 0; x < source.width; x++) {
            if (
              (x === 0 || y === 0 || x === source.width - 1 || y === source.height - 1) &&
              data[(y * source.width + x) * 4 + 3]
            )
              throw new Error('Clipped market stall: ' + awn + '/' + goods + '/' + face);
          }
        const c = document.createElement('canvas');
        c.width = source.width;
        c.height = source.height;
        c.getContext('2d').drawImage(source, 0, 0);
        c.style = 'width:128px;height:136px;image-rendering:pixelated';
        market.append(c);
      }
  const fair = document.createElement('section');
  fair.id = 'fair';
  fair.style = 'display:flex;flex-wrap:wrap;gap:12px;padding:16px';
  for (const id of ['ferris_wheel', 'carousel', 'swing_boat', 'circus_tent'])
    for (const face of ['sw', 'se']) {
      const def = PROPS[id](face);
      for (const sp of def.frames) {
        const source = sp.tex.source.resource;
        const pixels = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
        for (let y = 0; y < source.height; y++)
          for (let x = 0; x < source.width; x++)
            if (
              (x === 0 || y === 0 || x === source.width - 1 || y === source.height - 1) &&
              pixels[(y * source.width + x) * 4 + 3]
            )
              throw new Error('Clipped fair frame: ' + id + '/' + face);
      }
      const c = document.createElement('canvas');
      const source = def.frames[0].tex.source.resource;
      c.width = source.width;
      c.height = source.height;
      c.getContext('2d').drawImage(source, 0, 0);
      c.style = `width:${c.width * 2}px;height:${c.height * 2}px;image-rendering:pixelated`;
      fair.append(c);
    }
  document.body.innerHTML = '';
  document.body.style = 'margin:0;background:#263b35;color:#f2e4c5;font:16px monospace;overflow:auto;height:auto';
  document.documentElement.style = 'overflow:auto;height:auto';
  for (let realm = 0; realm < 6; realm++) {
    const section = document.createElement('section');
    section.id = 'realm' + realm;
    section.style = 'display:flex;flex-wrap:wrap;gap:12px;padding:16px';
    for (let v = 0; v < 7; v++) {
      const b = {
        id: 'preview-' + realm + '-' + v,
        kind: v === 3 ? 'store' : v === 4 ? 'hall' : v === 5 ? 'church' : v === 6 ? 'tower' : 'house',
        x: 0,
        y: 0,
        w: v === 4 ? 12 : 8 + (v % 2),
        h: v === 4 ? 9 : 6,
        doorX: 3,
        doorY: 5,
        style: 4 + realm * 5 + Math.min(v, 4),
      };
      b.doorY = b.h - 1;
      const art = buildBuildingArt(b);
      if (v === 1) {
        const baked = await worker.request(b);
        if (!baked || digest(baked.roof.tex) !== digest(art.roof.tex))
          throw new Error('Worker/fallback roof mismatch: ' + b.id);
      }
      const roof = art.roof.tex.source.resource;
      const pixels = roof.getContext('2d').getImageData(0, 0, roof.width, roof.height).data;
      let opaque = 0;
      for (let n = 3; n < pixels.length; n += 4) {
        if (pixels[n] !== 0 && pixels[n] !== 255) throw new Error('Soft roof alpha: ' + b.id);
        if (pixels[n] === 255) opaque++;
      }
      if (opaque < 500) throw new Error('Missing roof: ' + b.id);
      if (v === 5 && opaque < 20000) throw new Error('Steep church roof plane missing: ' + b.id);
      if (art.roof.tex.source.scaleMode !== 'nearest') throw new Error('Filtered roof');
      report.push({ id: b.id, opaque, width: roof.width, height: roof.height });
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = v >= 5 ? 430 : 270;
      const ctx = c.getContext('2d');
      ctx.translate(180, v >= 5 ? 270 : 110);
      for (const p of art.walls.sort((a, b) => a.tx + a.ty - b.tx - b.ty))
        ctx.drawImage(p.day.source.resource, p.x, p.y);
      ctx.drawImage(art.roof.tex.source.resource, art.roof.x, art.roof.y);
      const fig = document.createElement('figure');
      fig.style = 'margin:0';
      const title = document.createElement('figcaption');
      title.textContent = ['Aurelion', 'Sylvaris', 'Khar-Dum', 'Raijin', 'Thalassara', 'Nethrakar'][realm] + ' / ' + v;
      fig.append(title, c);
      section.append(fig);
    }
    document.body.append(section);
  }
  document.body.append(market, fair);
  return report;
});
for (let i = 0; i < 6; i++) await page.locator('#realm' + i).screenshot({ path: out + '/realm' + i + '.png' });
await page.locator('#markets').screenshot({ path: out + '/markets.png' });
await page.locator('#fair').screenshot({ path: out + '/fair.png' });
// Render actual world objects, terrain, roof fading and worker-baked buildings.
const capitals = [
  [1024, -512],
  [256, -1024],
  [-768, -768],
  [768, 768],
  [-256, 1024],
  [-1024, 256],
];
const cityReport = [];
for (let i = 0; i < capitals.length; i++) {
  const [x, y] = capitals[i];
  await page.goto(new URL(`labs/artlab.html?generation=5&x=${x}&y=${y + 18}&scale=2&motion=0&nonpc=1`, base).href);
  await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
  await page.waitForFunction(
    () => {
      if (!window.__lab?.buildings) return false;
      const views = window.__lab.buildings.views;
      const visible = views.filter(
        (v) =>
          v.b.x + v.b.w + 4 >= window.__lab.bounds[0] &&
          v.b.x - 4 <= window.__lab.bounds[2] &&
          v.b.y + v.b.h + 4 >= window.__lab.bounds[1] &&
          v.b.y - 4 <= window.__lab.bounds[3],
      );
      return visible.length > 0 && visible.every((v) => !!v.art);
    },
    null,
    { timeout: 60000 },
  );
  cityReport.push(
    await page.evaluate(() => ({
      total: window.__lab.buildings.views.length,
      nearby: window.__lab.buildings.nearby.length,
    })),
  );
  await page.screenshot({ path: out + '/city' + i + '.png' });
}
await page.setViewportSize({ width: 844, height: 390 });
await page.goto(new URL('labs/artlab.html?generation=5&x=1024&y=-494&scale=2&motion=0&nonpc=1', base).href);
await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
await page.waitForFunction(
  () => {
    if (!window.__lab?.buildings) return false;
    const { buildings, bounds: b } = window.__lab;
    const visible = buildings.views.filter(
      (v) => v.b.x + v.b.w + 4 >= b[0] && v.b.x - 4 <= b[2] && v.b.y + v.b.h + 4 >= b[1] && v.b.y - 4 <= b[3],
    );
    return visible.length > 0 && visible.every((v) => v.art);
  },
  null,
  { timeout: 60000 },
);
await page.screenshot({ path: out + '/mobile.png' });
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
console.log(JSON.stringify({ roofs: report.length, capitals: 6, cityReport, errors: errors.length, report }));
