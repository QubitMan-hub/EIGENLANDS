import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MSG,
  OTHERWORLDS,
  chronoCode,
  chronoGate,
  isSolid,
  otherworldArena,
  otherworldArrival,
  otherworldOf,
  otherworldReturnPortal,
  realmPortals,
  tileAt,
  updraftsOf,
  type OtherworldId,
} from '@eigenlands/shared';
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

/** stand beside (x, y) on open ground and touch the prop there */
async function touch(p: P3, x: number, y: number): Promise<void> {
  const tile = (tx: number, ty: number) => p.room.store.getTile(tx, ty);
  let spot = { x: x + 1, y };
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const)
    if (!isSolid(tile(x + dx, y + dy)) && !p.room.store.objectAt(x + dx, y + dy)) {
      spot = { x: x + dx, y: y + dy };
      break;
    }
  await tp(p, spot.x + 0.5, spot.y + 0.5);
  await until(() => !!p.room.store.objectAt(x, y), 4000);
  p.r.send(MSG.OPEN, { tx: x, ty: y });
}
const lastToast = (p: P3) => p.toasts[p.toasts.length - 1]?.text ?? '';

async function enter(p: P3, w: OtherworldId): Promise<void> {
  const g = p.room.store.generation;
  const s = realmPortals(`${p.room.seed}:${g}`, (x, y) => tileAt(p.room.seed, x, y, g))[w];
  await touch(p, s.x, s.y);
  await until(() => otherworldOf(p.sp.sim.y) === w, 4000);
}

describe('the three realms', () => {
  it('a realm portal opens only at the realm’s level, and the return arch brings you home', async () => {
    const p = await spawn3(app, 'Wayfinder');
    await setLevel(p, 3);
    const g = p.room.store.generation;
    const s = realmPortals(`${p.room.seed}:${g}`, (x, y) => tileAt(p.room.seed, x, y, g)).aetheria;
    await touch(p, s.x, s.y);
    await until(() => /will not open for you yet/.test(lastToast(p)), 3000);
    expect(otherworldOf(p.sp.sim.y)).toBeNull();
    await setLevel(p, OTHERWORLDS.aetheria.level);
    await enter(p, 'aetheria');
    const a = otherworldArrival('aetheria');
    expect(Math.hypot(p.sp.sim.x - a.x, p.sp.sim.y - a.y)).toBeLessThan(0.1);
    const r = otherworldReturnPortal('aetheria');
    await touch(p, r.x, r.y);
    await until(() => otherworldOf(p.sp.sim.y) === null, 4000);
    expect(Math.hypot(p.sp.sim.x - s.x, p.sp.sim.y - s.y)).toBeLessThan(3);
    await p.r.leave();
  });

  it('Aetheria: updrafts carry you across; the eyrie’s waits for the three chimes', async () => {
    const p = await spawn3(app, 'Skyfarer');
    await setLevel(p, 10);
    await enter(p, 'aetheria');
    const ups = updraftsOf(p.room.seed);
    const plain = ups.find((u) => !u.eyrie && Math.hypot(u.x, u.y - OTHERWORLDS.aetheria.oy) < 80)!;
    await touch(p, plain.x, plain.y);
    await until(() => Math.hypot(p.sp.sim.x - plain.to.x, p.sp.sim.y - plain.to.y) < 0.1, 4000);
    const eyrie = ups.find((u) => u.eyrie)!;
    await touch(p, eyrie.x, eyrie.y);
    await until(() => /three chimes/.test(lastToast(p)), 3000);
    for (let i = 0; i < 3; i++) p.sp.data.prog.ruins.push(`aechime:${i}`);
    p.r.send(MSG.OPEN, { tx: eyrie.x, ty: eyrie.y });
    const a = otherworldArena(p.room.seed, 'aetheria');
    await until(() => Math.hypot(p.sp.sim.x - a.x, p.sp.sim.y - a.y) < a.r, 4000);
    // and the Phoenix rises in its eyrie
    await until(() => !!p.room.otherworlds.state().boss.aetheria, 8000);
    await p.r.leave();
  }, 30_000);

  it('the Umbral Abyss: the dark gnaws at you unless you carry a light', async () => {
    const p = await spawn3(app, 'Lampless');
    await setLevel(p, 12);
    await enter(p, 'umbra');
    const mod = p.room.otherworlds as unknown as { everySecond: () => void; lit: (p: unknown) => boolean };
    // find a dark spot in a tunnel: open floor with no light near
    const oy = OTHERWORLDS.umbra.oy;
    let dark: { x: number; y: number } | null = null;
    for (let x = 14; x < 40 && !dark; x++) {
      const y = oy;
      if (isSolid(p.room.store.getTile(x, y))) continue;
      await tp(p, x + 0.5, y + 0.5);
      if (!mod.lit(p.sp)) dark = { x, y };
    }
    expect(dark).toBeTruthy();
    clearEnemies(p.room);
    p.sp.data.equip.light = null;
    p.sp.hp = p.sp.maxHp;
    for (let i = 0; i < 8; i++) mod.everySecond();
    expect(p.sp.hp).toBeLessThan(p.sp.maxHp);
    // a lantern holds the dark off
    p.sp.hp = p.sp.maxHp;
    p.sp.data.equip.light = { id: 'oil_lantern', n: 1 } as never;
    for (let i = 0; i < 8; i++) mod.everySecond();
    expect(p.sp.hp).toBe(p.sp.maxHp);
    await p.r.leave();
  }, 30_000);

  it('Chronoria: rifts rewind you; the dials set to the archive’s hour open the Unwound’s court', async () => {
    const p = await spawn3(app, 'Timekeeper');
    await setLevel(p, 16);
    await enter(p, 'chronoria');
    clearEnemies(p.room);
    const mod = p.room.otherworlds as unknown as { everySecond: () => void; rewind: (p: unknown) => void };
    const start = { x: p.sp.sim.x, y: p.sp.sim.y, hp: p.sp.hp };
    for (let i = 0; i < 10; i++) mod.everySecond();
    await tp(p, start.x + 3, start.y);
    p.sp.hp = Math.max(1, Math.floor(p.sp.maxHp / 3));
    mod.rewind(p.sp);
    expect(Math.hypot(p.sp.sim.x - start.x, p.sp.sim.y - start.y)).toBeLessThan(0.1);
    expect(p.sp.hp).toBe(start.hp);
    // the dials
    const g = chronoGate(p.room.seed);
    const code = chronoCode(p.room.seed);
    await touch(p, g.gate.x, g.gate.y);
    await until(() => /gate does not move/.test(lastToast(p)), 3000);
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < code[i]!; k++) {
        await touch(p, g.dials[i]!.x, g.dials[i]!.y);
        await until(() => p.room.otherworlds.state().dials[i] === k + 1, 3000);
      }
    expect(p.room.otherworlds.state().dials).toEqual(code);
    await touch(p, g.gate.x, g.gate.y);
    const a = otherworldArena(p.room.seed, 'chronoria');
    await until(() => Math.hypot(p.sp.sim.x - a.x, p.sp.sim.y - a.y) < a.r, 4000);
    // the Unwound rises; bring it down and the realm remembers you
    await until(() => !!p.room.otherworlds.state().boss.chronoria, 8000);
    for (let i = 0; i < 20 && p.room.otherworlds.state().boss.chronoria; i++) {
      p.sp.hp = p.sp.maxHp;
      dev(p, { cmd: 'kill', d: 30 });
      await sleep(200);
    }
    await until(() => p.sp.data.prog.ruins.includes('realmboss:chronoria'), 4000);
    expect(p.sp.data.inv.some((s) => s?.id === 'unwound_gear') || p.room.objects).toBeTruthy();
    await p.r.leave();
  }, 60_000);
});
