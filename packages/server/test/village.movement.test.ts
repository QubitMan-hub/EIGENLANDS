import { describe, expect, it } from 'vitest';
import { NPCS, buildingAt, isSolid, scheduleAt, tileAt, townFor } from '@eigenlands/shared';
import { SEED, makeVillage, run } from './village.helpers';

const town = townFor(SEED);

describe('village movement', () => {
  it('creates all 10 NPCs at their scheduled spots', async () => {
    const { village, state, clock } = await makeVillage();
    expect(state.npcs.size).toBe(10);
    for (const def of NPCS) {
      const n = village.npc(def.id)!;
      const sp = town.spots[scheduleAt(def, clock.hour(), clock.weather()).spot]!;
      expect(n.x).toBeCloseTo(sp.x + 0.5);
      expect(n.y).toBeCloseTo(sp.y + 0.5);
      expect(n.look).toBe(def.look);
      expect(isSolid(tileAt(SEED, Math.floor(n.x), Math.floor(n.y)))).toBe(false);
    }
  });

  it('follows a full simulated day: reaches every scheduled spot, never walks into walls', async () => {
    const { village, clock, host } = await makeVillage();
    clock.forced = 'clear';
    clock.set(0, 0); // midnight; NPCs start asleep at home
    // re-init positions by simulating from midnight
    let tick = 0;
    const visited = new Map<string, Set<string>>(NPCS.map((n) => [n.id, new Set()]));
    const checkpoints: number[] = [];
    // 24 game hours = 28800 ticks (1200 ticks per game hour)
    for (let h = 0; h < 24; h++) {
      for (let k = 0; k < 1200; k++) {
        tick = run(village, clock, 1, tick);
        if (k % 25 === 0) {
          for (const def of NPCS) {
            const n = village.npc(def.id)!;
            expect(host.store.solidAt(Math.floor(n.x), Math.floor(n.y)), `${def.id} inside a solid tile at h${h}`).toBe(false);
          }
        }
        // 55 s into the block (long walks take ~35 s): everyone must be at their spot
        if (k === 1100) {
          checkpoints.push(h);
          for (const def of NPCS) {
            const block = scheduleAt(def, clock.hour(), 'clear');
            const sp = town.spots[block.spot]!;
            const n = village.npc(def.id)!;
            const d = Math.hypot(n.x - (sp.x + 0.5), n.y - (sp.y + 0.5));
            expect(d, `${def.id} should be at ${block.spot} at hour ${h}`).toBeLessThan(0.6);
            visited.get(def.id)!.add(block.spot);
          }
        }
      }
    }
    expect(checkpoints.length).toBe(24);
    // each NPC visits more than one place in a day
    for (const def of NPCS) expect(visited.get(def.id)!.size, def.id).toBeGreaterThanOrEqual(2);
  }, 60000);

  it('walks at 1.8 tiles/s and flags walking', async () => {
    const { village, clock } = await makeVillage();
    clock.forced = 'clear';
    clock.set(0, 11.9); // orla is about to leave for the plaza at 12:00
    let tick = run(village, clock, 1);
    clock.set(0, 12.01);
    tick = run(village, clock, 20, tick); // the schedule is re-read once a second, staggered per NPC
    const n = village.npc('orla')!;
    const x0 = n.x, y0 = n.y;
    tick = run(village, clock, 20, tick); // exactly 1 s of walking
    expect(n.flags & 1).toBe(1);
    const moved = Math.hypot(n.x - x0, n.y - y0);
    expect(moved).toBeGreaterThan(1.2);
    expect(moved).toBeLessThan(2.1);
    void tick;
  });

  it('shelters from the rain: the farmer leaves the field for the farmhouse', async () => {
    const { village, clock } = await makeVillage();
    clock.forced = 'clear';
    clock.set(0, 9);
    let tick = run(village, clock, 1);
    // let him reach the field first
    tick = run(village, clock, 2400, tick);
    const field = town.spots.field!;
    expect(Math.hypot(village.npc('fenwick')!.x - field.x - 0.5, village.npc('fenwick')!.y - field.y - 0.5)).toBeLessThan(0.6);
    clock.forced = 'rain';
    tick = run(village, clock, 1500, tick);
    const home = town.spots['farmhouse.work']!;
    const n = village.npc('fenwick')!;
    expect(Math.hypot(n.x - home.x - 0.5, n.y - home.y - 0.5)).toBeLessThan(0.6);
    expect(n.flags & 2).toBe(2); // inside a building
    void tick;
  });

  it('inside flag is set under a roof and clear at the door/outside', async () => {
    const { village, clock } = await makeVillage();
    clock.forced = 'clear';
    clock.set(0, 3);
    expect(village.npc('tobin')!.flags & 2).toBe(2);
    expect(buildingAt(SEED, Math.floor(village.npc('tobin')!.x), Math.floor(village.npc('tobin')!.y))?.id).toBe('store');
    clock.set(0, 18.5);
    run(village, clock, 1300);
    expect(village.npc('tobin')!.flags & 2).toBe(0); // at the plaza
  });

  it('freezes and faces the player while a dialogue is open, then resumes', async () => {
    const { village, clock } = await makeVillage();
    clock.forced = 'clear';
    clock.set(0, 11.9);
    let tick = run(village, clock, 1);
    clock.set(0, 12.01);
    const { FakePlayer } = await import('./village.helpers');
    const p = new FakePlayer();
    const o = village.npc('orla')!;
    p.x = o.x + 2; p.y = o.y;
    expect(village.talk(p, 'orla')).toBeTruthy();
    const x = o.x;
    tick = run(village, clock, 40, tick);
    expect(o.x).toBeCloseTo(x, 3);
    expect(o.flags & 4).toBe(4);
    expect(o.faceX).toBeGreaterThan(0.9); // facing the player to the east
    tick = run(village, clock, 400, tick); // 20 s: freeze (8 s) expired
    expect(o.flags & 4).toBe(0);
    expect(Math.abs(o.x - x) + Math.abs(o.y - village.npc('orla')!.y)).toBeGreaterThan(0.5);
  });

  it('teleports an NPC that is more than 40 tiles from its target (e.g. after server downtime)', async () => {
    const { village, clock } = await makeVillage();
    clock.forced = 'clear';
    clock.set(0, 3);
    const n = village.npc('juniper')!;
    n.x += 100; // simulate being displaced far away
    (village as unknown as { runners: Map<string, { x: number }> }).runners.get('juniper')!.x += 100;
    clock.set(0, 9);
    run(village, clock, 25);
    const sp = town.spots.plaza_a!;
    expect(Math.hypot(n.x - sp.x - 0.5, n.y - sp.y - 0.5)).toBeLessThan(1);
  });
});
