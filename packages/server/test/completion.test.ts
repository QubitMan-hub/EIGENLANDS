import { beforeAll, afterAll, expect, it } from 'vitest';
import { MSG, MSG34, townsFor, oceanShrine, DIVE_OY, type Shrine, type ShrineEvent } from '@eigenlands/shared';
import { boot3, spawn3, tp, until, sleep, type P3 } from './p3helpers';
import type { App } from '../src/app';
let app: App;
beforeAll(async () => { app = await boot3(); });
afterAll(async () => { await app?.close(); });
async function leave(p: P3): Promise<void> { await p.r.leave(); await until(() => p.room.disposed); }
const open = (p: P3, x: number, y: number) => p.r.send(MSG.OPEN, { tx: x, ty: y });
function site(seed: number, type: string): Shrine {
  for (let gy = -12; gy <= 12; gy++) for (let gx = -12; gx <= 12; gx++) { const sh = oceanShrine(seed, gx, gy); if (sh?.type === type) return sh; }
  throw new Error(`Missing ${type} sanctuary`);
}
const safeClock = (p: P3, idx: number, safe = true) => p.room.wclock.setOffset(Math.floor(Date.now() / 4000) * 4000 + ((4 - idx + (safe ? 0 : 2)) % 4) * 1000 + 500 - Date.now());

it('stairs change collision spaces and return to the same building', async () => {
  const p = await spawn3(app, 'Floors');
  const up = townsFor(p.room.seed)[0]!.objects.find(o => o.sub === 'stairs_up')!;
  await tp(p, up.x + .5, up.y + .5); open(p, up.x, up.y);
  const to = up.data!.to as { x: number; y: number };
  await until(() => Math.abs(p.sp.sim.y - to.y) < .1);
  const down = p.room.store.objectAt(up.x, Math.floor(to.y))!;
  expect(down.sub).toBe('stairs_down'); open(p, down.x, down.y);
  await until(() => Math.abs(p.sp.sim.y - up.y - .5) < .1);
  await leave(p);
});

it('diving requires a charter and returns the traveller to a sailing sloop', async () => {
  const p = await spawn3(app, 'Diver'), sh = site(p.room.seed, 'balance');
  const x = sh.x, y = sh.y - DIVE_OY;
  await tp(p, x + .5, y + .5); open(p, x, y); await sleep(150);
  expect(p.sp.sim.y).toBe(y + .5);
  p.sp.data.inv[0] = { id: 'sloop', n: 1 }; open(p, x, y);
  await until(() => p.sp.sim.y < -100000);
  expect(p.sp.sim.boat).toBe(0); open(p, x, sh.y + 7);
  await until(() => p.sp.sim.boat === 1);
  expect(p.sp.sim.y).toBe(y + .5);
  await leave(p);
});

it('platform jumps reject dangerous timing, cross actual gaps and pay only after the full circuit', async () => {
  const p = await spawn3(app, 'Platforms'), sh = site(p.room.seed, 'platform');
  const ev: ShrineEvent[] = []; p.r.onMessage(MSG34.SHRINE_EV, e => ev.push(e));
  await tp(p, sh.x + .5, sh.y + .5); open(p, sh.x, sh.y);
  await until(() => ev.some(e => e.kind === 'trail'));
  const pattern = [3, 0, 1, 2, 3];
  // Jumps lock for thirteen simulation ticks, which need not equal 650 wall-clock ms under load.
  const startTick = p.room.state.tick; await until(() => p.room.state.tick >= startTick + 14);
  safeClock(p, 0, false); const before = p.sp.hp;
  open(p, sh.x, sh.y + 4); await until(() => p.sp.hp < before);
  expect(p.sp.data.prog.shrines).not.toContain(sh.id);
  for (let i = 0; i < 4; i++) {
    const idx = pattern[i]!, next = pattern[i + 1]!, [dx, dy] = sh.pillars[idx]!;
    safeClock(p, next); open(p, sh.x + dx, sh.y + dy);
    const [nx, ny] = sh.pillars[next]!;
    await until(() => Math.hypot(p.sp.sim.x - sh.x - nx - .5, p.sp.sim.y - sh.y - ny - .5) < .2);
    const tick = p.room.state.tick; await until(() => p.room.state.tick >= tick + 14);
  }
  await until(() => p.sp.data.prog.shrines.includes(sh.id));
  p.room.wclock.setOffset(0); await leave(p);
});

it('trap seals hurt during red phases and award their gift only after the ordered safe circuit', async () => {
  const p = await spawn3(app, 'TideTraps'), sh = site(p.room.seed, 'traps');
  const ev: ShrineEvent[] = []; p.r.onMessage(MSG34.SHRINE_EV, e => ev.push(e));
  await tp(p, sh.x + .5, sh.y + .5); open(p, sh.x, sh.y);
  await until(() => ev.some(e => e.kind === 'trail'));
  const trail = ev.find(e => e.kind === 'trail')!;
  if (trail.kind !== 'trail') throw new Error('Missing trail');
  const first = trail.pattern[0]!, [fx, fy] = sh.pillars[first]!;
  safeClock(p, first, false); const hp = p.sp.hp;
  await tp(p, sh.x + fx + .5, sh.y + fy + .5);
  await until(() => p.sp.hp < hp);
  expect(p.sp.data.prog.shrines).not.toContain(sh.id);
  for (const idx of trail.pattern) {
    safeClock(p, idx);
    const [dx, dy] = sh.pillars[idx]!;
    await tp(p, sh.x + dx + .5, sh.y + dy + .5);
    await until(() => ev.some(e => e.kind === 'hit' && e.idx === idx && e.ok));
  }
  await until(() => p.sp.data.prog.shrines.includes(sh.id));
  const coins = p.sp.data.coins;
  await tp(p, sh.x + .5, sh.y + .5); open(p, sh.x, sh.y); await sleep(150);
  expect(p.sp.data.coins).toBe(coins);
  p.room.wclock.setOffset(0); await leave(p);
});
