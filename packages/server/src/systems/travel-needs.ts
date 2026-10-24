import {biomeAt,sanctuaryAt,stepTravelNeeds} from '@eigenlands/shared';
import type {ServerPlayer} from '../rooms/player';
import type {RoomApi} from './api';
export function setTravelMode(p:ServerPlayer,msg:{mode?:unknown}|null):void {
 if(p.deadT>0||!msg||(msg.mode!=='cozy'&&msg.mode!=='adventure'))return;
 p.data.needs.mode=msg.mode;p.travelDamageT=0;p.dirty('needs');
}
/** Once per real online second; world-clock shifts and reconnects never simulate missed meals. */
export function tickTravelNeeds(room:RoomApi,p:ServerPlayer):void {
 const before=p.data.needs,paused=p.deadT>0||!!sanctuaryAt(room.seed,p.sim.x,p.sim.y);
 const next=stepTravelNeeds(before,1,{paused,exerted:p.travelExerted,desert:biomeAt(room.seed,p.sim.x,p.sim.y)==='desert'});
 p.travelExerted=false;p.data.needs=next;
 if(Math.floor(before.food)!==Math.floor(next.food)||Math.floor(before.water)!==Math.floor(next.water))p.dirty('needs');
 if(before.food>20&&next.food<=20||before.water>20&&next.water<=20)p.toast('Travel supplies are low. Eat food or drink a filled waterskin; see Journal → How to…','info');
 if(!paused&&next.mode==='adventure'&&(next.food===0||next.water===0)) {
  if(++p.travelDamageT>=10){p.travelDamageT=0;if(p.hp>1)p.hp=Math.max(1,p.hp-1);}
 }else p.travelDamageT=0;
}
