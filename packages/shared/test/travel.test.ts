import { describe, expect, it } from 'vitest';
import {
  ChunkStore,
  REALM_IDS,
  arrivalOf,
  canTravel,
  newPlayerSim,
  sanitizeCmd,
  stepPlayer,
  travelCost,
  waystoneById,
  waystoneObjectsIn,
  waystonesNear,
  wayfarerRank,
  type Waystone,
} from '../src/index';

const SEED = 20260101;
const all = waystonesNear(SEED, 0, 0, 1700, 6);

describe('the waystone network', () => {
  const all = waystonesNear(SEED, 0, 0, 1700, 6);
  it('stands in every kingdom: a gate in each capital and Hadamere, ferries and wild stones', () => {
    expect(all.filter((s) => s.kind === 'gate' && s.net === 'home').length).toBe(1);
    for (const realm of REALM_IDS) {
      const mine = all.filter((s) => s.net === realm);
      expect(
        mine.some((s) => s.kind === 'gate'),
        `${realm} gate`,
      ).toBe(true);
      expect(
        mine.some((s) => s.kind === 'harbor'),
        `${realm} ferry`,
      ).toBe(true);
      expect(mine.filter((s) => s.wild).length, `${realm} wild`).toBeGreaterThan(3);
    }
    // older worlds have the home network too
    expect(waystonesNear(SEED, 0, 0, 400, 2).some((s) => s.kind === 'gate')).toBe(true);
  });
  it('ids are stable and resolve back to the same stone; placement is deterministic', () => {
    for (const s of all.slice(0, 80)) expect(waystoneById(SEED, s.id, 6)).toEqual(s);
    expect(waystonesNear(SEED, 0, 0, 1700, 6).map((s) => s.id)).toEqual(all.map((s) => s.id));
    expect(waystoneById(SEED, 'w:1:2', 6)).toBeNull();
    expect(waystoneById(SEED, 'nonsense', 6)).toBeNull();
  });
  it('every stone is a solid object on open ground with a walkable arrival tile in front of it', () => {
    const store = new ChunkStore(SEED, 400, 6);
    const sample = all.filter((s, i) => !s.wild || i % 4 === 0).slice(0, 60);
    for (const s of sample) {
      const objs = waystoneObjectsIn(SEED, Math.floor(s.x / 32), Math.floor(s.y / 32), 6);
      expect(
        objs.some((o) => o.x === s.x && o.y === s.y && o.data?.way === s.id),
        s.name,
      ).toBe(true);
      expect(store.solidAt(s.x, s.y), `${s.name} solid`).toBe(true);
      const a = arrivalOf(s);
      expect(store.solidAt(Math.floor(a.x), Math.floor(a.y)), `${s.name} arrival`).toBe(false);
    }
  });
  it('travel rules: any stone within a kingdom; between kingdoms only gate or ferry at both ends', () => {
    const home = all.filter((s) => s.net === 'home');
    const away = all.filter((s) => s.net === 'aurelion');
    const pick = (l: Waystone[], k: Waystone['kind']) => l.find((s) => s.kind === k)!;
    const hg = pick(home, 'gate');
    const hw = home
      .filter((s) => s.wild)
      .sort((a, b) => Math.hypot(a.x - hg.x, a.y - hg.y) - Math.hypot(b.x - hg.x, b.y - hg.y))[0]!;
    const [aw, ag, af] = [away.find((s) => s.wild)!, pick(away, 'gate'), pick(away, 'harbor')];
    expect(canTravel(hw, hg)).toBe(true);
    expect(canTravel(hg, hg)).toBe(false);
    expect(canTravel(hw, ag)).toBe(false);
    expect(canTravel(hg, aw)).toBe(false);
    expect(canTravel(hg, ag)).toBe(true);
    expect(canTravel(hg, af)).toBe(true);
    // crossing costs far more than a local hop, and the Wayfarer rank discounts it
    expect(travelCost(hg, ag)).toBeGreaterThan(travelCost(hw, hg) * 3);
    expect(travelCost(hg, ag, 4)).toBeLessThan(travelCost(hg, ag));
    expect(wayfarerRank(0)).toBe(0);
    expect(wayfarerRank(14)).toBe(2);
    expect(wayfarerRank(400)).toBe(4);
  });
});

describe('riding and roads', () => {
  const open = Object.assign(() => false, {});
  const road = Object.assign(() => false, { road: () => true });
  const run = (mount: number, land: typeof open, steps = 40) => {
    const p = { ...newPlayerSim(0, 0), mount };
    for (let i = 0; i < steps; i++) stepPlayer(p, sanitizeCmd({ seq: 1, dx: 1 }), land);
    return p;
  };
  it('a horse is much faster than walking, the Stag faster still, and roads speed everyone', () => {
    const walk = run(0, open).x,
      horse = run(1, open).x,
      stag = run(2, open).x;
    expect(horse).toBeGreaterThan(walk * 1.5);
    expect(stag).toBeGreaterThan(horse * 1.1);
    expect(run(0, road).x).toBeGreaterThan(walk * 1.08);
    expect(run(1, road).x).toBeGreaterThan(horse * 1.15);
  });
  it('no dashing or sprinting from the saddle; attacking steps you down first', () => {
    const p = { ...newPlayerSim(0, 0), mount: 1 };
    expect(stepPlayer(p, sanitizeCmd({ seq: 1, dx: 1, dash: true }), open).dashed).toBe(false);
    stepPlayer(p, sanitizeCmd({ seq: 2, dx: 1, sprint: true }), open);
    expect(p.sprint).toBe(0);
    const ev = stepPlayer(p, sanitizeCmd({ seq: 3, attack: true }), open);
    expect(p.mount).toBe(0);
    expect(ev.attacked).toBe(true);
  });
});

describe('road caravans', () => {
  it('one per kingdom road, resting outside each settlement and rolling along the road between', async () => {
    const { caravanRoutes, caravanAt, caravanStock, tileAt, T, ITEMS } = await import('../src/index');
    const routes = caravanRoutes(SEED);
    expect(routes.length).toBe(24);
    let samples = 0,
      onRoad = 0;
    for (const r of routes.slice(0, 8)) {
      expect(r.stops.length).toBe(4);
      expect(r.stops.map((s) => s.d)).toEqual([...r.stops.map((s) => s.d)].sort((a, b) => a - b));
      for (let t = 0; t < r.period * 1000; t += 9000) {
        const p = caravanAt(SEED, r, t);
        // deterministic: the same moment gives the same place
        expect(caravanAt(SEED, r, t)).toEqual(p);
        samples++;
        if (tileAt(SEED, Math.floor(p.x), Math.floor(p.y), 6) === T.PATH) onRoad++;
        if (!p.moving) expect(tileAt(SEED, Math.floor(p.x), Math.floor(p.y), 6)).toBe(T.PATH);
      }
      const stock = caravanStock(SEED, r, 12);
      expect(stock.length).toBeGreaterThanOrEqual(8);
      for (const s of stock) expect(ITEMS[s.item], s.item).toBeTruthy();
      expect(caravanStock(SEED, r, 12)).toEqual(stock);
      expect(caravanStock(SEED, r, 13)).not.toEqual(stock); // wares rotate daily
    }
    expect(onRoad / samples).toBeGreaterThan(0.85);
  });
});

describe('bridges, the Undercroft network and mount care', () => {
  it('railings line every deck tile over water, with lanterns where the deck meets land', async () => {
    const { bridgeRailsIn, T } = await import('../src/index');
    // a 3-wide deck running north-south across a river 4 tiles wide
    const tile = (x: number, y: number) =>
      x >= 4 && x <= 7 ? (y >= 2 && y <= 4 ? T.FLOOR : T.WATER) : y >= 2 && y <= 4 ? T.PATH : T.GRASS;
    const rails = bridgeRailsIn((x, y) => (x >= 4 && x <= 7 && (y < 2 || y > 4) ? T.WATER : tile(x, y)), 0, 0, 12, 8);
    expect(rails.length).toBeGreaterThan(0);
    expect(rails.every((r) => r.side === 0 || r.side === 2)).toBe(true);
    expect(
      rails
        .filter((r) => r.end)
        .map((r) => r.x)
        .sort(),
    ).toEqual([4, 4, 7, 7]);
    // a waterside room (floor with a wall behind it) is not a bridge
    const room = bridgeRailsIn((x, y) => (y === 1 ? T.WATER : y === 3 ? T.WALL : T.FLOOR), 0, 2, 4, 1);
    expect(room).toEqual([]);
  });
  it('the Undercroft towns keep a network of their own', () => {
    const under = waystonesNear(SEED, 0, 40000, 2000, 6);
    expect(under.length).toBeGreaterThanOrEqual(2);
    expect(under.every((s) => s.net === 'undercroft' && !s.wild)).toBe(true);
    const gate = all.find((s) => s.kind === 'gate')!;
    expect(canTravel(under[0]!, under[1]!)).toBe(true);
    expect(canTravel(under[0]!, gate)).toBe(false);
  });
  it('mount codes carry the animal and a good feed; fed mounts are swifter', async () => {
    const { mountCode, mountKindOf, validMountName, MOUNT_SPEED_MULT } = await import('../src/index');
    expect(mountKindOf(0)).toBeNull();
    expect([1, 2, 3, 4].map(mountKindOf)).toEqual(['horse', 'stag', 'horse', 'stag']);
    expect(mountCode('stag', true)).toBe(4);
    expect(MOUNT_SPEED_MULT[mountCode('horse', true)]!).toBeGreaterThan(
      MOUNT_SPEED_MULT[mountCode('horse', false)]! * 1.09,
    );
    expect(validMountName('  Old   Bess ')).toBe('Old Bess');
    expect(validMountName('<script>')).toBeNull();
    expect(validMountName('x'.repeat(19))).toBeNull();
  });
});
