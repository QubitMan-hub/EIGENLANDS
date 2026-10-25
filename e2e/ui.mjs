// node e2e/ui.mjs panel out.png [w] [h]  — screenshots a UI-lab panel
import { chromium } from 'playwright-core';
const [panel, out, w = '1280', hh = '800'] = process.argv.slice(2);
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const p = await b.newPage({ viewport: { width: +w, height: +hh } });
const logs = [];
p.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto('http://127.0.0.1:5173/labs/uilab.html?panel=' + panel);
await p.waitForFunction(() => window.__uilab, null, { timeout: 15000 });
await new Promise((r) => setTimeout(r, 700));
await p.screenshot({ path: out });
const bad = logs.filter((l) => /error/i.test(l) && !/404/.test(l));
if (bad.length) console.log(bad.join('\n'));
await b.close();
