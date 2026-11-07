import { describe, expect, it } from 'vitest';
import { BUILD_BATCH_MAX, buildPlan, perimeterTurn } from '../src/construction';

describe('dragged building runs', () => {
  it('fills a rectangle of floors, nearest the start first', () => {
    const plan = buildPlan('timber_floor', 10, 10, 12, 11);
    expect(plan).toHaveLength(6);
    expect(plan[0]).toEqual([10, 10, 0]);
    expect(new Set(plan.map(([x, y]) => `${x},${y}`)).size).toBe(6);
  });
  it('runs walls along a straight drag and around a rectangle, each turned along its side', () => {
    expect(buildPlan('timber_wall', 0, 0, 4, 0).every(([, , t]) => t === 0)).toBe(true);
    expect(buildPlan('timber_wall', 0, 0, 0, 3).every(([, , t]) => t === 1)).toBe(true);
    const room = buildPlan('timber_wall', 0, 0, 4, 3);
    expect(room).toHaveLength(14);
    const at = (x: number, y: number) => room.find(([a, b]) => a === x && b === y)?.[2];
    expect(at(2, 0)).toBe(0);
    expect(at(0, 1)).toBe(1);
    expect(at(4, 2)).toBe(1);
    expect(at(0, 0)).toBe(0);
    expect(at(2, 1)).toBeUndefined();
  });
  it('keeps roofs on the chosen ridge, doors and stairs single, and caps a run', () => {
    expect(buildPlan('thatch_roof', 0, 0, 1, 1, 1).every(([, , t]) => t === 1)).toBe(true);
    expect(buildPlan('timber_door', 0, 0, 5, 5)).toEqual([[5, 5, 0]]);
    expect(buildPlan('timber_stairs', 0, 0, 5, 5, 2)).toEqual([[5, 5, 2]]);
    expect(buildPlan('timber_floor', 0, 0, 20, 20)).toHaveLength(BUILD_BATCH_MAX);
  });
  it('matches the generated cottages’ wall turns', () => {
    expect(perimeterTurn(0, 0, 5, 4)).toBe(0);
    expect(perimeterTurn(0, 2, 5, 4)).toBe(1);
    expect(perimeterTurn(2, 3, 5, 4)).toBe(0);
  });
});
