import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out = 'docs/validation/directional-people';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const p = await b.newPage();
  await p.goto(process.argv[2] ?? 'http://127.0.0.1:5174/');
  const r = await p.evaluate(async () => {
    const { ITEMS } = await import('/@fs/workspace/EIGENLANDS/packages/shared/src/index.ts');
    const { itemIconCanvas } = await import('/src/art/icons.ts');
    const { ISO_ICONS } = await import('/src/art/isometric-icons.ts');
    const { TOWN_DECO } = await import('/src/art/town.ts');
    const { HeldWeapons } = await import('/src/art/weapons.ts');
    const { renderPersonCanvas, OUTFITS, PERSON_W, PERSON_H } = await import('/src/art/actors.ts');
    const { actionFrame } = await import('/src/art/person-actions.ts');
    const canvas = document.createElement('canvas');
    canvas.width = 1152;
    canvas.height = 1000;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#34484a';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#f1dfba';
    c.font = '18px monospace';
    c.fillText('ISOMETRIC TOOLS · ICONS · FOUNDER', 20, 28);
    const failures = [],
      icons = [];
    for (const [id, d] of Object.entries(ITEMS)) {
      const icon = itemIconCanvas(id),
        a = icon.getContext('2d').getImageData(0, 0, 16, 16).data;
      let area = 0,
        partial = 0;
      for (let i = 3; i < a.length; i += 4) {
        if (a[i]) area++;
        if (a[i] && a[i] !== 255) partial++;
      }
      if (!area || partial) failures.push({ id, area, partial });
      if (ISO_ICONS[d.icon.g] && !icons.some((v) => v.glyph === d.icon.g)) icons.push({ id, glyph: d.icon.g, area });
    }
    icons.forEach((v, i) => {
      const x = (i % 10) * 112 + 16,
        y = Math.floor(i / 10) * 98 + 48;
      c.drawImage(itemIconCanvas(v.id), x, y, 64, 64);
      c.fillStyle = '#f1dfba';
      c.font = '11px monospace';
      c.fillText(v.glyph, x, y + 78);
    });
    const held = new HeldWeapons();
    for (let dir = 0; dir < 8; dir++)
      for (let k = 0; k < 2; k++) {
        const frame = actionFrame(k ? 'chop' : 'mine', 0.5, false),
          tool = held.texture(k ? 'axe' : 'pickaxe', dir, frame, k ? 'female' : 'male');
        const x = dir * 128 + 16,
          y = 400 + k * 150;
        c.drawImage(renderPersonCanvas(OUTFITS[k], dir, frame), x, y, PERSON_W * 2, PERSON_H * 2);
        const f = tool.frame;
        c.drawImage(
          tool.source.resource,
          f.x,
          f.y,
          f.width,
          f.height,
          x + (PERSON_W / 2 - 32) * 2,
          y + (PERSON_H - 60) * 2,
          f.width * 2,
          f.height * 2,
        );
      }
    const statue = TOWN_DECO.statue().frames[0];
    c.drawImage(statue.tex.source.resource, 800, 680, statue.tex.width, statue.tex.height);
    return {
      image: canvas.toDataURL(),
      report: {
        icons: Object.keys(ITEMS).length,
        physicalGlyphs: icons,
        failures,
        statueAnchor: [statue.ax, statue.ay],
      },
    };
  });
  writeFileSync(out + '/tools-statue.png', Buffer.from(r.image.split(',')[1], 'base64'));
  writeFileSync(out + '/icons.json', JSON.stringify(r.report, null, 2));
  assert.deepEqual(r.report.failures, []);
  console.log(JSON.stringify(r.report));
} finally {
  await b.close();
}
