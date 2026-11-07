import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'docs/validation/reference-wardrobe';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const url = `${process.argv[2] ?? 'http://localhost:5244/'}?dev=1&hour=12`;
  await p.goto(url);
  await p.locator('.look-menu summary').click();
  const menu = p.locator('#look-title');
  const pick = (_field, label) => menu.locator(`select[aria-label="${label}"]`);
  for (const [field, label, id] of [
    ['hair', 'Hair design', 50],
    ['eyes', 'Eye detail', 19],
    ['mouths', 'Expression', 8],
    ['tops', 'Top', 27],
    ['pants', 'Trousers', 55],
    ['boots', 'Boots', 42],
  ])
    await pick(field, label).selectOption(String(id));
  await pick('shorts', 'Shorts').selectOption('12');
  assert.equal(await pick('pants', 'Trousers').inputValue(), '0');
  await pick('pants', 'Trousers').selectOption('55');
  assert.equal(await pick('shorts', 'Shorts').inputValue(), '0');
  await p.screenshot({ path: `${out}/picker.png` });
  await p.locator('.look-menu summary').click();
  await p.fill('#name', 'Wardrobe review');
  await p.click('#btn-guest');
  const ready = () =>
    p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
      timeout: 120000,
    });
  await ready();
  const get = () =>
    p.evaluate(() => JSON.parse(window.__eigen.game.net.room.state.players.get(window.__eigen.game.myId).parts));
  await p.waitForFunction(
    () => {
      const g = window.__eigen.game;
      const v = g.net.room?.state?.players?.get(g.myId);
      return v?.parts?.includes('"hair":50');
    },
    null,
    { timeout: 20000 },
  );
  const before = await get();
  assert.equal(before.hair, 50);
  assert.equal(before.pants, 55);
  assert.equal(before.shorts, 0);
  await p.screenshot({ path: `${out}/gameplay.png` });
  await p.reload();
  await p.waitForSelector('#btn-guest');
  await p.click('#btn-guest');
  await ready();
  await p.waitForFunction(
    () => window.__eigen.game.net.room.state.players.get(window.__eigen.game.myId)?.parts?.includes('"hair":50'),
    null,
    { timeout: 20000 },
  );
  assert.deepEqual(await get(), before);
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify({ before, after: await get(), errors }, null, 2));
  console.log('PASS catalog picker, trouser/short exclusion, synced appearance and reload/rejoin');
} finally {
  await b.close();
}
