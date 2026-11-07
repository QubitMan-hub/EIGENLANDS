import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out = 'docs/validation/cozy-bosses';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } }),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto((process.argv[2] ?? 'http://127.0.0.1:5244/') + '?dev=1&hour=12');
  await p.fill('#name', 'Cozy boss challenger');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 90000,
  });
  await p.evaluate(async () => {
    const g = window.__eigen.game,
      r = window.__eigenSolo.raw().find((r) => r.players.size);
    g.app.ticker.maxFPS = 24;
    g.ext.circuit.send('p3_tutorial', { action: 'skip' });
    for (let cy = 2; cy <= 3; cy++) for (let cx = 2; cx <= 3; cx++) await r.ensureChunk(cx, cy);
    for (let y = 72; y <= 112; y++)
      for (let x = 72; x <= 112; x++) {
        r.objects.remove(x, y);
        r.setTile(x, y, 3);
        r.store.get(Math.floor(x / 32), Math.floor(y / 32)).levels?.fill(0);
      }
    r.enemies.clear();
    r.state.enemies.clear();
    g.net.dev({ cmd: 'level', level: 40 });
    g.net.dev({ cmd: 'tp', x: 86.5, y: 90.5 });
  });
  await p.waitForFunction(
    () =>
      window.__eigen.state().level === 40 &&
      Math.hypot(window.__eigen.state().x - 86.5, window.__eigen.state().y - 90.5) < 0.2,
  );
  const summoned = await p.evaluate(() => {
    const r = window.__eigenSolo.raw().find((r) => r.players.size),
      hero = [...r.players.values()][0];
    hero.invuln = 999;
    window.__bossMechanics = { marks: [], strikes: [] };
    const fx = r.fx.bind(r),
      strike = r.enemyStrike.bind(r);
    r.fx = (f) => {
      if (f.kind === 'bomb') window.__bossMechanics.marks.push({ ...f, at: performance.now() });
      fx(f);
    };
    r.enemyStrike = (e, x, y, radius, mult) => {
      window.__bossMechanics.strikes.push({ id: e.id, x, y, radius, at: performance.now() });
      strike(e, x, y, radius, mult);
    };
    return r.bosses.summon(hero, 'colossus_core', 96, 92);
  });
  assert.equal(summoned, true, 'The real encounter module accepts this summoning site');
  await p.waitForFunction(() => window.__bossMechanics.marks.length >= 3, null, { timeout: 35000 });
  await p.screenshot({ path: out + '/colossus-warning.png' });
  await p.waitForFunction(
    () => window.__bossMechanics.marks.filter((m) => m.id.includes(':tactic:')).length >= 5,
    null,
    { timeout: 35000 },
  );
  await p.screenshot({ path: out + '/colossus-alternate-pattern.png' });
  await p.waitForTimeout(3000);
  const report = await p.evaluate(() => ({
    probe: window.__bossMechanics,
    text: window.__eigen.game.ext.adventure.announcement?.text,
  }));
  const original = report.probe.marks.filter((m) => !m.id.includes(':tactic:')).slice(0, 3);
  assert.equal(original.length, 3);
  for (const mark of original) {
    const hit = report.probe.strikes.find(
      (s) => Math.hypot(s.x - mark.x, s.y - mark.y) < 0.001 && Math.abs(s.radius - mark.w) < 0.001 && s.at > mark.at,
    );
    assert(hit, 'The actual hit stays on its original warned ground');
    assert(hit.at - mark.at >= mark.v * 1000 - 150);
  }
  assert(report.probe.marks.some((m) => m.id.includes(':tactic:')));
  assert(report.text.includes('Fractured crossing'));
  assert.deepEqual(errors, []);
  writeFileSync(out + '/live-combat.json', JSON.stringify({ ...report, errors }, null, 2));
  console.log(
    'PASS real registered boss: warning → fixed impacts → recovery → alternate pattern, synchronized announcement and no page errors',
  );
} finally {
  await b.close();
}
