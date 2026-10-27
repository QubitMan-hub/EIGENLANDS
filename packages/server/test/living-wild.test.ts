import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MSG,
  MSG34,
  STORY_READ,
  ruinCrypt,
  ruinOfCell,
  storyOfCell,
  type RuinSite,
  type StorySite,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, dev, flatten, setLevel, sleep, spawn3, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(300);
  await app?.close();
});

const panels = (p: P3) => {
  const out: Array<{ kind: string; lore?: { title: string; pages: string[] } }> = [];
  p.r.onMessage(MSG.PANEL, (m: (typeof out)[number]) => out.push(m));
  return out;
};

describe('the living wild', () => {
  it('a story scene is read once for XP and its words are the same for everyone', async () => {
    const p = await spawn3(app, 'Reader');
    const got = panels(p);
    let s: StorySite | null = null;
    for (let r = 2; r < 12 && !s; r++)
      for (let gy = -r; gy <= r && !s; gy++)
        for (let gx = -r; gx <= r && !s; gx++) {
          const c = storyOfCell(p.room.seed, gx, gy);
          if (c && p.room.owns(c.x, c.y)) s = c;
        }
    expect(s).toBeTruthy();
    const sub = STORY_READ[s!.kind];
    await tp(p, s!.x + 0.5, s!.y + 2.5);
    const prop = await (async () => {
      for (let i = 0; i < 40; i++) {
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const o = p.room.store.objectAt(s!.x + dx, s!.y + dy);
            if (o?.sub === sub) return o;
          }
        await sleep(100);
      }
      return null;
    })();
    expect(prop).toBeTruthy();
    await tp(p, prop!.x + 0.5, prop!.y + 1.5);
    const xp = p.sp.xp;
    p.r.send(MSG.OPEN, { tx: prop!.x, ty: prop!.y });
    await until(() => got.some((m) => m.kind === 'lore'), 3000);
    const lore = got.find((m) => m.kind === 'lore')!.lore!;
    expect(lore.pages.length).toBeGreaterThan(0);
    expect(p.sp.data.prog.lore).toContain(s!.id);
    await until(() => p.sp.xp !== xp || p.sp.level > 1, 2000);
    // reading again shows the same words and pays nothing more
    const before = p.sp.data.prog.lore!.length;
    p.r.send(MSG.OPEN, { tx: prop!.x, ty: prop!.y });
    await until(() => got.filter((m) => m.kind === 'lore').length === 2, 3000);
    expect(got.filter((m) => m.kind === 'lore')[1]!.lore!.pages).toEqual(lore.pages);
    expect(p.sp.data.prog.lore!.length).toBe(before);
    await p.r.leave();
  });

  it('a crypt wakes three waves of wardens; clearing them opens the reliquary once', async () => {
    const p = await spawn3(app, 'Delver');
    await setLevel(p, 8);
    let ru: RuinSite | null = null;
    for (let r = 1; r < 10 && !ru; r++)
      for (let gy = -r; gy <= r && !ru; gy++)
        for (let gx = -r; gx <= r && !ru; gx++) {
          const c = ruinOfCell(p.room.seed, gx, gy);
          if (c && ruinCrypt(p.room.seed, c) && p.room.owns(c.x, c.y)) ru = c;
        }
    expect(ru).toBeTruthy();
    const door = ruinCrypt(p.room.seed, ru!)!;
    await tp(p, door.x + 0.5, door.y + 1.5);
    await until(() => p.room.store.objectAt(door.x, door.y)?.sub === 'ruin_crypt', 4000);
    clearEnemies(p.room);
    p.r.send(MSG.OPEN, { tx: door.x, ty: door.y });
    await until(() => !!p.room.crypts.trialOf(p.sp), 3000);
    for (let wave = 1; wave <= 3; wave++) {
      await until(() => (p.room.crypts.trialOf(p.sp)?.wave ?? 0) >= wave, 6000);
      p.sp.hp = p.sp.maxHp;
      // stand on the door, out of harm's way, and strike everything round it down
      for (let i = 0; i < 10 && p.room.crypts.trialOf(p.sp)?.enemies.length; i++) {
        dev(p, { cmd: 'kill', d: 30 });
        await sleep(150);
      }
    }
    await until(() => !p.room.crypts.trialOf(p.sp), 6000);
    expect(p.sp.data.prog.ruins).toContain(`crypt:${ru!.id}`);
    expect(p.toasts.some((t) => /reliquary opens/.test(t.text))).toBe(true);
    // once only
    p.r.send(MSG.OPEN, { tx: door.x, ty: door.y });
    await until(() => p.toasts.some((t) => /open and empty/.test(t.text)), 3000);
    expect(p.room.crypts.trialOf(p.sp)).toBeNull();
    await p.r.leave();
  }, 60_000);

  it('a bonded fox noses up forage while it follows a quiet owner', async () => {
    const p = await spawn3(app, 'Fox friend');
    await tp(p, 700.5, 600.5);
    flatten(p.room, 700, 600, 10);
    clearEnemies(p.room);
    await setLevel(p, 8);
    p.sp.data.inv.fill(null);
    p.sp.data.inv[0] = { id: 'egg', n: 2 };
    const fox = p.room.spawnEnemy('fox', p.sp.sim.x + 2, p.sp.sim.y, false);
    p.r.send(MSG34.SHADOW_CMD, { act: 'befriend', target: fox.id });
    await until(() => p.room.shadows.stateOf(p.sid)!.data.roster.length === 1, 3000);
    const rec = p.room.shadows.stateOf(p.sid)!.data.roster[0]!;
    expect(rec).toMatchObject({ kind: 15, bonded: true, name: 'Emberbrush' });
    // hurry the fox along: its next find is due now
    await until(() => p.room.shadows.stateOf(p.sid)!.units.size === 1, 3000);
    const u = [...p.room.shadows.stateOf(p.sid)!.units.values()][0] as { forageT?: number };
    u.forageT = 0.05;
    await until(() => p.sp.data.inv.some((s) => s && s.id !== 'egg'), 3000);
    expect(p.toasts.some((t) => /digs up/.test(t.text))).toBe(true);
    await p.r.leave();
  });
});
