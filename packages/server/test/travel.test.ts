import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, MSG_TRAVEL, arrivalOf, waystonesNear, type TravelEvent, type Waystone } from '@eigenlands/shared';
import type { App } from '../src/app';
import { validProg } from '../src/systems/profile';
import { boot3, clearEnemies, dev, sleep, spawn3, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await app?.close();
});

async function traveller(name: string): Promise<{ p: P3; evs: TravelEvent[]; gate: Waystone; wild: Waystone }> {
  const p = await spawn3(app, name);
  const evs: TravelEvent[] = [];
  p.r.onMessage(MSG_TRAVEL.EV, (m: TravelEvent) => evs.push(m));
  const all = waystonesNear(p.room.seed, 0, 0, 400, p.room.store.generation);
  const gate = all.find((s) => s.kind === 'gate')!;
  const wild = all
    .filter((s) => s.wild)
    .sort((a, b) => Math.hypot(a.x - gate.x, a.y - gate.y) - Math.hypot(b.x - gate.x, b.y - gate.y))[0]!;
  return { p, evs, gate, wild };
}
const at = async (p: P3, s: Waystone) => {
  const a = arrivalOf(s);
  await tp(p, a.x, a.y);
};
const ways = (p: P3) => p.sp.data.prog.ways ?? [];

describe('waystones', () => {
  it('attune on approach with rewards, then carry you between attuned stones for a fare', async () => {
    const { p, evs, gate, wild } = await traveller('Wayfarer');
    clearEnemies(p.room);
    await at(p, gate);
    await until(() => ways(p).includes(gate.id), 3000);
    expect(p.sp.data.prog.home).toBe(gate.id); // the first stone becomes the Recall home
    const coins0 = p.sp.data.coins;
    await at(p, wild);
    await until(() => ways(p).includes(wild.id), 3000);
    expect(p.sp.data.coins).toBeGreaterThan(coins0); // wild stones pay
    expect(evs.some((e) => e.kind === 'attune' && e.id === wild.id)).toBe(true);
    // an unattuned destination is refused
    await at(p, gate);
    p.r.send(MSG_TRAVEL.GO, { from: gate.id, to: 'w:999:999' });
    await sleep(300);
    expect(evs.some((e) => e.kind === 'channel')).toBe(false);
    // the journey: channel, then the jump
    const before = p.sp.data.coins;
    p.r.send(MSG_TRAVEL.GO, { from: gate.id, to: wild.id });
    await until(() => evs.some((e) => e.kind === 'arrive'), 6000);
    const a = arrivalOf(wild);
    expect(Math.hypot(p.sp.sim.x - a.x, p.sp.sim.y - a.y)).toBeLessThan(0.2);
    expect(p.sp.data.coins).toBeLessThan(before);
    await p.r.leave();
  });

  it('moving breaks the spell; travel needs you at the stone and nothing hunting you', async () => {
    const { p, evs, gate, wild } = await traveller('Stray');
    clearEnemies(p.room);
    await at(p, gate);
    await until(() => ways(p).includes(gate.id), 3000);
    await at(p, wild);
    await until(() => ways(p).includes(wild.id), 3000);
    // from somewhere that is not a stone
    await tp(p, wild.x + 20.5, wild.y + 0.5);
    p.r.send(MSG_TRAVEL.GO, { from: gate.id, to: wild.id });
    await sleep(300);
    expect(evs.some((e) => e.kind === 'channel')).toBe(false);
    // stepping away mid-channel
    await at(p, gate);
    p.r.send(MSG_TRAVEL.GO, { from: gate.id, to: wild.id });
    await until(() => evs.some((e) => e.kind === 'channel'), 2000);
    await tp(p, gate.x + 4.5, gate.y + 4.5);
    await until(() => evs.some((e) => e.kind === 'cancel'), 2000);
    await sleep(3000);
    expect(evs.some((e) => e.kind === 'arrive')).toBe(false);
    // a hostile close by
    await at(p, gate);
    const e = p.room.spawnEnemy('slime', gate.x + 3.5, gate.y + 3.5, false);
    p.r.send(MSG_TRAVEL.GO, { from: gate.id, to: wild.id });
    await until(() => p.toasts.some((t) => /hunting/.test(t.text)), 2000);
    p.room.enemies.delete(e.id);
    p.room.state.enemies.delete(e.id);
    await p.r.leave();
  });

  it('a Recall Shard brings you home and is used up', async () => {
    const { p, evs, gate } = await traveller('Homebody');
    clearEnemies(p.room);
    await at(p, gate);
    await until(() => ways(p).includes(gate.id), 3000);
    await tp(p, gate.x + 30.5, gate.y + 12.5);
    dev(p, { cmd: 'give', id: 'recall_shard', n: 1 });
    await until(() => p.sp.data.inv.some((s) => s?.id === 'recall_shard'), 2000);
    const slot = p.sp.data.inv.findIndex((s) => s?.id === 'recall_shard');
    p.r.send(MSG.USE, { slot, tx: 0, ty: 0 });
    await until(() => evs.some((e) => e.kind === 'arrive'), 8000);
    const a = arrivalOf(gate);
    expect(Math.hypot(p.sp.sim.x - a.x, p.sp.sim.y - a.y)).toBeLessThan(0.2);
    expect(p.sp.data.inv.some((s) => s?.id === 'recall_shard')).toBe(false);
    await p.r.leave();
  });
});

describe('mounts', () => {
  it('the whistle mounts and dismounts; riders show to others and are thrown when struck', async () => {
    const { p, gate } = await traveller('Rider');
    clearEnemies(p.room);
    await tp(p, gate.x + 6.5, gate.y + 8.5);
    dev(p, { cmd: 'give', id: 'horse_whistle', n: 1 });
    await until(() => p.sp.data.inv.some((s) => s?.id === 'horse_whistle'), 2000);
    const slot = p.sp.data.inv.findIndex((s) => s?.id === 'horse_whistle');
    p.r.send(MSG.USE, { slot, tx: 0, ty: 0 });
    await until(() => p.sp.sim.mount === 1, 2000);
    await until(() => p.sp.state.mount === 1, 2000);
    // a struck rider (any loss of health) is thrown
    p.sp.hp -= 1;
    await until(() => p.sp.sim.mount === 0, 2000);
    expect(p.toasts.some((t) => /thrown/.test(t.text))).toBe(true);
    // the Stag answers only a seasoned wayfarer
    dev(p, { cmd: 'give', id: 'stag_bell', n: 1 });
    await until(() => p.sp.data.inv.some((s) => s?.id === 'stag_bell'), 2000);
    p.r.send(MSG.USE, { slot: p.sp.data.inv.findIndex((s) => s?.id === 'stag_bell'), tx: 0, ty: 0 });
    await until(() => p.toasts.some((t) => /twelve waystones/.test(t.text)), 2000);
    expect(p.sp.sim.mount).toBe(0);
    await p.r.leave();
  });

  it('travel progress survives storage sanitising', () => {
    const prog = validProg({ ways: ['g:65:25', 'w:-84:58', 7], home: 'g:65:25', mounts: ['stag', 'dragon'] });
    expect(prog.ways).toEqual(['g:65:25', 'w:-84:58']);
    expect(prog.home).toBe('g:65:25');
    expect(prog.mounts).toEqual(['stag']);
  });
});

describe('ferries and the hitching post', () => {
  it('a ferry crossing between harbours plays as a voyage and lands at the far ferry', async () => {
    const { p, evs } = await traveller('Sailor');
    clearEnemies(p.room);
    const all = waystonesNear(p.room.seed, 0, 0, 1700, p.room.store.generation);
    const harbours = all.filter((s) => s.kind === 'harbor');
    const a = harbours[0],
      b = harbours.find((s) => s.net !== a?.net);
    expect(!!a && !!b).toBe(true);
    for (const s of [b!, a!]) {
      await at(p, s);
      await until(() => ways(p).includes(s.id), 4000);
    }
    p.sp.data.coins = 5000;
    p.r.send(MSG_TRAVEL.GO, { from: a!.id, to: b!.id });
    await until(() => evs.some((e) => e.kind === 'channel'), 3000);
    const ch = evs.find((e) => e.kind === 'channel') as Extract<TravelEvent, { kind: 'channel' }>;
    expect(ch.voyage?.to.name).toBe(b!.name);
    await until(() => evs.some((e) => e.kind === 'arrive'), 8000);
    const dest = arrivalOf(b!);
    expect(Math.hypot(p.sp.sim.x - dest.x, p.sp.sim.y - dest.y)).toBeLessThan(0.2);
    await p.r.leave();
  });

  it('name and feed your horse at a waystone; a fed horse runs faster', async () => {
    const { p, gate } = await traveller('Groom');
    clearEnemies(p.room);
    await at(p, gate);
    await until(() => ways(p).includes(gate.id), 3000);
    dev(p, { cmd: 'give', id: 'horse_whistle', n: 1 });
    dev(p, { cmd: 'give', id: 'hay', n: 3 });
    await until(
      () => p.sp.data.inv.some((s) => s?.id === 'hay') && p.sp.data.inv.some((s) => s?.id === 'horse_whistle'),
      2000,
    );
    p.r.send(MSG_TRAVEL.GO, { from: gate.id, rename: { kind: 'horse', name: 'Old Bess' } });
    await until(() => p.sp.data.prog.mountNames?.horse === 'Old Bess', 2000);
    p.r.send(MSG_TRAVEL.GO, { from: gate.id, rename: { kind: 'horse', name: '<b>' } });
    await sleep(200);
    expect(p.sp.data.prog.mountNames?.horse).toBe('Old Bess');
    p.r.send(MSG_TRAVEL.GO, { from: gate.id, feed: 'horse' });
    await until(() => (p.sp.data.prog.mountFed?.horse ?? 0) > p.room.wclock.now(), 2000);
    await tp(p, gate.x + 6.5, gate.y + 8.5);
    p.r.send(MSG.USE, { slot: p.sp.data.inv.findIndex((s) => s?.id === 'horse_whistle'), tx: 0, ty: 0 });
    await until(() => p.sp.sim.mount === 3, 2000); // a fed horse
    expect(p.toasts.some((t) => /Old Bess/.test(t.text))).toBe(true);
    await p.r.leave();
  });
});
