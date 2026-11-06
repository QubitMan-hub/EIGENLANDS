import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'docs/validation/grounding';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } }),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${process.argv[2] ?? 'http://127.0.0.1:5244/'}?dev=1&hour=12`);
  await p.fill('#name', 'Grounding audit');
  await p.click('#btn-guest');
  await p.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
    timeout: 120000,
  });
  await p.evaluate(() => window.__eigen.game.ext.circuit.send('p3_tutorial', { action: 'skip' }));
  await p.waitForTimeout(1000);
  const phases = [];
  for (const hour of [7, 12, 17]) {
    await p.evaluate((h) => (window.__eigen.game.hourOverride = h), hour);
    await p.waitForTimeout(500);
    const report = await p.evaluate(() => {
      const g = window.__eigen.game,
        objects = [];
      const check = (kind, v) => {
        if (!v.root.visible || !v.contact?.visible) return;
        objects.push({
          kind,
          x: v.root.x,
          y: v.root.y,
          contactError: Math.hypot(v.root.x - v.contact.x, v.root.y - v.contact.y),
          castError: Math.hypot(v.root.x - v.shadow.x, v.root.y - v.shadow.y),
          skew: v.shadow.skew.x,
          scaleY: v.shadow.scale.y,
        });
      };
      for (const m of g.objects.chunks.values()) for (const o of m.values()) check(o.kind, o);
      for (const v of g.worldObjs.views.values()) check(v.obj.sub, v);
      for (const v of g.views.values()) check(v.type, v);
      return objects;
    });
    assert.ok(report.some((v) => v.kind === 'tree'));
    assert.ok(report.some((v) => v.kind === 'player'));
    assert.ok(report.every((v) => v.contactError < 0.01 && v.castError < 0.01));
    phases.push({ hour, objects: report });
    await p.screenshot({ path: `${out}/hour-${hour}.png` });
  }
  assert.notEqual(
    phases[0].objects.find((v) => v.kind === 'tree').skew,
    phases[2].objects.find((v) => v.kind === 'tree').skew,
  );
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify({ phases, errors }, null, 2));
  console.log(
    'PASS visible objects, props and actors share foot anchors at three sun angles; cast direction changes; no page errors',
  );
} finally {
  await b.close();
}
