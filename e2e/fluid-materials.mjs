import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const out = process.argv[2] ?? '/tmp/fluid-materials',
  baseline = process.argv[3];
const temp = 'packages/client/src/labs/.fluid-before.ts';
mkdirSync(out, { recursive: true });
if (baseline)
  writeFileSync(temp, execFileSync('git', ['show', `${baseline}:packages/client/src/gl/terrain.frag.ts`]), {
    flag: 'wx',
  });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5174/labs/artlab.html?lab=icons');
  await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
  const report = await page.evaluate(async (baseline) => {
    const pixiUrl = performance.getEntriesByType('resource').find((e) => /pixi_+js\.js/.test(e.name)).name;
    const [{ Application, Shader }, { Terrain }] = await Promise.all([import(pixiUrl), import('/src/game/terrain.ts')]);
    const old = baseline ? await import('/src/labs/.fluid-before.ts') : null;
    const app = new Application();
    await app.init({ width: 384, height: 240, resolution: 1, antialias: false, preference: 'webgl' });
    app.stop();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:16px;background:#1c2630;color:#eee0bb;font:16px monospace;overflow:auto';
    document.documentElement.style.cssText = 'height:auto;overflow:auto';
    const results = [];
    for (const tile of [1, 28])
      for (const detail of [0, 1])
        for (const before of baseline ? [true, false] : [false]) {
          const store = {
            seed: 1337,
            get: () => ({ diff: new Map() }),
            getTile: (x, y) => (Math.abs(x) < 12 && Math.abs(y) < 10 ? tile : 3),
          };
          const terrain = new Terrain(app.renderer, store);
          terrain.resize(384, 240);
          if (before) {
            for (const shader of terrain.shaders.values()) shader.destroy();
            terrain.shaders.clear();
            terrain.shaderFor = function (mode) {
              let shader = this.shaders.get(mode);
              if (!shader) {
                shader = Shader.from({
                  gl: {
                    vertex: old.TERRAIN_VERT,
                    fragment: old.TERRAIN_FRAG.replace('uniform float uDetail;', `const float uDetail = ${mode}.0;`),
                  },
                  resources: { uTiles: this.src, commonUniforms: this.common },
                });
                this.shaders.set(mode, shader);
              }
              return shader;
            };
          }
          const render = (time, reduced = false) => {
            terrain.render(-192, -120, 0, 0, time, 1, !reduced, undefined, detail);
            const raw = app.renderer.extract.canvas({ target: terrain.sprite }),
              c = document.createElement('canvas');
            c.width = 384;
            c.height = 240;
            c.getContext('2d').drawImage(
              raw,
              Math.round(-192 - terrain.originX),
              Math.round(-120 - terrain.originY),
              384,
              240,
              0,
              0,
              384,
              240,
            );
            return c;
          };
          const image = render(0),
            data = image.getContext('2d').getImageData(0, 0, 384, 240).data;
          const later = render(16).getContext('2d').getImageData(0, 0, 384, 240).data;
          let selected = 0,
            dark = 0,
            moving = 0;
          for (let y = 40; y < 200; y++)
            for (let x = 64; x < 320; x++) {
              const i = (y * 384 + x) * 4,
                r = data[i],
                g = data[i + 1],
                b = data[i + 2];
              const material = tile === 1 ? b > g + 6 && g > r : true;
              if (!material) continue;
              selected++;
              if (Math.max(r, g, b) < (tile === 1 ? 90 : 135)) dark++;
              if (Math.max(...[0, 1, 2].map((k) => Math.abs(data[i + k] - later[i + k]))) > 12) moving++;
            }
          const frozen = render(0, true).toDataURL(),
            frozenLater = render(16, true).toDataURL();
          const figure = document.createElement('figure'),
            label = document.createElement('figcaption');
          label.textContent = `${tile === 1 ? 'Water' : 'Lava'} · ${detail ? 'High' : 'Economy'} · ${before ? 'before' : 'after'}`;
          image.style.cssText = 'width:768px;height:480px;image-rendering:pixelated';
          figure.append(label, image);
          document.body.append(figure);
          results.push({
            tile,
            detail,
            before,
            selected,
            darkFraction: dark / selected,
            movingFraction: moving / selected,
            reducedStable: frozen === frozenLater,
          });
          terrain.destroy?.();
        }
    return results;
  }, !!baseline);
  await page.screenshot({ path: `${out}/comparison.png`, fullPage: true });
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  for (const r of report.filter((r) => !r.before)) {
    assert.ok(r.selected > 500);
    assert.ok(r.darkFraction < 0.015, JSON.stringify(r));
    assert.ok(r.movingFraction < 0.02, JSON.stringify(r));
    assert.equal(r.reducedStable, true);
  }
  console.log('PASS calm actual-shader water/lava, both detail modes and reduced motion', report);
} finally {
  await browser.close();
  if (baseline) unlinkSync(temp);
}
