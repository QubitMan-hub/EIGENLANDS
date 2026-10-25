import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = '/tmp/eigenlands-ui-overhaul';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const errors = [];
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 720 },
      hasTouch: mobile,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}labs/uilab.html?panel=inventory`);
    await page.waitForSelector('.inv-grid .slot');
    await page.locator('.win-x').focus();
    await page.keyboard.press('Shift+Tab');
    assert.ok(await page.evaluate(() => document.querySelector('#modal').contains(document.activeElement)));
    await page.keyboard.press('Tab');
    assert.ok(await page.locator('.win-x').evaluate((e) => e === document.activeElement));
    await page.getByRole('searchbox', { name: 'Search inventory' }).fill('healing');
    assert.equal(await page.locator('.inv-grid .slot').count(), 1);
    assert.equal(await page.locator('.inv-grid .slot').getAttribute('data-i'), '21');
    await page.locator('.inv-grid .slot').click();
    await page.getByRole('button', { name: 'Use item', exact: true }).waitFor();
    await page.getByRole('searchbox').fill('missing thing');
    await page.getByText('No items match.', { exact: false }).waitFor();
    await page.getByRole('searchbox').fill('');
    await page.getByRole('combobox', { name: 'Inventory order' }).selectOption('name');
    assert.deepEqual(
      await page
        .locator('.inv-grid')
        .first()
        .locator('.slot')
        .evaluateAll((ns) => ns.map((e) => e.dataset.i)),
      Array.from({ length: 10 }, (_, i) => String(i)),
    );
    await page.getByRole('combobox', { name: 'Item category' }).selectOption('equipment');
    assert.equal(await page.locator('.inv-grid .slot[data-i="10"]').count(), 0);
    await page.getByRole('combobox', { name: 'Item category' }).selectOption('all');
    await page.locator('.slot[data-i="19"]').click();
    await page.getByRole('combobox', { name: 'Replace ring slot' }).selectOption('ring1');
    await page.getByRole('table', { name: 'Equipment comparison' }).waitFor();
    assert.match(await page.locator('.inv-comparison').innerText(), /HP bonus/);
    assert.match(await page.locator('.inv-comparison').innerText(), /−12/);
    await page.getByRole('button', { name: 'Equip item', exact: true }).waitFor();
    const rect = await page.locator('.window').boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= (mobile ? 844 : 1280));
    await page.getByRole('table', { name: 'Equipment comparison' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${mobile ? 'landscape' : 'desktop'}-pack.png` });
    await page.keyboard.press('Escape');
    await page.locator('#modal').waitFor({ state: 'hidden' });
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 500 } });
  await page.goto(
    `${base}labs/artlab.html?lab=sprite&kind=deco&subs=stairs_up,stairs_down,dive_gate,dive_exit,coral_column,sea_cache&scale=3`,
  );
  await page.waitForFunction(() => window.__lab?.ready);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${out}/realm-props.png` });
  const bounds = await page.evaluate(async () => {
    const { worldObjDef } = await import('/src/art/worldobjs.ts');
    const result = [];
    for (const sub of ['stairs_up', 'stairs_down', 'dive_gate', 'dive_exit', 'coral_column', 'sea_cache']) {
      const frame = worldObjDef({ x: 0, y: 0, kind: 'deco', sub }).frames[0];
      const tex = frame.tex,
        r = tex.frame,
        data = tex.source.resource.getContext('2d').getImageData(r.x, r.y, r.width, r.height).data;
      let edge = 0;
      for (let y = 0; y < r.height; y++)
        for (let x = 0; x < r.width; x++)
          if ((!x || !y || x === r.width - 1 || y === r.height - 1) && data[(y * r.width + x) * 4 + 3]) edge++;
      if (edge) result.push({ sub, edge });
    }
    return result;
  });
  assert.deepEqual(bounds, [], 'Projected artwork has a transparent margin');
  assert.deepEqual(errors, []);
  console.log(
    'Desktop and landscape inventory: search, categories, stable quick-bar, sort, item actions, focus loop and window bounds passed; realm prop bounds passed.',
  );
} finally {
  await browser.close();
}
