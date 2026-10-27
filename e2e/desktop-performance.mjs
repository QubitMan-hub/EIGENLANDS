// Desktop performance profile of the production solo build on a low-end laptop viewport (1366x768, DPR 1, mouse).
// Usage: node e2e/desktop-performance.mjs <solo-url> <output-dir> [--graphics=auto|high|economy|performance] [--frames-only]
// Records, per scene, wall-clock frame intervals, the game's own frame work, long tasks and (unless --frames-only)
// a sampled CPU profile aggregated by function. Software GL makes GPU time large; compare runs on the same machine.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5240/';
const out = process.argv[3] ?? '/tmp/eigen-desktop-perf';
const graphics = (process.argv.find((a) => a.startsWith('--graphics=')) ?? '--graphics=auto').split('=')[1];
const framesOnly = process.argv.includes('--frames-only');
mkdirSync(out, { recursive: true });

const SCENES = [
  { name: 'hadamere', x: 60.5, y: 14.5 },
  { name: 'aurelion-capital', x: 1024.5, y: -505.5 },
  { name: 'wilderness', x: 210.5, y: 60.5 },
];
const quantile = (a, q) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
  ],
});
const report = { base, graphics, viewport: '1366x768@1', scenes: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '?dev=1&hour=12');
  await page.evaluate((g) => {
    localStorage.setItem('eigen.tutorial2', '["all"]');
    const s = JSON.parse(localStorage.getItem('eigen.settings') || '{}');
    s.graphics = g;
    localStorage.setItem('eigen.settings', JSON.stringify(s));
  }, graphics);
  await page.reload(); // settings are read once at startup
  await page.fill('#name', 'Desktop benchmark').catch(() => {});
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
  await page.evaluate((g) => {
    const game = window.__eigen.game;
    void g;
    game.net.dev({ cmd: 'level', level: 20 });
    window.__perf = { frames: [], work: [], long: [] };
    const frame = game.frame.bind(game);
    game.frame = (dt) => {
      const t = performance.now();
      try {
        return frame(dt);
      } finally {
        window.__perf.work.push(performance.now() - t);
      }
    };
    let last = performance.now();
    const tick = (t) => {
      window.__perf.frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.long.push(e.duration);
    }).observe({ type: 'longtask', buffered: false });
  }, graphics);
  const cdp = await page.context().newCDPSession(page);
  for (const s of SCENES) {
    await page.evaluate(([x, y]) => window.__eigen.game.net.dev({ cmd: 'tp', x, y }), [s.x, s.y]);
    await page.waitForTimeout(8000);
    await page.evaluate(() => {
      window.__perf.frames = [];
      window.__perf.work = [];
      window.__perf.long = [];
    });
    if (!framesOnly) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
      await cdp.send('Profiler.start');
    }
    // walk a square so streaming, sorting and culling are exercised
    for (const key of ['w', 'd', 's', 'a']) {
      await page.keyboard.down(key);
      await page.waitForTimeout(2000);
      await page.keyboard.up(key);
    }
    let hot = [];
    if (!framesOnly) {
      const { profile } = await cdp.send('Profiler.stop');
      const self = new Map();
      const total = profile.samples.length;
      const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const counts = new Map();
      for (const id of profile.samples) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const [id, n] of counts) {
        const node = byId.get(id);
        const f = node.callFrame;
        const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
        self.set(key, (self.get(key) ?? 0) + n);
      }
      hot = [...self.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([k, n]) => ({ fn: k, pct: +((100 * n) / total).toFixed(1) }));
    }
    const perf = await page.evaluate(() => window.__perf);
    const st = await page.evaluate(() => window.__eigen.state());
    const res = {
      scene: s.name,
      frames: perf.frames.length,
      fps: +(1000 / (perf.frames.reduce((a, b) => a + b, 0) / Math.max(1, perf.frames.length))).toFixed(1),
      frameP50: +quantile(perf.frames, 0.5).toFixed(1),
      frameP95: +quantile(perf.frames, 0.95).toFixed(1),
      workMean: +(perf.work.reduce((a, b) => a + b, 0) / Math.max(1, perf.work.length)).toFixed(2),
      workP95: +quantile(perf.work, 0.95).toFixed(2),
      workMax: +Math.max(0, ...perf.work).toFixed(1),
      longTasks: perf.long.length,
      longMax: +Math.max(0, ...perf.long).toFixed(0),
      entities: st.entities,
      chunks: st.chunks,
      hot,
    };
    report.scenes.push(res);
    console.log(JSON.stringify({ ...res, hot: res.hot.slice(0, 12) }));
    await page.screenshot({ path: `${out}/${s.name}.png` });
  }
  report.errors = errors;
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  if (errors.length) console.log('errors', errors.slice(0, 5));
} finally {
  await browser.close();
}
