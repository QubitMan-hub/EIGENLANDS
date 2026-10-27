import { describe, expect, it } from 'vitest';
import {
  COTTAGE_H,
  COTTAGE_W,
  CRYPT_PLANS,
  SET_BY_ID,
  armorClimate,
  brazierName,
  cottageCells,
  cottageFurniture,
  cottagerOf,
  cryptArrival,
  cryptOf,
  cryptOrder,
  cryptPlaqueText,
  cryptPlan,
  cryptReliquary,
  cryptWardenSpots,
  equipmentStats,
  graveInjuryOnHit,
  inCryptHall,
  isSolid,
  realmNpcs,
  ruinOfCell,
  setActiveGeneration,
  standingLine,
  tieSpill,
  tiesOn,
  tileAt,
  wildFolkOut,
  type CryptSite,
} from '../src/index';

const SEED = 20260101;
setActiveGeneration(SEED, 6);

describe('clothing against the weather', () => {
  it('furs and wool are warm, linen breathes, plate bakes in the sun, and worn pieces add up', () => {
    expect(armorClimate(SET_BY_ID.fur!)).toEqual({ warm: 2, cool: 0 });
    expect(armorClimate(SET_BY_ID.padded!).warm).toBe(1);
    expect(armorClimate(SET_BY_ID.linen!).cool).toBe(1);
    expect(armorClimate(SET_BY_ID.steel!)).toEqual({ warm: 1, cool: -1 });
    const fur = (slot: string) => ({ id: `armor_fur_${slot}`, n: 1 });
    const s = equipmentStats({ head: fur('head'), chest: fur('chest'), legs: fur('legs'), feet: fur('feet') } as never);
    expect(s.warm).toBe(8);
  });
});

describe('grave wounds', () => {
  it('crushing blows can break bones and spirits can curse; ordinary beasts do neither', () => {
    expect(graveInjuryOnHit('iron_golem')?.cond).toBe('fracture');
    expect(graveInjuryOnHit('vault_guardian')?.cond).toBe('curse');
    expect(graveInjuryOnHit('rabbit')).toBeNull();
  });
});

describe('ties that react to you', () => {
  it('a kindness warms those close to the resident and cools their rival; standing shows in what they say', () => {
    const day = 3;
    const withRival = realmNpcs().find((n) => tiesOn(n.id, day).some((t) => t.kind === 'rival'))!;
    const withFriend = realmNpcs().find((n) => tiesOn(n.id, day).some((t) => t.kind === 'friend'))!;
    const rival = tiesOn(withRival.id, day).find((t) => t.kind === 'rival')!.other;
    const friend = tiesOn(withFriend.id, day).find((t) => t.kind === 'friend')!.other;
    expect(tieSpill(withRival.id, day, 60).find((s) => s.npc === rival)!.delta).toBeLessThan(0);
    expect(tieSpill(withFriend.id, day, 60).find((s) => s.npc === friend)!.delta).toBe(15);
    // a slight never warms a rival
    expect(tieSpill(withRival.id, day, -40).find((s) => s.npc === rival)).toBeUndefined();
    expect(standingLine(withRival.id, day, (o) => (o === rival ? 6 : 0))).toMatch(/keep company/);
    expect(standingLine(withFriend.id, day, (o) => (o === friend ? 6 : 0))).toMatch(/speaks well of you/);
    expect(standingLine(withFriend.id, day, () => 0)).toBeNull();
  });
});

function cryptsByPlan(): Map<string, CryptSite> {
  const out = new Map<string, CryptSite>();
  for (let r = 1; r < 30 && out.size < CRYPT_PLANS.length; r++)
    for (let gy = -r; gy <= r; gy++)
      for (let gx = -r; gx <= r; gx++) {
        if (Math.max(Math.abs(gx), Math.abs(gy)) !== r) continue;
        const ru = ruinOfCell(SEED, gx, gy);
        const c = ru && cryptOf(SEED, ru);
        if (c && !out.has(cryptPlan(c).name)) out.set(cryptPlan(c).name, c);
      }
  return out;
}

describe('crypt floor plans and the braziers’ riddle', () => {
  it('all three plans occur and each is a sealed, walkable run from the stairs to the reliquary', () => {
    const plans = cryptsByPlan();
    expect([...plans.keys()].sort()).toEqual(CRYPT_PLANS.map((p) => p.name).sort());
    for (const c of plans.values()) {
      const plan = cryptPlan(c);
      const a = cryptArrival(c);
      const start = `${Math.floor(a.x)},${Math.floor(a.y)}`;
      const seen = new Set([start]);
      const q = [[Math.floor(a.x), Math.floor(a.y)]];
      while (q.length) {
        const [x, y] = q.shift()!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const k = `${x! + dx!},${y! + dy!}`;
          if (seen.has(k) || isSolid(tileAt(SEED, x! + dx!, y! + dy!, 6))) continue;
          seen.add(k);
          q.push([x! + dx!, y! + dy!]);
        }
        expect(seen.size).toBeLessThan(2000);
      }
      const rel = cryptReliquary(c);
      expect(seen.has(`${rel.x},${rel.y - 1}`)).toBe(true);
      for (const s of cryptWardenSpots(c)) {
        expect(inCryptHall(c, s.x, s.y)).toBe(true);
        expect(seen.has(`${Math.floor(s.x)},${Math.floor(s.y)}`)).toBe(true);
      }
      // every brazier stands in the hall with walkable floor beside it; niches open off the hall
      for (const [bx, by] of plan.braziers) {
        expect(inCryptHall(c, c.x + bx, c.y + by)).toBe(true);
        expect([-1, 1].some((d) => seen.has(`${c.x + bx + d},${c.y + by}`))).toBe(true);
      }
      for (const [nx, ny] of plan.niches) expect(seen.has(`${c.x + nx},${c.y + ny}`)).toBe(true);
    }
  });

  it('the plaque names the dead in an order that is a true ordering of the four carved braziers', () => {
    const c = cryptsByPlan().values().next().value as CryptSite;
    const order = cryptOrder(SEED, c);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
    const names = [0, 1, 2, 3].map((i) => brazierName(SEED, c, i));
    expect(new Set(names).size).toBe(4);
    const text = cryptPlaqueText(SEED, c);
    const pos = order.map((i) => text.indexOf(brazierName(SEED, c, i)));
    expect(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1]!))).toBe(true);
  });
});

describe('lived-in cottages', () => {
  it('furniture stands inside the walls, the doorway stays clear, and the family lives outside the door', () => {
    const x = 100,
      y = 200;
    const cells = cottageCells('aurelion', x, y);
    const wall = new Set(cells.filter((c) => c.data.wall).map((c) => `${c.x},${c.y}`));
    const door = cells.find((c) => c.data.wall === 'oak_door')!;
    for (const f of cottageFurniture(x, y)) {
      expect(f.x > x && f.x < x + COTTAGE_W - 1 && f.y > y && f.y < y + COTTAGE_H - 1).toBe(true);
      expect(wall.has(`${f.x},${f.y}`)).toBe(false);
      expect(f.x === door.x && f.y === door.y - 1).toBe(false);
    }
    const fam = cottagerOf(x, y);
    expect(fam.y).toBeGreaterThan(y + COTTAGE_H - 1);
    expect(wildFolkOut(fam, 12, 'clear')).toBe(true);
    expect(wildFolkOut(fam, 12, 'rain')).toBe(false);
    expect(wildFolkOut(fam, 23, 'clear')).toBe(false);
  });
});
