import { expect, it } from 'vitest';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CombatView, type CombatActor, type CombatDeps, type CombatSnap } from '../src/game/combatview';
it('keeps living bonds in their natural palette while echoes retain violet silhouettes',()=>{
 const view=new CombatView({foes:()=>({}),reduced:()=>true,critters:()=>({anchor:()=>({x:.5,y:.9}),has:()=>true,fps:()=>5,length:()=>7,frame:()=>Texture.EMPTY})} as unknown as CombatDeps,new Graphics());
 const actor={id:'pet',type:'shadow',root:new Container(),sprite:new Sprite(),fl:new Sprite(),gfx:new Graphics(),travel:0,outfit:0,kind:7,flash:0,punch:0,ghostT:0} as CombatActor;
 const snap={hp:40,maxHp:40,kind:7,night:false,st:0,atk:0,tele:0,faceX:1,faceY:0,rank:0,bonded:true} as unknown as CombatSnap;
 view.drawEnemy(actor,snap,0,0,1,1000,.05,false);expect(actor.sprite.tint).toBe(0xffffff);expect(actor.fl.alpha).toBe(0);
 view.drawEnemy(actor,{...snap,bonded:false} as CombatSnap,0,0,1,1000,.05,false);expect(actor.sprite.tint).toBe(0x3a2c66);expect(actor.fl.alpha).toBeGreaterThan(0);
});
