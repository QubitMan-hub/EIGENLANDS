import { describe, expect, it } from 'vitest';
import {
  ARENA_CELL,
  CHUNK_SIZE,
  OTHERWORLDS,
  OTHERWORLD_IDS,
  T,
  chronoGate,
  isOtherworldY,
  isSolid,
  otherworldArena,
  otherworldArrival,
  otherworldObjectsIn,
  otherworldOf,
  realmPortals,
  roomOf,
  setActiveGeneration,
  tileAt,
  updraftsOf,
  type OtherworldId,
} from '../src/index';

const SEED = 20260101;
setActiveGeneration(SEED, 6);
const tile = (x: number, y: number) => tileAt(SEED, x, y, 6);

/** flood fill over walkable tiles from (x, y), optionally riding updrafts, within the realm's bounds */
function reach(w: OtherworldId, x0: number, y0: number, eyrie = false): Set<string> {
  const def = OTHERWORLDS[w];
  const lim = def.cell * (def.span + 1);
  const ups = w === 'aetheria' ? updraftsOf(SEED).filter((u) => eyrie || !u.eyrie) : [];
  const upAt = new Map(ups.map((u) => [`${u.x},${u.y}`, u]));
  const seen = new Set<string>([`${x0},${y0}`]);
  const q: Array<[number, number]> = [[x0, y0]];
  while (q.length) {
    const [x, y] = q.pop()!;
    const next: Array<[number, number]> = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    // an updraft beside you carries you across
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const u = upAt.get(`${x + dx},${y + dy}`);
      if (u) next.push([Math.floor(u.to.x), Math.floor(u.to.y)]);
    }
    for (const [nx, ny] of next) {
      const k = `${nx},${ny}`;
      if (seen.has(k) || Math.abs(nx) > lim || Math.abs(ny - def.oy) > lim || isSolid(tile(nx, ny))) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

describe('the three realms', () => {
  it('each realm is a plane of its own, far from the surface and every other plane', () => {
    for (const w of OTHERWORLD_IDS) {
      expect(otherworldOf(OTHERWORLDS[w].oy + 100)).toBe(w);
      expect(isOtherworldY(OTHERWORLDS[w].oy)).toBe(true);
    }
    expect(isOtherworldY(0)).toBe(false);
    expect(isOtherworldY(-200000)).toBe(false); // the crypt plane
    // older worlds have nothing out there
    expect(tileAt(SEED, 0, OTHERWORLDS.aetheria.oy + 1, 5)).toBe(T.UPPER_VOID);
  });

  it('Aetheria: every island is reached by sky-road or updraft; the eyrie only by its own updraft', () => {
    const a = otherworldArrival('aetheria');
    const without = reach('aetheria', Math.floor(a.x), Math.floor(a.y));
    const arena = otherworldArena(SEED, 'aetheria');
    expect(without.has(`${arena.x},${arena.y}`)).toBe(false);
    const def = OTHERWORLDS.aetheria;
    for (let gy = -def.span; gy <= def.span; gy++)
      for (let gx = -def.span; gx <= def.span; gx++) {
        if (gx === ARENA_CELL.aetheria[0] && gy === ARENA_CELL.aetheria[1]) continue;
        const r = roomOf(SEED, 'aetheria', gx, gy)!;
        expect(without.has(`${r.x},${r.y + def.oy}`)).toBe(true);
      }
    const withEyrie = reach('aetheria', Math.floor(a.x), Math.floor(a.y), true);
    expect(withEyrie.has(`${arena.x},${arena.y}`)).toBe(true);
    // islands float above the cloud
    expect(tile(arena.x + arena.r + 8, arena.y)).toBe(T.UPPER_VOID);
  });

  it('the Umbral Abyss: one cave network from the arrival to the Maw’s pit, walled in rock', () => {
    const a = otherworldArrival('umbra');
    const seen = reach('umbra', Math.floor(a.x), Math.floor(a.y));
    const arena = otherworldArena(SEED, 'umbra');
    expect(seen.has(`${arena.x},${arena.y}`)).toBe(true);
    const def = OTHERWORLDS.umbra;
    for (let gy = -def.span; gy <= def.span; gy++)
      for (let gx = -def.span; gx <= def.span; gx++) {
        const r = roomOf(SEED, 'umbra', gx, gy)!;
        expect(seen.has(`${r.x},${r.y + def.oy}`)).toBe(true);
      }
  });

  it('Chronoria: the plateau is walkable to the gate and dials; the court beyond the fracture only by the gate', () => {
    const a = otherworldArrival('chronoria');
    const seen = reach('chronoria', Math.floor(a.x), Math.floor(a.y));
    const g = chronoGate(SEED);
    const beside = (p: { x: number; y: number }) =>
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => seen.has(`${p.x + dx!},${p.y + dy!}`));
    expect(beside(g.gate)).toBe(true);
    for (const d of g.dials) expect(beside(d)).toBe(true);
    const arena = otherworldArena(SEED, 'chronoria');
    expect(seen.has(`${arena.x},${arena.y}`)).toBe(false);
    expect(isSolid(tile(arena.x, arena.y + arena.r - 4))).toBe(false); // where the gate sets you down
  });

  it('props stand on open ground, and each realm has its portal home, lore and gathering', () => {
    for (const w of OTHERWORLD_IDS) {
      const def = OTHERWORLDS[w];
      const subs = new Set<string>();
      const lim = Math.ceil((def.cell * (def.span + 1)) / CHUNK_SIZE);
      for (let cy = -lim; cy <= lim; cy++)
        for (let cx = -lim; cx <= lim; cx++)
          for (const o of otherworldObjectsIn(SEED, cx, Math.floor(def.oy / CHUNK_SIZE) + cy)) {
            subs.add(o.sub);
            expect(isSolid(tile(o.x, o.y)), `${w} ${o.sub} at ${o.x},${o.y}`).toBe(false);
          }
      for (const s of ['realm_return', 'realm_lore', 'realm_altar']) expect(subs).toContain(s);
      expect(subs).toContain(w === 'aetheria' ? 'sky_bloom' : w === 'umbra' ? 'umbral_cap' : 'time_sand');
      if (w === 'aetheria') for (const s of ['updraft', 'wind_chime', 'sky_pillar']) expect(subs).toContain(s);
      if (w === 'umbra') for (const s of ['hollow_lamp', 'umbral_obelisk']) expect(subs).toContain(s);
      if (w === 'chronoria')
        for (const s of ['chrono_gate', 'chrono_dial', 'chrono_rift', 'broken_clock']) expect(subs).toContain(s);
    }
    // the surface portals stand on open ground near the spawn
    const spots = realmPortals('test', (x, y) => tileAt(SEED, x, y, 6));
    for (const w of OTHERWORLD_IDS) {
      expect(isSolid(tile(spots[w].x, spots[w].y))).toBe(false);
      expect(Math.hypot(spots[w].x, spots[w].y)).toBeLessThan(110);
    }
  });
});
