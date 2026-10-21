import { afterAll, describe, expect, it } from 'vitest';
import { CHUNK_SIZE, DAY_MS, MSG, T, WORLD_EPOCH_MS, type CropData } from '@eigenlands/shared';
import type { App } from '../src/app';
import { createPool } from '../src/db/pool';
import { Repo } from '../src/db/repo';
import { worldClock } from '../src/rooms/runtime';
import { TEST_DB, guest, startApp } from './helpers';
import { boot, count, flatten, give, setDay, sleep, slotOf, spawn, tp, until, use } from './p2';

let app: App;
afterAll(async () => { await app?.close(); });

const X = 500, Y = 500;

describe('persistence across a server restart', () => {
  it('objects, inventory, skills, coins, equipment and pending respawns survive; crops catch up offline days', async () => {
    app = await boot();
    const p = await spawn(app, 'Keeper');
    const creds = { token: p.token, accountId: p.accountId };
    setDay(p.room, 1, 12);
    await tp(p, X + 0.5, Y + 0.5);
    flatten(p.room, X, Y, 6);

    // a chest with stone, a sprinkler next to a freshly planted turnip, a felled tree, a ring, some coins
    await give(p, 'chest', 1);
    await use(p, 'chest', X - 1, Y);
    await give(p, 'stone', 12);
    p.r.send(MSG.CHEST, { tx: X - 1, ty: Y, action: 'put', slot: slotOf(p, 'stone'), n: 12 });
    p.room.setTile(X + 1, Y, T.TILLED);
    await use(p, 'turnip_seed', X + 1, Y);
    await give(p, 'sprinkler_1', 1);
    await use(p, 'sprinkler_1', X + 2, Y);
    p.room.setTile(X, Y + 1, T.TREE);
    for (let i = 0; i < 3; i++) await use(p, 'axe', X, Y + 1);
    await until(() => p.room.store.getTile(X, Y + 1) === T.STUMP);
    p.room.setTile(X + 1, Y + 1, T.TILLED);
    await use(p, 'can', X + 1, Y + 1);
    expect(p.room.store.getTile(X + 1, Y + 1)).toBe(T.TILLED_WET);
    p.sp.data.coins = 777;
    await give(p, 'ring_luck', 1, { stat: 'luck', val: 1 });
    p.r.send(MSG.EQUIP, { slot: slotOf(p, 'ring_luck'), as: 'ring2' });
    await until(() => p.sp.data.equip.ring2?.id === 'ring_luck');
    const skills = { ...p.sp.data.skills };
    expect(skills.foraging).toBeGreaterThan(0);
    const day = worldClock().day();

    await p.r.leave();
    await sleep(400);
    await app.close();

    // ── restart: a new process state, the same database, three world days later
    app = await startApp({ config: { devCommands: true } });
    worldClock().setOffset(WORLD_EPOCH_MS + (day + 3) * DAY_MS + 60_000 * 6 - Date.now());
    const q = await spawn(app, 'Keeper', creds);
    expect(q.sp.data.coins).toBe(777);
    expect(q.sp.data.skills).toEqual(skills);
    expect(q.sp.data.equip.ring2?.id).toBe('ring_luck');
    expect(q.sp.stats.luck).toBe(1);
    expect(count(q, 'axe')).toBe(1);
    expect(count(q, 'stone')).toBe(0);
    await tp(q, X + 0.5, Y + 0.5);
    await until(() => q.room.store.objectAt(X - 1, Y)?.kind === 'chest', 3000);
    expect((q.room.store.objectAt(X - 1, Y)!.data!.slots as any[]).find((s) => s?.id === 'stone')!.n).toBe(12);
    // the sprinkler watered the crop through the offline days (turnip: 2 days to ripe)
    await until(() => q.room.store.objectAt(X + 1, Y)?.kind === 'crop', 3000);
    const crop = q.room.store.objectAt(X + 1, Y)!.data as unknown as CropData;
    expect(crop.growth).toBe(2);
    expect(crop.lastDay).toBe(day + 2);
    // soil that was wet when the server stopped has dried by the time its chunk loads on a later day
    expect(q.room.store.getTile(X + 1, Y + 1)).toBe(T.TILLED);
    // the felled tree grew back while the server was down
    await until(() => q.room.store.getTile(X, Y + 1) === T.TREE, 3000);
    // the chunk request carries the objects for clients
    q.chunks.length = 0;
    q.r.send(MSG.CHUNK_REQ, { cx: Math.floor(X / CHUNK_SIZE), cy: Math.floor(Y / CHUNK_SIZE) });
    await until(() => q.chunks.length > 0);
    const subs = (q.chunks[0].objs as any[]).map((o) => o.sub);
    expect(subs).toContain('chest');
    expect(subs).toContain('turnip');
    expect(subs).toContain('sprinkler1');
  });

  it('old and garbage character data is sanitised instead of trusted', async () => {
    const g = await guest(app);
    const pool = createPool(TEST_DB);
    const repo = new Repo(pool);
    await repo.createCharacter(g.accountId, 'Legacy', 0.5, 4.5);
    // a Phase 1 character has empty data: it gets the starter kit
    const legacy = await spawn(app, 'Legacy', { token: g.token, accountId: g.accountId });
    expect(count(legacy, 'axe')).toBe(1);
    expect(legacy.sp.data.coins).toBe(100);
    expect(legacy.sp.data.recipes.has('plank')).toBe(true);
    expect(legacy.sp.data.recipes.has('forge')).toBe(false);
    await legacy.r.leave();
    await sleep(300);

    await repo.saveCharacter({
      accountId: g.accountId, x: 0.5, y: 4.5, hp: 30, level: 1, xp: 0,
      data: {
        inv: [{ id: 'wood', n: 5000 }, { id: 'nonsense', n: 3 }, { id: 'axe', n: -1 }, null, 'junk', { id: 'sword', n: 1, p: { atk: 4 } }],
        coins: -50, skills: { farming: 'lots', mining: 40 }, recipes: ['plank', 'not_a_recipe', 7], equip: { ring1: { id: 'axe', n: 1 }, ring2: { id: 'ring_hp', n: 1, p: { stat: 'hp', val: 5 } }, outfit: 99 },
        friends: { orla: { pts: 'x', talked: 1, gifted: 1 }, tobin: { pts: 40, talked: 2, gifted: 3 } }, buffs: { might: { until: 1, power: 9 }, bogus: { until: 9e15, power: 1 } },
      },
    });
    const bad = await spawn(app, 'Legacy', { token: g.token, accountId: g.accountId });
    expect(bad.sp.data.inv.find((s) => s?.id === 'wood')!.n).toBeLessThanOrEqual(99);
    expect(bad.sp.data.inv.some((s) => s?.id === 'nonsense')).toBe(false);
    expect(bad.sp.data.coins).toBe(0);
    expect(bad.sp.data.skills.farming).toBe(0);
    expect(bad.sp.data.skills.mining).toBe(40);
    expect(bad.sp.data.recipes.has('plank')).toBe(true);
    expect(bad.sp.data.equip.ring1).toBeNull(); // an axe is not a ring
    expect(bad.sp.data.equip.ring2?.id).toBe('ring_hp');
    expect(bad.sp.data.equip.outfit).toBe(0);
    expect(bad.sp.data.friends.orla).toBeUndefined();
    expect(bad.sp.data.friends.tobin?.pts).toBe(40);
    expect(Object.keys(bad.sp.data.buffs)).toEqual([]);
    expect(bad.sp.stats.hpBonus).toBe(5);
    // blobs round-trip (market supply, rumors)
    await repo.putBlob('market', { melon: 3 });
    expect(await repo.getBlob('market')).toEqual({ melon: 3 });
    expect(await repo.getBlob('missing')).toBeNull();
    await pool.end();
  });
});
