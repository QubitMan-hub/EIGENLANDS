// Source Vite lab: node --import tsx e2e/castle-frontier-art.mjs [base] [out]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { frontierSite, frontierTown } from '../packages/shared/src/frontier.ts';
import { realmTowns } from '../packages/shared/src/realm-towns.ts';
const base = process.argv[2] ?? 'http://localhost:5176/';
const out = process.argv[3] ?? '/tmp/castle-frontier-art';
mkdirSync(out, { recursive: true });
const seed = 20260101,
  errors = [],
  report = { contrast: [], castles: [], frontier: [] };
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [name, width, height] of [
    ['desktop', 1280, 720],
    ['mobile', 844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(new URL('labs/uilab.html?panel=dialogue', base).href);
    await page.waitForSelector('.dlg-box');
    await page.locator('.dlg-box').click();
    const r = await page.locator('.dlg-box').evaluate((el) => {
      const s = getComputedStyle(el),
        rgb = (c) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (c) =>
        rgb(c)
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const a = lum(s.color),
        b = lum(s.backgroundColor);
      return {
        text: el.textContent,
        colour: s.color,
        background: s.backgroundColor,
        contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
    if (r.text.length < 10 || r.contrast < 7) throw new Error('Unreadable dialogue ' + JSON.stringify(r));
    report.contrast.push({ name, ...r });
    await page.screenshot({ path: `${out}/dialogue-${name}.png` });
  }
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto(
    new URL(
      'labs/artlab.html?lab=sprite&subs=royal_throne,rampart_aurelion_ew,rampart_khardum_corner,rampart_thalassara_ns&scale=3&motion=0',
      base,
    ).href,
  );
  await page.waitForFunction(() => window.__lab?.ready);
  await page.screenshot({ path: out + '/fortification-props.png' });
  for (const [name, x, y] of [
    ['meadow', 90, 50],
    ['enchanted', -175, -450],
    ['forest', -75, -200],
    ['wastes', -3464, -4804],
  ]) {
    for (const hour of [12, 23]) {
      await page.goto(
        new URL(`labs/artlab.html?x=${x}&y=${y}&generation=6&scale=3&hour=${hour}&season=1&motion=0`, base).href,
      );
      await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/grass-${name}-${hour}.png` });
    }
  }
  const capitals = realmTowns(seed, 6).filter((t) => t.buildings.some((b) => b.id.endsWith('.palace')));
  const models = capitals.map((t) => ({
    ...t.buildings.find((b) => b.id.endsWith('.palace')),
    x: 0,
    y: 0,
    w: 12,
    h: 9,
    doorX: 6,
    doorY: 8,
  }));
  await page.evaluate(async (models) => {
    const { buildBuildingArt } = await import('/src/art/buildings.ts');
    document.body.innerHTML = '';
    document.body.style =
      'background:#263b35;color:#f0e2bd;margin:0;overflow:auto;display:flex;flex-wrap:wrap;gap:12px;padding:16px';
    document.documentElement.style = 'overflow:auto;height:auto';
    for (const b of models) {
      const art = buildBuildingArt(b),
        pieces = [
          ...art.walls.sort((a, b) => a.tx + a.ty - b.tx - b.ty).map((p) => ({ tex: p.day, x: p.x, y: p.y })),
          art.roof,
        ];
      const x = Math.floor(Math.min(...pieces.map((p) => p.x))) - 8,
        y = Math.floor(Math.min(...pieces.map((p) => p.y))) - 8;
      const w = Math.ceil(Math.max(...pieces.map((p) => p.x + p.tex.width))) - x + 8,
        h = Math.ceil(Math.max(...pieces.map((p) => p.y + p.tex.height))) - y + 8;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.translate(-x, -y);
      for (const p of pieces) ctx.drawImage(p.tex.source.resource, p.x, p.y);
      const f = document.createElement('figure');
      f.style = 'margin:0';
      const title = document.createElement('figcaption');
      title.textContent = b.id;
      c.style = 'image-rendering:pixelated;width:' + w * 2 + 'px;height:' + h * 2 + 'px';
      f.append(title, c);
      document.body.append(f);
    }
  }, models);
  await page.screenshot({ path: out + '/castle-families.png', fullPage: true });
  async function scene(name, x, y, extra = '') {
    await page.goto(new URL(`labs/artlab.html?generation=6&x=${x}&y=${y}&scale=1&motion=0&nonpc=1${extra}`, base).href);
    await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
    await page.waitForFunction(
      () => {
        const l = window.__lab;
        if (!l?.buildings) return false;
        const [x0, y0, x1, y1] = l.bounds,
          visible = l.buildings.views.filter(
            (v) => v.b.x + v.b.w + 4 >= x0 && v.b.x - 4 <= x1 && v.b.y + v.b.h + 4 >= y0 && v.b.y - 4 <= y1,
          );
        return visible.length > 0 && visible.every((v) => v.art);
      },
      null,
      { timeout: 60000 },
    );
    const r = await page.evaluate(() => ({
      total: window.__lab.buildings.views.length,
      nearby: window.__lab.buildings.nearby.length,
    }));
    await page.screenshot({ path: `${out}/${name}.png` });
    return r;
  }
  for (const t of capitals) {
    const b = t.buildings.find((b) => b.id.endsWith('.palace'));
    report.castles.push({
      name: t.name,
      ...(await scene('castle-' + t.name.toLowerCase().replace(/[^a-z]/g, ''), b.x + b.w / 2, b.y + b.h / 2)),
    });
  }
  const visited = [];
  for (let y = -4; y <= 0 && visited.length < 3; y++)
    for (let x = -4; x <= 4 && visited.length < 3; x++) {
      const s = frontierSite(seed, x, y);
      if (s) visited.push(s);
    }
  for (const s of visited) {
    const t = frontierTown(seed, s);
    report.frontier.push({
      name: t.name,
      x: t.cx,
      y: t.cy,
      buildings: t.buildings.length,
      ...(await scene(s.id, t.cx, t.cy + 8)),
    });
  }
  const t = frontierTown(seed, visited[0]),
    home = t.buildings.find((b) => b.kind === 'house' && b.w > 6) ?? t.buildings[0];
  await scene(
    'frontier-interior',
    home.x + home.w / 2,
    home.y + home.h / 2,
    `&px=${home.doorX}&py=${home.doorY - 1}&hour=21`,
  );
  if (errors.length) throw new Error(errors.join('\n'));
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
