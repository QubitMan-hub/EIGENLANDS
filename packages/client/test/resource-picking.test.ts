import{expect,it,vi}from'vitest';
import{T}from'@eigenlands/shared';
import{ObjectViews}from'../src/game/objectviews';
it('clicks opaque visible rock pixels in draw order, ignoring transparent overlapping margins and reusing masks',()=>{
 const pixels=(alpha:number[])=>{const data=new Uint8ClampedArray(16);alpha.forEach((a,i)=>data[i*4+3]=a);const read=vi.fn(()=>({data}));return{tex:{orig:{width:2,height:2},frame:{x:0,y:0},source:{resource:{width:2,height:2,getContext:()=>({getImageData:read})}}},read};};
 const back=pixels([255,255,255,255]),front=pixels([0,255,0,0]);
 const obj=(tx:number,zIndex:number,tex:unknown)=>({tx,ty:0,root:{visible:true,zIndex,texture:tex,anchor:{x:0,y:0},getBounds:()=>({minX:0,minY:0,maxX:2,maxY:2}),toLocal:(p:unknown)=>p}});
 const views=Object.assign(Object.create(ObjectViews.prototype),{store:{getTile:()=>T.ROCK},chunks:new Map([['0,0',new Map([[1,obj(1,1,back.tex)],[2,obj(2,2,front.tex)]])]]),hitPixels:new WeakMap()}) as ObjectViews;
 expect(views.pickMineable(.5,.5)).toEqual({tx:1,ty:0});expect(views.pickMineable(1.5,.5)).toEqual({tx:2,ty:0});expect(views.pickMineable(3,3)).toBeNull();
 expect(back.read).toHaveBeenCalledTimes(1);expect(front.read).toHaveBeenCalledTimes(1);
});
