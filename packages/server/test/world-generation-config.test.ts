import { expect, it } from 'vitest';
import { loadConfig } from '../src/config';

it('defaults new worlds to revision 7 while honoring explicitly pinned revision 6', () => {
  expect(loadConfig({}).newWorldGeneration).toBe(7);
  expect(loadConfig({ NEW_WORLD_GENERATION: '6' }).newWorldGeneration).toBe(6);
  expect(loadConfig({ NEW_WORLD_GENERATION: '7' }).newWorldGeneration).toBe(7);
});
