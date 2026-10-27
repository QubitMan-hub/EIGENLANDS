import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { ANCIENT_RITES, BOSSES, MSG, SPELL, T, biomeAt, caveRegionAt, CAVE_OY, bestiaryKind } from '@eigenlands/shared';
import { BossModule } from '../src/features/bosses';
import { createEnemy } from '../src/game/enemies';
import type { GameRoom } from '../src/rooms/GameRoom';
import type { ServerPlayer } from '../src/rooms/player';
import type { App } from '../src/app';
import { boot3, spawn3, tp, flatten, clearEnemies, until, sleep } from './p3helpers';
function habitat(seed: number, where: string) {
  if (where === 'sea') return { x: 800.5, y: 900.5 };
  for (let y = 500; y < 3500; y += 40)
    for (let x = 500; x < 3500; x += 40) {
      if (where === 'cave') {
        const r = caveRegionAt(seed, x, y + CAVE_OY, 6);
        if (r.feature === 'arena') return { x: r.x, y: r.y };
      } else if (biomeAt(seed, x, y) === where && biomeAt(seed, x + 4, y) === where) return { x: x + 0.5, y: y + 0.5 };
    }
  throw Error(`Missing ${where}`);
}
function field(id: (typeof ANCIENT_RITES)[number]['id']) {
  const def = BOSSES[id],
    pos = habitat(1337, ANCIENT_RITES.find((r) => r.id === id)!.where);
  const p = {
    id: 'hero',
    accountId: 'hero-account',
    level: 32,
    deadT: 0,
    sim: { ...pos, boat: id === 'world_serpent' ? 'skiff' : '' },
    toast: vi.fn(),
    client: { send: vi.fn() },
    data: { prog: { bosses: [] as string[] } },
    dirty: vi.fn(),
  };
  const solid = vi.fn(() => false);
  const room = {
    seed: 1337,
    players: new Map([[p.id, p]]),
    enemies: new Map(),
    state: { enemies: new Map(), spells: new Map() },
    store: { generation: 6, solidAt: Object.assign(solid, { sea: solid }), getTile: () => T.DEEP_WATER },
    fx: vi.fn(),
    enemyStrike: vi.fn(),
    fireOrbs: vi.fn(),
    nearby: () => [p],
    social: { partyMates: () => [] },
    playerByAccount: () => undefined,
    spawnEnemy: vi.fn((kind, x, y, night, opts) => {
      const e = createEnemy(kind, x, y, night, opts);
      room.enemies.set(e.id, e);
      return e;
    }),
  };
  const bosses = new BossModule(room as unknown as GameRoom);
  const summon = () => bosses.summon(p as unknown as ServerPlayer, def.item, pos.x, pos.y);
  return { p, room, bosses, summon, def, solid };
}
it('gates all five rites by level, environment, broad clearance and duplicate encounters', () => {
  for (const rite of ANCIENT_RITES) {
    const f = field(rite.id);
    f.p.level = rite.level - 1;
    expect(f.summon()).toBe(false);
    f.p.level = 32;
    f.solid.mockReturnValue(true);
    expect(f.summon()).toBe(false);
    f.solid.mockReturnValue(false);
    if (rite.where === 'sea') {
      f.p.sim.boat = '';
      expect(f.summon()).toBe(false);
      f.p.sim.boat = 'skiff';
    }
    expect(f.bosses.summon(f.p as unknown as ServerPlayer, rite.item, 0, 0)).toBe(false);
    expect(f.summon()).toBe(true);
    expect(f.summon()).toBe(false);
    expect([...f.room.state.spells.values()].some((s) => s.kind === SPELL.ARENA)).toBe(true);
  }
});
it('warns fixed ground sites before damage, exposes recovery, changes all phases and cancels strikes on stagger', () => {
  for (const rite of ANCIENT_RITES.filter((r) => r.id !== 'sealed_entity')) {
    const f = field(rite.id);
    expect(f.summon()).toBe(true);
    const e = [...f.room.enemies.values()][0];
    f.bosses.tick(0, 6.01);
    const marks = f.room.fx.mock.calls.map(([v]) => v).filter((v) => v.kind === 'bomb');
    expect(marks.length).toBeGreaterThanOrEqual(5);
    expect(marks.every((v) => v.v >= 1.7)).toBe(true);
    expect(f.room.enemyStrike).not.toHaveBeenCalled();
    expect(e.mode).toBe('recover');
    f.p.sim.x += 1;
    f.bosses.tick(0, 3);
    expect(f.room.enemyStrike.mock.calls.map(([, x, y]) => ({ x, y }))).toEqual(marks.map(({ x, y }) => ({ x, y })));
    e.hp = e.maxHp * 0.2;
    f.bosses.tick(0, 0.01);
    expect([...f.room.state.spells.values()][0].dx).toBe(3);
    f.room.enemyStrike.mockClear();
    f.bosses.tick(0, 20);
    e.mode = 'stagger';
    f.bosses.tick(0, 3);
    expect(f.room.enemyStrike).not.toHaveBeenCalled();
    f.bosses.tick(0, 100);
    f.p.deadT = 1;
    f.bosses.tick(0, 0.1);
    expect(f.room.state.spells.size).toBe(0);
  }
});
it('requires breaking the Unwritten King sentries, renews them with each seal, cleans up and rewards contributors only', () => {
  const f = field('sealed_entity');
  expect(f.summon()).toBe(true);
  const e = [...f.room.enemies.values()].find((e) => e.def.kind === bestiaryKind('sealed_entity'))!;
  const hit = () => f.bosses.outgoingDamage(f.p as unknown as ServerPlayer, e, 100);
  expect(hit()).toBe(0);
  expect(f.room.enemies.size).toBe(5);
  for (const [id, a] of f.room.enemies) if (a !== e) f.room.enemies.delete(id);
  expect(hit()).toBe(100);
  e.hp = e.maxHp * 0.7;
  f.bosses.tick(0, 0.1);
  expect(hit()).toBe(0);
  expect(f.room.enemies.size).toBe(5);
  f.bosses.killed(e, f.p as unknown as ServerPlayer);
  expect(f.p.data.prog.bosses).toHaveLength(0);
  expect(f.room.state.spells.size).toBe(0);
  expect(f.room.enemies.size).toBe(1);
  // A second run with actual contribution earns its once-only progression record.
  f.room.enemies.clear();
  expect(f.summon()).toBe(true);
  const b = [...f.room.enemies.values()].find((e) => e.def.kind === bestiaryKind('sealed_entity'))!;
  f.bosses.dealtDamage(f.p as unknown as ServerPlayer, b, 50);
  f.bosses.killed(b, f.p as unknown as ServerPlayer);
  expect(f.p.data.prog.bosses).toEqual(['sealed_entity']);
});
let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(200);
  await app?.close();
});
it('uses real inventory authority, preserves a refused rite, consumes one on success and saves its guaranteed trophy', async () => {
  const p = await spawn3(app, 'First-flame challenger');
  const pos = habitat(p.room.seed, 'desert');
  await tp(p, pos.x, pos.y);
  flatten(p.room, Math.floor(pos.x), Math.floor(pos.y), 16);
  clearEnemies(p.room);
  p.sp.sim.faceX = 1;
  p.sp.sim.faceY = 0;
  p.sp.invuln = 999;
  p.sp.level = 23;
  p.sp.data.inv.fill(null);
  p.sp.data.inv[0] = { id: 'first_flame_seal', n: 2 };
  const use = () => p.r.send(MSG.USE, { slot: 0, tx: Math.floor(pos.x), ty: Math.floor(pos.y) });
  const n = p.toasts.length;
  use();
  await until(() => p.toasts.length > n);
  expect(p.sp.data.inv[0]?.n).toBe(2);
  p.sp.level = 24;
  p.sp.toolReadyAt = 0;
  use();
  await until(() => [...p.room.enemies.values()].some((e) => e.def.kind === bestiaryKind('primordial_dragon')));
  expect(p.sp.data.inv[0]?.n).toBe(1);
  const boss = [...p.room.enemies.values()].find((e) => e.def.kind === bestiaryKind('primordial_dragon'))!;
  p.room.hitEnemy(boss, 999999, p.sp, 1, 0, 0);
  await until(
    () =>
      p.sp.data.prog.bosses.includes('primordial_dragon') && p.sp.data.inv.some((s) => s?.id === 'first_flame_ember'),
  );
  expect([...p.room.state.spells.values()].some((s) => s.kind === SPELL.ARENA)).toBe(false);
  const creds = { token: p.token, accountId: p.accountId };
  await p.r.leave();
  await sleep(300);
  const q = await spawn3(app, 'First-flame challenger', creds);
  expect(q.sp.data.prog.bosses).toContain('primordial_dragon');
  expect(q.sp.data.inv.filter((s) => s?.id === 'first_flame_ember').reduce((n, s) => n + s!.n, 0)).toBe(1);
  await q.r.leave();
}, 20000);
