import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, MSG_TRAVEL, STABLE_FEE, T, arrivalOf, waystonesNear } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, dev, setLevel, sleep, spawn3, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(300);
  await app?.close();
});

/** a stone near the spawn, attuned by walking up to it */
async function attuneNear(p: P3) {
  const s = waystonesNear(p.room.seed, 0, 0, 300).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0]!;
  const a = arrivalOf(s);
  await tp(p, a.x, a.y);
  await until(() => (p.sp.data.prog.ways ?? []).includes(s.id), 4000);
  return s;
}

function fell(p: P3) {
  const e = p.room.spawnEnemy('brute', p.sp.sim.x + 1, p.sp.sim.y, false);
  p.sp.invuln = 0;
  (p.room as unknown as { hurtPlayer: (...a: unknown[]) => boolean }).hurtPlayer(p.sp, 99999, e, 1, 0, 0);
}

describe('death, by difficulty', () => {
  it('Hardcore leaves your pack in a satchel where you fell; you wake at your home stone and can recover it', async () => {
    const p = await spawn3(app, 'Hardy');
    await setLevel(p, 5);
    const stone = await attuneNear(p);
    p.sp.data.prog.home = stone.id;
    p.sp.data.needs.mode = 'hardcore';
    p.sp.data.coins = 400;
    await tp(p, 4.5, 9.5); // out in the open, beyond any settlement ward
    clearEnemies(p.room);
    const at = { x: Math.floor(p.sp.sim.x), y: Math.floor(p.sp.sim.y) };
    const carried = p.sp.data.inv.filter(Boolean).length;
    expect(carried).toBeGreaterThan(0);
    fell(p);
    expect(p.sp.deadT).toBeGreaterThan(0);
    expect(p.sp.data.coins).toBe(300);
    expect(p.sp.data.inv.some(Boolean)).toBe(false);
    let satchel: { x: number; y: number } | null = null;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const o = p.room.store.objectAt(at.x + dx, at.y + dy);
        if (o?.sub === 'lost_satchel') satchel = { x: o.x, y: o.y };
      }
    expect(satchel).toBeTruthy();
    // back on your feet at home
    const home = arrivalOf(stone);
    await until(() => p.sp.deadT <= 0, 15000);
    expect(Math.hypot(p.sp.sim.x - home.x, p.sp.sim.y - home.y)).toBeLessThan(0.6);
    // walk back and take everything: the satchel is gone once empty
    clearEnemies(p.room);
    await tp(p, satchel!.x + 0.5, satchel!.y + 1.5);
    for (let i = 0; i < 30; i++) {
      const o = p.room.store.objectAt(satchel!.x, satchel!.y);
      const slots = (o?.data as { slots?: Array<unknown> } | undefined)?.slots ?? [];
      const k = slots.findIndex(Boolean);
      if (k < 0) break;
      p.r.send(MSG.CHEST, { tx: satchel!.x, ty: satchel!.y, action: 'take', slot: k, n: 99 });
      await sleep(80);
    }
    await until(() => !p.room.store.objectAt(satchel!.x, satchel!.y), 4000);
    expect(p.sp.data.inv.filter(Boolean).length).toBe(carried);
    await p.r.leave();
  }, 60_000);

  it('Adventure costs a tenth of your coins; Cozy costs nothing', async () => {
    const p = await spawn3(app, 'Wary');
    await setLevel(p, 5);
    clearEnemies(p.room);
    p.sp.data.needs.mode = 'adventure';
    p.sp.data.coins = 200;
    fell(p);
    expect(p.sp.data.coins).toBe(180);
    expect(p.sp.data.inv.some(Boolean)).toBe(true);
    await until(() => p.sp.deadT <= 0, 15000);
    p.sp.data.needs.mode = 'cozy';
    fell(p);
    expect(p.sp.data.coins).toBe(180);
    await p.r.leave();
  }, 40_000);
});

describe('water and mounts', () => {
  it('a waterskin filled at a river is murky; drinking it can make you sick', async () => {
    const p = await spawn3(app, 'Drinker');
    // the nearest open water to the spawn
    let spot: { x: number; y: number } | null = null;
    for (let r = 8; r < 200 && !spot; r += 2)
      for (let a = 0; a < 6.28 && !spot; a += 0.1) {
        const x = Math.floor(Math.cos(a) * r),
          y = Math.floor(Math.sin(a) * r);
        await p.room.ensureChunk(Math.floor(x / 32), Math.floor(y / 32));
        const t = p.room.store.getTile(x, y);
        if ((t === T.WATER || t === T.DEEP_WATER) && !p.room.store.solidAt(x, y + 1)) spot = { x, y };
      }
    expect(spot).toBeTruthy();
    await tp(p, spot!.x + 0.5, spot!.y + 1.5);
    p.sp.data.inv[0] = { id: 'waterskin_empty', n: 1 };
    p.r.send(MSG.USE, { slot: 0, tx: spot!.x, ty: spot!.y });
    await until(() => p.sp.data.inv[0]?.id === 'waterskin_murky', 3000);
    p.sp.data.needs.mode = 'hardcore';
    p.sp.data.needs.water = 40;
    p.r.send(MSG.USE, { slot: 0, tx: 0, ty: 0 });
    await until(() => p.sp.data.inv[0]?.id === 'waterskin_empty', 3000);
    expect(p.sp.data.needs.water).toBeGreaterThan(60);
    await p.r.leave();
  });

  it('riding tires a mount; an exhausted mount sets you down and refuses; a stable rests it for a fee', async () => {
    const p = await spawn3(app, 'Rider');
    const stone = await attuneNear(p);
    clearEnemies(p.room);
    dev(p, { cmd: 'give', id: 'horse_whistle', n: 1 });
    await until(() => p.sp.data.inv.some((s) => s?.id === 'horse_whistle'), 3000);
    const slot = () => p.sp.data.inv.findIndex((s) => s?.id === 'horse_whistle');
    const a = arrivalOf(stone);
    await tp(p, a.x + 3, a.y + 3);
    p.r.send(MSG.USE, { slot: slot(), tx: 0, ty: 0 });
    await until(() => p.sp.sim.mount === 1, 3000);
    // a long ride: nearly spent, then a few more tiles
    p.sp.data.prog.mountWorn = { horse: 98 };
    await sleep(1200);
    await tp(p, a.x + 12, a.y + 3);
    await until(() => p.sp.sim.mount === 0, 4000);
    expect(p.toasts.some((t) => /exhausted/.test(t.text))).toBe(true);
    p.r.send(MSG.USE, { slot: slot(), tx: 0, ty: 0 });
    await until(() => p.toasts.some((t) => /worn out/.test(t.text)), 3000);
    expect(p.sp.sim.mount).toBe(0);
    // the hitching post's stable
    await tp(p, a.x, a.y);
    p.sp.data.coins = 50;
    p.r.send(MSG_TRAVEL.GO, { from: stone.id, stable: 'horse' });
    await until(() => !(p.sp.data.prog.mountWorn?.horse ?? 0), 3000);
    expect(p.sp.data.coins).toBe(50 - STABLE_FEE);
    p.r.send(MSG.USE, { slot: slot(), tx: 0, ty: 0 });
    await until(() => p.sp.sim.mount !== 0, 3000);
    await p.r.leave();
  }, 40_000);

  it('produce, protein and something hearty within half an hour leave you nourished', async () => {
    const p = await spawn3(app, 'Gourmet');
    p.sp.data.inv.fill(null);
    p.sp.data.inv[0] = { id: 'berry_jam', n: 1 };
    p.sp.data.inv[1] = { id: 'fish_fry', n: 1 };
    p.sp.data.inv[2] = { id: 'veggie_stew', n: 1 };
    p.sp.hp = Math.max(1, p.sp.maxHp - 20);
    p.sp.data.needs.food = 10;
    for (const slot of [0, 1, 2]) {
      p.r.send(MSG.USE, { slot, tx: 0, ty: 0 });
      await until(() => !p.sp.data.inv[slot], 3000);
      await sleep(450);
    }
    await until(() => p.toasts.some((t) => /balanced diet/.test(t.text)), 3000);
    expect(p.sp.data.buffs.regen?.until ?? 0).toBeGreaterThan(p.room.wclock.now() + 500_000);
    await p.r.leave();
  });
});
