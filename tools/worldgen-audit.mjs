// TSX_TSCONFIG_PATH=packages/server/tsconfig.json node --import tsx tools/worldgen-audit.mjs [outdir] [worldgen module]
// Reports existing topology honestly; does not claim a new generator or gameplay elevation.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
const out=resolve(process.argv[2]??'/tmp/eigenlands-world-audit');mkdirSync(out,{recursive:true});
const source=resolve(process.argv[3]??'packages/shared/src/worldgen.ts');
const world=await import(pathToFileURL(source).href);
const {T,TILE_DEFS}=await import('../packages/shared/src/tiles.ts');
const width=384,step=2,min=-384,seeds=[7,1337,20260101];
const biomeColors=['#708b4f','#37543e','#a27644','#748d92','#52695a','#c2a16a','#655b85','#493847'];
const browser=await chromium.launch({executablePath:process.env.CHROME??'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try {
 const page=await browser.newPage();
 for(const seed of seeds){
  const tiles={},biomes={},ids=new Int16Array(width*width).fill(-1),rgb=new Uint8ClampedArray(width*width*4),heightRgb=rgb.slice();let land=0;
  const color=hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255];
  for(let py=0;py<width;py++)for(let px=0;px<width;px++){
   const x=min+px*step,y=min+py*step,i=py*width+px,t=world.tileAt(seed,x,y),b=world.biomeAt(seed,x,y),h=world.sampleClimate(seed,x,y).height;
   const water=t===T.WATER||t===T.DEEP_WATER;tiles[TILE_DEFS[t]?.name??String(t)]=(tiles[TILE_DEFS[t]?.name??String(t)]??0)+1;
   if(!water){land++;biomes[b]=(biomes[b]??0)+1;ids[i]=world.BIOMES.indexOf(b);}
   rgb.set(color(water?t===T.DEEP_WATER?'#182b45':'#436e82':biomeColors[world.BIOMES.indexOf(b)]),i*4);
   const value=Math.round(Math.max(0,Math.min(1,(h+1)/2))*255);heightRgb.set([value,value,value,255],i*4);
  }
  const seen=new Uint8Array(ids.length),areas=[];
  for(let i=0;i<ids.length;i++)if(ids[i]>=0&&!seen[i]){
   let area=0;const queue=[i];seen[i]=1;
   for(let q=0;q<queue.length;q++){const at=queue[q];area++;for(const next of[at%width?at-1:-1,at%width<width-1?at+1:-1,at-width,at+width])if(next>=0&&next<ids.length&&!seen[next]&&ids[next]===ids[i]){seen[next]=1;queue.push(next);}}
   areas.push(area*step*step);
  }
  const walks=[];
  for(const y of[-120,-80,0,80,120]){let changes=0,previous=world.biomeAt(seed,-500,y);for(let x=-499;x<500;x++){const b=world.biomeAt(seed,x,y);if(b!==previous)changes++;previous=b;}walks.push({y,changesPer1000Tiles:changes});}
  const pct=(counts,denominator)=>Object.fromEntries(Object.entries(counts).map(([k,n])=>[k,+(n*100/denominator).toFixed(3)]));
  const row={seed,sampling:{min,max:min+(width-1)*step,step,warning:'Region areas are 4-connected sampled surface-land components; sampling may miss tiny features. Height image is existing continuous climate height, not gameplay levels.'},landPercent:+(land*100/ids.length).toFixed(3),tilePercent:pct(tiles,ids.length),landBiomePercent:pct(biomes,land),sampledRegionCount:areas.length,meanRegionTiles:areas.reduce((a,b)=>a+b,0)/Math.max(1,areas.length),minRegionTiles:Math.min(...areas),regionsUnder400Tiles:areas.filter(n=>n<400).length,walks,meanChangesPer1000Tiles:walks.reduce((n,w)=>n+w.changesPer1000Tiles,0)/walks.length};
  results.push(row);
  for(const[name,data]of[['biomes',rgb],['current-height',heightRgb]]){
   const png=await page.evaluate(({data,width})=>{const c=document.createElement('canvas');c.width=c.height=width;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),width,width),0,0);return c.toDataURL('image/png').split(',')[1];},{data:Array.from(data),width});
   writeFileSync(`${out}/${seed}-${name}.png`,Buffer.from(png,'base64'));
  }
 }
 writeFileSync(`${out}/report.json`,JSON.stringify({source,results},null,2)+'\n');console.log(JSON.stringify(results.map(r=>({seed:r.seed,landPercent:r.landPercent,meanRegionTiles:r.meanRegionTiles,regionsUnder400Tiles:r.regionsUnder400Tiles,meanChangesPer1000Tiles:r.meanChangesPer1000Tiles})),null,2));
}finally{await browser.close();}
