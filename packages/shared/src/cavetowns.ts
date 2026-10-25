import { CAVE_TOWNS, CAVE_RESIDENTS } from './undercroft';
import { furnish, type Town, type Building } from './town';
import { objSolid } from './objects';
import { T } from './tiles';
const cache = new Map<number, Town[]>();
/** Authored plans sit on the procedural network; no terrain sampling or recursive generation. */
export function caveTowns(seed: number): Town[] {
 const old=cache.get(seed); if(old)return old;
 const towns=CAVE_TOWNS.map(p=>{
  const x0=p.cx-p.w/2,y0=p.cy-p.h/2;
  const t:Town={name:p.name,cx:p.cx,cy:p.cy,x0,y0,x1:x0+p.w-1,y1:y0+p.h-1,abandoned:p.abandoned,buildings:[],objects:[],spots:{},tiles:new Map()};
  const set=(x:number,y:number,v:number)=>{if(x>=x0&&x<=t.x1&&y>=y0&&y<=t.y1)t.tiles.set(x-x0+(y-y0)*p.w,v);};
  const rect=(x:number,y:number,w:number,h:number,v:number)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)set(x+i,y+j,v);};
  rect(x0,y0,p.w,p.h,T.CAVE_FLOOR);rect(x0,p.cy-1,p.w,3,T.PATH);rect(p.cx-1,y0,3,p.h,T.PATH);
  for(let i=0;i<4;i++){
   const x=p.cx+(i%2?7:-22),y=p.cy+(i<2?-17:7);
   const b:Building={id:`${p.id}.house${i}`,kind:i===0?'store':i===1?'smithy':i===2?'inn':'house',x,y,w:12,h:9,doorX:x+5,doorY:y+8,style:p.id==='prismdelve'?2:0};
   t.buildings.push(b);rect(x,y,12,9,T.WALL);rect(x+1,y+1,10,7,i===2?T.FLOOR:T.VAULT_FLOOR);set(b.doorX,b.doorY,T.FLOOR);
   for(let yy=Math.min(b.doorY+1,p.cy);yy<=Math.max(b.doorY+1,p.cy);yy++)set(b.doorX,yy,T.PATH);
   furnish(b,(ox,oy,kind,sub)=>t.objects.push({x:ox,y:oy,kind,sub}),(id,sx,sy)=>{t.spots[`${p.id}.${id}`]={x:sx,y:sy};});
  }
  CAVE_RESIDENTS.filter(n=>n.town===p.id).forEach(n=>{
   const b=t.buildings[Math.floor(n.local/2)]!;
   t.spots[`${n.id}.home`]={x:b.doorX+n.local%2,y:b.doorY-1};
   const rooms=t.buildings,store=rooms[0]!,forge=rooms[1]!,inn=rooms[2]!,archive=rooms[3]!;
   const posts=[{x:p.cx-6,y:p.cy-3},{x:store.x+8,y:store.y+4},{x:inn.x+8,y:inn.y+4},{x:p.cx+14,y:p.cy+2},{x:archive.x+4,y:archive.y+4},{x:forge.x+7,y:forge.y+4},{x:p.cx-15,y:p.cy+3},{x:inn.x+4,y:inn.y+4}];
   const free=(q:{x:number;y:number})=>t.tiles.get(q.x-x0+(q.y-y0)*p.w)!==T.WALL&&!t.objects.some(o=>o.x===q.x&&o.y===q.y&&objSolid(o.kind,o.sub));
   let work=posts[n.local]!;for(let radius=0;radius<4;radius++){let found=false;for(let dy=-radius;dy<=radius&&!found;dy++)for(let dx=-radius;dx<=radius&&!found;dx++){const q={x:work.x+dx,y:work.y+dy};if(free(q)){work=q;found=true;}}if(found)break;}
   t.spots[`${n.id}.work`]=work;
   t.spots[`${n.id}.square`]={x:p.cx+(n.local%4-2)*4,y:p.cy+(n.local<4?-3:3)};
  });
  for(const dx of[-26,26])t.objects.push({x:p.cx+dx,y:p.cy+2,kind:'deco',sub:'street_lamp'});
  t.objects.push({x:t.buildings[0]!.doorX-2,y:t.buildings[0]!.doorY+1,kind:'sign',sub:p.abandoned?'cave_archive':'sign',data:{text:`${p.name}. ${p.culture} ${p.abandoned?'Last survey: the roads were joined before the bells went silent. We sealed the lower vault with iron and two crystals. Bellfall heard the last chime; Stillwater buried its reply. The ward has failed. Beware what still answers the bell.':'These streets are warded. Rest, trade and follow the survey roads to the next cavern.'}`}});
  if(p.abandoned)t.objects.push({x:p.cx+3,y:p.cy+5,kind:'deco',sub:'ruin_cache',data:{ruin:`${p.id}:archive`,biome:'enchanted',cave:true,depth:3,secret:true}});
  else t.objects.push({x:p.cx+3,y:p.cy+5,kind:'deco',sub:'cave_lift',data:{cave:`townlift:${p.id}`}});
  return t;
 });
 if(cache.size>=8)cache.clear();cache.set(seed,towns);return towns;
}
