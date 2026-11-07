import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[3] ?? '/tmp/person-actions';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1380, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5174/'}labs/artlab.html?lab=actors&motion=0`);
  await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 120000 });
  const report = await page.evaluate(async () => {
    const [
      { buildActorSheets, renderPersonCanvas, OUTFITS, PERSON_W, PERSON_H },
      { ACTION_START, actionKeys },
      { HeldWeapons },
    ] = await Promise.all([
      import('/src/art/actors.ts'),
      import('/src/art/person-actions.ts'),
      import('/src/art/weapons.ts'),
    ]);
    const sheets = buildActorSheets(),
      held = new HeldWeapons();
    const tool = {
      mine: 'pickaxe',
      chop: 'axe',
      dig: 'hoe',
      water: 'can',
      fish: 'rod',
      fish_reel: 'rod',
      fish_land: 'rod',
      slash: 'sword',
      thrust: 'spear',
      cleave: 'greatsword',
    };
    document.body.replaceChildren();
    document.body.style.cssText =
      'margin:16px;background:#283837;color:#f1e4bd;font:14px monospace;overflow:auto;height:auto';
    document.documentElement.style.cssText = 'overflow:auto;height:auto';
    let frames = 0;
    const failures = [];
    for (const [action, start] of Object.entries(ACTION_START)) {
      const title = document.createElement('div');
      title.textContent = action;
      document.body.append(title);
      const canvas = document.createElement('canvas');
      canvas.width = 8 * 64 * 3;
      canvas.height = 80 * 3;
      canvas.style.width = '1536px';
      canvas.style.height = '240px';
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      for (let d = 0; d < 8; d++) {
        for (const key of actionKeys(action)) {
          const k = key;
          const t = sheets.person(0, d, key),
            r = t.frame;
          const data = t.source.resource.getContext('2d').getImageData(r.x, r.y, r.width, r.height).data;
          let count = 0,
            partial = 0,
            edge = 0;
          for (let y = 0; y < PERSON_H; y++)
            for (let x = 0; x < PERSON_W; x++) {
              const a = data[(y * PERSON_W + x) * 4 + 3];
              if (a) {
                count++;
                if (a !== 255) partial++;
                if (!x || x === PERSON_W - 1 || !y) edge++;
              }
            }
          if (count < 90 || partial || edge) failures.push({ action, d, k, count, partial, edge });
          if (sheets.person(0, d, key) !== t) failures.push({ action, cache: false });
          frames++;
        }
        const key = actionKeys(action)[4],
          t = sheets.person(d % OUTFITS.length, d, key);
        ctx.drawImage(
          t.source.resource,
          t.frame.x,
          t.frame.y,
          PERSON_W,
          PERSON_H,
          d * 192 + (192 - PERSON_W * 3) / 2,
          36,
          PERSON_W * 3,
          PERSON_H * 3,
        );
        if (tool[action]) {
          const w = held.texture(tool[action], d, key),
            f = w.frame;
          ctx.drawImage(w.source.resource, f.x, f.y, f.width, f.height, d * 192, 0, 192, 240);
          if (['slash', 'thrust', 'cleave'].includes(action)) {
            for (const key of actionKeys(action)) {
              const t = held.texture(tool[action], d, key),
                r = t.frame;
              const px = t.source.resource.getContext('2d').getImageData(r.x, r.y, r.width, r.height).data;
              let edge = 0;
              for (let y = 0; y < r.height; y++)
                for (let x = 0; x < r.width; x++)
                  if ((x === 0 || x === r.width - 1 || y === 0 || y === r.height - 1) && px[(y * r.width + x) * 4 + 3])
                    edge++;
              if (edge) failures.push({ action, d, key, heldEdge: edge });
            }
          }
          if (w.source.width > 2048 || w.source.height > 2048) failures.push({ action, textureBudget: false });
        }
      }
      document.body.append(canvas);
    }
    let appearanceFrames = 0;
    for (let look = 0; look < OUTFITS.length; look++)
      for (let d = 0; d < 8; d++)
        for (let f = 0; f < 30; f++) {
          const canvas = renderPersonCanvas(OUTFITS[look], d, f);
          const data = canvas.getContext('2d').getImageData(0, 0, PERSON_W, PERSON_H).data;
          let partial = 0,
            edge = 0;
          for (let y = 0; y < PERSON_H; y++)
            for (let x = 0; x < PERSON_W; x++) {
              const a = data[(y * PERSON_W + x) * 4 + 3];
              if (a && a !== 255) partial++;
              if (a && (!x || x === PERSON_W - 1 || !y)) edge++;
            }
          if (partial || edge) failures.push({ look, d, f, partial, edge });
          appearanceFrames++;
        }
    const heading = document.createElement('div');
    heading.textContent = 'Original player and resident garments — eight facings';
    document.body.append(heading);
    const preview = document.createElement('canvas');
    preview.width = 8 * PERSON_W * 4;
    preview.height = OUTFITS.length * 48 * 4;
    const p = preview.getContext('2d');
    p.imageSmoothingEnabled = false;
    for (let i = 0; i < OUTFITS.length; i++)
      for (let d = 0; d < 8; d++)
        p.drawImage(
          renderPersonCanvas(OUTFITS[i], d, 0),
          d * PERSON_W * 4,
          i * PERSON_H * 4,
          PERSON_W * 4,
          PERSON_H * 4,
        );
    document.body.append(preview);
    return { frames, appearanceFrames, failures, outfits: OUTFITS.length };
  });
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await page.screenshot({ path: `${out}/actions.png`, fullPage: true });
  assert.deepEqual(report.failures, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
