// UI contrast audit of the solo build: opens every window, journal tab, the statue, villager talk and shops, and
// reports text under WCAG AA (4.5:1, 3:1 for large text) plus overflowing scrollers.
// Usage: node e2e/ui-contrast.mjs <solo-url> <output-dir>
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5301/';
const out = process.argv[3] ?? '/tmp/eigen-contrast';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await b.newContext({ viewport: { width: 1366, height: 800 } })).newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(base + '?dev=1&hour=12');
await page.evaluate(() => {
  localStorage.setItem('eigen.tutorial2', '["all"]');
  const s = JSON.parse(localStorage.getItem('eigen.settings') || '{}');
  s.graphics = 'performance';
  localStorage.setItem('eigen.settings', JSON.stringify(s));
});
await page.reload();
const audit = (label) =>
  page.evaluate((label) => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0], p[1], p[2], p[3] ?? 1];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (top, under) => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
    };
    const bgOf = (el) => {
      const layers = [];
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const img = cs.backgroundImage;
        if (img && img !== 'none' && !img.startsWith('url')) {
          const cols = [...img.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter((c) => c[3] > 0.3);
          if (cols.length) {
            const avg = [0, 1, 2].map((i) => cols.reduce((s, c) => s + c[i], 0) / cols.length);
            layers.push([...avg, 1]);
            break;
          }
        }
        const c = parse(cs.backgroundColor);
        if (c && c[3] > 0) {
          layers.push(c);
          if (c[3] >= 0.99) break;
        }
      }
      let acc = [20, 20, 20, 1]; // canvas behind overlays: dark world
      for (const l of layers.reverse()) acc = over(l, acc);
      return acc;
    };
    const issues = [];
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      if (!el.childNodes.length) continue;
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3 && n.textContent.trim())
        .map((n) => n.textContent.trim())
        .join(' ');
      if (!own) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      let hidden = false;
      for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).display === 'none' || e.hidden) hidden = true;
      if (hidden) continue;
      const fg0 = parse(cs.color);
      if (!fg0) continue;
      const bg = bgOf(el);
      const fg = over(fg0, bg);
      const L1 = lum(fg),
        L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const need = size >= 18.5 || (size >= 14 && +cs.fontWeight >= 700) ? 3 : 4.5;
      if (ratio < need)
        issues.push({
          text: own.slice(0, 50),
          cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 40),
          tag: el.tagName.toLowerCase(),
          parent: (el.parentElement?.className ?? '').toString().slice(0, 30),
          ratio: +ratio.toFixed(2),
          fg: cs.color,
          bg: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})`,
          size,
        });
    }
    const scrolls = [];
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (!/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
        scrolls.push({
          cls: (el.className ?? '').toString().slice(0, 40),
          id: el.id,
          bar: el.offsetWidth - el.clientWidth,
          sw: cs.scrollbarWidth,
          over: el.scrollWidth > el.clientWidth + 1 ? 'x' : 'y',
        });
    }
    return { label, issues, scrolls };
  }, label);
const results = [];
const run = async (label) => {
  await page.waitForTimeout(500);
  const r = await audit(label);
  results.push(r);
  console.log(`== ${label}: ${r.issues.length} low-contrast, ${r.scrolls.length} scrollers`);
  for (const i of r.issues.slice(0, 25)) console.log('  ', JSON.stringify(i));
  for (const s of r.scrolls) console.log('   scroll', JSON.stringify(s));
  await page.screenshot({ path: `${out}/${label.replace(/[^a-z0-9]+/gi, '_')}.png` });
};
await run('title');
await page.fill('#name', 'Contrast audit').catch(() => {});
await page.click('#btn-guest');
await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
await page.waitForTimeout(3000);
await run('hud');
const tabs = async (label) => {
  await run(label);
  const n = await page.locator('.win-body button[data-tab]').count();
  for (let i = 0; i < n; i++) {
    const t = page.locator('.win-body button[data-tab]').nth(i);
    const name = (await t.textContent())?.trim() ?? String(i);
    await t.click().catch(() => {});
    await run(`${label}-${name}`);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
};
for (const [key, label] of [
  ['KeyI', 'inventory'],
  ['KeyL', 'journal'],
  ['KeyC', 'craft'],
  ['KeyB', 'board'],
  ['KeyP', 'party'],
  ['KeyY', 'shadows'],
  ['KeyM', 'map'],
]) {
  await page.keyboard.press(key);
  await tabs(label);
}
// settings / menu
const menu = page.locator('#hud-menu, .gatebtn').first();
if (await menu.count()) {
  await menu.click().catch(() => {});
  await tabs('menu');
}
// statue lore, a villager conversation (every page and choice) and a shop
const statue = await page.evaluate(() => {
  const g = window.__eigen.game;
  const o = [...g.store.objects.values()].find((o) => o.sub === 'statue');
  if (!o) return null;
  g.net.dev({ cmd: 'tp', x: o.x + 0.5, y: o.y + 3.5 });
  return [o.x, o.y];
});
if (statue) {
  await page.waitForTimeout(2500);
  await page.evaluate(([x, y]) => window.__eigen.game.net.open(x, y), statue);
  await page.waitForTimeout(1500);
  await run('statue');
  const next = page.locator('.lore-nav button').last();
  if (await next.count()) {
    await next.click().catch(() => {});
    await run('statue-page');
  }
  await page.keyboard.press('Escape');
}
const npcs = await page.evaluate(() => {
  const g = window.__eigen.game;
  return [...g.views.values()].filter((v) => v.type === 'npc').map((v) => ({ id: v.id, x: v.lx, y: v.ly }));
});
for (const n of npcs.slice(0, 3)) {
  await page.evaluate((n) => window.__eigen.game.net.dev({ cmd: 'tp', x: n.x + 1, y: n.y }), n);
  await page.waitForTimeout(1500);
  await page.evaluate((n) => window.__eigen.game.net.talk(n.id), n);
  await page.waitForTimeout(1500);
  await run('talk-' + n.id);
  for (let k = 0; k < 3; k++) {
    const box = page.locator('.dlg-box');
    if (!(await box.count())) break;
    await box.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await run('talk-choices-' + n.id);
  const shop = page.locator('.dlg-choices button, .dlg-actions button', { hasText: /shop|buy|browse|wares/i }).first();
  if (await shop.count()) {
    await shop.click().catch(() => {});
    await page.waitForTimeout(800);
    await run('shop-' + n.id);
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
}
writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 1));
await b.close();

if (process.argv.includes('--assert')) {
  const bad = results.flatMap((r) => r.issues.map((i) => ({ page: r.label, ...i }))),
    horizontal = results.flatMap((r) => r.scrolls.filter((s) => s.over === 'x').map((s) => ({ page: r.label, ...s })));
  if (bad.length || horizontal.length)
    throw new Error(
      `Contrast/overflow regression: ${bad.length} low-contrast text nodes, ${horizontal.length} horizontal scrollers`,
    );
  console.log(
    'PASS all audited title, HUD, windows, journal pages, dialogue and shops meet contrast and horizontal overflow checks',
  );
}
