import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const out = process.argv[2] ?? '/tmp/cave-materials-art';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  await p.goto('http://127.0.0.1:5174/labs/artlab.html');
  await p.waitForFunction(() => window.__lab?.ready);
  const report = await p.evaluate(async () => {
    const [{ caveArchitecture }, { treasureChest }, { buildFoeSheets }, { buildBuildingArt }] = await Promise.all([
      import('/src/art/caves.ts'),
      import('/src/art/props.ts'),
      import('/src/art/foes.ts'),
      import('/src/art/buildings.ts'),
    ]);
    document.querySelectorAll('canvas').forEach((c) => c.remove());
    document.body.style.cssText = 'margin:16px;background:#23332f;color:#f4e9cb;font:14px monospace;overflow:auto';
    document.documentElement.style.cssText = 'height:auto;overflow:auto';
    const section = (id, title) => {
      const h = document.createElement('h2');
      h.textContent = title;
      document.body.append(h);
      const s = document.createElement('section');
      s.id = id;
      s.style.cssText = 'display:grid;grid-template-columns:repeat(6,224px);gap:8px;width:max-content';
      document.body.append(s);
      return s;
    };
    const draw = (s, label, a) => {
      const d = document.createElement('div'),
        c = document.createElement('canvas');
      c.width = c.height = 112;
      c.style.cssText = 'width:224px;height:224px;image-rendering:pixelated;background:#39483d';
      const t = a.tex,
        f = t.frame;
      c.getContext('2d').drawImage(
        t.source.resource,
        f.x,
        f.y,
        f.width,
        f.height,
        56 - a.ax,
        101 - a.ay,
        f.width,
        f.height,
      );
      d.append(c, document.createTextNode(label));
      s.append(d);
      return c;
    };
    const nature = section('nature', 'Original cave architecture, water, magma and luminous fungi');
    for (const sub of ['glow_mushrooms', 'cave_waterfall', 'magma_fall', 'bell_pylon', 'sea_arch', 'cave_seal']) {
      const a = caveArchitecture(sub);
      draw(nature, sub, a.frames[0]);
    }
    const chests = section('chests', 'Wood / vault / salvaged sea chests · physically hinged lid poses');
    let hashes = new Set();
    for (const theme of ['wood', 'vault', 'sea'])
      for (const face of ['sw', 'se'])
        for (let frame = 0; frame < 4; frame++) {
          const c = draw(chests, `${theme} ${face} pose ${frame}`, treasureChest(face, frame, theme));
          if (theme === 'wood' && face === 'sw') {
            let h = 0;
            for (const v of c.getContext('2d').getImageData(0, 0, 112, 112).data) h = Math.imul(h ^ v, 16777619);
            hashes.add(h);
          }
        }
    const boss = section('boss', 'The Hollow Bellkeeper · larger hollow iron armor, skull, claws and chains');
    const before = performance.now(),
      foes = buildFoeSheets();
    for (const anim of ['idle', 'windup', 'attack', 'death'])
      for (let dir = 0; dir < 4; dir++) {
        const t = foes.frame(32, false, dir, anim, anim === 'death' ? 3 : 1);
        draw(boss, `${anim} ${dir}`, { tex: t, ax: t.width / 2, ay: t.height * foes.anchor(32) });
      }
    const bossBakeMs = Math.round(performance.now() - before);
    const homes = section('homes', 'Realm architecture · unchanged surface / barrel vault / submerged shell');
    homes.style.gridTemplateColumns = 'repeat(3,400px)';
    for (const [name, y] of [
      ['Surface', 0],
      ['Undercroft', 40000],
      ['Submerged', -120000],
    ]) {
      const art = buildBuildingArt({
        id: 'realm-review',
        kind: 'house',
        x: 0,
        y,
        w: 7,
        h: 6,
        doorX: 3,
        doorY: y + 5,
        style: 0,
      });
      const d = document.createElement('div'),
        c = document.createElement('canvas');
      c.width = 400;
      c.height = 330;
      c.style.cssText = 'width:400px;height:330px;image-rendering:pixelated';
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const pieces = [
        ...art.walls.map((w) => ({ tex: w.day, x: w.x, y: w.y })),
        { tex: art.roof.tex, x: art.roof.x, y: art.roof.y },
      ];
      for (const a of pieces) {
        const f = a.tex.frame;
        ctx.drawImage(
          a.tex.source.resource,
          f.x,
          f.y,
          f.width,
          f.height,
          200 + a.x + y * 16,
          190 + a.y - y * 8,
          f.width,
          f.height,
        );
      }
      d.append(c, document.createTextNode(name));
      homes.append(d);
    }
    return { chestPoses: hashes.size, bossBakeMs, bossFrame: foes.frame(32, false, 0, 'idle', 0).width };
  });
  for (const id of ['nature', 'chests', 'boss', 'homes'])
    await p.locator('#' + id).screenshot({ path: `${out}/${id}.png` });
  assert.equal(report.chestPoses, 4);
  assert.equal(report.bossFrame, 96);
  console.log('PASS', report);
} finally {
  await b.close();
}
