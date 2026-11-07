import { expect, it } from 'vitest';
import { newPlayerData, loadPlayerData, serializePlayerData } from '../src/systems/profile';
import { validParts } from '@eigenlands/shared';
it('preserves catalog selections through save/load and accepts legacy saves without them', () => {
  const p = newPlayerData(0);
  p.appearanceParts = validParts({ hair: 50, tops: 50, pants: 55, boots: 50 });
  const saved = JSON.parse(JSON.stringify(serializePlayerData(p)));
  expect(loadPlayerData(saved, 0, Date.now()).appearanceParts).toEqual(p.appearanceParts);
  delete saved.appearanceParts;
  expect(Object.values(loadPlayerData(saved, 0, Date.now()).appearanceParts!).every((v) => v === 0)).toBe(true);
});
