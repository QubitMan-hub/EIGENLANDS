// Isolate the real WebGL terrain shader; compare against the last merged cave floor rules.
import{chromium}from'playwright-core';import{mkdirSync,writeFileSync,unlinkSync}from'node:fs';import{execFileSync}from'node:child_process';import assert from'node:assert/strict';
import{caveRegion}from'../packages/shared/src/undercroft.ts';
const out=process.argv[2]??'/tmp/terrain-materials';mkdirSync(out,{recursive:true});
const temp='packages/client/src/labs/.terrain-before.ts';writeFileSync(temp,execFileSync('git',['show','6b3e594:packages/client/src/gl/terrain.frag.ts']),{flag:'wx'});
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage({viewport:{width:1400,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto('http://127.0.0.1:5174/labs/artlab.html?lab=icons');await p.waitForFunction(()=>window.__lab?.ready);
 let r;for(let gy=2;gy<10&&!r;gy++)for(let gx=4;gx<10&&!r;gx++){const q=caveRegion(1337,gx,gy);if(q.biome==='basalt')r=q;}assert(r);
 const report=await p.evaluate(async r=>{
  const[{Application,Shader},{Terrain},old]=await Promise.all([import(performance.getEntriesByType('resource').find(e=>e.name.includes('/node_modules/.vite/deps/pixi__js.js'))?.name),import('/src/game/terrain.ts'),import('/src/labs/.terrain-before.ts')]);
  document.body.replaceChildren();document.body.style.cssText='margin:16px;background:#23332f;color:#f1e4c7;font:14px monospace;overflow:auto';document.documentElement.style.cssText='height:auto;overflow:auto';
  const app=new Application();await app.init({width:384,height:240,resolution:1,antialias:false,preference:'webgl'});app.stop();
  const statistics=(canvas,base)=>{const data=canvas.getContext('2d').getImageData(0,0,256,128).data,mask=new Uint8Array(256*128),seen=new Uint8Array(mask.length);let count=0,max=0;
   for(let i=0;i<mask.length;i++)if(Math.max(...base.map((c,k)=>Math.abs(data[i*4+k]-c)))>10){mask[i]=1;count++;}
   for(let start=0;start<mask.length;start++){if(!mask[start]||seen[start])continue;const q=[start];seen[start]=1;for(let i=0;i<q.length;i++){const at=q[i],x=at%256,y=Math.floor(at/256);for(const n of[x>0?at-1:-1,x<255?at+1:-1,y>0?at-256:-1,y<127?at+256:-1])if(n>=0&&mask[n]&&!seen[n]){seen[n]=1;q.push(n);}}max=Math.max(max,q.length);}
   return{largestMark:max,coverage:count/mask.length};};
  const results=[];let stable=true;
  for(const fixture of[{name:'Basalt floor',tile:25,base:[68,48,57]},{name:'Dirt path',tile:9,base:[175,133,94]},{name:'Rock crown',tile:26,base:[28,38,48]}])for(const detail of[0,1])for(const baseline of[true,false]){
   const store={seed:1337,get:()=>({diff:new Map()}),getTile:()=>fixture.tile};const terrain=new Terrain(app.renderer,store);terrain.resize(256,128);
   if(baseline){for(const shader of terrain.shaders.values())shader.destroy();terrain.shaders.clear();terrain.shaderFor=function(detail){let shader=this.shaders.get(detail);if(!shader){shader=Shader.from({gl:{vertex:old.TERRAIN_VERT,fragment:old.TERRAIN_FRAG.replace('uniform float uDetail;',`const float uDetail = ${detail}.0;`)},resources:{uTiles:this.src,commonUniforms:this.common}});this.shaders.set(detail,shader);}return shader;};}
   const x=(r.x-r.y)*16-128,y=(r.x+r.y)*8-64;terrain.render(x,y,Math.floor(r.x/32),Math.floor(r.y/32),0,1,false,undefined,detail);
   const raw=app.renderer.extract.canvas({target:terrain.sprite}),c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');ctx.drawImage(raw,Math.round(x-terrain.originX),Math.round(y-terrain.originY),256,128,0,0,256,128);c.style.cssText='width:512px;height:256px;image-rendering:pixelated';
   const row=document.createElement('div');row.id=`${fixture.tile}-${detail}-${baseline?'before':'after'}`;row.append(document.createTextNode(`${fixture.name} · ${detail?'High':'Economy'} · ${baseline?'before':'after'}`),c);document.body.append(row);
   const stats=statistics(c,fixture.base);results.push({material:fixture.name,detail,baseline,...stats});
   if(!baseline){const ox=terrain.originX,oy=terrain.originY;terrain.render(x+80,y,Math.floor(r.x/32),Math.floor(r.y/32),0,1,false,undefined,detail);const next=app.renderer.extract.canvas({target:terrain.sprite});const a=raw.getContext('2d').getImageData(0,0,raw.width,raw.height).data,z=next.getContext('2d').getImageData(0,0,next.width,next.height).data,dx=terrain.originX-ox,dy=terrain.originY-oy;
    for(let py=100;py<180;py++)for(let px=20;px<180;px++){const nx=px+dx,ny=py+dy;if(nx<0||ny<0||nx>=raw.width||ny>=raw.height)continue;for(let k=0;k<3;k++)if(a[(ny*raw.width+nx)*4+k]!==z[(py*next.width+px)*4+k])stable=false;}
   }
  }
  app.destroy();return{results,stable};
 },r);
 for(const id of['25-0-before','25-0-after','9-1-before','9-1-after','26-0-before','26-0-after'])await p.locator(`[id="${id}"]`).screenshot({path:`${out}/${id}.png`});
 console.log(JSON.stringify(report,null,2));for(const a of report.results.filter(r=>!r.baseline)){assert(a.largestMark<48,`${a.material}: found a large color island`);assert(a.coverage>.0005&&a.coverage<.09,`${a.material}: detail density is not controlled`);}assert(report.results.find(r=>r.baseline&&r.material==='Basalt floor').largestMark>100);assert(report.stable,'camera movement changed world-anchored texture pixels');assert.deepEqual(errors,[]);console.log('PASS real shader: bounded pixel clusters, no large color islands, stable camera anchoring, both detail modes');
}finally{await b.close();unlinkSync(temp);}
