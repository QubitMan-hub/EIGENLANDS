import { describe, expect, it } from 'vitest';
import {
  setActiveGeneration,
  OTHERWORLDS,
  roomOf,
  roomTheme,
  caveRegion,
  caveTownAt,
  sanctuaryAt,
  tileAt,
  isSolid,
  ChunkStore,
  type OtherworldId,
} from '@eigenlands/shared';
import { OtherworldModule } from '../src/features/otherworlds';
import { CaveModule } from '../src/features/caves';
import type { GameRoom } from '../src/rooms/GameRoom';
import type { ServerPlayer } from '../src/rooms/player';

function fixture(seed = 42) {
  setActiveGeneration(seed, 7);
  const spawned: Array<{ kind: string; x: number; y: number }> = [];
  const enemies = new Map();
  const players = new Map();
  const room = {
    seed,
    enemies,
    players,
    rand: () => 0,
    owns: () => true,
    fx: () => {},
    store: {
      generation: 7,
      has: () => true,
      objectAt: () => undefined,
      getTile: (x: number, y: number) => tileAt(seed, x, y, 7),
      solidAt: (x: number, y: number) => isSolid(tileAt(seed, x, y, 7)),
    },
    spawnEnemy: (kind: string, x: number, y: number) => {
      const e = { id: `${spawned.length}`, kind, x, y, def: { name: kind } };
      spawned.push(e);
      enemies.set(e.id, e);
      return e;
    },
  };
  return { room: room as unknown as GameRoom, spawned, players, enemies };
}
const player = (x: number, y: number) =>
  ({ id: 'p', sim: { x, y }, level: 12, deadT: 0, toast: () => {} }) as unknown as ServerPlayer;

describe('authoritative local encounters', () => {
  it('finds open ground beside a solid crystal vent marker for its guardian', () => {
    const f = fixture();
    const store = new ChunkStore(42, 80, 7);
    Object.assign(f.room, { store });
    let target: ReturnType<typeof caveRegion> | undefined;
    for (let gy = -7; gy <= 7 && !target; gy++)
      for (let gx = -7; gx <= 7 && !target; gx++) {
        const r = caveRegion(42, gx, gy, 7),
          x = r.x + 7,
          y = r.y - 6;
        if (r.feature === 'vents' && r.biome === 'crystal' && !caveTownAt(x, y) && !sanctuaryAt(42, x, y)) target = r;
      }
    expect(target).toBeDefined();
    const x = target!.x + 7,
      y = target!.y - 6;
    expect(store.solidAt(x, y)).toBe(true);
    expect(store.objectAt(x, y)?.sub).toBe('cave_vent');
    expect(store.solidAt(x, y + 3)).toBe(false);
    f.players.set('p', player(x + 0.5, y + 3.5));
    const mod = new CaveModule(f.room);
    mod.tick(0, 1);
    mod.tick(1, 2);
    expect(f.spawned.map((s) => s.kind)).toEqual(['geode_golem']);
    const guardian = f.spawned[0]!;
    expect(store.solidAt(Math.floor(guardian.x), Math.floor(guardian.y))).toBe(false);
  });
  it('chooses a flooded chamber serpent at the candidate and rejects full safe arrival rooms', () => {
    const f = fixture(),
      mod = new OtherworldModule(f.room) as unknown as {
        spawnNear: (p: ServerPlayer, w: OtherworldId, kind: string | null, a: number, b: number) => unknown;
      };
    let target: { x: number; y: number } | undefined;
    for (let gy = -6; gy <= 6; gy++)
      for (let gx = -6; gx <= 6; gx++) {
        const r = roomOf(42, 'umbra', gx, gy);
        if (r && roomTheme(42, 'umbra', r, 7) === 'flooded') target = { x: r.x, y: r.y + OTHERWORLDS.umbra.oy };
      }
    expect(target).toBeDefined();
    mod.spawnNear(player(target!.x - 13, target!.y), 'umbra', null, 13, 13);
    expect(f.spawned.map((s) => s.kind)).toEqual(['abyss_serpent']);
    for (const w of ['aetheria', 'umbra', 'chronoria'] as const) {
      mod.spawnNear(player(-13, OTHERWORLDS[w].oy), w, 'gale_reaver', 13, 13);
    }
    expect(f.spawned).toHaveLength(1);
    // The warband companion cannot exceed the existing shared local cap.
    for (let i = 0; i < 5; i++) f.enemies.set(`near${i}`, { x: target!.x - 13, y: target!.y });
    mod.spawnNear(player(target!.x - 13, target!.y), 'umbra', null, 13, 13);
    expect(f.spawned).toHaveLength(1);
  });

  it('a crystal grotto awakens a geode guardian instead of a fungal matriarch', () => {
    const f = fixture();
    let target: ReturnType<typeof caveRegion> | undefined;
    for (let gy = -7; gy <= 7; gy++)
      for (let gx = -7; gx <= 7; gx++) {
        const r = caveRegion(42, gx, gy, 7),
          x = r.x + 7,
          y = r.y - 6;
        if (
          r.feature === 'grove' &&
          r.biome === 'crystal' &&
          !caveTownAt(x, y) &&
          !sanctuaryAt(42, x, y) &&
          !f.room.store.solidAt(x, y)
        )
          target = r;
      }
    expect(target).toBeDefined();
    f.players.set('p', player(target!.x + 7, target!.y - 6));
    const mod = new CaveModule(f.room);
    mod.tick(0, 1);
    mod.tick(1, 2);
    expect(f.spawned.map((s) => s.kind)).toEqual(['geode_golem']);
  });
  it('warns about frost pressure before a vent pulse and damages only its marked radius', () => {
    const f = fixture();
    let target: ReturnType<typeof caveRegion> | undefined;
    for (let gy = -7; gy <= 7; gy++)
      for (let gx = -7; gx <= 7; gx++) {
        const r = caveRegion(42, gx, gy, 7),
          x = r.x + 7,
          y = r.y - 6;
        if (r.feature === 'vents' && r.biome === 'frost' && !caveTownAt(x, y) && !sanctuaryAt(42, x, y)) target = r;
      }
    expect(target).toBeDefined();
    const messages: string[] = [],
      p = player(target!.x + 7, target!.y - 6);
    p.hp = p.maxHp = 100;
    p.toast = (message: string) => {
      messages.push(message);
    };
    f.players.set('p', p);
    const mod = new CaveModule(f.room);
    mod.tick(0, 1);
    mod.tick(1, 1);
    expect(p.hp).toBe(100);
    expect(messages.join(' ')).toMatch(/rime.*leave|cold.*leave/i);
    mod.tick(2, 2);
    expect(p.hp).toBe(92);
    expect(f.spawned).toHaveLength(0);
  });
});
