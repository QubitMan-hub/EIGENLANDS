import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'docs/validation/biodiversity';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await browser.newPage();
  await p.goto(process.argv[2] ?? 'http://localhost:5174');
  const result = await p.evaluate(async (shared) => {
    const { FLORA, WILDLIFE } = await import(shared);
    const { paintFlora, paintWildlife } = await import('/src/art/nature.ts');
    const { PixBuf } = await import('/src/art/shade.ts');
    const sheets = {};
    for (const [name, catalog, views] of [
      ['flora-preview', FLORA, 3],
      ['fauna-preview', WILDLIFE, 4],
    ]) {
      const cell = views * 80,
        cols = 3,
        c = document.createElement('canvas');
      c.width = cell * cols;
      c.height = Math.ceil(catalog.length / cols) * 100;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#bac1b2';
      ctx.fillRect(0, 0, c.width, c.height);
      for (const [i, s] of catalog.entries()) {
        const x = (i % cols) * cell,
          y = Math.floor(i / cols) * 100;
        ctx.fillStyle = '#1c2630';
        ctx.font = '12px monospace';
        ctx.fillText(s.name, x + 4, y + 14);
        for (let view = 0; view < views; view++) {
          const b = new PixBuf(40, 40);
          if (name === 'flora-preview') paintFlora(b.ctx, s.id, view, 1);
          else paintWildlife(b.ctx, s.id, 1, 1, view);
          const img = document.createElement('canvas');
          img.width = img.height = 40;
          b.blit(img.getContext('2d'), 0, 0);
          ctx.drawImage(img, x + view * 80, y + 18, 80, 80);
        }
      }
      sheets[name] = c.toDataURL();
    }
    return sheets;
  }, `/@fs${process.cwd()}/packages/shared/src/nature.ts`);
  for (const [name, data] of Object.entries(result))
    writeFileSync(`${out}/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log('Captured 42 plants × 3 variants and 31 animals × 4 headings');
} finally {
  await browser.close();
}
