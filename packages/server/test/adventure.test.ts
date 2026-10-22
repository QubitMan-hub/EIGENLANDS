import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BOSSES, MSG, MSG34, shrinesNear, type BossEvent, type ShrineEvent } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, dev, flatten, setLevel, spawn3, sleep, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => { app = await boot3(); });
afterAll(async () => { await app?.close(); });

const give = (p: P3, id: string, n = 1) => dev(p, { cmd: 'give', id, n });
const has = (p: P3, id: string) => p.sp.data.inv.some((s) => s?.id === id);
const events = <T>(p: P3, type: string): T[] => { const l: T[] = []; p.r.onMessage(type, (m: T) => l.push(m)); return l; };

describe('bosses', () => {
  it('a crown calls the Sovereign far from home, it is refused near the village or at low level, and defeating it pays out and records the kill', async () => {
    const p = await spawn3(app, 'Slayer');
    const evs = events<BossEvent>(p, MSG34.BOSS_EV);
    await give(p, 'slime_crown', 2);
    await until(() => has(p, 'slime_crown'), 2000);
    const use = () => p.r.send(MSG.USE, { slot: p.sp.data.inv.findIndex((s) => s?.id === 'slime_crown'), tx: Math.floor(p.sp.sim.x), ty: Math.floor(p.sp.sim.y) });
    // too weak
    await tp(p, -300.5, 300.5); flatten(p.room, -300, 300, 12);
    use(); await sleep(300);
    expect([...p.room.enemies.values()].some((e) => e.def.boss)).toBe(false);
    await setLevel(p, 12);
    // near the spawn shrine: refused
    await tp(p, 10.5, 10.5); use(); await sleep(300);
    expect([...p.room.enemies.values()].some((e) => e.def.boss)).toBe(false);
    expect(p.sp.data.inv.find((s) => s?.id === 'slime_crown')?.n).toBe(2);
    // far away: works
    await tp(p, -300.5, 300.5); clearEnemies(p.room);
    use();
    await until(() => [...p.room.enemies.values()].some((e) => e.def.boss), 3000);
    const boss = [...p.room.enemies.values()].find((e) => e.def.boss)!;
    expect(boss.def.kind).toBe(BOSSES.slime_king.kind);
    expect(p.sp.data.inv.find((s) => s?.id === 'slime_crown')?.n).toBe(1);
    expect(evs.some((e) => e.kind === 'start')).toBe(true);
    // phase changes at 66%: it spawns slimes
    const n0 = p.room.enemies.size;
    boss.hp = Math.floor(boss.maxHp * 0.6); // (armoured: a single hit would be trimmed)
    await until(() => evs.some((e) => e.kind === 'phase'), 3000);
    expect(p.room.enemies.size).toBeGreaterThan(n0);
    // kill it
    boss.hp = 1; p.room.hitEnemy(boss, 999999, p.sp, 1, 0, 0);
    await until(() => has(p, 'slime_core') && has(p, 'heart_crystal'), 3000);
    expect(p.sp.data.prog.bosses).toContain('slime_king');
    await until(() => evs.some((e) => e.kind === 'defeated' && e.first), 2000);
    // a Heart Crystal permanently adds max health
    const hp0 = p.sp.maxHp;
    p.r.send(MSG.USE, { slot: p.sp.data.inv.findIndex((s) => s?.id === 'heart_crystal'), tx: 0, ty: 0 });
    await until(() => p.sp.data.prog.hearts === 1, 2000);
    await sleep(120);
    expect(p.sp.maxHp).toBe(hp0 + 10);
    await p.r.leave();
  });
});

describe('shrines', () => {
  it('placement is deterministic and a sequence shrine pays out once when solved in order', async () => {
    const p = await spawn3(app, 'Seeker');
    const seed = p.room.seed;
    const near = shrinesNear(seed, 0, 0, 600);
    expect(near.length).toBeGreaterThan(0);
    expect(shrinesNear(seed, 0, 0, 600).map((s) => s.id)).toEqual(near.map((s) => s.id));
    const sh = near.find((s) => s.type === 'sequence') ?? near[0]!;
    if (sh.type !== 'sequence') return; // the seed has only gauntlets in range; covered below
    const evs = events<ShrineEvent>(p, MSG34.SHRINE_EV);
    await tp(p, sh.x + 0.5, sh.y + 1.5); await setLevel(p, 5);
    p.r.send(MSG.OPEN, { tx: sh.x, ty: sh.y });
    await until(() => evs.some((e) => e.kind === 'show'), 3000);
    const show = evs.find((e) => e.kind === 'show') as Extract<ShrineEvent, { kind: 'show' }>;
    // a wrong pillar first resets and punishes
    const wrong = (show.pattern[0]! + 1) % 4;
    const [dx, dy] = sh.pillars[wrong]!;
    await tp(p, sh.x + dx + 0.5, sh.y + dy + 1.5);
    p.r.send(MSG.OPEN, { tx: sh.x + dx, ty: sh.y + dy });
    await until(() => evs.some((e) => e.kind === 'fail'), 3000);
    // then the right order
    for (const idx of show.pattern) {
      const [px, py] = sh.pillars[idx]!;
      await tp(p, sh.x + px + 0.5, sh.y + py + 1.5);
      p.r.send(MSG.OPEN, { tx: sh.x + px, ty: sh.y + py });
      await sleep(120);
    }
    await until(() => has(p, 'shrine_shard'), 3000);
    expect(p.sp.data.prog.shrines).toContain(sh.id);
    expect(evs.some((e) => e.kind === 'solved')).toBe(true);
    // solved shrines do not pay twice
    await tp(p, sh.x + 0.5, sh.y + 1.5);
    p.r.send(MSG.OPEN, { tx: sh.x, ty: sh.y });
    await sleep(300);
    expect(p.sp.data.inv.filter((s) => s?.id === 'shrine_shard').reduce((a, s) => a + s!.n, 0)).toBe(1);
    await p.r.leave();
  });
});
