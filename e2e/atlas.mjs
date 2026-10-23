// Real game integration: map controls, fog, no generation on pan, persistence and layer isolation.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5240/', mobile=process.argv.includes('--mobile'), peers=process.argv.includes('--peers');
const out=`/tmp/eigenlands-atlas-${mobile?'landscape':'desktop'}-${new URL(base).port}`;mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME??'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try {
 const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:800},hasTouch:mobile});const page=await context.newPage(), errors=[];
 const shot=options=>process.argv.includes('--no-shots')?Promise.resolve():page.screenshot(options);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}?dev=1&hour=12`);await page.waitForSelector('#g-off:not([hidden])');await page.fill('#name','Cartographer');await page.click('#btn-guest');await page.waitForFunction(()=>window.__eigen?.state().ready,null,{timeout:60000});
 for(let i=0;i<2&&await page.locator('.p3-lumen-skip').isVisible();i++)await page.locator('.p3-lumen-skip').click();
 await page.waitForFunction(()=>window.__eigen.state().p34.chartPages>0);await page.waitForTimeout(1200);
 if(peers){
   const other=await browser.newContext({viewport:{width:844,height:540}}),b=await other.newPage();
   await b.goto(`${base}?dev=1&hour=12`);await b.waitForSelector('#g-off:not([hidden])');await b.fill('#name','Chartfriend');await b.click('#btn-guest');await b.waitForFunction(()=>window.__eigen?.state().ready,null,{timeout:60000});
   const id=await b.evaluate(()=>window.__eigen.game.myId);
   const teleport=async x=>{await b.evaluate(x=>window.__eigen.game.net.dev({cmd:'tp',x,y:4.5}),x);await page.bringToFront();await page.waitForFunction(([id,x])=>Math.abs(window.__eigen.game.ext.atlas.state.players.get(id)?.x-x)<.2,[id,x]);};
   const cyan=()=>{const c=document.querySelector('#atlas-mini canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]===127&&d[i+1]===227&&d[i+2]===211)n++;return n;};
   await teleport(5.5);await page.waitForFunction(cyan);await teleport(15.5);await page.waitForFunction(()=>{const c=document.querySelector('#atlas-mini canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=4)if(d[i]===127&&d[i+1]===227&&d[i+2]===211)return false;return true;});
   await teleport(5.5);await page.waitForFunction(cyan);console.log('Two-player markers respect discovery fog');
 }
 await shot({path:`${out}/minimap.png`});
 const mini=await page.locator('#atlas-mini').boundingBox();assert.ok(mini&&mini.x>=0&&mini.y>=0&&mini.x+mini.width<=(mobile?844:1280));
 await page.keyboard.press('KeyM');await page.getByRole('dialog',{name:'World atlas'}).waitFor();assert.equal(await page.evaluate(()=>window.__eigen.state().p34.voice),false);
 const pages=await page.evaluate(()=>window.__eigen.state().chunks);
 await page.getByRole('button',{name:'Pan right',exact:true}).click();await page.getByRole('button',{name:'+ Zoom',exact:true}).click();await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.__eigen.state().chunks),pages,'Map pan does not generate world chunks');
 await page.getByRole('button',{name:'Centre on me',exact:true}).focus();await page.keyboard.press('Space');
 assert.ok(await page.evaluate(()=>{const a=window.__eigen.game.ext.atlas,p=window.__eigen.game.predictor.sim;return Math.hypot(a.centre.x-p.x,a.centre.y-p.y)<.2;}),'Space activates the dialog button without a dodge');
 const chart=page.locator('.atlas-canvas');await chart.click({position:{x:10,y:10}});assert.equal(await page.evaluate(()=>window.__eigen.state().p34.chartWaypoints),0,'Unexplored ground refuses a waypoint');
 await page.getByRole('textbox',{name:'Waypoint name'}).fill('Home trail');await page.getByRole('button',{name:'Mark my position',exact:true}).click();assert.equal(await page.evaluate(()=>window.__eigen.state().p34.chartWaypoints),1);
 await page.getByRole('checkbox',{name:'Enemies',exact:true}).check();await page.getByRole('button',{name:'Hide minimap',exact:true}).click();
 await page.getByRole('combobox',{name:'Minimap size'}).selectOption('176');await page.getByRole('button',{name:'Show minimap',exact:true}).click();await page.waitForTimeout(300);
 const overlap=await page.evaluate(()=>{const a=document.querySelector('#atlas-mini').getBoundingClientRect(),b=document.querySelector('#qtrack')?.getBoundingClientRect();return !!b&&a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;});assert.equal(overlap,false,'The largest minimap leaves quest text clear');
 await page.getByRole('button',{name:'Hide minimap',exact:true}).click();await page.getByRole('combobox',{name:'Minimap size'}).selectOption('112');await chart.scrollIntoViewIfNeeded();await page.waitForTimeout(400);await shot({path:`${out}/atlas.png`});
 await page.keyboard.press('Escape');await page.locator('#modal').waitFor({state:'hidden'});
 await page.keyboard.press('KeyM');await page.getByRole('dialog',{name:'World atlas'}).waitFor();await page.keyboard.press('KeyM');await page.locator('#modal').waitFor({state:'hidden'});
 const markers=await page.evaluate(()=>window.__eigen.state().p34.chartLandmarks);
 await page.reload();await page.waitForFunction(()=>window.__eigen?.state().ready&&window.__eigen.state().p34.chartPages>0,null,{timeout:60000});
 assert.equal(await page.evaluate(()=>window.__eigen.state().p34.chartWaypoints),1);assert.equal(await page.locator('#atlas-mini').isVisible(),false);
 await page.keyboard.press('KeyM');await page.getByRole('dialog',{name:'World atlas'}).waitFor();assert.equal(await page.getByRole('checkbox',{name:'Enemies',exact:true}).isChecked(),true);assert.equal(await page.getByRole('combobox',{name:'Minimap size'}).inputValue(),'112');
 await page.getByRole('button',{name:'Show minimap',exact:true}).click();
 await page.getByRole('combobox',{name:'Map layer'}).selectOption('Upper rooms');await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.__eigen.game.ext.atlas.journal.tile(.5,-80000)),undefined,'Selecting a layer does not reveal its terrain');
 await page.keyboard.press('Escape');await page.evaluate(()=>window.__eigen.game.net.dev({cmd:'tp',x:59.5,y:-80003.5}));await page.waitForFunction(()=>Math.abs(window.__eigen.state().y+80003.5)<.5,null,{timeout:40000});
 await page.waitForFunction(()=>window.__eigen.game.ext.atlas.journal.tile(59.5,-80003.5)!==undefined);await page.keyboard.press('KeyM');await page.waitForFunction(()=>document.querySelector('[aria-label="Map layer"]')?.value==='Upper rooms');await page.waitForTimeout(500);await shot({path:`${out}/upper-room-chart.png`});
 await page.evaluate(()=>{const a=window.__eigen.game.ext.atlas,n=a.journal.chunks.size,set=Storage.prototype.setItem;try{Storage.prototype.setItem=()=>{throw new DOMException('Full','QuotaExceededError');};a.changed=true;a.save();if(!a.warned||a.journal.chunks.size!==n)throw new Error('Quota failure lost the live chart');}finally{Storage.prototype.setItem=set;}a.save();});
 assert.deepEqual(errors,[]);console.log('Atlas passed: desktop/touch controls, M toggle, fog, no generation on pan, saved waypoint/preferences, reload and layer isolation', {markers,out});
} catch(e){for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;} finally {await browser.close();}
