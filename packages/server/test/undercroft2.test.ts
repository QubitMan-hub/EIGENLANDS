import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  CAVE_OY,
  MSG,
  caveRegion,
  caveRegionAt,
  countItem,
  delverRounds,
  mineLineOfRegion,
  vaultLayout,
  vaultOf,
  type MineLine,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, spawn3, tp, setLevel, dev, until, sleep, clearEnemies } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 4 });
});
afterAll(async () => {
  await sleep(250);
  await app?.close();
});
const SEED = 20260101;

function findLine(): MineLine {
  for (let gy = -4; gy <= 4; gy++)
    for (let gx = -4; gx <= 4; gx++) {
      const m = mineLineOfRegion(SEED, gx, gy);
      if (m) return m;
    }
  throw Error('no mine line');
}

it('rides a haulage line by steering along the rails, stops at the buffers and steps off', async () => {
  const p = await spawn3(app, 'Hauler');
  expect(p.room.store.generation).toBe(4);
  const m = findLine(),
    cart = m.tiles[2]!;
  await tp(p, cart.x + 0.5, cart.y + 1.5);
  await p.room.ensureChunk(Math.floor(cart.x / 32), Math.floor(cart.y / 32));
  p.r.send(MSG.OPEN, { tx: cart.x, ty: cart.y });
  await until(() => p.sp.sim.cart > 0);
  expect(p.sp.sim.cart - 1).toBe(2);
  // push against the line toward the bay buffer: stops at progress 0
  const a = m.tiles[0]!,
    b = m.tiles[1]!;
  const back = { dx: a.x - b.x, dy: a.y - b.y };
  const { stepPlayer } = await import('@eigenlands/shared');
  const cmd = (dx: number, dy: number) => ({
    seq: 0,
    dx,
    dy,
    dash: false,
    attack: false,
    hold: false,
    skill: false,
    aimX: 1,
    aimY: 0,
    viewTick: 0,
  });
  for (let i = 0; i < 160; i++) stepPlayer(p.sp.sim, cmd(back.dx, back.dy), p.room.store.solidAt);
  expect(p.sp.sim.cart - 1).toBe(0);
  // across the track does nothing
  const before = p.sp.sim.cart;
  stepPlayer(p.sp.sim, cmd(back.dy, back.dx), p.room.store.solidAt);
  expect(p.sp.sim.cart).toBe(before);
  // the whole line forward ends at the face buffer
  const fwd = { dx: -back.dx, dy: -back.dy };
  for (let i = 0; i < 1200 && p.sp.sim.cart - 1 < m.len; i++) {
    const t = m.tiles[Math.min(m.len, Math.floor(p.sp.sim.cart - 1) + 1)]!,
      h = m.tiles[Math.floor(p.sp.sim.cart - 1)]!;
    stepPlayer(p.sp.sim, cmd(Math.sign(t.x - h.x) || fwd.dx, Math.sign(t.y - h.y) || fwd.dy), p.room.store.solidAt);
  }
  expect(p.sp.sim.cart - 1).toBe(m.len);
  p.r.send(MSG.OPEN, { tx: Math.floor(p.sp.sim.x), ty: Math.floor(p.sp.sim.y) });
  await until(() => p.sp.sim.cart === 0);
  expect(p.room.store.solidAt(Math.floor(p.sp.sim.x), Math.floor(p.sp.sim.y))).toBe(false);
  await p.r.leave();
});

function findVault(kind: 'sealed' | 'trial') {
  for (let gy = -4; gy <= 4; gy++)
    for (let gx = -4; gx <= 4; gx++) {
      const v = vaultOf(SEED, gx, gy);
      if (v && v.kind === kind) return v;
    }
  throw Error('no vault');
}

it('locks an echo vault until each plate ambush is cleared, then pays themed loot once', async () => {
  const p = await spawn3(app, 'Plate walker');
  await setLevel(p, 6);
  const v = findVault('trial'),
    lay = vaultLayout(v);
  await tp(p, lay.cache.x + 0.5, lay.cache.y + 2.5);
  await p.room.ensureChunk(Math.floor(lay.cache.x / 32), Math.floor(lay.cache.y / 32));
  clearEnemies(p.room);
  // locked while plates are dormant
  p.r.send(MSG.OPEN, { tx: lay.cache.x, ty: lay.cache.y });
  await sleep(150);
  expect(p.sp.data.prog.ruins.includes(`${v.id}:vault`)).toBe(false);
  for (const pl of lay.plates) {
    await tp(p, pl.x + 0.5, pl.y + 0.5);
    await until(() => p.room.enemies.size > 0, 4000);
    // still locked while the ambush stands
    p.r.send(MSG.OPEN, { tx: lay.cache.x, ty: lay.cache.y });
    await sleep(120);
    expect(p.sp.data.prog.ruins.includes(`${v.id}:vault`)).toBe(false);
    clearEnemies(p.room);
    await sleep(350);
  }
  await tp(p, lay.cache.x + 0.5, lay.cache.y + 2.5);
  p.r.send(MSG.OPEN, { tx: lay.cache.x, ty: lay.cache.y });
  await until(() => p.sp.data.prog.ruins.includes(`${v.id}:vault`), 3000);
  const theme = caveRegionAt(SEED, lay.cache.x, lay.cache.y, 4).biome;
  const metal = {
    limestone: 'coal',
    glowmoss: 'healing_herb',
    crystal: 'qubit_crystal',
    basalt: 'iron_ore',
    frost: 'silver_ore',
    drowned: 'copper_ore',
  }[theme]!;
  expect(countItem(p.sp.data.inv, metal)).toBeGreaterThan(0);
  const n = countItem(p.sp.data.inv, metal);
  p.r.send(MSG.OPEN, { tx: lay.cache.x, ty: lay.cache.y });
  await sleep(150);
  expect(countItem(p.sp.data.inv, metal)).toBe(n);
  await p.r.leave();
});

it('wakes a sealed vault guardian on the first open and releases the chest after the fight', async () => {
  const p = await spawn3(app, 'Vault breaker');
  await setLevel(p, 8);
  const v = findVault('sealed'),
    lay = vaultLayout(v);
  await tp(p, lay.cache.x + 0.5, lay.cache.y + 2.5);
  await p.room.ensureChunk(Math.floor(lay.cache.x / 32), Math.floor(lay.cache.y / 32));
  clearEnemies(p.room);
  p.r.send(MSG.OPEN, { tx: lay.cache.x, ty: lay.cache.y });
  await until(() => p.room.enemies.size > 0, 3000);
  expect(p.sp.data.prog.ruins.includes(`${v.id}:vault`)).toBe(false);
  clearEnemies(p.room);
  await sleep(300);
  p.r.send(MSG.OPEN, { tx: lay.cache.x, ty: lay.cache.y });
  await until(() => p.sp.data.prog.ruins.includes(`${v.id}:vault`), 3000);
  await p.r.leave();
});

it('answers the Deep Sigil with the boss of the arena biome', async () => {
  const p = await spawn3(app, 'Biome challenger');
  await setLevel(p, 30);
  await dev(p, { cmd: 'give', id: 'deep_sigil', n: 6 });
  await until(() => countItem(p.sp.data.inv, 'deep_sigil') === 6);
  const wanted = {
    crystal: 'geode_tyrant',
    basalt: 'cinder_wyrm',
    frost: 'rime_sovereign',
    drowned: 'tide_leviathan',
  } as const;
  const seen = new Set<string>();
  for (let gy = -8; gy <= 8; gy++)
    for (let gx = -8; gx <= 8; gx++) {
      const r = caveRegion(SEED, gx, gy, 4);
      if (r.feature !== 'arena' || !(r.biome in wanted) || seen.has(r.biome)) continue;
      seen.add(r.biome);
      await tp(p, r.x + 7.5, r.y - 4.5);
      await p.room.ensureChunk(Math.floor(r.x / 32), Math.floor(r.y / 32));
      clearEnemies(p.room);
      p.r.send(MSG.OPEN, { tx: r.x + 7, ty: r.y - 6 });
      await until(() => [...p.room.enemies.values()].some((e) => e.def.boss), 3000);
      const boss = [...p.room.enemies.values()].find((e) => e.def.boss)!;
      expect(boss.def.name.toLowerCase()).toContain(wanted[r.biome as keyof typeof wanted].split('_')[1]);
      boss.hp = boss.maxHp * 0.6;
      p.room.bosses.tick(0, 0.05);
      p.room.hitEnemy(boss, 999999, p.sp, 1, 0, 0);
      await until(() => p.sp.data.prog.bosses.includes(wanted[r.biome as keyof typeof wanted]), 3000);
    }
  expect(seen.size).toBeGreaterThanOrEqual(2);
  await p.r.leave();
});

it('adds travelling merchants with real stock and a daily round only in revision 4', async () => {
  const p = await spawn3(app, 'Customer');
  const rounds = delverRounds(SEED);
  expect(rounds.every((r) => r.camps.length === 3)).toBe(true);
  const odo = p.room.village.npc('delver_odo')!;
  expect(odo).toBeTruthy();
  const views: any[] = [];
  p.r.onMessage(MSG.SHOP_VIEW, (m) => views.push(m));
  await tp(p, odo.x + 0.8, odo.y);
  p.r.send(MSG.SHOP, { npcId: 'delver_odo', action: 'open' });
  await until(() => views.length > 0, 3000);
  expect(JSON.stringify(views[0])).toContain('pickaxe');
  expect(odo.y).toBeGreaterThan(CAVE_OY - 600);
  await p.r.leave();
});
