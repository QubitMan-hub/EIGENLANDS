// Contact sheet of the 24 army units: node e2e/army-art.mjs [outdir] (needs Vite on :5174)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? '/tmp/army-art';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 3200, height: 1800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5174/labs/artlab.html?lab=actors&motion=0');
await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
const anim = process.env.ANIM ?? 'idle';
const zoom = Number(process.env.ZOOM ?? 1.1);
const realms = (process.env.REALMS ?? '0,1,2,3,4,5').split(',').map(Number);
await page.evaluate(
  async ([anim, zoom, realms, farm]) => {
    const { buildFoeSheets } = await import('/src/art/foes.ts');
    const foes = buildFoeSheets();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:10px;background:#45694c';
    const c = document.createElement('canvas');
    const CW = 128,
      CH = 124;
    c.width = 8 * CW;
    c.height = realms.length * CH;
    c.style.cssText = `width:${c.width * zoom}px;image-rendering:pixelated`;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (const [ri, r] of realms.entries())
      for (let cl = 0; cl < 4; cl++)
        for (let d = 0; d < 2; d++) {
          const kind = farm ? 74 + cl : 50 + r * 4 + cl;
          const t = foes.frame(kind, false, d * 4, anim, Math.min(1, foes.frames(kind, anim) - 1));
          const f = t.frame;
          g.drawImage(t.source.resource, f.x, f.y, f.width, f.height, (cl * 2 + d) * CW, ri * CH, f.width, f.height);
        }
    document.body.append(c);
  },
  [anim, zoom, realms, !!process.env.FARM],
);
await page.screenshot({ path: `${out}/army-${anim}.png`, fullPage: true });
console.log(errors.length ? errors.join('\n') : 'ok');
await browser.close();
