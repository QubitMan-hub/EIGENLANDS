import {afterAll,beforeAll,expect,it} from 'vitest';
import {matchMaker} from 'colyseus';
import {MSG,townFor} from '@eigenlands/shared';
import {guest,join,lastRoomId,me,resetDb,startApp,until,sleep} from './helpers';
import {loadPlayerData,newPlayerData,serializePlayerData} from '../src/systems/profile';
import {tickTravelNeeds} from '../src/systems/travel-needs';
let app:any,r:any,w:any,p:any,token:string;
beforeAll(async()=>{await resetDb();app=await startApp();token=(await guest(app)).token;r=await join(app,token,'Traveller');r.onMessage('*',()=>{});await until(()=>!!me(r));w=matchMaker.getLocalRoomById(lastRoomId());p=w.players.get(r.sessionId);});
afterAll(async()=>{await r.leave();await app?.close();});
it('defaults to Cozy, validates mode-only requests and pauses towns/death while wilderness exhaustion stays nonlethal',async()=>{
 expect(p.data.needs).toEqual({mode:'cozy',food:100,water:100});const safe=townFor(w.seed);p.sim.x=safe.cx;p.sim.y=safe.cy;r.send(MSG.TRAVEL_MODE,{mode:'bogus',food:0});await sleep(100);expect(p.data.needs.mode).toBe('cozy');
 r.send(MSG.TRAVEL_MODE,{mode:'adventure',food:1,water:1});await until(()=>p.data.needs.mode==='adventure');expect(p.data.needs.food).toBe(100);
 const town=townFor(w.seed);p.sim.x=town.cx;p.sim.y=town.cy;p.data.needs.food=10;p.data.needs.water=10;tickTravelNeeds(w,p);expect(p.data.needs.food).toBe(10);
 p.sim.x=250;p.sim.y=250;p.deadT=1;tickTravelNeeds(w,p);expect(p.data.needs.food).toBe(10);p.deadT=0;
 tickTravelNeeds(w,p);expect(p.data.needs.food).toBeLessThan(10);p.data.needs.food=0;p.data.needs.water=0;p.hp=2;for(let i=0;i<25;i++)tickTravelNeeds(w,p);expect(p.hp).toBe(1);expect(p.deadT).toBe(0);
});
it('eats food at full health, never wastes full supplies, and refills the same skin only at a reachable real well',async()=>{
 const town=townFor(w.seed),well=town.objects.find((o:any)=>o.sub==='well')!;p.sim.x=well.x+.5;p.sim.y=well.y+1.5;await w.ensureChunk(Math.floor(well.x/32),Math.floor(well.y/32));
 p.hp=p.maxHp;p.data.needs.food=50;p.data.inv[10]={id:'roast_potato',n:2};r.send(MSG.USE,{slot:10,tx:well.x,ty:well.y});await until(()=>p.data.inv[10]?.n===1);expect(p.data.needs.food).toBe(75);
 p.data.inv[11]={id:'waterskin_empty',n:1};p.toolReadyAt=0;r.send(MSG.USE,{slot:11,tx:well.x+20,ty:well.y});await sleep(120);expect(p.data.inv[11].id).toBe('waterskin_empty');
 p.toolReadyAt=0;r.send(MSG.USE,{slot:11,tx:well.x,ty:well.y});await until(()=>p.data.inv[11].id==='waterskin_full');
 p.data.needs.water=50;p.toolReadyAt=0;r.send(MSG.USE,{slot:11,tx:0,ty:0});await until(()=>p.data.inv[11].id==='waterskin_empty');expect(p.data.needs.water).toBe(85);
 p.data.inv[11]={id:'waterskin_full',n:1};p.data.needs.water=100;p.toolReadyAt=0;r.send(MSG.USE,{slot:11,tx:0,ty:0});await sleep(100);expect(p.data.inv[11].id).toBe('waterskin_full');
 p.data.needs.food=100;p.toolReadyAt=0;r.send(MSG.USE,{slot:10,tx:0,ty:0});await sleep(100);expect(p.data.inv[10].n).toBe(1);
});
it('persists fractional needs and mode across a real disconnect/rejoin without offline catch-up or mode refill',async()=>{
 p.data.needs={mode:'adventure',food:42.5,water:67.25};const town=townFor(w.seed);p.sim.x=town.cx;p.sim.y=town.cy;
 await r.leave();await until(()=>w.players.size===0);r=await join(app,token,'Traveller');r.onMessage('*',()=>{});await until(()=>!!me(r));w=matchMaker.getLocalRoomById(lastRoomId());p=w.players.get(r.sessionId);
 expect(p.data.needs).toEqual({mode:'adventure',food:42.5,water:67.25});r.send(MSG.TRAVEL_MODE,{mode:'cozy'});await until(()=>p.data.needs.mode==='cozy');expect(p.data.needs.food).toBe(42.5);
});

it('loads an old character without needs as Cozy, keeping inventory/coins and granting the new starter recipe',()=>{
 const old=serializePlayerData(newPlayerData(0));delete old.needs;old.coins=123;
 const data=loadPlayerData(old,0,Date.now());expect(data.needs).toEqual({mode:'cozy',food:100,water:100});expect(data.coins).toBe(123);expect(data.inv).toEqual(old.inv);expect(data.recipes.has('waterskin')).toBe(true);
});
