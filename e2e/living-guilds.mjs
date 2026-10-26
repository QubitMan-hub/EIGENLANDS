import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://localhost:5242/',
  out = process.argv[3] ?? '/tmp/living-guilds-gameplay';
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
  await page.getByRole('button', { name: 'Adopt Horse · 900 coins', exact: true }).click();
  await page.waitForFunction((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y)?.data?.herd?.length === 1, site);
  await page.getByRole('button', { name: 'Brush & care', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Feed 1 hay/ }).click();
  await page.waitForFunction((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y)?.data?.fed === true, site);
  await page.screenshot({ path: out + '/managed-herd.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out + '/ranch-world.png' });

  // Grow and care for the actual saved horse, rather than injecting mount state into the renderer.
  for (let i = 0; i < 5; i++) {
    const before = await page.evaluate((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y).data.lastDay, site);
    await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'time', offsetMs: 24 * 60 * 1000 }));
    await page.waitForFunction(
      ({ s, before }) => window.__eigen.game.store.objectAt(s.x + 1, s.y).data.lastDay > before,
      { s: site, before },
      { timeout: 30000 },
    );
    await page.evaluate((s) => window.__eigen.game.net.open(s.x + 1, s.y), site);
    await page.getByRole('button', { name: 'Brush & care', exact: true }).click();
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: /^Feed 1 hay/ }).click();
    await page.waitForFunction((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y).data.fed === true, site);
    await page.keyboard.press('Escape');
  }
  await page.evaluate((s) => window.__eigen.game.net.open(s.x + 1, s.y), site);
  await page.getByRole('button', { name: 'Train mount · 100 coins + 5 hay', exact: true }).click();
  await page.getByRole('button', { name: 'Saddle up', exact: true }).click();
  await page.waitForFunction(() => window.__eigen.game.predictor.sim.mount === 1);
  await page.keyboard.press('Escape');
  assert.match(await page.evaluate(() => window.__eigen.game.gameplay.prompt().label ?? ''), /Dismount/);
  await page.waitForTimeout(600);
  await tp(site.x + 0.5, site.y + 2.5);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/mounted-horse.png' });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__eigen.game.predictor.sim.mount === 0);
  // Accept and resolve an investigation through the real board, objects and choice UI.
  await tp(board.x + 0.5, board.y + 1.5);
  await page.evaluate((b) => window.__eigen.game.net.open(b.x, b.y), board);
  const card = page.locator('.guild-contract').filter({ hasText: 'Inspect three physical clues' });
  await card.getByRole('button', { name: 'Accept commission', exact: true }).click();
  await page.waitForFunction(() =>
    Object.values(window.__eigen.game.gameplay.profile.quests).some((q) => q.journey?.kind === 'investigate'),
  );
  const job = await page.evaluate(() =>
    Object.entries(window.__eigen.game.gameplay.profile.quests)
      .find(([id, q]) => q.journey?.kind === 'investigate')
      .map((v, i) => (i === 1 ? v.journey : v)),
  );
  await page.keyboard.press('Escape');
  for (const point of job[1].points) {
    await tp(point.x, point.y);
    await page.waitForFunction(
      (p) => window.__eigen.game.store.objectAt(Math.floor(p.x), Math.floor(p.y))?.sub === 'guild_clue',
      point,
      { timeout: 15000 },
    );
    await page.evaluate((p) => window.__eigen.game.net.open(Math.floor(p.x), Math.floor(p.y)), point);
    await page.waitForSelector('.guild-ledger');
    if (point !== job[1].points[2]) await page.keyboard.press('Escape');
  }
  const text = await page.locator('.guild-ledger p').first().innerText(),
    answer = ['Mira', 'Tamsin', 'Hale'].find((n) => text.includes(n));
  assert.ok(answer, 'physical seal evidence names a suspect');
  await page.getByRole('button', { name: 'Accuse ' + answer, exact: true }).click();
  await page.getByRole('button', { name: 'Seek restitution', exact: true }).click();
  await page.waitForFunction((id) => window.__eigen.game.gameplay.profile.quests[id]?.progress[0] === 1, job[0]);
  await page.screenshot({ path: out + '/resolved-investigation.png' });
  await page.keyboard.press('Escape');
  await tp(site.x + 0.5, site.y + 0.5);
  await page.reload();
  await ready();
  await page.waitForFunction((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y)?.data?.herd?.length === 1, site, {
    timeout: 30000,
  });
  assert.equal(await page.evaluate(() => window.__eigen.game.gameplay.profile.quests['guild:rank:F']?.state), 'done');
  assert.equal(await page.evaluate((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y)?.data?.fed, site), true);
  assert.deepEqual(errors, []);
  assert.equal(
    await page.evaluate((s) => window.__eigen.game.store.objectAt(s.x + 1, s.y)?.data?.herd?.[0]?.trained, site),
    true,
  );
  console.log(
    'PASS live mount training/riding/Space dismount, physical investigation and choices, saved horse and guild identity',
  );
} finally {
  await browser.close();
}
