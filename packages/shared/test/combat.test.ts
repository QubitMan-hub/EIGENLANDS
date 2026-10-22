import { describe, expect, it } from 'vitest';
import {
  ACK_BYTES, ACK_FIELDS, ARMOR_LIGHT_MULT, CHARGE_FULL, CHARGE_MIN, COMBO, CRIT_MULT, DASH_CHARGES, DASH_COOLDOWN, ENEMY_BY_KIND,
  ENEMY_DEFS, IFRAME_TIME, PERFECT_WINDOW, TICK_DT, VULNERABLE_MULT, chargeLevel, critChance, decodeAck, encodeAck, eliteChance,
  enemyScale, hasIframes, heavyHit, hitStopMs, inArc, isPerfectDodge, newPlayerSim, pickSpawn, resolveHit, rollCrit, sanitizeCmd,
  shakeFor, shapeHits, slamDamage, spawnTable, stepPlayer, type InputCmd, type PlayerSim,
} from '../src';

const open = () => false;
const cmd = (o: Partial<InputCmd> = {}): InputCmd => sanitizeCmd({ seq: 1, ...o });
const run = (p: PlayerSim, n: number, o: Partial<InputCmd> = {}) => { const evs = []; for (let i = 0; i < n; i++) evs.push(stepPlayer(p, cmd(o), open)); return evs; };

describe('combo, buffering and cancels', () => {
  it('taps chain slash, slash, finisher; the finisher lunges further and recovers longer', () => {
    const p = newPlayerSim(0, 0);
    const hits: number[] = [];
    const xs: number[] = [];
    for (let i = 0; i < 30; i++) {
      const x0 = p.x;
      const ev = stepPlayer(p, cmd({ attack: i % 2 === 0, aimX: 1 }), open);
      if (ev.attacked) { hits.push(ev.combo); xs.push(p.x - x0); }
    }
    expect(hits.slice(0, 4)).toEqual([0, 1, 2, 0]);
    expect(xs[2]).toBeGreaterThan(xs[0]! * 2);
    expect(COMBO[2]!.recovery).toBeGreaterThan(COMBO[0]!.recovery);
    expect(COMBO[2]!.weight).toBe(1);
  });

  it('buffers a press made during recovery and fires it the moment recovery ends', () => {
    const p = newPlayerSim(0, 0);
    expect(stepPlayer(p, cmd({ attack: true, aimX: 1 }), open).attacked).toBe(true);
    // press once, 2 steps into the 0.26 s recovery
    run(p, 1);
    stepPlayer(p, cmd({ attack: true }), open);
    let fired = -1;
    for (let i = 0; i < 10; i++) if (stepPlayer(p, cmd(), open).attacked) { fired = i; break; }
    expect(fired).toBeGreaterThanOrEqual(0);
    expect(fired).toBeLessThanOrEqual(4);
  });

  it('a buffered press expires', () => {
    const p = newPlayerSim(0, 0);
    p.atkCd = 1;
    stepPlayer(p, cmd({ attack: true }), open);
    expect(run(p, 30).some((e) => e.attacked)).toBe(false);
  });

  it('dash cancels swing recovery and keeps the combo going', () => {
    const p = newPlayerSim(0, 0);
    stepPlayer(p, cmd({ attack: true, aimX: 1 }), open);
    expect(p.atkCd).toBeGreaterThan(0);
    stepPlayer(p, cmd({ dash: true, dx: 1 }), open);
    expect(p.atkCd).toBe(0);
    // attack pressed mid-dash comes out as soon as the dash ends, as hit 2 of the combo
    stepPlayer(p, cmd({ attack: true }), open);
    let ev = null;
    for (let i = 0; i < 6 && !ev; i++) { const e = stepPlayer(p, cmd(), open); if (e.attacked) ev = e; }
    expect(ev?.combo).toBe(1);
  });
});

describe('charged heavy', () => {
  it('hold charges after the opening swing; release past CHARGE_MIN unleashes a heavy; earlier release does nothing', () => {
    const p = newPlayerSim(0, 0);
    stepPlayer(p, cmd({ attack: true, hold: true, aimX: 1 }), open);
    const evs = run(p, 6, { hold: true });
    expect(evs.some((e) => e.attacked)).toBe(false);
    expect(stepPlayer(p, cmd({ hold: false }), open).attacked).toBe(false); // released too early (< CHARGE_MIN)

    const q = newPlayerSim(0, 0);
    stepPlayer(q, cmd({ attack: true, hold: true, aimX: 1 }), open);
    const held = run(q, 26, { hold: true, aimX: 0, aimY: 1 });
    expect(held.filter((e) => e.chargeReady).length).toBe(1);
    expect(held.filter((e) => e.chargeFull).length).toBe(1);
    expect(q.charge).toBeGreaterThanOrEqual(CHARGE_FULL);
    const ev = stepPlayer(q, cmd({ hold: false, aimX: 0, aimY: 1 }), open);
    expect(ev.attacked && ev.heavy).toBe(true);
    expect(ev.level).toBe(1);
    expect(q.faceY).toBeCloseTo(1); // aimed while charging
    expect(q.charge).toBe(0);
  });

  it('charge level and heavy scaling', () => {
    expect(chargeLevel(CHARGE_MIN)).toBe(0);
    expect(chargeLevel(CHARGE_FULL)).toBe(1);
    expect(heavyHit(1).damage).toBeGreaterThan(heavyHit(0).damage);
    expect(heavyHit(0).weight).toBe(2);
    expect(heavyHit(1).weight).toBe(3);
    expect(heavyHit(0).damage).toBeGreaterThan(COMBO[2]!.damage);
  });

  it('holding slows movement; a dash cancels the charge', () => {
    const p = newPlayerSim(0, 0);
    p.charge = 0.5; p.hold = 1;
    stepPlayer(p, cmd({ hold: true, dx: 1 }), open);
    expect(p.x).toBeLessThan(4.5 * TICK_DT * 0.6);
    stepPlayer(p, cmd({ hold: true, dash: true, dx: 1 }), open);
    expect(p.charge).toBe(0);
  });

  it('legacy clients that send attack every step (no hold) still get the light combo, never a heavy', () => {
    const p = newPlayerSim(0, 0);
    const evs = run(p, 60, { attack: true, aimX: 1 });
    expect(evs.filter((e) => e.attacked).length).toBeGreaterThan(5);
    expect(evs.some((e) => e.heavy)).toBe(false);
  });
});

describe('dash charges and dodging', () => {
  it('two charges, then empty; they refill one at a time', () => {
    const p = newPlayerSim(0, 0);
    expect(stepPlayer(p, cmd({ dash: true, dx: 1 }), open).dashed).toBe(true);
    run(p, 4);
    expect(stepPlayer(p, cmd({ dash: true, dx: 1 }), open).dashed).toBe(true);
    run(p, 4);
    expect(p.dashN).toBe(0);
    expect(stepPlayer(p, cmd({ dash: true, dx: 1 }), open).dashed).toBe(false);
    run(p, Math.ceil(DASH_COOLDOWN / TICK_DT));
    expect(p.dashN).toBe(1);
    run(p, Math.ceil(DASH_COOLDOWN / TICK_DT));
    expect(p.dashN).toBe(DASH_CHARGES);
  });

  it('i-frames outlast the dash; the perfect window is the first PERFECT_WINDOW seconds', () => {
    const p = newPlayerSim(0, 0);
    stepPlayer(p, cmd({ dash: true, dx: 1 }), open);
    expect(hasIframes(p)).toBe(true);
    expect(isPerfectDodge(p)).toBe(true);
    const perfectSteps = run(p, 10).map(() => 0);
    void perfectSteps;
    const q = newPlayerSim(0, 0);
    stepPlayer(q, cmd({ dash: true, dx: 1 }), open);
    let perfect = 1, ifr = 1;
    for (let i = 0; i < 10; i++) { stepPlayer(q, cmd(), open); if (isPerfectDodge(q)) perfect++; if (hasIframes(q)) ifr++; }
    expect(perfect).toBe(Math.ceil(PERFECT_WINDOW / TICK_DT - 1e-9));
    expect(ifr).toBeGreaterThan(perfect);
    expect(ifr).toBeLessThanOrEqual(Math.ceil(IFRAME_TIME / TICK_DT));
  });

  it('a phase slip turns the next attack into a counter and is consumed', () => {
    const p = newPlayerSim(0, 0);
    p.slipT = 1;
    const ev = stepPlayer(p, cmd({ attack: true, aimX: 1 }), open);
    expect(ev.counter).toBe(true);
    expect(p.slipT).toBe(0);
    run(p, 10);
    expect(stepPlayer(p, cmd({ attack: true, aimX: 1 }), open).counter).toBe(false);
  });
});

describe('crit, poise, armour, slam', () => {
  it('counters always crit; random crits are melee-only and scale with luck', () => {
    expect(rollCrit(0.99, 0, true, false)).toBe(true);
    expect(rollCrit(0.01, 0, false, false)).toBe(false);
    expect(rollCrit(0.01, 0, false, true)).toBe(true);
    expect(critChance(3)).toBeGreaterThan(critChance(0));
  });

  it('crit, stagger vulnerability and armour multiply as specified', () => {
    const slime = ENEMY_DEFS.slime, brute = ENEMY_DEFS.brute;
    const light = { damage: 10, poise: 4, knockback: 2, weight: 0 };
    expect(resolveHit(slime, light, { crit: false, staggered: false }).damage).toBe(10);
    expect(resolveHit(slime, light, { crit: true, staggered: false }).damage).toBe(Math.round(10 * CRIT_MULT));
    expect(resolveHit(slime, light, { crit: false, staggered: true }).damage).toBe(Math.round(10 * VULNERABLE_MULT));
    const armoured = resolveHit(brute, light, { crit: false, staggered: false });
    expect(armoured.damage).toBe(Math.round(10 * ARMOR_LIGHT_MULT));
    expect(armoured.poise).toBe(0);
    expect(armoured.flinch).toBe(false);
    const fin = resolveHit(brute, { ...light, weight: 1, poise: 14 }, { crit: false, staggered: false });
    expect(fin.poise).toBe(14);
    expect(resolveHit(brute, light, { crit: false, staggered: true }).poise).toBe(4); // a staggered brute is open
    expect(resolveHit(slime, light, { crit: false, staggered: false, counter: true }).poise).toBe(6);
  });

  it('slam damage grows with impact speed', () => {
    expect(slamDamage(10)).toBeGreaterThan(slamDamage(5));
  });

  it('hit-stop and shake scale with hit weight; reduced motion removes shake', () => {
    expect(hitStopMs(3, false, false)).toBeGreaterThan(hitStopMs(1, false, false));
    expect(hitStopMs(1, false, false)).toBeGreaterThan(hitStopMs(0, false, false));
    expect(hitStopMs(0, true, false)).toBeGreaterThan(hitStopMs(0, false, false));
    expect(hitStopMs(3, true, true)).toBeLessThanOrEqual(170);
    expect(shakeFor(2, false, false)).toBeGreaterThan(shakeFor(0, false, false));
    expect(shakeFor(3, true, true)).toBe(0);
  });

  it('strike shapes: circles and charge lanes', () => {
    expect(shapeHits({ kind: 'circle', x: 0, y: 0, r: 1 }, { x: 1.2, y: 0, r: 0.3 })).toBe(true);
    expect(shapeHits({ kind: 'circle', x: 0, y: 0, r: 1 }, { x: 1.5, y: 0, r: 0.3 })).toBe(false);
    expect(shapeHits({ kind: 'lane', ax: 0, ay: 0, bx: 5, by: 0, w: 0.7 }, { x: 3, y: 0.8, r: 0.3 })).toBe(true);
    expect(shapeHits({ kind: 'lane', ax: 0, ay: 0, bx: 5, by: 0, w: 0.7 }, { x: 3, y: 1.5, r: 0.3 })).toBe(false);
  });

  it('the heavy cleave reaches further and wider than a slash', () => {
    const h = heavyHit(0);
    const side = { x: 0.2, y: 1.6, r: 0.4 };
    expect(inArc(0, 0, 1, 0, COMBO[0]!, side)).toBe(false);
    expect(inArc(0, 0, 1, 0, h, side)).toBe(true);
  });
});

describe('enemies and spawning', () => {
  it('kinds index the table and new meadow enemies have distinct roles', () => {
    ENEMY_BY_KIND.forEach((d, i) => expect(d.kind).toBe(i));
    expect(ENEMY_DEFS.wisp.ai).toBe('caster');
    expect(ENEMY_DEFS.brute.armor).toBe(true);
    expect(ENEMY_DEFS.mite.hp).toBeLessThan(ENEMY_DEFS.slime.hp / 3);
  });

  it('level 1 only meets slimes and hoppers by day; brutes appear from level 4', () => {
    expect(spawnTable(1, false).map((e) => e.kind).sort()).toEqual(['hopper', 'slime']);
    expect(spawnTable(4, false).some((e) => e.kind === 'brute')).toBe(true);
    expect(spawnTable(2, true).some((e) => e.kind === 'brute')).toBe(false);
    for (let r = 0; r < 1; r += 0.05) expect(spawnTable(10, true).map((e) => e.kind)).toContain(pickSpawn(10, true, r));
    expect(eliteChance(1, true)).toBe(0);
    expect(eliteChance(10, true)).toBeGreaterThan(eliteChance(3, false));
    expect(enemyScale(10).hp).toBeGreaterThan(enemyScale(1).hp);
    expect(enemyScale(1)).toEqual({ hp: 1, dmg: 1, xp: 1 });
  });
});

describe('ack carries the whole sim', () => {
  it('every PlayerSim field is in ACK_FIELDS and round-trips', () => {
    const sim = newPlayerSim(1, 2);
    expect([...ACK_FIELDS].sort()).toEqual(Object.keys(sim).sort());
    Object.assign(sim, { dashN: 1, ifrT: 0.2, hold: 1, charge: 0.55, atkBuf: 0.1, slipT: 0.9 });
    const back = decodeAck(encodeAck({ seq: 7, tick: 8, sim })).sim;
    expect(back.dashN).toBe(1);
    expect(back.hold).toBe(1);
    expect(back.charge).toBeCloseTo(0.55, 5);
    expect(back.slipT).toBeCloseTo(0.9, 5);
    expect(ACK_BYTES).toBe(8 + 4 * ACK_FIELDS.length);
  });

  it('replaying from float32-rounded state gives identical results (prediction exactness)', () => {
    const a = newPlayerSim(0.5, 0.5);
    const inputs: Partial<InputCmd>[] = [];
    for (let i = 0; i < 80; i++) inputs.push({ dx: Math.sin(i / 4), dy: Math.cos(i / 6), attack: i % 7 === 0, hold: i % 20 > 8, dash: i % 23 === 5, aimX: 1 });
    for (const c of inputs.slice(0, 40)) stepPlayer(a, cmd(c), open);
    const b = decodeAck(encodeAck({ seq: 0, tick: 0, sim: a })).sim;
    const evA: boolean[] = [], evB: boolean[] = [];
    for (const c of inputs.slice(40)) { evA.push(stepPlayer(a, cmd(c), open).attacked); evB.push(stepPlayer(b, cmd(c), open).attacked); }
    expect(evB).toEqual(evA);
    expect(b.x).toBeCloseTo(a.x, 3);
    expect(b.atkCd).toBe(a.atkCd);
    expect(b.dashN).toBe(a.dashN);
  });
});
