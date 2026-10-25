import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const out = process.argv[2] ?? '/tmp/mine-art';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://127.0.0.1:5174/labs/artlab.html?lab=resources');
  await p.waitForFunction(() => window.__lab?.ready);
  await p.screenshot({ path: `${out}/ores.png` });
  const report = await p.evaluate(async () => {
    const [{ worldObjDef }, { diningChair }, { railSprite, minecartSprite }] = await Promise.all([
      import('/src/art/worldobjs.ts'),
      import('/src/art/props.ts'),
      import('/src/art/mining.ts'),
    ]);
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:16px;background:#26302d;color:#f2e8d1;font:14px monospace;overflow:auto';
    document.documentElement.style.cssText = 'height:auto;overflow:auto';
    const add = (title, items) => {
      const h = document.createElement('h2');
      h.textContent = title;
      document.body.append(h);
      const row = document.createElement('section');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px';
      document.body.append(row);
      return items.map(([label, a]) => {
        const wrap = document.createElement('div'),
          c = document.createElement('canvas');
        c.width = 96;
        c.height = 80;
        c.style.cssText = 'width:192px;height:160px;image-rendering:pixelated;background:#43564b';
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#536858';
        ctx.beginPath();
        ctx.moveTo(48, 56);
        ctx.lineTo(64, 64);
        ctx.lineTo(48, 72);
        ctx.lineTo(32, 64);
        ctx.fill();
        const t = a.tex,
          f = t.frame;
        ctx.drawImage(t.source.resource, f.x, f.y, f.width, f.height, 48 - a.ax, 64 - a.ay, f.width, f.height);
        wrap.append(c, document.createElement('br'), document.createTextNode(label));
        row.append(wrap);
        return c.toDataURL();
      });
    };
    add(
      'Isometric survey boards, noticeboard, street lantern and table lamp',
      ['cave_waymark', 'cave_archive', 'board', 'street_lamp', 'lamp'].map((sub) => [
        sub,
        worldObjDef({ x: 0, y: 0, kind: sub.includes('cave_') || sub === 'board' ? 'sign' : 'deco', sub }).frames[0],
      ]),
    );
    const chairs = add(
      'Chairs physically face all four table directions',
      [0, 1, 2, 3].map((n) => ['Facing ' + n, diningChair(n)]),
    );
    add(
      'Connected rails and original iron minecarts',
      [5, 10, 3, 6, 12, 9].map((mask) => ['Rail ' + mask, railSprite(mask)]),
    );
    add(
      'Cart · horizontal / vertical / depot',
      [0, 1, 2].map((n) => ['Cart ' + n, minecartSprite(n === 1 ? 1 : 0, n === 2)]),
    );
    const { WorldObjViews } = await import('/src/game/worldobjviews.ts');
    const pixiUrl = performance.getEntriesByType('resource').find((e) => /pixi_+js\.js/.test(e.name)).name;
    const { Container } = await import(pixiUrl),
      objects = new Map(),
      store = { seed: 1337, objects, objectAt: (x, y) => objects.get(`${x},${y}`), getTile: () => 20 };
    const views = new WorldObjViews(store, new Container(), new Container()),
      seat = { x: 0, y: 0, kind: 'furniture', sub: 'chair' },
      table = { x: 1, y: 0, kind: 'furniture', sub: 'table' };
    objects.set('0,0', seat);
    views.upsert(seat);
    const pixels = (def) => def.frames[0].tex.source.resource.toDataURL(),
      before = pixels(views.views.get('0,0').def);
    objects.set('1,0', table);
    views.upsert(table);
    const turned = pixels(views.views.get('0,0').def) === pixels(worldObjDef(seat, 'sw', 3));
    objects.delete('1,0');
    views.remove(1, 0);
    const restored = pixels(views.views.get('0,0').def) === before;
    return { distinctChairs: new Set(chairs).size, chairsRefresh: turned && restored, turned, restored };
  });
  console.log(report);
  assert.equal(report.distinctChairs, 4);
  assert.equal(report.chairsRefresh, true);
  await p.screenshot({ path: `${out}/infrastructure.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS native ore blocks, sign aliases, four physical chair facings, lamps, connected rails and cart gallery',
    report,
  );
} finally {
  await b.close();
}
