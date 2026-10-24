import {expect,it} from 'vitest';
import {generateChunk,sampleClimate,tileAt,T,ChunkStore} from '../src';
it('keeps generated base chunks immutable across client/server stores and returned edits',()=>{
 const original=generateChunk(808,7,-9);const edited=generateChunk(808,7,-9);edited.fill(T.WALL);
 expect(generateChunk(808,7,-9)).toEqual(original);
 const a=new ChunkStore(808),b=new ChunkStore(808);a.setTile(224,-288,T.WALL);
 expect(b.getTile(224,-288)).toBe(original[0]);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++)expect(original[y*32+x]).toBe(tileAt(808,224+x,-288+y));
});
it('preserves exact climate values through seed changes and bounded cache eviction',()=>{
 const original=sampleClimate(71,-65,129),other=sampleClimate(72,-65,129);
 expect(other).not.toEqual(original);
 for(let i=0;i<110;i++)sampleClimate(71,i*32,-500);
 expect(sampleClimate(71,-65,129)).toEqual(original);
 expect(sampleClimate(72,-65,129)).toEqual(other);
 expect(sampleClimate(71,-65.25,129.5)).toEqual(sampleClimate(71,-65.25,129.5));
});

it('adopts worker-prepared data without changing terrain, biome or climate semantics',async()=>{
 const{prepareWorldChunk,acceptPreparedWorldChunk,hasPreparedWorldChunk,biomeAt}=await import('../src');
 const p=prepareWorldChunk(123,-3,5),tiles=p.tiles.slice(),climate=sampleClimate(123,-95,161),biome=biomeAt(123,-95,161);
 acceptPreparedWorldChunk(p);expect(hasPreparedWorldChunk(123,-3,5)).toBe(true);expect(generateChunk(123,-3,5)).toEqual(tiles);
 expect(sampleClimate(123,-95,161)).toEqual(climate);expect(biomeAt(123,-95,161)).toBe(biome);
 p.tiles.fill(T.WALL);p.climate.fill(0);expect(generateChunk(123,-3,5)).toEqual(tiles);expect(sampleClimate(123,-95,161)).toEqual(climate);
});
