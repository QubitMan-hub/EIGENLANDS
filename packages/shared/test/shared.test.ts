import { describe, expect, it } from 'vitest';
import {
  ACK_BYTES,
  ChunkStore,
  CHUNK_SIZE,
  decodeAck,
  encodeAck,
  COMBO,
  PALETTE,
  T,
  TICK_DT,
  ambientColor,
  decodeDiff,
  dayPhase,
  encodeDiff,
  gameHour,
  generateChunk,
  inArc,
  isSolid,
  moveBody,
  newPlayerSim,
  rewindPosition,
  sanitizeCmd,
  segmentHitsCircle,
  stepPlayer,
  dayNumber,
  season,
  WORLD_EPOCH_MS,
  tileAt,
  DASH_COOLDOWN,
  DASH_SPEED,
  DAY_MS,
  type InputCmd,
} from '../src';

const cmd = (o: Partial<InputCmd> = {}): InputCmd => sanitizeCmd({ seq: 1, ...o });

describe('palette', () => {
  it('has exactly 48 unique colours', () => {
    expect(PALETTE.length).toBe(64);
    expect(new Set(PALETTE).size).toBe(64);
  });
});

describe('worldgen', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = generateChunk(1234, 3, -2);
    const b = generateChunk(1234, 3, -2);
    const c = generateChunk(9999, 3, -2);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false);
  });
  it('chunk generation equals per-tile generation', () => {
    const ch = generateChunk(42, -1, 1);
    for (const [x, y] of [
      [0, 0],
      [5, 7],
      [31, 31],
      [16, 3],
    ]) {
      expect(ch[y! * CHUNK_SIZE + x!]).toBe(tileAt(42, -CHUNK_SIZE + x!, CHUNK_SIZE + y!));
    }
  });
  it('spawn area is walkable land with a lit shrine', () => {
    expect(isSolid(tileAt(7, 0, 0))).toBe(false);
    expect(tileAt(7, 3, 3)).toBe(T.TORCH);
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) expect(isSolid(tileAt(7, x, y))).toBe(false);
  });
  it('produces a varied meadow with water, trees and flowers somewhere nearby', () => {
    const seen = new Set<number>();
    for (let cy = -3; cy <= 3; cy++)
      for (let cx = -3; cx <= 3; cx++) generateChunk(7, cx, cy).forEach((t) => seen.add(t));
    for (const t of [T.GRASS, T.TREE, T.FLOWERS, T.WATER, T.SAND, T.ROCK, T.GRASS_TALL]) expect(seen.has(t)).toBe(true);
  });
});

describe('chunk store and diffs', () => {
  it('applies edits over generated terrain and round-trips the codec', () => {
    const s = new ChunkStore(7);
    const base = s.getTile(40, 40);
    s.setTile(40, 40, T.PATH);
    expect(s.getTile(40, 40)).toBe(T.PATH);
    const diff = s.get(1, 1).diff;
    const decoded = decodeDiff(encodeDiff(diff));
    const fresh = new ChunkStore(7);
    fresh.applyDiff(1, 1, decoded);
    expect(fresh.getTile(40, 40)).toBe(T.PATH);
    expect(base).not.toBe(undefined);
  });
  it('rejects truncated diffs', () => {
    const buf = new Uint8Array([2, 0, 1, 0, 3]);
    expect(() => decodeDiff(buf)).toThrow();
  });
});

describe('movement and collision', () => {
  const open = () => false;
  const wallAt5 = (tx: number) => tx >= 5;
  it('moves at base speed and normalises diagonals', () => {
    const p = newPlayerSim(0, 0);
    for (let i = 0; i < 20; i++) stepPlayer(p, cmd({ dx: 1, dy: 1 }), open);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(4.5, 1);
  });
  it('is blocked by solid tiles without tunnelling', () => {
    const p = newPlayerSim(3, 0.5);
    for (let i = 0; i < 100; i++) stepPlayer(p, cmd({ dx: 1 }), (tx) => wallAt5(tx));
    expect(p.x).toBeLessThan(5);
    expect(p.x).toBeGreaterThan(4.6);
  });
  it('dash covers ground fast, honours cooldown, ignores cheaty input', () => {
    const p = newPlayerSim(0, 0);
    stepPlayer(p, cmd({ dx: 1, dash: true }), open);
    for (let i = 0; i < 4; i++) stepPlayer(p, cmd({ dx: 1 }), open);
    expect(p.x).toBeGreaterThan(DASH_SPEED * 0.18 * 0.8);
    const before = p.dashCd;
    stepPlayer(p, cmd({ dx: 1, dash: true }), open);
    expect(p.dashCd).toBeLessThan(before + 1e-9);
    expect(DASH_COOLDOWN).toBeGreaterThan(TICK_DT);
    const wild = sanitizeCmd({ dx: 9999, dy: NaN as unknown as number, aimX: Infinity });
    expect(Math.hypot(wild.dx, wild.dy)).toBeLessThanOrEqual(1.0001);
  });
  it('is deterministic: same inputs give the same state (basis of prediction)', () => {
    const run = () => {
      const p = newPlayerSim(0.5, 0.5);
      for (let i = 0; i < 60; i++)
        stepPlayer(
          p,
          cmd({ dx: Math.sin(i / 5), dy: Math.cos(i / 7), dash: i % 23 === 0 }),
          (x, y) => (x * 7 + y * 3) % 11 === 0,
        );
      return p;
    };
    expect(run()).toEqual(run());
  });
  it('attack combo cycles 0,1,2 and respects cooldown', () => {
    const p = newPlayerSim(0, 0);
    const hits: number[] = [];
    for (let i = 0; i < 40; i++) {
      const ev = stepPlayer(p, cmd({ attack: true, aimX: 1 }), open);
      if (ev.attacked) hits.push(ev.combo);
    }
    expect(hits.slice(0, 4)).toEqual([0, 1, 2, 0]);
  });
  it('moveBody resolves corner cases', () => {
    const pos = { x: 4.4, y: 0.5 };
    moveBody(pos, 2, 0, 0.3, (tx) => tx >= 5);
    expect(pos.x).toBeLessThan(4.71);
  });
});

describe('combat maths and lag compensation', () => {
  it('melee arc hits in front and misses behind', () => {
    const front = { x: 1, y: 0, r: 0.4 };
    const back = { x: -1.2, y: 0, r: 0.4 };
    expect(inArc(0, 0, 1, 0, COMBO[0]!, front)).toBe(true);
    expect(inArc(0, 0, 1, 0, COMBO[0]!, back)).toBe(false);
  });
  it('projectile sweep does not tunnel through targets', () => {
    expect(segmentHitsCircle(0, 0, 10, 0, 0.25, { x: 5, y: 0.3, r: 0.4 })).toBe(true);
    expect(segmentHitsCircle(0, 0, 10, 0, 0.25, { x: 5, y: 3, r: 0.4 })).toBe(false);
  });
  it('rewinds to the nearest recorded tick', () => {
    const h = [
      { tick: 10, x: 0, y: 0 },
      { tick: 11, x: 1, y: 0 },
      { tick: 12, x: 2, y: 0 },
    ];
    expect(rewindPosition(h, 11)).toEqual({ x: 1, y: 0 });
    expect(rewindPosition(h, 99)).toEqual({ x: 2, y: 0 });
    expect(rewindPosition([], 1)).toBeNull();
  });
});

describe('ack codec', () => {
  it('round-trips a player sim in ACK_BYTES bytes', () => {
    const sim = newPlayerSim(12.25, -7.5);
    sim.atkCd = 0.15;
    sim.combo = 2;
    sim.dashT = 0.1;
    const bytes = encodeAck({ seq: 4000000000, tick: 99, sim });
    expect(bytes.byteLength).toBe(ACK_BYTES);
    const back = decodeAck(bytes);
    expect(back.seq).toBe(4000000000);
    expect(back.tick).toBe(99);
    expect(back.sim.x).toBeCloseTo(12.25, 5);
    expect(back.sim.combo).toBe(2);
    expect(back.sim.atkCd).toBeCloseTo(0.15, 5);
    expect(() => decodeAck(new Uint8Array(3))).toThrow();
  });
});

describe('calendar', () => {
  it('counts world days from the epoch and rolls seasons every 7 days', () => {
    expect(dayNumber(WORLD_EPOCH_MS)).toBe(0);
    expect(dayNumber(WORLD_EPOCH_MS + 8.5 * DAY_MS)).toBe(8);
    expect(season(WORLD_EPOCH_MS + 6 * DAY_MS)).toBe('Spring');
    expect(season(WORLD_EPOCH_MS + 7 * DAY_MS)).toBe('Summer');
    expect(season(WORLD_EPOCH_MS + 28 * DAY_MS)).toBe('Spring');
  });
});

describe('day/night', () => {
  it('a day is 24 real minutes starting at dawn', () => {
    expect(gameHour(0)).toBeCloseTo(6);
    expect(gameHour(DAY_MS / 2)).toBeCloseTo(18);
    expect(gameHour(DAY_MS)).toBeCloseTo(6);
  });
  it('phases and ambient light are sane and continuous', () => {
    expect(dayPhase(12)).toBe('day');
    expect(dayPhase(23)).toBe('night');
    expect(dayPhase(6)).toBe('dawn');
    const noon = ambientColor(12);
    const midnight = ambientColor(0);
    expect(noon[0]).toBeGreaterThan(midnight[0]);
    for (let h = 0; h < 24; h += 0.05) {
      const a = ambientColor(h),
        b = ambientColor(h + 0.05);
      expect(Math.abs(a[0] - b[0])).toBeLessThan(0.1);
    }
  });
});
