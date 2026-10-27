import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:5244/',
  out = process.argv[3] ?? '/tmp/guild-halls-play';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '?dev=1&hour=12');
  await page.evaluate(() => localStorage.setItem('eigen.tutorial2', '["all"]'));
  await page.reload();
  await page.fill('#name', 'Guild Wayfinder');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  const tp = async (x, y) => {
    await page.evaluate(({ x, y }) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), { x, y });
    await page.waitForFunction(
      ({ x, y }) => Math.hypot(window.__eigen.state().x - x, window.__eigen.state().y - y) < 0.2,
      { x, y },
      { timeout: 30000 },
    );
  };
  const board = await page.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 15;
    return [...g.store.objects.values()].find((o) => o.sub === 'guild_board');
  });
  assert(board);
  await tp(board.x + 0.5, board.y + 1.5);
  const open = () => page.evaluate((b) => window.__eigen.game.net.open(b.x, b.y), board);
  await open();
  await page.getByRole('button', { name: 'Sign the Wayfarer Oath', exact: true }).click();
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.quests['guild:rank:F']?.state === 'done');
  await page
    .locator('.guild-contract')
    .filter({ hasText: 'Daily commission' })
    .first()
    .getByRole('button', { name: 'Accept commission', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Object.entries(window.__eigen.game.gameplay.profile.quests).some(
        ([id, s]) => id.startsWith('guild:job:') && s.state === 'active',
      ),
    null,
    { timeout: 30000 },
  );
  const active = page.locator('.guild-contract').filter({ hasText: 'Accepted expedition' }).first();
  await active.getByRole('button', { name: 'Track commission', exact: true }).click();
  assert((await page.evaluate(() => window.__eigen.game.ext.atlas.trackedQuest())).startsWith('guild:job:'));
  await page.screenshot({ path: out + '/ledger-desktop.png' });
  await active.getByRole('button', { name: 'Show on map', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__eigen.game.gameplay.wins?.name === 'atlas' ||
      document.querySelector('#window-title')?.textContent === 'World atlas',
  );
  const guildDirectory = page
    .locator('.atlas-directory')
    .filter({ has: page.locator('summary').filter({ hasText: 'Guild halls' }) });
  await guildDirectory.locator('summary').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.atlas-directory button')].some(
      (e) => e.textContent.includes('Hadamere') && e.textContent.includes('Guild'),
    ),
  );
  await page.screenshot({ path: out + '/atlas-guilds.png' });
  await page.keyboard.press('Escape');
  await open();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: out + '/ledger-mobile.png' });
  assert.equal(
    await page.evaluate(
      () => document.querySelector('.guild-ledger').scrollWidth > document.querySelector('.guild-ledger').clientWidth,
    ),
    false,
  );
  await page.keyboard.press('Escape');
  const services = await page.evaluate((b) => {
    const s = window.__eigen.game.store;
    const objects = [...s.objects.values()].filter((o) => Math.hypot(o.x - b.x, o.y - b.y) < 10);
    return ['bed', 'workbench'].map((sub) => {
      const o = objects.find((o) => o.sub === sub);
      if (!o) return null;
      const p = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ]
        .map(([dx, dy]) => ({ x: o.x + dx + 0.5, y: o.y + dy + 0.5 }))
        .find((p) => !s.solidAt(Math.floor(p.x), Math.floor(p.y)));
      return { ...o, p };
    });
  }, board);
  assert(
    services.every((s) => s?.p),
    'real reachable bed and workbench',
  );
  for (const o of services) {
    await tp(o.p.x, o.p.y);
    await page.evaluate((o) => window.__eigen.game.net.open(o.x, o.y), o);
    if (o.sub === 'bed') await page.waitForFunction(() => !!window.__eigen.game.gameplay.profile.buffs.bed_rest);
    else {
      await page.waitForSelector('.recipes');
      await page.screenshot({ path: out + '/workbench.png' });
      await page.keyboard.press('Escape');
    }
  }
  await page.reload();
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  assert((await page.evaluate(() => window.__eigen.game.ext.atlas.trackedQuest())).startsWith('guild:job:'));
  assert(await page.evaluate(() => !!window.__eigen.game.gameplay.profile.buffs.bed_rest));
  assert.deepEqual(errors, []);
  console.log(
    'PASS real registration, daily commission, tracker/map, discovered hall directory, mobile layout, bed rest, workbench and saved tracking/rest',
  );
} finally {
  await browser.close();
}
