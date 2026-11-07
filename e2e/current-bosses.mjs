import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out = 'docs/validation/current-bosses';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const p = await browser.newPage({ viewport: { width: 1250, height: 950 } });
  await p.goto(process.argv[2] ?? 'http://localhost:5174/');
  const r = await p.evaluate(async () => {
    const { BOSSES } = await import('/@fs/workspace/EIGENLANDS/packages/shared/src/index.ts');
    const { default: manifest } = await import('/src/art/boss-manifest.json?import');
    const { buildBestiary } = await import('/src/ui/bestiary.ts');
    const profile = { bestiary: new Set() };
    const view = buildBestiary(profile, { query: '', category: 'bosses', limit: 24, open: new Set() });
    document.body.replaceChildren(view);
    document.body.style.cssText = 'background:#263a3d;color:#f1dfbc;overflow:auto;height:auto;margin:12px';
    document.documentElement.style.cssText = 'overflow:auto;height:auto';
    const count = view.querySelectorAll('.bestiary-entry').length;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1280;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#263a3d';
    c.fillRect(0, 0, 1200, 1280);
    c.fillStyle = '#f1dfbc';
    c.font = 'bold 24px monospace';
    c.fillText(`CURRENT IN-GAME BOSSES · ${Object.keys(BOSSES).length}`, 24, 36);
    let i = 0;
    for (const boss of Object.values(BOSSES)) {
      const a = manifest.atlases[boss.id],
        image = new Image();
      image.src = `/art/bestiary/${boss.id}-day.png`;
      await image.decode();
      const x = (i % 4) * 300,
        y = Math.floor(i / 4) * 300 + 60;
      c.fillStyle = '#1c2b30';
      c.fillRect(x + 8, y + 8, 284, 282);
      const k = Math.max(1, Math.min(2, Math.floor(260 / Math.max(a.w, a.h))));
      c.drawImage(image, 0, 0, a.w, a.h, x + (300 - a.w * k) / 2, y + 230 - a.ay * k, a.w * k, a.h * k);
      c.fillStyle = '#f1dfbc';
      c.font = 'bold 13px monospace';
      const words = boss.name.split(' ');
      let line = '',
        row = 0;
      for (const word of words) {
        if (c.measureText(`${line} ${word}`).width > 260) {
          c.fillText(line, x + 18, y + 250 + row++ * 16);
          line = word;
        } else line += `${line ? ' ' : ''}${word}`;
      }
      c.fillText(line, x + 18, y + 250 + row * 16);
      c.font = '12px monospace';
      c.fillStyle = '#a9c3b7';
      c.fillText(`Rite level ${boss.level}`, x + 18, y + 282);
      i++;
    }
    return {
      image: canvas.toDataURL(),
      count,
      bosses: Object.values(BOSSES).map((b) => ({ id: b.id, name: b.name, level: b.level, item: b.item })),
    };
  });
  assert.equal(r.count, r.bosses.length);
  writeFileSync(`${out}/gallery.png`, Buffer.from(r.image.split(',')[1], 'base64'));
  writeFileSync(`${out}/roster.json`, JSON.stringify({ bosses: r.bosses, galleryCards: r.count }, null, 2));
  await p.screenshot({ path: `${out}/in-game-gallery.png`, fullPage: true });
  console.log(`PASS all ${r.count} current bosses shown from their shipped in-game atlases`);
} finally {
  await browser.close();
}
