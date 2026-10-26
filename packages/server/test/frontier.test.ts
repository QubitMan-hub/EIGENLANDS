import { afterAll, beforeAll, expect, it } from 'vitest';
import { frontierSitesNear, frontierTown, sanctuaryAt, T } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, spawn3, sleep } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(250);
  await app?.close();
});

it('loads distant city furniture and collision through authority and applies the settlement damage ward', async () => {
  const p = await spawn3(app, 'Frontier traveller');
  try {
    expect(p.room.store.generation).toBe(6);
    const sites = frontierSitesNear(p.room.seed, -10000, -10000, 10000, -2000, 6);
    expect(sites.length).toBeGreaterThan(10);
    const t = frontierTown(p.room.seed, sites[0]!);
    const b = t.buildings.find((b) => b.kind === 'house')!;
    expect(b).toBeTruthy();
    await p.room.ensureChunk(Math.floor(b.doorX / 32), Math.floor(b.doorY / 32));
    expect(p.room.store.getTile(b.doorX, b.doorY)).toBe(T.FLOOR);
    expect(p.room.store.solidAt(b.doorX, b.doorY)).toBe(false);
    const bed = t.objects.find((o) => o.sub === 'bed')!;
    expect(bed).toBeTruthy();
    await p.room.ensureChunk(Math.floor(bed.x / 32), Math.floor(bed.y / 32));
    expect(p.room.store.objectAt(bed.x, bed.y)?.sub).toBe('bed');
    expect(p.room.store.solidAt(bed.x, bed.y)).toBe(true);
    p.sp.sim.x = b.doorX + 0.5;
    p.sp.sim.y = b.doorY + 0.5;
    expect(sanctuaryAt(p.room.seed, p.sp.sim.x, p.sp.sim.y)?.name).toBe(t.name);
    p.sp.invuln = 0;
    const hp = p.sp.hp;
    expect((p.room as any).hurtPlayer(p.sp, 50, null, 1, 0, 0)).toBe(false);
    expect(p.sp.hp).toBe(hp);
  } finally {
    await p.r.leave();
  }
});
