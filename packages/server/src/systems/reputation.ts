import { KINGDOMS, REP_MAX, REP_MIN, realmRankName, repSpill, repTier, type RealmId } from '@eigenlands/shared';
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
