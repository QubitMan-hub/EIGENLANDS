import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const out = process.argv[2] ?? '/tmp/gather-art';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  await p.goto('http://127.0.0.1:5174/labs/artlab.html?props=bed');
  await p.waitForFunction(() => window.__lab?.ready);
  const report = await p.evaluate(async () => {
    const [{ PROPS }, { buildActorSheets }, { HeldWeapons }, { buildFoeSheets }] = await Promise.all([
      import('/src/art/props.ts'),
      import('/src/art/actors.ts'),
      import('/src/art/weapons.ts'),
      import('/src/art/foes.ts'),
    ]);
    document.querySelectorAll('canvas').forEach((c) => c.remove());
    document.body.style.cssText = 'margin:16px;background:#23332f;color:#f4e9cb;font:14px monospace;overflow:auto';
    document.documentElement.style.cssText = 'height:auto;overflow:auto';
    const draw = (c, t, x, y) => {
      const f = t.frame;
      c.drawImage(t.source.resource, f.x, f.y, f.width, f.height, x, y, f.width, f.height);
    };
    const section = (id, title) => {
      const h = document.createElement('h2');
      h.textContent = title;
      document.body.append(h);
      const s = document.createElement('section');
      s.id = id;
      s.style.cssText = 'display:grid;grid-template-columns:repeat(8,160px);gap:8px;width:max-content';
      document.body.append(s);
      return s;
    };
    const cell = (s, label, paint) => {
      const d = document.createElement('div'),
        c = document.createElement('canvas');
      c.width = c.height = 80;
      c.style.cssText = 'width:160px;height:160px;image-rendering:pixelated;background:#39483d';
      paint(c.getContext('2d'));
      d.append(c, document.createTextNode(label));
      s.append(d);
    };
    const beds = section('beds', 'Beds · both wall orientations');
    for (const f of ['sw', 'se'])
      cell(beds, f, (c) => {
        const a = PROPS.bed(f).frames[0];
        draw(c, a.tex, 40 - a.ax, 65 - a.ay);
      });
    const held = section('held', 'Shared animated grip · idle / contact frame');
    const actors = buildActorSheets(),
      weapons = new HeldWeapons();
    for (const id of ['axe', 'pickaxe', 'hoe', 'can', 'rod', 'sword'])
      for (const frame of [0, 27])
        for (const dir of [0, 1, 2, 3])
          cell(held, `${id} d${dir} f${frame}`, (c) => {
            const body = actors.person(0, dir, frame),
              item = weapons.texture(id, dir, body.frame.x / 24),
              rear = dir === 1 || dir >= 6;
            if (rear) draw(c, item, 12, 10);
            draw(c, body, 28, 26);
            if (!rear) draw(c, item, 12, 10);
          });
    const enemies = section('enemies', 'New encounters · original models and directional animation');
    const foes = buildFoeSheets();
    for (const kind of [22, 23])
      for (const anim of ['idle', 'windup', 'move', 'death'])
        for (const dir of [0, 1, 2, 3])
          cell(enemies, `${kind} ${anim} d${dir}`, (c) => {
            const a = foes.frame(kind, false, dir, anim, anim === 'death' ? 3 : 1);
            draw(c, a, 40 - a.width / 2, 65 - a.height * foes.anchor(kind));
          });
    return { beds: 2, held: 48, enemies: 32, enemyCounts: [foes.frames(22, 'move'), foes.frames(23, 'windup')] };
  });
  for (const id of ['beds', 'held', 'enemies']) await p.locator('#' + id).screenshot({ path: `${out}/${id}.png` });
  assert.equal(report.enemies, 32);
  console.log('PASS', report);
} finally {
  await b.close();
}
