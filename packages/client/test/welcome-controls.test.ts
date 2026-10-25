import { expect, it } from 'vitest';
import { DEFAULT_KEYS, loadKeys } from '../src/input/keymap';
it('puts four abilities on Q E R F and separates interaction from the skill shot', () => {
  expect([DEFAULT_KEYS.ability1, DEFAULT_KEYS.ability2, DEFAULT_KEYS.ability3, DEFAULT_KEYS.ability4]).toEqual([
    ['KeyQ'],
    ['KeyE'],
    ['KeyR'],
    ['KeyF'],
  ]);
  expect(DEFAULT_KEYS.interact).toEqual(['Space']);
  expect(DEFAULT_KEYS.skill).not.toContain('KeyX');
});
it('migrates an unchanged legacy group but preserves custom or unbound choices', () => {
  const legacy = {
    ...DEFAULT_KEYS,
    ability2: ['KeyR'],
    ability3: ['KeyF'],
    ability4: ['KeyG'],
    interact: ['KeyE'],
    skill: ['KeyK', 'KeyX'],
  };
  const read = (v: unknown) => loadKeys({ getItem: () => JSON.stringify(v) });
  expect(read({ voice: ['KeyM'] }).map).toEqual(['KeyM']);
  expect(read(legacy).ability2).toEqual(['KeyE']);
  expect(read(legacy).interact).toEqual(['Space']);
  expect(read({ ...legacy, ability4: [] }).ability4).toEqual([]);
  expect(read({ ...legacy, ability4: [] }).interact).toEqual(['KeyE']);
  expect(read({ interact: ['KeyE'] }).interact).toEqual(['KeyE']);
  expect(read({ interact: ['KeyE'] }).ability2).toEqual([]);
});
it('migrates untouched Space/X defaults while preserving custom and unbound controls', () => {
  const read = (v: unknown) => loadKeys({ getItem: () => JSON.stringify(v) }),
    old = { ...DEFAULT_KEYS, dash: ['Space', 'ShiftLeft'], interact: ['KeyX'] };
  expect(read(old).dash).toEqual(['ShiftLeft', 'ShiftRight']);
  expect(read(old).interact).toEqual(['Space']);
  expect(read({ ...old, dash: ['KeyO'] }).dash).toEqual(['KeyO']);
  expect(read({ ...old, interact: [] }).interact).toEqual([]);
  expect(read({ ...old, craft: ['ShiftRight'] }).craft).toEqual(['ShiftRight']);
  expect(read({ ...old, craft: ['ShiftRight'] }).interact).toEqual(['KeyX']);
});
