import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage();
  await p.goto(process.argv[2] ?? 'http://localhost:5174');
  const r = await p.evaluate(async () => {
    const { PixelLabel } = await import('/src/art/pixel-label.ts');
    const { C } = await import('/src/art/shade.ts');
    const first = new PixelLabel('PERSISTENT PLAYER', C.pale),
      shared = new PixelLabel('PERSISTENT PLAYER', C.pale),
      tex = first.texture;
    for (let i = 0; i < 650; i++) new PixelLabel(`TRANSIENT ${i}`, C.pale).destroy();
    const survivedEviction = !tex.destroyed;
    first.destroy({ texture: true, textureSource: true });
    const survivedSharedRelease = !shared.texture.destroyed;
    shared.text = 'UPDATED PLAYER';
    shared.setFill(C.e6);
    const updated = !shared.texture.destroyed && shared.text === 'UPDATED PLAYER';
    shared.destroy();
    return { survivedEviction, survivedSharedRelease, updated };
  });
  assert.deepEqual(r, { survivedEviction: true, survivedSharedRelease: true, updated: true });
  mkdirSync('docs/validation/arrival-garden', { recursive: true });
  writeFileSync('docs/validation/arrival-garden/pixel-label-cache.json', JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r));
} finally {
  await b.close();
}
