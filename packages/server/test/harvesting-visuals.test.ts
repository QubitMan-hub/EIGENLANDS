import {afterAll,beforeAll,expect,it} from 'vitest';
import {MSG,T,type FxMsg} from '@eigenlands/shared';
import type {App} from '../src/app';
import {boot3,spawn3,tp,until,sleep} from './p3helpers';
let app:App;beforeAll(async()=>{app=await boot3();});afterAll(async()=>{await sleep(300);await app?.close();});
it('identifies the actual successful harvesting tool and actor, while rejected tools emit no swing',async()=>{
 const p=await spawn3(app,'Woodworker');await tp(p,700.5,700.5);p.sp.data.inv[0]={id:'axe',n:1};p.sp.data.inv[1]={id:'pickaxe',n:1};
 const fx:FxMsg[]=[];p.r.onMessage(MSG.FX,(f:FxMsg)=>fx.push(f));
 for(const [tile,slot,kind,weapon] of [[T.TREE,0,'chop','axe'],[T.ROCK,1,'mine','pickaxe']] as const){
  p.room.setTile(701,700,tile);p.sp.toolReadyAt=0;p.r.send(MSG.USE,{slot,tx:701,ty:700});
  await until(()=>fx.some(f=>f.kind===kind&&f.id===p.sp.id&&f.weapon===weapon),2000);
 }
 fx.length=0;p.room.setTile(701,700,T.TREE);p.sp.toolReadyAt=0;p.r.send(MSG.USE,{slot:1,tx:701,ty:700});await sleep(150);
 expect(fx.some(f=>f.kind==='chop'||f.kind==='mine')).toBe(false);await p.r.leave();
});
