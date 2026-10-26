import { diplomacyAt, KINGDOMS, relationsOf, type KingdomStance } from './kingdoms';
import { REALM_IDS, REALM_SITES, type RealmId, type RealmSite } from './realms';
import { DAYS_PER_SEASON } from './constants';
import { ARMY_CLASSES, type ArmyClass } from './army';

/**
 * Wars and invasions (world revision 5). Border raids are scheduled deterministically from the seed and the day, using
 * the seasonal diplomacy calendar: rivals skirmish, hostile realms raid often and, in a bad season, march on a town or
 * capital in force. Only raids near players are simulated (see server features/armies); the schedule also feeds the
 * Journal, rumours and the state of settlements, so a world feels at war even when nobody is watching.
 */
export interface RaidPlan {
  id: string;
  day: number;
  /** game hour the raiders arrive */
  hour: number;
  attacker: RealmId;
  defender: RealmId;
  siteId: string;
  /** 1 skirmish, 2 raid, 3 invasion */
  scale: 1 | 2 | 3;
  /** raiding party: number of units per class, in ARMY_CLASSES order */
  party: [number, number, number, number];
  /** attacker's mythical beast joins the assault */
  beast: boolean;
}

function unit(seed: number, ...k: number[]): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const v of k) {
    h = Math.imul(h ^ (v | 0), 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const WAR_PRESSURE: Record<KingdomStance, number> = { allied: 0, friendly: 0, neutral: 0.02, rival: 0.1, hostile: 0.3 };

/** Raids scheduled for a day. Pure and deterministic; callers pick the ones near players. */
export function raidsOn(seed: number, day: number): RaidPlan[] {
  const out: RaidPlan[] = [];
  const dip = diplomacyAt(seed, day);
  dip.forEach((d, i) => {
    let p = WAR_PRESSURE[d.stance];
    if (d.event === 'border_skirmish') p += 0.25;
    else if (d.event === 'embargo') p += 0.08;
    else if (d.event === 'trade_pact' || d.event === 'royal_wedding') p = 0;
    else if (d.event === 'ceasefire') p *= 0.2;
    if (p <= 0 || unit(seed, day, i, 1) >= p) return;
    const flip = unit(seed, day, i, 2) < 0.5;
    const attacker = flip ? d.a : d.b,
      defender = flip ? d.b : d.a;
    const scale: 1 | 2 | 3 =
      d.stance === 'hostile' && d.event === 'border_skirmish' && unit(seed, day, i, 3) < 0.35
        ? 3
        : unit(seed, day, i, 4) < 0.45
          ? 2
          : 1;
    const targets: RealmSite[] = REALM_SITES.filter(
      (s) =>
        s.realm === defender &&
        (scale === 3
          ? s.kind === 'capital' || s.kind === 'town'
          : s.kind === 'outpost' || s.kind === 'town' || s.kind === 'village'),
    );
    const site = targets[Math.floor(unit(seed, day, i, 5) * targets.length) % targets.length]!;
    const n = scale === 1 ? 4 : scale === 2 ? 7 : 12;
    const party: [number, number, number, number] = [
      Math.ceil(n * 0.45),
      Math.floor(n * 0.25),
      scale === 1 ? 0 : Math.floor(n * 0.2),
      scale === 3 ? 2 : scale === 2 ? 1 : 0,
    ];
    out.push({
      id: `raid:${day}:${attacker}:${site.id}`,
      day,
      hour: 8 + Math.floor(unit(seed, day, i, 6) * 12),
      attacker,
      defender,
      siteId: site.id,
      scale,
      party,
      beast: scale >= 2,
    });
  });
  return out;
}

/** Pairs currently at war this season (hostile realms in a skirmish season) for the Journal and rumours. */
export function warsAt(
  seed: number,
  day: number,
): Array<{ a: RealmId; b: RealmId; stance: KingdomStance; rumor: string }> {
  return diplomacyAt(seed, day)
    .filter((d) => d.stance === 'hostile' || d.event === 'border_skirmish')
    .map((d) => ({ a: d.a, b: d.b, stance: d.stance, rumor: d.rumor }));
}

/** How prosperous a settlement is today: trade pacts and calm raise it, raids and embargoes lower it (0..3). */
export function prosperity(seed: number, siteId: string, day: number): { tier: 0 | 1 | 2 | 3; recentRaid: boolean } {
  const site = REALM_SITES.find((s) => s.id === siteId);
  if (!site) return { tier: 1, recentRaid: false };
  let score = site.kind === 'capital' ? 2.2 : site.kind === 'town' ? 1.6 : 1.1;
  let recentRaid = false;
  for (let d = Math.max(0, day - 14); d <= day; d++)
    for (const r of raidsOn(seed, d))
      if (r.siteId === siteId) {
        score -= d >= day - 3 ? 0.9 : 0.35;
        if (d >= day - 3) recentRaid = true;
      }
  for (const rel of relationsOf(site.realm)) {
    if (rel.stance === 'allied') score += 0.25;
    else if (rel.stance === 'hostile') score -= 0.2;
  }
  const season = Math.floor(day / DAYS_PER_SEASON);
  score += (unit(seed, season, REALM_IDS.indexOf(site.realm), 9) - 0.5) * 0.8;
  return { tier: Math.max(0, Math.min(3, Math.floor(score))) as 0 | 1 | 2 | 3, recentRaid };
}

/** Standing garrison of a settlement plot: units per class in ARMY_CLASSES order. */
export function garrisonOf(site: RealmSite): [number, number, number, number] {
  switch (site.kind) {
    case 'capital':
      return [4, 3, 2, 2];
    case 'town':
      return [3, 2, 1, 0];
    case 'outpost':
      return [3, 2, 0, 1];
    case 'village':
      return [2, 1, 0, 0];
    default:
      return [1, 0, 0, 0];
  }
}
export const raidClasses: readonly ArmyClass[] = ARMY_CLASSES;
export const raidHeadline = (r: RaidPlan, siteName: string): string =>
  `${KINGDOMS[r.attacker].name} ${r.scale === 3 ? 'invades' : r.scale === 2 ? 'raids' : 'skirmishes at'} ${siteName} (${KINGDOMS[r.defender].name})`;
