import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ENEMY_DEFS,
  MSG,
  MSG34,
  SEA_START,
  T,
  newPlayerSim,
  stepPlayer,
  sanitizeCmd,
  tileAt,
  type PlayerSim,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { createEnemy, stepEnemy } from '../src/game/enemies';
import { boot3, dev, sleep, spawn3, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3();
});
afterAll(async () => {
  await app?.close();
});

const isW = (seed: number, x: number, y: number) => {
  const t = tileAt(seed, x, y);
  return t === T.WATER || t === T.DEEP_WATER;
};

/** an open-sea tile whose 5x5 neighbourhood is all water, far from home */
function findSea(seed: number): { x: number; y: number } {
  for (let r = 260; r < 700; r += 7)
    for (let a = 0; a < 6.28; a += 0.05) {
      const x = Math.floor(Math.cos(a) * r),
        y = Math.floor(Math.sin(a) * r);
      let ok = true;
      for (let dy = -2; dy <= 2 && ok; dy++)
        for (let dx = -2; dx <= 14; dx++)
          if (!isW(seed, x + dx, y + dy)) {
            ok = false;
            break;
          }
      if (ok) return { x, y };
    }
  throw new Error('no open sea found');
}

describe('sea collision', () => {
  const water = (x: number, y: number) => x >= 0; // x >= 0 is sea, x < 0 is land
  const land = Object.assign((x: number, y: number) => x >= 0, { sea: (x: number, _y: number) => x < 0 });
  void water;
  it('a walker is stopped by water; a sailor by land, and cannot dash', () => {
    const walker = newPlayerSim(-3.5, 0.5);
    const sailor: PlayerSim = { ...newPlayerSim(3.5, 0.5), boat: 1 };
    const cmd = (dx: number, dash = false) => sanitizeCmd({ seq: 1, dx, dy: 0, dash });
    for (let i = 0; i < 60; i++) stepPlayer(walker, cmd(1), land);
    expect(walker.x).toBeLessThan(0);
    for (let i = 0; i < 60; i++) stepPlayer(sailor, cmd(-1), land);
    expect(sailor.x).toBeGreaterThanOrEqual(0.3);
    const s2: PlayerSim = { ...newPlayerSim(5.5, 0.5), boat: 1 };
    const ev = stepPlayer(s2, cmd(1, true), land);
    expect(ev.dashed).toBe(false);
  });
  it('sailing is faster than walking', () => {
    const open = Object.assign(() => false, { sea: () => false });
    const a = newPlayerSim(0, 0),
      b: PlayerSim = { ...newPlayerSim(0, 0), boat: 1 };
    for (let i = 0; i < 20; i++) {
      stepPlayer(a, sanitizeCmd({ seq: 1, dx: 1 }), open);
      stepPlayer(b, sanitizeCmd({ seq: 1, dx: 1 }), open);
    }
    expect(b.x).toBeGreaterThan(a.x * 1.4);
  });
});

describe('the sea', () => {
  it('lies beyond the home continent, with islands in it', () => {
    let w = 0,
      n = 0,
      land = 0;
    for (let i = 0; i < 3000; i++) {
      const r = 300 + (i % 400),
        th = i * 2.399;
      const t = tileAt(11, Math.floor(Math.cos(th) * r), Math.floor(Math.sin(th) * r));
      n++;
      if (t === T.WATER || t === T.DEEP_WATER) w++;
      else land++;
    }
    expect(w / n).toBeGreaterThan(0.5);
    expect(land).toBeGreaterThan(100);
    expect(SEA_START).toBeGreaterThan(100);
    for (let i = 0; i < 200; i++)
      expect(isW(11, Math.floor(Math.cos(i) * 60), Math.floor(Math.sin(i) * 60)) && false).toBe(false);
  });
});

describe('sloop', () => {
  let seq = 1;
  it('needs a charter and open water; boards, sails, fires cannons, and pirates and serpents live on water', async () => {
    const p: P3 = await spawn3(app, 'Skipper');
    const sea = findSea(p.room.seed);
    await tp(p, sea.x + 0.5, sea.y + 0.5);
    p.r.send(MSG34.BOARD, {});
    await sleep(200);
    expect(p.sp.sim.boat).toBe(0);
    await dev(p, { cmd: 'give', id: 'sloop', n: 1 });
    await until(() => p.sp.data.inv.some((s) => s?.id === 'sloop'), 2000);
    p.r.send(MSG34.BOARD, {});
    await until(() => p.sp.sim.boat === 1, 2000);
    await until(() => (p.sp.state.flags & 128) === 128, 2000);
    // sails east for a second
    const x0 = p.sp.sim.x;
    for (let i = 0; i < 20; i++) {
      p.r.send(MSG.INPUT, {
        cmds: [
          {
            seq: seq++,
            dx: 1,
            dy: 0,
            dash: false,
            attack: false,
            hold: false,
            skill: false,
            aimX: 1,
            aimY: 0,
            viewTick: 0,
          },
        ],
      });
      await sleep(50);
    }
    expect(p.sp.sim.x).toBeGreaterThan(x0 + 2);
    // a cannonball flies over water and hurts a pirate
    const pirate = p.room.spawnEnemy('pirate', p.sp.sim.x + 6, p.sp.sim.y, false, { level: 3 });
    const hp = pirate.hp;
    for (let i = 0; i < 4 && pirate.hp === hp; i++) {
      p.r.send(MSG.INPUT, {
        cmds: [
          {
            seq: seq++,
            dx: 0,
            dy: 0,
            dash: false,
            attack: true,
            hold: false,
            skill: false,
            aimX: 1,
            aimY: 0,
            viewTick: 0,
          },
        ],
      });
      await sleep(400);
    }
    expect(pirate.hp).toBeLessThan(hp);
    // stepping off needs a shore
    p.r.send(MSG34.BOARD, {});
    await sleep(200);
    expect(p.sp.sim.boat).toBe(1);
    await p.r.leave();
  });
});

describe('sea creatures', () => {
  it('stay on the water: land is their wall', () => {
    const land = Object.assign((x: number, _y: number) => x >= 0, { sea: (x: number, _y: number) => x >= 0 });
    expect(ENEMY_DEFS.pirate.sea && ENEMY_DEFS.serpent.sea).toBe(true);
    const e = createEnemy('serpent', -6.5, 0.5, false);
    for (let i = 0; i < 400; i++)
      stepEnemy(e, 0.05, i, [{ id: 'p', x: 8, y: 0.5, alive: true }], land, () => 0.5, { strike() {}, telegraph() {} });
    expect(e.x).toBeLessThan(0);
  });
});
