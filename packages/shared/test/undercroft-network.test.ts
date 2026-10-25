import { expect, it } from 'vitest';
import { caveRegion, caveRoutes, caveWaystation, CAVE_OY, CAVE_CELL } from '../src/undercroft';
import { caveTileAt, caveOfCell } from '../src/caves';
import { isSolid, findPath } from '../src';
it('preserves old mouth coordinates while joining broad dry routes across district boundaries', () => {
  expect(caveOfCell(1337, 0, -2)).toEqual({ id: 'cv0_-2', x: 20, y: -134, biome: 'enchanted' });
  for (const seed of [7, 1337, 2026])
    for (const [gx, gy] of [
      [0, 0],
      [-2, -1],
      [3, 2],
    ]) {
      const a = caveRegion(seed, gx, gy),
        b = caveRegion(seed, gx + 1, gy),
        solid = (x: number, y: number) => isSolid(caveTileAt(seed, x, y));
      expect(findPath(a.x, a.y, b.x, b.y, solid, 8000)).not.toBeNull();
      for (const p of caveRoutes(seed, gx, gy).flat()) expect(solid(Math.round(p.x), Math.round(p.y))).toBe(false);
      const lift = caveWaystation(seed, gx, gy);
      if (lift) expect(solid(lift.x, lift.y)).toBe(false);
    }
});
it('creates genuinely large traversable rooms and bounded nearby exit spacing', () => {
  for (let gx = -2; gx <= 2; gx++) {
    const r = caveRegion(733, gx, 1);
    let open = 0;
    for (let y = r.y - 10; y <= r.y + 10; y++)
      for (let x = r.x - 10; x <= r.x + 10; x++) if (!isSolid(caveTileAt(733, x, y))) open++;
    expect(open).toBeGreaterThan(300);
  }
  expect(CAVE_CELL).toBe(72);
  expect(CAVE_OY).toBe(40000);
});

import { caveExitsNear, CAVE_TOWNS, CAVE_RESIDENTS } from '../src/undercroft';
import { caveLanding, caveObjectsIn, caveShaftOfCell } from '../src/caves';
import {
  townsFor,
  tileAt,
  sanctuaryAt,
  shrineOfId,
  shrinesNear,
  shrineObjectsIn,
  spawnTable,
  ENEMY_DEFS,
  NPC_BY_ID,
  QUESTS,
  BOSSES,
  ITEMS,
  recipeById,
  ChunkStore,
  T,
  DIVE_OY,
} from '../src';
it('keeps exits real, dry, reachable and bounded even a long way from the entry', () => {
  for (const seed of [7, 1337, 20260101])
    for (const [x, ly] of [
      [40, 40],
      [1200, 1200],
      [-1200, 400],
      [270, -180],
    ]) {
      const exit = caveExitsNear(seed, x, ly + CAVE_OY)[0]!;
      expect(Math.hypot(exit.x - x, exit.y - ly - CAVE_OY)).toBeLessThan(160);
      const objects = caveObjectsIn(seed, Math.floor(exit.x / 32), Math.floor(exit.y / 32));
      expect(
        objects.some((o) => o.sub === 'cave_lift' && o.data?.cave === exit.id) ||
          townsFor(seed).some((t) => t.objects.some((o) => o.data?.cave === exit.id)),
      ).toBe(true);
      const up = caveLanding(seed, exit.id, false)!;
      expect(isSolid(tileAt(seed, Math.floor(up.x), Math.floor(up.y)))).toBe(false);
      const land = caveLanding(seed, exit.id, true)!;
      expect(isSolid(tileAt(seed, Math.floor(land.x), Math.floor(land.y)))).toBe(false);
    }
  for (let gx = -3; gx < 4; gx++)
    for (let gy = -3; gy < 4; gy++) {
      const m = caveShaftOfCell(1337, gx, gy);
      if (!m) continue;
      expect(caveLanding(1337, m.id, true)).not.toBeNull();
      expect(isSolid(tileAt(1337, m.x, m.y))).toBe(false);
    }
});
it('connects cave towns to the network, wards only occupied towns and gives every resident a home and quest', () => {
  for (const seed of [7, 1337])
    for (const t of townsFor(seed).filter((t) => CAVE_TOWNS.some((d) => d.name === t.name))) {
      expect(!!sanctuaryAt(seed, t.cx, t.cy)).toBe(!t.abandoned);
      const r = caveRegion(seed, Math.floor(t.cx / 72), Math.floor((t.cy - CAVE_OY) / 72));
      expect(findPath(t.cx, t.cy, r.x, r.y, (x, y) => isSolid(tileAt(seed, x, y)), 10000)).not.toBeNull();
    }
  expect(CAVE_RESIDENTS).toHaveLength(16);
  for (const n of CAVE_RESIDENTS) {
    const npc = NPC_BY_ID[n.id]!;
    expect(npc).toBeTruthy();
    expect(QUESTS.some((q) => q.giver === n.id)).toBe(true);
    const home = townsFor(1337)
      .map((t) => t.spots[npc.home])
      .find(Boolean)!;
    expect(home).toBeTruthy();
    expect(isSolid(tileAt(1337, home.x, home.y))).toBe(false);
  }
});
it('installs persistent shrine challenges, varied habitat enemies and a craftable arena boss', () => {
  const types = new Set();
  for (let gx = -8; gx <= 8; gx++)
    for (let gy = -5; gy <= 8; gy++) {
      const r = caveRegion(1337, gx, gy),
        sh = shrineOfId(1337, `cs${gx}_${gy}`);
      if (!sh) continue;
      types.add(sh.type);
      expect(shrinesNear(1337, sh.x, sh.y, 4).some((s) => s.id === sh.id)).toBe(true);
      for (const [dx, dy] of [[0, 0], ...sh.pillars]) {
        expect(isSolid(tileAt(1337, sh.x + dx, sh.y + dy))).toBe(false);
        expect(
          shrineObjectsIn(1337, Math.floor((sh.x + dx) / 32), Math.floor((sh.y + dy) / 32)).some(
            (o) => o.x === sh.x + dx && o.y === sh.y + dy,
          ),
        ).toBe(true);
      }
      expect(r.feature).toBe('puzzle');
    }
  expect(types.size).toBe(5);
  expect(spawnTable(6, false, 'meadow', true, 'frost').map((e) => e.kind)).toContain('rime_skitter');
  expect(spawnTable(6, false, 'meadow', true, 'glowmoss').map((e) => e.kind)).toContain('spore_sage');
  expect(new Set(Object.values(ENEMY_DEFS).map((e) => e.kind)).size).toBe(Object.keys(ENEMY_DEFS).length);
  expect(BOSSES.bellkeeper.kind).toBe(ENEMY_DEFS.bellkeeper.kind);
  expect(ITEMS.deep_sigil).toBeTruthy();
  expect(recipeById('deep_sigil')).toBeTruthy();
});
it('keeps existing mined edits authoritative over the upgraded base terrain', () => {
  const store = new ChunkStore(1337);
  const r = caveRegion(1337, 5, 5);
  store.get(Math.floor(r.x / 32), Math.floor(r.y / 32));
  store.setTile(r.x, r.y, T.CAVE_WALL);
  expect(store.getTile(r.x, r.y)).toBe(T.CAVE_WALL);
});

it('never produces an empty spawn table at progression gates', () => {
  for (const b of ['limestone', 'glowmoss', 'crystal', 'basalt', 'frost', 'drowned'] as const)
    for (let level = 1; level < 15; level++)
      expect(spawnTable(level, false, 'meadow', true, b).length).toBeGreaterThan(0);
});

it('keeps cave residents home and workplace reachable through furnished rooms', () => {
  const store = new ChunkStore(1337);
  for (const n of CAVE_RESIDENTS) {
    const town = townsFor(1337).find((t) => t.spots[`${n.id}.home`])!;
    for (const target of ['home', 'work']) {
      const p = town.spots[`${n.id}.${target}`]!;
      expect(store.solidAt(p.x, p.y), `${n.id}.${target}`).toBe(false);
      expect(findPath(town.cx, town.cy, p.x, p.y, store.solidAt, 10000), `${n.id}.${target}`).not.toBeNull();
    }
  }
});

it('does not leak survey cave objects onto the underwater plane', () => {
  const store = new ChunkStore(1337);
  for (let cy = Math.floor(DIVE_OY / 32) - 1; cy <= Math.floor(DIVE_OY / 32) + 1; cy++)
    for (let cx = -1; cx <= 1; cx++)
      expect(store.townObjectsIn(cx, cy).some((o) => o.sub.startsWith('cave_'))).toBe(false);
});
