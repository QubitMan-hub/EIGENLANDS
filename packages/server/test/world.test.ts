import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from 'colyseus';
import {
  ChunkStore, CHUNK_SIZE, MSG, T, TICK_MS, decodeDiff, newPlayerSim, sanitizeCmd, stepPlayer, xpForLevel,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import type { WorldRoom } from '../src/rooms/WorldRoom';
import { drive, guest, join, lastRoomId, me, resetDb, sleep, startApp, until } from './helpers';

let app: App;
const room = (): WorldRoom => matchMaker.getLocalRoomById(lastRoomId()) as unknown as WorldRoom;
const SEED = 20260101;

beforeAll(async () => { await resetDb(); app = await startApp(); });
afterAll(async () => { await app.close(); });

describe('movement netcode', () => {
  it('server result matches the shared sim the client predicts with', async () => {
    const g = await guest(app);
    const r = await join(app, g.token, 'Predictor');
    await until(() => !!me(r));
    const start = { x: me(r).x, y: me(r).y };
    const cmds = await drive(r, 1, 30, { dx: 1, dy: 0.5 });
    await until(() => me(r).ack >= 30);

    const store = new ChunkStore(SEED);
    const local = newPlayerSim(start.x, start.y);
    for (const c of cmds) stepPlayer(local, sanitizeCmd(c), store.solidAt);
    expect(me(r).x).toBeCloseTo(local.x, 2);
    expect(me(r).y).toBeCloseTo(local.y, 2);
    expect(me(r).x).toBeGreaterThan(start.x + 3);
    await r.leave();
  });

  it('ignores replayed/old sequence numbers and clamps cheating inputs', async () => {
    const g = await guest(app);
    const r = await join(app, g.token, 'Cheater');
    await until(() => !!me(r));
    const x0 = me(r).x;
    await drive(r, 1, 5, { dx: 1 });
    await until(() => me(r).ack >= 5);
    const x1 = me(r).x, y1 = me(r).y;
    await drive(r, 1, 5, { dx: 1 }); // replay old seqs
    await sleep(150);
    expect(me(r).x).toBeCloseTo(x1, 3);
    // absurd movement magnitudes cannot exceed walking speed (4.5 t/s)
    r.send(MSG.INPUT, { cmds: [{ seq: 100, dx: 1e9, dy: 1e9, dash: false, attack: false, skill: false, aimX: 0, aimY: 0, viewTick: 0 }] });
    await until(() => me(r).ack >= 100);
    expect(Math.hypot(me(r).x - x1, me(r).y - y1)).toBeLessThan(1.2);
    expect(x1).toBeGreaterThan(x0);
    await r.leave();
  });
});

describe('interest management', () => {
  it('clients only receive entities in nearby chunks', async () => {
    const a = await join(app, (await guest(app)).token, 'Near');
    const b = await join(app, (await guest(app)).token, 'Also');
    await until(() => !!me(a) && !!me(b));
    // both spawn together: each sees the other
    await until(() => a.state.players.size === 2, 3000);
    // enemy far away should not be sent
    const w = room();
    const far = w.spawnEnemy('slime', 600, 600, false);
    const near = w.spawnEnemy('slime', me(a).x + 4, me(a).y, false);
    await until(() => a.state.enemies.has(near.id), 3000);
    await sleep(200);
    expect(a.state.enemies.has(far.id)).toBe(false);
    // teleport b far away: a stops seeing b
    const sb = w.players.get(b.sessionId)!;
    sb.sim.x = 400; sb.sim.y = 400;
    await until(() => !a.state.players.has(b.sessionId), 3000);
    expect(b.state.players.has(b.sessionId)).toBe(true);
    w.enemies.delete(far.id); w.state.enemies.delete(far.id);
    w.enemies.delete(near.id); w.state.enemies.delete(near.id);
    await a.leave(); await b.leave();
  });
});

describe('combat', () => {
  it('melee kills an enemy and awards xp', async () => {
    const g = await guest(app);
    const r = await join(app, g.token, 'Fighter');
    await until(() => !!me(r));
    const w = room();
    const sp = w.players.get(r.sessionId)!;
    sp.invuln = 0;
    const e = w.spawnEnemy('slime', sp.sim.x + 1, sp.sim.y, false);
    e.def = { ...e.def, speed: 0 }; // keep it still for a deterministic hit
    e.resist = 0;
    await until(() => r.state.enemies.has(e.id));
    let seq = 1;
    for (let i = 0; i < 40 && w.enemies.has(e.id); i++) {
      r.send(MSG.INPUT, { cmds: [{ seq: seq++, dx: 0, dy: 0, dash: false, attack: true, skill: false, aimX: 1, aimY: 0, viewTick: w.state.tick }] });
      await sleep(TICK_MS);
    }
    expect(w.enemies.has(e.id)).toBe(false);
    expect(sp.xp).toBe(10);
    await r.leave();
  });

  it('projectile skill shot hits at range', async () => {
    const r = await join(app, (await guest(app)).token, 'Archer');
    await until(() => !!me(r));
    const w = room();
    const sp = w.players.get(r.sessionId)!;
    for (let x = 0; x <= 8; x++) w.store.setTile(Math.floor(sp.sim.x) + x, Math.floor(sp.sim.y), T.GRASS); // clear the lane
    const e = w.spawnEnemy('slime', sp.sim.x + 5, sp.sim.y, false);
    e.def = { ...e.def, speed: 0, sight: 0.1 };
    e.resist = 0;
    const hp0 = e.hp;
    r.send(MSG.INPUT, { cmds: [{ seq: 1, dx: 0, dy: 0, dash: false, attack: false, skill: true, aimX: 1, aimY: 0, viewTick: 0 }] });
    await until(() => e.hp < hp0, 2000);
    expect(e.hp).toBe(hp0 - 12);
    w.enemies.delete(e.id); w.state.enemies.delete(e.id);
    await r.leave();
  });

  it('lag compensation: a hit lands on where the enemy WAS when the client saw it', async () => {
    const r = await join(app, (await guest(app)).token, 'Laggy');
    await until(() => !!me(r));
    const w = room();
    const sp = w.players.get(r.sessionId)!;
    sp.invuln = 5;
    const e = w.spawnEnemy('slime', sp.sim.x + 1.1, sp.sim.y, false);
    e.def = { ...e.def, speed: 0, sight: 0.1 };
    e.resist = 0;
    // record some history then move the enemy out of range (as if it walked away 150ms ago)
    const t0 = w.state.tick;
    await sleep(TICK_MS * 4);
    const seenTick = w.state.tick - 3;
    e.x = sp.sim.x + 6; e.y = sp.sim.y;
    // history holds the old (in-range) positions
    const hp0 = e.hp;
    r.send(MSG.INPUT, { cmds: [{ seq: 1, dx: 0, dy: 0, dash: false, attack: true, skill: false, aimX: 1, aimY: 0, viewTick: seenTick }] });
    await sleep(TICK_MS * 3);
    expect(t0).toBeLessThan(w.state.tick);
    expect(e.hp).toBeLessThan(hp0);
    // an absurdly old viewTick is clamped to the max rewind and must not hit
    const hp1 = e.hp;
    await sleep(TICK_MS * 8); // let the "moved away" position fill the rewind window
    r.send(MSG.INPUT, { cmds: [{ seq: 2, dx: 0, dy: 0, dash: false, attack: true, skill: false, aimX: 1, aimY: 0, viewTick: 1 }] });
    await sleep(TICK_MS * 3);
    expect(e.hp).toBe(hp1);
    w.enemies.delete(e.id); w.state.enemies.delete(e.id);
    await r.leave();
  });

  it('dash i-frames beat a telegraphed strike that would otherwise hit', async () => {
    const r = await join(app, (await guest(app)).token, 'Dasher');
    await until(() => !!me(r));
    const w = room();
    const sp = w.players.get(r.sessionId)!;
    const mk = () => {
      sp.invuln = 0;
      const e = w.spawnEnemy('slime', sp.sim.x + 2, sp.sim.y, false);
      e.def = { ...e.def, speed: 0, strikeRange: 8 }; // huge radius: only i-frames can save us
      return e;
    };
    // control: standing still gets hit
    const c = mk();
    const hp0 = sp.hp;
    await until(() => sp.hp < hp0, 4000);
    w.enemies.delete(c.id); w.state.enemies.delete(c.id);
    // dash timed into the strike frame avoids it
    await sleep(700); // outlast post-hit invulnerability and the enemy's recovery
    sp.hp = sp.maxHp;
    const e = mk();
    let seq = 1000;
    await until(() => e.mode === 'windup' && e.t < 0.12, 4000, 5);
    r.send(MSG.INPUT, { cmds: [{ seq: seq++, dx: 0, dy: 1, dash: true, attack: false, skill: false, aimX: 0, aimY: 0, viewTick: 0 }] });
    await until(() => e.mode === 'recover', 2000, 5);
    await sleep(100);
    expect(sp.hp).toBe(sp.maxHp);
    w.enemies.delete(e.id); w.state.enemies.delete(e.id);
    await r.leave();
  });

  it('enemy strike damages, kills and respawns the player', async () => {
    const r = await join(app, (await guest(app)).token, 'Victim');
    await until(() => !!me(r));
    const w = room();
    const sp = w.players.get(r.sessionId)!;
    sp.invuln = 0;
    const e = w.spawnEnemy('slime', sp.sim.x + 0.6, sp.sim.y, false);
    await until(() => me(r).hp < me(r).maxHp, 4000);
    expect(me(r).hp).toBe(me(r).maxHp - 7);
    // hit it until the player dies
    e.def = { ...e.def, damage: 500 };
    sp.invuln = 0;
    await until(() => (me(r).flags & 4) !== 0, 5000);
    await until(() => (me(r).flags & 4) === 0, 5000); // respawned
    expect(me(r).hp).toBe(me(r).maxHp);
    w.enemies.delete(e.id); w.state.enemies.delete(e.id);
    await r.leave();
  });
});

describe('world edits and persistence', () => {
  it('breaks a rock, persists the diff, and a restarted server serves it', async () => {
    const r = await join(app, (await guest(app)).token, 'Miner');
    await until(() => !!me(r));
    const w = room();
    const sp = w.players.get(r.sessionId)!;
    // find a rock near the player by placing one (edit path requires an existing breakable tile)
    const tx = Math.floor(sp.sim.x) + 1, ty = Math.floor(sp.sim.y);
    w.store.setTile(tx, ty, T.ROCK); // test fixture
    const tiles: any[] = [];
    r.onMessage(MSG.TILE, (m) => tiles.push(m));
    r.send(MSG.EDIT, { tx, ty });
    await until(() => tiles.length > 0, 2000);
    expect(tiles[0]).toMatchObject({ tx, ty, tile: T.GRASS });
    // out-of-reach and non-breakable edits are refused
    tiles.length = 0;
    r.send(MSG.EDIT, { tx: tx + 50, ty });
    r.send(MSG.EDIT, { tx: Math.floor(sp.sim.x), ty: Math.floor(sp.sim.y) });
    await sleep(200);
    expect(tiles.length).toBe(0);
    const cx = Math.floor(tx / CHUNK_SIZE), cy = Math.floor(ty / CHUNK_SIZE);
    const diffMsgs: any[] = [];
    r.onMessage(MSG.CHUNK, (m) => diffMsgs.push(m));
    r.send(MSG.CHUNK_REQ, { cx, cy });
    await until(() => diffMsgs.length > 0);
    expect(decodeDiff(diffMsgs[0].diff).size).toBeGreaterThan(0);

    // character progress is saved on leave
    sp.xp = 7; sp.level = 3; sp.maxHp = 80; sp.hp = 55;
    const accountId = sp.accountId;
    await r.leave();
    await sleep(400);
    const saved = await app.repo.getCharacter(accountId);
    expect(saved).toMatchObject({ level: 3, xp: 7, hp: 55 });

    // full restart: new server process state, same database
    const g2 = await guest(app);
    await app.close();
    app = await startApp();
    const g3 = await guest(app, g2.deviceSecret);
    const r2 = await join(app, g3.token, 'Reader');
    const msgs: any[] = [];
    r2.onMessage(MSG.CHUNK, (m) => msgs.push(m));
    await until(() => !!me(r2));
    const sp2 = (room() as WorldRoom).players.get(r2.sessionId)!;
    sp2.sim.x = tx + 1; sp2.sim.y = ty;
    await sleep(100);
    r2.send(MSG.CHUNK_REQ, { cx, cy });
    await until(() => msgs.length > 0);
    const fresh = new ChunkStore(SEED);
    fresh.applyDiff(cx, cy, decodeDiff(msgs[0].diff));
    expect(fresh.getTile(tx, ty)).toBe(T.GRASS);
    await r2.leave();
    expect(xpForLevel(1)).toBe(30);
  });

  it('returning player resumes with saved level and position', async () => {
    const g = await guest(app);
    const r = await join(app, g.token, 'Returner');
    await until(() => !!me(r));
    const sp = (room() as WorldRoom).players.get(r.sessionId)!;
    sp.sim.x = 12.5; sp.sim.y = 9.5; sp.level = 2; sp.maxHp = 68; sp.hp = 68;
    await r.leave();
    await sleep(300);
    const r2 = await join(app, g.token);
    await until(() => !!me(r2));
    expect(me(r2).name).toBe('Returner');
    expect(me(r2).level).toBe(2);
    expect(me(r2).x).toBeCloseTo(12.5, 1);
    await r2.leave();
  });

  it('a second login for the same account replaces the first session', async () => {
    const g = await guest(app);
    const a = await join(app, g.token, 'Dup');
    await until(() => !!me(a));
    let closed = false;
    a.onLeave(() => { closed = true; });
    const b = await join(app, g.token);
    await until(() => closed, 3000);
    await until(() => !!me(b));
    await b.leave();
  });

  it('rejects forged tokens at join', async () => {
    await expect(join(app, 'forged.token')).rejects.toBeTruthy();
  });
});

describe('crowds', () => {
  it('50 players in one view all sync cleanly (regression: schema encoder buffer overflow)', async () => {
    const errors: string[] = [];
    const origErr = console.error;
    console.error = (...a: unknown[]) => { errors.push(a.map(String).join(' ')); };
    const rooms: Awaited<ReturnType<typeof join>>[] = [];
    try {
      for (let i = 0; i < 50; i++) rooms.push(await join(app, (await guest(app)).token, `crowd${i}`));
      await until(() => rooms.every((r) => ((r.state as any)?.players?.size ?? 0) >= 50), 8000, 50);
      expect(rooms[0]!.state.players.size).toBe(50);
      expect(errors.filter((e) => /refId|overflow/.test(e))).toEqual([]);
    } finally {
      console.error = origErr;
      await Promise.all(rooms.map((r) => r.leave().catch(() => {})));
    }
  });
});
