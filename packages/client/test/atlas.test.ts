import { expect, it } from 'vitest';
import { ChunkStore, CAVE_OY, UPPER_OY, T } from '@eigenlands/shared';
import { Exploration, chartY, planeOf } from '../src/features/atlas/model';
import { DEFAULT_KEYS, loadKeys, rebind } from '../src/input/keymap';
it('records only visited tiles in present chunks and refreshes edited ground', () => {
 const store = new ChunkStore(1337), journal = new Exploration(4);
 journal.visit(store, -.5, -.5, 3); expect(journal.chunks.size).toBe(0);
 store.get(-1,-1); journal.visit(store, -.5, -.5, 3);
 expect(journal.tile(-1,-1)).toBe(store.getTile(-1,-1)); expect(journal.tile(-20,-20)).toBeUndefined(); expect(store.has(0,0)).toBe(false);
 store.setTile(-1,-1,T.PATH); journal.visit(store,-.5,-.5,3); expect(journal.tile(-1,-1)).toBe(T.PATH);
});
it('keeps exploration planes separate and bounds its retained chunk data', () => {
 const store = new ChunkStore(1), journal = new Exploration(2);
 for (const x of [0,32,64]) { store.get(x/32,0); journal.visit(store,x+.5,.5,1); }
 expect(journal.chunks.size).toBe(2); expect(journal.tile(0,0)).toBeUndefined();
 expect(planeOf(0)).not.toBe(planeOf(CAVE_OY)); expect(planeOf(UPPER_OY)).not.toBe(planeOf(CAVE_OY));
 expect(chartY(CAVE_OY+5)).toBe(5);expect(chartY(UPPER_OY-4)).toBe(-4);
 expect(journal.tile(64,CAVE_OY)).toBeUndefined();
 const copy = new Exploration(2); copy.restore(journal.serialize()); expect(copy.tile(64,0)).toBe(journal.tile(64,0));
 copy.restore('{bad'); expect(copy.chunks.size).toBe(2); copy.restore(JSON.stringify({chunks:[['NaN,0','x']]})); expect(copy.chunks.size).toBe(2);
});
it('binds map M and voice N, migrates legacy defaults and preserves deliberate custom/unbound actions', () => {
 expect(DEFAULT_KEYS.map).toEqual(['KeyM']); expect(DEFAULT_KEYS.voice).toEqual(['KeyN']);
 const read = (v: unknown) => loadKeys({getItem:()=>JSON.stringify(v)});
 expect(read({voice:['KeyM']}).voice).toEqual(['KeyN']);
 const custom=read({attack:['KeyM'], voice:['KeyN']}); expect(custom.attack).toEqual(['KeyM']); expect(custom.map).toEqual([]);
 expect(read({map:[],voice:['KeyM']}).map).toEqual([]);
 const bound=rebind(DEFAULT_KEYS,'voice','KeyM'); expect(read(bound).map).toEqual([]);
});

it('restores visited tiles without revealing unvisited cells or loading their chunks', () => {
 const store=new ChunkStore(7), journal=new Exploration(); store.get(0,0); journal.visit(store,2,2,1);
 const copy=new Exploration();copy.restore(journal.serialize());
 expect(copy.tile(2,2)).toBe(store.getTile(2,2));expect(copy.tile(20,20)).toBeUndefined();expect(store.has(1,1)).toBe(false);
 const revision=journal.chunks.get('0,0')!.revision;journal.visit(store,2,2,1);expect(journal.chunks.get('0,0')!.revision).toBe(revision);
 store.setTile(2,2,T.PATH);journal.visit(store,2,2,1);expect(journal.chunks.get('0,0')!.revision).toBeGreaterThan(revision);
});
