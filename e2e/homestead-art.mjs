import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const base = process.argv[2] ?? 'http://localhost:5176/',
  out = process.argv[3] ?? '/tmp/homestead-art';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
const report = { panels: [], art: null };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  for (const panel of ['guild', 'husbandry', 'settlement'])
    for (const [width, height] of [
      [1280, 720],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(new URL(`labs/uilab.html?panel=${panel}`, base).href);
      await page.waitForSelector(panel === 'husbandry' ? '.herd-panel' : '.guild-ledger');
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        width: document.documentElement.scrollWidth,
        text: document.body.innerText,
      }));
      assert.ok(layout.width <= layout.viewport, `${panel} horizontal overflow`);
      assert.ok(layout.text.includes(panel === 'guild' ? 'Mira' : panel === 'husbandry' ? 'Glimmerhart' : 'Hamlet'));
      if (panel === 'guild') {
        await page.getByRole('button', { name: 'Rank requirements', exact: true }).click();
        await page.getByRole('heading', { name: 'The Sixfold Covenant', exact: true }).scrollIntoViewIfNeeded();
        await page.getByRole('button', { name: 'My commissions', exact: true }).click();
      }
      await page.screenshot({ path: `${out}/${panel}-${width}.png` });
      report.panels.push({ panel, width, height });
    }
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto(new URL('labs/uilab.html?panel=none', base).href);
  report.art = await page.evaluate(
    async (sharedPath) => {
      const shared = await import(sharedPath);
      const { livestockCanvas } = await import('/src/art/livestock.ts');
      const { constructionCanvas } = await import('/src/art/construction.ts');
      const { orchardCanvas } = await import('/src/art/orchards.ts');
      const { worldObjDef } = await import('/src/art/worldobjs.ts');
      document.body.innerHTML = '';

      document.body.style =
        'background:#263b35;color:#efe1be;display:flex;flex-wrap:wrap;gap:12px;padding:12px;overflow:auto;height:auto';
      document.documentElement.style = 'overflow:auto;height:auto';
      const add = (label, canvas) => {
        const el = document.createElement('figure');
        el.style = 'margin:0;padding:8px;background:#31473e';
        const title = document.createElement('figcaption');
        title.textContent = label;
        el.append(title, canvas);
        canvas.style = 'image-rendering:pixelated;width:' + canvas.width * 3 + 'px;height:' + canvas.height * 3 + 'px';
        document.body.append(el);
      };
      const bounds = (canvas, label) => {
        const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let pixels = 0,
          edge = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++)
            if (d[(y * canvas.width + x) * 4 + 3]) {
              pixels++;
              if (x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) edge++;
            }
        if (!pixels || edge > 0) throw new Error(`${label} empty or cropped: ${pixels}/${edge}`);
      };
      for (const species of Object.keys(shared.LIVESTOCK))
        for (const frame of [0, 1, 2, 3])
          for (const facing of [0, 1, 2, 3]) {
            const c = livestockCanvas(species, frame, facing);
            bounds(c, species);
            if (frame === 0) add(species + ' · ' + facing, c);
          }
      for (const [id, d] of Object.entries(shared.BUILD_PIECES)) {
        for (const turn of [0, 1]) {
          const c = constructionCanvas(id, turn);
          if (
            !c
              .getContext('2d')
              .getImageData(0, 0, c.width, c.height)
              .data.some((v, i) => i % 4 === 3 && v)
          )
            throw new Error('Empty ' + id);
          if (turn === 0) add(d.name, c);
        }
      }
      for (const id of ['apple', 'pear', 'plum', 'grapes'])
        for (const dormant of [false, true]) {
          const d = {
            crop: id,
            planted: 0,
            growth: 6,
            watered: 0,
            lastDay: 0,
            owner: 'lab',
            established: true,
            dormant,
          };
          const c = orchardCanvas(shared.CROPS[id], d);
          bounds(c, id);
          add(id + (dormant ? ' dormant' : ' fruiting'), c);
        }
      const shapeSeen = new Set();
      let catalog = 0;
      for (const [id, spec] of Object.entries(shared.PROP_SPECS)) {
        for (const face of ['sw', 'se']) {
          const owner = Object.values(shared.ITEMS).find((item) => item.place?.sub === id);
          const d = worldObjDef({ x: 0, y: 0, kind: owner?.place?.kind ?? 'deco', sub: id }, face);
          if (!d) throw new Error('Missing art ' + id);
          for (const frame of d.frames) bounds(frame.tex.source.resource, id + ':' + face);
          if (!shapeSeen.has(spec.shape)) {
            add(id, d.frames[0].tex.source.resource);
            shapeSeen.add(spec.shape);
          }
          catalog++;
        }
      }
      for (const sub of ['guild_board', 'guild_desk', 'guild_clue'])
        for (const face of ['sw', 'se']) {
          const d = worldObjDef({ x: 0, y: 0, kind: 'deco', sub }, face);
          bounds(d.frames[0].tex.source.resource, sub + face);
          add(sub + ' ' + face, d.frames[0].tex.source.resource);
        }
      const { itemIconUrl } = await import('/src/art/icons.ts');
      let icons = 0;
      for (const id of Object.keys(shared.ITEMS)) {
        const img = new Image();
        img.src = itemIconUrl(id);
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.drawImage(img, 0, 0, 16, 16);
        const bytes = context.getImageData(0, 0, 16, 16).data;
        let visible = 0;
        for (let i = 3; i < bytes.length; i += 4) if (bytes[i]) visible++;
        if (visible < 4) throw new Error('Empty item icon ' + id);
        icons++;
      }
      return {
        icons,
        species: Object.keys(shared.LIVESTOCK).length,
        structures: Object.keys(shared.BUILD_PIECES).length,
        catalog,
        shapes: shapeSeen.size,
      };
    },
    '/@fs' + resolve('packages/shared/src/index.ts'),
  );
  await page.screenshot({ path: `${out}/art-gallery.png`, fullPage: true });
  await page.screenshot({ path: `${out}/gallery-top.png` });
  assert.deepEqual(errors, []);
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
