import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = '/tmp/eigenlands-world-upgrade'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1536, height: 1200 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}labs/artlab.html?lab=fauna&scale=3&motion=0`);
  await page.waitForFunction(() => window.__lab?.ready);
  const result = await page.evaluate(async () => {
    const { buildFoeSheets, ANIMS } = await import('/src/art/foes.ts');
    const { buildActorSheets } = await import('/src/art/actors.ts');
    const { HeldWeapons } = await import('/src/art/weapons.ts');
    const sharedUrl = performance.getEntriesByType('resource').find(e => /\/packages\/shared\/src\/index\.ts(?:\?|$)/.test(e.name)).name;
    const { NPCS, WEAPONS } = await import(sharedUrl);
    const failures = [], seen = new Map(); let frames = 0;
    const pixels = t => { const r = t.frame; return t.source.resource.getContext('2d').getImageData(r.x, r.y, r.width, r.height).data; };
    const check = (t, label) => {
      const data = pixels(t), w = t.width, h = t.height; let n = 0, edge = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) { n++; if (!x || !y || x === w - 1 || y === h - 1) edge++; }
      if (n < 8 || edge) failures.push({ label, n, edge }); frames++;
    };
    const fauna = buildFoeSheets();
    for (let k = 15; k <= 20; k++) for (const night of [false, true]) for (let d = 0; d < 4; d++) for (const a of ANIMS) for (let f = 0; f < fauna.frames(k, a); f++) check(fauna.frame(k, night, d, a, f), `fauna ${k}/${night}/${d}/${a}/${f}`);
    const held = new HeldWeapons();
    for (const id of [...Object.keys(WEAPONS), 'axe', 'pickaxe', 'hoe', 'can', 'rod', 'net']) for (let d = 0; d < 8; d++) for (let f = 0; f < 30; f++) {
      const t = held.texture(id, d, f); check(t, `held ${id}/${d}/${f}`);
      if (held.texture(id, d, f) !== t) failures.push({ label: `${id} cache miss` });
    }
    const actors = buildActorSheets();
    for (const n of NPCS.filter(n => n.settlement)) {
      const t = actors.npc(n.id, 0, 0); const signature = Array.from(pixels(t)).join(',');
      if (seen.has(signature)) failures.push({ label: `duplicate residents ${n.id}/${seen.get(signature)}` });
      seen.set(signature, n.id);
      if (t.source.height > 256 || t.source.width > 256) failures.push({ label: `${n.id} atlas too large` });
    }
    return { failures, frames, residents: seen.size };
  });
  assert.deepEqual(result.failures, [], 'All animation frames stay inside their bounds; each resident has a distinct sprite');
  assert.equal(result.residents, 40);
  const shrine = await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const { Container } = await import(resources.find(e => e.name.includes('/pixi__js.js')).name);
    const { ChunkStore } = await import(resources.find(e => /\/packages\/shared\/src\/index\.ts(?:\?|$)/.test(e.name)).name);
    const { WorldObjViews, setBuildingLights } = await import('/src/game/worldobjviews.ts');
    setBuildingLights(null);
    const store = new ChunkStore(1337), shadows = new Container(), layer = new Container();
    const views = new WorldObjViews(store, shadows, layer);
    const o = { x: 300, y: 300, kind: 'deco', sub: 'shrine_altar', static: true, data: { shrine: 'test-shrine' } };
    const sun = { dx: 1, len: 1, alpha: .3 };
    views.upsert(o); views.update(0, sun, true, 298, 298, 302, 302);
    const before = layer.children.some(c => c.visible), lights = views.lights(298, 298, 302, 302).length;
    views.setSolvedShrines(['test-shrine']); views.update(0, sun, true, 298, 298, 302, 302);
    const hidden = layer.children.every(c => !c.visible) && shadows.children.every(c => !c.visible);
    const afterLights = views.lights(298, 298, 302, 302).length;
    views.remove(300, 300); views.upsert(o); views.update(0, sun, true, 298, 298, 302, 302);
    return { before, lights, hidden, afterLights, hiddenOnReload: layer.children.every(c => !c.visible) };
  });
  assert.equal(shrine.before, true); assert.ok(shrine.lights > 0);
  assert.equal(shrine.hidden, true); assert.equal(shrine.afterLights, 0); assert.equal(shrine.hiddenOnReload, true);
  for (const [name, query] of [
    ['fauna', 'lab=fauna'], ['residents', 'lab=portfolks'], ['lumenport', 'lab=town&port=lumenport'],
    ['harbour', 'lab=town&port=lumenport&dy=25'], ['reedhaven', 'lab=town&port=reedhaven'],
    ['brinewick', 'lab=town&port=brinewick'], ['amberquay', 'lab=town&port=amberquay'], ['sloop', 'lab=ships'],
  ]) {
    await page.goto(`${base}labs/artlab.html?${query}&scale=3&motion=0`);
    await page.waitForFunction(() => window.__lab?.ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const png = await page.screenshot({ path: `${out}/${name}.png` }); assert.ok(png.length > 12000, `${name} rendered`);
  }
  assert.deepEqual(errors, []);
  console.log(`World upgrade: ${result.frames} animation frames, 40 distinct residents and eight rendered scenes passed. Screenshots: ${out}`);
} finally { await browser.close(); }
