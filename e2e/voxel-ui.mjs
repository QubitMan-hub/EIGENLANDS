// Orthographic UI models, deterministic object anchors/orientation, and desktop/mobile interaction.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/';
const out = process.argv[3] ?? '/tmp/eigenlands-voxel-ui';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [],
  results = [];
try {
  for (const [device, width, height, touch] of [
    ['desktop', 1280, 800, false],
    ['mobile', 844, 390, true],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
      deviceScaleFactor: 1,
    });
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.error(e.message);
    });
    await page.goto(`${base}?dev=1&hour=12`);
    await page.waitForSelector('#look-title .look-canvas canvas', { state: 'attached' });
    assert.equal(
      await page.locator('#look-title .look-canvas canvas').evaluate((c) => c.width),
      192,
      'Creator renders a voxel rig',
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll('img[data-voxel-icon]')].every((i) => i.naturalWidth === 64),
    );
    assert.ok(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--voxel-timber').includes('data:image/png'),
      ),
      'Panels render actual solid models',
    );
    await page.screenshot({ path: `${out}/${device}-title.png` });
    if (!touch) {
      await page.locator('.look-menu summary').click();
      await page.screenshot({ path: `${out}/creator.png` });
      await page.locator('.look-menu summary').click();
    }
    await page.fill('#name', 'VoxelUI');
    await page.click('#btn-guest');
    await page.waitForFunction(() => window.__eigen?.state().voxel?.focus.frames > 2, null, { timeout: 90000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${out}/${device}-world.png` });
    if (touch) {
      await page.locator('#btn-menu').click();
      await page.locator('#btn-pack').click();
    } else await page.keyboard.press('KeyI');
    await page.waitForSelector('.window:not([hidden]) .portrait-box img');
    await page.waitForFunction(() => document.querySelector('.portrait-box img')?.naturalWidth === 160);
    await page.screenshot({ path: `${out}/${device}-inventory.png` });
    const contrast = await page.evaluate(async () => {
      const lum = (rgb) =>
        rgb
          .map((n) => {
            const v = n / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const sample = async (kind) => {
        const source = getComputedStyle(document.documentElement).getPropertyValue(`--voxel-${kind}`);
        const img = new Image();
        img.src = source.slice(source.indexOf('data:'), source.lastIndexOf(')')).replace(/["']/g, '');
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return [...ctx.getImageData(img.width / 2, img.height / 2, 1, 1).data].slice(0, 3);
      };
      const ratio = async (selector, kind) => {
        const text = getComputedStyle(document.querySelector(selector)).color.match(/\d+/g).slice(0, 3).map(Number);
        const a = lum(text),
          b = lum(await sample(kind));
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
      return { equipment: await ratio('#modal .eqlabel', 'slot'), body: await ratio('#modal .win-body', 'stone') };
    });
    assert.ok(
      contrast.equipment >= 4.5 && contrast.body >= 4.5,
      'Text contrasts with the actual rendered voxel materials',
    );
    const overflow = await page.locator('#modal .window').evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: innerWidth, height: innerHeight };
    });
    assert.ok(overflow.left >= -1 && overflow.right <= width + 1, `${device} inventory fits horizontally`);
    if (!touch) {
      await page.keyboard.press('Escape');
      const inn = await page.evaluate(() => window.__eigen.game.buildings.views.find((v) => v.b.kind === 'inn')?.b);
      if (inn) {
        const x = inn.x + inn.w / 2,
          y = inn.y + inn.h / 2;
        await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
        await page.waitForFunction(
          ([x, y]) =>
            Math.hypot(window.__eigen.state().voxel.focus.x - x, window.__eigen.state().voxel.focus.y - y) < 1,
          [x, y],
          { timeout: 60000 },
        );
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${out}/interior.png` });
      }
    }
    const audit = await page.evaluate(() => {
      const g = window.__eigen.game,
        v = g.voxel;
      const misplaced = [],
        misoriented = [];
      for (const [id, entry] of v.objects) {
        const o = g.store.objects.get(id);
        if (!o) continue;
        if (Math.abs(entry.mesh.position.x - o.x - 0.5) > 1e-6 || Math.abs(entry.mesh.position.z - o.y - 0.5) > 1e-6)
          misplaced.push(id);
        const [, layout] = JSON.parse(entry.signature);
        const swap = layout.facing === 'se' && !(o.sub === 'chair' && layout.seatTurn !== undefined);
        if (Math.abs(entry.mesh.rotation.y - (swap ? Math.PI / 2 : 0)) > 1e-6 || entry.mesh.scale.x !== (swap ? -1 : 1))
          misoriented.push(id);
      }
      return {
        voxel: g.debugState().voxel,
        misplaced,
        misoriented,
        icons: document.querySelectorAll('img[data-voxel-icon]').length,
      };
    });
    assert.deepEqual(audit.misplaced, []);
    assert.deepEqual(audit.misoriented, []);
    assert.deepEqual(audit.voxel.missingModels, []);
    results.push({ device, overflow, contrast, ...audit });
    await page.close();
  }
  assert.deepEqual(errors, [], 'No runtime exceptions');
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log('PASS: desktop/mobile voxel UI, character creator, inventory, interior and authoritative prop placement');
} finally {
  await browser.close();
}
