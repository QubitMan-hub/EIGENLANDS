import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MSG34,
  TUTORIAL,
  TUTORIAL_DONE,
  TUTORIAL_REWARD,
  TUTORIAL_SKIP_GATES,
  emptyGateCounts,
  rewardsForLevel,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { attune, boot3, cast, dummy, flatten, mkBoard, sleep, spawn3, st, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3();
});
afterAll(async () => {
  await app?.close();
});

const step = (p: P3) => p.prog.tutorial!.step;
const stepId = (p: P3) => TUTORIAL[step(p)]?.id ?? 'done';

describe('The Flickering Orb', () => {
  it('walks the whole story: open, split, flip, interfere, fight, choose, link, lock', async () => {
    const p = await spawn3(app, 'Lumenfriend');
    await tp(p, 200.5, 200.5);
    flatten(p.room, 200, 200, 9);
    expect(stepId(p)).toBe('wake');

    // Wake: opening the Board
    p.r.send(MSG34.TUTORIAL, { action: 'board_open' });
    await until(() => stepId(p) === 'split');
    expect(p.prog.gates!.h).toBe(1); // the step's gift arrives as it begins

    // Split: three casts with Split on orb 1 (casts without it do not count)
    await cast(p, 0);
    expect(p.prog.tutorial!.count).toBe(0);
    expect((await attune(p, mkBoard({ 0: ['h'] }, { 0: 'glimmer' }))).ok).toBe(true);
    for (let i = 0; i < 3; i++) await cast(p, 0);
    await until(() => stepId(p) === 'flip');
    expect(p.prog.codex).toEqual(expect.arrayContaining(['qubit', 'superposition']));
    expect(p.prog.gates!.x).toBe(1);

    // Flip
    expect((await attune(p, mkBoard({ 0: ['x'] }, { 0: 'glimmer' }))).ok).toBe(true);
    await cast(p, 0);
    await until(() => stepId(p) === 'interfere');
    expect(p.prog.gates).toMatchObject({ h: 2, z: 1 });

    // Interfere: Split, Tune, Split
    expect((await attune(p, mkBoard({ 0: ['h', 'z', 'h'] }, { 0: 'glimmer' }))).ok).toBe(true);
    await cast(p, 0);
    await cast(p, 0);
    await until(() => stepId(p) === 'fight');
    expect(p.prog.codex).toEqual(expect.arrayContaining(['phase', 'interference']));

    // Fight: three creatures defeated by the orb (melee kills would not count)
    for (let k = 0; k < 3; k++) {
      const e = dummy(p.room, p.sp.sim.x + 3, p.sp.sim.y);
      while (p.room.enemies.has(e.id)) {
        await cast(p, 0);
        await sleep(150);
      }
      await until(() => p.prog.tutorial!.count === k + 1 || stepId(p) === 'choose');
    }
    await until(() => stepId(p) === 'choose');
    expect(p.prog.qubits).toBe(2); // the early second orb
    expect(p.prog.codex).toContain('measurement');

    // Choose
    p.r.send(MSG34.CHOOSE, { what: 'class', cls: 'entangler' });
    await until(() => stepId(p) === 'link');
    expect(p.prog.cls).toBe('entangler');
    expect(p.prog.board!.abilities.slice(0, 2)).toEqual(['tether', 'pulse']);
    expect(p.prog.gates!.cx).toBe(1);

    // Link: orb 1 fires orb 2
    expect((await attune(p, mkBoard({ 0: [['cx', 1]] }, { 0: 'tether', 1: 'pulse' }))).ok).toBe(true);
    const r = await cast(p, 0);
    expect(r.results.map((x) => x.q)).toEqual([0, 1]);
    await until(() => stepId(p) === 'lock');
    expect(p.prog.gates!.m).toBe(1);

    // Lock: attune a board holding a Lock-in
    const coins = p.sp.data.coins;
    expect((await attune(p, mkBoard({ 0: ['m'] }, { 0: 'tether', 1: 'pulse' }))).ok).toBe(true);
    await until(() => step(p) === TUTORIAL_DONE);
    expect(p.prog.tutorial).toEqual({ step: TUTORIAL_DONE, count: 0, skipped: false });
    expect(p.prog.codex).toEqual(expect.arrayContaining(['entanglement', 'decoherence', 'correction']));
    // story gifts + the final reward + whatever the fights' levels brought (granted by the once-a-second level poll)
    await until(() => st(p).pr.rewardedLevel === p.sp.level && p.prog.gates!.h === st(p).pr.gates.h, 2500);
    const want = { ...emptyGateCounts(), h: 3, x: 2, z: 1, t: 1, cx: 1, m: 1 };
    let runes = TUTORIAL_REWARD.runes;
    for (let l = 2; l <= p.sp.level; l++) {
      const r = rewardsForLevel(l);
      r.gates.forEach((g) => want[g]++);
      runes += r.runes;
    }
    expect(p.prog.gates).toEqual(want);
    expect(p.prog.runes).toBe(runes);
    await until(() => p.sp.data.coins === coins + TUTORIAL_REWARD.coins);
    expect(st(p).pr.tutRewarded).toBe(true);
    await p.r.leave();
  });

  it('can be skipped (with every gift) and restarted without gifts being handed out twice', async () => {
    const p = await spawn3(app, 'Skipper');
    p.r.send(MSG34.TUTORIAL, { action: 'skip' });
    await until(() => step(p) === TUTORIAL_DONE);
    const want = emptyGateCounts();
    for (const g of [...TUTORIAL_SKIP_GATES, ...TUTORIAL_REWARD.gates]) want[g]++;
    expect(p.prog.gates).toEqual(want);
    expect(p.prog.tutorial!.skipped).toBe(true);
    expect(p.prog.qubits).toBe(2);
    await until(() => p.sp.data.coins === 100 + TUTORIAL_REWARD.coins);

    // a Wanderer who skipped still chooses a class
    p.r.send(MSG34.CHOOSE, { what: 'class', cls: 'superposer' });
    await until(() => p.prog.cls === 'superposer');

    p.r.send(MSG34.TUTORIAL, { action: 'restart' });
    await until(() => step(p) === 0);
    p.r.send(MSG34.TUTORIAL, { action: 'board_open' });
    await until(() => step(p) === 1);
    p.r.send(MSG34.TUTORIAL, { action: 'skip' });
    await until(() => step(p) === TUTORIAL_DONE);
    await sleep(150);
    expect(st(p).pr.gates).toEqual(want);
    expect(p.sp.data.coins).toBe(100 + TUTORIAL_REWARD.coins);
    await p.r.leave();
  });
});
