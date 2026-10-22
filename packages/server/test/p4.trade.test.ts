import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MSG, MSG34, TRADE_MAX_ITEMS } from '@eigenlands/shared';
import type { App } from '../src/app';
import { runtime34 } from '../src/features/runtime34';
import { tradeTuning } from '../src/features/social/trade';
import { bootP4, countOf, giveP4, hasSys, joinP4, lastTrade, sleep, slotOfP4, tpP4, until, waitSys, type P4 } from './p4helpers';

let app: App;
let realCommit: typeof import('../src/db/repo34').Repo34.prototype.commitTrade;
beforeAll(async () => { app = await bootP4(); realCommit = runtime34().repo34.commitTrade; });
afterAll(async () => { await app.close(); });
afterEach(() => { runtime34().repo34.commitTrade = realCommit; tradeTuning.confirmDelayMs = 0; });

const T = (p: P4, m: unknown) => p.r.send(MSG34.TRADE, m);
const leave = async (...ps: P4[]) => { for (const p of ps) await p.r.leave().catch(() => {}); await sleep(80); };

let n = 0;
/** Two players standing next to each other with an open trade. */
async function pair(o: { shard?: string; x?: number } = {}): Promise<[P4, P4]> {
  n++;
  const x = o.x ?? 0.5;
  const pos = o.shard ? { shard: o.shard, pos: [x, 4.5] as [number, number] } : {};
  const a = await joinP4(app, `TA${n}`, pos), b = await joinP4(app, `TB${n}`, o.shard ? { shard: o.shard, pos: [x + 1, 4.5] } : {});
  if (!o.shard) { await tpP4(a, x, 4.5); await tpP4(b, x + 1, 4.5); }
  T(a, { action: 'request', name: b.name });
  await until(() => b.tradeReqs.length === 1);
  T(b, { action: 'accept', id: b.tradeReqs[0]!.id });
  await until(() => !!lastTrade(a)?.id && !!lastTrade(b)?.id);
  return [a, b];
}

/** Items and coins across both players (memory). Trades must never change these totals. */
const totals = (a: P4, b: P4, id: string) => ({ items: countOf(a, id) + countOf(b, id), coins: a.sp.data.coins + b.sp.data.coins });
async function dbTotals(a: P4, b: P4, id: string) {
  let items = 0, coins = 0;
  for (const p of [a, b]) {
    const ch = await app.repo.getCharacter(p.accountId);
    const d = ch!.data as { inv: Array<{ id: string; n: number } | null>; coins: number };
    items += d.inv.reduce((s, x) => s + (x && x.id === id ? x.n : 0), 0);
    coins += d.coins;
  }
  return { items, coins };
}
const trades = async (a: P4) => (await runtime34().repo34.pool.query('SELECT * FROM trades WHERE a = $1 OR b = $1', [a.accountId])).rows;

describe('trading', () => {
  it('happy path: items and coins swap, both characters and an audit row are saved', async () => {
    const [a, b] = await pair();
    await giveP4(a, 'fiber', 20);
    const fs = slotOfP4(a, 'fiber'), axe = slotOfP4(b, 'axe');
    const fiber0 = countOf(a, 'fiber');
    const t0 = lastTrade(a)!;
    expect(t0.other).toBe(b.name);
    T(a, { action: 'offer', items: [{ slot: fs, n: 3 }], coins: 10 });
    await until(() => lastTrade(b)?.theirs?.items.length === 1 && lastTrade(b)?.theirs?.coins === 10);
    expect(lastTrade(b)!.theirs!.items[0]!.stack).toMatchObject({ id: 'fiber', n: 3 });
    T(b, { action: 'offer', items: [{ slot: axe, n: 1 }], coins: 0 });
    await until(() => lastTrade(a)?.theirs?.items.length === 1);
    T(a, { action: 'confirm' });
    await until(() => lastTrade(b)?.theirConfirm === true && lastTrade(a)?.myConfirm === true);
    T(b, { action: 'confirm' });
    await until(() => lastTrade(a)?.id === null && lastTrade(b)?.id === null);
    expect(lastTrade(a)!.reason).toBe('done');
    expect(countOf(a, 'fiber')).toBe(fiber0 - 3);
    expect(countOf(b, 'fiber')).toBe(5 + 3);
    expect(countOf(a, 'axe')).toBe(2);
    expect(countOf(b, 'axe')).toBe(0);
    expect(a.sp.data.coins).toBe(90);
    expect(b.sp.data.coins).toBe(110);
    await waitSys(a, /Trade with .* complete/);
    // persisted in the same transaction
    const chB = await app.repo.getCharacter(b.accountId);
    expect((chB!.data as any).coins).toBe(110);
    const rows = await trades(a);
    expect(rows.length).toBe(1);
    expect(rows[0].a_coins).toBe(10);
    expect(rows[0].a_items[0]).toMatchObject({ id: 'fiber', n: 3 });
    expect(rows[0].b_items[0]).toMatchObject({ id: 'axe', n: 1 });
    // the client was told about the new pack
    await until(() => a.profiles.some((p) => p.coins === 90));
    await leave(a, b);
  });

  it('any change resets both confirmations; a confirm right after a change is refused', async () => {
    const [a, b] = await pair();
    T(a, { action: 'offer', items: [{ slot: slotOfP4(a, 'fiber'), n: 1 }], coins: 0 });
    await until(() => lastTrade(b)?.theirs?.items.length === 1);
    T(a, { action: 'confirm' });
    T(b, { action: 'offer', items: [], coins: 5 });
    await until(() => lastTrade(a)?.theirs?.coins === 5);
    expect(lastTrade(a)!.myConfirm).toBe(false);
    expect(lastTrade(a)!.theirConfirm).toBe(false);
    tradeTuning.confirmDelayMs = 60_000;
    T(b, { action: 'offer', items: [], coins: 6 });
    await until(() => lastTrade(a)?.theirs?.coins === 6);
    T(a, { action: 'confirm' });
    await waitSys(a, /offer just changed/);
    expect(lastTrade(b)!.theirConfirm).toBe(false);
    // re-sending the same offer is not a change
    tradeTuning.confirmDelayMs = 0;
    T(a, { action: 'confirm' });
    await until(() => lastTrade(b)?.theirConfirm === true);
    T(b, { action: 'offer', items: [], coins: 6 });
    await sleep(150);
    expect(lastTrade(b)!.theirConfirm).toBe(true);
    T(a, { action: 'cancel' });
    await leave(a, b);
  });

  it('invalid offers are rejected whole', async () => {
    const [a, b] = await pair();
    const fs = slotOfP4(a, 'fiber');
    const bad: unknown[] = [
      { action: 'offer', items: [{ slot: fs, n: 1 }, { slot: fs, n: 1 }], coins: 0 }, // same slot twice
      { action: 'offer', items: [{ slot: fs, n: 999 }], coins: 0 },
      { action: 'offer', items: [{ slot: fs, n: 0 }], coins: 0 },
      { action: 'offer', items: [{ slot: fs, n: 1.5 }], coins: 0 },
      { action: 'offer', items: [{ slot: 29, n: 1 }], coins: 0 }, // empty slot
      { action: 'offer', items: [{ slot: 30, n: 1 }], coins: 0 },
      { action: 'offer', items: [], coins: -5 },
      { action: 'offer', items: [], coins: 1e9 },
      { action: 'offer', items: [], coins: 'lots' },
      { action: 'offer', items: new Array(TRADE_MAX_ITEMS + 1).fill(0).map((_, i) => ({ slot: i, n: 1 })), coins: 0 },
      { action: 'offer', items: 'all', coins: 0 },
    ];
    for (const m of bad) T(a, m);
    await sleep(300);
    expect(lastTrade(b)!.theirs).toEqual({ items: [], coins: 0 });
    expect(hasSys(a, /don't have that many coins/)).toBe(true);
    T(a, { action: 'cancel' });
    await leave(a, b);
  });

  it('cancel paths: cancel, decline, expired request, distance, disconnect, idle, handoff', async () => {
    // explicit cancel
    let [a, b] = await pair();
    T(b, { action: 'cancel' });
    await until(() => lastTrade(a)?.id === null);
    expect(lastTrade(a)!.reason).toMatch(/cancelled/);
    await leave(a, b);

    // decline + out of range request
    n++;
    a = await joinP4(app, `TA${n}`); b = await joinP4(app, `TB${n}`);
    await tpP4(a, 0.5, 4.5); await tpP4(b, 30.5, 4.5);
    T(a, { action: 'request', name: b.name });
    await waitSys(a, /too far away/);
    await tpP4(b, 1.5, 4.5);
    T(a, { action: 'request', name: b.name });
    await until(() => b.tradeReqs.length === 1);
    T(b, { action: 'decline', id: b.tradeReqs[0]!.id });
    await waitSys(a, /declined your trade request/);
    // expired request
    T(a, { action: 'request', name: b.name });
    await until(() => b.tradeReqs.length === 2);
    const reqs = (a.room.social.trade as any).reqs as Map<string, { exp: number }>;
    for (const r of reqs.values()) r.exp = Date.now() - 1;
    T(b, { action: 'accept', id: b.tradeReqs[1]!.id });
    await sleep(200);
    expect(b.trades.length).toBe(0);
    T(a, { action: 'request', name: 'Not Here' });
    await waitSys(a, /Not Here is not nearby/);
    await leave(a, b);

    // distance > 8
    [a, b] = await pair();
    await tpP4(b, 20.5, 4.5);
    await until(() => lastTrade(a)?.id === null, 3000);
    expect(lastTrade(a)!.reason).toMatch(/too far apart/);
    await leave(a, b);

    // disconnect
    [a, b] = await pair();
    await b.r.leave();
    await until(() => lastTrade(a)?.id === null);
    expect(lastTrade(a)!.reason).toMatch(/left/);
    await leave(a);

    // idle 2 minutes
    [a, b] = await pair();
    for (const t of ((a.room.social.trade as any).trades as Map<string, { at: number }>).values()) t.at = Date.now() - 121_000;
    await until(() => lastTrade(a)?.id === null, 3000);
    expect(lastTrade(a)!.reason).toMatch(/2 minutes/);
    await leave(a, b);

    // handoff: walking into the next region ends the trade
    [a, b] = await pair({ shard: '0,0', x: 122.5 });
    expect(a.room.shard).toBe('0,0');
    await tpP4(b, 126.5, 4.5);
    T(b, { action: 'offer', items: [], coins: 1 });
    await until(() => lastTrade(a)?.theirs?.coins === 1);
    b.r.send(MSG.DEV, { cmd: 'tp', x: 131.5, y: 4.5 });
    await until(() => b.handoffs.length > 0, 3000);
    await until(() => lastTrade(a)?.id === null);
    expect(b.sp.data.coins).toBe(100);
    await leave(a, b);
  });

  it('a full pack blocks the trade instead of losing items', async () => {
    const [a, b] = await pair();
    // fill b's pack with unstackable swords
    const free = b.sp.data.inv.filter((s) => !s).length;
    for (let i = 0; i < free; i++) b.sp.data.inv[b.sp.data.inv.indexOf(null)] = { id: 'sword', n: 1, p: { tier: 1, atk: i } };
    await giveP4(a, 'stone', 5);
    T(a, { action: 'offer', items: [{ slot: slotOfP4(a, 'stone'), n: 5 }], coins: 0 });
    await until(() => lastTrade(b)?.theirs?.items.length === 1);
    T(a, { action: 'confirm' }); T(b, { action: 'confirm' });
    await waitSys(b, /does not have room/);
    expect(lastTrade(a)!.id).not.toBeNull();
    expect(countOf(a, 'stone')).toBe(5);
    expect(countOf(b, 'stone')).toBe(0);
    T(a, { action: 'cancel' });
    await leave(a, b);
  });
});

describe('trade atomicity (no duplication, ever)', () => {
  it('trashing or moving an offered stack drops it from the offer; nothing is duplicated', async () => {
    const [a, b] = await pair();
    await giveP4(a, 'fiber', 10);
    const fs = slotOfP4(a, 'fiber');
    const before = totals(a, b, 'fiber');
    T(a, { action: 'offer', items: [{ slot: fs, n: 3 }], coins: 0 });
    await until(() => lastTrade(b)?.theirs?.items.length === 1);
    T(a, { action: 'confirm' });
    // race: trash the stack and confirm on the other side in the same breath
    const trashed = a.sp.data.inv[fs]!.n;
    a.r.send(MSG.INV_TRASH, { slot: fs, n: trashed });
    T(b, { action: 'confirm' });
    await sleep(300);
    const after = totals(a, b, 'fiber');
    expect(countOf(b, 'fiber')).toBe(5); // b received nothing
    expect(after.items).toBe(before.items - trashed); // only the trash removed fiber
    expect(after.coins).toBe(before.coins);
    expect(lastTrade(b)!.theirs!.items.length).toBe(0);
    // moving the offered stack also invalidates it
    await giveP4(a, 'fiber', 4);
    const s2 = slotOfP4(a, 'fiber');
    T(a, { action: 'offer', items: [{ slot: s2, n: 2 }], coins: 0 });
    await until(() => lastTrade(b)?.theirs?.items.length === 1);
    a.r.send(MSG.INV_MOVE, { from: s2, to: 29 });
    await until(() => lastTrade(b)?.theirs?.items.length === 0, 3000);
    await waitSys(a, /offer changed because your pack changed/);
    T(a, { action: 'cancel' });
    await leave(a, b);
  });

  it('spamming confirms and offers while the trade executes changes nothing twice', async () => {
    const [a, b] = await pair();
    await giveP4(a, 'fiber', 10);
    const fs = slotOfP4(a, 'fiber');
    const before = totals(a, b, 'fiber');
    T(a, { action: 'offer', items: [{ slot: fs, n: 2 }], coins: 30 });
    await until(() => lastTrade(b)?.theirs?.coins === 30);
    // slow DB: the commit is in flight while the spam arrives
    runtime34().repo34.commitTrade = async (t) => { await sleep(300); return realCommit.call(runtime34().repo34, t); };
    T(a, { action: 'confirm' });
    await until(() => lastTrade(b)?.theirConfirm === true);
    for (let i = 0; i < 20; i++) { T(b, { action: 'confirm' }); T(a, { action: 'confirm' }); T(a, { action: 'offer', items: [{ slot: fs, n: 5 }], coins: 50 }); T(a, { action: 'cancel' }); }
    // inventory actions are frozen during the save
    a.r.send(MSG.INV_TRASH, { slot: fs, n: 1 });
    await until(() => lastTrade(a)?.id === null && lastTrade(b)?.id === null, 4000);
    expect(lastTrade(a)!.reason).toBe('done');
    await sleep(200);
    expect(totals(a, b, 'fiber')).toEqual(before);
    expect(countOf(b, 'fiber')).toBe(5 + 2);
    expect(b.sp.data.coins).toBe(130);
    expect((await trades(a)).length).toBe(1);
    expect(await dbTotals(a, b, 'fiber')).toEqual(before);
    await leave(a, b);
  });

  it('disconnecting while the trade saves: the trade completes once, and both saved copies agree', async () => {
    const [a, b] = await pair();
    const before = totals(a, b, 'fiber');
    T(a, { action: 'offer', items: [{ slot: slotOfP4(a, 'fiber'), n: 5 }], coins: 100 });
    await until(() => lastTrade(b)?.theirs?.coins === 100);
    runtime34().repo34.commitTrade = async (t) => { await sleep(250); return realCommit.call(runtime34().repo34, t); };
    T(a, { action: 'confirm' });
    await until(() => lastTrade(b)?.theirConfirm === true);
    T(b, { action: 'confirm' });
    await sleep(30);
    await a.r.leave(); // mid-commit
    await until(() => lastTrade(b)?.id === null, 4000);
    await sleep(300);
    expect(countOf(b, 'fiber')).toBe(10);
    expect(b.sp.data.coins).toBe(200);
    // a's saved copy (written after the trade finished) has nothing left to duplicate
    const chA = await app.repo.getCharacter(a.accountId);
    expect((chA!.data as any).coins).toBe(0);
    expect((chA!.data as any).inv.some((s: any) => s?.id === 'fiber')).toBe(false);
    await leave(b);
    expect(await dbTotals(a, b, 'fiber')).toEqual(before);
  });

  it('a DB failure rolls BOTH players back and leaves no audit row', async () => {
    const [a, b] = await pair();
    await giveP4(b, 'stone', 7);
    const invA = JSON.stringify(a.sp.data.inv), invB = JSON.stringify(b.sp.data.inv);
    T(a, { action: 'offer', items: [{ slot: slotOfP4(a, 'fiber'), n: 4 }], coins: 25 });
    T(b, { action: 'offer', items: [{ slot: slotOfP4(b, 'stone'), n: 7 }], coins: 0 });
    await until(() => lastTrade(a)?.theirs?.items.length === 1 && lastTrade(b)?.theirs?.items.length === 1);
    runtime34().repo34.commitTrade = async () => { await sleep(50); throw new Error('db down'); };
    T(a, { action: 'confirm' }); T(b, { action: 'confirm' });
    await until(() => lastTrade(a)?.id === null && lastTrade(b)?.id === null, 3000);
    expect(lastTrade(a)!.reason).toMatch(/could not be saved/);
    expect(JSON.stringify(a.sp.data.inv)).toBe(invA);
    expect(JSON.stringify(b.sp.data.inv)).toBe(invB);
    expect(a.sp.data.coins).toBe(100);
    expect(b.sp.data.coins).toBe(100);
    expect((await trades(a)).length).toBe(0);
    // and the players are not left frozen
    a.r.send(MSG.INV_MOVE, { from: slotOfP4(a, 'fiber'), to: 28 });
    await until(() => a.sp.data.inv[28]?.id === 'fiber');
    await leave(a, b);
  });

  it('junk trade payloads never crash the room', async () => {
    const [a, b] = await pair();
    const junk: any[] = [null, 1, 'x', [], {}, { action: 'request' }, { action: 'request', name: {} }, { action: 'accept', id: 5 },
      { action: 'decline', id: null }, { action: 'offer' }, { action: 'offer', items: [null], coins: 0 }, { action: 'offer', items: [{ slot: '0', n: '1' }], coins: 0 },
      { action: 'offer', items: [{ slot: 0, n: 1, stack: { id: 'gold', n: 99 } }], coins: Infinity }, { action: 'confirm', extra: true }, { action: '__proto__' }];
    for (const m of junk) T(a, m);
    await sleep(300);
    expect(a.room.players.has(a.r.sessionId)).toBe(true);
    T(a, { action: 'cancel' });
    await until(() => lastTrade(b)?.id === null);
    await leave(a, b);
  });
});
