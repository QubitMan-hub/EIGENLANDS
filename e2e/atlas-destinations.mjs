// Authoritative quest/inventory updates and optional real cross-shard party navigation.
import { chromium } from 'playwright-core';
import { tsImport } from 'tsx/esm/api';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5174/',
  peers = process.argv.includes('--peers');
const out = `/tmp/eigenlands-atlas-destinations-${new URL(base).port}`;
mkdirSync(out, { recursive: true });
const { townFor, townsFor } = await tsImport('../packages/shared/src/town.ts', import.meta.url);
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
const login = async (page, name) => {
  await page.goto(`${base}?dev=1&hour=12`);
  await page.waitForSelector('#g-off:not([hidden])', { timeout: 60000 });
  await page.fill('#name', name);
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
  await page.evaluate(() => (window.__eigen.game.app.ticker.maxFPS = 10));
  for (let i = 0; i < 2 && (await page.locator('.p3-lumen-skip').isVisible()); i++)
    await page.locator('.p3-lumen-skip').click();
};
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 800 },
      hasTouch: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const name = `Map${Date.now().toString(36)}`;
    await login(page, name);
    await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'quest', id: 'welcome', action: 'start' }));
    await page.waitForFunction(() => window.__eigen.game.gameplay.profile.quests.welcome?.state === 'active');
    await page.keyboard.press('KeyM');
    await page.getByRole('dialog', { name: 'World atlas' }).waitFor();
    const quests = page
      .locator('.atlas-directory')
      .filter({ has: page.locator('summary', { hasText: 'Quest destinations' }) });
    assert.equal(await quests.getAttribute('open'), null, 'Directory starts collapsed');
    await quests.locator('summary').focus();
    await page.keyboard.press('Space');
    assert.notEqual(await quests.getAttribute('open'), null, 'Space opens a directory');
    await page.keyboard.press('Enter');
    assert.equal(await quests.getAttribute('open'), null, 'Enter closes a directory');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__eigen.game.ext.atlas.destinations.quests.length === 3);
    assert.equal(await quests.locator('button:enabled').count(), 0, 'Uncharted quest destinations have no coordinates');
    const seed = await page.evaluate(() => window.__eigen.game.seed),
      town = townFor(seed),
      home = town.spots['carpenter.bed'];
    await page.evaluate((p) => window.__eigen.game.net.dev({ cmd: 'tp', x: p.x + 0.5, y: p.y + 0.5 }), home);
    await page.waitForFunction(
      () => !!window.__eigen.game.ext.atlas.destinations.quests.find((p) => p.id === 'welcome:0')?.point,
      null,
      { timeout: 40000 },
    );
    const odo = quests.getByRole('button', { name: /A Warm Welcome.*Odo/ });
    await odo.click();
    assert.ok(
      await page.evaluate(() => {
        const a = window.__eigen.game.ext.atlas,
          p = a.destinations.quests.find((p) => p.id === 'welcome:0').point;
        return Math.hypot(a.centre.x - p.x, a.centre.y - p.y) < 2;
      }),
    );
    const chunks = await page.evaluate(() => window.__eigen.state().chunks);
    await odo.click();
    await page.waitForTimeout(400);
    assert.equal(
      await page.evaluate(() => window.__eigen.state().chunks),
      chunks,
      'Navigation reads the chart without generating terrain',
    );
    const modal = await page.locator('#modal .window').boundingBox();
    assert.ok(modal.x >= 0 && modal.x + modal.width <= (mobile ? 844 : 1280));
    assert.ok(await quests.evaluate((e) => e.scrollWidth <= e.clientWidth), 'Directory does not overflow horizontally');
    if (!process.argv.includes('--no-shots')) {
      await quests.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/${mobile ? 'landscape' : 'desktop'}-quests.png` });
    }
    await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'quest', id: 'welcome', action: 'done' }));
    await page.waitForFunction(() => window.__eigen.game.ext.atlas.destinations.quests.length === 0);
    await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'quest', id: 'timber', action: 'start' }));
    await page.waitForFunction(() =>
      window.__eigen.game.ext.atlas.destinations.quests.some((p) => p.id === 'timber:0'),
    );
    await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'give', id: 'wood', n: 12 }));
    await page.waitForFunction(() =>
      window.__eigen.game.ext.atlas.destinations.quests.some((p) => p.id === 'timber:return'),
    );
    await quests.getByRole('button', { name: /Return to Odo/ }).waitFor();
    console.log(mobile ? 'Landscape' : 'Desktop', 'quest discovery, live inventory hand-in and completion passed');
    if (peers && !mobile) {
      await page.evaluate(() => window.__eigen.game.app.ticker.stop());
      const other = await browser.newContext({ viewport: { width: 844, height: 540 } }),
        b = await other.newPage(),
        friend = `Ally${Date.now().toString(36)}`;
      await login(b, friend);
      await page.evaluate(() => window.__eigen.game.app.ticker.start());
      await page.evaluate((name) => window.__eigen.game.net.send('p4_party', { action: 'invite', name }), friend);
      await b.locator('.prompt.party button.primary').click();
      await page.bringToFront();
      await page.waitForFunction(() => window.__eigen.game.ext.atlas.destinations.party.length === 1);
      const party = page
        .locator('.atlas-directory')
        .filter({ has: page.locator('summary', { hasText: 'Party destinations' }) });
      await party.locator('summary').click();
      const port = townsFor(seed)[1]; // Lumenport's authored plaza is safe, unlike an arbitrary ocean coordinate.
      await b.evaluate((p) => {
        window.__eigen.game.net.dev({ cmd: 'level', level: 40 });
        window.__eigen.game.net.dev({ cmd: 'tp', x: p.cx + 0.5, y: p.cy + 0.5 });
      }, port);
      await b.waitForFunction((x) => window.__eigen.state().x > x, port.cx, { timeout: 40000 });

      await page.waitForFunction((x) => window.__eigen.game.ext.atlas.destinations.party[0]?.point?.x > x, port.cx, {
        timeout: 40000,
      });
      const button = party.getByRole('button', { name: friend, exact: true });
      await button.focus();
      await b.evaluate((p) => window.__eigen.game.net.dev({ cmd: 'tp', x: p.cx + 1.5, y: p.cy + 0.5 }), port);
      await page.waitForFunction((x) => window.__eigen.game.ext.atlas.destinations.party[0]?.point?.x > x, port.cx + 1);
      assert.equal(
        await button.evaluate((e) => document.activeElement === e),
        true,
        'Position updates preserve keyboard focus',
      );
      await button.click();
      const privacy = await page.evaluate(() => {
        const a = window.__eigen.game.ext.atlas,
          p = a.destinations.party[0].point;
        return {
          same: Math.hypot(a.centre.x - p.x, a.centre.y - p.y) < 2,
          hidden: a.journal.tile(p.x, p.y) === undefined,
          persisted: JSON.stringify(localStorage.getItem(a.key)).includes(a.destinations.party[0].title),
        };
      });
      assert.equal(privacy.same, true);
      assert.equal(privacy.hidden, true, 'Party navigation does not chart remote terrain');
      assert.equal(privacy.persisted, false);
      await page.waitForFunction(
        () => {
          const c = document.querySelector('.atlas-canvas');
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < d.length; i += 4) if (d[i] === 187 && d[i + 1] === 164 && d[i + 2] === 239) return true;
          return false;
        },
        null,
        { timeout: 30000 },
      );
      if (!process.argv.includes('--no-shots')) await page.screenshot({ path: `${out}/desktop-party.png` });
      await page.getByRole('checkbox', { name: 'Party markers', exact: true }).uncheck();
      await other.close();
      await page.waitForFunction(() => !window.__eigen.game.ext.atlas.destinations.party[0]?.point, null, {
        timeout: 40000,
      });
      assert.equal(await button.isDisabled(), true, 'Offline member loses its navigable position');
      await page.evaluate(() => window.__eigen.game.net.send('p4_party', { action: 'leave' }));
      await page.waitForFunction(() => window.__eigen.game.ext.atlas.destinations.party.length === 0);
      await page.keyboard.press('Escape');
      await page.reload();
      await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
      await page.keyboard.press('KeyM');
      assert.equal(await page.getByRole('checkbox', { name: 'Party markers', exact: true }).isChecked(), false);
      console.log(
        'Real cross-shard party authorization, focus, latest position, fog isolation, offline/leave and marker preference passed',
      );
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Atlas destination checks passed', out);
} catch (e) {
  for (const [i, c] of browser.contexts().entries())
    for (const p of c.pages()) {
      await p.screenshot({ path: `${out}/failure-${i}.png` }).catch(() => {});
      console.error(
        'Failure state',
        await p
          .evaluate(() => ({
            x: window.__eigen?.state().x,
            shard: window.__eigen?.state().shard,
            party: window.__eigen?.game.ext.social.partyState,
          }))
          .catch(() => null),
      );
    }
  throw e;
} finally {
  await browser.close();
}
