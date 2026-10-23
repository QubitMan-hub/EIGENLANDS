import { expect, it } from 'vitest';
import { DEFAULT_KEYS, loadKeys } from '../src/input/keymap';
it('puts four abilities on Q E R F and separates interaction from the skill shot',()=>{
 expect([DEFAULT_KEYS.ability1,DEFAULT_KEYS.ability2,DEFAULT_KEYS.ability3,DEFAULT_KEYS.ability4]).toEqual([['KeyQ'],['KeyE'],['KeyR'],['KeyF']]);expect(DEFAULT_KEYS.interact).toEqual(['KeyX']);expect(DEFAULT_KEYS.skill).not.toContain('KeyX');
});
it('migrates an unchanged legacy group but preserves custom or unbound choices',()=>{
 const legacy={...DEFAULT_KEYS,ability2:['KeyR'],ability3:['KeyF'],ability4:['KeyG'],interact:['KeyE'],skill:['KeyK','KeyX']};
 const read=(v:unknown)=>loadKeys({getItem:()=>JSON.stringify(v)});
 expect(read({voice:['KeyM']}).map).toEqual(['KeyM']);
 expect(read(legacy).ability2).toEqual(['KeyE']);expect(read(legacy).interact).toEqual(['KeyX']);
 expect(read({...legacy,ability4:[]}).ability4).toEqual([]);expect(read({...legacy,ability4:[]}).interact).toEqual(['KeyE']);
 expect(read({interact:['KeyE']}).interact).toEqual(['KeyE']);expect(read({interact:['KeyE']}).ability2).toEqual([]);
});
