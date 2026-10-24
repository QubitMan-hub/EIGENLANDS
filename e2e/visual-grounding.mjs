import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:5174/';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'?dev=1&hour=12');await p.waitForSelector('#g-off:not([hidden])');await p.fill('#name','Grounding check');await p.click('#btn-guest');await p.waitForFunction(()=>window.__eigen?.state().ready,null,{timeout:60000});
 await p.evaluate(()=>{const g=window.__eigen.game;g.app.ticker.maxFPS=10;window.__centering=[];g.app.ticker.add(()=>{if(!g.input.lookHeld||g.fx.shake>0)return;const v=g.views.get(g.myId);if(v)window.__centering.push(Math.hypot(g.world.x+v.root.x*g.scale-innerWidth/2,g.world.y+(v.root.y-6)*g.scale-innerHeight/2));});});
 await p.click('#btn-menu');await p.click('#btn-settings');await p.getByLabel('Movement controls',{exact:true}).selectOption('mouse');await p.click('#btn-close');
 await p.mouse.move(790,410);await p.mouse.down({button:'right'});await p.waitForTimeout(1800);await p.mouse.move(480,410);await p.waitForTimeout(1800);await p.mouse.up({button:'right'});
 const samples=await p.evaluate(()=>window.__centering);assert(samples.length>3);assert(Math.max(...samples)<3,`Camera deviated ${Math.max(...samples)} pixels`);
 await p.screenshot({path:'/tmp/polish-centered.png'});
 const shadows=[];
 for(const hour of [9,15]){
  await p.evaluate(hour=>{const g=window.__eigen.game;g.settings().reducedMotion=true;g.hourOverride=hour;},hour);await p.waitForTimeout(1000);
  shadows.push(await p.evaluate(()=>{const g=window.__eigen.game,objects=[...g.objects.chunks.values()].flatMap(m=>[...m.values()]);const o=objects.find(o=>o.kind==='tree'&&o.shadow.visible);if(!o)return null;return{skew:o.shadow.skew.x,ground:Math.hypot(o.root.x-o.shadow.x,o.root.y-o.shadow.y),anchor:Math.abs(o.root.anchor.y-o.shadow.anchor.y)};}));
 }
 assert(shadows.every(s=>s&&s.ground===0&&s.anchor===0),'Tree shadows share their ground origin and frame anchor');assert(shadows[0].skew<0&&shadows[1].skew>0,'Actual gameplay shadows follow the moving sun');

 for(const hour of [6,9,12,17,18,22]){await p.goto(base+`labs/artlab.html?lab=town&hour=${hour}&scale=3&motion=0`);await p.waitForFunction(()=>window.__lab?.ready);await p.screenshot({path:`/tmp/polish-town-${hour}.png`});}
 const sun=await p.evaluate(async()=>{const {sunFor}=await import('/src/game/objectviews.ts');return [sunFor(6-.001),sunFor(6+.001),sunFor(18-.001),sunFor(18+.001),sunFor(9),sunFor(15)];});
 assert(Math.abs(sun[0].alpha-sun[1].alpha)<.001);assert(Math.abs(sun[2].alpha-sun[3].alpha)<.001);assert(sun[4].dx<0&&sun[5].dx>0);
 await p.goto(base+'labs/artlab.html?lab=icons');await p.waitForFunction(()=>window.__lab?.ready);await p.screenshot({path:'/tmp/polish-icons.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('Centered RMB steering, continuous horizon shadows, moving sun direction, town day/night and icon gallery passed');
}finally{await b.close();}
