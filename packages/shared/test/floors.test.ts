import { expect, it } from 'vitest';
import { townsFor, townFor, tileAt, isSolid, objSolid, ChunkStore, findPath } from '../src';

it('furnished upper floors have reversible, walkable stairs and separate solid boundaries', () => {
  const towns = townsFor(1337), base = townFor(1337);
  const stairs = base.objects.filter(o => o.sub === 'stairs_up');
  expect(stairs.length).toBeGreaterThanOrEqual(2);
  for (const up of stairs) {
    expect(objSolid(up.kind, up.sub)).toBe(false);
    const to = up.data!.to as { x: number; y: number };
    expect(isSolid(tileAt(1337, Math.floor(to.x), Math.floor(to.y)))).toBe(false);
    const upper = towns.find(t => t.buildings.some(b => to.x >= b.x && to.x < b.x + b.w && to.y >= b.y && to.y < b.y + b.h))!;
    const down = upper.objects.find(o => o.sub === 'stairs_down' && o.data?.building === up.data?.building)!;
    expect(down.data!.to).toEqual({ x: up.x + .5, y: up.y + .5 });
    expect(upper.objects.some(o => o.sub === 'bed')).toBe(true);
    expect(isSolid(tileAt(1337, upper.x0, upper.y0))).toBe(true);
  }
});
it('puts town stairs by a back corner with a clear landing instead of the entrance aisle',()=>{
 for(const seed of[7,1337,2026]){const base=townsFor(seed).filter(t=>!t.name.includes('upper floor')),store=new ChunkStore(seed);
 for(const t of base)for(const up of t.objects.filter(o=>o.sub==='stairs_up')){
  const b=t.buildings.find(b=>b.id===up.data?.building)!;expect(up.x).toBe(b.x+b.w-2);expect(up.y).toBe(b.y+1);
  expect(t.objects.filter(o=>o.x===up.x&&o.y===up.y)).toHaveLength(1);
  expect(findPath(b.doorX,b.doorY,up.x,up.y,(x,y)=>store.solidAt(x,y),512),`${t.name}/${b.id} stair route`).not.toBeNull();
 }}
});
