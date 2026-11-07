import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[3] ?? 'docs/validation/reference-fidelity';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto(process.argv[2] ?? 'http://localhost:5174/');
  const result = await page.evaluate(async () => {
    const { renderPersonCanvas, OUTFITS, PERSON_W, PERSON_H } = await import('/src/art/actors.ts');
    const { ACTION_START, actionKeys } = await import('/src/art/person-actions.ts');
    const { HeldWeapons, HELD_AX, HELD_AY } = await import('/src/art/weapons.ts');
    const { personGripOf } = await import('/src/art/body/index.ts');
    let frames = 0,
      heldFrames = 0;
    const failures = [];
    const sheet = document.createElement('canvas');
    sheet.width = 8 * PERSON_W * 2;
    sheet.height = 2 * Object.keys(ACTION_START).length * PERSON_H * 2;
    const ctx = sheet.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    function check(look, d, f) {
      const canvas = renderPersonCanvas(OUTFITS[look], d, f);
      const px = canvas.getContext('2d').getImageData(0, 0, PERSON_W, PERSON_H).data;
      let edge = 0,
        partial = 0,
        area = 0;
      for (let y = 0; y < PERSON_H; y++)
        for (let x = 0; x < PERSON_W; x++) {
          const a = px[(y * PERSON_W + x) * 4 + 3];
          if (a) {
            area++;
            if (a !== 255) partial++;
            if (!x || x === PERSON_W - 1 || !y) edge++;
          }
        }
      if (edge || partial || area < 100) failures.push({ look, d, f, edge, partial, area });
      frames++;
      return canvas;
    }
    for (const look of [0, 1]) {
      let row = 0;
      for (const action of Object.keys(ACTION_START)) {
        const keys = actionKeys(action);
        for (let d = 0; d < 8; d++) {
          for (const k of [keys[0], keys[4], keys[7]]) {
            const canvas = check(look, d, k);
            if (k === keys[4])
              ctx.drawImage(
                canvas,
                d * PERSON_W * 2,
                (look * Object.keys(ACTION_START).length + row) * PERSON_H * 2,
                PERSON_W * 2,
                PERSON_H * 2,
              );
          }
        }
        row++;
      }
    }
    for (let look = 0; look < OUTFITS.length; look++)
      for (let d = 0; d < 8; d++) for (const f of [0, 8, 21, 29]) check(look, d, f);
    const held = new HeldWeapons();
    for (const body of ['male', 'female'])
      for (let dir = 0; dir < 8; dir++) {
        for (const [id, action] of [
          ['pickaxe', 'mine'],
          ['axe', 'chop'],
          ['rod', 'fish'],
          ['sword', 'slash'],
        ]) {
          const f = actionKeys(action)[4],
            t = held.texture(id, dir, f, body),
            r = t.frame;
          const g = personGripOf(dir, f, 'R', body);
          const px = t.source.resource.getContext('2d').getImageData(r.x, r.y, r.width, r.height).data;
          const x = Math.round(g.x + HELD_AX - PERSON_W / 2),
            y = Math.round(g.y + HELD_AY - PERSON_H);
          let grip = 0;
          for (let oy = -2; oy <= 2; oy++)
            for (let ox = -2; ox <= 2; ox++) grip += px[((y + oy) * r.width + x + ox) * 4 + 3] ?? 0;
          if (!grip) failures.push({ body, dir, id, grip: false });
          const person = renderPersonCanvas(OUTFITS[body === 'female' ? 1 : 0], dir, f);
          const bodyPixels = person.getContext('2d').getImageData(0, 0, PERSON_W, PERSON_H).data;
          let hand = 0;
          for (let oy = -2; oy <= 2; oy++)
            for (let ox = -2; ox <= 2; ox++)
              hand += bodyPixels[((Math.round(g.y) + oy) * PERSON_W + Math.round(g.x) + ox) * 4 + 3] ?? 0;
          if (!hand) failures.push({ body, dir, id, bodyGrip: false });
          heldFrames++;
        }
      }
    return { report: { frames, heldFrames, failures, actions: Object.keys(ACTION_START) }, sheet: sheet.toDataURL() };
  });
  writeFileSync(`${out}/poses.json`, JSON.stringify(result.report, null, 2));
  writeFileSync(`${out}/poses.png`, Buffer.from(result.sheet.split(',')[1], 'base64'));
  console.log(JSON.stringify(result.report));
  assert.deepEqual(result.report.failures, []);
} finally {
  await browser.close();
}
