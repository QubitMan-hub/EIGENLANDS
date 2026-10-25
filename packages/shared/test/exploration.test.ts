import { expect, it } from 'vitest';
import { CAVE_OY, T, FISH_TABLE, ITEMS, PORTS, NPCS, mulberry32, oceanObjectsIn, rollFish, seaCache, tileAt, toggleShrineLantern, townsFor } from '../src';

it('never offers ocean catches inland or before their fishing skill unlock', () => {
  const r = mulberry32(7), ctx = { season: 1, hour: 22, deep: true, weather: 'clear' as const, level: 1, luck: 0 };
  for (let i = 0; i < 1000; i++) {
    expect(FISH_TABLE.find(f => f.id === rollFish(r, ctx).id)?.oceanOnly).not.toBe(true);
    expect(rollFish(r, { ...ctx, ocean: true }).id).not.toBe('prism_nautilus');
  }
  const fish = new Set(Array.from({ length: 3000 }, () => rollFish(r, { ...ctx, level: 8, ocean: true }).id));
  expect(fish.has('moonray')).toBe(true); expect(fish.has('prism_nautilus')).toBe(true);
  for (const f of FISH_TABLE) expect(ITEMS[f.id]?.kind).toBe('fish');
});

it('places sparse, stable salvage only on clear deep sea, once in its owning chunk', () => {
  let n = 0;
  for (let gy = -9; gy < 9; gy++) for (let gx = -9; gx < 9; gx++) {
    const o = seaCache(1337, gx, gy); if (!o) continue;
    n++;
    expect(tileAt(1337, o.x, o.y)).toBe(T.DEEP_WATER);
    expect(seaCache(1337, gx, gy)).toEqual(o);
    const cx = Math.floor(o.x / 32), cy = Math.floor(o.y / 32);
    expect(oceanObjectsIn(1337, cx, cy)).toEqual([o]);
    expect(oceanObjectsIn(1337, cx + 1, cy)).not.toContainEqual(o);
  }
  expect(n).toBeGreaterThan(5); expect(n).toBeLessThan(70);
  expect(seaCache(1337, 4, Math.floor(CAVE_OY / 96))).toBeNull();
});

it('lantern moves are reversible and all generated move combinations can be solved', () => {
  for (let moves = 0; moves < 16; moves++) {
    let mask = 15;
    for (let i = 0; i < 4; i++) if (moves & (1 << i)) mask = toggleShrineLantern(mask, i);
    for (let i = 0; i < 4; i++) if (moves & (1 << i)) mask = toggleShrineLantern(mask, i);
    expect(mask).toBe(15);
  }
});

it('coastal residents have furnished homes on dry ground and every harbour opens onto the sea', () => {
  expect(NPCS.filter(n => PORTS.some(p=>p.id===n.settlement))).toHaveLength(40);
  const towns = townsFor(1337), merged = Object.assign({}, ...towns.map(t => t.spots));
  for (const [name, position] of Object.entries(towns[0]!.spots)) expect(merged[name], `Hadamere spot ${name} must stay local`).toEqual(position);
  for (const seed of [1337, 20260101]) for (const port of PORTS) {
    const town = townsFor(seed).find(t => t.name === port.name)!;
    expect(town.buildings.length).toBeGreaterThanOrEqual(6);
    for (const b of town.buildings) {
      expect(tileAt(seed, b.doorX, b.doorY)).toBe(T.FLOOR);
      // Built-in furnishings are intentionally static `deco`; workstations retain their functional kind.
      expect(town.objects.filter(o => ['deco', 'furniture', 'station'].includes(o.kind) && o.x > b.x && o.x < b.x + b.w - 1 && o.y > b.y && o.y < b.y + b.h - 1).length).toBeGreaterThanOrEqual(5);
    }
    const startY = port.cy + (port.id === 'lumenport' ? 28 : 21);
    // A hull-wide dredged route reaches well beyond the authored town footprint.
    for (let y = startY; y < port.cy + port.h * 1.3; y++) for (let x = port.cx + 9; x < port.cx + 15; x++) expect([T.WATER, T.DEEP_WATER]).toContain(tileAt(seed, x, y));
    for (let y = port.cy - 3; y <= port.cy; y++) for (let x = port.cx - 20; x < port.cx + 20; x++) expect([T.WATER, T.DEEP_WATER]).not.toContain(tileAt(seed, x, y));
  }
});
