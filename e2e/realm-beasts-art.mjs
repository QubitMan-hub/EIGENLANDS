// Contact sheet of the six kingdom beasts: node e2e/realm-beasts-art.mjs [outdir]  (needs Vite on :5174, labs/artlab.html)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? '/tmp/realm-beasts';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1300, height: 1300 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5174/labs/artlab.html?lab=actors&motion=0');
await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
await page.evaluate(async () => {
  const { buildFoeSheets } = await import('/src/art/foes.ts');
  const foes = buildFoeSheets();
  document.body.replaceChildren();
  document.body.style.cssText = 'margin:10px;background:#45694c';
  const c = document.createElement('canvas');
  c.width = 3 * 2 * 132;
  c.height = 4 * 124;
  c.style.cssText = 'width:' + c.width * 1.6 + 'px;image-rendering:pixelated';
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const anims = ['idle', 'move', 'windup', 'attack', 'death'];
  for (let k = 0; k < 6; k++)
    for (let d = 0; d < 2; d++)
      ['idle', 'attack'].forEach((a, r) => {
        const t = foes.frame(44 + k, false, d * 4, a, Math.min(1, foes.frames(44 + k, a) - 1));
        const f = t.frame;
        g.drawImage(
          t.source.resource,
          f.x,
          f.y,
          f.width,
          f.height,
          ((k % 3) * 2 + d) * 132,
          (Math.floor(k / 3) * 2 + r) * 124,
          f.width,
          f.height,
        );
      });
  document.body.append(c);
});
await page.screenshot({ path: `${out}/beasts.png`, fullPage: true });
console.log(errors.length ? errors.join('\n') : 'ok');
await browser.close();
