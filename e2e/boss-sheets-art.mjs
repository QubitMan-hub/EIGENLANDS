import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:5187/',
  out = process.argv[3] ?? '/tmp/boss-sheets';
mkdirSync(out, { recursive: true });
const root = 'packages/client/public/art/bestiary';
const manifest = JSON.parse(readFileSync(root + '/boss-manifest.json', 'utf8'));
const hash = createHash('sha256').update(readFileSync('tools/bake-boss-sheets.mjs'));
for (const id of Object.keys(manifest.atlases)) hash.update(id).update(readFileSync(`art-source/bosses/${id}.png`));
assert.equal(hash.digest('hex'), manifest.sourceHash, 'Authored source changed; normalize boss sheets again');
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.goto(base + 'labs/uilab.html?panel=none');
  const report = await p.evaluate(
    async ({ base, manifest }) => {
      document.body.innerHTML = '';
      document.body.style = 'background:#243931;color:#f0dfbb;overflow:auto;height:auto;margin:12px';
      document.documentElement.style = 'overflow:auto;height:auto';
      const result = [];
      for (const [id, d] of Object.entries(manifest.atlases)) {
        const box = document.createElement('section');
        box.id = id;
        const title = document.createElement('h2');
        title.textContent = id;
        box.append(title);
        const poses = Object.values(d.frames).reduce((a, b) => a + b, 0);
        for (const night of [false, true]) {
          const img = new Image();
          img.src = new URL(`art/bestiary/${id}-${night ? 'night' : 'day'}.png`, base);
          await img.decode();
          if (img.width !== d.w * d.cols || img.height !== d.h * d.rows || img.width > 2048 || img.height > 2048)
            throw Error('Invalid boss dimensions ' + id);
          const all = document.createElement('canvas');
          all.width = img.width;
          all.height = img.height;
          const ctx = all.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const fingerprints = [],
            counts = [];
          for (let dir = 0; dir < 4; dir++)
            for (let pose = 0; pose < poses; pose++) {
              const x = (pose % d.cols) * d.w,
                y = (dir * d.poseRows + Math.floor(pose / d.cols)) * d.h,
                a = ctx.getImageData(x, y, d.w, d.h);
              let count = 0;
              for (let yy = 0; yy < d.h; yy++)
                for (let xx = 0; xx < d.w; xx++) {
                  const alpha = a.data[(yy * d.w + xx) * 4 + 3];
                  if (alpha !== 0 && alpha !== 255) throw Error('Soft alpha ' + id);
                  if (alpha) {
                    count++;
                    if (xx === 0 || yy === 0 || xx === d.w - 1 || yy === d.h - 1)
                      throw Error('Clipped frame ' + id + '/' + dir + '/' + pose);
                  }
                }
              if (count < 300) throw Error('Empty or damaged boss pose ' + id + '/' + dir + '/' + pose);
              counts.push(count);
              if (pose === 0) fingerprints.push(a.data.join(','));
            }
          if (new Set(fingerprints).size !== 4) throw Error('Repeated boss facing ' + id);
          const row = document.createElement('canvas');
          row.width = d.w * 4;
          row.height = d.h;
          row.style = 'image-rendering:pixelated;background:#304b41;display:block;margin:4px 0;max-width:100%';
          const rc = row.getContext('2d');
          rc.imageSmoothingEnabled = false;
          for (let dir = 0; dir < 4; dir++)
            rc.drawImage(img, 0, dir * d.poseRows * d.h, d.w, d.h, dir * d.w, 0, d.w, d.h);
          box.append(row);
          // Live animation preview uses exactly the production pose map, no mesh interpolation or stretching.
          if (!night) {
            const anim = document.createElement('canvas');
            anim.width = d.w * 3;
            anim.height = d.h;
            anim.style = 'image-rendering:pixelated;background:#304b41';
            const ac = anim.getContext('2d');
            const sequences = [
              [1, 2, 3, 4],
              [5, 5, 6, 7, 0],
              [8, 0, 9],
            ];
            let frame = 0;
            setInterval(() => {
              ac.clearRect(0, 0, anim.width, anim.height);
              sequences.forEach((seq, i) => {
                const pose = seq[frame % seq.length];
                ac.drawImage(
                  img,
                  (pose % d.cols) * d.w,
                  Math.floor(pose / d.cols) * d.h,
                  d.w,
                  d.h,
                  i * d.w,
                  0,
                  d.w,
                  d.h,
                );
              });
              frame++;
            }, 180);
            box.append(anim);
          }
          result.push({
            id,
            night,
            frames: 4 * poses,
            w: d.w,
            h: d.h,
            atlas: [img.width, img.height],
            minOpaque: Math.min(...counts),
            clipped: 0,
          });
        }
        document.body.append(box);
      }
      return result;
    },
    { base, manifest },
  );
  for (const id of Object.keys(manifest.atlases))
    await p.locator('#' + id).screenshot({ path: out + '/' + id + '.png' });
  await p.screenshot({ path: out + '/boss-gallery.png', fullPage: true });
  writeFileSync(out + '/report.json', JSON.stringify({ sourceHash: manifest.sourceHash, models: report }, null, 2));
  await p.route('**/art/bestiary/primordial_dragon-day.png', (route) => route.abort());
  await p.evaluate(async () => {
    const { bestiaryFrame } = await import('/src/art/bestiary-atlases.ts');
    bestiaryFrame('primordial_dragon', false, 0, 'idle', 0);
  });
  await p.waitForFunction(
    async () => {
      const m = await import('/src/art/bestiary-atlases.ts');
      const t = m.bestiaryFrame('primordial_dragon', false, 0, 'idle', 0);
      return m.bestiaryAtlasStats().failed === 1 && t.width > 100 && t.source.width <= 64;
    },
    null,
    { timeout: 30000 },
  );
  writeFileSync(
    out + '/report.json',
    JSON.stringify({ sourceHash: manifest.sourceHash, models: report, blockedAtlasFallback: true }, null, 2),
  );
  console.log(
    'PASS authored boss poses, four distinct facings, hard transparency, anchors, 2048px texture budget and no clipping:',
    report.length,
  );
} finally {
  await b.close();
}
