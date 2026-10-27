// Wonders proof on the solo build: a starfall night (shooting stars and a fallen star nearby), aurora over the taiga
// and the morning rainbow after rain. Usage: node e2e/wonders.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-wonders';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
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
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
const tp = async (x, y, wait = 3500) => {
  for (let i = 0; i < 5; i++) {
    await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [x, y]);
    await page.waitForTimeout(wait);
    const at = await page.evaluate(() => window.__eigen.game.predictor.sim);
    if (Math.hypot(at.x - x, at.y - y) < 3) return;
  }
  console.log('tp did not take', x, y);
};
/** shift the world clock forward to the first moment that suits `mode` (searched by half hours) */
const jump = (mode) =>
  page.evaluate(async (mode) => {
    const sh = await import('/@fs/home/user/EIGENLANDS/packages/shared/src/index.ts');
    const g = window.__eigen.game;
    const seed = g.store.seed;
    const clearish = (day) => ['clear', 'cloudy'].includes(sh.weatherForDay(seed, day));
    const ok = {
      starfall: (day, hour) => hour >= 22 && hour < 23 && sh.starfallOn(seed, day),
      night: (day, hour) => hour >= 22 && hour < 23 && clearish(day),
      rainbow: (day, hour) => hour >= 8 && hour < 8.5 && sh.rainbowAt(seed, day, hour),
    }[mode];
    const now = g.clock.serverNow(performance.now());
    for (let k = 1; k < 48 * 300; k++) {
      const t = now + (k * sh.DAY_MS) / 48;
      if (ok(sh.dayNumber(t), sh.gameHour(t))) {
        g.net.dev({ cmd: 'time', offsetMs: t - now });
        return { day: sh.dayNumber(t), hour: sh.gameHour(t) };
      }
    }
    return null;
  }, mode);
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
      sky.__orig ??= sky.update.bind(sky);
      sky.update = (f) => sky.__orig({ ...f, hour, day: day ?? f.day, weather: weather ?? f.weather });
    },
    [hour, day, weather],
  );
const findDay = (mode) =>
  page.evaluate(async (mode) => {
    const sh = await import('/@fs/home/user/EIGENLANDS/packages/shared/src/index.ts');
    const seed = window.__eigen.game.store.seed;
    for (let d = 1; d < 400; d++)
      if (mode === 'starfall' ? sh.starfallOn(seed, d) : sh.rainbowAt(seed, d, 8.5)) return d;
    return null;
  }, mode);

// a real starfall night on the server: a star comes down near the traveller
console.log('starfall', JSON.stringify(await jump('starfall')));
await page.waitForTimeout(800);
await tp(200.5, -200.5);
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
console.log('fallen star', JSON.stringify(star));
// catch the shower mid-flight
let meteors = 0;
for (let i = 0; i < 30 && meteors < 2; i++) {
  await page.waitForTimeout(150);
  meteors = await page.evaluate(() => window.__eigen.game.skyFx.counts().meteors);
}
console.log('meteors in flight', meteors);
await page.screenshot({ path: `${out}/starfall.png` });
if (star) {
  await tp(star.x + 3.5, star.y + 2.5);
  await page.screenshot({ path: `${out}/fallen-star.png` });
}

// aurora over the taiga
const taiga = await page.evaluate(async () => {
  const sh = await import('/@fs/home/user/EIGENLANDS/packages/shared/src/index.ts');
  const seed = window.__eigen.game.store.seed;
  for (let r = 100; r < 3000; r += 40)
    for (let a = 0; a < 24; a++) {
      const x = Math.round(Math.cos(a) * r),
        y = Math.round(Math.sin(a) * r);
      if (sh.biomeAt(seed, x, y) === 'taiga' && !sh.isSolid(sh.tileAt(seed, x, y))) return { x, y };
    }
  return null;
});
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
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
