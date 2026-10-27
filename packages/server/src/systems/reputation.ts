import {
  KINGDOMS,
  RACES,
  REP_MAX,
  REP_MIN,
  raceRank,
  realmRankName,
  repSpill,
  repTier,
  type RaceId,
  type RealmId,
} from '@eigenlands/shared';
import type { PlayerRef } from './types';

/** Adds (or removes) standing with a kingdom; allies and rivals of the host shift a little too. */
export function gainRep(p: PlayerRef, realm: RealmId, amount: number, quiet = false): void {
  if (!amount) return;
  const rep = (p.data.rep ??= {});
  const before = rep[realm] ?? 0;
  const set = (r: RealmId, delta: number) => {
    rep[r] = Math.max(REP_MIN, Math.min(REP_MAX, (rep[r] ?? 0) + delta));
  };
  set(realm, amount);
  for (const s of repSpill(realm, amount)) set(s.realm, s.delta);
  p.dirty('rep');
  const now = rep[realm] ?? 0;
  if (!quiet && repTier(now) !== repTier(before))
    p.toast(
      `${KINGDOMS[realm].name}: you are now ${realmRankName(realm, now)}.`,
      repTier(now) > repTier(before) ? 'good' : 'bad',
    );
}

/** Adds standing with a realm people (realmfolk.ts), kept beside kingdom reputation. */
export function gainStanding(p: PlayerRef, race: RaceId, amount: number, quiet = false): void {
  if (!amount) return;
  const rep = (p.data.rep ??= {}) as Record<string, number | undefined>;
  const before = rep[race] ?? 0;
  const now = Math.max(REP_MIN, Math.min(REP_MAX, before + amount));
  rep[race] = now;
  p.dirty('rep');
  if (!quiet && repTier(now) !== repTier(before))
    p.toast(
      `${RACES[race].name.replace(/^the /, 'The ')}: you are now ${raceRank(race, now)}.`,
      repTier(now) > repTier(before) ? 'good' : 'bad',
    );
}
