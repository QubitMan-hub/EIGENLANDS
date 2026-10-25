import { Texture } from 'pixi.js';
import { Iso, mat, STONEM, WOODM, IRONM } from './isokit';
import { C, makeCanvas, polish, undithered } from './shade';
import type { ObjSpriteDef } from './worldobjs';
/** Native 2:1 mine architecture. Ground contact is always (8,8,0). */
export function caveArchitecture(sub:string):ObjSpriteDef {
 const w=80,h=80,ax=40,ay=64,{canvas,ctx}=makeCanvas(w,h);
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
  }else{
   p.box(0,0,0,16,16,3,stone);p.box(3,3,3,10,10,10,stone);
   p.box(1,1,13,14,14,2,stone);p.cyl(8,8,15,3,5,[C.q1,C.q2,C.q3,C.q4,C.pale]);
   for(const u of[4,12])p.line3(u,15,4,u,15,11,C.q3);
  }
  polish(ctx,w,h,{rim:true,ao:{ax,ay,rx:16}});
 });
 const tex=Texture.from(canvas);tex.source.scaleMode='nearest';return{frames:[{tex,ax,ay}],fps:0};
}
