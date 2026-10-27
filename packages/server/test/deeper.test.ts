import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CURSE_ATTACK_MULT,
  MSG,
  MSG34,
  RECRUIT_TERM_MS,
  brazierName,
  cryptOf,
  cryptOrder,
  cryptPlan,
  realmNpcs,
  recruitFee,
  ruinCrypt,
  ruinOfCell,
  type CryptSite,
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

const buff = (p: P3, kind: string, secs = 60) => {
  p.sp.data.buffs[kind] = { until: p.room.wclock.now() + secs * 1000, power: 1 };
};
const step = (p: P3, over: Partial<{ dx: number; dash: boolean; sprint: boolean }>) =>
  p.sp.queue.push({
    seq: p.sp.lastSeq + 1,
    dx: 1,
    dy: 0,
    dash: false,
    sprint: false,
    attack: false,
    hold: false,
    skill: false,
    aimX: 1,
    aimY: 0,
    viewTick: 0,
    ...over,
  } as never);

describe('grave wounds', () => {
  it('a fracture stops dodging and running until a splint sets it', async () => {
    const p = await spawn3(app, 'Limper');
    await tp(p, 640.5, 640.5);
    flatten(p.room, 640, 640, 10);
    buff(p, 'fracture');
    step(p, { dash: true, sprint: true });
    await until(() => p.sp.queue.length === 0, 2000);
    expect(p.sp.sim.dashT).toBe(0);
    expect(p.sp.sim.sprint).toBe(0);
    // a splint sets it
    p.sp.data.inv[0] = { id: 'splint', n: 1 };
    p.r.send(MSG.USE, { slot: 0, tx: 641, ty: 640 });
    await until(() => !p.sp.data.buffs.fracture, 3000);
    step(p, { dash: true });
    await until(() => p.sp.queue.length === 0, 2000);
    expect(p.sp.sim.dashT).toBeGreaterThan(0);
    await p.r.leave();
  });

  it('a curse weakens blows and stops healing over time; a prayer at a shrine lifts it', async () => {
    const p = await spawn3(app, 'Hexed');
    const room = p.room as unknown as {
      outgoing: (p: unknown, base: number) => number;
      secondly: (now: number) => void;
      shrines: { touchAltar: (p: unknown, sh: unknown) => void };
    };
    const plain = room.outgoing(p.sp, 40);
    buff(p, 'curse');
    expect(room.outgoing(p.sp, 40)).toBe(Math.max(1, Math.round(plain * CURSE_ATTACK_MULT)));
    // regeneration does nothing while cursed
    p.sp.hp = 10;
    buff(p, 'regen');
    for (let i = 0; i < 6; i++) room.secondly(Date.now());
    expect(p.sp.hp).toBe(10);
    room.shrines.touchAltar(p.sp, {});
    expect(p.sp.data.buffs.curse).toBeUndefined();
    await until(() => p.toasts.some((t) => /curse lifts/.test(t.text)), 3000);
    for (let i = 0; i < 6; i++) room.secondly(Date.now());
    expect(p.sp.hp).toBeGreaterThan(10);
    await p.r.leave();
  });
});

describe('hirelings', () => {
  it('a contract can be extended an hour at a time, up to three hours ahead, and the hireling grows seasoned', async () => {
    const p = await spawn3(app, 'Paymaster');
    await setLevel(p, 6);
    const guard = realmNpcs().find((n) => n.role === 'guard' && !p.room.shadows.employerOf(n.id))!;
    p.sp.data.friends[guard.id] = { pts: 2000 } as never;
    p.sp.data.coins = 5000;
    expect(p.room.shadows.hire(p.sp, guard.id)).toMatch(/coins it is/);
    await until(() => !!p.room.shadows.stateOf(p.sid)?.data.roster.some((r) => r.npc === guard.id), 3000);
    const rec = p.room.shadows.stateOf(p.sid)!.data.roster.find((r) => r.npc === guard.id)!;
    const until0 = rec.contractUntil!,
      level0 = rec.level,
      coins0 = p.sp.data.coins;
    const fee = recruitFee(guard.role, p.sp.level);
    p.r.send(MSG34.SHADOW_CMD, { act: 'extend', id: rec.id });
    await until(() => rec.contractUntil! > until0, 3000);
    expect(rec.contractUntil! - until0).toBe(RECRUIT_TERM_MS);
    expect(p.sp.data.coins).toBe(coins0 - fee);
    expect(rec.level).toBe(level0 + 1);
    p.r.send(MSG34.SHADOW_CMD, { act: 'extend', id: rec.id });
    await until(() => rec.contractUntil! > until0 + RECRUIT_TERM_MS, 3000);
    // three hours paid ahead is the most
    p.r.send(MSG34.SHADOW_CMD, { act: 'extend', id: rec.id });
    await until(() => p.toasts.some((t) => /paid up for long enough/.test(t.text)), 3000);
    expect(p.sp.data.coins).toBe(coins0 - 2 * fee);
    // ending now still refunds half of what is left
    p.r.send(MSG34.SHADOW_CMD, { act: 'release', id: rec.id });
    await until(() => !p.room.shadows.employerOf(guard.id), 3000);
    expect(p.sp.data.coins).toBeGreaterThan(coins0 - 2 * fee + fee);
    await p.r.leave();
  });
});

describe('camping', () => {
  it('resting in your own tent makes it your camp: you wake there when you fall', async () => {
    const p = await spawn3(app, 'Camper');
    await tp(p, 660.5, 660.5);
    flatten(p.room, 660, 660, 10);
    clearEnemies(p.room);
    p.sp.data.needs.mode = 'adventure';
    p.room.objects.put({ x: 662, y: 660, kind: 'furniture', sub: 'camp_tent', owner: p.sp.accountId, data: {} });
    // somebody else's tent will not take you
    p.room.objects.put({
      x: 662,
      y: 664,
      kind: 'furniture',
      sub: 'camp_tent',
      owner: '00000000-0000-4000-8000-000000000abc',
      data: {},
    });
    await tp(p, 661.5, 664.5);
    p.r.send(MSG.OPEN, { tx: 662, ty: 664 });
    await until(() => p.toasts.some((t) => /Ask the owner/.test(t.text)), 3000);
    await tp(p, 661.5, 660.5);
    p.r.send(MSG.OPEN, { tx: 662, ty: 660 });
    await until(() => !!p.sp.data.prog.camp, 3000);
    expect(p.sp.data.prog.camp).toEqual({ x: 662, y: 660 });
    // fall far away, wake by the tent
    await tp(p, 4.5, 9.5); // out in the open, beyond any settlement ward
    clearEnemies(p.room);
    const e = p.room.spawnEnemy('brute', p.sp.sim.x + 1, p.sp.sim.y, false);
    p.sp.invuln = 0;
    (p.room as unknown as { hurtPlayer: (...a: unknown[]) => boolean }).hurtPlayer(p.sp, 99999, e, 1, 0, 0);
    await until(() => p.sp.deadT <= 0 && Math.hypot(p.sp.sim.x - 662.5, p.sp.sim.y - 661.5) < 1, 15000);
    // and once it is struck, the camp is forgotten
    p.sp.data.inv[0] = { id: 'axe', n: 1 } as never;
    p.room.objects.remove(662, 660);
    const r = p.room as unknown as { respawn: (p: unknown) => void };
    r.respawn(p.sp);
    expect(p.sp.data.prog.camp).toBeNull();
    await p.r.leave();
  }, 30_000);
});

describe('the braziers’ riddle', () => {
  it('lit out of order the flames die; lit as the dead were laid, a hidden ossuary opens once', async () => {
    const p = await spawn3(app, 'Riddler');
    await setLevel(p, 8);
    let crypt: CryptSite | null = null;
    for (let r = 1; r < 12 && !crypt; r++)
      for (let gy = -r; gy <= r && !crypt; gy++)
        for (let gx = -r; gx <= r && !crypt; gx++) {
          const c = ruinOfCell(p.room.seed, gx, gy);
          if (c && ruinCrypt(p.room.seed, c) && p.room.owns(c.x, c.y)) crypt = cryptOf(p.room.seed, c);
        }
    expect(crypt).toBeTruthy();
    const c = crypt!;
    const plan = cryptPlan(c);
    const order = cryptOrder(p.room.seed, c);
    const light = async (i: number) => {
      const [bx, by] = plan.braziers[i]!;
      await tp(p, c.x + bx + 1.5, c.y + by + 0.5);
      await until(() => p.room.store.objectAt(c.x + bx, c.y + by)?.sub === 'trial_brazier', 4000);
      const n = p.toasts.length;
      p.r.send(MSG.OPEN, { tx: c.x + bx, ty: c.y + by });
      await until(() => p.toasts.length > n, 3000);
      return p.toasts[p.toasts.length - 1]!.text;
    };
    // the bowls stay cold until the hall has been cleared
    await light(order[0]!);
    await until(() => p.toasts.some((t) => /cold while the wardens stand/.test(t.text)), 3000);
    // (the wardens are laid to rest here without the fight: living-wild.test.ts covers the trial itself)
    p.sp.data.prog.ruins.push(`cryptclear:${c.ruin.id}`);
    const crypts = p.room.crypts as unknown as { trials: Map<string, unknown> };
    crypts.trials.clear();
    clearEnemies(p.room);
    // the wrong second flame puts them all out
    expect(await light(order[0]!)).toMatch(new RegExp(brazierName(p.room.seed, c, order[0]!)));
    expect(await light(order[2]!)).toMatch(/not the order/);
    clearEnemies(p.room);
    // the right order
    const coins = p.sp.data.coins;
    for (let k = 0; k < 4; k++) await light(order[k]!);
    expect(p.sp.data.coins).toBeGreaterThan(coins);
    expect(p.sp.data.prog.ruins).toContain(`cryptcache:${c.ruin.id}`);
    expect(await light(order[0]!)).toMatch(/shared what they kept/);
    await p.r.leave();
  }, 60_000);
});
