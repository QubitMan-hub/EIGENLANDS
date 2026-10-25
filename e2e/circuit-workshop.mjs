// Actual solo/server Board: guided draft -> Attune -> cast -> persisted reload.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5174/',
  shots = process.argv.includes('--shots');
const out = `/tmp/eigenlands-circuit-workshop-${new URL(base).port}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = async (name) => {
    if (shots) await page.screenshot({ path: `${out}/${name}.png` });
  };
  await page.goto(`${base}?dev=1&hour=12`);
  await page.waitForSelector('#g-off:not([hidden])');
  await page.fill('#name', 'Patternwright');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
  await page.evaluate(() => (window.__eigen.game.app.ticker.maxFPS = 10));
  for (let i = 0; i < 2 && (await page.locator('.p3-lumen-skip').isVisible()); i++)
    await page.locator('.p3-lumen-skip').click();
  await page.waitForFunction(() => window.__eigen.game.ext.circuit.progress.loaded);
  await page.evaluate(() => {
    const c = window.__eigen.game.ext.circuit;
    c.send('p3_dev', { cmd: 'class', cls: 'superposer' });
    c.send('p3_dev', { cmd: 'gates' });
  });
  await page.waitForFunction(() => {
    const p = window.__eigen.game.ext.circuit.progress;
    return p.cls === 'superposer' && p.gates.h >= 3 && p.qubits >= 2;
  });
  await page.evaluate(() => window.__eigen.game.ext.circuit.openBoard('board'));
  await page.getByRole('button', { name: 'Learn a pattern', exact: true }).click();
  const original = await page.evaluate(() => JSON.stringify(window.__eigen.game.ext.circuit.progress.board));
  const count = () =>
    page.evaluate(() => window.__eigen.game.ext.circuit.sentLog.filter((s) => s.type === 'p3_attune').length);
  const writes = await count();
  // Keyboard review is a local operation; no save or automatic reward is issued.
  await page.getByRole('button', { name: 'Preview pattern', exact: true }).focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Use pattern in draft', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Use pattern in draft');
  assert.equal(await count(), writes);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__eigen.game.ext.circuit.progress.board)), original);
  assert.match(await page.locator('.cb-guide-table').innerText(), /50%/);
  await shot('desktop-guide');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__eigen.game.ext.circuit.board.tab === 'board');
  assert.equal(await count(), writes);
  assert.equal(await page.evaluate(() => window.__eigen.game.ext.circuit.board.draft.lines[0][0]?.g), 'h');
  await page.getByRole('button', { name: 'Revert', exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__eigen.game.ext.circuit.board.draft)), original);
  // Every pattern can be reviewed/applied using actual owned gates; applying remains a draft.
  for (const [name, gates] of [
    ['Choose the other form', ['x']],
    ['Make the paths interfere', ['h', 'z', 'h']],
    ['Choose once, then keep it', ['h', 'm']],
    ['Share an outcome', ['h', 'cx']],
  ]) {
    await page.getByRole('tab', { name: 'Guides', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Preview pattern', exact: true }).click();
    if (gates.includes('m')) assert.match(await page.locator('.cb-guide-page').innerText(), /has not chosen yet/);
    await page.getByRole('button', { name: 'Use pattern in draft', exact: true }).click();
    assert.deepEqual(
      await page.evaluate(() => window.__eigen.game.ext.circuit.board.draft.lines[0].filter(Boolean).map((c) => c.g)),
      gates,
    );
  }
  assert.equal(await count(), writes);
  // Save a real linked pattern and cast it through the authoritative ability engine.
  await page.locator('.cb-attune:not(:disabled)').click();
  await page.waitForFunction(() => !window.__eigen.game.ext.circuit.board.dirty, null, { timeout: 10000 });
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__eigen.game.ext.circuit.cast(0));
  await page.waitForFunction(() => window.__eigen.game.ext.circuit.lastCast?.ok === true, null, { timeout: 10000 });
  console.log('Authoritative cast', await page.evaluate(() => window.__eigen.game.ext.circuit.lastCast));
  const saved = await page.evaluate(() => JSON.stringify(window.__eigen.game.ext.circuit.progress.board));
  await page.reload();
  await page.waitForFunction(
    () => window.__eigen?.state().ready && window.__eigen.game.ext.circuit.progress.loaded,
    null,
    { timeout: 60000 },
  );
  assert.equal(
    await page.evaluate(() => JSON.stringify(window.__eigen.game.ext.circuit.progress.board)),
    saved,
    'Attuned guided pattern survives reload',
  );
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 10;
    g.ext.circuit.openBoard('board');
  });
  const overflow = await page.evaluate(() => {
    const root = document.querySelector('.cb-root');
    return root.scrollWidth > root.clientWidth + 1;
  });
  assert.equal(overflow, false, 'Desktop Board content must fit its window');
  await shot('desktop-board');
  await page.getByRole('button', { name: 'Expert View', exact: true }).click();
  await page.locator('.cb-ketline').waitFor();
  await page.getByRole('button', { name: 'Expert View', exact: true }).click();
  await page.getByRole('tab', { name: 'Superposer', exact: true }).click();
  assert.match(await page.locator('.cb-roadmap').innerText(), /Level 10/);
  assert.match(await page.locator('.cb-roadmap').innerText(), /Level 30/);
  await page.getByText('Superposer abilities, passive and ultimate', { exact: true }).focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('.cb-class-details').getAttribute('open'), '');
  await shot('desktop-path');
  await page.getByRole('tab', { name: 'Qubitpedia', exact: true }).click();
  assert.ok(await page.locator('.cb-cx-item:not(.locked)').count());
  await shot('desktop-codex');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('tab', { name: 'Guides', exact: true }).click();
  await page.getByRole('button', { name: 'Keep both possibilities', exact: true }).click();
  await page.getByRole('button', { name: 'Preview pattern', exact: true }).click();
  await page.locator('.cb-guide-table').scrollIntoViewIfNeeded();
  await shot('landscape-guide');
  await page.getByRole('button', { name: 'Use pattern in draft', exact: true }).click();
  await shot('landscape-board');
  // Reduced motion and portrait fallbacks remain operable, without document-wide horizontal overflow.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Guides', exact: true }).click();
  await page.getByRole('combobox', { name: 'Pattern orb' }).selectOption('1');
  await page.getByRole('button', { name: 'Choose the other form', exact: true }).click();
  await page.getByRole('button', { name: 'Preview pattern', exact: true }).click();
  await shot('portrait-guide');
  const bounds = await page.getByRole('dialog', { name: 'Circuit Board', exact: true }).boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, `Portrait dialog bounds: ${JSON.stringify(bounds)}`);
  // Milestones unlock real choices while the path page stays open.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('tab', { name: 'Superposer', exact: true }).click();
  await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'level', level: 10 }));
  await page.getByRole('button', { name: 'Choose Phantom', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.waitForFunction(() => window.__eigen.game.ext.circuit.progress.spec === 'phantom');
  assert.match(await page.locator('.cb-roadmap').innerText(), /Phantom/);
  await page.evaluate(() => window.__eigen.game.net.dev({ cmd: 'level', level: 30 }));
  await page.getByRole('button', { name: 'Learn Entangler', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm second path', exact: true }).click();
  await page.waitForFunction(() => window.__eigen.game.ext.circuit.progress.second === 'entangler');
  assert.match(await page.locator('.cb-roadmap').innerText(), /Entangler/);
  assert.deepEqual(errors, []);
  console.log(
    'Circuit workshop passed: drafts, revert, all patterns, authoritative Attune/cast/reload, keyboard, expert/codex/path and mobile controls',
    out,
  );
} finally {
  await browser.close();
}
