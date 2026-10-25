import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FLUX, MSG34, SPELL, T, lineErrors } from '@eigenlands/shared';
import type { App } from '../src/app';
import { signTicket } from '../src/features/shard/ticket';
import { runtime } from '../src/rooms/runtime';
import type { Carry } from '../src/features/types';
import {
  attune,
  boot3,
  cast,
  clearEnemies,
  dev3,
  dummy,
  flatten,
  mkBoard,
  remove,
  setClass,
  setLevel,
  sleep,
  spawn3,
  st,
  tp,
  until,
  type P3,
} from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3();
});
afterAll(async () => {
  await app?.close();
});

let spot = 0;
/** A fresh player standing in a flat, empty field of their own. */
async function fielded(name: string): Promise<P3> {
  const p = await spawn3(app, name);
  const X = 300 + 40 * spot++,
    Y = 300;
  await tp(p, X + 0.5, Y + 0.5);
  flatten(p.room, X, Y, 9);
  p.sp.invuln = 0;
  return p;
}

async function gates(p: P3): Promise<void> {
  dev3(p, { cmd: 'gates' });
  await until(() => (p.prog.gates?.h ?? 0) >= 9);
}

describe('cast forms follow the board', () => {
  it('Split is about 50/50, Flip is always form B, Split-Tune-Split is always form B', async () => {
    const p = await fielded('Sampler');
    await gates(p);
    expect((await attune(p, mkBoard({ 0: ['h'] }, { 0: 'glimmer' }))).ok).toBe(true);
    let b = 0,
      n = 0;
    for (let i = 0; i < 240; i++) {
      const r = await cast(p, 0);
      expect(r.ok).toBe(true);
      const l = r.results[0]!;
      expect(l.ability).toBe('glimmer');
      if (l.misfire) {
        expect(l.hue).toBe(FLUX);
        continue;
      }
      expect(l.hue).toBe(l.bit ? 4 : 0); // Ember or Frost
      n++;
      b += l.bit;
    }
    expect(b / n).toBeGreaterThan(0.38);
    expect(b / n).toBeLessThan(0.62);

    for (const pattern of [['x'], ['h', 'z', 'h']] as const) {
      expect((await attune(p, mkBoard({ 0: [...pattern] }, { 0: 'glimmer' }))).ok).toBe(true);
      let clean = 0;
      for (let i = 0; i < 40; i++) {
        const l = (await cast(p, 0)).results[0]!;
        if (l.misfire) {
          expect(l.bit).toBe(0);
          continue;
        }
        clean++;
        expect(l.bit).toBe(1);
      }
      expect(clean).toBeGreaterThan(30);
    }
    await p.r.leave();
  });

  it('cooldowns are enforced by the server', async () => {
    const p = await fielded('Waiter');
    const a = await cast(p, 0);
    expect(a.ok).toBe(true);
    expect(a.cd!.glimmer).toBeGreaterThan(Date.now() + 800);
    const b = await cast(p, 0, 1, 0, false);
    expect(b).toMatchObject({ ok: false, error: 'Not ready yet.' });
    expect((await cast(p, 1, 1, 0, false)).error).toMatch(/not woken up/);
    expect((await cast(p, 7, 1, 0, false)).error).toMatch(/no such orb/);
    await sleep(1250);
    expect((await cast(p, 0, 1, 0, false)).ok).toBe(true);
    await p.r.leave();
  });

  it('a Link fires both orbs, and a split control makes their forms correlated', async () => {
    const p = await fielded('Linker');
    await gates(p);
    await setClass(p, 'superposer');
    await setLevel(p, 3);
    expect((await attune(p, mkBoard({ 0: ['h', ['cx', 1]] }, { 0: 'split_shot', 1: 'wavefront' }))).ok).toBe(true);
    const seen = new Set<number>();
    let clean = 0;
    for (let i = 0; i < 60; i++) {
      const r = await cast(p, 0);
      expect(r.results.map((x) => x.q)).toEqual([0, 1]);
      expect(r.results[1]).toMatchObject({ ability: 'wavefront', link: true });
      expect(r.cd!.wavefront).toBeUndefined(); // echo casts cost no cooldown
      const [a, c] = r.results;
      if (a!.misfire || c!.misfire) continue;
      clean++;
      expect(c!.bit).toBe(a!.bit);
      seen.add(a!.bit);
    }
    expect(clean).toBeGreaterThan(45);
    expect([...seen].sort()).toEqual([0, 1]);
    await p.r.leave();
  });

  it('a crowded board misfires into Flux; runes steady it', async () => {
    const p = await fielded('Crowded');
    await gates(p);
    await setLevel(p, 9);
    const noisy = ['h', 'h', 'x', 'x', 'z', 'z', 't', 't'] as const;
    const lines = { 0: [...noisy], 1: [...noisy], 2: [...noisy], 3: [...noisy] };
    expect((await attune(p, mkBoard(lines, { 0: 'glimmer' }))).ok).toBe(true);
    expect(st(p).errors[0]).toBeGreaterThan(0.15);
    let mis = 0;
    for (let i = 0; i < 150; i++) {
      const l = (await cast(p, 0)).results[0]!;
      if (l.misfire) {
        mis++;
        expect(l.hue).toBe(FLUX);
        expect(l.bit).toBe(1);
      } else expect(l.bit).toBe(0);
    }
    expect(mis).toBeGreaterThan(8);
    const steady = mkBoard(lines, { 0: 'glimmer' }, { 0: 2 });
    expect((await attune(p, steady)).ok).toBe(true);
    expect(st(p).errors[0]).toBeCloseTo(lineErrors(steady, 4)[0]!, 12);
    expect(st(p).errors[0]).toBeLessThan(0.08);
    expect(p.prog.codex).toContain('correction');
    await p.r.leave();
  });
});

describe('abilities hurt things authoritatively', () => {
  it('a Glimmer bolt kills a creature, burns it and grants XP through the normal kill path', async () => {
    const p = await fielded('Bolter');
    const e = dummy(p.room, p.sp.sim.x + 3, p.sp.sim.y);
    await cast(p, 0);
    await until(() => e.hp < 30, 2000);
    expect(e.hp).toBe(16); // Ember bolt 14
    await until(() => e.hp <= 13, 2500); // burning
    await until(() => p.r.state.spells.size === 0, 2000); // the bolt is gone again
    await cast(p, 0);
    await until(() => !p.room.enemies.has(e.id), 3000);
    expect(p.sp.xp).toBe(10);
    await p.r.leave();
  });

  it('a selected enemy is auto-aimed even when the cursor points elsewhere; bogus targets are ignored', async () => {
    const p = await fielded('Locker');
    const e = dummy(p.room, p.sp.sim.x, p.sp.sim.y + 4);
    // the aim points the wrong way (+x); only the target puts the bolt on the enemy
    st(p).cd.clear();
    const n = p.casts.length;
    p.r.send(MSG34.CAST, { line: 0, aimX: 1, aimY: 0, target: e.id });
    await until(() => p.casts.length > n, 3000, 5);
    await until(() => e.hp < 30, 2000);
    // an unknown / non-string target falls back to the cursor aim and never crashes
    for (const target of ['nope', 42, { x: 1 }, 'x'.repeat(500)]) {
      st(p).cd.clear();
      const m = p.casts.length;
      p.r.send(MSG34.CAST, { line: 0, aimX: -1, aimY: 0, target });
      await until(() => p.casts.length > m, 3000, 5);
      expect(p.casts[m]!.ok).toBe(true);
    }
    await p.r.leave();
  });

  it('bolts stop at walls', async () => {
    const p = await fielded('Waller');
    const x = Math.floor(p.sp.sim.x),
      y = Math.floor(p.sp.sim.y);
    p.room.setTile(x + 2, y, T.ROCK);
    expect(p.room.store.solidAt(x + 2, y)).toBe(true);
    const e = dummy(p.room, p.sp.sim.x + 4, p.sp.sim.y);
    await cast(p, 0);
    await sleep(700);
    expect(e.hp).toBe(30);
    remove(p.room, e.id);
    await p.r.leave();
  });

  it('Wavefront pushes and hurts; its Void form pulls and slows, then the slow wears off', async () => {
    const p = await fielded('Ringer');
    await gates(p);
    await setClass(p, 'superposer');
    expect((await attune(p, mkBoard({}, { 0: 'wavefront' }))).ok).toBe(true);
    const e = dummy(p.room, p.sp.sim.x + 1.5, p.sp.sim.y);
    e.resist = 1;
    const x0 = e.x;
    await cast(p, 0);
    await until(() => [...p.r.state.spells.values()].some((s: any) => s.kind === SPELL.RING), 1000);
    await until(() => e.hp === 30 - 14, 1500);
    await until(() => e.x > x0 + 0.5, 1500);
    remove(p.room, e.id);

    expect((await attune(p, mkBoard({ 0: ['x'] }, { 0: 'wavefront' }))).ok).toBe(true);
    const f = dummy(p.room, p.sp.sim.x + 2, p.sp.sim.y);
    f.def = { ...f.def, speed: 2 };
    const base = f.def;
    // A misfire still executes a damaging form. Retrying on the same dummy can kill it
    // before the Void assertion; isolate this damage test from random board slips.
    const rand = p.room.rand;
    p.room.rand = () => 0.99;
    try {
      expect((await cast(p, 0)).results[0]!.misfire).toBe(false);
    } finally {
      p.room.rand = rand;
    }
    await until(() => f.hp < 30, 1500);
    expect(f.hp).toBe(30 - Math.round(10 * 1.25)); // Void +25%
    expect(f.def.speed).toBeCloseTo(2 * 0.6, 6);
    await until(() => f.def === base, 3500);
    remove(p.room, f.id);
    await p.r.leave();
  });
});

describe('Superposer', () => {
  it('Two Places at Once: a hit lands on the Echo and you collapse to it', async () => {
    const p = await fielded('Phantom');
    await setClass(p, 'superposer');
    expect((await attune(p, mkBoard({}, { 0: 'echo_step' }))).ok).toBe(true);
    const x0 = p.sp.sim.x,
      y0 = p.sp.sim.y;
    await cast(p, 0, 1, 0);
    expect(p.sp.sim.x).toBeCloseTo(x0 + 4, 1);
    expect(p.circuit.engine.echoesOf(p.sid)).toHaveLength(1);
    await until(() => [...p.r.state.spells.values()].some((s: any) => s.kind === SPELL.ECHO));

    const rand = p.room.rand;
    p.room.rand = () => 0.1;
    try {
      const e = p.room.spawnEnemy('slime', p.sp.sim.x + 0.7, p.sp.sim.y, false);
      e.def = { ...e.def, speed: 0, sight: 4 };
      p.sp.invuln = 0;
      const hp = p.sp.hp;
      await until(() => p.circuit.engine.echoesOf(p.sid).length === 0, 4000);
      expect(p.sp.hp).toBe(hp);
      expect(p.sp.sim.x).toBeCloseTo(x0, 1);
      expect(p.sp.sim.y).toBeCloseTo(y0, 1);
      remove(p.room, e.id);
      // with no Echo left the next hit lands
      const g = p.room.spawnEnemy('slime', p.sp.sim.x + 0.7, p.sp.sim.y, false);
      g.def = { ...g.def, speed: 0, sight: 4 };
      p.sp.invuln = 0;
      await until(() => p.sp.hp < hp, 4000);
      remove(p.room, g.id);
    } finally {
      p.room.rand = rand;
    }
    await p.r.leave();
  });

  it('Probability Ward: the shield absorbs, the mirror reflects ×1.5', async () => {
    const p = await fielded('Warden');
    await gates(p);
    await setClass(p, 'superposer');
    expect((await attune(p, mkBoard({}, { 0: 'prob_ward' }))).ok).toBe(true);
    await cast(p, 0);
    await until(() => [...p.r.state.spells.values()].some((s: any) => s.kind === SPELL.SHIELD));
    const hp = p.sp.hp;
    const e = p.room.spawnEnemy('slime', p.sp.sim.x + 0.8, p.sp.sim.y, false);
    e.def = { ...e.def, speed: 0, sight: 4 };
    await until(() => (p.circuit.engine.aurasOf(p.sid)[0]?.amount ?? 30) < 30, 4000);
    expect(p.circuit.engine.aurasOf(p.sid)[0]!.amount).toBe(23);
    expect(p.sp.hp).toBe(hp);
    remove(p.room, e.id);

    expect((await attune(p, mkBoard({ 0: ['x'] }, { 0: 'prob_ward' }))).ok).toBe(true);
    let r = await cast(p, 0);
    while (r.results[0]!.misfire) r = await cast(p, 0);
    expect(p.circuit.engine.aurasOf(p.sid).map((a) => a.kind)).toContain('mirror');
    const m = p.room.spawnEnemy('slime', p.sp.sim.x + 0.8, p.sp.sim.y, false);
    m.def = { ...m.def, speed: 0, sight: 4 };
    p.sp.invuln = 0;
    await until(() => m.hp < 30, 4000);
    expect(m.hp).toBe(30 - Math.round(7 * 1.5));
    expect(p.sp.hp).toBe(hp);
    remove(p.room, m.id);
    await p.r.leave();
  });

  it('Many Worlds: three Echoes repeat every offensive cast', async () => {
    const p = await fielded('Worlds');
    await setClass(p, 'superposer');
    const no = await new Promise<any>((res) => {
      p.r.onMessage(MSG34.CAST_R, (m) => {
        if (m.ult) res(m);
      });
      p.r.send(MSG34.ULT, { aimX: 1, aimY: 0 });
    });
    expect(no).toMatchObject({ ok: false, error: 'Coherence is not full yet.' });
    dev3(p, { cmd: 'res', v: 100 });
    await until(() => p.res.some((r) => r.v === 100));
    const n = p.casts.length;
    p.r.send(MSG34.ULT, { aimX: 1, aimY: 0 });
    await until(() => p.casts.length > n);
    expect(p.casts[n]).toMatchObject({ ok: true, ult: true });
    expect(p.circuit.engine.echoesOf(p.sid).filter((e) => e.ult)).toHaveLength(3);
    await until(() => p.res.at(-1)!.v === 0);
    let r = await cast(p, 0);
    while (r.results[0]!.bit !== 0 || r.results[0]!.misfire) r = await cast(p, 0);
    await until(() => [...p.r.state.spells.values()].filter((s: any) => s.kind === SPELL.BOLT).length >= 4, 1000);
    await p.r.leave();
  });
});

describe('Entangler', () => {
  it('Spooky Action echoes damage from Tethers, Pulses, melee and killing blows; Bond builds', async () => {
    const p = await fielded('Weaver');
    await setClass(p, 'entangler');
    await setLevel(p, 3);
    expect(p.prog.board!.abilities.slice(0, 2)).toEqual(['tether', 'pulse']);
    const a = dummy(p.room, p.sp.sim.x + 3, p.sp.sim.y);
    const b = dummy(p.room, p.sp.sim.x, p.sp.sim.y + 3);
    for (const e of [a, b]) {
      e.hp = 200;
      e.maxHp = 200;
    }
    await cast(p, 0, 1, 0);
    await until(() => a.hp === 190, 2000); // Void tether 8 × 1.25
    await cast(p, 0, 0, 1);
    await until(() => b.hp === 190, 2000);
    expect(a.hp).toBe(186); // 40% of 10 echoed along the thread
    expect(p.circuit.engine.linksOf(p.sid)).toHaveLength(2);
    await until(() => [...p.r.state.spells.values()].filter((s: any) => s.kind === SPELL.TETHER).length === 2);

    let r = await cast(p, 1);
    while (r.results[0]!.bit !== 0 || r.results[0]!.misfire) r = await cast(p, 1);
    expect(a.hp).toBe(186 - 16 - 6);
    expect(b.hp).toBe(190 - 6 - 16);
    await until(() => p.res.some((x) => x.v >= 8));

    // melee (anything outside the engine) echoes on the next tick
    p.room.hitEnemy(a, 10, p.sp, 0, 0, 0);
    await until(() => b.hp === 168 - 4, 1000);
    // a killing blow still echoes its full weight
    p.room.hitEnemy(a, 999, p.sp, 0, 0, 0);
    await until(() => b.hp === 164 - Math.round(154 * 0.4), 1000);
    expect(p.circuit.engine.linksOf(p.sid)).toHaveLength(1);
    clearEnemies(p.room);
    await p.r.leave();
  });

  it('Bell State mirrors damage between paired foes', async () => {
    const p = await fielded('Belle');
    await setClass(p, 'entangler');
    const a = dummy(p.room, p.sp.sim.x + 2, p.sp.sim.y);
    const b = dummy(p.room, p.sp.sim.x - 2, p.sp.sim.y);
    dev3(p, { cmd: 'res', v: 100 });
    await until(() => p.res.some((x) => x.v === 100));
    const n = p.casts.length;
    p.r.send(MSG34.ULT, { aimX: 1, aimY: 0 });
    await until(() => p.casts.length > n);
    expect(p.casts[n]!.ok).toBe(true);
    p.room.hitEnemy(a, 5, p.sp, 0, 0, 0);
    await until(() => b.hp === 25, 1000);
    expect(a.hp).toBe(25);
    clearEnemies(p.room);
    await p.r.leave();
  });

  it('Mend heals; Pulse heals linked allies and you', async () => {
    const p = await fielded('Medic');
    await gates(p);
    await setClass(p, 'entangler');
    await setLevel(p, 3);
    expect((await attune(p, mkBoard({}, { 0: 'mend', 1: 'pulse' }))).ok).toBe(true);
    p.sp.hp = p.sp.maxHp - 30;
    await cast(p, 0);
    expect(p.sp.hp).toBe(p.sp.maxHp - 10);
    expect((await attune(p, mkBoard({ 1: ['x'] }, { 0: 'mend', 1: 'pulse' }))).ok).toBe(true);
    p.sp.hp = p.sp.maxHp - 30;
    let r = await cast(p, 1);
    while (r.results[0]!.misfire) {
      p.sp.hp = p.sp.maxHp - 30;
      r = await cast(p, 1);
    }
    expect(p.sp.hp).toBe(p.sp.maxHp - 16);
    await p.r.leave();
  });
});

describe('shard handoff', () => {
  it('cooldowns and the resource bar survive a handoff ticket', async () => {
    const p = await fielded('Traveller');
    await gates(p);
    await setClass(p, 'superposer');
    expect((await attune(p, mkBoard({}, { 0: 'wavefront' }))).ok).toBe(true);
    await cast(p, 0);
    dev3(p, { cmd: 'res', v: 55 });
    await until(() => p.res.some((x) => x.v === 55));
    const carry: Carry = {};
    p.circuit.carry(p.sp, carry);
    expect(carry.res).toBe(55);
    expect(carry.cd!.wavefront).toBeGreaterThan(3500);
    await p.r.leave();
    await sleep(200);
    const ticket = signTicket(p.accountId, '*', carry, runtime().config.sessionSecret);
    const q = await spawn3(app, 'Traveller', { token: p.token, accountId: p.accountId }, { ticket });
    expect(q.progs[0]!.cd!.wavefront).toBeGreaterThan(Date.now() + 3000);
    expect(q.res[0]!.v).toBe(55);
    expect((await cast(q, 0, 1, 0, false)).error).toBe('Not ready yet.');
    await q.r.leave();
  });
});
