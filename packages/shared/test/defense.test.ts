import { expect, it } from 'vitest';
import { blockedShare, defend, newPlayerSim, stepPlayer, sanitizeCmd, encodeAck, decodeAck } from '../src';
const cmd = (x = {}) => sanitizeCmd({ seq: 1, aimX: 1, ...x });
const open = () => false;
const ready = () => {
  const p = newPlayerSim(0, 0);
  stepPlayer(p, cmd({ guard: true }), open);
  return p;
};
/** guard held, then let go: the release opens the parry window */
const released = () => {
  const p = ready();
  stepPlayer(p, cmd(), open);
  return p;
};
it('holding guard blocks; letting it go parries a frontal strike and awards one short riposte window', () => {
  const held = ready();
  expect(held.parryT).toBe(0);
  expect(defend(held, 1, -1, 0)).toBe('block');
  const p = released();
  expect(p.guard).toBe(0);
  expect(p.parryT).toBeGreaterThan(0);
  expect(defend(p, 1, -1, 0)).toBe('parry');
  expect(p.slipT).toBe(0.9);
  expect(p.parryT).toBe(0);
  // the window is spent and guard is down: the next blow lands
  expect(defend(p, 1, -1, 0)).toBe('hit');
});
it('late guard blocks; rear and crushing strikes bypass it', () => {
  const p = ready();
  p.parryT = 0;
  expect(defend(p, 1, 1, 0)).toBe('hit');
  expect(defend(p, 3, -1, 0)).toBe('hit');
  expect(defend(p, 1, -1, 0)).toBe('block');
});
it('guard break spends the remaining stamina and locks out immediate guard spam', () => {
  const p = ready();
  p.stamina = 2;
  expect(defend(p, 1, -1, 0)).toBe('break');
  stepPlayer(p, cmd({ guard: true }), open);
  expect(p.guard).toBe(-1);
  expect(p.atkCd).toBeGreaterThan(0);
});
it('repeated guard taps cannot renew the parry window before cooldown', () => {
  const p = released();
  stepPlayer(p, cmd({ guard: true }), open);
  expect(p.guard).toBe(1);
  expect(p.parryT).toBe(0);
  stepPlayer(p, cmd(), open);
  expect(p.parryT).toBe(0);
});
it('a shield widens the guard, lengthens the parry, softens blocks and holds a crushing blow', () => {
  const bare = released(),
    shielded = newPlayerSim(0, 0);
  shielded.shield = 1;
  stepPlayer(shielded, cmd({ guard: true }), open);
  stepPlayer(shielded, cmd(), open);
  expect(shielded.parryT).toBeGreaterThan(bare.parryT);
  const guardWith = (s: number) => {
    const p = ready();
    p.shield = s;
    return p;
  };
  // a blow from about 80° off the facing: a bare guard misses it, a shield takes it
  const side = [-Math.cos((80 * Math.PI) / 180), Math.sin((80 * Math.PI) / 180)] as const;
  expect(defend(guardWith(0), 1, side[0], side[1])).toBe('hit');
  expect(defend(guardWith(1), 1, side[0], side[1])).toBe('block');
  expect(defend(guardWith(0), 3, -1, 0)).toBe('hit');
  expect(defend(guardWith(1), 3, -1, 0)).toBe('block');
  const a = guardWith(0),
    b = guardWith(1);
  defend(a, 1, -1, 0);
  defend(b, 1, -1, 0);
  expect(b.stamina).toBeGreaterThan(a.stamina);
  expect(blockedShare(b)).toBeLessThan(blockedShare(a));
});
it('guard cancels charging without releasing damage and dodge overrides guard', () => {
  const p = ready();
  p.charge = 1;
  p.hold = 1;
  expect(stepPlayer(p, cmd({ guard: true, attack: true }), open).attacked).toBe(false);
  expect(p.charge).toBe(0);
  expect(stepPlayer(p, cmd({ guard: true, dash: true }), open).dashed).toBe(true);
  expect(p.guard).toBe(0);
});
it('guard drains stamina, slows movement and cannot be used from boats or carts', () => {
  const p = ready(),
    before = p.stamina;
  stepPlayer(p, cmd({ guard: true, dx: 1, sprint: true }), open);
  expect(p.stamina).toBeLessThan(before);
  expect(p.sprint).toBe(0);
  const q = newPlayerSim(0, 0);
  q.cart = 1;
  stepPlayer(q, cmd({ guard: true }), open);
  expect(q.guard).toBe(0);
});
it('defence state survives the authoritative binary acknowledgement', () => {
  const p = ready();
  const back = decodeAck(encodeAck({ sim: p, seq: 1, tick: 2 }));
  expect(back.sim.guard).toBe(1);
  expect(back.sim.parryT).toBeCloseTo(p.parryT);
  expect(back.sim.guardCd).toBeCloseTo(p.guardCd);
});
it('the next deliberate attack consumes the parry riposte', () => {
  const p = released();
  defend(p, 1, -1, 0);
  const ev = stepPlayer(p, cmd({ attack: true }), open);
  expect(ev.attacked).toBe(true);
  expect(ev.counter).toBe(true);
  expect(p.slipT).toBe(0);
});
it('ranged shots do not consume a melee riposte without receiving its critical benefit', () => {
  const p = released();
  defend(p, 1, -1, 0);
  p.ranged = true;
  const ev = stepPlayer(p, cmd({ attack: true }), open);
  expect(ev.counter).toBe(false);
  expect(p.slipT).toBeGreaterThan(0);
});
