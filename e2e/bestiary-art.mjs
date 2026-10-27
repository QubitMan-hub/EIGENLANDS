// --bake is an offline authoring step. Normal CI validates shipped pixels without runtime 3D baking.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { format } from 'prettier';
import { BESTIARY_KEYS } from '../packages/shared/src/bestiary.ts';
import { BOSSES } from '../packages/shared/src/bosses.ts';
import { ENEMY_DEFS } from '../packages/shared/src/combat.ts';
const base = process.argv[2] ?? 'http://127.0.0.1:5186/',
  out = process.argv[3] ?? '/tmp/bestiary-art',
  bake = process.argv.includes('--bake');
const assets = 'packages/client/public/art/bestiary';
mkdirSync(out, { recursive: true });
if (bake) mkdirSync(assets + '/portraits', { recursive: true });
const sourceHash = createHash('sha256')
  .update(
    ['legendary-fauna.ts', 'sprite.ts', 'creature-pixels.ts']
      .map((f) => readFileSync('packages/client/src/art/' + f, 'utf8'))
      .join('\n'),
  )
  .digest('hex');
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(new URL('labs/uilab.html?panel=none', base).href);
  const keys = [
    ...BESTIARY_KEYS.filter((id) => !['cow', 'sheep', 'pig', 'horse'].includes(id)),
    ...Object.keys(BOSSES).filter((id) => !BESTIARY_KEYS.includes(id)),
  ];
  const bosses = JSON.parse(readFileSync(assets + '/boss-manifest.json', 'utf8'));
  const authored = new Set(Object.keys(bosses.atlases));
  let manifest = bake
    ? { sourceHash, atlases: {}, portraits: [] }
    : JSON.parse(readFileSync(assets + '/manifest.json', 'utf8'));
  if (bake) {
    for (const id of keys.filter((id) => !authored.has(id))) {
      for (const night of [false, true]) {
        const baked = await page.evaluate(
          async ({ id, night }) => {
            const { critterSheetCanvas, creatureDefinition } = await import('/src/art/foes.ts');
            const raw = critterSheetCanvas(id, night),
              d = creatureDefinition(id),
              cols = Object.values(d.n).reduce((a, b) => a + b, 0);
            const c = raw.getContext('2d'),
              pixels = c.getImageData(0, 0, raw.width, raw.height).data;
            let minX = d.w,
              minY = d.h,
              maxX = 0,
              maxY = 0;
            for (let y = 0; y < raw.height; y++)
              for (let x = 0; x < raw.width; x++)
                if (pixels[(y * raw.width + x) * 4 + 3]) {
                  const xx = x % d.w,
                    yy = y % d.h;
                  minX = Math.min(minX, xx);
                  maxX = Math.max(maxX, xx);
                  minY = Math.min(minY, yy);
                  maxY = Math.max(maxY, yy);
                }
            const trim = Math.max(0, Math.min(minX, d.w - maxX - 1) - 2),
              top = Math.max(0, minY - 2),
              w = d.w - trim * 2,
              h = Math.min(d.h, maxY + 3) - top;
            const atlas = document.createElement('canvas');
            const packedCols = Math.min(cols, Math.floor(2048 / w)),
              poseRows = Math.ceil(cols / packedCols);
            atlas.width = w * packedCols;
            atlas.height = h * 4 * poseRows;
            const ctx = atlas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            for (let row = 0; row < 4; row++)
              for (let col = 0; col < cols; col++)
                ctx.drawImage(
                  raw,
                  col * d.w + trim,
                  row * d.h + top,
                  w,
                  h,
                  (col % packedCols) * w,
                  (row * poseRows + Math.floor(col / packedCols)) * h,
                  w,
                  h,
                );
            return {
              url: atlas.toDataURL(),
              meta: { w, h, ay: d.ay - top, frames: d.n, cols: packedCols, rows: 4 * poseRows, poseRows },
            };
          },
          { id, night },
        );
        if (!night) manifest.atlases[id] = baked.meta;
        else assert.deepEqual(baked.meta, manifest.atlases[id], 'day/night anchors agree');
        writeFileSync(`${assets}/${id}-${night ? 'night' : 'day'}.png`, Buffer.from(baked.url.split(',')[1], 'base64'));
      }
      console.log('baked', id);
    }
    for (const [id, def] of Object.entries(ENEMY_DEFS)) {
      if (authored.has(id)) continue;
      const url = await page.evaluate(
        async ({ id, kind }) => {
          const f = await import('/src/art/foes.ts');
          let source;
          const alias = id;
          if (![3, 7, 8, 9, 33].includes(kind) && f.creatureDefinition(alias)) source = f.creaturePortraitCanvas(alias);
          else if ([3, 7, 8, 9, 33].includes(kind)) {
            const { Critters } = await import('/src/art/critters.ts');
            const c = (globalThis.__bestiaryCritters ??= await Critters.load());
            const tex =
              kind === 33
                ? c.stormbound.frame(0, 'idle', 0)
                : c.frame(kind === 3 ? 'stag' : kind === 8 ? 'wolf' : kind === 9 ? 'badger' : 'boar', 'idle', 'SE', 0);
            const c2 = document.createElement('canvas');
            c2.width = tex.width;
            c2.height = tex.height;
            c2.getContext('2d').drawImage(
              tex.source.resource,
              tex.frame.x,
              tex.frame.y,
              tex.frame.width,
              tex.frame.height,
              0,
              0,
              c2.width,
              c2.height,
            );
            source = c2;
          } else return null;
          const ctx = source.getContext('2d'),
            d = ctx.getImageData(0, 0, source.width, source.height).data;
          let x0 = source.width,
            y0 = source.height,
            x1 = -1,
            y1 = -1;
          for (let y = 0; y < source.height; y++)
            for (let x = 0; x < source.width; x++)
              if (d[(y * source.width + x) * 4 + 3]) {
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
              }
          if (x1 < x0) throw Error('Empty portrait ' + id);
          const w = x1 - x0 + 1,
            h = y1 - y0 + 1,
            k = Math.min(60 / w, 60 / h, 2),
            c3 = document.createElement('canvas');
          c3.width = c3.height = 64;
          const c = c3.getContext('2d');
          c.imageSmoothingEnabled = false;
          c.drawImage(
            source,
            x0,
            y0,
            w,
            h,
            Math.round((64 - w * k) / 2),
            Math.round(62 - h * k),
            Math.round(w * k),
            Math.round(h * k),
          );
          return c3.toDataURL();
        },
        { id, kind: def.kind },
      );
      if (url) {
        writeFileSync(`${assets}/portraits/${id}.png`, Buffer.from(url.split(',')[1], 'base64'));
        manifest.portraits.push(id);
      }
    }
    await page.goto('about:blank'); // Disconnect Vite HMR before replacing an imported manifest.
    const json = await format(JSON.stringify(manifest), { parser: 'json', printWidth: 120, singleQuote: true });
    writeFileSync(assets + '/manifest.json', json);
    writeFileSync('packages/client/src/art/bestiary-manifest.json', json);
    await page.goto(new URL('labs/uilab.html?panel=none', base).href);
  }
  assert.equal(manifest.sourceHash, sourceHash, 'Sprite source changed: regenerate the committed atlases.');
  manifest.atlases = { ...manifest.atlases, ...bosses.atlases };
  manifest.portraits = [...new Set([...manifest.portraits, ...bosses.portraits])];
  const report = await page.evaluate(
    async ({ keys, base, manifest }) => {
      document.body.innerHTML = '';
      document.documentElement.style = 'height:auto;overflow:auto';
      document.body.style =
        'background:#263d36;color:#f0dfbb;display:flex;flex-wrap:wrap;gap:12px;padding:12px;overflow:auto;height:auto';
      const { creatureDefinition } = await import('/src/art/foes.ts');
      const result = [];
      for (const id of keys) {
        const d = { ...creatureDefinition(id), ...manifest.atlases[id] },
          fig = document.createElement('figure');
        fig.style = 'margin:0;padding:6px;background:#304b41';
        const label = document.createElement('figcaption');
        label.textContent = id;
        fig.append(label);
        for (const night of [false, true]) {
          const img = new Image();
          img.src = new URL(`art/bestiary/${id}-${night ? 'night' : 'day'}.png`, base).href;
          await img.decode();
          const cols = Object.values(d.n).reduce((a, b) => a + b, 0);
          if (img.width !== d.w * d.cols || img.height !== d.h * d.rows || img.width > 2048)
            throw Error('Bad atlas dimensions ' + id);
          const source = document.createElement('canvas');
          source.width = img.width;
          source.height = img.height;
          const c = source.getContext('2d', { willReadFrequently: true });
          c.drawImage(img, 0, 0);
          let frameCount = 0,
            edge = 0;
          for (let row = 0; row < 4; row++)
            for (let col = 0; col < cols; col++) {
              const a = c.getImageData(
                (col % d.cols) * d.w,
                (row * d.poseRows + Math.floor(col / d.cols)) * d.h,
                d.w,
                d.h,
              ).data;
              let n = 0;
              for (let y = 0; y < d.h; y++)
                for (let x = 0; x < d.w; x++)
                  if (a[(y * d.w + x) * 4 + 3]) {
                    n++;
                    if (x === 0 || y === 0 || x === d.w - 1 || y === d.h - 1) edge++;
                  }
              if (n < 15) throw Error('Empty pose ' + id + '/' + row + '/' + col);
              frameCount++;
            }
          if (edge) throw Error('Clipped pose ' + id + ' pixels ' + edge);
          const preview = document.createElement('canvas');
          preview.width = d.w * 4;
          preview.height = d.h;
          const p = preview.getContext('2d');
          for (let row = 0; row < 4; row++)
            p.drawImage(img, 0, row * d.poseRows * d.h, d.w, d.h, row * d.w, 0, d.w, d.h);
          preview.style = 'image-rendering:pixelated;display:block;max-width:760px';
          fig.append(preview);
          result.push({ id, night, frames: frameCount, clipped: edge });
        }
        document.body.append(fig);
      }
      return result;
    },
    { keys, base, manifest },
  );
  await page.screenshot({ path: out + '/bestiary-gallery.png', fullPage: true });
  assert.deepEqual(errors, []);
  writeFileSync(
    out + '/report.json',
    JSON.stringify({ sourceHash, models: report, portraits: manifest.portraits.length, errors }, null, 2),
  );
  console.log(
    'PASS baked bestiary atlas dimensions, four facings, all animation poses and no edge clipping',
    report.length,
  );
} finally {
  await browser.close();
}
