// node --import tsx e2e/elevation.mjs <solo-url> [output-directory]
// Plays the real production solo build in a revision-3 world: walks from the spawn up a mountain's ramp by keyboard,
// checks the player's level rises, tries to walk off the plateau across the cliff (must be refused), and captures
// screenshots of the terraces, the cliff and the summit. Fails on page errors.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CLIFF, ChunkStore } from '../packages/shared/src/index.ts';
import { massifOfCell as massif } from '../packages/shared/src/terrain3.ts';
const url = process.argv[2] ?? 'http://127.0.0.1:5252/EIGENLANDS/';
const out = process.argv[3] ?? '/tmp/elevation-e2e';
mkdirSync(out, { recursive: true });
const seed = 20260101;
const store = new ChunkStore(seed, 2000, 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// pick the biggest massif, its highest reachable tile and a real path to it
let best = null;
for (let j = -3; j <= 3; j++)
  for (let i = -3; i <= 3; i++) {
    const m = massif(seed, i, j);
    if (m && Math.hypot(m.x, m.y) < 190 && (!best || m.r > best.r)) best = m;
  }
if (!best) throw new Error('no mountain on this seed');
let top = null;
for (let y = best.y - best.r; y <= best.y + best.r; y++)
  for (let x = best.x - best.r; x <= best.x + best.r; x++) {
    if (store.solidAt(x, y) || Math.hypot(x - best.x, y - best.y) > best.r * 0.45) continue;
    const l = store.levelAt(x, y);
    if (!top || l > top.l) top = { x, y, l };
  }
// breadth-first search from the summit back to the spawn with the same rules as movement (A* is overkill here)
const R = 220,
  W = R * 2 + 1,
  at = (x, y) => (y + R) * W + x + R,
  parent = new Int32Array(W * W).fill(-2);
parent[at(top.x, top.y)] = -1;
const queue = [[top.x, top.y]];
for (let i = 0; i < queue.length && parent[at(1, 1)] === -2; i++) {
  const [x, y] = queue[i];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx,
      ny = y + dy;
    if (Math.abs(nx) > R || Math.abs(ny) > R || parent[at(nx, ny)] !== -2 || store.solidAt(nx, ny)) continue;
    if (Math.abs(store.levelAt(nx, ny) - store.levelAt(x, y)) >= CLIFF) continue;
    parent[at(nx, ny)] = at(x, y);
    queue.push([nx, ny]);
  }
}
if (parent[at(1, 1)] === -2) throw new Error('no path to the summit');
const path = [];
for (let k = at(1, 1); k >= 0; k = parent[k]) path.push([(k % W) - R, Math.floor(k / W) - R]);
console.log('mountain', best.x, best.y, 'r', best.r, 'summit', top, 'path length', path.length);

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-angle=swiftshader',
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
  ],
});
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?dev=1&hour=12`);
  await page.fill('#name', 'Climber');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 90000 });
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) if (/Skip story/.test(b.textContent)) b.click();
  });
  const st = () => page.evaluate(() => window.__eigen.state());
  const dev = (m) => page.evaluate((m) => window.__eigen.game.net.dev(m), m);
  const s0 = await st();
  if (s0.generation !== 3) throw new Error(`expected a revision-3 world, got ${s0.generation}`);
  // teleport to the nearest path point 40 tiles from the summit so the walk is short but real
  const start = path[Math.max(0, path.length - 70)];
  await dev({ cmd: 'tp', x: start[0] + 0.5, y: start[1] + 0.5 });
  await sleep(3500);
  await page.screenshot({ path: `${out}/1-approach.png` });
  // follow the path with the movement keys (screen-relative: W up, S down, A left, D right)
  const KEYS = { KeyW: [-1, -1], KeyS: [1, 1], KeyA: [-1, 1], KeyD: [1, -1] };
  const held = new Set();
  const press = async (want) => {
    for (const k of [...held])
      if (!want.has(k)) {
        await page.keyboard.up(k);
        held.delete(k);
      }
    for (const k of want)
      if (!held.has(k)) {
        await page.keyboard.down(k);
        held.add(k);
      }
  };
  let maxLevel = 0,
    shots = 2;
  for (let wp = 0; wp < path.length; wp++) {
    const [tx, ty] = path[wp];
    if (wp < path.length - 70) continue;
    for (let tries = 0; tries < 60; tries++) {
      const s = await st();
      maxLevel = Math.max(maxLevel, s.elevation);
      const dx = tx + 0.5 - s.x,
        dy = ty + 0.5 - s.y;
      if (Math.hypot(dx, dy) < 0.6) break;
      if (process.env.DEBUG && tries === 59)
        console.log('stuck at', s.x.toFixed(2), s.y.toFixed(2), 'target', tx, ty, 'level', s.elevation, 'wp', wp);
      const want = new Set();
      for (const [k, [kx, ky]] of Object.entries(KEYS)) {
        // pick keys whose world direction lies within ~67 degrees of the wanted one
        const l = Math.hypot(kx, ky);
        if ((kx * dx + ky * dy) / (l * Math.hypot(dx, dy)) > 0.38) want.add(k);
      }
      await press(want);
      await sleep(70);
    }
    if (process.env.DEBUG && wp % 6 === 0)
      console.log('wp', wp, '/', path.length, 'target', tx, ty, 'level', (await st()).elevation);
    if (wp % 18 === 0 && shots < 6) await page.screenshot({ path: `${out}/${shots++}-climb.png` });
  }
  await press(new Set());
  await sleep(500);
  const s1 = await st();
  console.log('at the summit region: level', s1.elevation, 'of', top.l, 'max seen', maxLevel);
  await page.screenshot({ path: `${out}/7-summit.png` });
  if (s1.elevation < 2) throw new Error('the player never climbed');
  // find a sheer drop (a neighbour two or more levels lower) near the summit and try to walk over it
  const edge = await page.evaluate(() => {
    const g = window.__eigen.game,
      s = window.__eigen.state();
    for (let r = 0; r < 24; r++)
      for (let oy = -r; oy <= r; oy++)
        for (let ox = -r; ox <= r; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
          const x = Math.floor(s.x) + ox,
            y = Math.floor(s.y) + oy;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const here = g.store.levelAt(x, y);
            if (
              here - g.store.levelAt(x + dx, y + dy) >= 2 &&
              !g.store.solidAt(x, y) &&
              !g.store.solidAt(x + dx, y + dy) &&
              !g.store.solidAt(x - dx, y - dy) &&
              g.store.levelAt(x - dx, y - dy) === here
            )
              return { dx, dy, x, y, here };
          }
        }
    return null;
  });
  if (!edge) throw new Error('no sheer drop near the summit');
  await dev({ cmd: 'tp', x: edge.x - edge.dx + 0.5, y: edge.y - edge.dy + 0.5 });
  await sleep(1500);
  const before = await st();
  const dirKeys = (dx, dy) =>
    dx > 0 ? ['KeyS', 'KeyD'] : dx < 0 ? ['KeyW', 'KeyA'] : dy > 0 ? ['KeyS', 'KeyA'] : ['KeyW', 'KeyD'];
  await press(new Set(dirKeys(edge.dx, edge.dy)));
  await sleep(3500);
  await press(new Set());
  const after = await st();
  const along = edge.dx ? after.x - (edge.x + 0.5) : after.y - (edge.y + 0.5);
  console.log(
    'cliff test: level',
    before.elevation,
    '->',
    after.elevation,
    'advance along the drop',
    (along * (edge.dx || edge.dy)).toFixed(2),
  );
  await page.screenshot({ path: `${out}/8-cliff.png` });
  if (after.elevation < before.elevation) throw new Error('walked over a cliff');
  if (along * (edge.dx || edge.dy) > 0.5) throw new Error('crossed the cliff edge');
  console.log('fps', (await st()).fps);
  if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`);
  console.log('elevation e2e passed; screenshots in', out);
} finally {
  await browser.close();
}
