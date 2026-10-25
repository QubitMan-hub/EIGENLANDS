import{afterAll,beforeAll,expect,it}from'vitest';
import{MSG,caveRegion,caveTownAt,caveWaystation,CAVE_TOWNS,caveLanding,shrineOfId,countItem}from'@eigenlands/shared';
import type{App}from'../src/app';
import{boot3,spawn3,tp,setLevel,dev,until,sleep,clearEnemies}from'./p3helpers';
import{CaveModule}from'../src/features/caves';
let app:App;beforeAll(async()=>{app=await boot3();});afterAll(async()=>{await sleep(250);await app?.close();});
function site(seed:number,feature:string){for(let y=-4;y<6;y++)for(let x=-6;x<6;x++){const r=caveRegion(seed,x,y);if(r.feature===feature&&!caveTownAt(r.x,r.y)&&!caveTownAt(r.x+7,r.y-6))return r;}throw Error('No site');}
it('makes generated lifts usable, clears dash on arrival, and guards caches against repeat claims',async()=>{
 const p=await spawn3(app,'Surveyor');const lift=caveWaystation(p.room.seed,0,0)!;await tp(p,lift.x+.5,lift.y+1.5);p.sp.sim.dashT=.15;
 p.r.send(MSG.OPEN,{tx:lift.x,ty:lift.y});const up=caveLanding(p.room.seed,lift.id,false)!;await until(()=>Math.hypot(p.sp.sim.x-up.x,p.sp.sim.y-up.y)<.1);expect(p.sp.sim.dashT).toBe(0);
 const town=CAVE_TOWNS.find(t=>t.abandoned)!;await tp(p,town.cx+3.5,town.cy+6.5);p.r.send(MSG.OPEN,{tx:town.cx+3,ty:town.cy+5});await until(()=>p.sp.data.prog.ruins.includes(`${town.id}:archive`));const n=countItem(p.sp.data.inv,'qubit_crystal');expect(n).toBeGreaterThan(0);p.r.send(MSG.OPEN,{tx:town.cx+3,ty:town.cy+5});await sleep(180);expect(countItem(p.sp.data.inv,'qubit_crystal')).toBe(n);await p.r.leave();
});
it('loads actual cave shrine objects, summons the arena boss only in an arena, and persists its reward',async()=>{
 const p=await spawn3(app,'Bell challenger');await setLevel(p,12);await dev(p,{cmd:'give',id:'deep_sigil',n:2});await until(()=>countItem(p.sp.data.inv,'deep_sigil')===2);
 expect(p.room.summonBoss(p.sp,'deep_sigil',200,200)).toBe(false);expect(countItem(p.sp.data.inv,'deep_sigil')).toBe(2);
 const puzzle=site(p.room.seed,'puzzle'),sh=shrineOfId(p.room.seed,`cs${puzzle.gx}_${puzzle.gy}`)!;await tp(p,sh.x+.5,sh.y+1.5);await p.room.ensureChunk(Math.floor(sh.x/32),Math.floor(sh.y/32));expect(p.room.store.objectAt(sh.x,sh.y)?.sub).toBe('shrine_altar');
 const r=site(p.room.seed,'arena');await tp(p,r.x+7.5,r.y-4.5);clearEnemies(p.room);p.r.send(MSG.OPEN,{tx:r.x+7,ty:r.y-6});await until(()=>[...p.room.enemies.values()].some(e=>e.def.kind===32));expect(countItem(p.sp.data.inv,'deep_sigil')).toBe(1);
 const boss=[...p.room.enemies.values()].find(e=>e.def.kind===32)!;boss.hp=boss.maxHp*.6;p.room.bosses.tick(0,.05);expect([...p.room.enemies.values()].some(e=>e.def.kind===24)).toBe(true);
 p.room.hitEnemy(boss,999999,p.sp,1,0,0);await until(()=>p.sp.data.prog.bosses.includes('bellkeeper'));expect(countItem(p.sp.data.inv,'heart_crystal')).toBeGreaterThan(0);await p.r.leave();
});
it('telegraphs vents before bounded damage, respects dodge invulnerability, and never spawns guardians inside wards',async()=>{
 const p=await spawn3(app,'Vent survey');await setLevel(p,5);const r=site(p.room.seed,'vents');await tp(p,r.x+7.5,r.y-5.5);
 const module=new CaveModule(p.room);let hp=p.sp.hp;module.tick(0,1.5);expect(p.sp.hp).toBe(hp);p.sp.sim.ifrT=1;module.tick(0,1.6);expect(p.sp.hp).toBe(hp);
 p.sp.sim.ifrT=0;module.tick(0,4.1);module.tick(0,1.6);expect(p.sp.hp).toBeLessThan(hp);expect(p.sp.hp).toBeGreaterThan(0);
 clearEnemies(p.room);const t=CAVE_TOWNS.find(t=>!t.abandoned)!;await tp(p,t.cx+.5,t.cy+.5);module.tick(0,100);expect(p.room.enemies.size).toBe(0);await p.r.leave();
});
it('runs cave merchant stock and archive/waymark quests through normal interaction messages',async()=>{
 const p=await spawn3(app,'Cave historian'),views:any[]=[];p.r.onMessage(MSG.SHOP_VIEW,m=>views.push(m));
 const merchant=p.room.village.npc('hollowhearth_1')!;expect(merchant).toBeTruthy();await tp(p,merchant.x+.8,merchant.y);p.r.send(MSG.SHOP,{npcId:'hollowhearth_1',action:'open'});await until(()=>views.length>0);expect(JSON.stringify(views[0])).toContain('rod');
 const near=async(id:string)=>{const n=p.room.village.npc(id)!;await tp(p,n.x+.8,n.y);};
 await near('hollowhearth_4');p.r.send(MSG.QUEST,{npcId:'hollowhearth_4',quest:'cave_hollowhearth_4',action:'accept'});await until(()=>p.sp.data.quests.cave_hollowhearth_4?.state==='active');
 const town=CAVE_TOWNS.find(t=>t.abandoned)!;const records=p.room.store.townObjectsIn(Math.floor((town.cx-4)/32),Math.floor((town.cy+4)/32)).find(o=>o.sub==='cave_archive')!;await tp(p,records.x+.5,records.y+1.5);p.r.send(MSG.OPEN,{tx:records.x,ty:records.y});await until(()=>p.sp.data.quests.cave_hollowhearth_4!.progress[0]===1);
 await near('hollowhearth_4');p.r.send(MSG.QUEST,{npcId:'hollowhearth_4',quest:'cave_hollowhearth_4',action:'turnin'});await until(()=>p.sp.data.quests.cave_hollowhearth_4?.state==='done');
 await near('hollowhearth_6');p.r.send(MSG.QUEST,{npcId:'hollowhearth_6',quest:'cave_hollowhearth_6',action:'accept'});await until(()=>p.sp.data.quests.cave_hollowhearth_6?.state==='active');
 const r=site(p.room.seed,'arena');await tp(p,r.x+.5,r.y+8.5);p.r.send(MSG.OPEN,{tx:r.x,ty:r.y+7});await until(()=>p.sp.data.quests.cave_hollowhearth_6!.progress[0]===1);await p.r.leave();
});
