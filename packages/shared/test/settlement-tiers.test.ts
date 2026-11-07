import { describe, expect, it } from 'vitest';
import { frontierSite, frontierTown, frontierSitesNear, frontierLevel } from '../src/frontier';
import * as frontier from '../src/frontier';
import { buildRealmTown } from '../src/realm-towns';
import { residentsOfSite, realmNpcs } from '../src/realm-npcs';
import * as residentDefs from '../src/realm-npcs';
import { KINGDOMS } from '../src/kingdoms';
import { REALM_IDS, type RealmSite } from '../src/realms';
import { SETTLEMENT_PROFILES, SETTLEMENT_TIERS } from '../src/settlement-tiers';
import { T, isSolid } from '../src/tiles';
import { objSolid, propFootprint } from '../src/objects';

const seeds = [42, 20260101, 987654];
const tiers = ['village', 'town', 'medium_town', 'big_town', 'capital'];
function sites(seed: number, generation: number) {
  const found: RealmSite[] = [];
  for (let y = -9; y <= -2; y++)
    for (let x = -9; x <= 9; x++) {
      const s = frontierSite(seed, x, y, generation);
      if (s) found.push(s);
    }
  return found;
}

function assertAccessible(t: ReturnType<typeof buildRealmTown>, seed: number, tier: string) {
  const w = t.x1 - t.x0 + 1;
  const tile = (x: number, y: number) => t.tiles.get(x - t.x0 + (y - t.y0) * w) ?? T.GRASS;
  const blocked = new Set<number>();
  const key = (x: number, y: number) => x - t.x0 + (y - t.y0) * w;
  for (const o of t.objects)
    if (objSolid(o.kind, o.sub)) {
      blocked.add(key(o.x, o.y));
      for (const [x, y] of propFootprint(o.sub, o.x, o.y, tile)) blocked.add(key(x, y));
    }
  const seen = new Set<number>([key(t.cx, t.cy)]),
    q = [[t.cx, t.cy]];
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ]) {
      const nx = x! + dx!,
        ny = y! + dy!,
        k = key(nx, ny);
      if (
        nx < t.x0 ||
        nx > t.x1 ||
        ny < t.y0 ||
        ny > t.y1 ||
        seen.has(k) ||
        blocked.has(k) ||
        isSolid(tile(nx, ny)) ||
        [T.WATER, T.DEEP_WATER, T.LAVA].includes(tile(nx, ny) as typeof T.WATER)
      )
        continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  for (const b of t.buildings) {
    expect(seen.has(key(b.doorX, b.doorY)), `${seed} ${tier} ${b.id} door`).toBe(true);
    expect(seen.has(key(b.doorX, b.doorY + 1)), `${seed} ${tier} ${b.id} approach`).toBe(true);
  }
  for (const [name, p] of Object.entries(t.spots))
    expect(seen.has(key(p.x, p.y)), `${seed} ${tier} ${name}`).toBe(true);
}

describe('generation 7 settlement tiers', () => {
  it('discovers five reproducible tiers with increasing footprints and resident populations across seeds', () => {
    for (const seed of seeds) {
      const found = sites(seed, 7);
      expect(new Set(found.map((s) => s.tier)).size).toBe(5);
      let area = 0,
        population = 0;
      for (const tier of tiers) {
        const s = found.find((s) => s.tier === tier)!;
        expect(s.w * s.h).toBeGreaterThan(area);
        expect(residentsOfSite(s).length).toBeGreaterThan(population);
        area = s.w * s.h;
        population = residentsOfSite(s).length;
        expect(frontierSite(seed, Math.floor(s.cx / 1536), Math.floor(s.cy / 1536), 7)).toEqual(s);
      }
    }
  });

  it('uses richer named rosters and gives frontier capitals their own provincial court', () => {
    const legacy = realmNpcs(6);
    expect(realmNpcs(7).length).toBeGreaterThan(legacy.length);
    expect(realmNpcs(6)).toBe(legacy);
    const capitals = sites(42, 7)
      .filter((s) => s.tier === 'capital')
      .slice(0, 2);
    for (const s of capitals) {
      const court = residentsOfSite(s);
      const ruler = court.find((p) => p.role === 'ruler')!;
      expect(ruler.name).not.toBe(KINGDOMS[s.realm].ruler.name);
      expect(ruler.title).toBe('Provincial Governor');
      expect(court.every((p) => p.id.startsWith(s.id))).toBe(true);
    }
  });

  it('recognizes generated residents for bounded profile persistence', () => {
    expect(typeof residentDefs.isProceduralResidentId).toBe('function');
    expect(residentDefs.isProceduralResidentId('aurelion_ntown_hand0')).toBe(true);
    expect(residentDefs.isProceduralResidentId('frontier_-12_31_guard2')).toBe(true);
    expect(residentDefs.isProceduralResidentId('frontier_-12_31_town_guard0')).toBe(true);
    expect(residentDefs.isProceduralResidentId('frontier_12345678_31_hand0')).toBe(false);
    expect(residentDefs.isProceduralResidentId('frontier_-12_31_hand99999')).toBe(false);
    expect(residentDefs.isProceduralResidentId('invented')).toBe(false);
  });

  it('isolates legacy sites and geometry when the same seed alternates generations', () => {
    const a = sites(42, 6)[0]!;
    const legacy = frontierTown(42, a, 6);
    const rx = Math.floor(a.cx / 1536),
      ry = Math.floor(a.cy / 1536);
    const next = frontierSite(42, rx, ry, 7)!;
    expect(next.tier).toBeDefined();
    expect(a.tier).toBeUndefined();
    expect(frontierTown(42, next, 7)).not.toBe(legacy);
    expect(frontierSite(42, rx, ry, 6)).toBe(a);
    expect(frontierTown(42, a, 6)).toBe(legacy);
  });

  it('builds increasing housing, useful services, fields and defenses with object-aware accessible doors', () => {
    for (const seed of seeds) {
      const found = sites(seed, 7);
      let buildings = 0;
      for (const tier of tiers) {
        const site = found.find((s) => s.tier === tier)!;
        const t = frontierTown(seed, site, 7);
        expect(t.buildings.length, `${seed} ${tier} building progression`).toBeGreaterThan(buildings);
        buildings = t.buildings.length;
        expect(t.buildings.filter((b) => b.kind === 'house').length, `${tier} homes`).toBeGreaterThanOrEqual(
          tier === 'village' ? 3 : tier === 'town' ? 6 : tier === 'medium_town' ? 12 : tier === 'big_town' ? 22 : 30,
        );
        expect([...t.tiles.values()].filter((v) => v === T.TILLED).length, `${tier} fields`).toBeGreaterThan(10);
        expect(
          t.buildings.some((b) => b.kind === 'store'),
          `${tier} merchant`,
        ).toBe(true);
        if (tier !== 'village')
          expect(
            t.buildings.some((b) => b.kind === 'inn'),
            `${tier} inn`,
          ).toBe(true);
        if (tier === 'medium_town' || tier === 'big_town' || tier === 'capital') {
          expect(
            t.buildings.some((b) => b.kind === 'smithy'),
            `${tier} smithy`,
          ).toBe(true);
          expect(
            t.buildings.some((b) => b.kind === 'tower'),
            `${tier} defense`,
          ).toBe(true);
        }
        if (tier === 'capital') expect(t.buildings.some((b) => /\.(keep|palace)$/.test(b.id))).toBe(true);
        assertAccessible(t, seed, tier);
      }
    }
  }, 30000);

  it('keeps housing and services viable in every kingdom architecture across seeds', () => {
    for (const seed of [42, 20260101])
      for (const realm of REALM_IDS) {
        let previous = 0;
        for (const tier of SETTLEMENT_TIERS) {
          const profile = SETTLEMENT_PROFILES[tier];
          const t = buildRealmTown(
            {
              id: `check_${realm}_${tier}`,
              realm,
              kind: tier === 'capital' ? 'capital' : tier === 'village' ? 'village' : 'town',
              tier,
              cx: 10000,
              cy: -10000,
              w: profile.w,
              h: profile.h,
              ring: 'c',
            },
            seed,
            7,
          );
          expect(t.buildings.length, `${seed} ${realm} ${tier} physical progression`).toBeGreaterThan(previous);
          previous = t.buildings.length;
          expect(
            t.buildings.filter((b) => b.kind === 'house').length,
            `${seed} ${realm} ${tier} housing`,
          ).toBeGreaterThanOrEqual(
            tier === 'village' ? 3 : tier === 'town' ? 6 : tier === 'medium_town' ? 12 : tier === 'big_town' ? 22 : 30,
          );
          expect(
            t.buildings.some((b) => b.kind === 'store'),
            `${realm} ${tier} store`,
          ).toBe(true);
          if (tier !== 'village')
            expect(
              t.buildings.some((b) => b.kind === 'inn'),
              `${realm} ${tier} inn`,
            ).toBe(true);
          assertAccessible(t, seed, `${realm} ${tier}`);
        }
      }
  }, 60000);

  it('gives provincial capitals reachable satellite villages and towns with level connecting roads', () => {
    for (const seed of seeds) {
      const capital = sites(seed, 7).find((s) => s.tier === 'capital')!;
      const province = frontierSitesNear(
        seed,
        capital.cx - 300,
        capital.cy - 150,
        capital.cx + 300,
        capital.cy + 150,
        7,
      );
      const children = province.filter((s) => s.parentId === capital.id);
      expect(children.length).toBe(2);
      expect(new Set(children.map((s) => s.tier))).toEqual(new Set(['village', 'town']));
      expect(typeof frontier.frontierRoadAt).toBe('function');
      for (const child of children) {
        expect(child.realm).toBe(capital.realm);
        expect(Math.abs(child.cx - capital.cx)).toBeGreaterThan((child.w + capital.w) / 2);
        expect(frontierSitesNear(seed, child.cx, child.cy, child.cx, child.cy, 7).map((s) => s.id)).toContain(child.id);
        for (let x = Math.min(child.cx, capital.cx); x <= Math.max(child.cx, capital.cx); x += 8) {
          expect(frontier.frontierRoadAt(seed, x, capital.cy, 7)).toBe(T.PATH);
          expect(frontierLevel(seed, x, capital.cy, 6, 7)).toBe(0);
        }
        expect(frontier.frontierRoadAt(seed, child.cx, child.cy, 6)).toBeNull();
        expect(residentDefs.isProceduralResidentId(`${child.id}_merchant`)).toBe(true);
      }
    }
  });

  it('varies layouts within each tier without losing determinism or bounded output', () => {
    for (const tier of tiers) {
      const layouts: string[] = [];
      for (const seed of seeds) {
        const s = sites(seed, 7).find((s) => s.tier === tier)!;
        const a = frontierTown(seed, s, 7),
          b = buildRealmTown(s, seed, 7);
        expect(b.buildings).toEqual(a.buildings);
        expect(b.tiles).toEqual(a.tiles);
        expect(a.buildings.length).toBeLessThan(130);
        expect(a.objects.length).toBeLessThan(5000);
        layouts.push(a.buildings.map((b) => `${b.x - a.x0},${b.y - a.y0},${b.w},${b.h}`).join(';'));
      }
      expect(new Set(layouts).size).toBe(3);
    }
  }, 30000);
});
