import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://localhost:5242/',
  out = process.argv[3] ?? '/tmp/homestead-gameplay';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ready = () =>
    page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
      timeout: 60000,
    });
  const tp = async (x, y) => {
    await page.evaluate(({ x, y }) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), { x, y });
    await page.waitForFunction(
      ({ x, y }) => Math.hypot(window.__eigen.state().x - x, window.__eigen.state().y - y) < 0.2,
      { x, y },
      { timeout: 30000 },
    );
  };
  await page.goto(base + '?dev=1&hour=12');
  await page.waitForSelector('#g-off:not([hidden])');
  await page.fill('#name', 'Homesteader');
  await page.click('#btn-guest');
  await ready();
  const board = await page.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 12;
    return [...g.store.objects.values()].find((o) => o.sub === 'guild_board');
  });
  assert.ok(board, 'a real home-town guild board');
  await tp(board.x + 0.5, board.y + 1.5);
  await page.evaluate((b) => window.__eigen.game.net.open(b.x, b.y), board);
  await page.getByRole('button', { name: 'Sign the Wayfarer Oath', exact: true }).click();
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.quests['guild:rank:F']?.state === 'done');
  await page.screenshot({ path: out + '/registered.png' });
  await page.keyboard.press('Escape');
  const site = await page.evaluate(() => {
    const s = window.__eigen.game.store;
    for (let y = 100; y < 400; y += 3)
      for (let x = 100; x < 400; x += 3) {
        let ok = true;
        const level = s.levelAt(x, y);
        for (let dy = 0; dy < 3; dy++)
          for (let dx = 0; dx < 3; dx++)
            if (
              s.solidAt(x + dx, y + dy) ||
              s.objectAt(x + dx, y + dy) ||
              s.levelAt(x + dx, y + dy) !== level ||
              ![2, 3, 4, 5, 9, 10].includes(s.getTile(x + dx, y + dy))
            )
              ok = false;
        if (ok) return { x, y };
      }
    return null;
  });
  assert.ok(site, 'clear generated ranch land');
  await tp(site.x + 0.5, site.y + 0.5);
  await page.evaluate(() => {
    const n = window.__eigen.game.net;
    n.dev({ cmd: 'give', id: 'barn', n: 1 });
    n.dev({ cmd: 'give', id: 'hay', n: 12 });
    n.dev({ cmd: 'coins', n: 3000 });
  });
  await page.waitForFunction(
    () => window.__eigen.game.gameplay.profile.count('barn') > 0 && window.__eigen.game.gameplay.profile.coins >= 2400,
  );
  await page.evaluate((s) => {
    const g = window.__eigen.game;
    g.net.use({ slot: g.gameplay.profile.inv.findIndex((i) => i?.id === 'barn'), tx: s.x + 1, ty: s.y, turn: 0 });
  }, site);
  await page.waitForFunction((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y)?.kind === 'shelter', site, {
    timeout: 20000,
  });
  await page.evaluate((s) => window.__eigen.game.net.open(s.x + 1, s.y), site);
  await page.getByText('Adopt or breed livestock', { exact: true }).click();
  await page.getByRole('button', { name: 'Adopt Cow · 520 coins', exact: true }).click();
  await page.waitForFunction((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y)?.data?.herd?.length === 1, site);
  await page.getByRole('button', { name: 'Brush & care', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Feed 1 hay/ }).click();
  await page.waitForFunction((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y)?.data?.fed === true, site);
  await page.screenshot({ path: out + '/managed-herd.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out + '/ranch-world.png' });
  await page.reload();
  await ready();
  await page.waitForFunction((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y)?.data?.herd?.length === 1, site, {
    timeout: 30000,
  });
  assert.equal(await page.evaluate(() => window.__eigen.game.gameplay.profile.quests['guild:rank:F']?.state), 'done');
  assert.equal(await page.evaluate((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y)?.data?.fed, site), true);
  assert.deepEqual(errors, []);
  console.log(
    'PASS live guild oath, placed barn, adoption, care, feeding, world art and saved herd/guild identity after reload',
  );
} finally {
  await browser.close();
}
