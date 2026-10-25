import { describe, expect, it } from 'vitest';
import { packAppearance } from '@eigenlands/shared';
import { loadPlayerData, newPlayerData, serializePlayerData } from '../src/systems/profile';

const look = packAppearance({ skin: 3, hairStyle: 7, hairColor: 2, eyes: 1, dress: 2, dressColor: 9, trim: 4 });

describe('stored appearance', () => {
  it('new characters have not chosen one yet', () => {
    expect(newPlayerData(0).appearance).toBe(0);
  });

  it('survives a save and load round trip', () => {
    const d = newPlayerData(0);
    d.appearance = look;
    const back = loadPlayerData(JSON.parse(JSON.stringify(serializePlayerData(d))), 0, Date.now());
    expect(back.appearance).toBe(look);
  });

  it('never trusts stored shapes', () => {
    for (const bad of ['7', -3, 1.5, 2 ** 33, null, {}, 12345]) {
      const d = serializePlayerData(newPlayerData(0));
      d.appearance = bad;
      expect(loadPlayerData(d, 0, Date.now()).appearance).toBe(0);
    }
  });

  it('old characters without the field load unchanged', () => {
    const d = serializePlayerData(newPlayerData(0));
    delete d.appearance;
    expect(loadPlayerData(d, 0, Date.now()).appearance).toBe(0);
  });
});
