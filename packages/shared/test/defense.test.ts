import { expect, it } from 'vitest';
import { defend, newPlayerSim, stepPlayer, sanitizeCmd, encodeAck, decodeAck } from '../src';
const cmd = (x = {}) => sanitizeCmd({ seq: 1, aimX: 1, ...x });
const open = () => false;
const ready = () => {
  const p = newPlayerSim(0, 0);
  stepPlayer(p, cmd({ guard: true }), open);
  return p;
};
it('a fresh guard parries a frontal strike and awards one short riposte window', () => {
  const p = ready();
  expect(defend(p, 1, -1, 0)).toBe('parry');
  expect(p.slipT).toBe(0.9);
  expect(p.parryT).toBe(0);
  expect(defend(p, 1, -1, 0)).toBe('block');
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
  const p = ready();
  stepPlayer(p, cmd(), open);
  stepPlayer(p, cmd({ guard: true }), open);
  expect(p.guard).toBe(1);
  expect(p.parryT).toBe(0);
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
  const p = ready();
  defend(p, 1, -1, 0);
  const ev = stepPlayer(p, cmd({ attack: true }), open);
  expect(ev.attacked).toBe(true);
  expect(ev.counter).toBe(true);
  expect(p.slipT).toBe(0);
});
it('ranged shots do not consume a melee riposte without receiving its critical benefit', () => {
  const p = ready();
  defend(p, 1, -1, 0);
  p.ranged = true;
  const ev = stepPlayer(p, cmd({ attack: true }), open);
  expect(ev.counter).toBe(false);
  expect(p.slipT).toBeGreaterThan(0);
});
