import { expect, it } from 'vitest';
import { guildDestinations } from '../src/features/atlas/destinations';
import { guildBoard, townFor } from '@eigenlands/shared';
it('shows only discovered halls and deduplicates streamed and generated boards', () => {
  const b = guildBoard(townFor(20260101))!;
  const streamed = [
    { ...b, data: { town: 'Hadamere' } },
    { x: 4100, y: 4200, data: { town: 'Faraway' } },
    { x: NaN, y: 0 },
  ];
  expect(guildDestinations(20260101, streamed, () => false)).toEqual([]);
  const seen = (x: number, y: number) => x === b.x && y === b.y;
  const entries = guildDestinations(20260101, streamed, seen);
  expect(entries).toHaveLength(1);
  expect(entries[0]?.point).toEqual({ x: b.x, y: b.y });
  expect(entries[0]?.title).toContain('Hadamere');
  const frontier = guildDestinations(20260101, streamed, (x, y) => x === 4100 && y === 4200);
  expect(frontier).toHaveLength(1);
  expect(frontier[0]?.title).toContain('Faraway');
});
