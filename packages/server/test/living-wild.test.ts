import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MSG,
  MSG34,
  STORY_READ,
  cryptArrival,
  cryptOf,
  cryptReliquary,
  cryptWardenSpots,
  isCryptY,
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

  it('a crypt leads down to rooms where wardens rise in the hall; clearing them opens the reliquary once', async () => {
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
    const crypt = cryptOf(p.room.seed, ru!)!;
    const door = crypt.door;
    await tp(p, door.x + 0.5, door.y + 1.5);
    await until(() => p.room.store.objectAt(door.x, door.y)?.sub === 'ruin_crypt', 4000);
    // down the steps
    p.r.send(MSG.OPEN, { tx: door.x, ty: door.y });
    const arrive = cryptArrival(crypt);
    await until(() => Math.abs(p.sp.sim.y - arrive.y) < 0.01 && Math.abs(p.sp.sim.x - arrive.x) < 0.01, 4000);
    expect(isCryptY(p.sp.sim.y)).toBe(true);
    // the reliquary is sealed until the hall is cleared
    const rel = cryptReliquary(crypt);
    await tp(p, rel.x + 0.5, rel.y - 0.5);
    await until(() => p.room.store.objectAt(rel.x, rel.y)?.sub === 'crypt_reliquary', 4000);
    p.r.send(MSG.OPEN, { tx: rel.x, ty: rel.y });
    await until(() => p.toasts.some((t) => /sealed while its wardens/.test(t.text)), 3000);
    // into the hall: the wardens rise
    const spot = cryptWardenSpots(crypt)[0]!;
    await tp(p, spot.x, spot.y + 2);
    await until(() => !!p.room.crypts.trialOf(ru!.id), 3000);
    for (let wave = 1; wave <= 3; wave++) {
      await until(() => (p.room.crypts.trialOf(ru!.id)?.wave ?? 0) >= wave, 6000);
      p.sp.hp = p.sp.maxHp;
      for (let i = 0; i < 12 && p.room.crypts.trialOf(ru!.id)?.enemies.length; i++) {
        dev(p, { cmd: 'kill', d: 30 });
        await sleep(150);
      }
    }
    await until(() => !p.room.crypts.trialOf(ru!.id), 6000);
    expect(p.sp.data.prog.ruins).toContain(`cryptclear:${ru!.id}`);
    // the reliquary opens, once
    await tp(p, rel.x + 0.5, rel.y - 0.5);
    const coins = p.sp.data.coins;
    p.r.send(MSG.OPEN, { tx: rel.x, ty: rel.y });
    await until(() => p.sp.data.coins > coins, 3000);
    expect(p.sp.data.prog.ruins).toContain(`crypt:${ru!.id}`);
    p.r.send(MSG.OPEN, { tx: rel.x, ty: rel.y });
    await until(() => p.toasts.some((t) => /open and empty/.test(t.text)), 3000);
    // walking back into the hall wakes nobody now
    await tp(p, spot.x, spot.y + 2);
    await sleep(400);
    expect(p.room.crypts.trialOf(ru!.id)).toBeNull();
    // and the stairs lead back up into the ruin
    const exit = { x: crypt.x, y: crypt.y - 2 };
    await tp(p, exit.x + 0.5, exit.y + 1.5);
    await until(() => p.room.store.objectAt(exit.x, exit.y)?.sub === 'crypt_exit', 4000);
    p.r.send(MSG.OPEN, { tx: exit.x, ty: exit.y });
    await until(() => !isCryptY(p.sp.sim.y), 4000);
    expect(Math.hypot(p.sp.sim.x - door.x, p.sp.sim.y - door.y)).toBeLessThan(3);
    await p.r.leave();
  }, 90_000);

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
