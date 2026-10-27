import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[3] ?? 'test-results/combat-contact';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5244/'}?dev=1&hour=12`);
  await page.fill('#name', 'Contact audit');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.ext.circuit.send('p3_tutorial', { action: 'skip' });
    window.__contact = { events: [], painted: [], charged: false };
    const original = g.combat.onLocalStep.bind(g.combat);
    g.combat.onLocalStep = (ev, sim, actor) => {
      original(ev, sim, actor);
      if (ev.attacked) window.__contact.events.push(g.combat.playerAttackFrame(actor, performance.now(), false));
    };
    g.app.ticker.add(
      () => {
        const actor = g.views.get(g.myId);
        if (!actor) return;
        const active = g.combat.playerAttackFrame(actor, performance.now(), false);
        const frame = actor.sprite.texture.frame.x / 32;
        if (active >= 0) window.__contact.painted.push(frame);
        if (g.predictor.sim.charge > 0 && active < 0 && frame === 10) window.__contact.charged = true;
      },
      undefined,
      -100,
    );
  });
  await page.waitForTimeout(700);
  await page.keyboard.down('KeyJ');
  await page.waitForFunction(() => window.__contact.charged, null, { timeout: 15000 });
  await page.screenshot({ path: `${out}/charge.png` });
  await page.keyboard.up('KeyJ');
  await page.waitForFunction(() => window.__contact.events.length >= 2, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const report = await page.evaluate(() => window.__contact);
  assert.ok(
    report.events.every((f) => f === 1),
    'Opening and heavy release immediately show the contact key',
  );
  assert.ok(
    report.painted.some((f) => f >= 11 && f <= 13),
    'Actual gameplay paints the strike and recovery',
  );
  assert.ok(!report.painted.includes(10), 'Active damage release does not play a late windup');
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await page.screenshot({ path: `${out}/recovery.png` });
  console.log('PASS real opening strike, held charge and heavy release use contact-aligned player animation');
} finally {
  await browser.close();
}
