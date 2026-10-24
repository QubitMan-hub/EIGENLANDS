import { afterAll, beforeAll, expect, it } from 'vitest';
import { MSG34, T } from '@eigenlands/shared';
import type { App } from '../src/app';
import { runtime34 } from '../src/features/runtime34';
import { boot3, clearEnemies, dummy, flatten, setLevel, spawn3, sleep, tp, until, type P3 } from './p3helpers';
let app:App;
beforeAll(async()=>{app=await boot3();});afterAll(async()=>{await sleep(400);await app?.close();});
async function setup(name:string,x:number){const p=await spawn3(app,name);await tp(p,x+.5,600.5);flatten(p.room,x,600,12);clearEnemies(p.room);await setLevel(p,8);p.sp.invuln=0;return p;}
const offer=(p:P3,id:string)=>p.r.send(MSG34.SHADOW_CMD,{act:'befriend',target:id});
const total=(p:P3,id:string)=>p.sp.data.inv.reduce((n,s)=>n+(s?.id===id?s.n:0),0);
function boar(p:P3){return p.room.spawnEnemy('boar',p.sp.sim.x+3,p.sp.sim.y,false);}

it('bonds once with exact split-stack food, preserving kill rewards and living appearance',async()=>{
 const p=await setup('Bond keeper',700);p.sp.data.inv.fill(null);p.sp.data.inv[0]={id:'hazelnut',n:1};p.sp.data.inv[4]={id:'hazelnut',n:3};
 const e=boar(p),coins=p.sp.data.coins,xp=p.sp.xp;
 offer(p,e.id);offer(p,e.id);
 await until(()=>p.room.shadows.stateOf(p.sid)!.data.roster.length===1,2000);
 const rec=p.room.shadows.stateOf(p.sid)!.data.roster[0]!;
 expect(rec).toMatchObject({kind:7,bonded:true,name:'Brambleback'});expect(total(p,'hazelnut')).toBe(1);
 expect(p.room.enemies.has(e.id)).toBe(false);expect(p.room.state.enemies.has(e.id)).toBe(false);
 expect(p.room.state.shadows.get(`sh_${rec.id}`)?.bonded).toBe(true);
 expect(total(p,'raw_meat')+total(p,'hide')+total(p,'boar_tusk')).toBe(0);expect(p.room.shadows.residueCount()).toBe(0);expect(p.sp.data.coins).toBe(coins);expect(p.sp.xp).toBe(xp);
 p.sp.data.inv[4]={id:'hazelnut',n:5};const second=boar(p);offer(p,second.id);await sleep(150);
 expect(total(p,'hazelnut')).toBe(5);expect(p.room.enemies.has(second.id)).toBe(true);
 await p.r.leave();
});

it('rejects unsafe, blocked, injured, angry, remote and insufficient-food offers atomically',async()=>{
 const p=await setup('Patient keeper',740);p.sp.data.inv.fill(null);p.sp.data.inv[0]={id:'hazelnut',n:3};const e=boar(p);
 async function refused(){const nt=p.toasts.length;offer(p,e.id);await until(()=>p.toasts.length>nt,2000);expect(total(p,'hazelnut')).toBe(3);expect(p.room.shadows.stateOf(p.sid)!.data.roster).toHaveLength(0);}
 e.x+=8;await refused();e.x-=8;
 e.hp--;await refused();e.hp=e.maxHp;
 e.provoked=true;await refused();e.provoked=false;
 p.room.store.setTile(742,600,T.ROCK);await refused();p.room.store.setTile(742,600,T.GRASS);
 await setLevel(p,1);await refused();await setLevel(p,8);
 p.sp.data.inv[0]!.n=2;const nt=p.toasts.length;offer(p,e.id);await until(()=>p.toasts.length>nt,2000);expect(total(p,'hazelnut')).toBe(2);
 expect(p.room.enemies.has(e.id)).toBe(true);await p.r.leave();
});

it('allows only one player to claim a wild animal',async()=>{
 const p=await setup('First keeper',780),q=await spawn3(app,'Second keeper');await setLevel(q,8);await tp(q,780.5,601.5);
 for(const r of [p,q]){r.sp.data.inv.fill(null);r.sp.data.inv[0]={id:'hazelnut',n:3};}
 const e=boar(p);offer(p,e.id);offer(q,e.id);await until(()=>!p.room.enemies.has(e.id),2000);await sleep(150);
 expect([p,q].reduce((n,r)=>n+p.room.shadows.stateOf(r.sid)!.data.roster.length,0)).toBe(1);expect(total(p,'hazelnut')+total(q,'hazelnut')).toBe(3);
 await q.r.leave();await p.r.leave();
});

it('badger bites really slow foes and a saved bond follows after reconnect',async()=>{
 const p=await setup('Moss keeper',820);p.sp.data.inv.fill(null);p.sp.data.inv[0]={id:'mushroom',n:2};
 const e=p.room.spawnEnemy('badger',823.5,600.5,false);offer(p,e.id);await until(()=>p.room.shadows.stateOf(p.sid)!.data.roster.length===1,2000);
 const rec=p.room.shadows.stateOf(p.sid)!.data.roster[0]!;const foe=dummy(p.room,823.5,602.5);foe.poise=foe.maxPoise=100000;await until(()=>foe.slowT>0,8000);expect(foe.hp).toBeLessThan(foe.maxHp);
 clearEnemies(p.room);await p.room.shadows.save(p.sp);const saved=await runtime34().repo34.loadShadows(p.accountId) as {roster:Array<{bonded?:boolean}>};expect(saved.roster[0]?.bonded).toBe(true);
 const creds={token:p.token,accountId:p.accountId};await p.r.leave();const q=await spawn3(app,'Moss keeper',creds);
 await until(()=>!!q.room.state.shadows.get(`sh_${rec.id}`),3000);expect(q.room.state.shadows.get(`sh_${rec.id}`)?.bonded).toBe(true);
 const pet=q.room.state.shadows.get(`sh_${rec.id}`)!;await tp(q,828.5,600.5);const before=pet.x;await until(()=>pet.x>before+1,3000);expect(Math.hypot(pet.x-q.sp.sim.x,pet.y-q.sp.sim.y)).toBeLessThan(14);
 await q.r.leave();
});

it('deer gives nearby safe rest, never attacks, and ignores invalid saved bond kinds',async()=>{
 const p=await setup('Haven keeper',860);p.sp.data.inv.fill(null);p.sp.data.inv[0]={id:'blackberry',n:3};
 const e=p.room.spawnEnemy('deer',864.3,600.5,false);offer(p,e.id);await until(()=>p.room.shadows.stateOf(p.sid)!.data.roster.length===1,2000);
 const L=p.room.shadows.stateOf(p.sid)!,u=[...L.units.values()][0]!;p.sp.hp=20;u.en.x=p.sp.sim.x+2;u.en.y=p.sp.sim.y;
 p.room.shadows.tick(0,12);expect(p.sp.hp).toBe(22);
 const foe=dummy(p.room,p.sp.sim.x+4,p.sp.sim.y),hp=foe.hp;foe.poise=foe.maxPoise=100000;p.room.shadows.tick(0,12);expect(p.sp.hp).toBe(22);expect(foe.hp).toBe(hp);expect(u.en.targetId).toBeNull();
 clearEnemies(p.room);u.en.x=p.sp.sim.x+12;p.room.shadows.tick(0,12);expect(p.sp.hp).toBe(22);
 await p.room.shadows.save(p.sp);const raw=await runtime34().repo34.loadShadows(p.accountId) as {roster:unknown[]};raw.roster.push({id:'bad',kind:0,bonded:true,level:1},{id:'unbound',kind:3,level:1});await p.r.leave();await runtime34().repo34.saveShadows(p.accountId,raw);
 const q=await spawn3(app,'Haven keeper',{token:p.token,accountId:p.accountId});const roster=q.room.shadows.stateOf(q.sid)!.data.roster;expect(roster).toHaveLength(1);expect(roster[0]?.bonded).toBe(true);await q.r.leave();
});

it('boar earthshove hits once per charge and can hit the same foe on its next charge',async()=>{
 const p=await setup('Bramble keeper',900);p.sp.data.inv.fill(null);p.sp.data.inv[0]={id:'hazelnut',n:3};const e=boar(p);offer(p,e.id);
 await until(()=>p.room.shadows.stateOf(p.sid)!.units.size===1,2000);clearEnemies(p.room);
 const u=[...p.room.shadows.stateOf(p.sid)!.units.values()][0]!,foe=dummy(p.room,p.sp.sim.x+3,p.sp.sim.y);foe.resist=1;foe.poise=foe.maxPoise=100000;foe.hp=foe.maxHp=1000;
 const charge=()=>{u.en.x=p.sp.sim.x+2;u.en.y=p.sp.sim.y;u.en.mode='charge';u.en.t=1;u.en.aimX=1;u.en.aimY=0;foe.x=p.sp.sim.x+3;foe.y=p.sp.sim.y;foe.kx=foe.ky=0;p.room.shadows.tick(0,.05);};
 charge();const hp=foe.hp;expect(foe.kx).toBeCloseTo(11);p.room.shadows.tick(0,.01);expect(foe.hp).toBe(hp);
 u.en.mode='idle';u.en.cd=2;p.room.shadows.tick(0,.05);charge();expect(foe.hp).toBeLessThan(hp);expect(foe.kx).toBeCloseTo(11);await p.r.leave();
});

it('refuses taming when active slots or the permanent roster are full',async()=>{
 const p=await setup('Careful keeper',940);await setLevel(p,5);p.sp.data.inv.fill(null);p.sp.data.inv[0]={id:'hazelnut',n:3};p.sp.data.inv[1]={id:'mushroom',n:2};const e=boar(p);offer(p,e.id);
 await until(()=>p.room.shadows.stateOf(p.sid)!.units.size===1,2000);const badger=p.room.spawnEnemy('badger',943.5,600.5,false);
 let nt=p.toasts.length;offer(p,badger.id);await until(()=>p.toasts.length>nt,2000);expect(total(p,'mushroom')).toBe(2);
 p.r.send(MSG34.SHADOW_CMD,{act:'dismiss_all'});await until(()=>p.room.shadows.stateOf(p.sid)!.units.size===0,2000);
 const L=p.room.shadows.stateOf(p.sid)!;while(L.data.roster.length<16)L.data.roster.push({id:`extra${L.data.roster.length}`,kind:0,name:'Echo',level:1,xp:0});
 nt=p.toasts.length;offer(p,badger.id);await until(()=>p.toasts.length>nt,2000);expect(total(p,'mushroom')).toBe(2);expect(p.room.enemies.has(badger.id)).toBe(true);await p.r.leave();
});
