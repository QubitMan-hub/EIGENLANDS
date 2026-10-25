// Add --labs when using the development server; labs are intentionally absent from production builds.
// Actual progression messages + deterministic encounter presentation fixtures over a real paused world.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/',
  out = process.argv[3] ?? '/tmp/eigenlands-encounters';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 720 },
      hasTouch: mobile,
      reducedMotion: mobile ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const shot = (name) =>
      process.argv.includes('--no-shots')
        ? Promise.resolve()
        : page.screenshot({ path: `${out}/${mobile ? 'landscape' : 'desktop'}-${name}.png` });
    await page.goto(`${base}?dev=1&hour=12`);
    await page.waitForSelector('#g-off:not([hidden])');
    await page.fill('#name', 'Pathfinder');
    await page.click('#btn-guest');
    await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
    for (let i = 0; i < 2 && (await page.locator('.p3-lumen-skip').isVisible()); i++)
      await page.locator('.p3-lumen-skip').click();
    await page.evaluate(() => {
      const n = window.__eigen.game.net;
      n.dev({ cmd: 'level', level: 10 });
      n.dev({ cmd: 'give', id: 'slime_crown', n: 1 });
    });
    await page.waitForFunction(
      () => window.__eigen.state().level === 10 && window.__eigen.game.gameplay.profile.count('slime_crown') === 1,
    );
    await page.click('#btn-journal');
    await page.locator('[data-tab="journey"]').click();
    await page.getByRole('heading', { name: /Level 10/ }).waitFor();
    await page.getByText(/Slime Crown.*1 in pack/).waitFor();
    assert.equal(
      await page.getByRole('progressbar', { name: 'Experience toward next level' }).getAttribute('max'),
      '210',
    );
    await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'level', level: 11 }));
    await page.getByRole('heading', { name: /Level 11/ }).waitFor();
    const modal = await page.locator('#modal .window').boundingBox();
    assert.ok(modal.x >= 0 && modal.x + modal.width <= (mobile ? 844 : 1280));
    await page.getByRole('region', { name: 'Journal pages' }).focus();
    await page.keyboard.press('End');
    await page.waitForFunction(() => document.querySelector('.jbody').scrollTop > 0);
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('.jbody').scrollTop === 0);
    await shot('journey');
    await page.getByRole('heading', { name: 'Boss encounters', exact: true }).scrollIntoViewIfNeeded();
    await shot('journey-encounters');
    await page.getByRole('button', { name: 'Open Circuit Board', exact: true }).click();
    await page.getByRole('dialog', { name: 'Circuit Board', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    // Freeze drawing only. These fixtures exercise the shipped presentation paths, not boss AI/rewards.
    await page.evaluate(() => {
      const g = window.__eigen.game;
      g.app.ticker.stop();
      g.setTarget(null);
      g.targetFrame.update({
        id: 'guard-a',
        name: 'Briar Warden',
        level: null,
        hp: 48,
        maxHp: 64,
        kind: 'enemy',
        faction: 'hostile',
        chips: [
          { id: 'hostile', label: 'Hostile', icon: 'sword', tone: 'warn', desc: 'Attacks on sight.' },
          { id: 'windup', label: 'Striking', icon: 'st_heat', tone: 'warn', desc: 'Preparing a strike.' },
        ],
        poise: 42,
        poiseLabel: 'Poise',
        dist: 7,
      });
    });
    assert.equal(await page.locator('#target-frame').isVisible(), true);
    assert.ok(!(await page.locator('.tf-name').innerText()).includes('Lv'));
    assert.equal(await page.getByRole('progressbar', { name: 'Remaining poise' }).getAttribute('aria-valuenow'), '42');
    assert.equal(await page.locator('#hud-right').isVisible(), false, 'Travel text yields to combat');
    await shot('target');
    await page.evaluate(() => {
      const g = window.__eigen.game,
        p = g.predictor.sim;
      g.ext.adventure.onState({
        enemies: new Map([
          ['slime', { kind: 10, hp: 100, maxHp: 100, x: p.x + 4, y: p.y }],
          ['remote', { kind: 12, hp: 5000, maxHp: 5000, x: p.x + 70, y: p.y }],
        ]),
      });
      g.ext.adventure.frame(0);
    });
    await page.getByText('Gelatinous Sovereign', { exact: true }).waitFor();
    assert.equal(await page.locator('#target-frame').isVisible(), false, 'One encounter header takes priority');
    assert.equal(await page.locator('.bb-tick').count(), 2);
    assert.equal(
      await page.getByRole('progressbar', { name: 'Gelatinous Sovereign health' }).getAttribute('aria-valuenow'),
      '100',
    );
    await page.evaluate(() => {
      const g = window.__eigen.game,
        p = g.predictor.sim;
      g.ext.adventure.onBoss({
        kind: 'phase',
        boss: 'slime_king',
        phase: 1,
        text: 'It splits! Slimes spill from its body.',
      });
      g.ext.adventure.onState({ enemies: new Map([['slime', { kind: 10, hp: 66, maxHp: 100, x: p.x + 4, y: p.y }]]) });
      g.ext.adventure.frame(0);
    });
    assert.equal(await page.locator('.bb-phase').innerText(), 'Phase 2 / 3');
    assert.equal(await page.locator('#adv-banner').isVisible(), false, 'Phase announcements stay inside the header');
    await shot('boss');
    await page.evaluate(() => {
      const g = window.__eigen.game,
        p = g.predictor.sim;
      g.ext.adventure.onState({ enemies: new Map([['warden', { kind: 11, hp: 50, maxHp: 100, x: p.x + 4, y: p.y }]]) });
      g.ext.adventure.frame(0);
    });
    assert.equal(await page.locator('.bb-tick').count(), 1, 'Switching boss rebuilds thresholds');
    assert.equal(await page.locator('.bb-phase').innerText(), 'Phase 2 / 2');
    const widths = await page
      .locator('#boss-bar .enc-health')
      .evaluate((el) => [...el.querySelectorAll('.enc-fill,.enc-trail')].map((n) => n.getBoundingClientRect().width));
    assert.ok(Math.abs(widths[0] - widths[1]) < 0.1, 'New boss identity has no stale damage trail');
    if (mobile)
      assert.equal(
        await page.locator('#boss-bar .enc-fill').evaluate((e) => getComputedStyle(e).transitionDuration),
        '0s',
      );
    const overlap = await page.locator('#boss-bar').evaluate((el) => {
      const a = el.getBoundingClientRect();
      return ['#hud-left', '#hud-actions', '#atlas-mini', '#tbtns', '#stick'].some((s) => {
        const e = document.querySelector(s);
        if (!e?.getClientRects().length) return false;
        const b = e.getBoundingClientRect();
        return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
      });
    });
    assert.equal(overlap, false, 'Encounter header leaves health, map and touch controls clear');
    if (mobile) {
      await page.setViewportSize({ width: 568, height: 320 });
      const small = await page.locator('#boss-bar').evaluate((el) => {
        const a = el.getBoundingClientRect();
        return ['#hud-left', '#hud-actions', '#tbtns', '#stick'].some((s) => {
          const e = document.querySelector(s);
          if (!e?.getClientRects().length) return false;
          const b = e.getBoundingClientRect();
          return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
        });
      });
      assert.equal(small, false, 'Small landscape keeps combat between status and utilities');
      assert.equal(await page.locator('#atlas-mini').isVisible(), false, 'Small phone minimap yields during combat');
    }
    await page.click('#btn-journal');
    assert.equal(await page.locator('#boss-bar').isVisible(), false, 'Dialogs own focus and screen space');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const g = window.__eigen.game;
      g.targetFrame.update(null);
      g.ext.adventure.onState({ enemies: new Map() });
      g.ext.adventure.frame(0);
    });
    assert.equal(await page.locator('#boss-bar').isVisible(), false);
    assert.equal(await page.locator('#target-frame').isVisible(), false);
    assert.equal(await page.locator('#hud-right').isVisible(), true);
    await page.evaluate(() => {
      const a = window.__eigen.game.ext.adventure;
      a.onBoss({ kind: 'defeated', boss: 'slime_king', name: 'Gelatinous Sovereign', first: true });
      a.frame(0);
    });
    assert.equal(await page.locator('#adv-banner').isVisible(), true, 'Victory has a compact announcement');
    assert.equal(await page.locator('#hud-right').isVisible(), false, 'Travel text yields to the announcement');
    const bannerOverlap = await page.locator('#adv-banner').evaluate((el) => {
      const a = el.getBoundingClientRect();
      return ['#hud-left', '#hud-actions'].some((s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
      });
    });
    assert.equal(bannerOverlap, false, 'Victory leaves status and utilities clear');
    if (process.argv.includes('--labs')) {
      await page.goto(`${base}labs/uilab.html?panel=journey`);
      await page.getByRole('heading', { name: /Level 10.*Superposer/ }).waitFor();
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    'Desktop/landscape: actual progression/Journal updates and Board navigation; target/poise, boss selection/phase switch, trail reset, accessible health, reduced motion, modal suppression and layout fixtures passed.',
  );
} finally {
  await browser.close();
}
