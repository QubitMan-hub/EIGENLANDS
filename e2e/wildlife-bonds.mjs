// Real companion window -> food offer -> living creature -> commands -> durable reload.
// Only level, supplies, wildlife spawn and fixture positioning use existing dev tools.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/',
  mobile = process.argv.includes('--mobile');
const out = `/tmp/eigenlands-bonds-${new URL(base).port}-${mobile ? 'landscape' : 'desktop'}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let page;
const errors = [];
try {
  page = await browser.newPage({
    viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 800 },
    hasTouch: mobile,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?dev=1&hour=12`);
  await page.waitForSelector('#g-off:not([hidden])');
  await page.fill('#name', 'Wildlife keeper');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 60000,
  });
  await page.evaluate(() => (window.__eigen.game.app.ticker.maxFPS = 10));
  const dev = (msg) => page.evaluate((msg) => window.__eigen.game.net.dev(msg), msg);
  const roster = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__eigen.game.ext.shadows.roster)));
  const count = (id) =>
    page.evaluate(
      (id) => window.__eigen.game.gameplay.profile.inv.reduce((n, s) => n + (s?.id === id ? s.n : 0), 0),
      id,
    );
  const press = async (code) => {
    await page.keyboard.down(code);
    await page.waitForTimeout(250);
    await page.keyboard.up(code);
  };
  await dev({ cmd: 'level', level: 16 });
  await dev({ cmd: 'tp', x: 250.5, y: 250.5 });
  await page.waitForTimeout(1200);
  // Pick a genuinely clear corridor in the existing generated terrain, rather than changing map collision.
  const spot = await page.evaluate(() => {
    const g = window.__eigen.game,
      m = g.ext.atlas.state.players.get(g.myId),
      solid = g.store.solidAt;
    for (let y = Math.floor(m.y) - 12; y < Math.floor(m.y) + 12; y++)
      for (let x = Math.floor(m.x) - 12; x < Math.floor(m.x) + 12; x++) {
        let ok = true;
        for (let t = 0; t <= 4; t += 0.2) {
          if (solid(Math.floor(x + 0.5 + Math.cos(0.3) * t), Math.floor(y + 0.5 + Math.sin(0.3) * t))) ok = false;
        }
        if (ok) return { x: x + 0.5, y: y + 0.5 };
      }
    return null;
  });
  assert(spot, 'clear approach corridor');
  await dev({ cmd: 'tp', ...spot });
  await dev({ cmd: 'kill', d: 12 });
  for (const [id, n] of [
    ['hazelnut', 3],
    ['mushroom', 2],
    ['blackberry', 3],
  ])
    await dev({ cmd: 'give', id, n });
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.inv.some((s) => s?.id === 'blackberry'));
  if (mobile) {
    await page.click('#btn-menu');
    await page.getByRole('button', { name: 'Companions & Echoes', exact: true }).click({ timeout: 5000 });
  } else await press('KeyY');
  await page.waitForSelector('.sh-win');
  await page.locator('.sh-guide summary').click();
  assert(await page.locator('.sh-guide').evaluate((e) => e.open));
  await page.screenshot({ path: `${out}/guide.png` });
  await page.locator('.sh-guide summary').click();
  const species = [
    ['boar', 7, 'hazelnut', 3],
    ['badger', 9, 'mushroom', 2],
    ['deer', 3, 'blackberry', 3],
  ];
  const ids = [];
  for (const [kind, k, food, n] of species) {
    const initial = await count(food);
    await dev({ cmd: 'spawn', kind, n: 1, d: 3.8, night: false });
    const offer = page
      .locator('.sh-wild')
      .filter({
        has: page.getByText(kind === 'boar' ? 'Brambleback' : kind === 'badger' ? 'Mossburrow' : 'Glimmerhart', {
          exact: true,
        }),
      })
      .getByRole('button');
    await offer.waitFor({ timeout: 10000 });
    await offer.click({ timeout: 10000 });
    await page.waitForFunction(
      (k) => window.__eigen.game.ext.shadows.roster.roster.some((r) => r.bonded && r.kind === k),
      k,
      { timeout: 10000 },
    );
    const R = await roster(),
      rec = R.roster.find((r) => r.bonded && r.kind === k);
    ids.push(rec.id);
    assert.equal(await count(food), initial - n);
    await page.waitForFunction((id) => {
      const g = window.__eigen.game,
        s = g.ext.atlas.state.shadows.get(`sh_${id}`),
        v = g.views.get(`sh_${id}`);
      return s?.bonded && v?.sprite.tint === 0xffffff;
    }, rec.id);
    if (k !== 3) {
      await page.locator(`[data-sh-control="dismiss-${rec.id}"]`).click();
      await page.waitForFunction((id) => !window.__eigen.game.ext.shadows.roster.active.includes(id), rec.id);
    }
  }
  // Stance updates preserve keyboard focus and the guide's native disclosure state.
  await page.locator('.sh-guide summary').click();
  const stance = page.locator('[data-sh-control="stance-guard"]');
  await stance.focus();
  await stance.click();
  await page.waitForFunction(() => window.__eigen.game.ext.shadows.roster.stance === 'guard');
  assert(await page.locator('.sh-guide').evaluate((e) => e.open));
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.shControl), 'stance-guard');
  // A private supply update rebuilds this window; retain the actual scrolling dialog position.
  const scrolled = await page.getByRole('dialog', { name: 'Companions & Echoes' }).evaluate((e) => {
    e.scrollTop = 70;
    return e.scrollTop;
  });
  await dev({ cmd: 'give', id: 'hazelnut', n: 1 });
  await page.waitForTimeout(800);
  assert.equal(await page.getByRole('dialog', { name: 'Companions & Echoes' }).evaluate((e) => e.scrollTop), scrolled);
  await page.getByRole('dialog', { name: 'Companions & Echoes' }).evaluate((e) => (e.scrollTop = 0));
  await page.screenshot({ path: `${out}/roster.png` });
  const bounds = await page.getByRole('dialog', { name: 'Companions & Echoes' }).evaluate((e) => ({
    x: e.getBoundingClientRect().x,
    right: e.getBoundingClientRect().right,
    scroll: e.scrollWidth,
    width: e.clientWidth,
  }));
  assert(bounds.x >= 0 && bounds.right <= (mobile ? 844 : 1280) + 1);
  assert(bounds.scroll <= bounds.width + 1);
  await page.locator('.sh-guide summary').click();
  await press('Escape');
  await page.waitForSelector('.sh-win', { state: 'hidden' });
  await page.screenshot({ path: `${out}/world.png` });
  // Deer actually follows; walking is not a constantly applied idle tween.
  const before = await page.evaluate((id) => {
    const s = window.__eigen.game.ext.atlas.state.shadows.get(`sh_${id}`);
    return { x: s.x, y: s.y };
  }, ids[2]);
  await dev({ cmd: 'tp', x: spot.x + 5, y: spot.y });
  await page.waitForFunction(
    ({ id, before }) => {
      const s = window.__eigen.game.ext.atlas.state.shadows.get(`sh_${id}`);
      return s && Math.hypot(s.x - before.x, s.y - before.y) > 1;
    },
    { id: ids[2], before },
    { timeout: 10000 },
  );
  await press('KeyY');
  await page.waitForSelector('.sh-win');
  await page.getByRole('button', { name: 'Dismiss all', exact: true }).click();
  await page.waitForFunction(() => window.__eigen.game.ext.shadows.roster.active.length === 0);
  await page.locator(`[data-sh-control="summon-${ids[0]}"]`).click();
  await page.waitForFunction((id) => window.__eigen.game.ext.shadows.roster.active.includes(id), ids[0]);
  await press('Escape');
  await page.evaluate(() => window.__eigen.game.net.leave());
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForFunction(
    () =>
      window.__eigen?.state().ready &&
      window.__eigen.game.ext.shadows.roster.roster.filter((r) => r.bonded).length === 3,
    null,
    { timeout: 60000 },
  );
  const loaded = await roster();
  assert.deepEqual(
    loaded.roster.filter((r) => r.bonded).map((r) => r.id),
    ids,
  );
  assert.equal(loaded.stance, 'guard');
  assert(loaded.active.includes(ids[0]));
  assert.deepEqual(errors, []);
  console.log(
    'Wildlife bonds passed: real food offers, natural sprites, three species, stances/focus, dismiss/summon, follow and saved reload',
    out,
  );
} catch (e) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png` });
    console.log('Page errors', errors);
  }
  throw e;
} finally {
  await browser.close();
}
