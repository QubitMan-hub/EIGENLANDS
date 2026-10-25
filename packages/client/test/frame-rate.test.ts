import {expect,it} from 'vitest';
import {FrameRateWindow} from '../src/game/frame-rate';
it('counts real frames over a second instead of averaging inverse frame durations',()=>{
 const fps=new FrameRateWindow();expect(fps.sample(0)).toBe(0);
 for(let i=1;i<=100;i++)fps.sample(i);
 expect(fps.sample(1000)).toBe(101);
 expect(fps.sample(3000)).toBe(1);
});
it('expires old frames, handles startup and recovers from a reset clock',()=>{
 const fps=new FrameRateWindow();fps.sample(0);
 for(let i=1;i<=200;i++)expect(fps.sample(i*20)).toBeCloseTo(50,6);
 expect(fps.sample(4000)).toBeCloseTo(50,6);
 expect(fps.sample(1)).toBe(0);expect(fps.sample(21)).toBe(50);
});
