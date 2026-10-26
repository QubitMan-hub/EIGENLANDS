import { describe, expect, it } from 'vitest';
import {
  ABILITIES,
  ACTIVE_LINES,
  BOARD_COLS,
  CLASSES,
  ELEMENTS,
  FLUX,
  GATES,
  MAX_QUBITS,
  QState,
  QUBITPEDIA,
  TUTORIAL,
  TUTORIAL_SKIP_GATES,
  allowedAbilities,
  attuneLocks,
  boardPreview,
  castLines,
  checkBoard,
  cleanChat,
  cumulative,
  emptyBoard,
  emptyGateCounts,
  evaluate,
  firedLines,
  foldWord,
  handoffTarget,
  inRegion,
  ketString,
  lineErrors,
  lineHue,
  nearbyShards,
  parseShard,
  qubitsForLevel,
  rawLineErrors,
  regionBounds,
  regionOf,
  repetitionError,
  rewardsForLevel,
  sampleIndex,
  shardAt,
  shardId,
  tuneSteps,
  validBoard,
  validLocks,
  CODEX_BY_ID,
  isSpammy,
  REGION_TILES,
  type Board,
  type GateCounts,
  type GateId,
} from '../src';

/** Deterministic PRNG for sampling tests. */
function rng(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);
const lots = (): GateCounts => ({ h: 20, x: 20, z: 20, s: 20, t: 20, cx: 20, m: 20 });
function board(lines: Array<Array<GateId | [GateId, number] | null>>, abilities: Board['abilities'] = []): Board {
  const b = emptyBoard();
  lines.forEach((l, q) =>
    l.forEach((g, c) => {
      if (g) b.lines[q]![c] = Array.isArray(g) ? { g: g[0], t: g[1] } : { g };
    }),
  );
  abilities.forEach((a, q) => {
    b.abilities[q] = a;
  });
  return b;
}

describe('quantum simulator', () => {
  it('starts in |0> and H gives an even split', () => {
    const s = new QState(1);
    close(s.prob1(0), 0);
    s.h(0);
    close(s.prob1(0), 0.5);
    close(s.norm(), 1);
  });

  it('interference: H Z H = X and H T H gives cos²(π/8)', () => {
    const a = new QState(1);
    a.h(0);
    a.z(0);
    a.h(0);
    close(a.prob1(0), 1);
    const b = new QState(1);
    b.h(0);
    b.t(0);
    b.h(0);
    close(1 - b.prob1(0), Math.cos(Math.PI / 8) ** 2);
    const c = new QState(1);
    c.h(0);
    c.s(0);
    c.h(0);
    close(c.prob1(0), 0.5);
  });

  it('phase gates are invisible on a basis state', () => {
    const s = new QState(1);
    s.z(0);
    s.t(0);
    s.s(0);
    close(s.prob1(0), 0);
  });

  it('Bell state: perfectly correlated, locally colourless', () => {
    const s = new QState(2);
    s.h(0);
    s.cx(0, 1);
    const p = s.probabilities();
    close(p[0]!, 0.5);
    close(p[3]!, 0.5);
    close(p[1]!, 0);
    close(p[2]!, 0);
    const r = s.reduced(0);
    close(Math.hypot(r.cRe, r.cIm), 0);
    const bl = s.bloch(1);
    close(Math.hypot(bl.x, bl.y, bl.z), 0);
  });

  it('collapse renormalises and an impossible outcome prepares it anyway', () => {
    const s = new QState(2);
    s.h(0);
    s.cx(0, 1);
    const pr = s.collapse(0, 1);
    close(pr, 0.5);
    close(s.prob1(1), 1);
    close(s.norm(), 1);
    const t = new QState(1);
    expect(t.collapse(0, 1)).toBe(0);
    close(t.prob1(0), 1);
  });

  it('reduced density matrix gives the phase as an angle', () => {
    const s = new QState(1);
    s.h(0);
    s.t(0);
    const r = s.reduced(0);
    close(Math.atan2(r.cIm, r.cRe), Math.PI / 4);
    close(Math.hypot(r.cRe, r.cIm), 0.5);
  });

  it('works at 12 qubits and samples by cumulative search', () => {
    const s = new QState(MAX_QUBITS);
    for (let q = 0; q < MAX_QUBITS; q++) s.h(q);
    close(s.norm(), 1, 1e-9);
    const cdf = cumulative(s.probabilities());
    expect(sampleIndex(cdf, 0)).toBe(0);
    expect(sampleIndex(cdf, 0.99999999)).toBe(4095);
    expect(() => new QState(13)).toThrow();
  });

  it('repetition code: 3p² − 2p³ and better with more copies', () => {
    const p = 0.1;
    close(repetitionError(p, 1), p);
    close(repetitionError(p, 3), 3 * p * p - 2 * p ** 3);
    expect(repetitionError(p, 5)).toBeLessThan(repetitionError(p, 3));
    close(repetitionError(0.5, 5), 0.5);
  });
});

describe('circuit board', () => {
  it('a plain orb always gives form A in its base element', () => {
    const b = board([[]], ['glimmer']);
    const pv = boardPreview(b, 1, null);
    close(pv.lines[0]!.pBIdeal, 0);
    expect(pv.lines[0]!.hueA).toBe(ABILITIES.glimmer.forms[0].hue);
    expect(pv.lines[0]!.summary).toContain('always Ember bolt');
    expect(pv.lines[0]!.tuned).toBe(false);
  });

  it('Split gives even odds; Flip gives the opposite element', () => {
    const s = boardPreview(board([['h']], ['glimmer']), 1, null).lines[0]!;
    close(s.pBIdeal, 0.5);
    expect(s.summary).toContain('half the time');
    const x = boardPreview(board([['x']], ['glimmer']), 1, null).lines[0]!;
    close(x.pBIdeal, 1);
    expect(x.summary).toContain('always Frost bolt');
    expect(ELEMENTS[ABILITIES.split_shot.forms[1].hue]!.id).toBe((ABILITIES.split_shot.forms[0].hue + 4) % 8);
  });

  it("every ability's form B is the opposite element of form A", () => {
    for (const a of Object.values(ABILITIES)) expect(a.forms[1].hue).toBe((a.forms[0].hue + 4) % 8);
  });

  it('Tune only colours a split orb; tuning steps follow the phase', () => {
    const b0 = board([['z']], ['glimmer']);
    expect(tuneSteps(evaluate(b0, 1), 0)).toBeNull();
    const bt = board([['h', 't']], ['glimmer']);
    const ev = evaluate(bt, 1);
    expect(tuneSteps(ev, 0)).toBe(1);
    expect(lineHue(bt, ev, 0, 0)).toBe(1); // Ember turned one step -> Spark
    const bz = board([['h', 'z']], ['glimmer']);
    expect(lineHue(bz, evaluate(bz, 1), 0, 0)).toBe(4);
    expect(lineHue(bz, evaluate(bz, 1), 0, 1)).toBe(0);
  });

  it('Split, Tune, Split interferes to a certain outcome (the tutorial trick)', () => {
    const pv = boardPreview(board([['h', 'z', 'h']], ['glimmer']), 1, null).lines[0]!;
    close(pv.pBIdeal, 1);
    expect(pv.hueB).toBe(4);
    const t = boardPreview(board([['h', 't', 'h']], ['glimmer']), 1, null).lines[0]!;
    close(1 - t.pBIdeal, Math.cos(Math.PI / 8) ** 2);
    expect(t.summary).toContain('sometimes');
  });

  it('Link fires the target and correlates outcomes', () => {
    const b = board([['h', ['cx', 1]], []], ['split_shot', 'wavefront']);
    expect(firedLines(b, 2, 0)).toEqual([0, 1]);
    expect(firedLines(b, 2, 1)).toEqual([1]);
    const pv = boardPreview(b, 2, null);
    expect(pv.lines[0]!.fires).toEqual([1]);
    expect(pv.lines[1]!.firedBy).toEqual([0]);
    expect(pv.joints).toHaveLength(1);
    const j = pv.joints[0]!;
    expect(j.outcomes).toHaveLength(2);
    for (const o of j.outcomes) {
      expect(o.bits[0]).toBe(o.bits[1]);
      close(o.p, 0.5);
    }
    // entangled lines carry no local colour
    expect(pv.lines[0]!.tuned).toBe(false);
    // sampled casts always match on a perfect board
    const ev = evaluate(b, 2);
    const r = rng(7);
    for (let i = 0; i < 200; i++) {
      const out = castLines(b, ev, 0, [0, 0], r);
      expect(out.map((o) => o.q)).toEqual([0, 1]);
      expect(out[0]!.bit).toBe(out[1]!.bit);
      expect(out[1]!.link).toBe(true);
    }
  });

  it('Link chains are followed transitively without loops', () => {
    const b = board([[['cx', 1]], [null, ['cx', 2]], [null, null, ['cx', 0]]]);
    expect(firedLines(b, 3, 0)).toEqual([0, 1, 2]);
  });

  it('Lock-in: preview branches exactly, attune decides, then it stays fixed', () => {
    const b = board([['h', 'm']], ['glimmer']);
    const pre = boardPreview(b, 1, null);
    expect(pre.lines[0]!.locked).toBe('pending');
    close(pre.lines[0]!.pBIdeal, 0.5);
    expect(pre.ev.branches).toBe(2);
    close(pre.ev.lockP1['0:1']!, 0.5);
    let ones = 0;
    const r = rng(3);
    for (let i = 0; i < 400; i++) ones += attuneLocks(b, 1, r)['0:1']!;
    expect(ones).toBeGreaterThan(150);
    expect(ones).toBeLessThan(250);
    const post = boardPreview(b, 1, { '0:1': 1 });
    expect(post.lines[0]!.locked).toBe(1);
    close(post.lines[0]!.pBIdeal, 1);
    expect(post.lines[0]!.summary).toContain('Locked in');
  });

  it('a Lock on one half of a pair decides the partner too', () => {
    const b = board([['h', ['cx', 1], 'm'], []], ['split_shot', 'wavefront']);
    const ev = evaluate(b, 2, { '0:2': 1 });
    close(ev.p1[0]!, 1);
    close(ev.p1[1]!, 1);
  });

  it('measurement destroys interference (decoherence)', () => {
    // H, Lock, H: the second split sees no phase memory, so it is 50/50 whatever the lock said
    const b = board([['h', 'm', 'h']], ['glimmer']);
    close(evaluate(b, 1, { '0:1': 0 }).p1[0]!, 0.5);
    close(evaluate(b, 1).p1[0]!, 0.5);
  });

  it('noise grows with gates, crowding and links; runes suppress it', () => {
    const small = board([['h']], ['glimmer']);
    const e1 = rawLineErrors(small, 1)[0]!;
    close(e1, GATES.h.err);
    const big = board([['h', 'z', 'h', 't', 'h', 'x', 's', 'h']], ['glimmer']);
    const e2 = rawLineErrors(big, 1)[0]!;
    expect(e2).toBeGreaterThan(e1 * 5);
    const prot = { ...big, runes: [2, ...big.runes.slice(1)] };
    expect(lineErrors(prot, 1)[0]!).toBeLessThan(e2 / 10);
    const linked = board([[['cx', 1]], []]);
    const le = rawLineErrors(linked, 2);
    close(le[0]!, GATES.cx.err);
    close(le[1]!, GATES.cx.err);
    // a Lock resets the line's history
    const locked = board([['h', 'z', 'h', 't', 'm']], ['glimmer']);
    close(rawLineErrors(locked, 1)[0]!, GATES.m.err);
  });

  it('misfires flip the form and turn Flux', () => {
    const b = board([[]], ['glimmer']);
    const ev = evaluate(b, 1);
    const out = castLines(b, ev, 0, [1], rng(2));
    expect(out[0]!.misfire).toBe(true);
    expect(out[0]!.bit).toBe(1);
    expect(out[0]!.hue).toBe(FLUX);
  });

  it('checkBoard enforces tokens, unlocks, abilities and overlaps', () => {
    const rules = { qubits: 2, gates: lots(), runes: 1, allowed: allowedAbilities('superposer', null) };
    expect(checkBoard(board([['h'], ['x']], ['split_shot', 'wavefront']), rules)).toBeNull();
    expect(checkBoard(board([['h', 'h']]), { ...rules, gates: { ...emptyGateCounts(), h: 1 } })).toContain('Split');
    expect(checkBoard(board([[], [], ['h']]), rules)).toContain('not unlocked');
    expect(checkBoard(board([[]], ['tether']), rules)).toContain('not one of your abilities');
    expect(checkBoard(board([[], []], ['split_shot', 'split_shot']), rules)).toContain('already');
    expect(checkBoard(board([[['cx', 1]], ['h']]), rules)).toContain('empty spot');
    expect(checkBoard(board([[['cx', 5]]]), rules)).toContain('another unlocked orb');
    expect(checkBoard({ ...board([[]]), runes: [2, 0, ...Array(10).fill(0)] }, rules)).toContain('runes');
    const fiveLocks = board([
      ['m', 'm', 'm'],
      ['m', 'm'],
    ]);
    expect(checkBoard(fiveLocks, rules)).toContain('Lock');
  });

  it('validBoard never trusts its input', () => {
    const bad = {
      lines: [[{ g: 'h' }, { g: 'nope' }, { g: 'cx', t: 0 }, { g: 'cx', t: 99 }, 'x', null, { g: 'cx', t: 3 }]],
      abilities: ['glimmer', 'hack', 5],
      runes: [9, 1, -1],
    };
    const b = validBoard(bad);
    expect(b.lines).toHaveLength(MAX_QUBITS);
    expect(b.lines[0]).toHaveLength(BOARD_COLS);
    expect(b.lines[0]![0]).toEqual({ g: 'h' });
    expect(b.lines[0]![1]).toBeNull();
    expect(b.lines[0]![2]).toBeNull(); // link to itself
    expect(b.lines[0]![3]).toBeNull();
    expect(b.lines[0]![6]).toEqual({ g: 'cx', t: 3 });
    expect(b.abilities.slice(0, 3)).toEqual(['glimmer', null, null]);
    expect(b.runes.slice(0, 3)).toEqual([0, 1, 0]);
    expect(validBoard(null).lines).toHaveLength(MAX_QUBITS);
    expect(validLocks({ '0:1': 1, '0:2': 2, x: 1, '99:1': 0 })).toEqual({ '0:1': 1 });
  });

  it('support lines are explained and active lines are the first four', () => {
    const b = board([[], [], [], [], []], ['split_shot', 'echo_step', 'wavefront', 'prob_ward', 'glimmer']);
    const pv = boardPreview(b, 5, null);
    expect(pv.lines.filter((l) => l.active)).toHaveLength(ACTIVE_LINES);
    expect(pv.lines[4]!.summary).toContain('support orb');
  });

  it('a full 12-orb board previews quickly', () => {
    const b = emptyBoard();
    for (let q = 0; q < 12; q++) {
      b.lines[q]![0] = { g: 'h' };
      b.lines[q]![2] = { g: 't' };
    }
    for (let q = 0; q < 11; q++) b.lines[q]![1 + (q % 2 ? 2 : 0)] = q % 2 ? null : { g: 'cx', t: q + 1 };
    b.lines[0]![5] = { g: 'm' };
    b.lines[3]![6] = { g: 'm' };
    b.lines[7]![7] = { g: 'm' };
    const t0 = performance.now();
    const pv = boardPreview(b, 12, null);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(pv.ev.branches).toBeLessThanOrEqual(8);
    close(
      pv.ev.joint.reduce((a, p) => a + p, 0),
      1,
      1e-6,
    );
  });

  it('orbs unlock by level, plus the tutorial bonus', () => {
    expect(qubitsForLevel(1)).toBe(1);
    expect(qubitsForLevel(2)).toBe(1);
    expect(qubitsForLevel(3)).toBe(2);
    expect(qubitsForLevel(1, 1)).toBe(2);
    expect(qubitsForLevel(99)).toBe(12);
    expect(qubitsForLevel(99, 1)).toBe(12);
  });

  it('level rewards: one gate per level, extra Split every 5, a rune every 4', () => {
    expect(rewardsForLevel(1)).toEqual({ gates: [], runes: 0 });
    expect(rewardsForLevel(2).gates).toEqual(['h']);
    expect(rewardsForLevel(4).runes).toBe(1);
    expect(rewardsForLevel(5).gates).toHaveLength(2);
  });

  it('Expert View ket notation', () => {
    const s = new QState(2);
    s.h(0);
    s.cx(0, 1);
    expect(ketString(s)).toBe('0.707|00⟩ + 0.707|11⟩');
  });
});

describe('classes', () => {
  it('two playable classes with 4 abilities, 3 original specs plus Wayguard, a resource and an ultimate', () => {
    for (const id of ['superposer', 'entangler'] as const) {
      const c = CLASSES[id];
      expect(c.abilities).toHaveLength(4);
      expect(c.specs).toHaveLength(4);
      expect(c.specs.some((s) => s.id === 'guild_warden')).toBe(true);
      expect(c.specs.filter((s) => s.id !== 'guild_warden')).toHaveLength(3);
      expect(c.ultimate.secs).toBeGreaterThan(0);
      for (const a of c.abilities) expect(ABILITIES[a].cls).toBe(id);
    }
  });
  it('multiclass adds the second class abilities', () => {
    expect(allowedAbilities('superposer', 'entangler')).toHaveLength(8);
    expect(allowedAbilities('wanderer', null)).toEqual(['glimmer']);
  });
});

describe('tutorial', () => {
  it('every cast pattern can be built from the gates granted so far', () => {
    const have = emptyGateCounts();
    for (const step of TUTORIAL) {
      for (const g of step.grant?.gates ?? []) have[g]++;
      if (step.goal.kind === 'casts') {
        const need = emptyGateCounts();
        for (const g of step.goal.pattern) need[g]++;
        for (const g of Object.keys(need) as GateId[]) expect(have[g]).toBeGreaterThanOrEqual(need[g]);
        expect(
          checkBoard(board([step.goal.pattern], ['glimmer']), {
            qubits: 1,
            gates: have,
            runes: 0,
            allowed: ['glimmer'],
          }),
        ).toBeNull();
      }
      for (const c of step.codex ?? []) expect(CODEX_BY_ID[c]).toBeTruthy();
    }
    expect(TUTORIAL_SKIP_GATES.length).toBeGreaterThan(4);
  });
  it('tutorial and codex text avoid equations', () => {
    for (const s of TUTORIAL) for (const l of [...s.lines, s.hint, s.done]) expect(l).not.toMatch(/[=|⟩√%]/);
    for (const e of QUBITPEDIA) expect(e.seen + e.idea).not.toMatch(/[=⟩√]/);
  });
});

describe('shards', () => {
  it('region (0,0) is centred on spawn and regions tile the plane', () => {
    expect(shardAt(0, 0)).toBe('0,0');
    const b = regionBounds({ rx: 0, ry: 0 });
    expect(b.x0).toBe(-REGION_TILES / 2);
    expect(b.x1 - b.x0).toBe(REGION_TILES);
    expect(shardAt(b.x1, 0)).toBe('1,0');
    expect(shardAt(b.x0 - 0.01, b.y0 - 0.01)).toBe('-1,-1');
    expect(inRegion({ rx: 0, ry: 0 }, b.x1 - 0.5, 0)).toBe(true);
    expect(shardId(regionOf(b.x1 + 5, b.y1 + 5))).toBe('1,1');
  });
  it('handoff waits for the margin (hysteresis)', () => {
    const r = { rx: 0, ry: 0 };
    const b = regionBounds(r);
    expect(handoffTarget(r, b.x1 + 1, 0)).toBeNull();
    expect(handoffTarget(r, b.x1 + 3, 0)).toBe('1,0');
    expect(handoffTarget(r, 0, b.y0 - 3)).toBe('0,-1');
  });
  it('nearby shards for ghosts', () => {
    const r = { rx: 0, ry: 0 };
    const b = regionBounds(r);
    expect(nearbyShards(r, 0, 0)).toEqual([]);
    expect(nearbyShards(r, b.x1 - 5, 0)).toEqual(['1,0']);
    expect(nearbyShards(r, b.x1 - 5, b.y1 - 5).sort()).toEqual(['0,1', '1,0', '1,1']);
  });
  it('parses shard ids strictly', () => {
    expect(parseShard('3,-2')).toEqual({ rx: 3, ry: -2 });
    expect(parseShard('3;-2')).toBeNull();
    expect(parseShard(7)).toBeNull();
  });
});

describe('chat filter', () => {
  it('masks bad words including letter swaps and stretching, keeps punctuation', () => {
    expect(cleanChat('well sh1t!')).toBe('well ****!');
    expect(cleanChat('FUUUUCK this')).toMatch(/^\*{5,} this$/);
    expect(cleanChat('fucking hell')).toMatch(/^\*+ hell$/);
    expect(cleanChat('a classic assassin passes')).toBe('a classic assassin passes');
    expect(cleanChat('you ass')).toBe('you ***');
  });
  it('strips control characters and clamps length', () => {
    expect(cleanChat('hi\u0000‮ there\n')).toBe('hi there');
    expect(cleanChat('x'.repeat(500))).toHaveLength(200);
    expect(cleanChat(42)).toBe('');
  });
  it('folds words and spots spam', () => {
    expect(foldWord('H3LL00')).toBe('helo');
    expect(isSpammy('aaaaaaaaaaaaaaaa')).toBe(true);
    expect(isSpammy('hello there friend')).toBe(false);
  });
});
