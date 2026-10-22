// Phase 4 e2e: two browsers party up, chat, emote and trade; plus a phone-sized client.
// node e2e/p4.mjs [url] [outdir]   (server with DEV_COMMANDS=1)
import { chromium, devices } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5230/?hour=12';
const out = process.argv[3] ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failed = 0;
const fail = (m) => { console.error('FAIL:', m); failed++; process.exitCode = 1; };
const check = (ok, m) => { if (ok) console.log('ok  ', m); else fail(m); };
const tag = Math.random().toString(36).slice(2, 6);
const A = `Alice${tag}`, B = `Bob${tag}`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});

async function player(name, contextOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 660 }, ...contextOpts });
  const page = await ctx.newPage();
  // the CI box may be busy (software WebGL): be patient rather than flaky
  page.setDefaultTimeout(120000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  await page.goto(url);
  try { await page.waitForSelector('#name', { timeout: 30000 }); } catch (e) {
    await page.screenshot({ path: `${out}/p4-fail-${name}.png` });
    console.error('login screen missing for', name, errors, (await page.content()).slice(0, 2000));
    throw e;
  }
  await page.fill('#name', name);
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 120000 });
  await page.waitForSelector('#chat:not([hidden]), #chat-mini:not([hidden])', { timeout: 30000 });
  return page;
}
const social = (p) => p.evaluate(() => window.__eigen.state().p34.social);
const st = (p) => p.evaluate(() => window.__eigen.state());
async function waitFor(p, fn, arg, ms = 30000) {
  try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; }
}
const logHas = (p, text) => waitFor(p, (t) => [...document.querySelectorAll('#chat-log .cl')].some((e) => e.textContent.includes(t)), text);

async function say(p, text) {
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.activeElement?.classList.contains('chat-in'));
  await p.keyboard.type(text);
  await p.keyboard.press('Enter');
}

const a = await player(A);
const b = await player(B);
// Bob steps aside so the two sprites do not overlap
await b.keyboard.down('KeyD'); await sleep(350); await b.keyboard.up('KeyD');
await sleep(800);

// ── typing never moves the character; Esc leaves the input without closing anything
const x0 = (await st(a)).x;
await a.keyboard.press('Enter');
await a.keyboard.type('wasd ddd ');
await sleep(400);
check(Math.abs((await st(a)).x - x0) < 0.01, 'typing in chat does not move the player');
await a.keyboard.press('Escape');
check(!(await social(a)).typing, 'Escape stops typing');
await a.keyboard.press('Enter');
await a.keyboard.press('Control+A'); await a.keyboard.press('Backspace');
await a.keyboard.press('Escape');

// ── party: invite by name, accept from the prompt
await say(a, `/invite ${B}`);
check(await waitFor(b, () => !!document.querySelector('.prompt.party')), 'Bob sees the party invite prompt');
await b.screenshot({ path: `${out}/p4-1-invite.png` });
await b.click('.prompt.party button.primary');
check(await waitFor(a, (n) => [...document.querySelectorAll('#party-frames .pf-name')].some((e) => e.textContent === n), B), 'Alice has a party frame for Bob');
check(await waitFor(b, (n) => [...document.querySelectorAll('#party-frames .pf-name')].some((e) => e.textContent === n), A), 'Bob has a party frame for Alice');
await a.keyboard.press('KeyP');
check(await waitFor(a, () => document.querySelectorAll('.party-win .pm').length === 2), 'party window lists both members');
await a.screenshot({ path: `${out}/p4-2-party-window.png` });
await a.keyboard.press('Escape');

// ── chat: local, party, whisper
await say(a, 'hello there neighbour');
check(await logHas(b, 'hello there neighbour'), 'Bob receives local chat');
await say(b, '/p ready when you are');
check(await logHas(a, 'ready when you are'), 'Alice receives party chat');
await say(b, `/w ${A} psst, a secret`);
check(await logHas(a, 'psst, a secret'), 'Alice receives a whisper');
await say(a, '/r got it');
check(await logHas(b, 'got it'), '/r replies to the last whisper');
await say(a, '/frobnicate');
check(await logHas(a, 'Unknown command'), 'unknown commands explain themselves');

// ── emote: buttons in the chat panel; bubble shows for the other player
await b.click('.chat-emo');
await b.click('.emote-btn[data-e="wave"]');
check(await waitFor(a, () => window.__eigen.state().p34.social.bubbles > 0), 'Alice sees Bob\'s emote bubble');
await sleep(150);
await a.screenshot({ path: `${out}/p4-3-chat-emote.png` });

// ── click Bob in the world: context menu -> Trade
const pos = await a.evaluate((n) => window.__eigenSocial.screenOf(n), B);
check(!!pos, 'Bob is on Alice\'s screen');
if (pos) await a.mouse.click(pos.x, pos.y);
check(await waitFor(a, () => !document.getElementById('player-menu').hidden), 'clicking a player opens the context menu');
await a.screenshot({ path: `${out}/p4-4-menu.png` });
await a.click('#player-menu button:has-text("Trade")');
check(await waitFor(b, () => !!document.querySelector('.prompt.trade')), 'Bob sees the trade request');
await b.click('.prompt.trade button.primary');
check(await waitFor(a, () => !!document.querySelector('.trade')) && await waitFor(b, () => !!document.querySelector('.trade')), 'trade window opens for both');

const sa0 = await social(a), sb0 = await social(b);
// Alice offers her fibre (click the pack slot), Bob offers 7 coins
const fiberSlot = await a.evaluate(() => window.__eigen.state().p34 && [...document.querySelectorAll('.trade-grid .slot')].findIndex((s) => s.querySelector('img')?.alt === 'Plant fiber' || s.querySelector('img')?.alt?.toLowerCase().includes('fib')));
check(fiberSlot >= 0, 'fibre is in Alice\'s trade pack view');
await a.click(`.trade-grid .slot >> nth=${fiberSlot}`);
check(await waitFor(b, () => document.querySelectorAll('#trade-theirs .slot.full').length === 1), 'Bob sees Alice\'s offer');
await b.fill('.trade-coins', '7');
check(await waitFor(a, () => document.querySelector('.trade-side.theirs .coins')?.textContent === '7 coins'), 'Alice sees Bob\'s coins');
await a.screenshot({ path: `${out}/p4-5-trade.png` });
await a.waitForSelector('#trade-confirm:not([disabled])', { timeout: 30000 });
await a.click('#trade-confirm');
check(await waitFor(b, () => document.getElementById('trade-status')?.textContent.includes('confirmed')), 'Bob is told Alice confirmed');
await b.screenshot({ path: `${out}/p4-6-trade-bob.png` });
await b.waitForSelector('#trade-confirm:not([disabled])', { timeout: 30000 });
await b.click('#trade-confirm');
check(await waitFor(a, () => !document.querySelector('.trade') && window.__eigen.state().p34.social.trade === null), 'trade closes when both confirm');
await sleep(500);
const sa1 = await social(a), sb1 = await social(b);
console.log('packs', { alice: [sa0.coins, sa0.pack.fiber, '->', sa1.coins, sa1.pack.fiber ?? 0], bob: [sb0.coins, sb0.pack.fiber, '->', sb1.coins, sb1.pack.fiber] });
check(sa1.coins === sa0.coins + 7 && sb1.coins === sb0.coins - 7, 'coins moved from Bob to Alice');
check((sa1.pack.fiber ?? 0) === 0 && sb1.pack.fiber === sb0.pack.fiber + sa0.pack.fiber, 'fibre moved from Alice to Bob');
await a.screenshot({ path: `${out}/p4-7-after-trade.png` });

// ── phone: chat collapsed to a button, opens on tap, party prompt is tappable
const phone = await player(`Phone${tag}`, { ...devices['Pixel 7'], viewport: { width: 412, height: 860 } });
check(await phone.evaluate(() => !document.getElementById('chat-mini').hidden), 'phone starts with chat collapsed');
await say(a, `/invite Phone${tag}`);
await waitFor(phone, () => !!document.querySelector('.prompt.party'));
await phone.screenshot({ path: `${out}/p4-8-phone-invite.png` });
const accept = await phone.locator('.prompt.party button.primary').boundingBox();
if (accept) await phone.touchscreen.tap(accept.x + accept.width / 2, accept.y + accept.height / 2);
check(await waitFor(phone, () => document.querySelectorAll('#party-frames .pf').length === 2), 'phone shows two party frames');
const mini = await phone.locator('#chat-mini').boundingBox();
if (mini) await phone.touchscreen.tap(mini.x + mini.width / 2, mini.y + mini.height / 2);
check(await waitFor(phone, () => !document.getElementById('chat').hidden), 'tapping the chat button opens chat');
await phone.screenshot({ path: `${out}/p4-9-phone-chat.png` });
const overflow = await phone.evaluate(() => [...document.querySelectorAll('#chat, #party-frames, #social-prompts')].some((e) => { const r = e.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; }));
check(!overflow, 'social UI fits the phone screen');

const bad = errors.filter((e) => !/GPU stall|swiftshader|WebGL|favicon/i.test(e));
console.log('console problems:', bad.length ? bad : 'none');
if (bad.length) fail('console errors');
console.log(failed ? `${failed} check(s) failed` : 'all p4 checks passed');
await browser.close();
