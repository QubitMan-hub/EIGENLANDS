// node e2e/lab.mjs "x=0&y=0&season=1&hour=12" out.png [w] [h]
import { chromium } from 'playwright-core';
const [q, out, w = '1280', h = '720'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
p.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto('http://127.0.0.1:5173/artlab.html?' + q + '&motion=0');
await p.waitForFunction(() => window.__lab?.ready, null, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));
await p.screenshot({ path: out });
const bad = logs.filter((l) => /error|ERROR|warn/i.test(l) && !/GPU stall|swiftshader/i.test(l));
if (bad.length) console.log(bad.slice(0, 6).join('\n'));
await b.close();
