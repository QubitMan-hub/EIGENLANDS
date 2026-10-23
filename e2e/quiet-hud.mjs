// Real desktop/touch gameplay: Journal-only guides/quests and native utility menu.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/';
const out = '/tmp/eigenlands-quiet-hud'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 for (const mobile of [false, true]) {
  const context = await browser.newContext({ viewport: mobile ? { width:844, height:390 } : { width:1280, height:720 }, hasTouch:mobile });
  await context.addInitScript(() => localStorage.setItem('eigen.tutorial2', JSON.stringify(['moved','attacked','dashed','selected','chopped','mined','crafted','tilled'])));
  const page = await context.newPage(), errors = [];
  const shot = options => process.argv.includes('--no-shots') ? Promise.resolve() : page.screenshot(options);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}?dev=1&hour=12`);
  await page.waitForSelector('#g-off:not([hidden])'); await page.fill('#name','Wayfarer'); await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, {timeout:60000});
  for (let i=0;i<2 && await page.locator('.p3-lumen-skip').isVisible();i++) await page.locator('.p3-lumen-skip').click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#qtrack').count(),0);
  assert.equal(await page.locator('#chat').isVisible(),false,'Idle chat starts compact');
  const overlap = await page.evaluate(() => {
    const pairs = [['#hud-right','#hud-actions'],['#hud-left','#hud-right'],['#chat-mini','#stick'],['#chat-mini','#tbtns']];
    return pairs.filter(([a,b])=>{const x=document.querySelector(a),y=document.querySelector(b); if(!x?.getClientRects().length||!y?.getClientRects().length)return false;const r=x.getBoundingClientRect(),s=y.getBoundingClientRect();return r.x<s.right&&r.right>s.x&&r.y<s.bottom&&r.bottom>s.y;});
  });
  assert.deepEqual(overlap,[],'Travel status and chat leave controls clear');
  assert.ok(!((await page.locator('#hint').textContent())??'').includes('Select seeds'));
  assert.equal(await page.locator('#btn-settings').isVisible(),false);
  await page.locator('#btn-menu').focus(); await page.keyboard.press('Space');
  await page.locator('#btn-settings').waitFor({state:'visible'});
  const menu = await page.locator('#hud-menu').boundingBox();
  assert.ok(menu.x>=0 && menu.x+menu.width<=(mobile?844:1280) && menu.y+menu.height<=(mobile?390:720));
  await shot({path:`${out}/${mobile?'landscape':'desktop'}-menu.png`});
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#btn-settings').isVisible(),false);
  await page.click('#btn-menu'); await page.keyboard.press('KeyI');
  await page.getByRole('dialog',{name:'Pack',exact:true}).waitFor();
  assert.equal(await page.locator('#btn-settings').isVisible(),false,'Choosing a utility closes its menu');
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#btn-menu').evaluate(e=>e===document.activeElement),'Closing the pack returns focus to a visible menu trigger');
  await page.evaluate(()=>window.__eigen.game.gameplay.profile.apply({quests:{welcome:{state:'active',progress:[1,0,0]}}}));
  await page.click('#btn-journal'); await page.getByRole('dialog',{name:'Journal',exact:true}).waitFor();
  await page.getByText('Select seeds and press E on tilled soil to plant. Mind the season!',{exact:true}).waitFor();
  await page.getByText('A Warm Welcome',{exact:true}).waitFor();
  await shot({path:`${out}/${mobile?'landscape':'desktop'}-journal.png`});
  await page.keyboard.press('Escape');
  await shot({path:`${out}/${mobile?'landscape':'desktop'}-world.png`});
  await page.click('#btn-menu'); await page.click('#game',{position:{x:300,y:150}});
  assert.equal(await page.locator('#btn-settings').isVisible(),false,'Outside click dismisses menu');
  if (mobile) {
    await page.setViewportSize({width:390,height:844});
    if (await page.locator('#rotate-device').isVisible()) await page.click('#btn-portrait');
    const portraitOverlap = await page.evaluate(() => {const a=document.querySelector('#hud-right').getBoundingClientRect(), b=document.querySelector('#atlas-mini').getBoundingClientRect(); return a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;});
    assert.equal(portraitOverlap,false,'Portrait fallback keeps travel text above the minimap');
  }
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('Desktop/landscape: Journal-only tutorials and quests, menu keyboard/outside dismissal, utility selection, visible focus return and bounds passed.');
} finally { await browser.close(); }
