// Pack-only weapon comparisons, actual equipment/quick-bar actions and responsive native controls.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/',
  mobile = process.argv.includes('--mobile');
const out = `/tmp/eigenlands-weapon-guide-${new URL(base).port}-${mobile ? 'landscape' : 'desktop'}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let page;
try {
  page = await browser.newPage({
    viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 800 },
    hasTouch: mobile,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?dev=1&hour=12`);
  await page.waitForSelector('#g-off:not([hidden])');
  await page.fill('#name', 'Arms reader');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 60000,
  });
  await page.evaluate(() => (window.__eigen.game.app.ticker.maxFPS = 10));
  const dev = (msg) => page.evaluate((msg) => window.__eigen.game.net.dev(msg), msg);
  for (const id of ['crossbow', 'verdant_staff', 'morph_staff', 'rime_staff']) await dev({ cmd: 'give', id, n: 1 });
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.count('rime_staff') === 1);
  await page.click('#btn-menu');
  await page.click('#btn-pack');
  const pack = page.getByRole('dialog', { name: 'Pack', exact: true });
  await pack.waitFor();
  const select = async (id, atk) => {
    const index = await page.evaluate(
      ([id, atk]) =>
        window.__eigen.game.gameplay.profile.inv.findIndex(
          (s) => s?.id === id && (atk === undefined || s.p?.atk === atk),
        ),
      [id, atk],
    );
    assert.ok(index >= 0);
    await pack.locator(`.slot[data-i="${index}"]`).click();
    return index;
  };
  const guide = pack.locator('.weapon-guide'),
    equip = pack.getByRole('button', { name: 'Equip item', exact: true });
  await select('crossbow');
  assert.equal(await equip.isDisabled(), true);
  assert.match(await pack.locator('.equip-lock').innerText(), /Requires level 5/);
  assert.match(await guide.innerText(), /per bolt × 3 bolts/);
  await dev({ cmd: 'level', level: 20 });
  await page.waitForFunction(() => window.__eigen.state().level === 20);
  await equip.waitFor();
  await page.waitForFunction(() => !document.querySelector('.inv-detail button.primary')?.disabled);
  await guide.locator('table').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/crossbow.png` });
  // Native Space disclosure, then a real profile update, must preserve its state, focus and reading position.
  const summary = guide.locator('summary');
  await summary.focus();
  await page.keyboard.press('Space', { delay: 180 });
  await page.waitForFunction(() => document.querySelector('.weapon-guide details')?.open);
  const top = await pack.evaluate((el) => el.scrollTop),
    coins = await page.evaluate(() => window.__eigen.game.gameplay.profile.coins);
  await dev({ cmd: 'coins', n: 1 });
  await page.waitForFunction((coins) => window.__eigen.game.gameplay.profile.coins === coins + 1, coins);
  assert.equal(await guide.locator('details').evaluate((el) => el.open), true);
  assert.equal(await summary.evaluate((el) => el === document.activeElement), true);
  assert.ok(Math.abs((await pack.evaluate((el) => el.scrollTop)) - top) < 5);
  await equip.click();
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.equip.weapon?.id === 'crossbow');
  await pack.getByRole('button', { name: 'Weapon: Crossbow, unequip', exact: true }).click();
  await page.waitForFunction(() => !window.__eigen.game.gameplay.profile.equip.weapon);
  await select('verdant_staff');
  assert.match(await guide.innerText(), /20–34 healing/);
  await equip.click();
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.equip.weapon?.id === 'verdant_staff');
  await select('morph_staff');
  assert.match(await guide.innerText(), /Wolf:.* OR Bear:/);
  await guide.locator('table').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/morph.png` });
  await select('rime_staff');
  await equip.click();
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.equip.weapon?.id === 'rime_staff');
  // A forged sword improves the quick-bar bonus, not the equipped Focus's identity/moveset.
  await dev({ cmd: 'give', id: 'sword', n: 1, p: { atk: 12, tier: 3 } });
  await page.waitForFunction(() =>
    window.__eigen.game.gameplay.profile.inv.some((s) => s?.id === 'sword' && s.p?.atk === 12),
  );
  let sword = await page.evaluate(() =>
    window.__eigen.game.gameplay.profile.inv.findIndex((s) => s?.id === 'sword' && s.p?.atk === 12),
  );
  await page.evaluate((i) => window.__eigen.game.net.invMove({ from: i, to: 20 }), sword);
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.inv[20]?.p?.atk === 12);
  await select('sword', 12);
  assert.match(await guide.innerText(), /After · Rime Staff/);
  assert.match(await guide.innerText(), /strongest sword/);
  await pack.getByRole('button', { name: /Place in quick-bar|Swap with quick-bar slot 1/ }).click();
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.stats.atkBonus === 12);
  assert.equal(await page.evaluate(() => window.__eigen.game.gameplay.profile.equip.weapon.id), 'rime_staff');
  assert.ok(await pack.evaluate((el) => el.scrollWidth <= el.clientWidth + 2), 'No horizontal modal overflow');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.weapon-guide:visible').count(), 0);
  assert.equal(await page.locator('#qtrack').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    'Weapon guide passed: locks, actual equip/unequip, healing, morph choice, sword/Focus semantics, disclosure/focus/scroll, desktop/mobile bounds',
    out,
  );
} catch (e) {
  if (page) await page.screenshot({ path: `${out}/failure.png` });
  throw e;
} finally {
  await browser.close();
}
