import {expect,it,vi} from 'vitest';
it('keeps two seeds isolated even when their old packed keys collide',async()=>{
 const points=Array.from({length:24},(_,i)=>({x:200+i*47,y:97+i*33}));
 vi.resetModules();let world=await import('../src/worldgen');const a=points.map(p=>world.biomeAt(1,p.x,p.y));
 vi.resetModules();world=await import('../src/worldgen');const b=points.map(p=>world.biomeAt(2,p.x,p.y^24));
 expect(a.some((v,i)=>v!==b[i])).toBe(true);
 vi.resetModules();world=await import('../src/worldgen');
 for(let i=0;i<points.length;i++){const p=points[i]!;expect(world.biomeAt(1,p.x,p.y)).toBe(a[i]);expect(world.biomeAt(2,p.x,p.y^24)).toBe(b[i]);expect(world.biomeAt(1,p.x,p.y)).toBe(a[i]);}
});
it('does not wrap coordinates at 65536 tiles or round fractional samples',async()=>{
 const points=Array.from({length:20},(_,i)=>({x:200+i*53,y:-91-i*47}));
 vi.resetModules();let world=await import('../src/worldgen');const a=points.map(p=>world.biomeAt(77,p.x,p.y));
 vi.resetModules();world=await import('../src/worldgen');const b=points.map(p=>world.biomeAt(77,p.x+65536,p.y));
 expect(a.some((v,i)=>v!==b[i])).toBe(true);
 vi.resetModules();world=await import('../src/worldgen');
 for(let i=0;i<points.length;i++){const p=points[i]!;expect(world.biomeAt(77,p.x,p.y)).toBe(a[i]);expect(world.biomeAt(77,p.x+65536,p.y)).toBe(b[i]);}
 const before=world.sampleClimate(77,223.25,-191.75);expect(world.sampleClimate(77,223.25,-191.75)).toEqual(before);
});
