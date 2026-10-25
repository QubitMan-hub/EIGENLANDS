import { expect, it } from 'vitest';
import { townsFor, sanctuaryAt, spawnTable, spawnBudget } from '../src';
it('protects every authored town and upper floor but not unrelated cave/wilderness coordinates',()=>{
 for(const seed of [1,20260101])for(const t of townsFor(seed)){if(t.abandoned){expect(sanctuaryAt(seed,t.cx,t.cy)).toBeNull();continue;}expect(sanctuaryAt(seed,t.cx,t.cy)?.name).toBe(t.name);expect(sanctuaryAt(seed,t.x0-2,t.y0)).not.toBeNull();}
 expect(sanctuaryAt(1,5000,5000)).toBeNull();expect(sanctuaryAt(1,60,100008)).toBeNull();
});
it('uses distinct habitats and keeps newcomers away from high-pressure enemies',()=>{
 const kinds=(biome:any,cave=false)=>spawnTable(6,true,biome,cave).map(e=>e.kind);
 expect(kinds('enchanted')).toContain('glasscrawler');expect(kinds('desert')).not.toContain('wolf');expect(kinds('taiga')).toContain('wolf');expect(kinds('meadow',true)).not.toContain('wolf');
 expect(kinds('enchanted')).not.toEqual(kinds('swamp'));
 for(const biome of ['meadow','forest','taiga','corrupted'] as const)expect(spawnTable(1,true,biome).every(e=>['slime','hopper'].includes(e.kind))).toBe(true);
 expect(spawnBudget(1,false)).toBe(3);expect(spawnBudget(1,true)).toBe(4);expect(spawnBudget(10,true,'corrupted')).toBeGreaterThan(spawnBudget(10,false,'meadow'));
});
