import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG34, SPELL, type ShadowEvent, type ShadowRosterMsg } from '@eigenlands/shared';
import type { App } from '../src/app';
import { runtime34 } from '../src/features/runtime34';
import { boot3, clearEnemies, dummy, flatten, setLevel, spawn3, sleep, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => { app = await boot3(); });
afterAll(async () => { await app?.close(); });

interface Log { ev: ShadowEvent[]; roster: ShadowRosterMsg[] }
const logOf = (p: P3): Log => {
  const l: Log = { ev: [], roster: [] };
  p.r.onMessage(MSG34.SHADOW_EV, (m: ShadowEvent) => l.ev.push(m));
  p.r.onMessage(MSG34.SHADOW_ROSTER, (m: ShadowRosterMsg) => l.roster.push(m));
  return l;
};

describe('Shadow Army', () => {
  it('a defeated creature leaves a residue; the Sigil extracts it into the roster and the shadow fights for you', async () => {
    const p = await spawn3(app, 'Necro');
    const log = logOf(p);
    await tp(p, 500.5, 500.5);
    flatten(p.room, 500, 500, 10);
    p.sp.invuln = 0;
    await setLevel(p, 10);
    clearEnemies(p.room);
    p.room.rand = () => 0; // every roll succeeds

    // too early: not enough level is refused elsewhere; here we kill something
    const prey = dummy(p.room, p.sp.sim.x + 1.5, p.sp.sim.y);
    p.room.hitEnemy(prey, 9999, p.sp, 1, 0, 0);
    await until(() => [...p.room.state.spells.values()].some((s) => s.kind === SPELL.RESIDUE && s.owner === p.sid), 2000);

    p.r.send(MSG34.EXTRACT, {});
    await until(() => log.ev.some((e) => e.kind === 'channel'), 2000);
    await until(() => log.ev.some((e) => e.kind === 'extracted'), 3000);
    await until(() => p.room.state.shadows.size === 1, 2000); // level 10 has 2 slots: summoned at once
    const last = log.roster.at(-1)!;
    expect(last.roster).toHaveLength(1);
    expect(last.active).toHaveLength(1);
    expect(last.slots).toBe(2);

    // it hunts an enemy that appears nearby
    const foe = dummy(p.room, p.sp.sim.x + 3, p.sp.sim.y + 1);
    const hp0 = foe.hp;
    await until(() => foe.hp < hp0 || !p.room.enemies.has(foe.id), 8000, 50);
    expect(p.room.state.shadows.size).toBe(1);

    // saved with the character
    await p.room.shadows.save(p.sp);
    const saved = (await runtime34().repo34.loadShadows(p.accountId)) as { roster: unknown[] };
    expect(saved.roster).toHaveLength(1);
    await p.r.leave();
  });

  it('refuses extraction below the unlock level, when out of range, and cancels when you walk away', async () => {
    const p = await spawn3(app, 'Novice');
    const log = logOf(p);
    await tp(p, 540.5, 500.5);
    flatten(p.room, 540, 500, 10);
    p.sp.invuln = 0;
    clearEnemies(p.room);
    p.r.send(MSG34.EXTRACT, {});
    await until(() => log.ev.length > 0, 2000);
    expect(log.ev[0]).toMatchObject({ kind: 'failed' });

    await setLevel(p, 6);
    const prey = dummy(p.room, p.sp.sim.x + 1.2, p.sp.sim.y);
    p.room.hitEnemy(prey, 9999, p.sp, 1, 0, 0);
    await until(() => p.room.shadows.residueCount() === 1, 2000);
    p.r.send(MSG34.EXTRACT, {});
    await until(() => log.ev.some((e) => e.kind === 'channel'), 2000);
    await tp(p, p.sp.sim.x + 3, p.sp.sim.y); // walk off mid-channel
    await until(() => log.ev.some((e) => e.kind === 'failed' && e.reason === 'moved'), 3000);
    expect(p.room.state.shadows.size).toBe(0);
    await sleep(50);
    await p.r.leave();
  });

  it('shadows fall when hit hard, re-form later, and junk commands are ignored', async () => {
    const p = await spawn3(app, 'Tank');
    const log = logOf(p);
    await tp(p, 580.5, 500.5);
    flatten(p.room, 580, 500, 10);
    p.sp.invuln = 0;
    await setLevel(p, 8);
    clearEnemies(p.room);
    p.room.rand = () => 0;
    const prey = dummy(p.room, p.sp.sim.x + 1.2, p.sp.sim.y);
    p.room.hitEnemy(prey, 9999, p.sp, 1, 0, 0);
    await until(() => p.room.shadows.residueCount() === 1, 2000);
    p.r.send(MSG34.EXTRACT, {});
    await until(() => p.room.state.shadows.size === 1, 4000);

    // an enemy strike covering the shadow downs it; the shadow stays listed but is flagged down
    const striker = dummy(p.room, p.sp.sim.x + 8, p.sp.sim.y + 8);
    const sh = [...p.room.state.shadows.values()][0]!;
    p.room.shadows.strikeShadows(striker, { kind: 'circle', x: sh.x, y: sh.y, r: 2 }, 99999);
    await until(() => log.ev.some((e) => e.kind === 'fallen'), 2000);
    expect(sh.st).toBe(6);
    p.room.shadows.tick(0, 25); // let the reform timer run out
    await until(() => log.ev.some((e) => e.kind === 'reformed'), 2000);
    expect(sh.hp).toBeGreaterThan(0);

    for (const junk of [null, 5, { act: 'summon', id: {} }, { act: 'stance', stance: 'chaos' }, { act: 'rename', id: 'x', name: 5 }, { act: 'nope' }]) p.r.send(MSG34.SHADOW_CMD, junk);
    await sleep(200);
    expect(p.room.players.has(p.sid)).toBe(true);
    await p.r.leave();
  });
});
