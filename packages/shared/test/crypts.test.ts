import { describe, expect, it } from 'vitest';
import {
  ChunkStore,
  CRYPT_OY,
  T,
  cryptArrival,
  cryptAt,
  cryptObjectsIn,
  cryptOf,
  cryptReliquary,
  cryptWardenSpots,
  inCryptHall,
  isCryptY,
  isSolid,
  ruinOfCell,
  setActiveGeneration,
  tileAt,
  type CryptSite,
} from '../src/index';

const SEED = 20260101;
setActiveGeneration(SEED, 6);

function someCrypt(): CryptSite {
  for (let r = 1; r < 12; r++)
    for (let gy = -r; gy <= r; gy++)
      for (let gx = -r; gx <= r; gx++) {
        const ru = ruinOfCell(SEED, gx, gy);
        const c = ru && cryptOf(SEED, ru);
        if (c) return c;
      }
  throw new Error('no crypt');
}

describe('crypt interiors', () => {
  it('a walkable run of rooms from the stairs to the reliquary, walled in stone', () => {
    const c = someCrypt();
    expect(isCryptY(c.y)).toBe(true);
    expect(c.y - c.ruin.y).toBe(CRYPT_OY);
    expect(cryptAt(SEED, c.x, c.y + 20)?.ruin.id).toBe(c.ruin.id);
    // flood fill from the arrival tile
    const a = cryptArrival(c);
    const start = [Math.floor(a.x), Math.floor(a.y)] as const;
    const seen = new Set<string>([start.join(',')]);
    const q: Array<readonly [number, number]> = [start];
    while (q.length) {
      const [x, y] = q.shift()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx,
          ny = y + dy,
          k = `${nx},${ny}`;
        if (seen.has(k) || isSolid(tileAt(SEED, nx, ny, 6))) continue;
        seen.add(k);
        q.push([nx, ny]);
        expect(seen.size).toBeLessThan(2000); // sealed: the rooms never open onto the rest of the plane
      }
    }
    const rel = cryptReliquary(c);
    expect(seen.has(`${rel.x},${rel.y - 1}`)).toBe(true);
    for (const s of cryptWardenSpots(c)) {
      expect(inCryptHall(c, s.x, s.y)).toBe(true);
      expect(isSolid(tileAt(SEED, Math.floor(s.x), Math.floor(s.y), 6))).toBe(false);
    }
    // torches light every room
    let torches = 0;
    for (let y = c.y - 4; y <= c.y + 36; y++)
      for (let x = c.x - 8; x <= c.x + 8; x++) if (tileAt(SEED, x, y, 6) === T.TORCH) torches++;
    expect(torches).toBeGreaterThanOrEqual(6);
    // away from any crypt the plane is solid rock; older worlds have no crypts at all
    expect(tileAt(SEED, c.x + 40, c.y + 50, 6)).toBe(T.CAVE_WALL);
    expect(tileAt(SEED, a.x, a.y, 5)).toBe(T.CAVE_WALL);
  });

  it('stairs back up, braziers, sarcophagi and the reliquary are placed', () => {
    const c = someCrypt();
    const subs = new Set<string>();
    for (let cy = Math.floor((c.y - 4) / 32); cy <= Math.floor((c.y + 36) / 32); cy++)
      for (let cx = Math.floor((c.x - 8) / 32); cx <= Math.floor((c.x + 8) / 32); cx++)
        for (const o of cryptObjectsIn(SEED, cx, cy))
          if ((o.data as { ruin?: string }).ruin === c.ruin.id) subs.add(o.sub);
    for (const s of ['crypt_exit', 'trial_brazier', 'crypt_reliquary', 'crypt_sarcophagus']) expect(subs).toContain(s);
    // a chunk store serves the same props (and nothing solid on the arrival tile)
    const st = new ChunkStore(SEED, 256, 6);
    const a = cryptArrival(c);
    const objs = st.townObjectsIn(Math.floor(c.x / 32), Math.floor((c.y - 2) / 32));
    expect(objs.some((o) => o.sub === 'crypt_exit')).toBe(true);
    expect(objs.some((o) => o.x === Math.floor(a.x) && o.y === Math.floor(a.y))).toBe(false);
  });
});

describe('shores and summits', () => {
  it('wrecks lie on sand by the water, cairns on local tops, and every id resolves back to its site', async () => {
    const { wreckOfCell, cairnOfCell, storySiteById, storyObjectsIn, elevationAt } = await import('../src/index');
    const wrecks = [],
      cairns = [];
    for (let gy = -15; gy < 15; gy++)
      for (let gx = -15; gx < 15; gx++) {
        const w = wreckOfCell(SEED, gx, gy);
        if (w) wrecks.push(w);
        const c = cairnOfCell(SEED, gx, gy);
        if (c) cairns.push(c);
      }
    expect(wrecks.length).toBeGreaterThan(10);
    expect(cairns.length).toBeGreaterThan(0);
    for (const w of wrecks.slice(0, 20)) {
      expect(tileAt(SEED, w.x, w.y, 6)).toBe(T.SAND);
      expect(storySiteById(SEED, w.id)).toEqual(w);
    }
    for (const c of cairns) {
      expect(elevationAt(SEED, c.x, c.y)).toBeGreaterThanOrEqual(2);
      expect(storySiteById(SEED, c.id)).toEqual(c);
      const objs = storyObjectsIn(SEED, Math.floor(c.x / 32), Math.floor(c.y / 32), 6);
      expect(objs.some((o) => o.sub === 'story_cairn' && o.x === c.x && o.y === c.y)).toBe(true);
    }
  });
});

describe('the Sunken Vault (a crypt’s second floor)', () => {
  it('lies on its own plane: a sealed run from the stairs through the levers and the gate to the chamber', async () => {
    const { cryptDeepAt, deepAnchor, deepArrival, isCryptDeepY, DEEP_ROOMS } = await import('../src/index');
    const c = someCrypt();
    const a = deepAnchor(c);
    expect(isCryptDeepY(a.y)).toBe(true);
    expect(isCryptY(a.y)).toBe(true);
    expect(cryptAt(SEED, a.x, a.y + 10)).toBeNull();
    expect(cryptDeepAt(SEED, a.x, a.y + 20)?.ruin.id).toBe(c.ruin.id);
    const start = deepArrival(c);
    const seen = new Set<string>([`${Math.floor(start.x)},${Math.floor(start.y)}`]);
    const q: Array<[number, number]> = [[Math.floor(start.x), Math.floor(start.y)]];
    while (q.length) {
      const [x, y] = q.shift()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const k = `${x + dx},${y + dy}`;
        if (seen.has(k) || isSolid(tileAt(SEED, x + dx, y + dy, 6))) continue;
        seen.add(k);
        q.push([x + dx, y + dy]);
        expect(seen.size).toBeLessThan(2000);
      }
    }
    // the chamber is reached through the gate corridor (the gate itself is a prop that bars it)
    const [, , , cy1] = DEEP_ROOMS.chamber;
    expect(seen.has(`${a.x},${a.y + cy1}`)).toBe(true);
  });

  it('levers can always bring all three seals to flame, and the riddle names one of the three statues', async () => {
    const { leverMasks, leverStart, cryptRiddle, SEALS_LIT, DEEP_STATUE_NAMES } = await import('../src/index');
    for (let r = 1; r < 8; r++)
      for (let gx = -r; gx <= r; gx++) {
        const ru = ruinOfCell(SEED, gx, r);
        const c = ru && cryptOf(SEED, ru);
        if (!c) continue;
        const m = leverMasks(SEED, c),
          s0 = leverStart(SEED, c);
        expect(s0).not.toBe(SEALS_LIT);
        let solvable = false;
        for (let pick = 0; pick < 8; pick++) {
          let s = s0;
          for (let i = 0; i < 3; i++) if (pick & (1 << i)) s ^= m[i]!;
          if (s === SEALS_LIT) solvable = true;
        }
        expect(solvable).toBe(true);
        const rd = cryptRiddle(SEED, c);
        expect(new Set(rd.names).size).toBe(3);
        for (const n of rd.names) expect(DEEP_STATUE_NAMES).toContain(n);
        expect(rd.answer).toBeGreaterThanOrEqual(0);
        expect(rd.text.length).toBeGreaterThan(40);
      }
  });

  it('the stair, levers, gate, statues, inscription and vault are placed', async () => {
    const { deepAnchor } = await import('../src/index');
    const c = someCrypt();
    const a = deepAnchor(c);
    const subs = new Set<string>();
    for (let cy = Math.floor((a.y - 4) / 32); cy <= Math.floor((a.y + 30) / 32); cy++)
      for (let cx = Math.floor((a.x - 8) / 32); cx <= Math.floor((a.x + 8) / 32); cx++)
        for (const o of cryptObjectsIn(SEED, cx, cy))
          if ((o.data as { ruin?: string }).ruin === c.ruin.id) subs.add(o.sub);
    for (const s of [
      'crypt_stairs_up',
      'crypt_lever',
      'crypt_gate',
      'crypt_statue',
      'crypt_inscription',
      'crypt_vault',
    ])
      expect(subs).toContain(s);
  });
});
