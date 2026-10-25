import { afterAll, beforeAll, expect, it } from 'vitest';
import { matchMaker } from 'colyseus';
import { T, townFor, townsFor, sanctuaryAt, biomeAt, isNight } from '@eigenlands/shared';
import type { WorldRoom } from '../src/rooms/WorldRoom';
import type { App } from '../src/app';
import { guest, join, lastRoomId, me, resetDb, startApp, until } from './helpers';
let app:App,r:any,w:WorldRoom,p:any;
beforeAll(async()=>{await resetDb();app=await startApp();r=await join(app,(await guest(app)).token,'Ward tester');r.onMessage('*',()=>{});await until(()=>!!me(r));w=matchMaker.getLocalRoomById(lastRoomId()) as unknown as WorldRoom;p=w.players.get(r.sessionId)!;});
afterAll(async()=>{await r.leave();await app?.close();});
it('protects towns from melee/projectile damage, prevents fighting out, and removes intruders without rewards',async()=>{
 const t=townFor(w.seed);p.sim.x=t.x1+2.5;p.sim.y=t.cy+.5;p.invuln=0;
 const enemy=w.spawnEnemy('wisp',t.x1+6.5,t.cy+.5,false);const hp=p.hp,xp=p.xp,coins=p.data.coins;
 // Both delayed strikes and projectile collisions finish through this authoritative damage gate.
 expect((w as any).hurtPlayer(p,1000,enemy,2,1,0)).toBe(false);expect(p.hp).toBe(hp);
 for(let cx=Math.floor(t.x1/32);cx<=Math.floor((t.x1+10)/32);cx++)await w.ensureChunk(cx,Math.floor(t.cy/32));
 for(let x=t.x1;x<t.x1+10;x++)w.store.setTile(x,t.cy,T.GRASS);
 w.fireOrbs(enemy,-1,0);await until(()=>w.state.projectiles.size===0);expect(p.hp).toBe(hp);
 (w as any).damageEnemy(enemy,1000,p,1,0,0);expect(enemy.hp).toBe(enemy.maxHp);
 const intruder=w.spawnEnemy('slime',p.sim.x+1,p.sim.y,false);
 await until(()=>!w.enemies.has(intruder.id));expect(p.xp).toBe(xp);expect(p.data.coins).toBe(coins);expect(p.hp).toBe(hp);
 w.enemies.clear();w.state.enemies.clear();
});
it('keeps wilderness damage and guarded boss restrictions real',async()=>{
 p.sim.x=250.5;p.sim.y=250.5;p.invuln=0;expect(sanctuaryAt(w.seed,p.sim.x,p.sim.y)).toBeNull();
 await w.ensureChunk(7,7);for(let y=245;y<256;y++)for(let x=245;x<256;x++)w.store.setTile(x,y,T.GRASS);
 const oldLevel=p.level;p.level=10;
 for(const t of townsFor(w.seed).filter(t=>!t.abandoned))expect((w as any).summonBoss(p,'slime_crown',t.cx,t.cy)).toBe(false);
 p.level=oldLevel;
 const e=w.spawnEnemy('slime',252,250,false),hp=p.hp;
 expect((w as any).hurtPlayer(p,5,e,1,1,0)).toBe(true);expect(p.hp).toBeLessThan(hp);w.enemies.clear();w.state.enemies.clear();
});
it('waits before spawning and between encounters, uses strict local budgets and excludes every player',async()=>{
 p.sim.x=250.5;p.sim.y=250.5;p.level=1;
 for(let cy=6;cy<=9;cy++)for(let cx=6;cx<=9;cx++)await w.ensureChunk(cx,cy);
 for(let y=210;y<290;y++)for(let x=210;x<290;x++)w.store.setTile(x,y,T.GRASS);
 const old=w.rand;w.rand=()=>.5;
 try{
  const spawn=(now:number)=>(w as any).ambientSpawn(now);
  spawn(0);spawn(7999);expect(w.enemies.size).toBe(0);
  const r2=await join(app,(await guest(app)).token,'Neighbour');r2.onMessage('*',()=>{});await until(()=>!!me(r2));
  const neighbour=w.players.get(r2.sessionId)!;neighbour.sim.x=222.5;neighbour.sim.y=250.5;
  spawn(8001);expect(w.enemies.size).toBe(0);await r2.leave();await until(()=>!w.players.has(r2.sessionId));
  spawn(13002);expect(w.enemies.size).toBe(1);
  for(let now=13003;now<20000;now+=1000)spawn(now);expect(w.enemies.size).toBe(1);
  for(const e of w.enemies.values()){expect(Math.hypot(e.x-p.sim.x,e.y-p.sim.y)).toBeGreaterThanOrEqual(14);expect(sanctuaryAt(w.seed,e.x,e.y)).toBeNull();}
  for(let now=40000;now<200000;now+=1000)spawn(now);expect(w.enemies.size).toBeLessThanOrEqual(3);
 }finally{w.rand=old;}
});

it('keeps modest nocturnal wildlife outside wards, with visible placement and strict local/global caps',async()=>{
 w.enemies.clear();w.state.enemies.clear();
 let spot:{x:number;y:number}|undefined;
 for(let y=400;y<1000&&!spot;y+=32)for(let x=400;x<1000&&!spot;x+=32){
  if(biomeAt(w.seed,x,y)==='meadow' && !sanctuaryAt(w.seed,x,y) && [[-18,0],[18,0],[0,18],[0,-18]].every(([dx,dy])=>!['corrupted','desert'].includes(biomeAt(w.seed,x+dx!,y+dy!))))spot={x,y};
 }
 expect(spot).toBeDefined();const {x,y}=spot!;p.sim.x=x+.5;p.sim.y=y+.5;
 for(let cy=Math.floor((y-24)/32);cy<=Math.floor((y+24)/32);cy++)for(let cx=Math.floor((x-24)/32);cx<=Math.floor((x+24)/32);cx++)await w.ensureChunk(cx,cy);
 for(let yy=y-24;yy<=y+24;yy++)for(let xx=x-24;xx<=x+24;xx++)w.store.setTile(xx,yy,T.GRASS);
 const old=w.rand;let seq=0;w.rand=()=>((++seq*.61803398875)%1);
 const night=Array.from({length:24},(_,h)=>h*60000).find(isNight)!,day=Array.from({length:24},(_,h)=>h*60000).find(t=>!isNight(t))!;
 const fauna=(now:number)=>(w as any).ambientFauna(now);
 try{
  for(let i=0;i<30;i++)fauna(night);
  expect(w.enemies.size).toBeGreaterThan(0);expect(w.enemies.size).toBeLessThanOrEqual(3);
  expect([...w.enemies.values()].some(e=>e.def.kind===9 || e.def.kind===7)).toBe(true);
  for(const e of w.enemies.values()){const d=Math.hypot(e.x-p.sim.x,e.y-p.sim.y);expect(d).toBeGreaterThanOrEqual(8);expect(d).toBeLessThan(20);expect(sanctuaryAt(w.seed,e.x,e.y)).toBeNull();}
  for(let i=0;i<40;i++)fauna(day);expect(w.enemies.size).toBeGreaterThanOrEqual(4);expect(w.enemies.size).toBeLessThanOrEqual(5);
  // One global place left: never exceed it, including a multi-animal herd.
  w.enemies.clear();w.state.enemies.clear();for(let i=0;i<23;i++)w.spawnEnemy('rabbit',x+100+i,y+100,false);
  for(let i=0;i<30;i++)fauna(day);expect(w.enemies.size).toBe(24);
 }finally{w.rand=old;w.enemies.clear();w.state.enemies.clear();}
});
