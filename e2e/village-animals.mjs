import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'docs/validation/village-animals';
mkdirSync(out, { recursive: true });
import { chromium } from 'playwright-core';
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } });
  await p.goto(process.argv[2] ?? 'http://localhost:5174');
  const r = await p.evaluate(async () => {
    const { villageModel } = await import('/src/art/village-animals.ts');
    const { renderModel } = await import('/src/art/voxel.ts');
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 576;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#bac1b2';
    ctx.fillRect(0, 0, 640, 576);
    ctx.imageSmoothingEnabled = false;
    const clipped = [];
    const hashes = [];
    for (const [k, kind] of ['cat', 'dog', 'chicken', 'pigeon'].entries())
      for (let f = 0; f < 4; f++)
        for (let h = 0; h < 4; h++) {
          const a = renderModel(villageModel(kind, f), h, 40, 36, 20, 28).canvas,
            ac = a.getContext('2d'),
            d = ac.getImageData(0, 0, 40, 36).data;
          let n = 0;
          for (let y = 0; y < 36; y++)
            for (let x = 0; x < 40; x++)
              if (d[(y * 40 + x) * 4 + 3]) {
                n++;
                if (x === 0 || y === 0 || x === 39 || y === 35) clipped.push([kind, f, h, x, y]);
              }
          if (!n) throw Error('Empty animal');
          hashes.push(a.toDataURL());
          ctx.drawImage(a, h * 160 + (f % 2) * 80, k * 144 + Math.floor(f / 2) * 72, 80, 72);
        }
    document.body.replaceChildren(c);
    document.body.style.margin = '0';
    return { frames: hashes.length, distinct: new Set(hashes).size, clipped };
  });
  assert.equal(r.frames, 64);
  assert.equal(r.distinct, 64);
  assert.deepEqual(r.clipped, []);
  await p.screenshot({ path: `${out}/directions.png` });
  writeFileSync(`${out}/frames.json`, JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r));
} finally {
  await b.close();
}
