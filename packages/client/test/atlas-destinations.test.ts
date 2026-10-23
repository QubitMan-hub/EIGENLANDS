import { expect, it } from 'vitest';
import { NPC_BY_ID, townFor, type PartyMember } from '@eigenlands/shared';
import { partyDestinations, questDestinations } from '../src/features/atlas/destinations';
const active = { state: 'active' as const, progress: [] };
const seen = () => true;
it('uses live discovered villagers and labels known homes as fallbacks', () => {
  const town = townFor(1337), home = town.spots[NPC_BY_ID.odo!.home]!;
  const live = new Map([['odo', { x: home.x + 1, y: home.y }]]);
  const routes = questDestinations(1337, { welcome: active }, () => 0, live, seen);
  expect(routes).toHaveLength(3); expect(routes[0]?.point).toEqual(live.get('odo'));
  expect(routes[0]?.detail).toContain('Current');
  const fallback = questDestinations(1337, { welcome: active }, () => 0, live, (x, y) => x === home.x && y === home.y);
  expect(fallback[0]?.point).toEqual(home); expect(fallback[0]?.detail).toContain('may be elsewhere');
  expect(fallback[1]?.point).toBeUndefined();
});
it('hides completed objectives and switches to hand-in using actual inventory', () => {
  expect(questDestinations(1, { welcome: { ...active, progress: [1, 0, 1] } }, () => 0, new Map(), seen)).toHaveLength(1);
  const routes = questDestinations(1, { timber: active }, () => 12, new Map(), seen);
  expect(routes[0]?.id).toBe('timber:return'); expect(routes[0]?.point).toBeDefined();
  const incomplete = questDestinations(1, { timber: { ...active, progress: [12] } }, () => 0, new Map(), seen);
  expect(incomplete[0]?.point).toBeUndefined(); expect(incomplete[0]?.title).toContain('Continue in Journal');
});
it('never exposes uncharted quest positions or invents resource locations', () => {
  const routes = questDestinations(1, { welcome: active, timber: active, qubitman: active }, () => 0, new Map(), () => false);
  expect(routes).toHaveLength(5); expect(routes.every(r => !r.point)).toBe(true);
  expect(questDestinations(1, { welcome: { state: 'done', progress: [] }, unknown: active }, () => 0, new Map(), seen)).toEqual([]);
});
it('resolves discovered read objectives and their return destinations', () => {
  expect(questDestinations(1, { qubitman: active }, () => 0, new Map(), seen)[0]?.detail).toBe('Discovered landmark');
  expect(questDestinations(1, { qubitman: { ...active, progress: [1] } }, () => 0, new Map(), seen)[0]?.id).toBe('qubitman:return');
});
const member = { accountId: 'friend', name: 'Friend', level: 2, cls: 'wanderer', hp: 10, maxHp: 20, x: 400, y: -80000, shard: 'remote', online: true, sid: '' } satisfies PartyMember;
it('uses only authorized party frames, excludes self and clears on leave', () => {
  const party = { id: 'party', members: [member, { ...member, accountId: 'me', sid: 'self' }] };
  expect(partyDestinations(party, 'me', 'self')).toHaveLength(1);
  expect(partyDestinations(party, 'me', 'self')[0]?.point).toEqual({ x: 400, y: -80000 });
  expect(partyDestinations({ ...party, id: null }, 'me', 'self')).toEqual([]);
});
it('never offers offline or invalid party coordinates', () => {
  for (const change of [{ online: false }, { x: NaN }, { y: Infinity }, { shard: '' }])
    expect(partyDestinations({ id: 'p', members: [{ ...member, ...change }] }, 'me', 'self')[0]?.point).toBeUndefined();
});
