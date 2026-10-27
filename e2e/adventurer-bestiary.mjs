import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { biomeAt, setActiveGeneration } from '../packages/shared/src/worldgen.ts';
import { sanctuaryAt } from '../packages/shared/src/sanctuary.ts';
import { townFor } from '../packages/shared/src/town.ts';
const base = process.argv[2] ?? 'http://127.0.0.1:5244/',
  out = process.argv[3] ?? '/tmp/adventurer-bestiary';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
    errors = [],
    assets = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/art/bestiary/') && r.status() === 200) assets.push(r.url());
  });
  await page.goto(base + '?dev=1&hour=12');
  await page.evaluate(() => localStorage.setItem('eigen.tutorial2', '["all"]'));
  await page.reload();
  await page.fill('#name', 'Sixfold Wayfarer');
  await page.click('#btn-guest');
  const ready = () =>
    page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
      timeout: 120000,
    });
  await ready();
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 15;
    g.ext.circuit.send('p3_tutorial', { action: 'skip' });
    g.net.dev({ cmd: 'level', level: 32 });
  });
  await page.waitForFunction(() => window.__eigen.state().level === 32);
  await page.evaluate(() => window.__eigen.game.ext.circuit.openBoard('path'));
  for (const family of ['warrior', 'ranged', 'mage', 'stealth', 'support', 'hybrid']) {
    await page.getByLabel('Class family', { exact: true }).selectOption(family);
    assert.equal(await page.locator('.cb-pcards .cb-pcard:visible').count(), 1);
  }
  await page.getByLabel('Class family', { exact: true }).selectOption('warrior');
  await page.getByRole('button', { name: 'Become a Warrior', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, become a Warrior', exact: true }).click();
  await page.waitForFunction(() => window.__eigen.game.ext.circuit.progress.cls === 'warrior');
  await page.evaluate(() => window.__eigen.game.ext.circuit.openBoard('path'));
  await page.getByRole('button', { name: 'Choose Knight', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.waitForFunction(() => window.__eigen.game.ext.circuit.progress.spec === 'knight');
  await page.screenshot({ path: out + '/knight-path-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: out + '/knight-path-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.__eigen.game.gameplay.wins.close());
  // A deterministic clearing is a fixture; casts, discovery, rendering and persistence use normal game systems.
  const tp = async (x, y) => {
    await page.evaluate(
      async ({ x, y }) => {
        const r = window.__eigenSolo.raw().find((r) => r.players.size);
        const cx = Math.floor(x / 32),
          cy = Math.floor(y / 32);
        await Promise.all(
          Array.from({ length: 9 }, (_, i) => r.ensureChunk(cx + (i % 3) - 1, cy + Math.floor(i / 3) - 1)),
        );
        for (let yy = Math.floor(y) - 16; yy <= y + 16; yy++)
          for (let xx = Math.floor(x) - 16; xx <= x + 16; xx++) {
            r.objects.remove(xx, yy);
            r.setTile(xx, yy, 3);
            r.store.get(Math.floor(xx / 32), Math.floor(yy / 32)).levels?.fill(0);
          }
      },
      { x, y },
    );
    await page.evaluate(({ x, y }) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), { x, y });
    await page.waitForFunction(
      ({ x, y }) => Math.hypot(window.__eigen.state().x - x, window.__eigen.state().y - y) < 0.2,
      { x, y },
      { timeout: 30000 },
    );
    await page.waitForFunction(
      ({ x, y }) =>
        window.__eigenSolo
          .raw()
          .some((r) => [...r.players.values()].some((p) => Math.hypot(p.sim.x - x, p.sim.y - y) < 0.2)),
      { x, y },
      { timeout: 30000 },
    );
  };
  await tp(90.5, 90.5);
  await page.evaluate(() => {
    const r = window.__eigenSolo.raw().find((r) => r.players.size),
      p = [...r.players.values()][0];
    p.invuln = 999;
    r.enemies.clear();
    r.state.enemies.clear();
  });
  await page.mouse.move(850, 360);
  await page.keyboard.press('KeyQ');
  assert.equal(await page.evaluate(() => window.__eigen.game.ext.circuit.aimRange()), 2.3);
  await page.mouse.click(850, 360);
  await page.waitForFunction(() => window.__eigen.game.ext.circuit.lastCast?.ok === true);
  assert.equal(await page.evaluate(() => window.__eigen.game.ext.circuit.lastCast.results[0].ability), 'warrior_0');
  // Several species share this clearing only as a rendering/sighting fixture; ambient habitats are tested separately.
  await page.evaluate(() => {
    const r = window.__eigenSolo.raw().find((r) => r.players.size),
      p = [...r.players.values()][0];
    for (const [i, k] of ['unicorn', 'hydra', 'bandit', 'spider', 'woodland_spirit', 'troll'].entries()) {
      const e = r.spawnEnemy(k, p.sim.x + 1 + (i % 3) * 2, p.sim.y - 3 + Math.floor(i / 3) * 3, false);
      e.mode = 'recover';
      e.t = 99;
    }
  });
  await page.waitForFunction(
    () =>
      ['unicorn', 'hydra', 'bandit', 'spider', 'woodland_spirit', 'troll'].every((id) =>
        window.__eigen.game.gameplay.profile.bestiary.has(id),
      ),
    null,
    { timeout: 30000 },
  );
  await page.waitForFunction(() =>
    [...document.images].filter((i) => i.src.includes('/art/bestiary/')).every((i) => i.complete),
  );
  await page.screenshot({ path: out + '/living-bestiary-world.png' });
  await page.evaluate(() => window.__eigen.game.gameplay.toggleJournal());
  await page.getByRole('button', { name: 'Bestiary', exact: true }).click();
  await page.getByLabel('Search bestiary', { exact: true }).fill('unicorn');
  await page.locator('.bestiary-list summary').first().click();
  assert.match(await page.locator('.bestiary-list').innerText(), /Quiet sanctuary/);
  await page.screenshot({ path: out + '/bestiary-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: out + '/bestiary-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.__eigen.game.gameplay.wins.close());
  const seed = await page.evaluate(() => window.__eigenSolo.raw().find((r) => r.players.size).seed);
  let pos;
  setActiveGeneration(seed, await page.evaluate(() => window.__eigen.state().generation));
  const town = townFor(seed);
  for (let y = -110; y <= 110 && !pos; y += 5)
    for (let x = -110; x <= 110; x += 5)
      if (
        Math.hypot(x + 4.5, y + 0.5) > 70 &&
        Math.hypot(x + 4.5 - town.cx, y + 0.5 - town.cy) > 95 &&
        !sanctuaryAt(seed, x + 4.5, y + 0.5) &&
        biomeAt(seed, x + 0.5, y + 0.5) === 'desert' &&
        biomeAt(seed, x + 4.5, y + 0.5) === 'desert'
      ) {
        pos = { x: x + 0.5, y: y + 0.5 };
        break;
      }
  assert(pos);
  await tp(pos.x, pos.y);
  const summoned = await page.evaluate(() => {
    const r = window.__eigenSolo.raw().find((r) => r.players.size),
      p = [...r.players.values()][0];
    p.invuln = 999;
    r.enemies.clear();
    r.state.enemies.clear();
    for (let y = Math.floor(p.sim.y) - 16; y <= p.sim.y + 16; y++)
      for (let x = Math.floor(p.sim.x) - 16; x <= p.sim.x + 16; x++) {
        r.objects.remove(x, y);
        r.setTile(x, y, 3);
      }
    const messages = [],
      toast = p.toast.bind(p);
    p.toast = (...args) => {
      messages.push(args);
      toast(...args);
    };
    try {
      return {
        ok: r.bosses.summon(p, 'first_flame_seal', p.sim.x + 4, p.sim.y),
        messages,
        level: p.level,
        pos: [p.sim.x, p.sim.y],
        seed: r.seed,
      };
    } finally {
      p.toast = toast;
    }
  });
  assert(summoned.ok, JSON.stringify(summoned));
  await page.locator('#boss-bar').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.bestiary.has('primordial_dragon'), null, {
    timeout: 30000,
  });
  await page.screenshot({ path: out + '/first-flame-encounter.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: out + '/first-flame-mobile.png' });
  await page.reload();
  await ready();
  assert.equal(await page.evaluate(() => window.__eigen.game.ext.circuit.progress.spec), 'knight');
  assert(await page.evaluate(() => window.__eigen.game.gameplay.profile.bestiary.has('unicorn')));
  assert(await page.evaluate(() => window.__eigen.game.gameplay.profile.bestiary.has('primordial_dragon')));
  assert(
    assets.some((u) => u.includes('primordial_dragon-day.png')),
    'Runtime must decode the shipped boss atlas',
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    out + '/report.json',
    JSON.stringify(
      {
        classChoice: 'warrior',
        path: 'knight',
        cast: 'warrior_0',
        sightings: 6,
        boss: 'primordial_dragon',
        persistence: true,
        desktopMobile: true,
        loadedAssets: [...new Set(assets)],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS real class choice, aimed cast, visible bestiary discovery, journal/mobile, boss arena/bar, shipped atlases and reload',
  );
} finally {
  await browser.close();
}
