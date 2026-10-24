// Real crafting, structural transport, collision, stairs, cutaways and local persistence.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5240/',out=process.argv[3]??'/tmp/construction-shots';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME??'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let p;const errors=[];
try{
 p=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'?dev=1&hour=12');await p.waitForSelector('#g-off:not([hidden])');await p.fill('#name','Homebuilder');await p.click('#btn-guest');
 const ready=()=>p.waitForFunction(()=>window.__eigen?.state().ready&&window.__eigen.game.gameplay.profile.loaded,null,{timeout:60000});await ready();
 await p.evaluate(()=>{const g=window.__eigen.game;g.app.ticker.maxFPS=12;g.net.dev({cmd:'give',id:'wood',n:220});g.net.dev({cmd:'give',id:'stone',n:99});g.net.dev({cmd:'give',id:'fiber',n:99});});
 await p.waitForFunction(()=>window.__eigen.game.gameplay.profile.count('wood')>=90);
 // Find a clear wilderness patch. Never edit the terrain to manufacture a passing scene.
 const site=await p.evaluate(()=>{const g=window.__eigen.game;for(let y=-500;y<500;y+=5)for(let x=-500;x<500;x+=5){let ok=true;for(let dy=0;dy<5;dy++)for(let dx=0;dx<5;dx++){const t=g.store.getTile(x+dx,y+dy);if(![2,3,4,5,9,10].includes(t)||g.store.objectAt(x+dx,y+dy))ok=false;}if(ok)return{x,y};}return null;});assert(site,'clear generated land');
 const tp=async(x,y)=>{await p.evaluate(({x,y})=>window.__eigen.game.net.dev({cmd:'tp',x,y}),{x,y});await p.waitForFunction(({x,y})=>Math.hypot(window.__eigen.state().x-x,window.__eigen.state().y-y)<.2,{x,y},{timeout:20000});};
 await tp(site.x+2.5,site.y+2.5);
 await p.screenshot({path:`${out}/before.png`});
 // Use the shipped crafting UI for the foundation recipe.
 await p.keyboard.press('KeyC');await p.locator('.recipe').filter({has:p.locator('.rname b',{hasText:'Timber Floor'})}).locator('button',{hasText:'×5'}).click();await p.keyboard.press('KeyC');
 await p.waitForFunction(()=>window.__eigen.game.gameplay.profile.count('timber_floor')>=5);
 for(const[id,n]of [['timber_floor',20],['timber_floor',8],['timber_wall',16],['timber_door',1],['shingle_roof',20],['shingle_roof',15],['timber_stairs',1]]){
  const count=await p.evaluate(id=>window.__eigen.game.gameplay.profile.count(id),id);await p.evaluate(({id,n})=>{const g=window.__eigen.game,m=g.predictor.sim;g.net.craft({station:'hand',tx:Math.floor(m.x),ty:Math.floor(m.y),recipe:id,n});},{id,n});await p.waitForFunction(({id,count,n})=>window.__eigen.game.gameplay.profile.count(id)===count+n,{id,count,n});await p.waitForTimeout(350);
 }
 const place=async(id,x,y,turn=0)=>{
  await p.evaluate(({id,x,y,turn})=>{const g=window.__eigen.game,slot=g.gameplay.profile.inv.findIndex(s=>s?.id===id);g.net.use({slot,tx:x,ty:y,turn});},{id,x,y,turn});
  const layer=id.endsWith('floor')?'floor':id.endsWith('roof')?'roof':id==='timber_stairs'?'stairs':'wall';
  await p.waitForFunction(({x,y,layer})=>!!window.__eigen.game.store.structureAt(x,y)?.data[layer],{x,y,layer},{timeout:10000});
  await p.waitForTimeout(340);
 };
 // Construct a 5x5 house while standing within real reach of each piece.
 for(let dy=0;dy<5;dy++)for(let dx=0;dx<5;dx++){await tp(site.x+dx+.5,site.y+dy+.5);await place('timber_floor',site.x+dx,site.y+dy);}
 for(let i=0;i<5;i++){
  for(const[x,y,turn]of [[site.x+i,site.y,2],[site.x+i,site.y+4,0],[site.x,site.y+i,3],[site.x+4,site.y+i,1]]){
   if(await p.evaluate(({x,y})=>!!window.__eigen.game.store.structureAt(x,y)?.data.wall,{x,y}))continue;
   await tp(site.x+Math.max(1,Math.min(3,x-site.x))+.5,site.y+Math.max(1,Math.min(3,y-site.y))+.5);
   await place(x===site.x+2&&y===site.y+4?'timber_door':'timber_wall',x,y,turn);
  }
 }
 // Roof over walls as well as interior furniture space.
 for(let dy=0;dy<5;dy++)for(let dx=0;dx<5;dx++){
  const x=site.x+dx,y=site.y+dy;await tp(site.x+Math.max(1,Math.min(3,dx))+.5,site.y+Math.max(1,Math.min(3,dy))+.5);await place('shingle_roof',x,y);
 }
 await tp(site.x+1.5,site.y+1.5);await place('timber_stairs',site.x+1,site.y+1,0);
 // Furniture shares structural coordinates and survives roofs.
 await p.evaluate(()=>window.__eigen.game.net.dev({cmd:'give',id:'chest',n:1}));await p.waitForFunction(()=>window.__eigen.game.gameplay.profile.count('chest')===1);
 await p.evaluate(({x,y})=>{const g=window.__eigen.game;g.net.use({slot:g.gameplay.profile.inv.findIndex(s=>s?.id==='chest'),tx:x+2,ty:y+1});},site);
 await p.waitForFunction(({x,y})=>window.__eigen.game.store.objectAt(x+2,y+1)?.kind==='chest',site);
 await p.waitForFunction(()=>window.__eigen.game.construction.count>0);
 assert(await p.evaluate(({x,y})=>{const g=window.__eigen.game;return g.store.solidAt(x,y)&&g.store.objectAt(x+2,y+1)?.kind==='chest'&&g.store.structureAt(x+2,y+1)?.data.roof==='shingle_roof';},site));
 await p.waitForFunction(()=>window.__eigen.game.construction.room.size>0);await p.screenshot({path:`${out}/interior.png`});
 await tp(site.x+2.5,site.y+1.5);await p.keyboard.down('KeyW');await p.keyboard.down('KeyD');await p.waitForTimeout(1200);await p.keyboard.up('KeyW');await p.keyboard.up('KeyD');
 assert((await p.evaluate(()=>window.__eigen.state().y))>=site.y+1.15,'real movement stops at the constructed north wall');
 await tp(site.x+1.5,site.y+1.5);
 await p.keyboard.press('KeyX');await p.waitForFunction(({y})=>Math.abs(window.__eigen.state().y-(y+1.5-80000))<.2,site,{timeout:30000});
 for(let dy=1;dy<=3;dy++)for(let dx=1;dx<=3;dx++){
  if(dx===1&&dy===1)continue;
  await tp(site.x+Math.max(1,Math.min(2,dx))+.5,site.y+Math.max(1,Math.min(2,dy-1))+.5-80000);
  await place('timber_floor',site.x+dx,site.y+dy-80000);
 }
 await tp(site.x+2.5,site.y+2.5-80000);
 for(let dy=1;dy<=3;dy++)for(let dx=1;dx<=3;dx++)await place('shingle_roof',site.x+dx,site.y+dy-80000);
 await p.screenshot({path:`${out}/upper-floor.png`});
 await p.reload();await ready();await p.evaluate(()=>window.__eigen.game.app.ticker.maxFPS=12);
 await p.waitForFunction(({x,y})=>window.__eigen.game.store.structureAt(x+1,y+1-80000)?.data.stairs==='down'&&window.__eigen.game.store.structureAt(x+3,y+3-80000)?.data.roof==='shingle_roof',site,{timeout:30000});
 await tp(site.x+1.5,site.y+1.5-80000);await p.keyboard.press('KeyX');await p.waitForFunction(({y})=>Math.abs(window.__eigen.state().y-(y+1.5))<.2,site,{timeout:30000});
 await p.evaluate(({x,y})=>window.__eigen.game.net.open(x+2,y+4),site); // outside reach: server must refuse
 await tp(site.x+2.5,site.y+3.5);await p.evaluate(({x,y})=>window.__eigen.game.net.open(x+2,y+4),site);
 await p.waitForFunction(({x,y})=>!window.__eigen.game.store.solidAt(x+2,y+4),site);
 await tp(site.x+2.5,site.y+6.5);await p.waitForFunction(()=>window.__eigen.game.construction.room.size===0);await p.screenshot({path:`${out}/exterior.png`});
 // Selected piece exposes a small native Rotate control, including touch landscape.
 const slot=await p.evaluate(()=>window.__eigen.game.gameplay.profile.inv.findIndex(s=>s?.id==='shingle_roof'));if(slot>=10){await p.evaluate(slot=>window.__eigen.game.net.invMove({from:slot,to:0}),slot);await p.waitForFunction(()=>window.__eigen.game.gameplay.profile.inv[0]?.id==='shingle_roof');}
 await p.locator(`.hslot[data-i="${slot<10?slot:0}"]`).click();await p.waitForSelector('#build-rotate:not([hidden])');await p.click('#build-rotate');assert.equal(await p.evaluate(()=>window.__eigen.game.gameplay.buildRotation),1);
 await p.setViewportSize({width:844,height:390});await p.waitForTimeout(350);await p.screenshot({path:`${out}/mobile.png`});
 assert(await p.evaluate(()=>{const a=document.querySelector('#build-rotate').getBoundingClientRect(),b=document.querySelector('#target-hint').getBoundingClientRect();return a.top>=b.bottom||b.top>=a.bottom;}),'rotation and target prompt do not overlap');
 assert(await p.locator('#build-rotate').evaluate(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
 await p.reload();await ready();await p.evaluate(()=>window.__eigen.game.app.ticker.maxFPS=12);
 await p.waitForFunction(({x,y})=>window.__eigen.game.store.structureAt(x+1,y+1)?.data.stairs==='up'&&window.__eigen.game.store.objectAt(x+2,y+1)?.kind==='chest',site,{timeout:30000});
 assert(await p.evaluate(({x,y})=>!!window.__eigen.game.store.structureAt(x,y)?.owner,site));
 assert.deepEqual(errors,[]);console.log('PASS: real UI crafting, arbitrary two-floor house, owned collision, door, paired stairs, furniture under roofs, mobile rotation and persisted reload',site);
}catch(e){if(p){await p.screenshot({path:`${out}/failure.png`});console.log(await p.evaluate(()=>({ready:window.__eigen?.state().ready,position:[window.__eigen?.state().x,window.__eigen?.state().y],inv:window.__eigen?.state().inv,toasts:document.querySelector('#toasts')?.textContent})));}throw e;}finally{await browser.close();}
