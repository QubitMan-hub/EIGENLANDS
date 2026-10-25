import { caveRegionAt, caveTownAt, isCaveY, isDiveY, hasIframes, sanctuaryAt, CAVE_TOWNS } from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { Module, Registrar } from '../types';
/** Local discoveries only: bounded encounter state and no world-wide scan or per-frame particles. */
export class CaveModule implements Module {
 private time=0;
 private pulse=0;
 private sites=new Map<string,{next:number;enemy?:string;warn?:number;x:number;y:number}>();
 constructor(private room:GameRoom){}
 install(_reg:Registrar):void{}
 tick(_now:number,dt:number):void{
  this.time+=dt;this.pulse-=dt;if(this.pulse>0)return;this.pulse=.25;
  const nearby=new Set<string>();
  for(const p of this.room.players.values()){
   if(p.deadT>0||!isCaveY(p.sim.y)||isDiveY(p.sim.y))continue;
   const r=caveRegionAt(this.room.seed,p.sim.x,p.sim.y);
   const town=CAVE_TOWNS.find(t=>t.abandoned&&Math.hypot(t.cx-p.sim.x,t.cy-p.sim.y)<25);
   const id=town?town.id:r.id,x=town?town.cx:r.x+7,y=town?town.cy+7:r.y-6;
   if(!this.room.owns(x,y)||sanctuaryAt(this.room.seed,x,y)||(!town&&caveTownAt(x,y)))continue;
   if(!town&&!['vents','ruins','grove'].includes(r.feature)||Math.hypot(p.sim.x-x,p.sim.y-y)>20)continue;
   nearby.add(id);let site=this.sites.get(id);
   if(!site){site={x,y,next:this.time+1};this.sites.set(id,site);}
   if(!town&&r.feature==='vents'){
    if(site.warn!==undefined&&this.time>=site.warn){
     for(const q of this.room.players.values())if(q.deadT<=0&&!hasIframes(q.sim)&&Math.hypot(q.sim.x-x,q.sim.y-y)<1.8){q.hp=Math.max(1,q.hp-Math.max(3,Math.round(q.maxHp*.08)));this.room.fx({kind:'hurt',id:q.id,x:q.sim.x,y:q.sim.y});q.toast('Steam vent! Leave the marked grate before it erupts.','bad');}
     site.warn=undefined;site.next=this.time+4;
    }else if(site.warn===undefined&&this.time>=site.next){site.warn=this.time+1.5;this.room.fx({kind:'bomb',x,y,v:1.5,w:1.8,id:`vent:${id}`});}
   }else if(p.level>=4&&this.time>=site.next&&(!site.enemy||!this.room.enemies.has(site.enemy))&&!this.room.store.solidAt(x,y)){
    // Approach announces an encounter; warded settlements never receive guardians.
    const e=this.room.spawnEnemy(r.feature==='grove'&&!town?'spore_matriarch':'vault_guardian',x+.5,y+.5,false,{level:Math.max(4,Math.min(12,p.level))});
    site.enemy=e.id;site.next=this.time+600;p.toast(`${e.def.name} guards this place. Its long windup leaves an opening.`);
   }
  }
  // Keep cooldowns while the server lives; cap long expeditions without growing forever.
  if(this.sites.size>256)for(const[id,s]of this.sites)if(!nearby.has(id)&&this.time>=s.next){this.sites.delete(id);if(this.sites.size<=192)break;}
 }
}
