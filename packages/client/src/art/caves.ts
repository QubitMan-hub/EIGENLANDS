import { Texture } from 'pixi.js';
import { Iso, mat, STONEM, WOODM, IRONM } from './isokit';
import { C, makeCanvas, polish, undithered } from './shade';
import type { ObjSpriteDef } from './worldobjs';
/** Native 2:1 mine architecture. Ground contact is always (8,8,0). */
export function caveArchitecture(sub:string):ObjSpriteDef {
 const animated=['glow_mushrooms','cave_waterfall','magma_fall'].includes(sub);
 return{frames:Array.from({length:animated?4:1},(_,f)=>caveFrame(sub,f)),fps:animated?(sub==='glow_mushrooms'?4:2):0,noShadow:['cave_seal','cave_waterfall','magma_fall'].includes(sub)};
}
function caveFrame(sub:string,f:number){
 const w=sub==='cave_seal'?320:80,h=sub==='cave_seal'?208:80,ax=w/2,ay=sub==='cave_seal'?h/2:64,{canvas,ctx}=makeCanvas(w,h);
 undithered(()=>{
  const p=new Iso(ctx,ax,ay-8),stone=mat(STONEM,{noise:.12}),wood=mat(WOODM,{grain:8}),iron=mat(IRONM);
  if(sub==='cave_mouth'){
   p.box(-6,-7,0,30,23,3,stone);
   // Stepped rock overhang, with the opening cut into the +v wall.
   p.box(-6,-7,3,7,22,21,stone);p.box(17,-7,3,7,22,21,stone);
   p.box(0,-7,23,18,18,6,stone);p.box(2,-5,29,14,13,4,stone);
   p.left(1,12,3,16,20,C.ink);p.right(17,-2,3,14,20,C.night);
   p.box(1,11,3,2,6,20,wood);p.box(15,11,3,2,6,20,wood);p.box(-1,10,23,20,7,3,wood);
   p.top(3,12,3.1,12,8,C.e2);
   for(const u of[5,13])p.line3(u,20,3.5,u,9,3.5,C.steel);
   for(let v=13;v<=21;v+=3)p.line3(4,v,3.3,14,v,3.3,C.e4);
   p.box(19,13,8,3,3,1,iron);p.box(19.5,13.5,9,2,2,4,{top:C.e7,left:C.e6,right:C.e4});
  }else if(sub==='cave_ladder'||sub==='cave_lift'){
   p.box(-2,-2,0,20,20,2,stone);p.top(1,1,2.1,14,14,C.ink);
   p.box(-1,-1,2,2,2,39,wood);p.box(16,-1,2,2,2,39,wood);p.box(-2,-2,40,22,4,3,wood);
   for(const u of[4,12])p.box(u,3,2,1.5,1.5,33,wood);
   for(let z=5;z<35;z+=5)p.box(4,3,z,9.5,2,1.5,wood);
   p.cyl(19,3,14,3,10,IRONM);p.line3(19,3,24,19,3,42,C.steel);
   p.box(14,15,2,5,4,6,wood);p.box(-1,11,3,2,3,4,{top:C.e7,left:C.e6,right:C.e4});
  }else if(sub==='cave_vent'){
   p.box(0,0,0,16,16,2,stone);p.top(3,3,2.1,10,10,C.ink);
   for(let i=0;i<4;i++)p.box(4+i*2,4,2,1,8,1,{top:C.r4,left:C.r2,right:C.r1});
  }else if(sub==='sea_arch'){
   const coral=mat([C.w0,C.w1,C.w2,C.w3,C.w5]),shell=mat([C.slate,C.steel,C.mist,C.pale]);
   for(const u of[-5,19]){p.box(u,2,0,5,10,4,shell);p.box(u+1,4,4,3,6,27,coral);p.box(u,2,30,5,10,3,shell);}
   for(let i=0;i<7;i++){const u=-2+i*3,z=32+Math.sqrt(Math.max(0,1-((i-3)/3.5)**2))*10;p.box(u,4,z,3.5,6,4,shell);}
   p.cyl(8,7,40,2,6,[C.w2,C.w3,C.w5,C.w7,C.pale]);
  }else if(sub==='glow_mushrooms'){
   const stem=mat([C.w0,C.w1,C.w3,C.w5,C.pale]),cap=[C.w0,C.w2,C.w4,C.w5,C.w7];
   for(const[u,v,z,r]of[[6,5,23,5],[13,9,12,3.5],[3,12,8,2.8]]){
    p.cyl(u!,v!,0,1.2,z!,[C.w0,C.w2,C.w4,C.w6,C.pale]);
    p.cyl(u!,v!,z!-2,r!,3,cap);p.cyl(u!,v!,z!+.4,r!*.75,1,cap);
    for(let i=0;i<6;i++){const a=i*2.4;p.dot(u!+Math.cos(a)*r!*.65,v!+Math.sin(a)*r!*.65,z!+1.8,(i+f)%4===0?C.white:C.w6);}
    p.box(u!-2,v!-2,0,4,4,1,stem);
   }
  }else if(sub==='cave_waterfall'||sub==='magma_fall'){
   const lava=sub==='magma_fall';
   // A narrow stream attached to the +v face of the rear rock tile. The wall crown is 13px
   // above dry ground, the pool 7px below; there is no freestanding source column.
   p.left(5,0,0,6,20,(s,t)=>{const stripe=Math.floor(s*6),glint=Math.floor(t*20+f)%13===0;return lava?(stripe%3===0?C.r1:glint?C.r5:C.r3):(stripe%3===0?C.w2:glint?C.w5:C.w3);});
   for(let i=0;i<3;i++)p.top(5+i*2,1+(i%2),.1,1.5,2,lava?C.r3:C.w4);
  }else if(sub==='cave_seal'){
   // Ground-level ritual seal: concentric inlaid rings stay behind combatants.
   p.top(-92,-92,.05,200,200,(_s,_t,x,y)=>{
    const dx=(x-ax),dy=(y-(ay-8))*2-16,d=Math.hypot(dx,dy);
    if(d>143)return -1;const ring=Math.abs(d-136)<2||Math.abs(d-96)<1.7;
    return ring?C.e4:Math.abs(dx)%17<1||Math.abs(dy)%17<1?C.slate:C.steel;
   });
   for(let i=0;i<12;i++){const a=i*Math.PI/6,u=8+Math.cos(a)*96,v=8+Math.sin(a)*96;p.line3(u-1,v,.2,u+1,v,.2,C.q3);p.line3(u,v-1,.2,u,v+1,.2,C.q2);}
  }else if(sub==='bell_pylon'){
   p.box(0,0,0,16,16,4,stone);p.box(4,4,4,8,8,23,stone);
   p.box(2,2,27,12,12,3,iron);p.box(1,2,30,2,10,15,iron);p.box(13,2,30,2,10,15,iron);p.box(1,2,44,14,10,2,iron);
   p.cyl(8,7,32,3.5,7,[C.e0,C.e1,C.e3,C.e4,C.e5]);p.cyl(8,7,31,4,2,WOODM);p.line3(8,7,40,8,7,44,C.steel);
   p.left(6,12,8,4,10,(_s,t)=>Math.floor(t*8)%3===0?C.q4:C.slate);
  }else{
   p.box(0,0,0,16,16,3,stone);p.box(3,3,3,10,10,10,stone);
   p.box(1,1,13,14,14,2,stone);p.cyl(8,8,15,3,5,[C.q1,C.q2,C.q3,C.q4,C.pale]);
   for(const u of[4,12])p.line3(u,15,4,u,15,11,C.q3);
  }
  polish(ctx,w,h,{rim:true,ao:{ax,ay,rx:16}});
 });
 const tex=Texture.from(canvas);tex.source.scaleMode='nearest';return{tex,ax,ay};
}
