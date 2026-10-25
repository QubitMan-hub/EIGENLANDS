import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/',
  out = process.argv[3] ?? '/tmp/click-mining';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let p;
const errors = [];
try {
  p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + '?dev=1&hour=12');
  await p.waitForSelector('#g-off:not([hidden])');
  await p.fill('#name', 'Click miner');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 90000,
  });
  await p.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 20;
    g.net.dev({ cmd: 'give', id: 'pickaxe', n: 1 });
  });
  await p.waitForFunction(() => window.__eigen.game.gameplay.profile.inv.some((s) => s?.id === 'pickaxe'));
  const site = await p.evaluate(() => {
    const g = window.__eigen.game;
    for (let y = -24; y < 24; y++)
      for (let x = -24; x < 24; x++) {
        if (g.store.getTile(x, y) !== 7 || g.store.objectAt(x, y) || g.store.structureAt(x, y)) continue;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          let ok = true;
          for (let i = 1; i <= 5; i++)
            if (g.store.solidAt(x + dx * i, y + dy * i) || g.store.objectAt(x + dx * i, y + dy * i)) ok = false;
          if (ok) return { tx: x, ty: y, x: x + dx * 5 + 0.5, y: y + dy * 5 + 0.5 };
        }
      }
  });
  assert(site, 'naturally generated isolated boulder');
  const tp = async (x, y) => {
    await p.waitForFunction(() => window.__eigen.game.predictor.sim.dashT <= 0);
    await p.evaluate(({ x, y }) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), { x, y });
    await p.waitForFunction(
      ({ x, y }) => Math.hypot(window.__eigen.state().x - x, window.__eigen.state().y - y) < 0.2,
      { x, y },
      { timeout: 30000 },
    );
    await p.waitForTimeout(900);
  };
  await tp(site.x, site.y);
  await p.evaluate(() => {
    const g = window.__eigen.game;
    g.gameplay.hotbar.select(g.gameplay.profile.inv.findIndex((s) => s?.id === 'pickaxe'));
    window.__uses = [];
    const use = g.net.use.bind(g.net);
    g.net.use = (m) => {
      window.__uses.push(m);
      use(m);
    };
  });
  const rockPoint = () =>
    p.evaluate(({ tx, ty }) => {
      const g = window.__eigen.game;
      for (const m of g.objects.chunks.values())
        for (const o of m.values())
          if (o.tx === tx && o.ty === ty) {
            const b = o.root.getBounds();
            for (let y = b.minY + 2; y < b.maxY - 2; y += 2)
              for (let x = b.minX + 2; x < b.maxX - 2; x += 2) {
                const hit = g.objects.pickMineable(x, y);
                if (hit?.tx === tx && hit?.ty === ty) return { x, y };
              }
            return null;
          }
      return null;
    }, site);
  await p.waitForFunction(({ tx, ty }) => {
    const g = window.__eigen.game;
    return [...g.objects.chunks.values()].some((m) => [...m.values()].some((o) => o.tx === tx && o.ty === ty));
  }, site);
  const click = await rockPoint();
  assert(click && click.x > 0 && click.x < 1280 && click.y > 0 && click.y < 720, 'rock sprite visible');
  const stone = await p.evaluate(() => window.__eigen.game.gameplay.profile.count('stone'));
  await p.mouse.click(click.x, click.y);
  await p.waitForFunction(({ tx, ty }) => window.__eigen.game.store.getTile(tx, ty) !== 7, site, { timeout: 25000 });
  assert(await p.evaluate((n) => window.__eigen.game.gameplay.profile.count('stone') > n, stone));
  assert(
    await p.evaluate(
      ({ tx, ty }) => window.__uses.length >= 2 && window.__uses.every((m) => m.tx === tx && m.ty === ty),
      site,
    ),
  );
  assert.equal(
    await p.evaluate(() => window.__eigen.game.gameplay.acts.attacked),
    false,
    'resource click must not attack',
  );
  await p.waitForTimeout(600);
  assert.equal(await p.evaluate(() => window.__eigen.game.mining.target), null);
  await p.screenshot({ path: `${out}/mined.png` });
  // A second natural node is cancelled by the actual Dodge key before tool use.
  const other = await p.evaluate(({ tx, ty }) => {
    const g = window.__eigen.game;
    for (let y = ty - 12; y <= ty + 12; y++)
      for (let x = tx - 12; x <= tx + 12; x++)
        if (g.store.getTile(x, y) === 7 && !g.store.objectAt(x, y))
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            let ok = true;
            for (let i = 1; i <= 5; i++) if (g.store.solidAt(x + dx * i, y + dy * i)) ok = false;
            if (ok) return { tx: x, ty: y, x: x + dx * 5 + 0.5, y: y + dy * 5 + 0.5 };
          }
  }, site);
  assert(other);
  await tp(other.x, other.y);
  const point = await p.evaluate(({ tx, ty }) => {
    const g = window.__eigen.game;
    return { x: g.world.x + (tx - ty) * 16 * g.scale, y: g.world.y + (tx + ty + 1) * 8 * g.scale };
  }, other);
  await p.mouse.click(point.x, point.y);
  await p.waitForFunction(() => !!window.__eigen.game.mining.target);
  const dash = await p.evaluate(() => window.__eigen.game.predictor.sim.dashN);
  await p.keyboard.press('ShiftLeft');
  await p.waitForFunction(() => !window.__eigen.game.mining.target);
  await p.waitForFunction((n) => window.__eigen.game.predictor.sim.dashN < n, dash);
  // Space talks through normal context routing and cannot spend a dodge charge.
  await p.keyboard.press('KeyL');
  await p.getByRole('button', { name: 'Track Hadamere', exact: true }).click();
  const home = await p.evaluate(() => window.__eigen.game.ext.atlas.navigation().point);
  await p.keyboard.press('Escape');
  await tp(home.x + 0.5, home.y + 0.5);
  await p.waitForFunction(() => !!window.__eigen.game.ext.atlas.state.npcs.get('orla'));
  const orla = await p.evaluate(() => {
    const n = window.__eigen.game.ext.atlas.state.npcs.get('orla');
    return { x: n.x + 0.7, y: n.y };
  });
  await tp(orla.x, orla.y);
  const charges = await p.evaluate(() => window.__eigen.game.predictor.sim.dashN);
  await p.waitForFunction(
    () => !!window.__eigen.game.npcNear(window.__eigen.game.predictor.sim.x, window.__eigen.game.predictor.sim.y, 1.3),
  );
  await p.keyboard.press('Space');
  await p.waitForSelector('.dialogue[data-npc="orla"]');
  assert((await p.evaluate(() => window.__eigen.game.predictor.sim.dashN)) >= charges);
  await p.keyboard.press('Escape');
  const cave = await p.evaluate(() => {
    const g = window.__eigen.game;
    for (let cy = -4; cy <= 4; cy++)
      for (let cx = -4; cx <= 4; cx++) {
        g.store.get(cx, cy);
        const o = [...g.store.objects.values()].find((o) => o.sub === 'cave_mouth');
        if (o) return { x: o.x, y: o.y };
      }
  });
  assert(cave, 'generated cave mouth');
  await tp(cave.x + 0.5, cave.y + 1.5);
  const aimTile = async (x, y) => {
    const q = await p.evaluate(
      ({ x, y }) => {
        const g = window.__eigen.game;
        return { x: g.world.x + (x - y) * 16 * g.scale, y: g.world.y + (x + y + 1) * 8 * g.scale };
      },
      { x, y },
    );
    await p.mouse.move(q.x, q.y);
    await p.waitForFunction(
      ({ x, y }) => window.__eigen.game.input.mouseTile?.tx === x && window.__eigen.game.input.mouseTile?.ty === y,
      { x, y },
    );
  };
  await aimTile(cave.x, cave.y);
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.__eigen.state().y > 39000, null, { timeout: 30000 });
  await p.waitForTimeout(1600);
  await aimTile(cave.x, cave.y + 40000);
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.__eigen.state().y < 39000, null, { timeout: 30000 });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: actual raised-sprite click, automatic approach and repeated server mining/loot, no combat attack, depleted-node stop, Shift cancellation/dodge and Space NPC/cave entry/exit interactions',
    site,
  );
} catch (e) {
  if (p) {
    console.log(
      await p.evaluate(() => {
        const g = window.__eigen?.game;
        return {
          keys: g?.input.keys,
          mining: g?.mining.target,
          uses: window.__uses,
          blocked: g?.input.blocked(),
          position: [g?.predictor.sim.x, g?.predictor.sim.y],
          prompt: g?.gameplay.prompt(),
          npcs: [...(g?.ext.atlas.state.npcs.values() ?? [])].map((n) => ({ id: n.id, x: n.x, y: n.y })),
          toasts: document.querySelector('#toasts')?.textContent,
        };
      }),
    );
    await p.screenshot({ path: `${out}/failure.png` });
  }
  throw e;
} finally {
  await b.close();
}
