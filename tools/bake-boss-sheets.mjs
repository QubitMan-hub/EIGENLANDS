/** Offline normalization only: source art never ships in the browser bundle. */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { format } from 'prettier';
const base = process.argv[2] ?? 'http://127.0.0.1:5187/',
  out = 'packages/client/public/art/bestiary';
const config = {
  primordial_dragon: [240, 208],
  world_serpent: [224, 208],
  sealed_entity: [208, 208],
  forgotten_titan: [208, 208],
  realm_guardian: [240, 208],
  slime_king: [160, 144],
  warden: [192, 160],
  colossus: [176, 176],
  bellkeeper: [176, 184],
  geode_tyrant: [192, 160],
  cinder_wyrm: [192, 176],
  rime_sovereign: [176, 184],
  tide_leviathan: [208, 176],
  veyr: [192, 184],
};
const frames = { idle: 1, move: 4, windup: 1, attack: 2, hurt: 1, death: 1 },
  columns = [0, 1, 2, 3, 2, 4, 5, 6, 4, 7];
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const manifest = { sourceHash: '', atlases: {}, portraits: [] };
const hash = createHash('sha256').update(readFileSync(import.meta.filename));
try {
  const page = await browser.newPage();
  await page.goto(base + 'labs/uilab.html?panel=none');
  for (const [id, [w, h]] of Object.entries(config)) {
    const file = `art-source/bosses/${id}.png`;
    if (!existsSync(file)) continue;
    const raw = readFileSync(file);
    hash.update(id).update(raw);
    const result = await page.evaluate(
      async ({ id, w, h, columns, frames, data }) => {
        const { paletteColor } = await import('/src/art/creature-pixels.ts');
        const img = new Image();
        img.src = data;
        await img.decode();
        const source = document.createElement('canvas');
        source.width = img.width;
        source.height = img.height;
        const ctx = source.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const sourcePixels = ctx.getImageData(0, 0, source.width, source.height),
          sw = source.width / 8,
          sh = source.height / 4;
        // Clear soft coverage and detached generation flecks; preserve hard opaque art and deliberate one-pixel detail.
        for (let i = 0; i < sourcePixels.data.length; i += 4)
          if (sourcePixels.data[i + 3] < 160) sourcePixels.data.fill(0, i, i + 4);
        ctx.putImageData(sourcePixels, 0, 0);
        const bounds = [];
        for (let dir = 0; dir < 4; dir++)
          for (let col = 0; col < 8; col++) {
            const x0 = Math.round(col * sw),
              y0 = Math.round(dir * sh),
              x1 = Math.round((col + 1) * sw),
              y1 = Math.round((dir + 1) * sh),
              a = ctx.getImageData(x0, y0, x1 - x0, y1 - y0),
              ww = a.width,
              hh = a.height;
            const visited = new Uint8Array(ww * hh),
              components = [];
            for (let start = 0; start < visited.length; start++) {
              if (visited[start] || !a.data[start * 4 + 3]) continue;
              const todo = [start],
                pixels = [];
              visited[start] = 1;
              let x0 = ww,
                y0 = hh,
                x1 = 0,
                y1 = 0;
              while (todo.length) {
                const n = todo.pop(),
                  x = n % ww,
                  y = Math.floor(n / ww);
                pixels.push(n);
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
                for (let dy = -1; dy <= 1; dy++)
                  for (let dx = -1; dx <= 1; dx++) {
                    const xx = x + dx,
                      yy = y + dy;
                    if (xx < 0 || yy < 0 || xx >= ww || yy >= hh) continue;
                    const next = yy * ww + xx;
                    if (!visited[next] && a.data[next * 4 + 3]) {
                      visited[next] = 1;
                      todo.push(next);
                    }
                  }
              }
              components.push({ pixels, x0, y0, x1, y1 });
            }
            components.sort((a, b) => b.pixels.length - a.pixels.length);
            const main = components[0];
            if (main)
              for (const component of components.slice(1)) {
                const floating = id === 'sealed_entity' || id === 'realm_guardian';
                const small = component.pixels.length < Math.max(24, main.pixels.length * 0.006);
                const outside =
                  component.x0 > main.x1 + 4 ||
                  component.x1 < main.x0 - 4 ||
                  component.y0 > main.y1 + 4 ||
                  component.y1 < main.y0 - 4;
                if (small || (!floating && outside)) for (const n of component.pixels) a.data.fill(0, n * 4, n * 4 + 4);
              }
            ctx.putImageData(a, x0, y0);
            let left = ww,
              top = hh,
              right = -1,
              bottom = -1;
            for (let y = 0; y < hh; y++)
              for (let x = 0; x < ww; x++)
                if (a.data[(y * ww + x) * 4 + 3]) {
                  left = Math.min(left, x);
                  right = Math.max(right, x);
                  top = Math.min(top, y);
                  bottom = Math.max(bottom, y);
                }
            if (right < left) throw Error(`Empty authored frame: ${id} facing ${dir} column ${col}`);
            // Median of the lowest opaque band is a ground contact, unaffected by a wide tail/weapon above it.
            const contacts = [];
            for (let x = left; x <= right; x++) {
              for (let y = Math.max(top, bottom - 3); y <= bottom; y++)
                if (a.data[(y * ww + x) * 4 + 3]) {
                  contacts.push(x);
                  break;
                }
            }
            const mid = (left + right) / 2,
              contact = contacts[Math.floor(contacts.length / 2)] ?? mid;
            const foot = Math.max(mid - (right - left) * 0.12, Math.min(mid + (right - left) * 0.12, contact));
            bounds.push({ x0, y0, left, top, right, bottom, foot });
          }
        // One common scale for the entire character. Never resize a pose or facing independently.
        const ay = h - 12,
          ax = w / 2;
        const scale = Math.min(
          ...bounds.map((b) =>
            Math.min(
              (ax - 6) / Math.max(1, b.foot - b.left),
              (ax - 6) / Math.max(1, b.right - b.foot),
              (ay - 6) / Math.max(1, b.bottom - b.top),
            ),
          ),
        );
        const cols = 5,
          poseRows = Math.ceil(columns.length / cols),
          rows = poseRows * 4;
        const canvas = document.createElement('canvas');
        canvas.width = w * cols;
        canvas.height = h * rows;
        const c = canvas.getContext('2d', { willReadFrequently: true });
        c.imageSmoothingEnabled = false;
        for (let dir = 0; dir < 4; dir++)
          for (let pose = 0; pose < columns.length; pose++) {
            const b = bounds[dir * 8 + columns[pose]],
              bw = b.right - b.left + 1,
              bh = b.bottom - b.top + 1;
            const dx = (pose % cols) * w + ax - (b.foot - b.left) * scale,
              dy = (dir * poseRows + Math.floor(pose / cols)) * h + ay - (b.bottom - b.top) * scale;
            c.drawImage(
              source,
              b.x0 + b.left,
              b.y0 + b.top,
              bw,
              bh,
              Math.round(dx),
              Math.round(dy),
              Math.round(bw * scale),
              Math.round(bh * scale),
            );
          }
        const urls = {};
        for (const night of [false, true]) {
          const data = c.getImageData(0, 0, canvas.width, canvas.height),
            colors = new Map();
          for (let i = 0; i < data.data.length; i += 4) {
            if (data.data[i + 3] < 160) {
              data.data.fill(0, i, i + 4);
              continue;
            }
            const rgb = (data.data[i] << 16) | (data.data[i + 1] << 8) | data.data[i + 2];
            let col = colors.get(rgb);
            if (col === undefined) {
              const k = night ? 0.86 : 1;
              col = paletteColor(
                (Math.min(255, Math.round((data.data[i] + 5) * k)) << 16) |
                  (Math.min(255, Math.round((data.data[i + 1] + 5) * k)) << 8) |
                  Math.min(255, Math.round((data.data[i + 2] + 5) * k)),
              );
              colors.set(rgb, col);
            }
            data.data[i] = col >> 16;
            data.data[i + 1] = (col >> 8) & 255;
            data.data[i + 2] = col & 255;
            data.data[i + 3] = 255;
          }
          const target = document.createElement('canvas');
          target.width = canvas.width;
          target.height = canvas.height;
          target.getContext('2d').putImageData(data, 0, 0);
          urls[night ? 'night' : 'day'] = target.toDataURL();
        }
        const portrait = document.createElement('canvas');
        portrait.width = 64;
        portrait.height = 64;
        const pc = portrait.getContext('2d');
        pc.imageSmoothingEnabled = false;
        const k = Math.min(60 / w, 60 / h);
        pc.drawImage(
          canvas,
          0,
          0,
          w,
          h,
          Math.round((64 - w * k) / 2),
          Math.round((64 - h * k) / 2),
          Math.round(w * k),
          Math.round(h * k),
        );
        const day = new Image();
        day.src = urls.day;
        await day.decode();
        const thumbnail = document.createElement('canvas');
        thumbnail.width = Math.ceil(w / 4);
        thumbnail.height = Math.ceil(h / 4);
        const tc = thumbnail.getContext('2d');
        tc.imageSmoothingEnabled = false;
        tc.drawImage(day, 0, 0, w, h, 0, 0, thumbnail.width, thumbnail.height);
        return {
          urls,
          portrait: portrait.toDataURL(),
          meta: { w, h, ay, cols, rows, poseRows, frames, fallback: thumbnail.toDataURL() },
          scale,
          bounds,
        };
      },
      {
        id,
        w,
        h,
        columns: id === 'veyr' ? [0, 1, 2, 3, 4, 5, 6, 6, 5, 7] : columns,
        frames,
        data: 'data:image/png;base64,' + raw.toString('base64'),
      },
    );
    mkdirSync(out + '/portraits', { recursive: true });
    for (const name of ['day', 'night'])
      writeFileSync(`${out}/${id}-${name}.png`, Buffer.from(result.urls[name].split(',')[1], 'base64'));
    writeFileSync(`${out}/portraits/${id}.png`, Buffer.from(result.portrait.split(',')[1], 'base64'));
    manifest.atlases[id] = result.meta;
    manifest.portraits.push(id);
    console.log('normalized', id, Math.round(result.scale * 100) + '%', result.meta.w, result.meta.h);
  }
  manifest.sourceHash = hash.digest('hex');
  const json = await format(JSON.stringify(manifest), { parser: 'json', printWidth: 120, singleQuote: true });
  writeFileSync('packages/client/src/art/boss-manifest.json', json);
  writeFileSync(out + '/boss-manifest.json', json);
} finally {
  await browser.close();
}
