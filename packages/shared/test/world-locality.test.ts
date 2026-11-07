import { describe, expect, it } from 'vitest';
import { caveDistrictHabitat, caveRouteClue, realmRoomInhabitants, realmGatheringChance } from '../src/world-locality';
import { caveRegion, CAVE_OY } from '../src/undercroft';
import { OTHERWORLD_IDS, OTHERWORLDS, roomOf, roomTheme, roomContextAt, otherworldObjectsIn } from '../src/otherworlds';
import { isSolid } from '../src/tiles';
import { tileAt } from '../src/worldgen';

describe('connected cave and realm locality', () => {
  it('uses geology for cave hazards and guardians, with useful directional survey clues', () => {
    const seen = new Set<string>();
    for (const seed of [7, 42, 1337])
      for (let gy = -5; gy <= 5; gy++)
        for (let gx = -5; gx <= 5; gx++) {
          const r = caveRegion(seed, gx, gy, 7),
            h = caveDistrictHabitat(seed, gx, gy, 7);
          seen.add(h.biome);
          expect(h.biome).toBe(r.biome);
          if (h.biome === 'frost') expect(h.guardian).toBe('frost_wraith');
          if (h.biome === 'crystal') expect(h.guardian).toBe('geode_golem');
          if (h.hazard === 'steam') expect(['limestone', 'basalt', 'drowned']).toContain(h.biome);
          expect(caveRouteClue(seed, gx, gy, 7)).toMatch(/North:.*East:.*South:.*West:/);
        }
    expect(seen.size).toBe(6);
  });

  it('selects inhabitants and gathering from the actual room habitat', () => {
    expect(realmRoomInhabitants('umbra', 'flooded')).toEqual(['abyss_serpent']);
    expect(realmRoomInhabitants('umbra', 'fungal')).toEqual(['shade_stalker']);
    expect(realmRoomInhabitants('chronoria', 'clockyard')).toEqual(['gear_hound']);
    expect(realmRoomInhabitants('chronoria', 'stilled')).toEqual(['paradox_echo']);
    expect(realmGatheringChance('aetheria', 'meadow')).toBeGreaterThan(realmGatheringChance('aetheria', 'ruin'));
    expect(realmGatheringChance('umbra', 'fungal')).toBeGreaterThan(realmGatheringChance('umbra', 'ember'));
  });

  it('places actual gathering props preferentially in supporting habitat and keeps legacy props stable', () => {
    let rich = 0,
      richNodes = 0,
      sparse = 0,
      sparseNodes = 0,
      changed = 0;
    for (const seed of [7, 42, 1337])
      for (const w of OTHERWORLD_IDS) {
        const def = OTHERWORLDS[w];
        for (let gy = -def.span; gy <= def.span; gy++)
          for (let gx = -def.span; gx <= def.span; gx++) {
            const r = roomOf(seed, w, gx, gy);
            if (!r) continue;
            const theme = roomTheme(seed, w, r, 7);
            if (!theme) continue;
            const x = r.x + 2,
              y = r.y + def.oy - 2,
              cx = Math.floor(x / 32),
              cy = Math.floor(y / 32);
            const legacy = otherworldObjectsIn(seed, cx, cy, 6);
            const modern = otherworldObjectsIn(seed, cx, cy, 7);
            expect(otherworldObjectsIn(seed, cx, cy, 6)).toEqual(legacy);
            const node = (objects: typeof modern) =>
              objects.some(
                (o) => o.x === x && o.y === y && ['sky_bloom', 'umbral_cap', 'time_sand'].includes(o.sub ?? ''),
              );
            const present = Number(node(modern));
            if (node(legacy) !== !!present) changed++;
            if (realmGatheringChance(w, theme) > 0.9) {
              rich++;
              richNodes += present;
            } else {
              sparse++;
              sparseNodes += present;
            }
          }
      }
    expect(changed).toBeGreaterThan(20);
    expect(richNodes / rich).toBeGreaterThan(sparseNodes / sparse + 0.3);
  });

  it('forms connected habitat patches and preserves explicit legacy themes after generation7 queries', () => {
    for (const seed of [7, 42, 1337])
      for (const w of OTHERWORLD_IDS) {
        const def = OTHERWORLDS[w];
        let same = 0,
          edges = 0;
        const old = new Map<string, string | null>();
        for (let gy = -def.span; gy <= def.span; gy++)
          for (let gx = -def.span; gx <= def.span; gx++) {
            const r = roomOf(seed, w, gx, gy);
            if (!r) continue;
            old.set(`${gx},${gy}`, roomTheme(seed, w, r, 6));
            const t = roomTheme(seed, w, r, 7);
            const c = roomContextAt(seed, w, r.x, r.y + def.oy, 7)!;
            expect(c.room).toEqual(r);
            for (const exit of c.exits) {
              const other = roomOf(seed, w, exit.gx, exit.gy)!;
              if (t && roomTheme(seed, w, other, 7)) {
                edges++;
                if (t === roomTheme(seed, w, other, 7)) same++;
              }
            }
          }
        expect(same / edges).toBeGreaterThan(0.5);
        for (const [key, theme] of old) {
          const [gx, gy] = key.split(',').map(Number);
          expect(roomTheme(seed, w, roomOf(seed, w, gx!, gy!)!, 6)).toBe(theme);
        }
        const arrival = roomContextAt(seed, w, 0, def.oy, 7)!;
        expect(arrival.safe).toBe(true);
        // Signs and resources are on reachable room floors and use existing nonblocking props.
        for (let cy = Math.floor((def.oy - 50) / 32); cy <= Math.floor((def.oy + 50) / 32); cy++)
          for (let cx = -2; cx <= 2; cx++)
            for (const o of otherworldObjectsIn(seed, cx, cy, 7)) {
              expect(isSolid(tileAt(seed, o.x, o.y, 7)), `${w} ${o.sub} ${o.x},${o.y}`).toBe(false);
              if (o.kind === 'sign')
                expect(String(o.data?.text)).toMatch(/Return portal|Hollow|Gathering|Archive|Wind chime|altar/i);
            }
      }
    expect(roomContextAt(7, 'aetheria', 10000, -300000, 7)).toBeNull();
    expect(CAVE_OY).toBe(40000);
  });
});
