import {chromium} from 'playwright-core';import assert from 'node:assert/strict';
const b=await chromium.launch({executablePath:process.env.CHROME??'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let p;const errors=[];
try{
 p=await b.newPage({viewport:{width:844,height:390},hasTouch:true});p.on('pageerror',e=>errors.push(e.message));await p.goto((process.argv[2]??'http://127.0.0.1:5174/')+'?dev=1&hour=12');await p.waitForSelector('#g-off:not([hidden])');await p.fill('#name','Network builder');await p.click('#btn-guest');
 const ready=()=>p.waitForFunction(()=>window.__eigen?.state().ready&&window.__eigen.game.gameplay.profile.loaded,null,{timeout:60000});await ready();
 await p.evaluate(()=>{const g=window.__eigen.game;g.app.ticker.maxFPS=10;g.settings().reducedMotion=true;for(const[id,n]of [['timber_floor',2],['timber_stairs',1]])g.net.dev({cmd:'give',id,n});g.net.dev({cmd:'tp',x:-193.5,y:-498.5});});
 await p.waitForFunction(()=>window.__eigen.game.gameplay.profile.count('timber_floor')===2&&Math.abs(window.__eigen.state().y+498.5)<.2);
 const use=async(id,x,y)=>{await p.evaluate(({id,x,y})=>{const g=window.__eigen.game;g.net.use({slot:g.gameplay.profile.inv.findIndex(s=>s?.id===id),tx:x,ty:y});},{id,x,y});await p.waitForTimeout(400);};
 await use('timber_floor',-194,-499);await use('timber_floor',-193,-499);await use('timber_stairs',-194,-499);
 await p.waitForFunction(()=>window.__eigen.game.store.structureAt(-194,-80499)?.data.stairs==='down'||window.__eigen.game.store.structureAt(-194,-499)?.data.stairs==='up');
 await p.keyboard.press('KeyX');await p.waitForFunction(()=>Math.abs(window.__eigen.state().y+80498.5)<.2,null,{timeout:30000});
 await p.reload();await ready();await p.evaluate(()=>window.__eigen.game.app.ticker.maxFPS=10);await p.waitForFunction(()=>window.__eigen.game.store.structureAt(-194,-80499)?.data.stairs==='down');
 await p.keyboard.press('KeyX');await p.waitForFunction(()=>Math.abs(window.__eigen.state().y+498.5)<.2,null,{timeout:30000});
 await p.screenshot({path:'/tmp/construction-network.png'});assert.deepEqual(errors,[]);console.log('PASS: multiplayer touch landscape, reduced motion, authentic Use stairs, upstairs saved reload and descent');
 await p.close();p=await b.newPage({viewport:{width:1280,height:900}});await p.goto('http://127.0.0.1:5174/labs/artlab.html?lab=construction');await p.waitForFunction(()=>window.__lab?.ready);assert.equal(await p.locator('figure').count(),26);await p.screenshot({path:'/tmp/construction-gallery.png',fullPage:true});console.log('PASS: original construction art lab, 26 material/orientation samples');
} catch(e){if(p){await p.screenshot({path:'/tmp/construction-network-failure.png'});console.log(await p.evaluate(()=>window.__eigen?.state()));}throw e;}finally{await b.close();}
