import { expect,it } from 'vitest';
import { validTravelNeeds, stepTravelNeeds } from '../src';
it('defaults legacy saves to Cozy and clamps stored values without accepting malformed mode/data',()=>{
 expect(validTravelNeeds(undefined)).toEqual({mode:'cozy',food:100,water:100});
 expect(validTravelNeeds({mode:'adventure',food:-4,water:500})).toEqual({mode:'adventure',food:0,water:100});
 expect(validTravelNeeds({mode:'cheat',food:NaN,water:'1'})).toEqual({mode:'cozy',food:100,water:100});
});
it('depletes only online active Adventure needs, using exertion and desert hydration rates',()=>{
 const n={mode:'adventure' as const,food:100,water:100};
 const base=stepTravelNeeds(n,60,{exerted:false,desert:false,paused:false});expect(base.food).toBeCloseTo(96.666667);expect(base.water).toBe(95);
 const hot=stepTravelNeeds(n,60,{exerted:true,desert:true,paused:false});expect(hot.food).toBeCloseTo(95.833333);expect(hot.water).toBeCloseTo(90.625);expect(n.food).toBe(100);
});
it('pauses Cozy, sanctuary/death and invalid elapsed time without catch-up',()=>{
 const n={mode:'adventure' as const,food:1,water:1},ctx={exerted:true,desert:true,paused:true};
 expect(stepTravelNeeds(n,300,ctx)).toEqual(n);expect(stepTravelNeeds({...n,mode:'cozy'},300,{...ctx,paused:false})).toEqual({...n,mode:'cozy'});
 expect(stepTravelNeeds(n,NaN,{...ctx,paused:false})).toEqual(n);
 expect(stepTravelNeeds(n,1000,{...ctx,paused:false})).toEqual({...n,food:0,water:0});
});
