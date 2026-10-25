// Requires the multiplayer dev server with DEV_COMMANDS=1; exercises real shard handoffs.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = '/tmp/eigenlands-coastal-play';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ],
});
try {
  const errors = [],
    pages = [];
  for (const prefix of ['DockA', 'DockB']) {
    const name = prefix + Date.now().toString(36).slice(-5);
    const context = await browser.newContext({ viewport: { width: 844, height: 540 } });
    await context.addInitScript(() =>
      localStorage.setItem('eigen.settings', JSON.stringify({ reducedMotion: true, muted: true })),
    );
    const page = await context.newPage();
    pages.push(page);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`${base}?dev=1&hour=12`);
    await page.waitForSelector('#g-off:not([hidden])');
    await page.fill('#name', name);
    await page.click('#btn-guest');
    await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
    if (await page.locator('.p3-lumen-skip').isVisible()) {
      await page.locator('.p3-lumen-skip').click();
      await page.locator('.p3-lumen-skip').click();
    }
    await page.evaluate(() => {
      const g = window.__eigen.game;
      g.net.dev({ cmd: 'level', level: 10 });
      g.net.dev({ cmd: 'tp', x: 512.5, y: 0.5 });
    });
    await page.waitForFunction(
      () => window.__eigen.state().shard === '2,0' && Math.abs(window.__eigen.state().x - 512.5) < 1,
      null,
      { timeout: 30000 },
    );
    await page.waitForFunction(() => window.__eigen.state().npcs.some((n) => n.id.startsWith('lumenport_')), null, {
      timeout: 30000,
    });
    assert.ok(
      await page.evaluate(() => window.__eigen.state().npcs.every((n) => n.id.startsWith('lumenport_'))),
      'Port shard owns its residents',
    );
  }
  const [a, b] = pages;
  const id = await a.evaluate(() => {
    const g = window.__eigen.game,
      i = g.gameplay.profile.inv.findIndex((s) => s?.id === 'pickaxe');
    if (i < 0 || i > 9) throw new Error('starter pickaxe must be in the hotbar');
    g.gameplay.hotbar.select(i);
    return g.myId;
  });
  await b.waitForFunction((id) => window.__eigen.game.interp.sample(id, 1e20)?.pose.held === 'pickaxe', id, {
    timeout: 30000,
  });
  await b.waitForFunction((id) => window.__eigen.game.views.get(id)?.held?.visible, id);
  await a.evaluate(() => {
    const g = window.__eigen.game,
      n = g.debugState().npcs.find((n) => n.id === 'lumenport_0');
    if (!n) throw new Error('guild shopkeeper missing');
    g.net.dev({ cmd: 'tp', x: n.x + 1, y: n.y });
  });
  await a.waitForTimeout(400);
  await a.evaluate(() => window.__eigen.game.net.send('talk', { npcId: 'lumenport_0' }));
  await a.waitForSelector('.dialogue[data-npc="lumenport_0"]');
  await a.screenshot({ path: `${out}/lumenport-dialogue.png` });
  await a.reload();
  await a.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.state().shard === '2,0', null, {
    timeout: 60000,
  });
  assert.ok(
    Math.abs((await a.evaluate(() => window.__eigen.state().x)) - 512) < 70,
    'Coastal save resumes in its shard',
  );
  assert.deepEqual(errors, []);
  console.log(
    'Coastal multiplayer: two real shard handoffs, resident ownership, remote held tool, dialogue and reload passed',
  );
} finally {
  await browser.close();
}
