import {expect,it} from 'vitest';
import {simulationBudget,newPlayerSim,stepPlayer,sanitizeCmd} from '../src';
function travel(frames:number[],dash=false){const s=newPlayerSim(.5,.5);let acc=0,seq=0;for(const elapsed of frames){const b=simulationBudget(acc,elapsed);acc=b.remainder;for(let i=0;i<b.steps;i++)stepPlayer(s,sanitizeCmd({seq:++seq,dx:1,dy:0,dash:dash&&seq===1,attack:false,skill:false,aimX:1,aimY:0,viewTick:0}),()=>false);}return s;}
it('keeps walking and dash travel identical when render callbacks stall',()=>{
 const smooth=Array(20).fill(50),slow=Array(4).fill(250);expect(travel(slow).x).toBeCloseTo(travel(smooth).x,10);expect(travel(slow,true).x).toBeCloseTo(travel(smooth,true).x,10);
});
it('caps catch-up after a long suspension without retaining an input backlog',()=>{
 expect(simulationBudget(0,10000)).toEqual({steps:5,remainder:0});expect(simulationBudget(25,25)).toEqual({steps:1,remainder:0});expect(simulationBudget(0,NaN)).toEqual({steps:0,remainder:0});
});
