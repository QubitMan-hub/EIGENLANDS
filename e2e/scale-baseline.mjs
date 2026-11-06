import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[3] ?? 'test-results/scale-baseline';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5244/'}?dev=1&hour=12`);
  await page.fill('#name', 'Scale baseline');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await page.evaluate(() => window.__eigen.game.ext.circuit.send('p3_tutorial', { action: 'skip' }));
  await page.waitForTimeout(800);
  const report = await page.evaluate(() => {
    const g = window.__eigen.game,
      v = g.views.get(g.myId),
      tex = v.sprite.texture;
    const c = document.createElement('canvas');
    c.width = tex.frame.width;
    c.height = tex.frame.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(
      tex.source.resource,
      tex.frame.x,
      tex.frame.y,
      tex.frame.width,
      tex.frame.height,
      0,
      0,
      c.width,
      c.height,
    );
    const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
    let top = c.height,
      bottom = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (pixels[(y * c.width + x) * 4 + 3] >= 128) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
    const height = bottom - top + 1;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      projection: 'sx=(x-y)*16; sy=(x+y)*8',
      zoom: g.scale,
      spriteScale: v.sprite.scale.y,
      cellWidth: c.width,
      cellHeight: c.height,
      visibleTop: top,
      visibleBottom: bottom,
      visibleStandingHeightWorldPixels: height * v.sprite.scale.y,
      visibleStandingHeightScreenPixels: height * v.sprite.scale.y * g.scale,
      position: { x: g.predictor.sim.x, y: g.predictor.sim.y },
      frame: v.personFrame,
    };
  });
  await page.screenshot({ path: `${out}/before.png` });
  writeFileSync(`${out}/baseline.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
