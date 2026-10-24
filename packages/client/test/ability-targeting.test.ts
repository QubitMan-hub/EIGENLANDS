import {expect,it} from 'vitest';
import {abilityTargeting} from '../src/features/circuit/model';
it('derives directional previews from actual bolt/link/blink forms, keeping self abilities instant',()=>{
 expect(abilityTargeting('glimmer')).toMatchObject({skill:true,range:9});expect(abilityTargeting('split_shot')).toMatchObject({skill:true,range:10});
 expect(abilityTargeting('echo_step')).toMatchObject({skill:true,range:4});expect(abilityTargeting('tether')).toMatchObject({skill:true,range:9,ally:true,enemy:true});
 expect(abilityTargeting('prob_ward').skill).toBe(false);expect(abilityTargeting('mend').skill).toBe(false);
});
