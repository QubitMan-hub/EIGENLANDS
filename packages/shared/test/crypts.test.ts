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
