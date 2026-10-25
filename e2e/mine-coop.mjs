import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {caveRegion} from '../packages/shared/src/undercroft.ts';
import {mineLoopAt} from '../packages/shared/src/mines.ts';
const base=process.argv[2]??'http://127.0.0.1:5240/',server=process.argv[3]??'http://127.0.0.1:2567',out=process.argv[4]??'/tmp/mine-coop';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];let p,q;
const ready=async page=>{await page.waitForFunction(()=>window.__eigen?.state().ready&&window.__eigen.game.gameplay.profile.loaded,null,{timeout:90000});await page.evaluate(()=>window.__eigen.game.app.ticker.maxFPS=20);};
const login=async(page,name)=>{await page.waitForFunction(()=>!document.querySelector('#btn-guest').disabled);await page.fill('#name',name);await page.click('#btn-guest');await ready(page);};
const inspect=page=>page.evaluate(()=>{const g=window.__eigen.game;return{...window.__eigen.state(),account:g.accountId,session:g.myId,cart:g.predictor.sim.cart,day:Math.max(0,Math.floor((g.clock.serverNow(performance.now())-Date.UTC(2026,9,21))/1440000)),hour:window.__eigen.state().hour};});
const tp=async(page,x,y)=>{await page.evaluate(({x,y})=>window.__eigen.game.net.dev({cmd:'tp',x,y}),{x,y});await page.waitForFunction(({x,y})=>Math.hypot(window.__eigen.state().x-x,window.__eigen.state().y-y)<.2,{x,y},{timeout:30000});await page.waitForTimeout(600);};
try{
 const a=await browser.newContext({viewport:{width:1280,height:720}}),b=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 for(const c of[a,b]){await c.addInitScript(()=>{try{localStorage.setItem('eigen.settings',JSON.stringify({graphics:'economy',reducedMotion:true}));}catch{}});c.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});});}
 p=await a.newPage();await p.goto(base+'?dev=1');await login(p,'Solo keeper');console.log('solo ready');const solo=await inspect(p);assert.equal(solo.day,0);assert(solo.hour>=6&&solo.hour<8);
 const soloToken=await p.evaluate(()=>localStorage.getItem('eigen.token'));await p.screenshot({path:`${out}/solo.png`});
 // Join through the real title controls of the production Pages build, retaining its solo save.
 await p.goto(base+'?dev=1');await ready(p);await p.goto(base+'?server=javascript%3Aalert(1)');await p.waitForSelector('.friends-menu');await p.locator('.friends-menu summary').click();await p.fill('#friend-server',server);await p.click('#btn-join-server');
 await p.waitForURL(url=>url.searchParams.get('server')===server);await p.goto(p.url()+'&dev=1');await login(p,'Online miner');const online=await inspect(p);console.log('online ready');assert.notEqual(online.account,solo.account);assert.equal(await p.evaluate(()=>localStorage.getItem('eigen.token')),soloToken);
 assert.equal(await p.evaluate(()=>!!window.__eigenSolo),false,'online mode must not boot an in-page server');
 const invite=new URL(p.url());invite.searchParams.set('dev','1');q=await b.newPage();await q.goto(invite.href);await login(q,'Online friend');const friend=await inspect(q);console.log('friend ready');assert.notEqual(friend.account,online.account);assert.equal(friend.day,online.day);
 await p.waitForFunction(id=>window.__eigen.game.views.has(id),friend.session);await q.waitForFunction(id=>window.__eigen.game.views.has(id),online.session);
 // Development-only fixture transport, then all riding controls use real browser input / server authority.
 const seed=await p.evaluate(()=>window.__eigen.game.store.seed);let loop;for(let gy=-4;gy<=4&&!loop;gy++)for(let gx=-4;gx<=4&&!loop;gx++){const r=caveRegion(seed,gx,gy);loop=mineLoopAt(seed,r.x,r.y)??undefined;}assert(loop);
 await tp(p,loop.x+.5,loop.y+1.5);await tp(q,loop.x+2.5,loop.y+1.5);
 await p.evaluate(({x,y})=>window.__eigen.game.net.open(x,y),loop);await p.waitForFunction(()=>window.__eigen.game.predictor.sim.cart>0);
 console.log('boarded');const mineId=await p.evaluate(()=>window.__eigen.game.myId);
 await q.waitForFunction(id=>window.__eigen.game.net.room.state.players.get(id)?.cart===true,mineId);
 const start=await inspect(p);await p.keyboard.down('KeyD');await p.waitForFunction(x=>window.__eigen.state().x>x+3,start.x,{timeout:20000});await p.keyboard.up('KeyD');await p.waitForTimeout(400);const stop=await inspect(p);await p.waitForTimeout(500);assert(Math.abs((await inspect(p)).x-stop.x)<.1,'release brakes');assert(stop.cart>0);
 await p.screenshot({path:`${out}/minecart-rider.png`});await q.screenshot({path:`${out}/minecart-friend-touch.png`});
 await p.keyboard.press('Space');await p.waitForFunction(()=>window.__eigen.game.predictor.sim.cart===0);await q.waitForFunction(id=>!window.__eigen.game.net.room.state.players.get(id)?.cart,mineId);
 // Return to original solo account and its independently persisted calendar.
 await p.goto(base+'?dev=1');await ready(p);const restored=await inspect(p);assert.equal(restored.account,solo.account);assert.equal(restored.day,0);assert(restored.hour<9);
 assert.deepEqual(errors,[]);console.log('PASS production Pages solo → online join, isolated credentials, two independent browser players, shared clock, authoritative minecart visibility/movement/braking/Space dismount, touch landscape, original solo save/calendar restored');
}catch(e){if(p){console.log('p',await p.evaluate(()=>({state:window.__eigen?.state(),message:document.querySelector('#login-msg')?.textContent,toasts:document.querySelector('#toasts')?.textContent})));await p.screenshot({path:`${out}/failure.png`});}console.log('errors',errors);throw e;}finally{await browser.close();}
