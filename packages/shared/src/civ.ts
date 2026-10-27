import { KINGDOMS, diplomacyAt, festivalOn, stanceOf, type KingdomStance } from './kingdoms';
import { REALM_IDS, REALM_SITES, type RealmId, type RealmSite } from './realms';

/**
 * Living kingdoms (master plan §16). Each of the six kingdoms carries a small state (prosperity, might, stability,
 * treasury, a building project, tensions toward its neighbours, wars, a royal decree, a court intrigue and a
 * chronicle), stepped once per world day by a pure model from the seed, the diplomatic calendar and a ledger of what
 * players did that day (trade, raids beaten or lost, caravans saved, quests done, festival cheer, intrigue choices).
 * It is a handful of numbers per kingdom, so it costs nothing to keep: nothing is simulated per tick, nothing per
 * NPC, and the client only receives the summary. See docs/LIVING_WORLD.md.
 */
export type ProjectKind = 'market' | 'walls' | 'granary' | 'temple' | 'harbor' | 'bridge' | 'academy';
export type DecreeId = 'free_market' | 'tithe' | 'levy' | 'feast' | 'war_rations' | 'amnesty';

export interface Ledger {
  /** coins changing hands at the kingdom's shops and caravans */
  trade: number;
  raidsWon: number;
  raidsLost: number;
  caravansSaved: number;
  caravansLost: number;
  questsDone: number;
  /** festival games played, tournament bouts fought */
  cheer: number;
}
export interface Intrigue {
  id: string;
  day: number;
  expires: number;
  title: string;
  text: string;
  choices: Array<{ id: 'a' | 'b'; label: string; outcome: string }>;
}
export interface KingdomCiv {
  prosperity: number;
  might: number;
  stability: number;
  treasury: number;
  project: { kind: ProjectKind; site: string; progress: number; started: number } | null;
  built: Array<{ kind: ProjectKind; site: string; day: number }>;
  tension: Partial<Record<RealmId, number>>;
  wars: Array<{ with: RealmId; since: number }>;
  decree: { id: DecreeId; since: number };
  intrigue: Intrigue | null;
  chronicle: Array<{ day: number; text: string }>;
  /** the current royal event, if any (births, coronations, jubilees, weddings, hunts, plague, harvests) */
  royal?: RoyalEvent | null;
  /** the reigning monarch when the crown has passed on (otherwise the kingdom's founding ruler reigns) */
  monarch?: string;
}
export type RoyalKind = 'birth' | 'coronation' | 'jubilee' | 'royal_wedding' | 'hunt' | 'plague' | 'bounty';
export interface RoyalEvent {
  kind: RoyalKind;
  day: number;
  /** the last day it lasts */
  until: number;
  title: string;
}
/** royal events the whole realm turns out to celebrate (crowds, bunting, fireworks, steadier hearts) */
export const ROYAL_CELEBRATIONS = new Set<RoyalKind>(['birth', 'coronation', 'jubilee', 'royal_wedding']);
/** Is a royal celebration under way in this kingdom on `day`? */
export const royalCelebration = (k: KingdomCiv | undefined, day: number): RoyalEvent | null =>
  k?.royal && ROYAL_CELEBRATIONS.has(k.royal.kind) && day >= k.royal.day && day <= k.royal.until ? k.royal : null;
/** Is the realm suffering under a plague, or enjoying a bumper harvest? */
const royalNow = (k: KingdomCiv, kind: RoyalKind) => k.royal?.kind === kind;
const HEIRS = [
  'Aldwin',
  'Seraphine',
  'Corvin',
  'Ilsabet',
  'Tamsin',
  'Oswyn',
  'Mireille',
  'Leofric',
  'Ysolde',
  'Caspian',
];
const rulerOf = (r: RealmId, k: KingdomCiv) => k.monarch ?? KINGDOMS[r].ruler.name;
export interface CivWorld {
  /** the last world day stepped */
  day: number;
  kingdoms: Record<RealmId, KingdomCiv>;
  ledger: Record<RealmId, Ledger>;
}

export const PROJECTS: Record<ProjectKind, { name: string; cost: number; days: number; desc: string }> = {
  market: { name: 'Market hall', cost: 380, days: 6, desc: 'More traders and better prices.' },
  walls: { name: 'Stone walls', cost: 600, days: 9, desc: 'A larger standing army and fewer losses to raids.' },
  granary: { name: 'Granary', cost: 320, days: 5, desc: 'Cheaper food and calmer winters.' },
  temple: { name: 'Temple', cost: 450, days: 7, desc: 'A steadier, happier people.' },
  harbor: { name: 'Harbour works', cost: 520, days: 8, desc: 'Sea trade fills the treasury.' },
  bridge: { name: 'Stone bridge', cost: 300, days: 5, desc: 'Caravans move faster and safer.' },
  academy: { name: 'Academy', cost: 700, days: 10, desc: 'Scholars, guildmasters and new crafts.' },
};
export const DECREES: Record<DecreeId, { name: string; text: string; price: number; stability: number }> = {
  free_market: {
    name: 'Free Market',
    text: 'Tolls are lifted: goods are a little cheaper.',
    price: 0.95,
    stability: 0,
  },
  tithe: {
    name: 'Royal Tithe',
    text: 'A new tax to fill the treasury: everything costs more.',
    price: 1.1,
    stability: -4,
  },
  levy: {
    name: 'Call to Arms',
    text: 'Every household sends a soldier; arms and armour are dear.',
    price: 1.05,
    stability: -2,
  },
  feast: { name: 'Royal Feast', text: 'The crown pays for feasts across the land.', price: 0.97, stability: 5 },
  war_rations: {
    name: 'War Rations',
    text: 'Food and medicine go to the front: they are scarce at market.',
    price: 1.15,
    stability: -3,
  },
  amnesty: { name: 'Royal Amnesty', text: 'Old grudges are pardoned to calm the realm.', price: 1, stability: 6 },
};
const STANCE_TENSION: Record<KingdomStance, number> = { allied: 5, friendly: 15, neutral: 30, rival: 50, hostile: 68 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const MAX_CATCHUP = 28;

function hashU(seed: number, ...k: number[]): number {
  let h = (seed ^ 0x2545f491) >>> 0;
  for (const v of k) {
    h = Math.imul(h ^ (v | 0), 0x9e3779b1) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const ri = (r: RealmId) => REALM_IDS.indexOf(r);
export const emptyLedger = (): Ledger => ({
  trade: 0,
  raidsWon: 0,
  raidsLost: 0,
  caravansSaved: 0,
  caravansLost: 0,
  questsDone: 0,
  cheer: 0,
});

/** The world as it stands before any day has passed. */
export function initCiv(seed: number, day = 0): CivWorld {
  const kingdoms = {} as Record<RealmId, KingdomCiv>;
  const ledger = {} as Record<RealmId, Ledger>;
  for (const r of REALM_IDS) {
    const tension: Partial<Record<RealmId, number>> = {};
    for (const o of REALM_IDS) if (o !== r) tension[o] = STANCE_TENSION[stanceOf(r, o) ?? 'neutral'];
    kingdoms[r] = {
      prosperity: Math.round(45 + hashU(seed, ri(r), 1) * 20),
      might: Math.round(40 + hashU(seed, ri(r), 2) * 25 + (r === 'khardum' || r === 'nethrakar' ? 10 : 0)),
      stability: Math.round(55 + hashU(seed, ri(r), 3) * 15),
      treasury: 300,
      project: null,
      built: [],
      tension,
      wars: [],
      decree: { id: 'free_market', since: day },
      intrigue: null,
      chronicle: [],
    };
    ledger[r] = emptyLedger();
  }
  return { day, kingdoms, ledger };
}

const built = (k: KingdomCiv, kind: ProjectKind) => k.built.filter((b) => b.kind === kind).length;
const note = (k: KingdomCiv, day: number, text: string) => {
  k.chronicle.unshift({ day, text });
  if (k.chronicle.length > 24) k.chronicle.length = 24;
};
/** A settlement's proper name (duplicated from caravans.ts to keep this module dependency-light). */
function siteTitle(s: RealmSite): string {
  const k = KINGDOMS[s.realm];
  if (s.kind === 'capital') return k.capital;
  const ring = s.ring as 'n' | 'e' | 's' | 'w';
  return s.kind === 'town'
    ? k.names.towns[ring]
    : s.kind === 'village'
      ? k.names.villages[ring]
      : k.names.seaward[ring];
}
export const civSiteName = siteTitle;

function chooseProject(seed: number, r: RealmId, k: KingdomCiv, day: number): ProjectKind {
  const atWar = k.wars.length > 0;
  const want: Array<[ProjectKind, number]> = [
    ['walls', (atWar ? 40 : 0) + (60 - k.might) - built(k, 'walls') * 25],
    ['market', 70 - k.prosperity - built(k, 'market') * 20],
    ['temple', 65 - k.stability - built(k, 'temple') * 20],
    ['granary', 20 - built(k, 'granary') * 25 + (atWar ? 10 : 0)],
    ['harbor', 25 - built(k, 'harbor') * 25 + (r === 'thalassara' ? 25 : 0)],
    ['bridge', 18 - built(k, 'bridge') * 20],
    ['academy', k.prosperity - 60 - built(k, 'academy') * 30],
  ];
  want.sort(
    (a, b) => b[1] + hashU(seed, ri(r), day, a[0].length) * 8 - (a[1] + hashU(seed, ri(r), day, b[0].length) * 8),
  );
  return want[0]![0];
}
function projectSite(seed: number, r: RealmId, kind: ProjectKind, day: number): RealmSite {
  const pool = REALM_SITES.filter(
    (s) =>
      s.realm === r &&
      (kind === 'harbor' ? s.kind === 'outpost' : kind === 'academy' ? s.kind === 'capital' : s.kind !== 'farm'),
  );
  return pool[Math.floor(hashU(seed, ri(r), day, 77) * pool.length) % pool.length]!;
}

const INTRIGUES: Array<(r: RealmId, rival: RealmId) => Omit<Intrigue, 'id' | 'day' | 'expires'>> = [
  (r) => {
    const k = KINGDOMS[r],
      c = k.court[0]!;
    return {
      title: 'Letters in the Treasury',
      text: `Sealed letters suggest ${c.name}, ${c.title}, has been skimming the royal treasury. They have come into your hands.`,
      choices: [
        {
          id: 'a',
          label: `Bring them to ${k.ruler.name}`,
          outcome: 'The court is purged; the treasury recovers and the realm steadies.',
        },
        {
          id: 'b',
          label: 'Return them quietly, for a fee',
          outcome: 'You are paid well. The rot spreads, and the people grow restless.',
        },
      ],
    };
  },
  (r, rival) => ({
    title: 'An Envoy in the Night',
    text: `An envoy of ${KINGDOMS[rival].name} offers ${KINGDOMS[r].name} a secret pact, and needs a go-between nobody will suspect.`,
    choices: [
      {
        id: 'a',
        label: 'Carry the pact',
        outcome: `Tension with ${KINGDOMS[rival].name} eases; hawks at court are furious.`,
      },
      {
        id: 'b',
        label: 'Expose the envoy',
        outcome: `The court thanks you; ${KINGDOMS[rival].name} is insulted and tension rises.`,
      },
    ],
  }),
  (r) => ({
    title: 'Bread and Banners',
    text: `Townsfolk of ${KINGDOMS[r].name} plan a march on the palace over the price of bread. Their speaker asks you to stand with them.`,
    choices: [
      {
        id: 'a',
        label: 'Speak for the people',
        outcome: 'The crown opens the granaries: calm returns, the treasury pays.',
      },
      {
        id: 'b',
        label: 'Warn the palace guard',
        outcome: 'The march is broken up. Order holds, for now, and resentment simmers.',
      },
    ],
  }),
  (r) => {
    const c = KINGDOMS[r].court[1] ?? KINGDOMS[r].court[0]!;
    return {
      title: 'The Succession Whisper',
      text: `${c.name} is gathering allies for a claim on the throne should ${KINGDOMS[r].ruler.name} fall ill.`,
      choices: [
        {
          id: 'a',
          label: `Warn ${KINGDOMS[r].ruler.name}`,
          outcome: 'The plot dies in its cradle. The ruler remembers your name.',
        },
        {
          id: 'b',
          label: `Lend ${c.name} your sword`,
          outcome: 'You are promised land and gold. The court splits into factions.',
        },
      ],
    };
  },
];

/** The effect of an intrigue choice: on the kingdom, on a rival, and on the player who chose. */
export function intrigueEffect(
  i: Intrigue,
  choice: 'a' | 'b',
): { stability: number; treasury: number; tension: number; rep: number; coins: number } {
  const t = INTRIGUE_TITLES.indexOf(i.title);
  const table: Array<Record<'a' | 'b', [number, number, number, number, number]>> = [
    { a: [12, 150, 0, 60, 60], b: [-12, -100, 0, -40, 260] },
    { a: [-4, 0, -18, 20, 120], b: [6, 0, 14, 50, 80] },
    { a: [14, -120, 0, 40, 30], b: [-6, 0, 0, 30, 90] },
    { a: [10, 0, 0, 80, 100], b: [-15, 0, 0, -60, 320] },
  ];
  const [stability, treasury, tension, rep, coins] = (table[t] ?? table[0]!)[choice];
  return { stability, treasury, tension, rep, coins };
}
const INTRIGUE_TITLES = [
  'Letters in the Treasury',
  'An Envoy in the Night',
  'Bread and Banners',
  'The Succession Whisper',
];

/** The rival an intrigue concerns (its highest tension neighbour). */
export function rivalOf(k: KingdomCiv): RealmId {
  let best: RealmId = REALM_IDS[0]!,
    bt = -1;
  for (const [o, t] of Object.entries(k.tension) as Array<[RealmId, number]>)
    if (t > bt) {
      bt = t;
      best = o;
    }
  return best;
}

/** Apply one player's intrigue choice (the first to choose decides). */
export function resolveIntrigue(
  w: CivWorld,
  realm: RealmId,
  choice: 'a' | 'b',
  day: number,
): ReturnType<typeof intrigueEffect> | null {
  const k = w.kingdoms[realm];
  if (!k?.intrigue) return null;
  const i = k.intrigue;
  const e = intrigueEffect(i, choice);
  const rival = rivalOf(k);
  k.stability = clamp(k.stability + e.stability, 0, 100);
  k.treasury = Math.max(0, k.treasury + e.treasury);
  if (e.tension) {
    k.tension[rival] = clamp((k.tension[rival] ?? 30) + e.tension, 0, 100);
    const o = w.kingdoms[rival];
    o.tension[realm] = clamp((o.tension[realm] ?? 30) + e.tension, 0, 100);
  }
  note(k, day, `${i.title}: ${i.choices.find((c) => c.id === choice)!.outcome}`);
  k.intrigue = null;
  return e;
}

/** The crown's own story: births, successions, jubilees, royal hunts, plague and bumper harvests. */
function royalDay(seed: number, r: RealmId, k: KingdomCiv, day: number): void {
  if (k.royal && day > k.royal.until) {
    if (k.royal.kind === 'plague') note(k, day, `The sickness in ${KINGDOMS[r].name} has passed.`);
    k.royal = null;
  }
  if (k.royal) return;
  const roll = hashU(seed, ri(r), day, 40);
  const name = KINGDOMS[r].name;
  const set = (kind: RoyalKind, days: number, title: string, text: string) => {
    k.royal = { kind, day, until: day + days - 1, title };
    note(k, day, text);
  };
  // a crown that has lost its people's trust passes to an heir
  if (k.stability < 22 && roll < 0.3) {
    const heir = HEIRS[Math.floor(hashU(seed, ri(r), day, 41) * HEIRS.length)]!;
    const old = rulerOf(r, k);
    k.monarch = `${heir} ${KINGDOMS[r].ruler.name.split(' ').slice(-1)[0]}`;
    k.stability = Math.max(k.stability, 50);
    k.decree = { id: 'amnesty', since: day };
    set(
      'coronation',
      2,
      `The coronation of ${k.monarch}`,
      `${old} gives up the crown. ${k.monarch} is crowned ruler of ${name}!`,
    );
  } else if ((day + ri(r) * 5) % 28 === 0 && k.prosperity > 68)
    set(
      'jubilee',
      1,
      `${rulerOf(r, k)}'s jubilee`,
      `${name} celebrates ${rulerOf(r, k)}'s jubilee: free ale in every square!`,
    );
  else if (k.stability > 50 && roll < 0.012)
    set('birth', 2, 'A royal birth', `An heir is born to the house of ${rulerOf(r, k)}! Bells ring across ${name}.`);
  else if (k.prosperity < 40 && roll > 0.993) {
    set('plague', 6, 'A sickness spreads', `A sickness spreads through ${name}. Healers are run off their feet.`);
    k.stability = clamp(k.stability - 6, 0, 100);
  } else if (Math.floor(day / 7) % 4 === 2 && built(k, 'granary') && roll > 0.96)
    set('bounty', 4, 'A bumper harvest', `A bumper harvest in ${name}: the granaries overflow and bread is cheap.`);
  else if (k.might > 60 && roll > 0.975 && roll <= 0.993) {
    k.might = Math.min(100, k.might + 2);
    set('hunt', 1, 'A royal hunt', `${rulerOf(r, k)} rides out on a great royal hunt with the knights of ${name}.`);
  }
}

function stepDay(seed: number, w: CivWorld, day: number): void {
  const dip = diplomacyAt(seed, day);
  for (const r of REALM_IDS) {
    const k = w.kingdoms[r],
      L = w.ledger[r];
    const wars = k.wars.length;
    const festival = festivalOn(r, day);
    // treasury: trade and prosperity in, the army and wars out
    const income = 40 + k.prosperity * 1.1 + L.trade * 0.05 + built(k, 'market') * 14 + built(k, 'harbor') * 18;
    const upkeep = k.might * 0.7 + wars * 25;
    k.treasury = Math.max(0, Math.round(k.treasury + income - upkeep));
    // prosperity follows trade, safe roads and peace
    const pTarget = clamp(
      50 +
        L.trade / 40 +
        L.caravansSaved * 3 -
        L.caravansLost * 4 -
        L.raidsLost * 8 +
        L.raidsWon * 2 -
        wars * 8 +
        built(k, 'market') * 4 +
        built(k, 'bridge') * 2 +
        (k.stability < 30 ? -10 : 0),
      5,
      95,
    );
    k.prosperity =
      Math.round(
        clamp(
          k.prosperity +
            (pTarget - k.prosperity) * 0.15 -
            (royalNow(k, 'plague') ? 1.5 : 0) +
            (royalNow(k, 'bounty') ? 0.8 : 0),
          0,
          100,
        ) * 10,
      ) / 10;
    // might: recruit while the treasury allows, bleed in wars and lost raids
    const cap = 60 + built(k, 'walls') * 10 + (k.decree.id === 'levy' ? 10 : 0);
    if (k.treasury > 280 && k.might < cap) {
      k.might = Math.min(cap, k.might + (k.decree.id === 'levy' ? 4 : 2));
      k.treasury -= 60;
    }
    k.might = Math.round(clamp(k.might - wars * 1.2 - L.raidsLost * 3 + L.raidsWon * 1, 5, 100) * 10) / 10;
    // a brimming treasury is spent on public works: roads mended, fountains, pensions
    if (k.treasury > 1600) {
      k.treasury -= 220;
      k.prosperity = Math.min(100, k.prosperity + 0.6);
    }
    // stability: festivals and good rule calm the realm, wars and empty coffers do not
    const sTarget = clamp(
      58 +
        (festival ? 14 : 0) +
        (royalCelebration(k, day) ? 10 : 0) -
        (royalNow(k, 'plague') ? 12 : 0) +
        built(k, 'temple') * 5 +
        built(k, 'granary') * 3 +
        L.questsDone * 2 +
        L.cheer * 1.5 -
        wars * 9 -
        (k.treasury < 60 ? 14 : 0) +
        DECREES[k.decree.id].stability * 2,
      5,
      95,
    );
    k.stability = Math.round(clamp(k.stability + (sTarget - k.stability) * 0.2, 0, 100) * 10) / 10;
    if (festival) note(k, day, `${festival.name} is celebrated across ${KINGDOMS[r].name}.`);
    // building projects
    if (!k.project) {
      const kind = chooseProject(seed, r, k, day);
      if (k.treasury >= PROJECTS[kind].cost + 120) {
        const site = projectSite(seed, r, kind, day);
        k.treasury -= PROJECTS[kind].cost;
        k.project = { kind, site: site.id, progress: 0, started: day };
        note(k, day, `Work begins on a ${PROJECTS[kind].name.toLowerCase()} at ${siteTitle(site)}.`);
      }
    } else {
      const p = k.project;
      p.progress = Math.min(
        1,
        p.progress + (1 / PROJECTS[p.kind].days) * (0.7 + k.prosperity / 160) * (wars ? 0.6 : 1),
      );
      if (p.progress >= 1) {
        k.built.push({ kind: p.kind, site: p.site, day });
        if (k.built.length > 30) k.built.shift();
        const site = REALM_SITES.find((s) => s.id === p.site);
        note(
          k,
          day,
          `The new ${PROJECTS[p.kind].name.toLowerCase()} at ${site ? siteTitle(site) : p.site} is finished.`,
        );
        k.project = null;
      }
    }
    // a new royal decree each week, or at once when war breaks out
    const weekly = (day + ri(r)) % 7 === 0;
    if (weekly || (wars && k.decree.id !== 'war_rations' && k.decree.id !== 'levy')) {
      const id: DecreeId = wars
        ? k.might < 45
          ? 'levy'
          : 'war_rations'
        : k.treasury < 150
          ? 'tithe'
          : k.stability < 45
            ? hashU(seed, ri(r), day, 5) < 0.5
              ? 'amnesty'
              : 'feast'
            : k.prosperity > 65
              ? 'feast'
              : 'free_market';
      if (id !== k.decree.id) {
        k.decree = { id, since: day };
        note(k, day, `${rulerOf(r, k)} decrees: ${DECREES[id].name}. ${DECREES[id].text}`);
      }
    }
    royalDay(seed, r, k, day);
    // court intrigue brews in restless times
    if (k.intrigue && day > k.intrigue.expires) {
      k.stability = clamp(k.stability - 8, 0, 100);
      note(k, day, `${k.intrigue.title}: nobody acted, and the whispers spread.`);
      k.intrigue = null;
    }
    if (!k.intrigue && k.stability < 62 && hashU(seed, ri(r), day, 11) < 0.22) {
      const make = INTRIGUES[Math.floor(hashU(seed, ri(r), day, 12) * INTRIGUES.length)]!;
      k.intrigue = { id: `${r}:${day}`, day, expires: day + 5, ...make(r, rivalOf(k)) };
    }
  }
  // tensions, wars and peace between pairs
  dip.forEach((d) => {
    const a = w.kingdoms[d.a],
      b = w.kingdoms[d.b];
    const base = STANCE_TENSION[d.stance];
    let t = a.tension[d.b] ?? base;
    t += (base - t) * 0.05;
    if (d.event === 'border_skirmish') t += 4;
    else if (d.event === 'embargo') t += 2;
    else if (d.event === 'trade_pact' || d.event === 'royal_wedding') t -= 3;
    if (d.event === 'royal_wedding' && !a.royal && !b.royal) {
      const title = `A royal wedding joins the houses of ${KINGDOMS[d.a].name} and ${KINGDOMS[d.b].name}`;
      a.royal = { kind: 'royal_wedding', day, until: day + 2, title };
      b.royal = { kind: 'royal_wedding', day, until: day + 2, title };
      note(a, day, `${title}! Three days of feasting begin.`);
      note(b, day, `${title}! Three days of feasting begin.`);
    } else if (d.event === 'ceasefire') t -= 5;
    t += (w.ledger[d.a].raidsLost + w.ledger[d.b].raidsLost) * 1.5;
    t = clamp(t, 0, 100);
    a.tension[d.b] = b.tension[d.a] = Math.round(t * 10) / 10;
    const atWar = a.wars.some((x) => x.with === d.b);
    if (!atWar && t > 78 && d.stance !== 'allied' && hashU(seed, day, ri(d.a), ri(d.b)) < 0.35) {
      const [att, def] = a.might >= b.might ? [d.a, d.b] : [d.b, d.a];
      a.wars.push({ with: d.b, since: day });
      b.wars.push({ with: d.a, since: day });
      const text = `${KINGDOMS[att].name} declares war on ${KINGDOMS[def].name}!`;
      note(a, day, text);
      note(b, day, text);
    } else if (atWar) {
      const since = a.wars.find((x) => x.with === d.b)!.since;
      const weary = a.stability < 32 || b.stability < 32 || a.might < 22 || b.might < 22;
      if (day - since >= 8 && (weary || t < 48 || d.event === 'ceasefire')) {
        a.wars = a.wars.filter((x) => x.with !== d.b);
        b.wars = b.wars.filter((x) => x.with !== d.a);
        a.tension[d.b] = b.tension[d.a] = Math.min(t, 55);
        const text = `${KINGDOMS[d.a].name} and ${KINGDOMS[d.b].name} sign a peace after ${day - since} days of war.`;
        note(a, day, text);
        note(b, day, text);
      }
    }
  });
  for (const r of REALM_IDS) w.ledger[r] = emptyLedger();
}

/** Bring the world up to `day` (at most a month of catch-up; a long-idle world fast-forwards). */
export function stepCiv(seed: number, w: CivWorld, day: number): boolean {
  if (day <= w.day) return false;
  const from = Math.max(w.day + 1, day - MAX_CATCHUP + 1);
  for (let d = from; d <= day; d++) stepDay(seed, w, d);
  w.day = day;
  return true;
}

/** Dynamic war raids: kingdoms at war send parties against each other most days (on top of the calendar's raids). */
export function warRaidSites(
  seed: number,
  w: CivWorld,
  day: number,
): Array<{ attacker: RealmId; defender: RealmId; siteId: string; scale: 2 | 3; hour: number }> {
  const out: Array<{ attacker: RealmId; defender: RealmId; siteId: string; scale: 2 | 3; hour: number }> = [];
  for (const a of REALM_IDS)
    for (const war of w.kingdoms[a].wars) {
      if (ri(a) > ri(war.with)) continue; // each pair once
      if (hashU(seed, day, ri(a), ri(war.with), 31) > 0.6) continue;
      const ka = w.kingdoms[a],
        kb = w.kingdoms[war.with];
      const flip = hashU(seed, day, ri(a), 32) < ka.might / (ka.might + kb.might);
      const attacker = flip ? a : war.with,
        defender = flip ? war.with : a;
      const targets = REALM_SITES.filter((s) => s.realm === defender && s.kind !== 'capital' && s.kind !== 'farm');
      const site = targets[Math.floor(hashU(seed, day, ri(a), 33) * targets.length) % targets.length]!;
      const scale: 2 | 3 = w.kingdoms[attacker].might > w.kingdoms[defender].might * 1.3 ? 3 : 2;
      out.push({ attacker, defender, siteId: site.id, scale, hour: 9 + Math.floor(hashU(seed, day, ri(a), 34) * 9) });
    }
  return out;
}

/** Price multiplier for goods in a kingdom today (decree, war, prosperity, granaries). */
export function civPriceFactor(k: KingdomCiv | undefined, food = false): number {
  if (!k) return 1;
  let f = DECREES[k.decree.id].price;
  f *= 1 + (50 - k.prosperity) / 400; // prosperous realms are a little cheaper
  if (k.wars.length) f *= food ? 1.12 : 1.06;
  if (food) f *= 1 - Math.min(2, built(k, 'granary')) * 0.05;
  if (royalNow(k, 'plague')) f *= food ? 1.15 : 1.08;
  if (royalNow(k, 'bounty') && food) f *= 0.85;
  return Math.round(f * 1000) / 1000;
}

export const MSG_CIV = {
  /** server -> client: CivSummary (on join and whenever a day turns or an intrigue is decided) */
  STATE: 'civ_state',
  /** client -> server: { realm, choice } decide a kingdom's open intrigue */
  CHOOSE: 'civ_choose',
} as const;

/** What clients receive: everything but the ledger. */
export type CivSummary = { day: number; kingdoms: Record<RealmId, KingdomCiv> };
export const civSummary = (w: CivWorld): CivSummary => ({ day: w.day, kingdoms: w.kingdoms });

/** Validate a stored world (blobs survive across versions): anything malformed starts afresh. */
export function validCiv(seed: number, raw: unknown, day: number): CivWorld {
  const w = raw as CivWorld | null;
  if (!w || typeof w !== 'object' || typeof w.day !== 'number' || !w.kingdoms || !w.ledger) return initCiv(seed, day);
  for (const r of REALM_IDS) if (!w.kingdoms[r] || !w.ledger[r]) return initCiv(seed, day);
  for (const r of REALM_IDS) {
    const k = w.kingdoms[r];
    const e = k.royal;
    if (
      e &&
      (typeof e !== 'object' || typeof e.day !== 'number' || typeof e.until !== 'number' || typeof e.title !== 'string')
    )
      k.royal = null;
    if (k.monarch !== undefined && (typeof k.monarch !== 'string' || k.monarch.length > 60)) delete k.monarch;
  }
  return w;
}
