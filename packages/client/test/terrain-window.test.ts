import {expect,it} from 'vitest';
import {terrainWindow,TERRAIN_PAD} from '../src/game/terrain-window';
it('reuses a world-anchored background while its overscan covers continuous camera movement',()=>{
 const a=terrainWindow(-21.8,34.2,10,true,0),b=terrainWindow(-20,35,10.01,true,0);expect(b).toEqual(a);
 for(const x of[-100.5,-1.2,0,14.9,100.1]){const w=terrainWindow(x,x,10,false,1);expect(x-w.x).toBeGreaterThanOrEqual(TERRAIN_PAD);expect(x-w.x).toBeLessThan(TERRAIN_PAD*2);}
});
it('keeps actors/camera independent of the slower cosmetic terrain animation clock',()=>{
 expect(terrainWindow(0,0,10,true,0).tick).toBe(150);expect(terrainWindow(0,0,10.07,true,0).tick).toBe(151);
 expect(terrainWindow(0,0,15,false,1).tick).toBe(0);
});
