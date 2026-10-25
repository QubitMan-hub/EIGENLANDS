// Real forge-open protocol (avoids scheduled NPC talk priority), crafting, equipment/guide, held atlas and predicted/server attacks.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/',
  mobile = process.argv.includes('--mobile');
const out = `/tmp/eigenlands-arsenal-${new URL(base).port}-${mobile ? 'landscape' : 'desktop'}`;
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
  await page.fill('#name', 'Arsenal smith');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 60000,
  });
  await page.evaluate(() => (window.__eigen.game.app.ticker.maxFPS = 15));
  const dev = (msg) => page.evaluate((msg) => window.__eigen.game.net.dev(msg), msg);
  const press = (code) => page.keyboard.press(code, { delay: 180 });
  const tp = async (p) => {
    await dev({ cmd: 'tp', ...p });
    await page.waitForFunction(
      (p) => Math.hypot(window.__eigen.state().x - p.x, window.__eigen.state().y - p.y) < 0.3,
      p,
    );
  };
  const home = await page.evaluate(() => window.__eigen.game.ext.atlas.navigation().point);
  await tp({ x: home.x + 0.5, y: home.y + 0.5 });
  await page.waitForFunction(() => [...window.__eigen.game.store.objects.values()].some((o) => o.sub === 'forge'));
  const forge = await page.evaluate(() => {
    const g = window.__eigen.game,
      p = g.predictor.sim,
      o = [...g.store.objects.values()]
        .filter((o) => o.sub === 'forge')
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    return { x: o.x, y: o.y };
  });
  await tp({ x: forge.x + 1.5, y: forge.y + 0.5 });
  for (const [id, n] of Object.entries({ iron_ingot: 13, wood: 4, fiber: 2, plank: 2, hide: 2, heartwood: 2, coal: 3 }))
    await dev({ cmd: 'give', id, n });
  await page.waitForFunction(() => window.__eigen.game.gameplay.profile.count('iron_ingot') >= 13);
  const point = await page.evaluate((o) => {
    const g = window.__eigen.game;
    return { x: g.world.x + (o.x - o.y) * 16 * g.scale, y: g.world.y + (o.x + o.y + 1) * 8 * g.scale };
  }, forge);
  await page.mouse.move(point.x, point.y);
  await page.waitForFunction(
    (o) => window.__eigen.game.input.mouseTile?.tx === o.x && window.__eigen.game.input.mouseTile?.ty === o.y,
    forge,
  );
  await page.evaluate((o) => window.__eigen.game.net.open(o.x, o.y), forge);
  const anvil = page.getByRole('dialog', { name: 'Anvil & Forge', exact: true });
  await anvil.waitFor();
  for (const name of ['Iron Spear', 'Broadhead Battle Axe', 'Iron Warhammer']) {
    const row = anvil.locator('.recipe').filter({ has: page.getByText(name, { exact: true }) });
    await row.getByRole('button', { name: '×1', exact: true }).click();
  }
  await page.waitForFunction(() =>
    ['spear', 'battle_axe', 'warhammer'].every((id) => window.__eigen.game.gameplay.profile.count(id) === 1),
  );
  assert(await anvil.evaluate((el) => el.scrollWidth <= el.clientWidth + 2), 'Forge patterns fit');
  assert(
    await anvil
      .locator('.rbtns button')
      .evaluateAll((els) =>
        els.every((el) => el.getBoundingClientRect().height >= 44 && el.getBoundingClientRect().width >= 44),
      ),
    'Craft controls have 44px targets',
  );
  await page.screenshot({ path: `${out}/forge.png` });
  await anvil.getByText('Interference forging · swords & tools', { exact: true }).click();
  assert(
    await anvil.getByRole('button', { name: '🔨 Strike the anvil', exact: true }).isVisible(),
    'Original interference forge still accessible',
  );
  await press('Escape');
  const openPack = async () => {
    await press('KeyI');
    await page.getByRole('dialog', { name: 'Pack', exact: true }).waitFor();
  };
  await openPack();
  const pack = page.getByRole('dialog', { name: 'Pack', exact: true }),
    equip = pack.getByRole('button', { name: 'Equip item', exact: true });
  const select = async (id) => {
    const i = await page.evaluate((id) => window.__eigen.game.gameplay.profile.inv.findIndex((s) => s?.id === id), id);
    assert(i >= 0);
    await pack.locator(`.slot[data-i="${i}"]`).click();
  };
  await select('spear');
  assert(await equip.isDisabled());
  assert.match(await pack.locator('.equip-lock').innerText(), /Requires level 3/);
  await dev({ cmd: 'level', level: 20 });
  await page.waitForFunction(() => window.__eigen.state().level === 20);
  await press('Escape');
  await page.evaluate(() => {
    const g = window.__eigen.game;
    window.__arsenal = { acks: [], local: [] };
    const reconcile = g.predictor.reconcile.bind(g.predictor);
    g.predictor.reconcile = (ack) => {
      window.__arsenal.acks.push({ cd: ack.sim.atkCd, combo: ack.sim.combo });
      return reconcile(ack);
    };
    for (const method of ['swing', 'heavy']) {
      const run = g.fx[method].bind(g.fx);
      g.fx[method] = (...args) => {
        window.__arsenal.local.push({ method, weapon: args[5], level: args[4] });
        return run(...args);
      };
    }
  });
  for (const [id, recovery] of [
    ['spear', 0.27],
    ['battle_axe', 0.36],
    ['warhammer', 0.5],
  ]) {
    await openPack();
    await select(id);
    const guide = pack.locator('.weapon-guide');
    await guide.locator('summary').click();
    assert.match(await guide.innerText(), new RegExp(`Base swing recovery: ${String(recovery).replace('.', '\\.')}`));
    await guide.locator('table').scrollIntoViewIfNeeded();
    if (id === 'warhammer') await page.screenshot({ path: `${out}/guide.png` });
    await equip.click();
    await page.waitForFunction((id) => window.__eigen.game.gameplay.profile.equip.weapon?.id === id, id);
    await press('Escape');
    // Select an empty or sword quick-bar slot so an idle tool does not intentionally obscure the main hand.
    const empty = await page.evaluate(() =>
      window.__eigen.game.gameplay.profile.inv.slice(0, 10).findIndex((s) => !s || s.id === 'sword'),
    );
    assert(empty >= 0);
    await page.locator(`.hslot[data-i="${empty}"]`).click();
    await page.waitForFunction((id) => {
      const g = window.__eigen.game;
      return g.views.get(g.myId)?.held?.texture.source === g.heldWeapons.texture(id, 0, 0).source;
    }, id);
    await page.waitForTimeout(900);
    await page.evaluate(() => (window.__arsenal.acks = []));
    const f = await page.evaluate(() => ({ ...window.__eigen.game.input.feetScreen }));
    await page.mouse.click(f.x + 85, f.y - 25);
    await page.waitForFunction(
      (id) =>
        window.__arsenal.local.some((f) => f.method === 'swing' && f.weapon === id) &&
        window.__arsenal.acks.some((a) => a.cd > 0),
      id,
    );
    await page.waitForTimeout(1000);
    await page.evaluate(() => (window.__arsenal.acks = []));
    await page.mouse.down();
    await page.waitForFunction(() => window.__eigen.game.predictor.sim.charge >= 0.8, null, { timeout: 20000 });
    await page.mouse.up();
    await page.waitForFunction(
      ([id, recovery]) =>
        window.__arsenal.acks.some((a) => a.cd > recovery + 0.04) &&
        window.__arsenal.local.some((f) => f.method === 'heavy' && f.weapon === id && f.level >= 0.99),
      [id, recovery],
    );
    await page.screenshot({ path: `${out}/${id}.png` });
    console.log('Craft/equip/tap/full heavy passed', id);
  }
  const failures = await page.evaluate(() => {
    const art = window.__eigen.game.heldWeapons,
      fail = [];
    for (const id of ['spear', 'battle_axe', 'warhammer'])
      for (let d = 0; d < 8; d++)
        for (let f = 0; f < 30; f++) {
          const t = art.texture(id, d, f),
            r = t.frame,
            data = t.source.resource.getContext('2d').getImageData(r.x, r.y, r.width, r.height).data;
          let count = 0,
            edge = 0;
          for (let y = 0; y < r.height; y++)
            for (let x = 0; x < r.width; x++)
              if (data[(y * r.width + x) * 4 + 3]) {
                count++;
                if (!x || !y || x === r.width - 1 || y === r.height - 1) edge++;
              }
          if (count < 12 || edge || art.texture(id, d, f) !== t || t.source.scaleMode !== 'nearest')
            fail.push({ id, d, f, count, edge });
        }
    return fail;
  });
  assert.deepEqual(failures, [], '720 new held frames visible, uncropped, nearest and cached');
  await page.reload();
  await page.waitForFunction(
    () => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.equip.weapon?.id === 'warhammer',
    null,
    { timeout: 60000 },
  );
  assert.deepEqual(errors, []);
  console.log(
    'Melee arsenal passed: real forge/craft, original forge access, level gate/equip, family guide, matching held art, predicted/server tap/full heavy, 720 frame bounds/cache, saved reload',
    out,
  );
} catch (e) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png` });
    console.log('Page errors', errors);
    console.log(
      'Arsenal state',
      JSON.stringify(
        await page.evaluate(() => {
          const g = window.__eigen?.game;
          return {
            window: g?.gameplay.wins.name,
            equip: g?.gameplay.profile.equip,
            sim: g?.predictor.sim,
            proof: window.__arsenal && {
              local: window.__arsenal.local,
              maxRecovery: Math.max(...window.__arsenal.acks.map((a) => a.cd)),
              acks: window.__arsenal.acks.slice(-5),
            },
          };
        }),
      ),
    );
  }
  throw e;
} finally {
  await browser.close();
}
