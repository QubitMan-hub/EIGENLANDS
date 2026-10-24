// A second real client must render the equipped family and its authoritative melee effects.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:5174/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-gl=angle','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});const errors=[];let last;
try{
 const join=async(name,fps)=>{const p=await browser.newPage({viewport:{width:640,height:480}});last=p;p.on('pageerror',e=>errors.push(e.message));await p.goto(`${base}?dev=1&hour=12`);await p.waitForSelector('#g-off:not([hidden])',{timeout:60000});await p.fill('#name',name);await p.click('#btn-guest');await p.waitForFunction(()=>window.__eigen?.state().ready&&window.__eigen.game.gameplay.profile.loaded,null,{timeout:60000});await p.evaluate(fps=>window.__eigen.game.app.ticker.maxFPS=fps,fps);console.log('Joined',name);return p;};
 const actor=await join('Arsenal striker',10),peer=await join('Arsenal observer',5);
 const dev=(p,m)=>p.evaluate(m=>window.__eigen.game.net.dev(m),m);
 await dev(actor,{cmd:'level',level:20});const at=await actor.evaluate(()=>({x:window.__eigen.state().x,y:window.__eigen.state().y}));await dev(peer,{cmd:'tp',x:at.x+1,y:at.y+1});
 const id=await actor.evaluate(()=>window.__eigen.game.myId);await peer.waitForFunction(id=>window.__eigen.game.views.has(id),id,{timeout:20000});
 await peer.evaluate(()=>{window.__remoteMelee=[];const g=window.__eigen.game;for(const method of ['swing','heavy']){const run=g.fx[method].bind(g.fx);g.fx[method]=(...args)=>{window.__remoteMelee.push({method,weapon:args[5],level:args[4]});return run(...args);};}});
 for(const weapon of ['spear','battle_axe','warhammer']){
  await dev(actor,{cmd:'give',id:weapon,n:1});await actor.waitForFunction(weapon=>window.__eigen.game.gameplay.profile.count(weapon)===1,weapon);
  await actor.evaluate(weapon=>{const g=window.__eigen.game;g.net.equip({as:'weapon',slot:g.gameplay.profile.inv.findIndex(s=>s?.id===weapon)});},weapon);
  await peer.waitForFunction(([id,weapon])=>{const g=window.__eigen.game;return g.ext.atlas.state.players.get(id)?.weapon===weapon;},[id,weapon]);
  const slot=await actor.evaluate(()=>window.__eigen.game.gameplay.profile.inv.slice(0,10).findIndex(s=>!s||s.id==='sword'));await actor.locator(`.hslot[data-i="${slot}"]`).click();
  const feet=await actor.evaluate(()=>({...window.__eigen.game.input.feetScreen}));await actor.mouse.click(feet.x+90,feet.y-20);
  await peer.waitForFunction(weapon=>window.__remoteMelee.some(f=>f.method==='swing'&&f.weapon===weapon),weapon,{timeout:20000});
  await peer.waitForFunction(([id,weapon])=>{const g=window.__eigen.game,v=g.views.get(id);return v?.held?.visible&&v.held.texture.source===g.heldWeapons.texture(weapon,0,0).source;},[id,weapon]);
  if(weapon==='warhammer'){
   await actor.waitForFunction(()=>window.__eigen.game.predictor.sim.atkCd===0);await actor.mouse.down();await actor.waitForFunction(()=>window.__eigen.game.predictor.sim.charge>=.8,null,{timeout:20000});await actor.mouse.up();
   await peer.waitForFunction(()=>window.__remoteMelee.some(f=>f.method==='heavy'&&f.weapon==='warhammer'&&f.level>=.99),null,{timeout:20000});
  }
 }
 await peer.screenshot({path:'/tmp/eigenlands-arsenal-observer.png'});assert.deepEqual(errors,[]);console.log('Two-player arsenal passed: all three public weapon identities, actual remote held atlases, tap effects and full hammer-heavy effect');
}catch(e){console.log('Page errors',errors);if(last){await last.screenshot({path:'/tmp/eigenlands-arsenal-observer-failure.png'});console.log('Last page',await last.locator('body').innerText());}throw e;}finally{await browser.close();}
