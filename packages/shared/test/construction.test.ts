import { describe, it, expect } from 'vitest';
import { ChunkStore, T, UPPER_OY, isUpperY, BUILD_PIECES, RECIPES, type BuildCell } from '../src';
const cell = (x: number, y: number): BuildCell => ({ x, y, kind: 'structure', sub: 'cell', owner: 'builder', data: { floor: 'timber_floor', wall: 'timber_door' } });
describe('owned structural layer', () => {
  it('composes collision without overwriting furnishings or base terrain', () => {
    const s = new ChunkStore(7); s.setTile(-1, 32, T.GRASS);
    const o = cell(-1, 32); s.putObject(o);
    s.putObject({x:-1,y:32,kind:'furniture',sub:'rug',owner:'builder'});
    expect(s.getTile(-1, 32)).toBe(T.WALL); expect(s.solidAt(-1,32)).toBe(true);
    s.putObject({...o, data:{...o.data,open:true}});
    expect(s.getTile(-1,32)).toBe(T.FLOOR); expect(s.solidAt(-1,32)).toBe(false);
    s.removeObject(-1,32); expect(s.structureAt(-1,32)).toBeTruthy();
    s.removeStructure(-1,32); expect(s.getTile(-1,32)).toBe(T.GRASS);
  });
  it('supports upper floors across the building region without touching cave bands', () => {
    expect(isUpperY(UPPER_OY + 9999)).toBe(true); expect(isUpperY(-40000)).toBe(false);
    const s = new ChunkStore(7); const o = cell(33,UPPER_OY+35); o.data={floor:'stone_floor'}; s.putObject(o);
    expect(s.solidAt(33,UPPER_OY+35)).toBe(false);
    expect(s.solidAt(34,UPPER_OY+35)).toBe(true);
  });
  it('makes every reusable block craftable from the start', () => {
    for(const id of Object.keys(BUILD_PIECES)) expect(Object.values(RECIPES).some(r=>r.out.id===id && r.learn==='start')).toBe(true);
  });
});

it('keeps both storeys in the same horizontal shard while preserving plane coordinates',async()=>{
 const {shardAt,inRegion,handoffTarget}=await import('../src');
 expect(shardAt(100,100+UPPER_OY)).toBe(shardAt(100,100));
 expect(inRegion({rx:0,ry:0},100,100+UPPER_OY)).toBe(true);
 expect(handoffTarget({rx:0,ry:0},100,100+UPPER_OY)).toBeNull();
 expect(shardAt(130,100+UPPER_OY)).toBe('1,0');
});
