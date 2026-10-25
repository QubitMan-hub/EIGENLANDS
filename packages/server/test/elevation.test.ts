import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHUNK_SIZE, CLIFF, MSG, T, isSolid, type ChunkMsg, type ChunkStore } from '@eigenlands/shared';
import type { App } from '../src/app';
import { lineOfSight } from '../src/game/enemies';
import { handleUse } from '../src/systems/tools';
import { boot3, sleep, spawn3, tp, until, type P3 } from './p3helpers';

let app: App;
let p: P3;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 3 });
  p = await spawn3(app, 'Climber');
});
afterAll(async () => {
  await p?.r.leave();
  await sleep(200);
  await app?.close();
});

const walkable = (s: ChunkStore, x: number, y: number) => !s.solidAt(x, y);
/** two horizontally adjacent open tiles whose levels differ by `min` or more, with open ground behind the lower one */
function cliffPair(s: ChunkStore, min: number): { lo: [number, number]; hi: [number, number] } {
  for (let y = -200; y < 200; y++)
    for (let x = 100; x < 230; x++) {
      const a = s.levelAt(x, y),
        b = s.levelAt(x + 1, y);
      if (
        b - a >= min &&
        walkable(s, x, y) &&
        walkable(s, x + 1, y) &&
        walkable(s, x - 1, y) &&
        s.levelAt(x - 1, y) === a
      )
        return { lo: [x, y], hi: [x + 1, y] };
    }
  throw new Error('no cliff found');
}

describe('a new world at revision 3', () => {
  it('records its revision, tells the client, and sends authoritative levels with every chunk', async () => {
    expect(await app.repo.getBlob(`worldgen:${p.room.seed}`)).toEqual({ version: 3 });
    expect(p.room.store.generation).toBe(3);
    expect(p.sp.data.worldGeneration).toBe(3);
    const store = p.room.store;
    const { hi } = cliffPair(store, CLIFF);
    const msgs: ChunkMsg[] = [];
    p.r.onMessage(MSG.CHUNK, (m: ChunkMsg) => msgs.push(m));
    const cx = Math.floor(hi[0] / CHUNK_SIZE),
      cy = Math.floor(hi[1] / CHUNK_SIZE);
    await tp(p, hi[0] + 0.5, hi[1] + 0.5);
    p.r.send(MSG.CHUNK_REQ, { cx, cy });
    await until(() => msgs.some((m) => m.cx === cx && m.cy === cy && m.levels), 4000);
    const m = msgs.find((q) => q.cx === cx && q.cy === cy)!;
    expect(m.levels!.length).toBe(CHUNK_SIZE * CHUNK_SIZE);
    expect([...new Uint8Array(m.levels!)]).toEqual([...store.get(cx, cy).levels!]);
  });
});

describe('cliffs are real obstacles', () => {
  it('a walker is stopped by a cliff face on the server and slides along it', async () => {
    const store = p.room.store;
    const { lo, hi } = cliffPair(store, CLIFF);
    await tp(p, lo[0] + 0.5, lo[1] + 0.5);
    const seq0 = Date.now() % 1e6;
    for (let i = 0; i < 24; i++) {
      p.r.send(MSG.INPUT, {
        cmds: [
          {
            seq: seq0 + i,
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
    expect(p.sp.sim.x).toBeLessThan(hi[0]);
    expect(Math.abs(p.sp.sim.y - (lo[1] + 0.5))).toBeLessThan(0.6);
  });

  it('sight and shots do not cross a cliff from below but do from above', () => {
    const store = p.room.store;
    const { lo, hi } = cliffPair(store, CLIFF);
    const a = [lo[0] + 0.5, lo[1] + 0.5] as const,
      b = [hi[0] + 0.5, hi[1] + 0.5] as const;
    expect(lineOfSight(store.solidAt, a[0], a[1], b[0], b[1])).toBe(false);
    expect(lineOfSight(store.solidAt, b[0], b[1], a[0], a[1])).toBe(true);
    expect(store.shotBlockedAt(hi[0], hi[1], store.levelAt(lo[0], lo[1]))).toBe(true);
    expect(store.shotBlockedAt(lo[0], lo[1], store.levelAt(hi[0], hi[1]))).toBe(false);
  });
});

describe('building on uneven ground', () => {
  async function build(x: number, y: number) {
    await tp(p, x + 0.5, y + 1.5);
    p.sp.data.inv[0] = { id: 'timber_floor', n: 5 };
    p.sp.toolReadyAt = 0;
    await handleUse(p.room, p.sp, { slot: 0, tx: x, ty: y });
  }
  it('refuses a foundation on a slope and accepts level ground', async () => {
    const s = p.room.store;
    let slope: [number, number] | null = null,
      flat: [number, number] | null = null;
    for (let y = -190; y < 190 && !(slope && flat); y++)
      for (let x = 100; x < 230; x++) {
        if (!([T.GRASS, T.SAND] as number[]).includes(s.getTile(x, y)) || s.solidAt(x, y + 1)) continue;
        const l = s.levelAt(x, y);
        let uneven = false;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) if (s.levelAt(x + ox, y + oy) !== l) uneven = true;
        if (uneven && !slope && !isSolid(s.getTile(x, y))) slope = [x, y];
        if (!uneven && !flat && l > 0) flat = [x, y];
      }
    expect(slope).not.toBeNull();
    expect(flat).not.toBeNull();
    await build(slope![0], slope![1]);
    expect(s.structureAt(slope![0], slope![1])).toBeUndefined();
    expect(p.sp.data.inv[0]?.n).toBe(5);
    await build(flat![0], flat![1]);
    expect(s.structureAt(flat![0], flat![1])?.owner).toBe(p.accountId);
  });
});
