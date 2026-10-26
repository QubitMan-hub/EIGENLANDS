import { expect, it } from 'vitest';
import {
  ChunkStore,
  frontierSite,
  frontierTown,
  frontierTownAt,
  frontierTownsNear,
  FRONTIER_CELL,
  generationMeta,
  generateChunk,
  sanctuaryAt,
  townTileAt,
  T,
  objSolid,
} from '../src';
const seed = 20260101;
const sites = () => {
  const out = [];
  for (let y = -6; y <= 2; y++)
    for (let x = -6; x <= 6; x++) {
      const s = frontierSite(seed, x, y);
      if (s) out.push(s);
    }
  return out;
};
it('finds distinct deterministic settlements well beyond the named continents in both directions', () => {
  const found = sites();
  expect(found.length).toBeGreaterThan(10);
  expect(new Set(found.map((s) => s.realm)).size).toBe(6);
  expect(found.some((s) => s.cx < -3000)).toBe(true);
  expect(found.some((s) => s.cx > 3000)).toBe(true);
  for (const s of found) {
    expect(frontierSite(seed, Math.floor(s.cx / FRONTIER_CELL), Math.floor(s.cy / FRONTIER_CELL))).toEqual(s);
    expect(Math.abs(s.cx % 256)).toBe(0);
    expect(Math.abs(s.cy % 256)).toBe(0);
  }
});
it('pins saved revisions and keeps city geometry absent before revision 6', () => {
  const s = sites()[0]!;
  expect(generationMeta({ version: 5 }, { fresh: 6, hasWorldData: true })).toEqual({ version: 5 });
  expect(frontierTownsNear(seed, s.cx - 100, s.cy - 100, s.cx + 100, s.cy + 100, 5)).toEqual([]);
  expect(townTileAt(seed, s.cx, s.cy, 5)).toBeNull();
  expect(frontierTownAt(seed, s.cx, s.cy, 6)?.site?.id).toBe(s.id);
});
it('furnishes frontier homes and services, streams their objects and preserves clear doors and level streets', () => {
  for (const s of sites().slice(0, 6)) {
    const t = frontierTown(seed, s),
      store = new ChunkStore(seed, 80, 6);
    expect(t.buildings.length).toBeGreaterThan(5);
    const keys = new Set<string>();
    for (const o of t.objects) {
      const key = `${o.x},${o.y}`;
      expect(keys.has(key), `${s.id} duplicate ${key}`).toBe(false);
      keys.add(key);
    }
    for (const b of t.buildings) {
      const inside = t.objects.filter((o) => o.x > b.x && o.x < b.x + b.w - 1 && o.y > b.y && o.y < b.y + b.h - 1);
      expect(inside.length, `${b.id} furnished`).toBeGreaterThan(0);
      expect(store.getTile(b.doorX, b.doorY)).toBe(T.FLOOR);
      expect(store.solidAt(b.doorX, b.doorY), `${b.id} door`).toBe(false);
      expect(store.levelAt(b.doorX, b.doorY)).toBe(0);
      expect(
        inside.every((o) => !(Math.abs(o.x - b.doorX) <= 1 && o.y >= b.doorY - 2 && objSolid(o.kind, o.sub))),
      ).toBe(true);
      const o = inside[0]!;
      store.get(Math.floor(o.x / 32), Math.floor(o.y / 32));
      expect(store.objectAt(o.x, o.y)?.static).toBe(true);
    }
    expect(sanctuaryAt(seed, s.cx, s.cy)?.name).toBe(t.name);
    const cx = Math.floor(s.cx / 32),
      cy = Math.floor(s.cy / 32);
    expect(generateChunk(seed, cx, cy, 6)).toEqual(generateChunk(seed, cx, cy, 6));
  }
}, 30000);
it('invalidates a cached level pointer when its chunk is evicted', () => {
  const s = new ChunkStore(42, 1, 3);
  const first = s.get(0, 0);
  first.levels!.fill(2);
  expect(s.levelAt(0, 0)).toBe(2);
  s.get(2, 2);
  const next = s.get(0, 0);
  next.levels!.fill(4);
  expect(s.levelAt(0, 0)).toBe(4);
});
