import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, T } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot, count, flatten, give, sleep, slotOf, spawn, tp, until, type Probe } from './p2';

let app: App;
let p: Probe;
const X = 600, Y = 600;

beforeAll(async () => {
  app = await boot();
  p = await spawn(app, 'Fuzzer', undefined, { relax: false }); // real rate limits
  await tp(p, X + 0.5, Y + 0.5);
  flatten(p.room, X, Y, 6);
});
afterAll(async () => { await app.close(); });

describe('rate limits and validation', () => {
  it('flooding USE is dropped past the burst; the server stays responsive', async () => {
    const hoe = slotOf(p, 'hoe');
    for (let i = 0; i < 120; i++) p.r.send(MSG.USE, { slot: hoe, tx: X - 2 + (i % 5), ty: Y - 2 + Math.floor(i / 5) % 4 });
    await sleep(500);
    let tilled = 0;
    for (let y = Y - 3; y <= Y + 3; y++) for (let x = X - 3; x <= X + 3; x++) if (p.room.store.getTile(x, y) === T.TILLED) tilled++;
    expect(tilled).toBeGreaterThan(0);
    expect(tilled).toBeLessThanOrEqual(10 + 6); // burst of 10 plus what 0.5 s of refill allows
  });

  it('flooding CRAFT is throttled to the bucket rate', async () => {
    await give(p, 'fiber', 120);
    await sleep(1500); // let buckets refill
    for (let i = 0; i < 40; i++) p.r.send(MSG.CRAFT, { station: 'hand', recipe: 'hay', n: 1, tx: 0, ty: 0 });
    await sleep(400);
    expect(count(p, 'hay')).toBeLessThanOrEqual(5 + 2); // 5-token burst + ~3/s * 0.4 s
    expect(count(p, 'hay')).toBeGreaterThan(0);
  });

  it('junk payloads never crash the room and do nothing', async () => {
    await sleep(1500);
    const junk: any[] = [null, undefined, 5, 'x', [], {}, { slot: 'a' }, { slot: -1, tx: 0, ty: 0 }, { slot: 0, tx: NaN, ty: 0 }, { slot: 0, tx: 1e12, ty: 0 }, { slot: 99, tx: 0, ty: 0 }];
    for (const m of junk) {
      for (const type of [MSG.USE, MSG.OPEN, MSG.CRAFT, MSG.EXPERIMENT, MSG.FORGE_START, MSG.FORGE_PREVIEW, MSG.RHYTHM_DONE, MSG.FISH_HOOK, MSG.CHEST, MSG.SHELTER, MSG.EQUIP, MSG.GIFT, MSG.SHOP, MSG.TALK, MSG.DIALOGUE_CHAT, MSG.INV_MOVE, MSG.INV_TRASH]) p.r.send(type, m);
    }
    p.r.send(MSG.CRAFT, { station: 'workbench', recipe: 'plank', n: -3, tx: 0, ty: 0 });
    p.r.send(MSG.CRAFT, { station: 'hand', recipe: 'hay', n: 9999, tx: 0, ty: 0 });
    p.r.send(MSG.CRAFT, { station: '__proto__', recipe: 'hay', n: 1, tx: 0, ty: 0 });
    p.r.send(MSG.EXPERIMENT, { station: 'hand', tx: 0, ty: 0, items: [{ slot: 0, n: 1 }, { slot: 0, n: 1 }] }); // duplicate slot
    p.r.send(MSG.EXPERIMENT, { station: 'hand', tx: 0, ty: 0, items: new Array(50).fill({ slot: 1, n: 1 }) });
    await sleep(500);
    expect(p.room.players.has(p.sid)).toBe(true);
    // and a valid action still works afterwards
    const hay0 = count(p, 'hay');
    await sleep(1200);
    p.r.send(MSG.CRAFT, { station: 'hand', recipe: 'hay', n: 1, tx: 0, ty: 0 });
    await until(() => count(p, 'hay') > hay0);
  });

  it('dead players cannot act, and reach is enforced', async () => {
    await sleep(1200);
    const hoe = slotOf(p, 'hoe');
    p.sp.deadT = 5;
    const tile0 = p.room.store.getTile(X + 2, Y - 2);
    p.r.send(MSG.USE, { slot: hoe, tx: X + 2, ty: Y - 2 });
    await sleep(150);
    expect(p.room.store.getTile(X + 2, Y - 2)).toBe(tile0);
    p.sp.deadT = 0;
    p.r.send(MSG.USE, { slot: hoe, tx: X + 30, ty: Y }); // far away
    await sleep(150);
    expect(p.room.store.getTile(X + 30, Y)).not.toBe(T.TILLED);
  });
});
