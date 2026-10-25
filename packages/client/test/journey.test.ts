import { expect, it } from 'vitest';
import { journeyMilestones, type JourneyInfo } from '../src/ui/journey';
const data: JourneyInfo = {
  level: 10,
  xp: 25,
  cls: 'wanderer',
  spec: null,
  second: null,
  qubits: 4,
  gates: 8,
  runes: 2,
  summons: {},
};
it('does not offer specialization to a wanderer even above its level gate', () => {
  expect(journeyMilestones(data)[1]?.[1]).toContain('Choose a class first');
  expect(journeyMilestones({ ...data, cls: 'superposer' })[1]?.[1]).toBe('Available on the Circuit Board.');
});
it('uses shared orb milestones and reports completed level milestones', () => {
  expect(journeyMilestones(data)[0]?.[1]).toContain('12');
  expect(journeyMilestones({ ...data, level: 33 })[0]?.[1]).toBe('All level-based orb milestones reached.');
  expect(journeyMilestones({ ...data, cls: 'superposer', level: 30 })[2]?.[1]).toBe('Available on the Circuit Board.');
});
