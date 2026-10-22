import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ATTUNE_COOLDOWN_MS, MSG34, RUNE_PRICE, TUTORIAL_DONE, allowedAbilities, emptyGateCounts, rewardsForLevel,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { runtime34 } from '../src/p34/runtime34';
import { validProgress } from '../src/p34/circuit';
import { startApp } from './helpers';
import {
  attune, boot3, cast, dev, dev3, mkBoard, relax3, setClass, setLevel, sleep, spawn3, st, until,
} from './p3helpers';

let app: App;
beforeAll(async () => { app = await boot3(); });
afterAll(async () => { await app?.close(); });

describe('new characters', () => {
  it('start as a Wanderer with Glimmer Bolt on orb 1, no gates and the story at its first step', async () => {
    const p = await spawn3(app, 'Newcomer');
    expect(p.progs[0]).toMatchObject({
      cls: 'wanderer', spec: null, second: null, gates: emptyGateCounts(), runes: 0, qubits: 1, codex: [],
      tutorial: { step: 0, count: 0, skipped: false }, locks: {},
    });
    expect(p.prog.board!.abilities[0]).toBe('glimmer');
    expect(p.prog.board!.abilities.slice(1).every((a) => a === null)).toBe(true);
    expect(p.prog.board!.lines.flat().every((c) => c === null)).toBe(true);
    expect(p.res[0]).toEqual({ v: 0, max: 100 });
    expect(p.room.circuit.classOf(p.sid)).toBe('wanderer');
    await until(() => p.room.state.players.get(p.sid)?.cls === 0);
    await p.r.leave();
  });
});

describe('attuning', () => {
  it('validates boards with plain-language errors and enforces the attune cooldown', async () => {
    const p = await spawn3(app, 'Tinker');
    // no gates owned yet
    expect((await attune(p, mkBoard({ 0: ['h'] }, { 0: 'glimmer' }))).toast).toMatch(/only have 0 Split gates/);
    dev3(p, { cmd: 'gates' });
    await until(() => p.prog.gates?.h === 9);
    expect(p.prog.runes).toBe(6);
    expect((await attune(p, mkBoard({ 1: ['h'] }, { 0: 'glimmer' }))).toast).toMatch(/not unlocked yet/);
    expect((await attune(p, mkBoard({}, { 0: 'split_shot' }))).toast).toMatch(/not one of your abilities/);
    expect((await attune(p, mkBoard({ 0: ['m', 'm', 'm', 'm', 'm'] }, { 0: 'glimmer' }))).toast).toMatch(/At most 4 Lock-ins/);
    expect((await attune(p, mkBoard({ 0: [['cx', 1]] }, { 0: 'glimmer' }))).toast).toMatch(/Link needs another unlocked orb/);
    expect((await attune(p, mkBoard({}, { 0: 'glimmer' }, { 0: 2, 1: 0 }))).ok).toBe(true);
    expect((await attune(p, mkBoard({}, { 0: 'glimmer' }, { 0: 3 }))).ok).toBe(true); // 3 runes is coerced to none (max 2)
    expect(st(p).pr.board.runes[0]).toBe(0);

    // a good board: stored, evaluated and its gates unlock Qubitpedia entries
    const ok = await attune(p, mkBoard({ 0: ['h', 'z', 'h'] }, { 0: 'glimmer' }));
    expect(ok.ok).toBe(true);
    expect(p.prog.board!.lines[0]!.slice(0, 3)).toEqual([{ g: 'h' }, { g: 'z' }, { g: 'h' }]);
    expect(p.prog.codex).toEqual(expect.arrayContaining(['qubit', 'superposition', 'phase']));
    expect(st(p).ev.p1[0]).toBeCloseTo(1, 6);
    expect(p.prog.attuneReady).toBeGreaterThan(Date.now() + ATTUNE_COOLDOWN_MS - 1500);

    // attuning again right away is refused
    const res = await attune(p, mkBoard({ 0: ['x'] }, { 0: 'glimmer' }), false);
    expect(res.toast).toMatch(/still settling/);
    expect(st(p).pr.board.lines[0]![0]).toEqual({ g: 'h' });
    await p.r.leave();
  });
});

describe('class, specialization and second class', () => {
  it('follows the level and Wanderer rules', async () => {
    const p = await spawn3(app, 'Chooser');
    p.r.send(MSG34.CHOOSE, { what: 'spec', spec: 'phantom' });
    await until(() => p.toasts.some((t) => /Choose a class first/.test(t.text)));
    p.r.send(MSG34.CHOOSE, { what: 'class', cls: 'wanderer' }); // not a playable choice: ignored
    p.r.send(MSG34.CHOOSE, { what: 'class', cls: 'superposer' });
    await until(() => p.prog.cls === 'superposer');
    expect(p.prog.board!.abilities[0]).toBe('split_shot'); // Glimmer is replaced by the class's first ability
    await until(() => p.room.state.players.get(p.sid)?.cls === 1);
    p.r.send(MSG34.CHOOSE, { what: 'class', cls: 'entangler' });
    await until(() => p.toasts.some((t) => /already chosen/.test(t.text)));
    expect(st(p).pr.cls).toBe('superposer');

    p.r.send(MSG34.CHOOSE, { what: 'spec', spec: 'phantom' });
    await until(() => p.toasts.some((t) => /open at level 10/.test(t.text)));
    await setLevel(p, 10);
    p.r.send(MSG34.CHOOSE, { what: 'spec', spec: 'weaver' }); // another class's spec: ignored
    await sleep(100);
    expect(st(p).pr.spec).toBeNull();
    p.r.send(MSG34.CHOOSE, { what: 'spec', spec: 'phantom' });
    await until(() => p.prog.spec === 'phantom');
    p.r.send(MSG34.CHOOSE, { what: 'spec', spec: 'collapse' });
    await until(() => p.toasts.some((t) => /already specialized/.test(t.text)));

    p.r.send(MSG34.CHOOSE, { what: 'second', cls: 'entangler' });
    await until(() => p.toasts.some((t) => /open at level 30|opens at level 30/.test(t.text)));
    await setLevel(p, 30);
    p.r.send(MSG34.CHOOSE, { what: 'second', cls: 'superposer' });
    await until(() => p.toasts.some((t) => /different class/.test(t.text)));
    p.r.send(MSG34.CHOOSE, { what: 'second', cls: 'entangler' });
    await until(() => p.prog.second === 'entangler');
    // every orb that was free now holds an ability, and both classes' abilities are allowed
    const placed = p.prog.board!.abilities.filter(Boolean);
    expect(placed).toEqual(expect.arrayContaining(allowedAbilities('superposer', 'entangler')));
    const mixed = mkBoard({}, { 0: 'tether', 1: 'split_shot', 2: 'pulse' });
    expect((await attune(p, mixed)).ok).toBe(true);
    await p.r.leave();
  });
});

describe('level rewards', () => {
  it('grants gates and runes once per level, and wakes orbs on schedule', async () => {
    const p = await spawn3(app, 'Climber');
    const n0 = p.toasts.length;
    await setLevel(p, 4);
    // levels 2, 3, 4: Split, Tune ¼, Flip, plus a rune at level 4
    const want = emptyGateCounts();
    for (let l = 2; l <= 4; l++) for (const g of rewardsForLevel(l).gates) want[g]++;
    expect(p.prog.gates).toEqual(want);
    expect(p.prog.runes).toBe(1);
    expect(p.prog.qubits).toBe(2);
    expect(p.toasts.slice(n0).map((t) => t.text)).toEqual(expect.arrayContaining([
      'New gates: Split, Tune ¼, Flip', 'New Error Correction rune', 'A new orb awakens on your Board.',
    ]));
    // nothing is granted twice
    await sleep(1200);
    expect(p.prog.gates).toEqual(want);
    expect(st(p).pr.rewardedLevel).toBe(4);
    await setLevel(p, 5);
    expect(p.toasts.some((t) => t.text === 'New gates: Flip, Split' || t.text === 'New gates: Link, Split')).toBe(true);
    await p.r.leave();
  });
});

describe('runes', () => {
  it('can be bought for coins, and only with enough coins', async () => {
    const p = await spawn3(app, 'Shopper');
    expect(p.sp.data.coins).toBe(100);
    p.r.send(MSG34.BUY_RUNE, {});
    await until(() => p.toasts.some((t) => /costs 150 coins/.test(t.text)));
    expect(st(p).pr.runes).toBe(0);
    dev(p, { cmd: 'coins', n: 100 });
    await until(() => p.sp.data.coins === 200);
    p.r.send(MSG34.BUY_RUNE, {});
    await until(() => p.prog.runes === 1);
    expect(p.sp.data.coins).toBe(200 - RUNE_PRICE);
    p.r.send(MSG34.BUY_RUNE, {});
    await sleep(150);
    expect(st(p).pr.runes).toBe(1);
    expect(p.sp.data.coins).toBe(50);
    await p.r.leave();
  });
});

describe('robustness', () => {
  it('junk payloads never crash the room and never change progress', async () => {
    const p = await spawn3(app, 'Fuzzer');
    const before = JSON.stringify(st(p).pr);
    const junk: unknown[] = [null, 0, 'x', [], { board: 'x' }, { board: null }, { board: { lines: 'bad', abilities: [1, 2], runes: {} } },
      { board: { lines: [[{ g: 'cx', t: 99 }]], abilities: ['__proto__'] } }, { line: 'a' }, { line: 1e9 }, { line: -1 }, { line: 0.5 },
      { what: 'class', cls: '__proto__' }, { what: 'spec', spec: { a: 1 } }, { what: 'second' }, { action: 'nope' }, { cmd: 'tutorial', step: 1e9 },
      { cmd: 'class', cls: 'toString' }, { cmd: 'res', v: 'lots' }];
    for (const type of [MSG34.ATTUNE, MSG34.CAST, MSG34.ULT, MSG34.CHOOSE, MSG34.BUY_RUNE, MSG34.TUTORIAL, 'p3_dev']) {
      for (const m of junk) p.r.send(type, m as never);
    }
    p.r.send(MSG34.CAST, { line: 0, aimX: NaN, aimY: Infinity });
    await sleep(300);
    // a malformed board object is coerced by shape (here: an empty board, which is legal); the room keeps running
    expect(p.room.players.has(p.sid)).toBe(true);
    expect((await attune(p, mkBoard({}, { 0: 'glimmer' }))).ok).toBe(true);
    const r = await cast(p, 0);
    expect(r.ok).toBe(true);
    const now = st(p).pr;
    expect(now.cls).toBe('wanderer');
    expect(now.gates).toEqual(JSON.parse(before).gates);
    expect(now.tutorial).toEqual(JSON.parse(before).tutorial);
    await p.r.leave();
  });

  it('rate limits casts and board messages', async () => {
    const p = await spawn3(app, 'Spammer', undefined, { relax: false });
    const n0 = p.casts.length;
    for (let i = 0; i < 100; i++) p.r.send(MSG34.CAST, { line: 0, aimX: 1, aimY: 0 });
    await sleep(400);
    const got = p.casts.length - n0;
    expect(got).toBeGreaterThan(0);
    expect(got).toBeLessThanOrEqual(16); // burst 12 + refill at 8/s
    expect(p.casts.slice(n0).filter((c) => c.ok).length).toBe(1); // the cooldown allows one real cast
    const t0 = p.toasts.length;
    for (let i = 0; i < 40; i++) p.r.send(MSG34.BUY_RUNE, {});
    await sleep(300);
    expect(p.toasts.length - t0).toBeLessThanOrEqual(6);
    relax3(p);
    await p.r.leave();
  });

  it('stored progress is validated, never trusted', () => {
    const { pr } = validProgress({
      cls: 'superposer', spec: 'weaver', second: 'superposer', gates: { h: -5, x: 1e9, cx: 'many' }, runes: 9999,
      codex: ['qubit', 'qubit', 'bogus', 7], tutorial: { step: 99, count: -1, skipped: 'yes' }, rewardedLevel: 'x', qubitBonus: 7,
      board: { lines: [[{ g: 'h' }]], abilities: ['split_shot', 'split_shot', 'glimmer'] },
    }, 1);
    expect(pr.cls).toBe('superposer');
    expect(pr.spec).toBeNull();
    expect(pr.second).toBeNull();
    expect(pr.gates.h).toBe(0);
    expect(pr.gates.x).toBe(999);
    expect(pr.gates.cx).toBe(0);
    expect(pr.runes).toBe(24);
    expect(pr.codex).toEqual(['qubit']);
    expect(pr.tutorial).toEqual({ step: TUTORIAL_DONE, count: 0, skipped: false });
    expect(pr.rewardedLevel).toBe(1);
    expect(pr.qubitBonus).toBe(1);
    // the stored board breaks the rules (a Split nobody owns, a duplicate ability): reset to the class's abilities
    expect(pr.board.lines.flat().every((c) => c === null)).toBe(true);
    expect(pr.board.abilities.slice(0, 2)).toEqual(['split_shot', 'echo_step']);
    expect(validProgress('garbage', 1).pr.cls).toBe('wanderer');
    expect(validProgress([1, 2], 1).pr.board.abilities[0]).toBe('glimmer');
  });
});

describe('persistence', () => {
  it('progress, Lock-ins and junk rows survive a server restart', async () => {
    const p = await spawn3(app, 'Keeper');
    const creds = { token: p.token, accountId: p.accountId };
    dev3(p, { cmd: 'gates' });
    await until(() => p.prog.gates?.m === 9);
    await setClass(p, 'superposer');
    await setLevel(p, 3);
    const board = mkBoard({ 0: ['h', 'm'], 1: ['h', 'm'] }, { 0: 'split_shot', 1: 'wavefront' }, { 0: 1 });
    expect((await attune(p, board)).ok).toBe(true);
    const locks = { ...st(p).pr.locks };
    expect(Object.keys(locks).sort()).toEqual(['0:1', '1:1']);
    // a locked line always casts its stored result (barring a rare slip)
    for (let i = 0; i < 6; i++) {
      const r = await cast(p, 0);
      const l0 = r.results[0]!;
      expect(l0.locked).toBe(true);
      if (!l0.misfire) expect(l0.bit).toBe(locks['0:1']);
    }
    const saved = JSON.parse(JSON.stringify(st(p).pr));
    await p.r.leave();
    await sleep(300);
    await app.close();

    app = await startApp({ config: { devCommands: true } });
    const q = await spawn3(app, 'Keeper', creds);
    expect(q.progs[0]).toMatchObject({ cls: 'superposer', locks, gates: saved.gates, runes: saved.runes, codex: saved.codex, qubits: 2 });
    expect(q.prog.board).toEqual(saved.board);
    for (let i = 0; i < 4; i++) {
      const l0 = (await cast(q, 0)).results[0]!;
      if (!l0.misfire) expect(l0.bit).toBe(locks['0:1']);
    }
    await q.r.leave();
    await sleep(200);

    // a corrupted row is coerced into something valid on the next join
    await runtime34().repo34.saveProgress(creds.accountId, { cls: 'nope', board: 'x', gates: [1, 2, 3], tutorial: null });
    const z = await spawn3(app, 'Keeper', creds);
    expect(z.progs[0]).toMatchObject({ cls: 'wanderer', runes: 0, tutorial: { step: 0, count: 0, skipped: false } });
    expect(z.prog.board!.abilities[0]).toBe('glimmer');
    await z.r.leave();
  });
});
