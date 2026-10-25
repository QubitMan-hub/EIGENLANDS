import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = process.argv[2] ?? '/tmp/creature-art';
const baseline = process.argv.includes('--baseline');
const palette = readFileSync(new URL('../packages/shared/src/palette.ts', import.meta.url), 'utf8').match(
  /#[0-9a-f]{6}/g,
);
mkdirSync(out, { recursive: true });
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    if ((await fetch('http://127.0.0.1:5174/labs/artlab.html')).ok) break;
  } catch {
    /* Vite is starting. */
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1260, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5174/labs/artlab.html?lab=actors&motion=0');
  await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
  const report = await page.evaluate(async (PALETTE) => {
    const [{ Critters, companionPortrait }, { buildFoeSheets, ANIMS }, { buildActorSheets }] = await Promise.all([
      import('/src/art/critters.ts'),
      import('/src/art/foes.ts'),
      import('/src/art/actors.ts'),
    ]);
    const critters = await Critters.load(),
      foes = buildFoeSheets(),
      actors = buildActorSheets();
    document.body.replaceChildren();
    document.body.style.cssText =
      'margin:20px;background:#1c2630;color:#eee0bb;font:15px monospace;overflow:auto;height:auto';
    document.documentElement.style.cssText = 'height:auto;overflow:auto';
    const palette = new Set(PALETTE.map((s) => parseInt(s.slice(1), 16)));
    let pixels = 0,
      outsidePalette = 0,
      partialAlpha = 0,
      frames = 0;
    const seen = new Set(),
      sample = document.createElement('canvas'),
      ctx = sample.getContext('2d', { willReadFrequently: true });
    const check = (texture) => {
      // Each cached atlas is checked once, including every facing and animation, not just the displayed poses.
      const source = texture.source.resource;
      if (seen.has(source)) return;
      seen.add(source);
      sample.width = source.width;
      sample.height = source.height;
      ctx.drawImage(source, 0, 0);
      const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
      for (let i = 0; i < data.length; i += 4)
        if (data[i + 3]) {
          pixels++;
          if (data[i + 3] !== 255) partialAlpha++;
          if (!palette.has((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])) outsidePalette++;
        }
    };
    const group = (title, textures, anchor) => {
      const section = document.createElement('section'),
        heading = document.createElement('h3');
      section.style.cssText = 'display:inline-block;margin:0 12px 12px 0;vertical-align:top';
      heading.textContent = title;
      heading.style.margin = '8px 0';
      section.append(heading);
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 100;
      canvas.style.cssText = 'width:480px;height:200px;image-rendering:pixelated;background:#45694c';
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      textures.forEach((t, i) => {
        const x = 30 + i * 60,
          y = 82,
          f = t.frame,
          a = anchor(t);
        g.fillStyle = '#203b35';
        g.beginPath();
        g.ellipse(x, y, 12, 4, 0, 0, Math.PI * 2);
        g.fill();
        g.drawImage(
          t.source.resource,
          f.x,
          f.y,
          f.width,
          f.height,
          Math.round(x - a.x * f.width),
          Math.round(y - a.y * f.height),
          f.width,
          f.height,
        );
        g.fillStyle = '#dde0ab';
        g.fillRect(x, y + 4, 1, 1);
      });
      section.append(canvas);
      document.body.append(section);
    };
    group(
      'Human scale reference · 24 × 32',
      [0, 2, 4, 6].map((d) => actors.person(0, d, 0)),
      () => ({ x: 0.5, y: 1 }),
    );
    const layouts = {};
    for (const anim of ANIMS)
      for (let dir = 0; dir < 4; dir++) {
        check(critters.stormbound.frame(dir, anim, 0));
      }
    for (const anim of ['idle', 'windup', 'attack', 'death'])
      group(
        `Veyr · ${anim}`,
        [0, 1, 2, 3].map((dir) => critters.stormbound.frame(dir, anim, 0)),
        () => ({ x: 0.5, y: 86 / 96 }),
      );
    for (const id of ['boar', 'stag', 'badger', 'wolf']) {
      const dirs = ['SE', 'SW', 'NE', 'NW'];
      group(
        id,
        dirs.map((d) => critters.frame(id, 'idle', d, 0)),
        () => critters.anchor(id),
      );
      for (const anim of id === 'boar'
        ? ['idle', 'run']
        : id === 'stag'
          ? ['idle', 'walk', 'run']
          : id === 'badger'
            ? ['idle', 'walk', 'burrow', 'tunnel', 'unburrow']
            : ['idle', 'run', 'bite', 'howl', 'death']) {
        for (const dir of dirs)
          for (let f = 0; f < critters.length(id, anim); f++) {
            const texture = critters.frame(id, anim, dir, f),
              idle = critters.frame(id, 'idle', 'SE', 0);
            if (
              texture.width !== idle.width ||
              texture.height !== idle.height ||
              texture.source.scaleMode !== 'nearest'
            )
              throw Error(`${id} changed frame geometry or filtering`);
            check(texture);
            frames++;
          }
      }
      const t = critters.frame(id, 'idle', 'SE', 0);
      layouts[id] = { width: t.width, height: t.height, anchor: critters.anchor(id) };
    }
    for (const k of [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      ...Array.from({ length: 6 }, (_, i) => i + 15),
      ...Array.from({ length: 11 }, (_, i) => i + 22),
    ]) {
      group(
        `Creature ${k}`,
        [0, 1, 2, 3].map((d) => foes.frame(k, false, d, 'idle', 0)),
        () => ({ x: 0.5, y: foes.anchor(k) }),
      );
      for (const night of [false, true])
        for (const anim of ANIMS)
          for (let d = 0; d < 4; d++)
            for (let f = 0; f < foes.frames(k, anim); f++) {
              check(foes.frame(k, night, d, anim, f));
              frames++;
            }
    }
    group(
      'Projectile cues · hostile / reflected',
      [false, true, false, true].map((r, i) => foes.orb(r, i % 2)),
      () => ({ x: 0.5, y: 0.5 }),
    );
    for (const r of [false, true]) for (const f of [0, 1]) check(foes.orb(r, f));
    const portraits = [7, 9, 3].map((k) => companionPortrait(k));
    return {
      pixels,
      outsidePalette,
      partialAlpha,
      frames,
      layouts,
      portraits: portraits.map((p) => ({ width: p.width, height: p.height, normalized: p.url.startsWith('data:') })),
    };
  }, palette);
  await page.screenshot({ path: `${out}/gallery.png`, fullPage: true });
  await page.screenshot({ path: `${out}/animals.png`, clip: { x: 0, y: 0, width: 1040, height: 620 } });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: `${out}/landscape.png` });
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  if (!baseline) {
    assert.equal(report.outsidePalette, 0);
    assert.equal(report.partialAlpha, 0);
    assert.ok(report.portraits.every((p) => p.normalized));
  }
  console.log(report);
} finally {
  await browser.close();
}
