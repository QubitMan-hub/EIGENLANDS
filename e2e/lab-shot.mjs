// One art-lab screenshot: node e2e/lab-shot.mjs <lab url> <out.png>
import { chromium } from 'playwright-core';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const p = await b.newPage({ viewport: { width: 900, height: 900 } });
p.on('pageerror', (e) => console.log('E', e.message.slice(0, 300)));
await p.goto(process.argv[2]);
await p.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await p.screenshot({ path: process.argv[3] });
await b.close();
