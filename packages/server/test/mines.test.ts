import {afterAll,beforeAll,expect,it} from 'vitest';
import {MSG,caveRegion,mineLoopAt,newPlayerSim,stepPlayer,type MineLoop} from '@eigenlands/shared';
import type {App} from '../src/app';
import {boot,spawn,tp,until,type Probe} from './p2';
let app:App,p:Probe,q:Probe,m:MineLoop;
beforeAll(async()=>{app=await boot();p=await spawn(app,'Miner');q=await spawn(app,'Friend');
 for(let gy=-4;gy<=4&&!m;gy++)for(let gx=-4;gx<=4&&!m;gx++){const r=caveRegion(20260101,gx,gy),loop=mineLoopAt(20260101,r.x,r.y);if(loop)m=loop;}
});
afterAll(async()=>app.close());
it('requires a nearby real depot, syncs the rider to a second client, and safely steps off',async()=>{
 const target={tx:m.x,ty:m.y};p.r.send(MSG.OPEN,target);await new Promise(r=>setTimeout(r,80));expect(p.sp.sim.cart).toBe(0);
 await tp(p,m.x+.5,m.y+1.5);await tp(q,m.x+2.5,m.y+1.5);
 p.r.send(MSG.OPEN,target);await until(()=>p.sp.sim.cart>0);
 await until(()=>q.r.state.players.get(p.sid)?.cart===true);
 expect(p.sp.sim.x).toBe(m.x+.5);expect(p.sp.sim.y).toBe(m.y+.5);
 // The same shared simulation runs on the authoritative server and the predicting browser.
 const cmd={seq:0,dx:1,dy:0,dash:true,attack:true,hold:true,skill:true,aimX:1,aimY:0,viewTick:0};
 stepPlayer(p.sp.sim,cmd,p.room.store.solidAt);expect(p.sp.sim.x).toBeGreaterThan(m.x+.5);expect(p.sp.sim.dashT).toBe(0);
 p.r.send(MSG.OPEN,{tx:Math.floor(p.sp.sim.x),ty:Math.floor(p.sp.sim.y)});await until(()=>p.sp.sim.cart===0);
 await until(()=>q.r.state.players.get(p.sid)?.cart===false);expect(p.room.store.solidAt(Math.floor(p.sp.sim.x),Math.floor(p.sp.sim.y))).toBe(false);
});
it('does not retain a cart after respawning or reconnecting on a dry rail',()=>{
 expect(newPlayerSim(m.x+.5,m.y+.5).cart).toBe(0);
});
