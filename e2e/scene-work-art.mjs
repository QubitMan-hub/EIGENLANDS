import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[3] ?? 'docs/validation/arrival-work-actions';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const p = await b.newPage();
  await p.goto(process.argv[2] ?? 'http://localhost:5174');
  const r = await p.evaluate(async () => {
    const { PERSON_H, PERSON_W, renderPersonCanvas, OUTFITS } = await import('/src/art/actors.ts');
    const { actionKeys } = await import('/src/art/person-actions.ts');
    const { carryPlacement, propGrip } = await import('/src/art/scene-contact.ts');
    const props = await import('/src/art/scene-props.ts');
    const c = document.createElement('canvas');
    c.width = 8 * 96 * 2;
    c.height = 8 * 112 * 2;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#bac1b2';
    ctx.fillRect(0, 0, c.width, c.height);
    const failures = [];
    let grips = 0;
    const variants = [
      ['carry', 'sack'],
      ['carry_one', 'bucket'],
      ['sweep', 'broom'],
      ['lute', 'lute'],
    ];
    for (let body = 0; body < 2; body++)
      for (let row = 0; row < variants.length; row++)
        for (let dir = 0; dir < 8; dir++) {
          const [action, kind] = variants[row],
            f = actionKeys(action)[4];
          const pl = carryPlacement(kind, dir, f, 1, 1, body ? 'female' : 'male');
          const art =
            kind === 'sack'
              ? props.sackSprite()
              : kind === 'bucket'
                ? props.bucketSprite()
                : kind === 'broom'
                  ? props.broomSprite(1, pl.face)
                  : props.luteSprite(pl.face);
          const gp = propGrip(kind, 1, pl.face),
            tex = art.tex,
            fr = tex.frame;
          const img = tex.source.resource.getContext('2d').getImageData(fr.x, fr.y, fr.width, fr.height);
          const x = Math.round(art.ax + gp.x),
            y = Math.round(art.ay + gp.y);
          let opaque = false;
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) if (img.data[((y + dy) * fr.width + x + dx) * 4 + 3]) opaque = true;
          if (!opaque) failures.push({ kind, dir, body, grip: [x, y] });
          grips++;
          const person = renderPersonCanvas({ ...OUTFITS[0], body: body ? 'female' : 'male' }, dir, f);
          const bx = dir * 192 + 96,
            by = (body * 4 + row) * 224 + 190;
          const draw = () =>
            ctx.drawImage(
              tex.source.resource,
              fr.x,
              fr.y,
              fr.width,
              fr.height,
              bx + (pl.x - art.ax) * 2,
              by + (pl.y - art.ay) * 2,
              fr.width * 2,
              fr.height * 2,
            );
          if (pl.behind) draw();
          ctx.drawImage(person, bx - PERSON_W, by - PERSON_H * 2, PERSON_W * 2, PERSON_H * 2);
          if (!pl.behind) draw();
          ctx.fillStyle = '#1c2630';
          ctx.font = '12px monospace';
          ctx.fillText(`${body ? 'F' : 'M'} ${kind} ${dir}`, dir * 192 + 8, (body * 4 + row) * 224 + 18);
        }
    return { image: c.toDataURL(), grips, failures };
  });
  assert.deepEqual(r.failures, []);
  writeFileSync(`${out}/carried-props.png`, Buffer.from(r.image.split(',')[1], 'base64'));
  writeFileSync(`${out}/grips.json`, JSON.stringify({ grips: r.grips, failures: r.failures }, null, 2));
  console.log(`PASS ${r.grips} visible model grips and body/prop composites`);
} finally {
  await b.close();
}
