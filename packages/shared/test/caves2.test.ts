import { describe, expect, it } from 'vitest';
import {
  CAVE_OY,
  caveFeatureObjects2,
  caveRegion,
  caveWaystation,
  delverCampOf,
  generateLevels,
  isSolid,
  mineLineOfRegion,
  mouthsNear,
  tileAt,
  vaultLayout,
  vaultOf,
  T,
} from '../src';

const gen = 4 as const;
const open = (seed: number, x: number, y: number) => !isSolid(tileAt(seed, x, y, gen));

/** Flood fill across a box of districts from a seed tile; returns the visited set. */
function flood(seed: number, sx: number, sy: number, x0: number, y0: number, x1: number, y1: number) {
  const seen = new Set<number>(),
    W = x1 - x0 + 1;
  const key = (x: number, y: number) => x - x0 + (y - y0) * W;
  const q: Array<[number, number]> = [[sx, sy]];
  seen.add(key(sx, sy));
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || seen.has(key(nx, ny)) || !open(seed, nx, ny)) continue;
      seen.add(key(nx, ny));
      q.push([nx, ny]);
    }
  }
  return { seen, key };
}

describe('Undercroft 2 terrain', () => {
  for (const seed of [1, 7, 20260101, 987654]) {
    it(`connects every district centre and ladder landing (seed ${seed})`, () => {
      const R = 3,
        x0 = -R * 72,
        y0 = CAVE_OY - R * 72,
        x1 = (R + 1) * 72 - 1,
        y1 = CAVE_OY + (R + 1) * 72 - 1;
      const c0 = caveRegion(seed, 0, 0, gen);
      expect(open(seed, c0.x, c0.y)).toBe(true);
      const { seen, key } = flood(seed, c0.x, c0.y, x0, y0, x1, y1);
      const missing: string[] = [];
      for (let gy = -R + 1; gy < R; gy++)
        for (let gx = -R + 1; gx < R; gx++) {
          const r = caveRegion(seed, gx, gy, gen);
          if (!seen.has(key(r.x, r.y))) missing.push(`centre ${gx},${gy}`);
          const lift = caveWaystation(seed, gx, gy);
          if (lift && open(seed, lift.x, lift.y) && !seen.has(key(lift.x, lift.y))) missing.push(`lift ${gx},${gy}`);
        }
      for (const m of mouthsNear(seed, 0, 0, 200)) {
        const x = m.x,
          y = m.y + CAVE_OY + 1;
        if (x > x0 && x < x1 && y > y0 && y < y1 && !seen.has(key(x, y))) missing.push(`mouth ${m.id}`);
      }
      // authored content: rail lines, delver camps and vault interiors are all reachable on foot
      for (let gy = -R + 1; gy < R; gy++)
        for (let gx = -R + 1; gx < R; gx++) {
          const line = mineLineOfRegion(seed, gx, gy);
          if (line)
            for (const t of line.tiles) {
              if (!open(seed, t.x, t.y)) missing.push(`rail ${line.id} ${t.x},${t.y}`);
              else if (!seen.has(key(t.x, t.y))) missing.push(`rail unreachable ${line.id}`);
            }
          const camp = delverCampOf(seed, gx, gy);
          if (camp && !seen.has(key(camp.stall.x, camp.stall.y))) missing.push(`camp ${camp.id}`);
          const vault = vaultOf(seed, gx, gy);
          if (vault) {
            const lay = vaultLayout(vault);
            if (vault.kind === 'trial' && !seen.has(key(lay.cache.x, lay.cache.y))) missing.push(`vault ${vault.id}`);
            // the doorway is either open (trial) or choked with boulders (sealed): its outer apron is always reachable
            const door = vault.door[1]!,
              out = [
                [2, 0],
                [0, 2],
                [-2, 0],
                [0, -2],
              ][vault.side]!;
            if (!seen.has(key(door.x + out[0]!, door.y + out[1]!))) missing.push(`vault apron ${vault.id}`);
          }
        }
      expect(missing).toEqual([]);
    });
  }

  it('keeps cave terraces walkable: no cliffs, flat camps and vaults', () => {
    for (const seed of [3, 20260101]) {
      let max = 0,
        raised = 0;
      const chunks = new Map<string, Uint8Array>();
      const lv = (x: number, y: number) => {
        const cx = Math.floor(x / 32),
          cy = Math.floor(y / 32),
          k = `${cx},${cy}`;
        let c = chunks.get(k);
        if (!c) chunks.set(k, (c = generateLevels(seed, cx, cy, 4)));
        return c[(y - cy * 32) * 32 + (x - cx * 32)]!;
      };
      for (let y = CAVE_OY - 100; y < CAVE_OY + 220; y += 1)
        for (let x = -120; x < 260; x += 1) {
          const a = lv(x, y);
          if (a > 0) raised++;
          max = Math.max(max, Math.abs(a - lv(x + 1, y)), Math.abs(a - lv(x, y + 1)));
        }
      expect(max).toBeLessThanOrEqual(1);
      expect(raised).toBeGreaterThan(500);
      for (let gy = -3; gy <= 3; gy++)
        for (let gx = -3; gx <= 3; gx++) {
          const r = caveRegion(seed, gx, gy, 4);
          expect(lv(r.x, r.y)).toBe(0);
          const v = vaultOf(seed, gx, gy);
          if (v) expect(lv(Math.floor((v.x0 + v.x1) / 2), Math.floor((v.y0 + v.y1) / 2))).toBe(0);
        }
    }
  });

  it('spreads the authored features evenly across the lattice', () => {
    const seed = 5;
    const counts = new Map<string, number>();
    for (let gy = -6; gy < 6; gy++)
      for (let gx = -6; gx < 6; gx++) {
        const f = caveRegion(seed, gx, gy, 4).feature;
        counts.set(f, (counts.get(f) ?? 0) + 1);
      }
    // 144 districts in sixteen 3x3 blocks: every kind appears at least once per block
    for (const f of ['lake', 'ruins', 'secret', 'puzzle', 'vents', 'arena', 'grove'])
      expect(counts.get(f) ?? 0).toBeGreaterThanOrEqual(14);
    // no boss arena right beside the start
    for (let gy = -1; gy <= 1; gy++)
      for (let gx = -1; gx <= 1; gx++) expect(caveRegion(seed, gx, gy, 4).feature).not.toBe('arena');
  });

  it('places camps, boss rooms and vault interiors on open ground', () => {
    const seed = 11;
    let camps = 0,
      arenas = 0,
      chests = 0;
    for (let gy = -3; gy <= 3; gy++)
      for (let gx = -3; gx <= 3; gx++) {
        const r = caveRegion(seed, gx, gy, 4);
        if (r.feature === 'ruins') camps++;
        if (r.feature === 'arena') {
          arenas++;
          expect(tileAt(seed, r.x, r.y, 4)).toBe(T.VAULT_FLOOR);
        }
      }
    for (let cy = -6; cy <= 6; cy++)
      for (let cx = -8; cx <= 8; cx++)
        for (const o of caveFeatureObjects2(seed, cx, Math.floor(CAVE_OY / 32) + cy))
          if (o.sub === 'ruin_cache' && (o.data as { vault?: string }).vault) {
            chests++;
            expect(isSolid(tileAt(seed, o.x, o.y, 4))).toBe(false);
          }
    expect(camps).toBeGreaterThan(5);
    expect(arenas).toBeGreaterThanOrEqual(3);
    expect(chests).toBeGreaterThan(0);
  });

  it('is deterministic and has real variety', () => {
    const counts = new Map<number, number>();
    for (let y = 0; y < 200; y++)
      for (let x = 0; x < 200; x++) {
        const t = tileAt(5, x + 100, CAVE_OY + y + 100, gen);
        expect(t).toBe(tileAt(5, x + 100, CAVE_OY + y + 100, gen));
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    expect(counts.get(T.CAVE_FLOOR)).toBeGreaterThan(2000);
    expect(counts.get(T.CAVE_WALL)).toBeGreaterThan(2000);
  });
});
