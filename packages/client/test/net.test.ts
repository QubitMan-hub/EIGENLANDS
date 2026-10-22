import { describe, expect, it } from 'vitest';
import { ChunkStore, TICK_DT, TICK_MS, encodeAck, decodeAck, T } from '@eigenlands/shared';
import { Predictor } from '../src/net/prediction';
import { Interpolator, ServerClock } from '../src/net/interp';
import { DEFAULT_KEYS, keyLabel, loadKeys, rebind, saveKeys } from '../src/input/keymap';
import { colorblindMatrix } from '../src/ui/ui';

const noWalls = () => false;
const inp = (o = {}) => ({ dx: 0, dy: 0, dash: false, attack: false, skill: false, aimX: 0, aimY: 0, ...o });

describe('prediction and reconciliation', () => {
  it('matches an authoritative server that processed the same inputs (no visible correction)', () => {
    const client = new Predictor(0, 0, noWalls);
    const server = new Predictor(0, 0, noWalls);
    for (let i = 0; i < 30; i++) {
      const { cmd } = client.step(inp({ dx: 1, dy: 0.3 }), 0);
      server.step(inp({ dx: 1, dy: 0.3 }), 0);
      if (i === 19) {
        const dist = client.reconcile({ seq: cmd.seq, tick: i, sim: server.sim });
        expect(dist).toBeLessThan(1e-3);
      }
    }
    expect(client.pending.length).toBeLessThan(30);
  });

  it('is corrected when the server disagrees (e.g. knockback) and replays pending inputs on top', () => {
    const client = new Predictor(0.5, 0.5, noWalls);
    const srv = new Predictor(0.5, 0.5, noWalls);
    for (let i = 0; i < 40; i++) client.step(inp({ dx: 1 }), 0);
    const predictedEnd = client.sim.x;
    for (let i = 0; i < 25; i++) srv.step(inp({ dx: 1 }), 0);
    srv.sim.x -= 1; // the server shoved us back 1 tile that the client could not predict
    const dist = client.reconcile({ seq: 25, tick: 25, sim: srv.sim });
    expect(dist).toBeCloseTo(1, 1);
    expect(client.pending.length).toBe(15);
    expect(client.sim.x).toBeCloseTo(predictedEnd - 1, 1); // authoritative state + replayed inputs
  });

  it('smooths small corrections visually and snaps big ones', () => {
    const p = new Predictor(0, 0, noWalls);
    p.step(inp({ dx: 1 }), 0);
    const auth = { ...p.sim, x: p.sim.x - 0.4 };
    p.reconcile({ seq: 0, tick: 1, sim: auth });
    const before = p.visual(1).x;
    p.update(0.5);
    expect(Math.abs(p.visual(1).x - p.sim.x)).toBeLessThan(Math.abs(before - p.sim.x));
    p.reconcile({ seq: 0, tick: 2, sim: { ...p.sim, x: p.sim.x + 10 } });
    expect(p.visual(1).x).toBeCloseTo(p.sim.x, 3);
  });

  it('survives the real ack wire format', () => {
    const p = new Predictor(3, 4, noWalls);
    p.step(inp({ dx: 1, attack: true, aimX: 1 }), 0);
    const ack = decodeAck(encodeAck({ seq: 1, tick: 5, sim: p.sim }));
    expect(p.reconcile(ack)).toBeLessThan(1e-3);
  });

  it('uses the shared tile solidity', () => {
    const store = new ChunkStore(1);
    store.setTile(5, 0, T.ROCK);
    const p = new Predictor(3.5, 0.5, store.solidAt);
    for (let i = 0; i < 60; i++) p.step(inp({ dx: 1 }), 0);
    expect(p.sim.x).toBeLessThan(5);
    expect(TICK_DT * 1000).toBe(TICK_MS);
  });
});

describe('interpolation and server clock', () => {
  const pose = (x: number, y = 0) => ({ x, y, faceX: 0, faceY: 1 });
  it('blends between snapshots and holds without overshooting wildly', () => {
    const i = new Interpolator<ReturnType<typeof pose>>();
    i.push('a', 1000, pose(0));
    i.push('a', 1050, pose(1));
    i.push('a', 1100, pose(2));
    expect(i.sample('a', 1025)!.x).toBeCloseTo(0.5);
    expect(i.sample('a', 1075)!.x).toBeCloseTo(1.5);
    expect(i.sample('a', 900)!.x).toBe(0);
    expect(i.sample('a', 1130)!.x).toBeGreaterThan(2);
    expect(i.sample('a', 1130)!.x).toBeLessThan(2.7);
    expect(i.sample('a', 5000)!.x).toBe(3); // hold the bounded prediction, never snap backward
    expect(i.sample('missing', 1)).toBeNull();
  });
  it('does not slide across the map on teleports and ignores out-of-order snapshots', () => {
    const i = new Interpolator<ReturnType<typeof pose>>();
    i.push('a', 1000, pose(0));
    i.push('a', 1050, pose(100));
    expect(i.sample('a', 1025)!.x).toBe(100);
    i.push('a', 900, pose(-5));
    expect(i.sample('a', 940)!.x).toBe(0);
  });
  it('clock tracks the lowest-latency packet and maps to ticks', () => {
    const c = new ServerClock();
    // server time = local + 5000, packets take 40..120 ms
    for (let k = 0; k < 20; k++) c.observe(10_000 + k * 50, 100 + k, 5_000 + k * 50 - 5000 + (k % 5 === 0 ? 40 : 120) );
    expect(c.ready).toBe(true);
    expect(c.offset).toBeGreaterThan(4800);
    expect(c.tickAt(10_000 + 19 * 50 + 100)).toBeCloseTo(121, 5);
  });
});

describe('keymap', () => {
  it('rebinding steals the key from other actions, persists, and survives corrupt storage', () => {
    const k = rebind(DEFAULT_KEYS, 'dash', 'KeyJ');
    expect(k.dash[0]).toBe('KeyJ');
    expect(k.attack).not.toContain('KeyJ');
    const mem: Record<string, string> = {};
    const st = { setItem: (a: string, b: string) => { mem[a] = b; }, getItem: (a: string) => mem[a] ?? null };
    saveKeys(k, st);
    expect(loadKeys(st).dash[0]).toBe('KeyJ');
    mem['eigen.keys'] = '{not json';
    expect(loadKeys(st)).toEqual(DEFAULT_KEYS);
    mem['eigen.keys'] = JSON.stringify({ up: [5], dash: ['KeyQ'] });
    expect(loadKeys(st).up).toEqual(DEFAULT_KEYS.up);
    expect(loadKeys(st).dash).toEqual(['KeyQ']);
  });
});

describe('labels and accessibility maths', () => {
  it('prints friendly key names', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('ArrowUp')).toBe('Up');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('Space')).toBe('Space');
  });
  it('colour-blind matrices are well formed, and leave neutral greys unchanged', () => {
    for (const k of ['protan', 'deutan', 'tritan'] as const) {
      const v = colorblindMatrix(k).trim().split(/\s+/).map(Number);
      expect(v.length).toBe(20);
      expect(v.every(Number.isFinite)).toBe(true);
      // rows 0..2 applied to grey (1,1,1) must stay ~1 (no colour cast on neutrals)
      for (const row of [0, 1, 2]) expect(v[row * 5]! + v[row * 5 + 1]! + v[row * 5 + 2]!).toBeCloseTo(1, 1);
    }
  });
});
