import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from 'colyseus';
import type { Room } from 'colyseus.js';
import {
  ATK, CRIT_MULT, ELITE, ENEMY_DEFS, MSG, T, TICK_MS, heavyHit, type FxMsg, type InputCmd,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import type { WorldRoom } from '../src/rooms/WorldRoom';
import type { ServerPlayer } from '../src/rooms/player';
import type { Enemy } from '../src/game/enemies';
import { guest, join, lastRoomId, me, resetDb, sleep, startApp, until } from './helpers';

let app: App;
const room = (): WorldRoom => matchMaker.getLocalRoomById(lastRoomId()) as unknown as WorldRoom;

let anchor: Room<any>;
// an idle client keeps the room alive between tests (a disposed room re-creating its shard lock can bounce joins)
beforeAll(async () => { await resetDb(); app = await startApp(); anchor = await join(app, (await guest(app)).token, 'Anchor'); await until(() => !!me(anchor)); });
afterAll(async () => { await anchor.leave(); await app.close(); });

interface Probe { r: Room<any>; w: WorldRoom; sp: ServerPlayer; fx: FxMsg[]; seq: number }

async function probe(name: string): Promise<Probe> {
  const r = await join(app, (await guest(app)).token, name);
  await until(() => !!me(r));
  const fx: FxMsg[] = [];
  r.onMessage(MSG.FX, (f: FxMsg) => fx.push(f));
  r.onMessage(MSG.ACK, () => {});
  r.onMessage('*', () => {});
  const w = room();
  const sp = w.players.get(r.sessionId)!;
  // a private open arena far from everyone else
  const ax = 200 + Math.floor(Math.random() * 400), ay = 200 + Math.floor(Math.random() * 400);
  await w.ensureChunk(Math.floor(ax / 32), Math.floor(ay / 32));
  for (let y = ay - 8; y <= ay + 8; y++) for (let x = ax - 10; x <= ax + 10; x++) w.store.setTile(x, y, T.GRASS);
  sp.sim.x = ax + 0.5; sp.sim.y = ay + 0.5; sp.invuln = 0;
  await sleep(TICK_MS * 2);
  return { r, w, sp, fx, seq: 1 };
}

function send(p: Probe, o: Partial<InputCmd> = {}): void {
  p.r.send(MSG.INPUT, { cmds: [{ seq: p.seq++, dx: 0, dy: 0, dash: false, attack: false, hold: false, skill: false, aimX: 0, aimY: 0, viewTick: 0, ...o }] });
}
async function ticks(p: Probe, n: number, o: Partial<InputCmd> = {}): Promise<void> {
  for (let i = 0; i < n; i++) { send(p, o); await sleep(TICK_MS); }
}
function still(e: Enemy, sight = 0.1): Enemy { e.def = { ...e.def, speed: 0, sight }; return e; }
function kill(w: WorldRoom, e: Enemy): void { w.enemies.delete(e.id); w.state.enemies.delete(e.id); }
function clear(w: WorldRoom): void { for (const e of [...w.enemies.values()]) kill(w, e); }

describe('player moves', () => {
  it('hold-release unleashes a heavy strike that staggers and hits harder than a slash', async () => {
    const p = await probe('Heavy');
    const e = still(p.w.spawnEnemy('slime', p.sp.sim.x + 1.6, p.sp.sim.y, false));
    e.resist = 0; e.maxHp = e.hp = 500;
    send(p, { attack: true, hold: true, aimX: 1 });
    await ticks(p, 22, { hold: true, aimX: 1 });
    expect(p.sp.sim.charge).toBeGreaterThan(0.3);
    const hp0 = e.hp;
    await ticks(p, 3, { hold: false, aimX: 1 });
    await until(() => e.hp < hp0, 2000);
    const dealt = hp0 - e.hp;
    expect(dealt).toBeGreaterThanOrEqual(heavyHit(0).damage);
    expect(e.mode).toBe('stagger');
    await until(() => p.fx.some((f) => f.kind === 'hit' && f.id === e.id && (f.w ?? 0) >= 2), 1500);
    kill(p.w, e);
    await p.r.leave();
  });

  it('crits multiply damage and are reported; a phase slip makes the next swing a guaranteed critical counter', async () => {
    const p = await probe('Critter');
    const e = still(p.w.spawnEnemy('slime', p.sp.sim.x + 1, p.sp.sim.y, false));
    e.resist = 0; e.maxHp = e.hp = 500; e.maxPoise = e.poise = 999;
    p.w.rand = () => 0.99; // no random crits
    p.sp.sim.slipT = 1.2;
    let hp0 = e.hp;
    send(p, { attack: true, aimX: 1 });
    await until(() => e.hp < hp0, 2000);
    expect(hp0 - e.hp).toBe(Math.round(8 * CRIT_MULT));
    expect(p.sp.sim.slipT).toBe(0);
    await until(() => p.fx.some((f) => f.kind === 'hit' && f.c === 1), 1500);
    await ticks(p, 12);
    hp0 = e.hp;
    p.w.rand = () => 0; // forced random crit
    send(p, { attack: true, aimX: 1 });
    await until(() => e.hp < hp0, 2000);
    expect(hp0 - e.hp).toBe(Math.round(9 * CRIT_MULT));
    p.w.rand = Math.random;
    kill(p.w, e);
    await p.r.leave();
  });

  it('knockback into a wall slams for bonus damage', async () => {
    const p = await probe('Slammer');
    const x = Math.floor(p.sp.sim.x), y = Math.floor(p.sp.sim.y);
    for (let dy = -3; dy <= 3; dy++) p.w.store.setTile(x + 3, y + dy, T.ROCK);
    const e = still(p.w.spawnEnemy('slime', p.sp.sim.x + 1.4, p.sp.sim.y, false));
    e.maxHp = e.hp = 500;
    p.w.rand = () => 0.99;
    for (let i = 0; i < 3; i++) { send(p, { attack: true, aimX: 1 }); await ticks(p, 12); }
    await until(() => p.fx.some((f) => f.kind === 'slam' && f.id === e.id), 2000);
    p.w.rand = Math.random;
    kill(p.w, e);
    await p.r.leave();
  });
});

describe('poise and armour', () => {
  it('light hits barely dent an armoured brute; a finisher breaks poise only once it is worn down; staggering interrupts the windup', async () => {
    const p = await probe('Breaker');
    const b = still(p.w.spawnEnemy('brute', p.sp.sim.x + 1.2, p.sp.sim.y, false));
    b.resist = 0; b.maxHp = b.hp = 999;
    p.w.rand = () => 0.99;
    const hp0 = b.hp;
    send(p, { attack: true, aimX: 1 });
    await until(() => b.hp < hp0, 2000);
    expect(hp0 - b.hp).toBe(Math.round(8 * 0.6));
    expect(b.poise).toBe(b.maxPoise);
    expect(b.flinchT).toBe(0);
    // windup, then hit it with weight >= 1 until poise breaks
    b.mode = 'windup'; b.atk = ATK.SLAM; b.t = 5; b.poise = 10; b.poiseT = 0;
    await ticks(p, 8);
    send(p, { attack: true, aimX: 1 });
    await ticks(p, 8);
    send(p, { attack: true, aimX: 1 }); // finisher (weight 1)
    await until(() => b.mode === 'stagger', 2000);
    expect(b.state.tele).toBe(0);
    await until(() => p.fx.some((f) => f.kind === 'stagger' && f.id === b.id), 1500);
    p.w.rand = Math.random;
    kill(p.w, b);
    await p.r.leave();
  });
});

describe('perfect dodge', () => {
  it('dashing into a strike: no damage, phase slip, refunded dash, nearby enemies slowed', async () => {
    const p = await probe('Slipper');
    const e = p.w.spawnEnemy('slime', p.sp.sim.x + 2, p.sp.sim.y, false);
    e.def = { ...e.def, speed: 0, strikeRange: 8, windup: 0.6 };
    await until(() => e.mode === 'windup' && e.t < 0.1, 4000, 5);
    send(p, { dash: true, dy: 1 });
    await until(() => e.mode === 'recover', 2000, 5);
    await sleep(100);
    expect(p.sp.hp).toBe(p.sp.maxHp);
    expect(p.sp.sim.slipT).toBeGreaterThan(0);
    expect(p.sp.sim.dashN).toBe(2);
    expect(e.slowT).toBeGreaterThan(0);
    await until(() => p.fx.some((f) => f.kind === 'perfect' && f.id === p.r.sessionId), 1000);
    kill(p.w, e);
    await p.r.leave();
  });

  it('defender lag compensation: a lagged client that dashed before it SAW the strike land is not hit', async () => {
    const p = await probe('Laggard');
    const e = p.w.spawnEnemy('slime', p.sp.sim.x + 2, p.sp.sim.y, false);
    e.def = { ...e.def, speed: 0, strikeRange: 8, windup: 0.6 };
    const lag = 4; // 200 ms behind: ~150 ms ping plus interpolation
    // stream inputs whose viewTick trails the server by `lag` ticks
    const stream = (o: Partial<InputCmd> = {}) => send(p, { viewTick: p.w.state.tick - lag, ...o });
    await until(() => { stream(); return e.mode === 'windup'; }, 4000, TICK_MS);
    // wait until the strike already happened on the server, then dash: the client is still seeing the windup
    await until(() => { stream(); return e.mode === 'recover'; }, 3000, TICK_MS);
    stream({ dash: true, dy: 1 });
    for (let i = 0; i < 8; i++) { stream(); await sleep(TICK_MS); }
    expect(p.sp.hp).toBe(p.sp.maxHp);
    kill(p.w, e);
    // control: same lag, no dash -> hit
    const e2 = p.w.spawnEnemy('slime', p.sp.sim.x + 2, p.sp.sim.y, false);
    e2.def = { ...e2.def, speed: 0, strikeRange: 8, windup: 0.6 };
    await sleep(600);
    await until(() => { stream(); return p.sp.hp < p.sp.maxHp; }, 4000, TICK_MS);
    kill(p.w, e2);
    await p.r.leave();
  });
});

describe('new enemies', () => {
  it('a Phase Wisp telegraphs, fires a slow orb that hits a player standing still', async () => {
    const p = await probe('Target');
    clear(p.w);
    const wsp = p.w.spawnEnemy('wisp', p.sp.sim.x + 5, p.sp.sim.y, false);
    wsp.def = { ...wsp.def, speed: 0 };
    await until(() => wsp.mode === 'windup', 3000);
    expect(wsp.atk).toBe(ATK.ORB);
    await until(() => p.fx.some((f) => f.kind === 'orb'), 3000);
    await until(() => p.sp.hp < p.sp.maxHp, 3000);
    expect(p.sp.maxHp - p.sp.hp).toBe(ENEMY_DEFS.wisp.damage);
    kill(p.w, wsp);
    await p.r.leave();
  });

  it('a melee swing bats an orb back and the reflected orb hurts the wisp', async () => {
    const p = await probe('Batter');
    clear(p.w);
    const wsp = p.w.spawnEnemy('wisp', p.sp.sim.x + 5, p.sp.sim.y, false);
    wsp.def = { ...wsp.def, speed: 0 };
    wsp.maxHp = wsp.hp = 200;
    await until(() => p.w.projectiles.size > 0, 4000, 5);
    const pr = [...p.w.projectiles.values()][0]!;
    await until(() => Math.hypot(pr.x - p.sp.sim.x, pr.y - p.sp.sim.y) < 1.6, 3000, 5);
    p.sp.invuln = 1;
    send(p, { attack: true, aimX: 1, viewTick: p.w.state.tick });
    await until(() => p.fx.some((f) => f.kind === 'reflect'), 1500);
    await until(() => wsp.hp < 200, 3000);
    kill(p.w, wsp);
    await p.r.leave();
  });

  it('a brute telegraphs a charge lane and crashes into a wall, staggering itself', async () => {
    const p = await probe('Matador');
    clear(p.w);
    const x = Math.floor(p.sp.sim.x), y = Math.floor(p.sp.sim.y);
    for (let dy = -4; dy <= 4; dy++) p.w.store.setTile(x - 2, y + dy, T.ROCK);
    const b = p.w.spawnEnemy('brute', p.sp.sim.x + 5, p.sp.sim.y, false);
    await until(() => b.mode === 'windup', 3000);
    expect(b.atk).toBe(ATK.CHARGE);
    expect(b.state.atk).toBe(ATK.CHARGE);
    p.sp.invuln = 10; // stand in the lane, the brute runs through into the wall
    await until(() => b.mode === 'charge', 3000, 5);
    await until(() => b.mode === 'stagger', 3000, 5);
    await until(() => p.fx.some((f) => f.kind === 'crash' && f.id === b.id), 1000);
    kill(p.w, b);
    await p.r.leave();
  });

  it('enemies never stack and at most two commit to attacking the same player', async () => {
    const p = await probe('Mobbed');
    clear(p.w);
    p.sp.invuln = 99;
    const es = [0, 1, 2, 3, 4].map((i) => p.w.spawnEnemy('slime', p.sp.sim.x + 3 + i * 0.05, p.sp.sim.y + 0.05 * i, false));
    let maxEngaged = 0;
    for (let i = 0; i < 60; i++) {
      await sleep(TICK_MS);
      maxEngaged = Math.max(maxEngaged, es.filter((e) => e.mode === 'windup').length);
    }
    expect(maxEngaged).toBeLessThanOrEqual(2);
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) expect(Math.hypot(es[i]!.x - es[j]!.x, es[i]!.y - es[j]!.y)).toBeGreaterThan(0.3);
    es.forEach((e) => kill(p.w, e));
    await p.r.leave();
  });

  it('night slimes split into mites; volatile elites burst after a fuse', async () => {
    const p = await probe('Splitter');
    clear(p.w);
    const s = still(p.w.spawnEnemy('slime', p.sp.sim.x + 4, p.sp.sim.y, true));
    (p.w as any).damageEnemy(s, 999, p.sp, 1, 0, 0);
    expect([...p.w.enemies.values()].filter((e) => e.def.kind === ENEMY_DEFS.mite.kind).length).toBe(2);
    clear(p.w);
    const v = still(p.w.spawnEnemy('slime', p.sp.sim.x + 0.8, p.sp.sim.y, false, { elite: ELITE.VOLATILE }));
    expect(v.state.elite).toBe(ELITE.VOLATILE);
    (p.w as any).damageEnemy(v, 999, p.sp, 1, 0, 0);
    expect(p.sp.hp).toBe(p.sp.maxHp);
    await until(() => p.fx.some((f) => f.kind === 'bomb'), 1000);
    await until(() => p.sp.hp < p.sp.maxHp, 2000);
    await p.r.leave();
  });

  it('ambient spawning follows the level table, respects the budget and spawns mite packs', async () => {
    const p = await probe('Spawner');
    clear(p.w);
    p.sp.level = 1;
    for (let i = 0; i < 20; i++) (p.w as any).ambientSpawn(0);
    const kinds = new Set([...p.w.enemies.values()].filter((e) => !e.def.passive).map((e) => e.def.name));
    expect([...kinds].every((k) => k === 'Wisp Slime' || k === 'Glint Hopper')).toBe(true);
    let budget = 0;
    for (const e of p.w.enemies.values()) if (Math.hypot(e.x - p.sp.sim.x, e.y - p.sp.sim.y) < 32) budget += e.def.budget ?? 1;
    expect(budget).toBeLessThanOrEqual(6);
    clear(p.w);
    p.sp.level = 8;
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) { (p.w as any).ambientSpawn(0); for (const e of p.w.enemies.values()) seen.add(e.def.name); clear(p.w); }
    expect(seen.has('Static Mite') || seen.has('Phase Wisp') || seen.has('Decoherent Brute')).toBe(true);
    await p.r.leave();
  });
});
