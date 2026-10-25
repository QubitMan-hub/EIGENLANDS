import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  MSG,
  MSG34,
  NPCS,
  PORTS,
  giftTaste,
  ITEMS,
  seaCache,
  shrinesNear,
  toggleShrineLantern,
  type Shrine,
  type ShrineEvent,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, setLevel, spawn3, sleep, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3();
});
afterAll(async () => {
  await app?.close();
});
const open = (p: P3, x: number, y: number) => p.r.send(MSG.OPEN, { tx: x, ty: y });
const listen = (p: P3) => {
  const ev: ShrineEvent[] = [];
  p.r.onMessage(MSG34.SHRINE_EV, (m) => ev.push(m));
  return ev;
};
async function start(p: P3, type: Shrine['type'], ev: ShrineEvent[]) {
  const sh = shrinesNear(p.room.seed, 0, 0, 10000).find((s) => s.type === type);
  expect(sh, `seed must contain a ${type} shrine`).toBeDefined();
  await tp(p, sh!.x + 0.5, sh!.y + 1.5);
  clearEnemies(p.room);
  open(p, sh!.x, sh!.y);
  await until(() => ev.some((e) => e.kind === type), 3000);
  return sh!;
}

it('keeps a solved lantern reward safe when the bag is full and pays exactly once on retry', async () => {
  const p = await spawn3(app, 'Lantern');
  const ev = listen(p),
    sh = await start(p, 'balance', ev);
  const first = ev.find((e) => e.kind === 'balance') as Extract<ShrineEvent, { kind: 'balance' }>;
  let moves = -1;
  for (let bits = 0; bits < 16; bits++) {
    let mask = first.mask;
    for (let i = 0; i < 4; i++) if (bits & (1 << i)) mask = toggleShrineLantern(mask, i);
    if (mask === 15) {
      moves = bits;
      break;
    }
  }
  expect(moves).toBeGreaterThan(0);
  p.sp.data.inv = p.sp.data.inv.map(() => ({ id: 'stone', n: 99 }));
  const coins = p.sp.data.coins;
  for (let i = 0; i < 4; i++)
    if (moves & (1 << i)) {
      const [dx, dy] = sh.pillars[i]!;
      await tp(p, sh.x + dx + 0.5, sh.y + dy + 1.5);
      open(p, sh.x + dx, sh.y + dy);
      await sleep(100);
    }
  await until(() => p.toasts.some((t) => t.text.includes('gift is safe')));
  expect(p.sp.data.prog.shrines).not.toContain(sh.id);
  expect(p.sp.data.coins).toBe(coins);
  p.sp.data.inv.fill(null);
  await tp(p, sh.x + 0.5, sh.y + 1.5);
  open(p, sh.x, sh.y);
  await until(() => p.sp.data.prog.shrines.includes(sh.id));
  const paid = p.sp.data.coins;
  expect(paid).toBeGreaterThan(coins);
  expect(p.sp.data.inv.find((s) => s?.id === 'shrine_shard')?.n).toBe(1);
  open(p, sh.x, sh.y);
  await sleep(150);
  expect(p.sp.data.coins).toBe(paid);
  expect(p.sp.data.prog.shrines.filter((id) => id === sh.id)).toHaveLength(1);
  await p.r.leave();
});

it('advances rune trails only at the correct authoritative player position', async () => {
  const p = await spawn3(app, 'Trail');
  const ev = listen(p),
    sh = await start(p, 'trail', ev);
  const first = ev.find((e) => e.kind === 'trail') as Extract<ShrineEvent, { kind: 'trail' }>;
  const [wx, wy] = sh.pillars[(first.pattern[0]! + 1) % 4]!;
  await tp(p, sh.x + wx + 0.5, sh.y + wy + 0.5);
  await sleep(150);
  expect(ev.filter((e) => e.kind === 'hit')).toHaveLength(0);
  for (let stage = 0; stage < first.pattern.length; stage++) {
    const [dx, dy] = sh.pillars[first.pattern[stage]!]!;
    await tp(p, sh.x + dx + 0.5, sh.y + dy + 0.5);
    await until(() => ev.filter((e) => e.kind === 'hit').length >= stage + 1);
  }
  await until(() => p.sp.data.prog.shrines.includes(sh.id));
  expect(p.sp.data.inv.find((s) => s?.id === 'shrine_shard')?.n).toBe(1);
  await p.r.leave();
});

it('hires a single paid guild fighter through nearby dialogue, checks friendship and expires the contract', async () => {
  const p = await spawn3(app, 'Guild');
  await setLevel(p, 5);
  const n = NPCS.find((n) => n.settlement && n.shop)!;
  p.sp.data.coins = 500;
  expect(p.room.shadows.hire(p.sp, n.id)).toContain('friends');
  p.sp.data.friends[n.id] = { pts: 160, gifted: -1, talked: -1 };
  const hated = Object.keys(ITEMS).find((id) => giftTaste(n, id) === 'hate')!;
  expect(hated).toBeDefined();
  p.sp.data.friends[n.id]!.gifted = p.room.wclock.day();
  p.sp.data.friends[n.id]!.lastGift = hated;
  expect(p.room.shadows.hire(p.sp, n.id)).toContain('upset');
  p.sp.data.friends[n.id]!.gifted = -1;
  const state = p.room.shadows.stateOf(p.sid)!;
  expect(state.data.roster).toHaveLength(0);
  const npc = p.room.village.npc(n.id)!;
  expect(npc).toBeDefined();
  await tp(p, npc.x + 1, npc.y);
  p.r.send(MSG.TALK, { npcId: n.id, topic: 'hire' });
  await until(() => state.data.roster.some((r) => r.kind === 21));
  expect(p.sp.data.coins).toBe(250);
  const rec = state.data.roster.find((r) => r.kind === 21)!;
  expect(state.units.has(rec.id)).toBe(true);
  expect(p.room.shadows.hire(p.sp, n.id)).toContain('already');
  expect(p.sp.data.coins).toBe(250);
  await p.room.shadows.save(p.sp);
  rec.contractUntil = Date.now() - 1;
  await until(() => !state.data.roster.some((r) => r.kind === 21));
  expect(state.units.has(rec.id)).toBe(false);
  expect(p.sp.data.coins).toBe(250);
  await p.r.leave();
});

it('boards and disembarks a functional sloop beside each new settlement pier', async () => {
  const p = await spawn3(app, 'Quays');
  p.sp.data.inv[0] = { id: 'sloop', n: 1 };
  for (const port of PORTS) {
    const quay = port.cy + (port.id === 'lumenport' ? 26 : 19);
    await tp(p, port.cx + 7.5, quay + 3.5);
    p.r.send(MSG34.BOARD, {});
    await until(() => p.sp.sim.boat === 1);
    expect(p.sp.sim.x).toBeGreaterThanOrEqual(port.cx + 8);
    p.r.send(MSG34.BOARD, {});
    await until(() => p.sp.sim.boat === 0);
  }
  await p.r.leave();
});

it('replicates the actual selected tool and rejects out-of-range hotbar selections', async () => {
  const p = await spawn3(app, 'Tools');
  p.sp.data.inv[3] = { id: 'pickaxe', n: 1 };
  p.r.send(MSG.HOLD, { slot: 3 });
  await until(() => p.room.state.players.get(p.sid)?.held === 'pickaxe');
  p.r.send(MSG.HOLD, { slot: 10 });
  p.r.send(MSG.HOLD, { slot: -1 });
  p.r.send(MSG.HOLD, { slot: 1.5 });
  await sleep(150);
  expect(p.sp.heldSlot).toBe(3);
  p.sp.data.inv[3] = { id: 'stone', n: 1 };
  await until(() => p.room.state.players.get(p.sid)?.held === '');
  await p.r.leave();
});

it('sea salvage survives a full bag and cannot be claimed twice', async () => {
  const p = await spawn3(app, 'Salvage');
  let cache: ReturnType<typeof seaCache> = null;
  for (let y = -8; y <= 8 && !cache; y++) for (let x = -8; x <= 8 && !cache; x++) cache = seaCache(p.room.seed, x, y);
  expect(cache).not.toBeNull();
  const o = cache!;
  await tp(p, o.x + 0.5, o.y + 1.5);
  p.sp.data.inv = p.sp.data.inv.map(() => ({ id: 'stone', n: 99 }));
  open(p, o.x, o.y);
  await until(() => p.toasts.some((t) => t.text.includes('too full')));
  expect(p.sp.data.prog.ruins).not.toContain(o.data!.ruin);
  p.sp.data.inv.fill(null);
  open(p, o.x, o.y);
  await until(() => p.sp.data.prog.ruins.includes(String(o.data!.ruin)));
  const count = () => p.sp.data.inv.find((s) => s?.id === 'doubloon')?.n;
  const reward = count();
  expect(reward).toBeGreaterThanOrEqual(2);
  open(p, o.x, o.y);
  await sleep(150);
  expect(count()).toBe(reward);
  await p.r.leave();
});
