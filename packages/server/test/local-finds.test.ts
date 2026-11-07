import { describe, expect, it, vi } from 'vitest';
import { CAVE_OY, T, emptyInventory, localFindAt, type WorldGeneration, type WorldObj } from '@eigenlands/shared';
import type { GameRoom } from '../src/rooms/GameRoom';
import type { ServerPlayer } from '../src/rooms/player';
import { WondersModule } from '../src/features/wonders';
import { loadPlayerData, newPlayerData, serializePlayerData, validProg } from '../src/systems/profile';

function setup() {
  const objects = new Map<string, WorldObj>();
  let day = 20;
  let generation: WorldGeneration = 7;
  const p = {
    id: 'p',
    accountId: 'account',
    deadT: 0,
    level: 2,
    sim: { x: 200.5, y: CAVE_OY + 200.5 },
    data: { inv: emptyInventory(), quests: {}, prog: validProg({}) },
    dirty: vi.fn(),
    toast: vi.fn(),
  } as unknown as ServerPlayer;
  const room = {
    seed: 17,
    players: new Map([[p.id, p]]),
    wclock: { day: () => day, hour: () => 12 },
    store: {
      get generation() {
        return generation;
      },
      has: () => true,
      getTile: () => T.CAVE_FLOOR,
      solidAt: () => false,
      structureAt: () => undefined,
      objectAt: (x: number, y: number) => objects.get(`${x},${y}`),
    },
    owns: () => true,
    objects: {
      all: () => objects.values(),
      put: (o: WorldObj) => objects.set(`${o.x},${o.y}`, o),
      remove: (x: number, y: number) => objects.delete(`${x},${y}`),
    },
    grantXp: vi.fn(),
    fx: vi.fn(),
  } as unknown as GameRoom;
  return {
    p,
    room,
    objects,
    setGeneration: (value: WorldGeneration) => {
      generation = value;
    },
    nextDay: () => {
      day++;
    },
  };
}

describe('local find interaction', () => {
  it('creates one bounded real prop, rewards it once and preserves the claim after reload', () => {
    const s = setup(),
      module = new WondersModule(s.room);
    module.tick(0, 2.1);
    expect(s.objects.size).toBe(1);
    const o = [...s.objects.values()][0]!;
    expect(o.sub).toBe('fallen_star');
    module.tick(0, 2.1);
    expect(s.objects.size).toBe(1);
    const restarted = new WondersModule(s.room);
    restarted.tick(0, 2.1);
    expect(s.objects.size).toBe(1);
    s.p.sim.x = o.x + 0.5;
    s.p.sim.y = o.y + 0.5;
    const find = localFindAt(17, 20, o.x, o.y, 7)!;
    module.openStar(s.p, o);
    expect(s.objects.size).toBe(0);
    expect(s.p.data.inv.some((v) => v?.id === find.items[0]!.id)).toBe(true);
    expect(s.p.data.prog.localFindDay).toBe(20);
    expect(s.room.grantXp).toHaveBeenCalledTimes(1);
    s.p.data.prog = validProg(JSON.parse(JSON.stringify(s.p.data.prog)));
    const reloaded = new WondersModule(s.room);
    reloaded.tick(0, 2.1);
    reloaded.openStar(s.p, o);
    expect(s.objects.size).toBe(0);
    expect(s.room.grantXp).toHaveBeenCalledTimes(1);
    s.nextDay();
    reloaded.tick(0, 2.1);
    expect(s.objects.size).toBe(1);
  });
  it('keeps a full-pack find claimable and rejects distant or foreign claims', () => {
    const s = setup(),
      module = new WondersModule(s.room);
    module.tick(0, 2.1);
    const o = [...s.objects.values()][0]!;
    s.p.data.inv.fill({ id: 'wood', n: 999 });
    module.openStar(s.p, o);
    expect(s.p.data.prog.localFindDay).toBeUndefined();
    s.p.sim.x = o.x + 0.5;
    s.p.sim.y = o.y + 0.5;
    module.openStar({ ...s.p, accountId: 'foreign' } as ServerPlayer, o);
    expect(s.objects.size).toBe(1);
    module.openStar(s.p, o);
    expect(s.p.data.prog.localFindDay).toBeUndefined();
    expect(s.objects.size).toBe(1);
    s.p.data.inv = emptyInventory();
    module.openStar(s.p, o);
    expect(s.p.data.prog.localFindDay).toBe(20);
    expect(s.objects.size).toBe(0);
  });
  it('respects old generations, obstructed ground and the shared active-prop budget', () => {
    const s = setup();
    s.setGeneration(6);
    const module = new WondersModule(s.room);
    module.tick(0, 2.1);
    expect(s.objects.size).toBe(0);
    s.setGeneration(7);
    s.room.store.solidAt = () => true;
    module.tick(0, 2.1);
    expect(s.objects.size).toBe(0);
    s.room.store.solidAt = () => false;
    for (let i = 0; i < 40; i++) {
      const p = { ...s.p, id: `p${i}`, accountId: `account${i}`, sim: { ...s.p.sim, x: 300 + i * 30 } } as ServerPlayer;
      s.room.players.set(p.id, p);
    }
    module.tick(0, 2.1);
    expect(s.objects.size).toBeGreaterThan(0);
    expect(s.objects.size).toBe(32);
  });
  it('expires abandoned finds and refuses invalid persisted daily claims', () => {
    const s = setup(),
      module = new WondersModule(s.room);
    module.tick(0, 2.1);
    const o = [...s.objects.values()][0]!;
    s.nextDay();
    s.p.sim.x = o.x + 0.5;
    s.p.sim.y = o.y + 0.5;
    module.openStar(s.p, o);
    expect(s.p.data.prog.localFindDay).toBeUndefined();
    for (const value of [NaN, Infinity, '20', 2.5, null])
      expect(validProg({ localFindDay: value }).localFindDay).toBeUndefined();
    expect(validProg({ localFindDay: 20 }).localFindDay).toBe(20);
  });
});

describe('procedural resident friendship persistence', () => {
  it('retains added generation-seven named settlement roles', () => {
    const raw = serializePlayerData(newPlayerData(0));
    raw.friends = { aurelion_ntown_hand0: { pts: 25, talked: 10, gifted: 9 } };
    expect(loadPlayerData(raw, 0, Date.now()).friends.aurelion_ntown_hand0?.pts).toBe(25);
  });

  it('retains bounded valid frontier relationships and rejects malformed records', () => {
    const raw = serializePlayerData(newPlayerData(0));
    const friends = Object.fromEntries(
      Array.from({ length: 300 }, (_, i) => [`frontier_${i}_-42_farmer`, { pts: 500, talked: 10, gifted: 9 }]),
    );
    raw.friends = {
      ...friends,
      orla: { pts: 20, talked: 10, gifted: 9 },
      frontier_bad: { pts: 20, talked: 10, gifted: 9 },
      frontier_2_3_farmer: { pts: NaN, talked: 1, gifted: 1 },
    };
    const loaded = loadPlayerData(raw, 0, Date.now());
    expect(Object.keys(loaded.friends).filter((id) => id.startsWith('frontier_')).length).toBe(256);
    expect(loaded.friends['frontier_0_-42_farmer']?.pts).toBe(400);
    expect(loaded.friends.orla?.pts).toBe(20);
    expect(loaded.friends.frontier_bad).toBeUndefined();
    expect(loaded.friends.frontier_2_3_farmer).toBeUndefined();
  });
});
