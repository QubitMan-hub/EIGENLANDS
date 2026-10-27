import { describe, expect, it } from 'vitest';
import {
  GATE_OY,
  GATE_RANKS,
  GATE_RANK_INFO,
  GATE_SLOTS,
  ENEMY_DEFS,
  ITEMS,
  T,
  gateEntry,
  gateExit,
  gateLayout,
  gateRoomAt,
  gateSlotAt,
  gateTileAt,
  gatesNear,
  isOtherworldY,
  isSolid,
  slotOrigin,
  tileAt,
} from '../src/index';

/** flood fill over a dungeon's open tiles from its entry */
function reach(seed: number, slot: number): Set<string> {
  const e = gateEntry(seed, slot);
  const x0 = Math.floor(e.x),
    y0 = Math.floor(e.y);
  const seen = new Set([`${x0},${y0}`]);
  const q: Array<[number, number]> = [[x0, y0]];
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as Array<[number, number]>) {
      const k = `${nx},${ny}`;
      if (seen.has(k) || isSolid(gateTileAt(seed, nx, ny)!)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

describe('dungeon gates', () => {
  it('every dungeon is whole: each room reached from the entry, the way in and out clear, the master at the end', () => {
    for (const seed of [7, 42, 20260101])
      for (const slot of [0, 1, 2, 3, 4, 5, 77, 131, GATE_SLOTS - 1]) {
        const L = gateLayout(seed, slot);
        expect(L.rank).toBe(slot % GATE_RANKS.length);
        expect(L.rooms[0]!.kind).toBe('entry');
        expect(L.rooms.filter((r) => r.kind === 'master')).toHaveLength(1);
        expect(L.rooms.filter((r) => r.kind !== 'side').length).toBeGreaterThanOrEqual(3);
        const seen = reach(seed, slot);
        for (const r of L.rooms)
          expect(seen.has(`${L.ox + r.x},${GATE_OY + r.y}`), `${seed} slot ${slot} ${r.kind} room`).toBe(true);
        const x = gateExit(seed, slot);
        expect(isSolid(gateTileAt(seed, Math.floor(x.x), Math.floor(x.y))!)).toBe(false);
        expect(gateRoomAt(seed, Math.floor(x.x), Math.floor(x.y))!.room).toBe(0);
        expect(gateSlotAt(slotOrigin(slot) + 3)).toBe(slot);
      }
  });

  it('the gate plane is its own: off the surface, rock outside the dungeons, generated in new worlds only', () => {
    expect(isOtherworldY(GATE_OY)).toBe(true);
    expect(gateTileAt(1, 0, 0)).toBeNull();
    expect(gateTileAt(1, slotOrigin(10) + 290, GATE_OY + 350)).toBe(T.CAVE_WALL);
    const e = gateEntry(1, 10);
    expect(tileAt(1, Math.floor(e.x), Math.floor(e.y), 6)).toBe(gateTileAt(1, Math.floor(e.x), Math.floor(e.y)));
    expect(tileAt(1, Math.floor(e.x), Math.floor(e.y), 5)).toBe(T.UPPER_VOID);
  });

  it('gates open by the day, the same for everyone; they rank higher the farther out they stand', () => {
    const open = () => true;
    const a = gatesNear(9, 12, -1500, -1500, 1500, 1500, open);
    const b = gatesNear(9, 12, -1500, -1500, 1500, 1500, open);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(10);
    expect(gatesNear(9, 13, -1500, -1500, 1500, 1500, open)).not.toEqual(a);
    for (const g of a) {
      expect(g.slot % GATE_RANKS.length).toBe(g.rank);
      expect(Math.hypot(g.x, g.y)).toBeGreaterThan(80);
    }
    const near = a.filter((g) => Math.hypot(g.x, g.y) < 300),
      far = a.filter((g) => Math.hypot(g.x, g.y) > 1100);
    const mean = (l: typeof a) => l.reduce((s, g) => s + g.rank, 0) / Math.max(1, l.length);
    expect(mean(far)).toBeGreaterThan(mean(near));
    // nowhere to stand: no gate
    expect(gatesNear(9, 12, -1500, -1500, 1500, 1500, () => false)).toHaveLength(0);
  });

  it('every rank names real monsters, a real master and real rewards', () => {
    for (const r of GATE_RANK_INFO) {
      for (const k of [...r.pool, r.master]) expect(ENEMY_DEFS[k as keyof typeof ENEMY_DEFS], k).toBeTruthy();
      expect(ITEMS[r.stones.id]).toBeTruthy();
    }
    for (let i = 1; i < GATE_RANK_INFO.length; i++) {
      expect(GATE_RANK_INFO[i]!.level).toBeGreaterThan(GATE_RANK_INFO[i - 1]!.level);
      expect(GATE_RANK_INFO[i]!.coins).toBeGreaterThan(GATE_RANK_INFO[i - 1]!.coins);
    }
  });
});

describe('dungeon gates and shards', () => {
  it('a whole dungeon lies inside one shard region, so one room runs it', async () => {
    const { shardAt } = await import('../src/index');
    for (const seed of [3, 99])
      for (let slot = 0; slot < GATE_SLOTS; slot += 7) {
        const L = gateLayout(seed, slot);
        const home = shardAt(L.ox, GATE_OY);
        for (const r of L.rooms)
          for (const [dx, dy] of [
            [r.r + 3, 0],
            [-r.r - 3, 0],
            [0, r.r + 3],
            [0, -r.r - 3],
          ] as Array<[number, number]>)
            expect(shardAt(L.ox + r.x + dx, GATE_OY + r.y + dy), `${seed} slot ${slot}`).toBe(home);
      }
  });
});
