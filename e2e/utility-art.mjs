import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 650 } });
  await p.goto('http://127.0.0.1:5174/labs/artlab.html?lab=icons');
  await p.waitForFunction(() => window.__lab?.ready);
  const r = await p.evaluate(async () => {
    const ids = ['carp', 'perch', 'trout', 'catfish', 'pike', 'eel'],
      imgs = [...document.images].filter((i) => ids.includes(i.parentElement.textContent.trim()));
    for (const i of document.images) if (!imgs.includes(i)) i.parentElement.style.display = 'none';
    const { HeldWeapons } = await import('/src/art/weapons.ts'),
      art = new HeldWeapons(),
      fail = [];
    for (const id of ['hoe', 'can', 'rod', 'net'])
      for (let d = 0; d < 8; d++)
        for (let f = 0; f < 30; f++) {
          const t = art.texture(id, d, f),
            r = t.frame,
            a = t.source.resource.getContext('2d').getImageData(r.x, r.y, r.width, r.height).data;
          let n = 0,
            edge = 0;
          for (let y = 0; y < r.height; y++)
            for (let x = 0; x < r.width; x++)
              if (a[(y * r.width + x) * 4 + 3]) {
                n++;
                if (!x || !y || x === r.width - 1 || y === r.height - 1) edge++;
              }
          if (n < 12 || edge || art.texture(id, d, f) !== t) fail.push({ id, d, f, n, edge });
        }
    return { fish: imgs.length, unique: new Set(imgs.map((i) => i.src)).size, fail };
  });
  assert.equal(r.fish, 6);
  assert.equal(r.unique, 6);
  assert.deepEqual(r.fail, []);
  await p.screenshot({ path: '/tmp/utility-fish.png' });
  console.log('Six distinct fish icons and 960 utility-tool frame bounds/cache checks passed');
} finally {
  await b.close();
}
