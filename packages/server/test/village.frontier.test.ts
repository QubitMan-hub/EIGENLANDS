import { describe, expect, it } from 'vitest';
import {
  ChunkStore,
  frontierSite,
  frontierTown,
  residentsOfSite,
  realmNpcs,
  townsFor,
  type RealmSite,
  shardAt,
} from '@eigenlands/shared';
import { GameRoom } from '../src/rooms/GameRoom';
import type { VillageHost } from '../src/systems/types';
import { createVillage } from '../src/systems/village';
import { FakePlayer, makeHost, nextTo, run, SEED } from './village.helpers';

function sites(count: number): RealmSite[] {
  const out: RealmSite[] = [];
  for (let x = 3; out.length < count && x < 100; x++) {
    const site = frontierSite(SEED, x, 2, 7);
    if (site) out.push(site);
  }
  return out;
}

async function setup(generation: 6 | 7 = 7, npcIds?: string[]) {
  const h = makeHost();
  h.host.store = new ChunkStore(SEED, 256, generation);
  h.clock.forced = 'clear';
  h.clock.set(0, 10);
  const village = createVillage(h.host, { npcIds });
  await village.init();
  return { ...h, village };
}

const frontierIds = (h: Awaited<ReturnType<typeof setup>>) =>
  [...h.state.npcs.keys()].filter((id) => id.includes('frontier_'));

function visit(p: FakePlayer, site: RealmSite): void {
  p.x = site.cx;
  p.y = site.cy;
}

describe('authoritative frontier residents', () => {
  it('lazily activates deterministic residents with normal dialogue, shops and schedule movement', async () => {
    const h = await setup();
    const site = sites(1)[0]!;
    const town = frontierTown(SEED, site, 7);
    const merchant = residentsOfSite(site).find((r) => r.role === 'merchant')!;
    expect(frontierIds(h)).toEqual([]);
    const p = new FakePlayer();
    visit(p, site);
    h.players.push(p);
    run(h.village, h.clock, 40);
    const st = h.village.npc(merchant.id);
    expect(st).toBeDefined();
    expect(h.host.store.solidAt(Math.floor(st!.x), Math.floor(st!.y))).toBe(false);
    for (const [key, spot] of Object.entries(town.spots)) {
      if (residentsOfSite(site).some((resident) => key.startsWith(resident.id)))
        expect(h.host.store.solidAt(spot.x, spot.y), key).toBe(false);
    }
    nextTo(p, h.village, merchant.id);
    expect(h.village.talk(p, merchant.id)?.npcId).toBe(merchant.id);
    const shop = h.village.shop(p, { npcId: merchant.id, action: 'open' });
    expect(shop?.stock.length).toBeGreaterThan(0);
    const before = { x: st!.x, y: st!.y };
    h.clock.set(0, 23);
    run(h.village, h.clock, 240, 40);
    expect(Math.hypot(st!.x - before.x, st!.y - before.y)).toBeGreaterThan(0.5);
    expect(h.host.store.solidAt(Math.floor(st!.x), Math.floor(st!.y))).toBe(false);
    p.x = 0;
    p.y = 0;
    run(h.village, h.clock, 40, 280);
    expect(frontierIds(h)).toEqual([]);
    visit(p, site);
    run(h.village, h.clock, 40, 320);
    expect(h.village.npc(merchant.id)?.id).toBe(merchant.id);
  });

  it('keeps resident and town counts bounded across distant player regions and retains towns near another player', async () => {
    const h = await setup();
    const regions = sites(8);
    for (const site of regions) {
      const p = new FakePlayer();
      visit(p, site);
      h.players.push(p);
    }
    run(h.village, h.clock, 40);
    const ids = frontierIds(h);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(192);
    const activeSites = regions.filter((s) => residentsOfSite(s).some((r) => ids.includes(r.id)));
    expect(activeSites.length).toBeLessThanOrEqual(4);
    const retained = activeSites[0]!;
    const observer = new FakePlayer();
    visit(observer, retained);
    h.players.push(observer);
    for (const p of h.players.slice(0, -1)) {
      p.x = 0;
      p.y = 0;
    }
    run(h.village, h.clock, 40, 40);
    expect(frontierIds(h).sort()).toEqual(
      ids.filter((id) => residentsOfSite(retained).some((r) => r.id === id)).sort(),
    );
  });

  it('advances unseen named residents directly to their schedule without routing through unloaded streets', async () => {
    const spots = Object.assign({}, ...townsFor(SEED, 7).map((town) => town.spots));
    const def = realmNpcs(7).find((npc) => {
      if (npc.role !== 'merchant') return false;
      const a = spots[`${npc.id}.work`],
        b = spots[npc.home];
      return a && b && Math.hypot(a.x - b.x, a.y - b.y) > 4 && Math.hypot(a.x - b.x, a.y - b.y) < 40;
    })!;
    expect(def).toBeDefined();
    const h = await setup(7, [def.id]);
    h.clock.set(0, 23);
    run(h.village, h.clock, 20);
    expect(h.village.npc(def.id)?.x).toBe(spots[def.home].x + 0.5);
    expect(h.village.npc(def.id)?.y).toBe(spots[def.home].y + 0.5);
  });

  it('preserves revision 6 and explicit selective NPC fixtures', async () => {
    for (const h of [await setup(6), await setup(7, ['tobin'])]) {
      const p = new FakePlayer();
      visit(p, sites(1)[0]!);
      h.players.push(p);
      run(h.village, h.clock, 40);
      expect(frontierIds(h)).toEqual([]);
    }
  });
});

/** Exercise the production factory without constructing a room or starting its socket/timer lifecycle. */
class RoomVillageHarness extends GameRoom {
  static create(host: VillageHost, unsharded: boolean, shard: string) {
    const room = Object.create(RoomVillageHarness.prototype) as RoomVillageHarness;
    room.seed = host.seed;
    room.store = host.store;
    room.unsharded = unsharded;
    room.shard = shard;
    room.players = new Map();
    return room.makeVillage(host);
  }
}

async function roomVillage(generation: 6 | 7, unsharded: boolean, shard: string) {
  const h = makeHost();
  h.host.store = new ChunkStore(SEED, 256, generation);
  h.clock.forced = 'clear';
  h.clock.set(0, 10);
  const village = RoomVillageHarness.create(h.host, unsharded, shard);
  await village.init();
  return { ...h, village };
}

describe('GameRoom frontier village factory', () => {
  it('uses revision-7 named rosters and enables frontier discovery in an unsharded room', async () => {
    const site = sites(1)[0]!;
    const h = await roomVillage(7, true, '*');
    for (const def of realmNpcs(7)) expect(h.village.npc(def.id), def.id).toBeDefined();
    const p = new FakePlayer();
    visit(p, site);
    h.players.push(p);
    run(h.village, h.clock, 1);
    expect(h.village.npc(residentsOfSite(site)[0]!.id)).toBeDefined();
  });

  it('runs frontier-only shards and prevents adjacent shards from owning the same residents', async () => {
    const site = sites(1)[0]!;
    const id = residentsOfSite(site)[0]!.id;
    for (const [shard, owns] of [
      [shardAt(site.cx, site.cy), true],
      [shardAt(site.cx + 256, site.cy), false],
    ] as const) {
      const h = await roomVillage(7, false, shard);
      expect(h.state.npcs.size).toBe(0);
      const p = new FakePlayer();
      visit(p, site);
      h.players.push(p);
      run(h.village, h.clock, 1);
      expect(h.village.npc(id) !== undefined).toBe(owns);
    }
  });

  it('keeps revision-6 frontier-only rooms empty', async () => {
    const site = sites(1)[0]!;
    const h = await roomVillage(6, false, shardAt(site.cx, site.cy));
    const p = new FakePlayer();
    visit(p, site);
    h.players.push(p);
    run(h.village, h.clock, 1);
    expect(h.state.npcs.size).toBe(0);
  });
});
