import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = 'docs/validation/reference-fidelity';
const phase = process.argv[3] ?? 'after';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(process.argv[2] ?? 'http://localhost:5174/');
  const result = await p.evaluate(async () => {
    const { renderPersonCanvas, renderNpcCanvas, OUTFITS, NPC_LOOKS, PERSON_W, PERSON_H } =
      await import('/src/art/actors.ts');
    const { buildBuildingArt } = await import('/src/art/buildings.ts');
    const { townFor } = await import('/@fs/workspace/EIGENLANDS/packages/shared/src/town.ts');
    document.body.replaceChildren();
    document.body.style.cssText =
      'margin:12px;background:#354346;color:#f7e7c8;font:16px monospace;overflow:auto;height:auto';
    document.documentElement.style.cssText = 'overflow:auto;height:auto';
    const looks = [...OUTFITS.slice(0, 4), ...Object.values(NPC_LOOKS).slice(0, 8)];
    const metrics = [];
    const canvas = document.createElement('canvas');
    canvas.width = 8 * PERSON_W * 3;
    canvas.height = looks.length * PERSON_H * 3;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    for (let i = 0; i < looks.length; i++) {
      for (let d = 0; d < 8; d++) {
        const frame = (i < 4 ? renderPersonCanvas : renderNpcCanvas)(looks[i], d, 0);
        c.drawImage(frame, d * PERSON_W * 3, i * PERSON_H * 3, PERSON_W * 3, PERSON_H * 3);
        const px = frame.getContext('2d').getImageData(0, 0, PERSON_W, PERSON_H).data;
        let x0 = PERSON_W,
          y0 = PERSON_H,
          x1 = -1,
          y1 = -1,
          area = 0;
        for (let y = 0; y < PERSON_H; y++)
          for (let x = 0; x < PERSON_W; x++) {
            if (px[(y * PERSON_W + x) * 4 + 3]) {
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
              area++;
            }
          }
        metrics.push({ look: i, dir: d, width: x1 - x0 + 1, height: y1 - y0 + 1, area });
      }
    }
    document.body.append(canvas);
    const houses = document.createElement('canvas');
    houses.width = 1200;
    houses.height = 900;
    const h = houses.getContext('2d');
    h.imageSmoothingEnabled = false;
    const sample = townFor(1).buildings.find((b) => b.kind === 'house') ?? townFor(1).buildings[0];
    for (let i = 0; i < 6; i++) {
      const b = {
        ...sample,
        id: `art-${i}`,
        x: i * 17,
        y: i * 11,
        w: 7,
        h: 6,
        style: i < 4 ? i : i === 4 ? 4 : 6,
        kind: 'house',
        doorX: i * 17 + 3,
        doorY: i * 11 + 5,
        guild: undefined,
      };
      const a = buildBuildingArt(b);
      const walls = a.walls.slice().sort((a, b) => a.tx + a.ty - (b.tx + b.ty));
      const x0 = Math.min(a.roof.x, ...walls.map((w) => w.x));
      const y0 = Math.min(a.roof.y, ...walls.map((w) => w.y));
      const x1 = Math.max(a.roof.x + a.roof.tex.width, ...walls.map((w) => w.x + w.day.width));
      const y1 = Math.max(a.roof.y + a.roof.tex.height, ...walls.map((w) => w.y + w.day.height));
      const ox = (i % 3) * 400 + (400 - (x1 - x0) * 1.5) / 2 - x0 * 1.5;
      const oy = Math.floor(i / 3) * 450 + 50 - y0 * 1.5;
      for (const w of walls)
        h.drawImage(w.day.source.resource, ox + w.x * 1.5, oy + w.y * 1.5, w.day.width * 1.5, w.day.height * 1.5);
      h.drawImage(
        a.roof.tex.source.resource,
        ox + a.roof.x * 1.5,
        oy + a.roof.y * 1.5,
        a.roof.tex.width * 1.5,
        a.roof.tex.height * 1.5,
      );
      h.fillStyle = '#f7e7c8';
      h.font = '16px monospace';
      h.fillText(`House material ${i + 1}`, (i % 3) * 400 + 20, Math.floor(i / 3) * 450 + 30);
    }
    return { metrics, characters: canvas.toDataURL(), houses: houses.toDataURL() };
  });
  for (const kind of ['characters', 'houses'])
    writeFileSync(`${out}/${phase}-${kind}.png`, Buffer.from(result[kind].split(',')[1], 'base64'));
  writeFileSync(`${out}/${phase}.json`, JSON.stringify(result.metrics, null, 2));
  assert.equal(result.metrics.length, 96);
  console.log(`Captured ${phase}: 96 directional people and six working-building exteriors`);
} finally {
  await browser.close();
}
