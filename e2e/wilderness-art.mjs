import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5173/'}labs/artlab.html?lab=wilderness&scale=3&motion=0`);
  await page.waitForFunction(() => window.__lab?.ready);
  const result = await page.evaluate(async () => {
    const { buildSceneryArt } = await import('/src/art/scenery.ts');
    const { PROPS } = await import('/src/art/props.ts');
    const { worldObjDef } = await import('/src/art/worldobjs.ts');
    const failures = [];
    const pixels = (sp) => sp.tex.source.resource.getContext('2d').getImageData(0, 0, sp.tex.width, sp.tex.height).data;
    for (const [key, frames] of Object.entries(buildSceneryArt()))
      for (const sp of frames) {
        const a = pixels(sp);
        let n = 0,
          edge = 0;
        for (let y = 0; y < sp.tex.height; y++)
          for (let x = 0; x < sp.tex.width; x++)
            if (a[(y * sp.tex.width + x) * 4 + 3]) {
              n++;
              if (!x || !y || x === sp.tex.width - 1 || y === sp.tex.height - 1) edge++;
            }
        if (n < 12 || edge) failures.push({ key, n, edge });
      }
    for (const face of ['sw', 'se'])
      for (const key of ['shrine_altar', 'shrine_pillar'])
        for (const sp of PROPS[key](face).frames) {
          const a = pixels(sp);
          for (let x = 0; x < sp.tex.width; x++) if (a[x * 4 + 3]) failures.push({ key, face, clippedTop: true });
        }
    const crop = worldObjDef({
      x: 0,
      y: 0,
      kind: 'crop',
      sub: '*turnip+potato',
      data: { crop: 'turnip', alt: 'potato', growth: 99999 },
    });
    const a = pixels(crop.frames[0]);
    let changed = 0;
    const b = pixels(crop.frames[1]);
    for (let i = 0; i < a.length; i += 4) if (a.slice(i, i + 4).some((v, k) => v !== b[i + k])) changed++;
    return { failures, changed, frames: crop.frames.length, fps: crop.fps };
  });
  assert.deepEqual(result.failures, [], 'Scenery and shrines stay within their canvases');
  assert.ok(result.changed > 0 && result.changed <= 30, 'Only sparse motes change; crop silhouettes stay coherent');
  assert.equal(result.frames, 4);
  assert.equal(result.fps, 1);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: '/tmp/eigenlands-wilderness.png' });
  console.log('Wilderness artwork, shrine bounds and coherent superposition frames passed');
} finally {
  await browser.close();
}
