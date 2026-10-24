import {expect,it,vi} from 'vitest';
import {ChunkStore,T} from '@eigenlands/shared';
import {ClickMining} from '../src/game/click-mining';
function setup(){
 const store=new ChunkStore(341);for(let y=-4;y<8;y++)for(let x=-4;x<9;x++)store.setTile(x,y,T.GRASS);store.setTile(4,0,T.ROCK);
 let selected={slot:1,item:{id:'pickaxe',n:1} as {id:string;n:number;p?:{tier:number}}|null};const use=vi.fn(),notice=vi.fn();
 const mining=new ClickMining(()=>store,()=>selected,use,notice);return{store,mining,use,notice,select:(s:typeof selected)=>selected=s};
}
it('walks around obstacles then repeats authoritative tool use on just the clicked rock',()=>{
 const{store,mining,use}=setup();store.setTile(2,0,T.ROCK);store.setTile(2,1,T.ROCK);
 expect(mining.start(0.5,0.5,4,0,0)).toBe(true);let x=.5,y=.5;
 for(let now=0;now<6000;now+=50){const r=mining.step(now,x,y);if(r){x+=r.dx*.18;y+=r.dy*.18;}expect(store.solidAt(Math.floor(x),Math.floor(y))).toBe(false);}
 expect(use.mock.calls.length).toBeGreaterThan(2);expect(use.mock.calls.every(([slot,tx,ty])=>slot===1&&tx===4&&ty===0)).toBe(true);expect(Math.hypot(x-4.5,y-.5)).toBeLessThan(1.7);
 store.setTile(4,0,T.GRASS);expect(mining.step(6100,x,y)).toBeNull();const n=use.mock.calls.length;mining.step(6500,x,y);expect(use).toHaveBeenCalledTimes(n);
});
it('cancels on manual intent, tool changes and unreachable targets without sending use',()=>{
 const{store,mining,use,select}=setup();mining.start(.5,.5,4,0,0);mining.cancel();expect(mining.step(50,.5,.5)).toBeNull();
 mining.start(.5,.5,4,0,0);select({slot:2,item:{id:'axe',n:1}});expect(mining.step(50,.5,.5)).toBeNull();expect(use).not.toHaveBeenCalled();
 select({slot:1,item:{id:'pickaxe',n:1}});for(let y=-1;y<=1;y++)for(let x=3;x<=5;x++)if(x!==4||y!==0)store.setTile(x,y,T.ROCK);
 mining.start(.5,.5,4,0,0);expect(mining.step(50,.5,.5)).toBeNull();expect(use).not.toHaveBeenCalled();
});
it('rejects wrong tools and insufficient tiers and stops rather than walking forever when stuck',()=>{
 const{store,mining,use,notice,select}=setup();select({slot:0,item:{id:'axe',n:1}});expect(mining.start(.5,.5,4,0,0)).toBe(false);
 select({slot:1,item:{id:'pickaxe',n:1}});store.setTile(4,0,T.ORE_GOLD);expect(mining.start(.5,.5,4,0,0)).toBe(true);expect(mining.step(50,.5,.5)).toBeNull();expect(notice).toHaveBeenCalled();
 store.setTile(4,0,T.ROCK);mining.start(.5,.5,4,0,0);mining.step(50,.5,.5);expect(mining.step(2000,.5,.5)).toBeNull();expect(use).not.toHaveBeenCalled();
});
