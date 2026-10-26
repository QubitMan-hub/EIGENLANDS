/**
 * Festivals and royal tournaments (master plan §16). Each kingdom already keeps two festivals a year (kingdoms.ts);
 * Hadamere and the home continent keep four seasonal ones here. On a festival day anyone in the host's land may
 * bring a dish to the feast once; the festival dish itself is honoured best. Every few days, and on every festival,
 * each capital holds a tournament in its lists: three bouts against the kingdom's own soldiers, a champion's purse
 * and title for the winner. Everything is a pure function of the world day.
 */
import { DAYS_PER_SEASON } from './constants';
import { KINGDOMS, festivalOn, type Festival } from './kingdoms';
import { REALM_IDS, type RealmId } from './realms';
import type { ArmyClass } from './army';

export type FestHost = RealmId | 'home';

/** The home continent's year: a festival each season, all held in Hadamere and the home towns. */
export const HOME_FESTIVALS: Festival[] = [
  {
    id: 'blossom_fair',
    name: 'Blossom Fair',
    season: 0,
    day: 4,
    desc: 'Orchard blossom and ribbon dances on the green; the first fruit pies of the year.',
    feast: 'fruit_pie',
  },
  {
    id: 'lantern_night',
    name: 'Midsummer Lantern Night',
    season: 1,
    day: 4,
    desc: 'Paper lanterns float down the river and fried fish is eaten on the banks until dawn.',
    feast: 'fish_fry',
  },
  {
    id: 'harvest_home',
    name: 'Harvest Home',
    season: 2,
    day: 5,
    desc: 'The last sheaf is carried in, pumpkins are judged and everyone shares the harvest soup.',
    feast: 'pumpkin_soup',
  },
  {
    id: 'winterfire',
    name: 'Winterfire',
    season: 3,
    day: 6,
    desc: 'A great bonfire on the longest night, stew for all and gifts for the children.',
    feast: 'hearty_stew',
  },
];

/** The festival a host keeps today, if any. */
export function festivalToday(host: FestHost, day: number): Festival | null {
  if (host !== 'home') return festivalOn(host, day);
  const season = Math.floor(day / DAYS_PER_SEASON) % 4,
    d = (day % DAYS_PER_SEASON) + 1;
  return HOME_FESTIVALS.find((f) => f.season === season && f.day === d) ?? null;
}

/** The host's next festival at or after `day` and how many days away it is. */
export function nextFestivalOf(host: FestHost, day: number): { festival: Festival; in: number } {
  const list = host === 'home' ? HOME_FESTIVALS : KINGDOMS[host].festivals;
  const year = DAYS_PER_SEASON * 4;
  let best: { festival: Festival; in: number } | null = null;
  for (const f of list) {
    const wait = (f.season * DAYS_PER_SEASON + f.day - 1 - (day % year) + year) % year;
    if (!best || wait < best.in) best = { festival: f, in: wait };
  }
  return best!;
}

/** Feast reward: the festival's own dish counts double. */
export function feastReward(level: number, signature: boolean): { coins: number; xp: number; rep: number } {
  const k = signature ? 1 : 0.5;
  return { coins: Math.round((40 + level * 6) * k), xp: Math.round((60 + level * 10) * k), rep: signature ? 30 : 12 };
}

// ───────────────────────── tournaments ─────────────────────────

/** game hours the lists are open */
export const TOURNEY_HOURS: [number, number] = [12, 18];
/** the three bouts, in order: a foot soldier, a rider, then the kingdom's elite champion */
export const TOURNEY_BOUTS: readonly ArmyClass[] = ['infantry', 'cavalry', 'elite'];
/** seconds a bout may last before the herald calls it lost */
export const TOURNEY_BOUT_SECS = 90;

/** Whether a kingdom's capital holds a tournament today: every fifth day (staggered by kingdom) and on festivals. */
export function tourneyOn(realm: RealmId, day: number): boolean {
  return (day + REALM_IDS.indexOf(realm) * 2) % 5 === 0 || !!festivalOn(realm, day);
}
/** Days from `day` until the kingdom's next tournament (0 = today). */
export function nextTourney(realm: RealmId, day: number): number {
  for (let i = 0; i < 30; i++) if (tourneyOn(realm, day + i)) return i;
  return 30;
}

/** The champion's purse, by level; a festival tournament pays half again. */
export function tourneyPurse(level: number, festival: boolean): { coins: number; xp: number; rep: number } {
  const k = festival ? 1.5 : 1;
  return { coins: Math.round((150 + level * 20) * k), xp: Math.round((200 + level * 30) * k), rep: 60 };
}

/** The title a kingdom grants its tournament champions. */
export const CHAMPION_TITLE: Record<RealmId, string> = {
  aurelion: 'Golden Lance',
  sylvaris: 'Thornblade',
  khardum: 'Anvil Champion',
  raijin: 'Storm Duelist',
  thalassara: 'Tide Champion',
  nethrakar: 'Ember Victor',
};

export const MSG_FEST = {
  /** client -> server: { host: FestHost; act: 'feast' | 'tourney' } */
  JOIN: 'fest_join',
  /** server -> client: TourneyState (bout progress) */
  TOURNEY: 'fest_tourney',
} as const;

export interface TourneyState {
  realm: RealmId;
  /** 0-based bout now being fought; equal to the bout count once won */
  bout: number;
  /** seconds left in this bout */
  left: number;
  /** 'won' or 'lost' when it ends, else 'fighting' */
  status: 'fighting' | 'won' | 'lost';
}
