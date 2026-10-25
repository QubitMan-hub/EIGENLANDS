import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ITEMS, MSG, NPCS, T, beatTimes, townFor, type FxMsg, type RhythmStartMsg } from '@eigenlands/shared';
import type { App } from '../src/app';
import {
  boot,
  count,
  flatten,
  give,
  hasToast,
  nextDay,
  setDay,
  sleep,
  slotOf,
  spawn,
  tp,
  until,
  use,
  type Probe,
} from './p2';

let app: App;
let p: Probe;
let other: Probe;
const X = 400,
  Y = 400;

beforeAll(async () => {
  app = await boot();
  p = await spawn(app, 'Angler');
  other = await spawn(app, 'Rival');
  setDay(p.room, 1, 12);
  await tp(p, X + 0.5, Y + 0.5);
  await tp(other, X + 1.5, Y + 0.5);
  flatten(p.room, X, Y, 8);
  for (let dy = -1; dy <= 1; dy++) for (let dx = 3; dx <= 4; dx++) p.room.setTile(X + dx, Y + dy, T.WATER);
});
afterAll(async () => {
  await app?.close();
});

describe('fishing', () => {
  const lastBeat = (m: RhythmStartMsg) => m.plan.startAt + m.plan.intervalMs * m.plan.count;

  it('cast -> bite -> hook -> rhythm -> a fish in the pack', async () => {
    const xp0 = p.sp.data.skills.fishing;
    const catches: FxMsg[] = [];
    p.r.onMessage(MSG.FX, (f: FxMsg) => {
      if (f.kind === 'catch') catches.push(f);
    });
    await use(p, 'rod', X + 3, Y);
    await until(() => p.casts.length > 0);
    await until(() => p.bites.length > 0, 5000);
    expect(p.bites[0].windowMs).toBe(1200);
    p.r.send(MSG.FISH_HOOK, { id: p.bites[0].id });
    await until(() => p.rhythm.length > 0);
    const start = p.rhythm[p.rhythm.length - 1] as RhythmStartMsg;
    expect(start.kind).toBe('fish');
    expect(start.plan.count).toBe(3);
    await until(() => p.room.wclock.now() >= lastBeat(start), 5000, 10);
    p.r.send(MSG.RHYTHM_DONE, { id: start.id, hits: beatTimes(start.plan) });
    await until(() => p.results.length > 0, 3000);
    const res = p.results[p.results.length - 1];
    expect(res.ok).toBe(true);
    expect(catches.some((f) => f.id === p.sp.id && f.weapon === 'rod')).toBe(true);
    expect(ITEMS[res.item.id]!.kind).toBe('fish');
    expect(res.item.n).toBe(2); // near-perfect timing doubles the catch
    expect(p.sp.data.skills.fishing).toBeGreaterThan(xp0);
    expect(p.sp.data.inv.some((s) => s?.id === res.item.id && s!.n >= 2)).toBe(true);
  });

  it('a missed rhythm loses the fish; ignoring the bite lets it go; hooking early spooks it', async () => {
    p.rhythm.length = 0;
    p.results.length = 0;
    p.bites.length = 0;
    await use(p, 'rod', X + 3, Y);
    await until(() => p.bites.length > 0, 5000);
    p.r.send(MSG.FISH_HOOK, { id: p.bites[0].id });
    await until(() => p.rhythm.length > 0);
    const start = p.rhythm[0] as RhythmStartMsg;
    await until(() => p.room.wclock.now() >= lastBeat(start), 5000, 10);
    p.r.send(MSG.RHYTHM_DONE, { id: start.id, hits: [] });
    await until(() => p.results.length > 0);
    expect(p.results[0].ok).toBe(false);

    // ignore the bite: it gets away after the window
    p.bites.length = 0;
    await use(p, 'rod', X + 3, Y);
    await until(() => p.bites.length > 0, 5000);
    const from = p.toasts.length;
    await until(() => p.sp.cast === null, 3000);
    // Server state can clear before the toast arrives over the socket.
    await until(() => hasToast(p, /got away/, from));
    expect(hasToast(p, /got away/, from)).toBe(true);

    // early hook
    p.casts.length = 0;
    await use(p, 'rod', X + 3, Y);
    await until(() => p.casts.length > 0);
    p.r.send(MSG.FISH_HOOK, { id: p.casts[0].id });
    await sleep(100);
    expect(p.sp.cast).toBeNull();
  });

  it('land is not water, far water is out of reach, walking away reels in', async () => {
    const from = p.toasts.length;
    await use(p, 'rod', X + 1, Y + 1, 120);
    expect(hasToast(p, /open water/, from)).toBe(true);
    await use(p, 'rod', X + 3, Y);
    await until(() => p.sp.cast !== null);
    await tp(p, X + 0.5, Y + 12.5);
    await until(() => p.sp.cast === null, 2000);
    await tp(p, X + 0.5, Y + 0.5);
  });
});

describe('chests, shelters, signs', () => {
  it('a chest stores items for its owner only and can be taken back when empty', async () => {
    await give(p, 'chest', 1);
    await use(p, 'chest', X - 1, Y);
    expect(p.room.store.objectAt(X - 1, Y)?.kind).toBe('chest');
    await give(p, 'stone', 20);
    p.r.send(MSG.OPEN, { tx: X - 1, ty: Y });
    await until(() => p.panels.some((m) => m.kind === 'chest'));
    p.r.send(MSG.CHEST, { tx: X - 1, ty: Y, action: 'put', slot: slotOf(p, 'stone'), n: 15 });
    await until(() => p.panels.filter((m) => m.kind === 'chest').length >= 2);
    const panel = p.panels[p.panels.length - 1];
    expect(panel.chest.find((s: any) => s?.id === 'stone').n).toBe(15);
    expect(count(p, 'stone')).toBeGreaterThanOrEqual(5);
    // a stranger gets nothing
    const fromO = other.toasts.length;
    other.r.send(MSG.OPEN, { tx: X - 1, ty: Y });
    other.r.send(MSG.CHEST, { tx: X - 1, ty: Y, action: 'take', slot: 0, n: 5 });
    await sleep(200);
    expect(other.panels.length).toBe(0);
    expect(hasToast(other, /isn't yours/, fromO)).toBe(true);
    // not empty: cannot dismantle
    const from = p.toasts.length;
    await use(p, 'axe', X - 1, Y, 120);
    expect(hasToast(p, /Empty the chest/, from)).toBe(true);
    p.r.send(MSG.CHEST, { tx: X - 1, ty: Y, action: 'take', slot: 0, n: 99 });
    await sleep(150);
    await until(() => !(p.room.store.objectAt(X - 1, Y)!.data!.slots as any[]).some(Boolean));
    const chests = count(p, 'chest');
    await use(p, 'axe', X - 1, Y, 120);
    expect(p.room.store.objectAt(X - 1, Y)).toBeUndefined();
    expect(count(p, 'chest')).toBe(chests + 1);
  });

  it('a coop makes eggs only when fed, collected at dawn', async () => {
    await give(p, 'coop', 1);
    await use(p, 'coop', X - 1, Y - 1);
    const coop = () => p.room.store.objectAt(X - 1, Y - 1)!.data as any;
    await give(p, 'chicken', 2);
    p.r.send(MSG.SHELTER, { tx: X - 1, ty: Y - 1, action: 'add' });
    p.r.send(MSG.SHELTER, { tx: X - 1, ty: Y - 1, action: 'add' });
    await until(() => coop().animals === 2);
    // unfed -> nothing the next day
    await nextDay(p.room);
    expect(coop().ready).toBe(0);
    // feeding needs hay for each animal
    const from = p.toasts.length;
    p.r.send(MSG.SHELTER, { tx: X - 1, ty: Y - 1, action: 'feed' });
    await sleep(150);
    expect(hasToast(p, /hay/, from)).toBe(true);
    await give(p, 'hay', 4);
    p.r.send(MSG.SHELTER, { tx: X - 1, ty: Y - 1, action: 'feed' });
    await until(() => coop().fed === true);
    expect(count(p, 'hay')).toBe(2);
    await nextDay(p.room);
    expect(coop().ready).toBe(2);
    p.r.send(MSG.SHELTER, { tx: X - 1, ty: Y - 1, action: 'collect' });
    await until(() => count(p, 'egg') === 2);
    expect(coop().ready).toBe(0);
    // a coop holds 4 at most
    await give(p, 'chicken', 3);
    for (let i = 0; i < 3; i++) p.r.send(MSG.SHELTER, { tx: X - 1, ty: Y - 1, action: 'add' });
    await until(() => coop().animals === 4);
    await sleep(100);
    expect(count(p, 'chicken')).toBe(1);
  });

  it('town stations are usable by anyone; signs show their text', async () => {
    const town = townFor(p.room.seed);
    const st = town.objects.find((o) => o.sub === 'workbench')!;
    await tp(p, st.x + 0.5, st.y + 1.5);
    await sleep(200);
    p.panels.length = 0;
    p.r.send(MSG.OPEN, { tx: st.x, ty: st.y });
    await until(() => p.panels.length > 0);
    expect(p.panels[0]).toMatchObject({ kind: 'station', station: 'workbench' });
    await give(p, 'wood', 2);
    p.r.send(MSG.CRAFT, { station: 'workbench', recipe: 'plank', n: 1, tx: st.x, ty: st.y });
    await until(() => count(p, 'plank') >= 1);
    await tp(p, X + 0.5, Y + 0.5);
    await give(p, 'sign', 1);
    await use(p, 'sign', X, Y + 1);
    p.panels.length = 0;
    p.r.send(MSG.OPEN, { tx: X, ty: Y + 1 });
    await until(() => p.panels.length > 0);
    expect(p.panels[0].kind).toBe('sign');
  });
});

describe('inventory operations', () => {
  it('move merges or swaps, trash removes, junk is ignored', async () => {
    p.sp.data.inv.fill(null);
    p.sp.data.inv[0] = { id: 'wood', n: 10 };
    p.sp.data.inv[1] = { id: 'wood', n: 20 };
    p.sp.data.inv[2] = { id: 'stone', n: 5 };
    p.r.send(MSG.INV_MOVE, { from: 0, to: 1 });
    await until(() => p.sp.data.inv[1]?.n === 30);
    expect(p.sp.data.inv[0]).toBeNull();
    p.r.send(MSG.INV_MOVE, { from: 1, to: 2 });
    await until(() => p.sp.data.inv[2]?.id === 'wood');
    expect(p.sp.data.inv[1]?.id).toBe('stone');
    p.r.send(MSG.INV_TRASH, { slot: 2, n: 7 });
    await until(() => p.sp.data.inv[2]?.n === 23);
    for (const bad of [{ from: -1, to: 2 }, { from: 0, to: 99 }, { from: 'a', to: 1 }, null, {}])
      p.r.send(MSG.INV_MOVE, bad);
    for (const bad of [{ slot: 2, n: -5 }, { slot: 2, n: 1e9 }, { slot: 77, n: 1 }, { slot: 2 }])
      p.r.send(MSG.INV_TRASH, bad);
    await sleep(150);
    expect(p.sp.data.inv[2]?.n).toBe(23);
    // profile updates went out
    expect(p.profiles.some((m) => Array.isArray(m.inv))).toBe(true);
  });
});

describe('village wiring', () => {
  it('all settlement NPCs exist, sync to nearby clients, and TALK/SHOP are routed (only when near)', async () => {
    expect(p.room.state.npcs.size).toBe(NPCS.length);
    // far from town: ignored
    p.r.send(MSG.TALK, { npcId: 'tobin' });
    await sleep(150);
    expect(p.dialogues.length).toBe(0);
    const tobin = p.room.state.npcs.get('tobin')!;
    await tp(p, tobin.x + 1, tobin.y);
    await until(() => (p.r.state as any).npcs?.size > 0, 4000);
    p.r.send(MSG.TALK, { npcId: 'tobin' });
    await until(() => p.dialogues.length > 0, 3000);
    expect(p.dialogues[0].npcId).toBe('tobin');
    p.r.send(MSG.SHOP, { npcId: 'tobin', action: 'open' });
    await until(() => p.shopViews.length > 0, 3000);
    expect(p.shopViews[0].npcId).toBe('tobin');
    expect(p.shopViews[0].stock.length).toBeGreaterThan(0);
    p.r.send(MSG.TALK, { npcId: 'nobody' });
    p.r.send(MSG.TALK, { npcId: 42 });
    await sleep(150);
    expect(p.dialogues.length).toBe(1);
  });
});
