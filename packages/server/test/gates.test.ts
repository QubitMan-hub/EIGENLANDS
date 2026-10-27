import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DAY_MS,
  GATE_BREAK_HOUR,
  GATE_OY,
  GATE_RANK_INFO,
  gameHour,
  gateLayout,
  gatesNear,
  isGateY,
  townAt,
  sanctuaryAt,
  type Gate,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, flatten, setLevel, sleep, spawn3, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(300);
  await app?.close();
});

/** move the world clock forward to the first moment `ok` holds */
function setClock(p: P3, ok: (t: number) => boolean): void {
  const step = DAY_MS / 96;
  let t = p.room.wclock.now();
  for (let i = 0; i < 96 * 3 && !ok(t); i++) t += step;
  expect(ok(t)).toBe(true);
  p.room.wclock.setOffset(t - Date.now());
}
type Mod = {
  state: () => { open: Array<{ id: string; state: string; shown: boolean }>; inside: number[] };
  instance: (slot: number) => { cleared: boolean; master: string | null } | undefined;
};
const mod = (p: P3) => p.room.gates as unknown as Mod;

/** a gate of rank `rank` or lower, away from towns, owned by this room, today */
function pickGate(p: P3, maxRank: number, skip: string[] = []): Gate {
  const day = p.room.wclock.day();
  const g = gatesNear(p.room.seed, day, -2000, -2000, 2000, 2000, () => true).find(
    (g) =>
      g.rank <= maxRank &&
      !skip.includes(g.id) &&
      p.room.owns(g.x, g.y) &&
      !townAt(p.room.seed, g.x, g.y) &&
      !sanctuaryAt(p.room.seed, g.x, g.y) &&
      [-12, 0, 12].every((d) => !townAt(p.room.seed, g.x + d, g.y + d)),
  );
  expect(g, 'a gate today').toBeTruthy();
  return g!;
}

describe('dungeon gates', () => {
  it('a gate in the wilds: too weak and it turns you back; strong enough, you clear it and are paid', async () => {
    const p = await spawn3(app, 'Hunter');
    await setLevel(p, 14);
    setClock(p, (t) => gameHour(t) >= 9 && gameHour(t) < 10);
    const g = pickGate(p, 1);
    const info = GATE_RANK_INFO[g.rank]!;
    // stand nearby on open ground: the gate appears
    await tp(p, g.x + 4.5, g.y + 4.5);
    flatten(p.room, g.x, g.y, 8);
    clearEnemies(p.room);
    await until(
      () =>
        mod(p)
          .state()
          .open.some((o) => o.id === g.id && o.shown),
      4000,
    );
    // too weak: pushed back
    p.sp.level = info.level - 1;
    await tp(p, g.x + 0.5, g.y + 0.5);
    await until(() => p.toasts.some((t) => /pushes you back/.test(t.text)), 3000);
    expect(isGateY(p.sp.sim.y)).toBe(false);
    // strong enough: still standing in it, you are through
    p.sp.level = 14;
    await until(() => isGateY(p.sp.sim.y), 4000);
    const L = gateLayout(p.room.seed, g.slot);
    // walk into the first hall: its pack wakes
    const hall = L.rooms[1]!;
    const before = p.room.enemies.size;
    await tp(p, L.ox + hall.x + 0.5, GATE_OY + hall.y + 0.5);
    await until(() => p.room.enemies.size > before, 3000);
    clearEnemies(p.room);
    // the master's hall
    const m = L.rooms.find((r) => r.kind === 'master')!;
    p.sp.invuln = 999;
    await tp(p, L.ox + m.x + 0.5, GATE_OY + m.y + 3.5);
    await until(() => !!mod(p).instance(g.slot)?.master, 3000);
    const master = p.room.enemies.get(mod(p).instance(g.slot)!.master!)!;
    expect(master.maxHp).toBeGreaterThan(200);
    const coins = p.sp.data.coins;
    p.room.hitEnemy(master, 1e7, p.sp, 1, 0, 0);
    await until(() => mod(p).instance(g.slot)!.cleared, 3000);
    expect(p.sp.data.coins).toBe(coins + info.coins);
    expect(p.sp.data.inv.some((s) => s?.id === info.stones.id)).toBe(true);
    expect(p.sp.data.prog.ruins).toContain(`gate:${['E', 'D', 'C', 'B', 'A', 'S'][g.rank]}`);
    expect(
      mod(p)
        .state()
        .open.find((o) => o.id === g.id)!.state,
    ).toBe('cleared');
    // the way out
    const ex = { x: L.ox + L.rooms[0]!.x + 0.5, y: GATE_OY + L.rooms[0]!.y - 2.5 };
    await tp(p, ex.x, ex.y);
    await until(() => !isGateY(p.sp.sim.y), 4000);
    expect(Math.hypot(p.sp.sim.x - g.x, p.sp.sim.y - g.y)).toBeLessThan(6);
    p.sp.invuln = 0;
    await p.r.leave();
  }, 40_000);

  it('a gate left open at dusk breaks: its monsters pour out into the world', async () => {
    const p = await spawn3(app, 'Witness');
    await setLevel(p, 40);
    setClock(p, (t) => gameHour(t) >= 15 && gameHour(t) < 16);
    const g = pickGate(p, 5);
    await tp(p, g.x + 8.5, g.y + 8.5);
    flatten(p.room, g.x, g.y, 10);
    clearEnemies(p.room);
    await until(
      () =>
        mod(p)
          .state()
          .open.some((o) => o.id === g.id && o.shown),
      4000,
    );
    setClock(p, (t) => gameHour(t) >= GATE_BREAK_HOUR && gameHour(t) < GATE_BREAK_HOUR + 1);
    await until(
      () =>
        mod(p)
          .state()
          .open.find((o) => o.id === g.id)?.state === 'broken',
      3000,
    );
    const near = [...p.room.enemies.values()].filter((e) => Math.hypot(e.x - g.x, e.y - g.y) < 8);
    expect(near.length).toBeGreaterThanOrEqual(GATE_RANK_INFO[g.rank]!.pack);
    expect(p.toasts.some((t) => /Dungeon break/.test(t.text))).toBe(true);
    await p.r.leave();
  }, 30_000);
});
