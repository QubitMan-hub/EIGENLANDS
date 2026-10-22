import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from 'colyseus';
import { Client, type Room } from 'colyseus.js';
import { MSG, MSG34, T, regionBounds, type GhostsMsg, type HandoffMsg } from '@eigenlands/shared';
import type { App } from '../src/app';
import type { GameRoom } from '../src/rooms/GameRoom';
import { guest, httpUrl, resetDb, sleep, startApp, until, wsUrl } from './helpers';

let app: App;
beforeAll(async () => { await resetDb(); app = await startApp(); });
afterAll(async () => { await app.close(); });

const B0 = regionBounds({ rx: 0, ry: 0 });
const serverRoom = (r: Room) => matchMaker.getLocalRoomById(r.roomId) as unknown as GameRoom;

interface Conn { r: Room<any>; handoffs: HandoffMsg[]; ghosts: GhostsMsg[]; tiles: any[]; notices: string[]; left: number[] }
async function connect(token: string, opts: Record<string, unknown>, roomId?: string): Promise<Conn> {
  const c = new Client(wsUrl(app));
  const r = roomId ? await c.joinById(roomId, { token, ...opts }) : await c.joinOrCreate('world', { token, ...opts });
  const k: Conn = { r, handoffs: [], ghosts: [], tiles: [], notices: [], left: [] };
  r.onMessage(MSG34.HANDOFF, (m: HandoffMsg) => k.handoffs.push(m));
  r.onMessage(MSG34.GHOSTS, (m: GhostsMsg) => k.ghosts.push(m));
  r.onMessage(MSG.TILE, (m) => k.tiles.push(m));
  r.onMessage(MSG.NOTICE, (m: { text: string }) => k.notices.push(m.text));
  r.onMessage('*', () => {});
  r.onLeave((code) => k.left.push(code));
  return k;
}

/** Join shard 0,0, walk (server-side) across the east border and follow the handoff. */
async function into10(token: string, name: string, x: number): Promise<Conn> {
  const a = await connect(token, { name, shard: '0,0' });
  await until(() => serverRoom(a.r).players.has(a.r.sessionId));
  const sp = serverRoom(a.r).players.get(a.r.sessionId)!;
  sp.sim.x = x; sp.sim.y = 0.5;
  await until(() => a.handoffs.length > 0, 4000);
  const h = a.handoffs[0]!;
  expect(h.shard).toBe('1,0');
  const b = await connect(token, { name, shard: h.shard, ticket: h.ticket });
  await a.r.leave().catch(() => {});
  await until(() => serverRoom(b.r).players.has(b.r.sessionId));
  return b;
}

describe('shards', () => {
  it('hands a player to the next region at the border and restores their position there', async () => {
    const g = await guest(app);
    const a = await connect(g.token, { name: 'Walker', shard: '0,0' });
    const ra = serverRoom(a.r);
    await until(() => ra.players.has(a.r.sessionId));
    expect(ra.shard).toBe('0,0');
    const sp = ra.players.get(a.r.sessionId)!;
    // inside the margin: no handoff yet (hysteresis)
    sp.sim.x = B0.x1 + 1; sp.sim.y = 0.5;
    await sleep(300);
    expect(a.handoffs).toHaveLength(0);
    sp.sim.x = B0.x1 + 3;
    await until(() => a.handoffs.length > 0, 4000);
    expect(a.handoffs[0]!.shard).toBe('1,0');
    expect(ra.players.has(a.r.sessionId)).toBe(false);
    // the character was saved before the handoff was sent
    const r = await fetch(`${httpUrl(app)}/api/shard`, { headers: { authorization: `Bearer ${g.token}` } });
    expect(await r.json()).toEqual({ shard: '1,0' });
    const b = await connect(g.token, { name: 'Walker', shard: '1,0', ticket: a.handoffs[0]!.ticket });
    const rb = serverRoom(b.r);
    expect(rb.shard).toBe('1,0');
    expect(rb).not.toBe(ra);
    await until(() => rb.players.has(b.r.sessionId));
    expect(rb.players.get(b.r.sessionId)!.sim.x).toBeCloseTo(B0.x1 + 3, 1);
    await a.r.leave().catch(() => {});
    await b.r.leave();
  });

  it('a join to the wrong shard is handed straight to the right one', async () => {
    const g = await guest(app);
    const b = await into10(g.token, 'Lost', B0.x1 + 4);
    await b.r.leave();
    await sleep(200);
    const c = await connect(g.token, { name: 'Lost', shard: '0,0' });
    await until(() => c.handoffs.length > 0, 4000);
    expect(c.handoffs[0]!.shard).toBe('1,0');
    await c.r.leave().catch(() => {});
  });

  it('players near a border see each other as ghosts across it', async () => {
    const ga = await guest(app), gb = await guest(app);
    const b = await into10(gb.token, 'East', B0.x1 + 4);
    const a = await connect(ga.token, { name: 'West', shard: '0,0' });
    const ra = serverRoom(a.r);
    await until(() => ra.players.has(a.r.sessionId));
    ra.players.get(a.r.sessionId)!.sim.x = B0.x1 - 4;
    await until(() => b.ghosts.some((m) => m.list.some((gh) => gh.name === 'West')), 4000);
    await until(() => a.ghosts.some((m) => m.list.some((gh) => gh.name === 'East')), 4000);
    // walking away from the border makes the ghost disappear
    ra.players.get(a.r.sessionId)!.sim.x = 0.5;
    await until(() => { const last = b.ghosts[b.ghosts.length - 1]; return !!last && !last.list.some((gh) => gh.name === 'West'); }, 4000);
    await a.r.leave(); await b.r.leave();
  });

  it('tile edits near a border are relayed to the neighbouring shard; foreign tiles cannot be edited', async () => {
    const ga = await guest(app), gb = await guest(app);
    const b = await into10(gb.token, 'Mason', B0.x1 + 4);
    const a = await connect(ga.token, { name: 'Watcher', shard: '0,0' });
    const ra = serverRoom(a.r), rb = serverRoom(b.r);
    await until(() => ra.players.has(a.r.sessionId));
    ra.players.get(a.r.sessionId)!.sim.x = B0.x1 - 6;
    const tx = B0.x1 + 2, ty = 0;
    rb.setTile(tx, ty, T.FENCE);
    await until(() => ra.store.getTile(tx, ty) === T.FENCE, 3000);
    await until(() => a.tiles.some((t) => t.tx === tx && t.ty === ty && t.tile === T.FENCE), 3000);
    // shard 0,0 refuses world edits aimed at shard 1,0's tiles
    expect(ra.owns(tx, ty)).toBe(false);
    expect(ra.owns(B0.x1 - 1, 0)).toBe(true);
    await a.r.leave(); await b.r.leave();
  });

  it('one live session per account across shards', async () => {
    const g = await guest(app);
    const b = await into10(g.token, 'Twin', B0.x1 + 5);
    // a second connection for the same account (e.g. another tab) kicks the first, wherever it is
    const c = await connect(g.token, { name: 'Twin', shard: '1,0' });
    await until(() => b.left.length > 0 || b.notices.length > 0, 4000);
    await until(() => serverRoom(c.r).players.has(c.r.sessionId));
    expect(serverRoom(b.r).players.has(b.r.sessionId)).toBe(false);
    await c.r.leave();
  });

  it('a second room for an owned shard redirects its players to the live owner', async () => {
    const g = await guest(app);
    const a = await connect(g.token, { name: 'Owner', shard: '0,0' });
    const owner = serverRoom(a.r);
    await until(() => owner.players.has(a.r.sessionId));
    const listing = await matchMaker.createRoom('world', { shard: '0,0' });
    expect(listing.roomId).not.toBe(owner.roomId);
    const k = await connect((await guest(app)).token, { name: 'Late' }, listing.roomId);
    await until(() => k.handoffs.length > 0, 4000);
    expect(k.handoffs[0]).toMatchObject({ shard: '0,0', roomId: owner.roomId });
    // following the redirect lands in the owner
    const j = await connect((await guest(app)).token, { name: 'Late2', shard: '0,0', ticket: k.handoffs[0]!.ticket }, owner.roomId);
    await until(() => owner.players.has(j.r.sessionId));
    await Promise.all([a.r.leave(), j.r.leave(), k.r.leave().catch(() => {})]);
  });
});
