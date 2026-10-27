// Wonders proof on the solo build: a starfall night (shooting stars and a fallen star nearby), aurora over the taiga
// and the morning rainbow after rain. Usage: node --import tsx e2e/wonders.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { starfallOn, rainbowAt } from '../packages/shared/src/wonders.ts';
import { biomeAt, tileAt } from '../packages/shared/src/worldgen.ts';
import { isSolid } from '../packages/shared/src/tiles.ts';
import { weatherForDay } from '../packages/shared/src/weather.ts';
import { DAY_MS } from '../packages/shared/src/constants.ts';
import { dayNumber, gameHour } from '../packages/shared/src/time.ts';
import { setActiveGeneration } from '../packages/shared/src/generation-registry.ts';
const sh = {
  starfallOn,
  rainbowAt,
  biomeAt,
  tileAt,
  isSolid,
  weatherForDay,
  DAY_MS,
  dayNumber,
  gameHour,
  setActiveGeneration,
};
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-wonders';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '?dev=1');
await page.evaluate(() => localStorage.setItem('eigen.tutorial2', '["all"]'));
await page.reload();
await page.fill('#name', 'Stargazer').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready && window.__eigen.game.gameplay.profile.loaded, null, {
  timeout: 120000,
});
await page.evaluate(() => {
  const g = window.__eigen.game;
  g.app.ticker.maxFPS = 20;
  g.ext.circuit.send('p3_tutorial', { action: 'skip' });
});
const tp = async (x, y, wait = 3500) => {
  for (let i = 0; i < 5; i++) {
    await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
    await page.waitForTimeout(wait);
    const at = await page.evaluate(() => window.__eigen.game.predictor.sim);
    if (Math.hypot(at.x - x, at.y - y) < 3) return;
  }
  throw new Error(`Teleport did not reach ${x}, ${y}`);
};
const world = await page.evaluate(() => ({
  seed: window.__eigen.game.store.seed,
  generation: window.__eigen.game.store.generation,
}));
sh.setActiveGeneration(world.seed, world.generation);
const seed = world.seed;
/** Compute fixtures in Node; production previews do not serve TypeScript source modules. */
const jump = async (mode) => {
  const clearish = (day) => ['clear', 'cloudy'].includes(sh.weatherForDay(seed, day));
  const ok = {
    starfall: (day, hour) => hour >= 22 && hour < 23 && sh.starfallOn(seed, day),
    night: (day, hour) => hour >= 22 && hour < 23 && clearish(day),
    rainbow: (day, hour) => hour >= 8 && hour < 8.5 && sh.rainbowAt(seed, day, hour),
  }[mode];
  const now = await page.evaluate(() => window.__eigen.game.clock.serverNow(performance.now()));
  for (let k = 1; k < 48 * 300; k++) {
    const t = now + (k * sh.DAY_MS) / 48;
    if (ok(sh.dayNumber(t), sh.gameHour(t))) {
      await page.evaluate((offsetMs) => window.__eigen.game.net.dev({ cmd: 'time', offsetMs }), t - now);
      return { day: sh.dayNumber(t), hour: sh.gameHour(t) };
    }
  }
  return null;
};
// the client clock eases toward a jump a few ms at a time: for the proof, let it re-initialise from the next snapshot
const settle = async () => {
  await page.waitForTimeout(800);
  await page.evaluate(() => (window.__eigen.game.clock.ready = false));
  await page.waitForTimeout(2500);
};

/** draw the sky as it would be at `hour` on `day` with `weather` (the scene's lighting follows the hour too) */
const forceSky = (hour, day, weather) =>
  page.evaluate(
    ([hour, day, weather]) => {
      const g = window.__eigen.game;
      g.hourOverride = hour;
      const sky = g.skyFx;
      sky.nextMeteor = 0;
      sky.__orig ??= sky.update.bind(sky);
      sky.update = (f) => sky.__orig({ ...f, hour, day: day ?? f.day, weather: weather ?? f.weather });
    },
    [hour, day, weather],
  );
const findDay = (mode) => {
  for (let d = 1; d < 400; d++) if (mode === 'starfall' ? sh.starfallOn(seed, d) : sh.rainbowAt(seed, d, 8.5)) return d;
  return null;
};

// a real starfall night on the server: a star comes down near the traveller
console.log('starfall', JSON.stringify(await jump('starfall')));
await page.waitForTimeout(800);
await tp(84.5, 84.5);
const sfDay = await findDay('starfall');
await forceSky(22.5, sfDay, 'clear');
let star = null;
for (let i = 0; i < 70 && !star; i++) {
  await page.waitForTimeout(2000);
  star = await page.evaluate(() => {
    const st = window.__eigen.game.store,
      me = window.__eigen.game.predictor.sim;
    for (let dy = -26; dy <= 26; dy++)
      for (let dx = -26; dx <= 26; dx++) {
        const o = st.objectAt(Math.floor(me.x) + dx, Math.floor(me.y) + dy);
        if (o?.sub === 'fallen_star') return { x: o.x, y: o.y };
      }
    return null;
  });
}
assert.ok(star, 'A real server starfall leaves a reachable fallen star');
console.log('fallen star', JSON.stringify(star));
// catch the shower mid-flight
let meteors = 0;
for (let i = 0; i < 30 && meteors < 2; i++) {
  await page.waitForTimeout(150);
  meteors = await page.evaluate(() => window.__eigen.game.skyFx.counts().meteors);
}
assert.ok(meteors > 0, 'Starfall sky renders shooting stars');
console.log('meteors in flight', meteors);
await page.screenshot({ path: `${out}/starfall.png` });
if (star) {
  await tp(star.x + 3.5, star.y + 2.5);
  await page.screenshot({ path: `${out}/fallen-star.png` });
}

// aurora over the taiga
const taiga = (() => {
  for (let r = 100; r < 3000; r += 40)
    for (let a = 0; a < 24; a++) {
      const x = Math.round(Math.cos(a) * r),
        y = Math.round(Math.sin(a) * r);
      if (sh.biomeAt(seed, x, y) === 'taiga' && !sh.isSolid(sh.tileAt(seed, x, y, world.generation))) return { x, y };
    }
  return null;
})();
console.log('taiga', JSON.stringify(taiga));
await forceSky(23, 2, 'clear');
await tp(taiga.x + 0.5, taiga.y + 0.5, 7000);
console.log('aurora', await page.evaluate(() => window.__eigen.game.skyFx.counts().aurora.toFixed(2)));
await page.screenshot({ path: `${out}/aurora.png` });

// the morning rainbow after rain
const rbDay = await findDay('rainbow');
console.log('rainbow day', rbDay);
await forceSky(8.5, rbDay, 'clear');
await tp(60.5, -60.5);
await page.screenshot({ path: `${out}/rainbow.png` });
assert.deepEqual(errors, []);
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
