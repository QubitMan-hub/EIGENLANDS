import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://127.0.0.1:5174/labs/artlab.html?lab=icons');
  await p.waitForFunction(() => window.__lab?.ready);
  const result = await p.evaluate(async () => {
    const ids = [
      'roast_potato',
      'veggie_stew',
      'berry_jam',
      'fruit_pie',
      'fish_fry',
      'grilled_meat',
      'pumpkin_soup',
      'omelet',
      'hearty_stew',
      'baked_yam',
      'qubit_tea',
      'healing_potion',
      'regen_potion',
      'might_potion',
      'ward_potion',
      'lantern_potion',
    ];
    const imgs = [...document.images].filter((i) => ids.includes(i.parentElement.textContent.trim()));
    for (const i of document.images) if (!imgs.includes(i)) i.parentElement.style.display = 'none';
    for (const i of imgs) {
      i.style.width = '32px';
      i.style.height = '32px';
      const small = i.cloneNode();
      small.style.width = '16px';
      small.style.height = '16px';
      i.after(small);
    }
    const { itemIconCanvas } = await import('/src/art/icons.ts');
    const fail = [];
    for (const id of ids) {
      const c = itemIconCanvas(id),
        a = c.getContext('2d').getImageData(0, 0, 16, 16).data;
      let n = 0;
      for (let i = 3; i < a.length; i += 4) if (a[i]) n++;
      if (n < 30 || c.width !== 16 || c.height !== 16 || itemIconCanvas(id) !== c) fail.push(id);
    }
    return { count: imgs.length, unique: new Set(imgs.map((i) => i.src)).size, fail };
  });
  assert.equal(result.count, 16);
  assert.equal(result.unique, 16);
  assert.deepEqual(result.fail, []);
  assert.deepEqual(errors, []);
  await p.screenshot({ path: '/tmp/food-icons.png' });
  console.log('Sixteen distinct native food/potion icons, cached canvases and 16/32px gallery passed');
} finally {
  await b.close();
}
