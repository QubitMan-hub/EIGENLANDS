/**
 * NPC relationships (master plan §16): the folk of each settlement know each other. Every resident has two or three
 * ties to neighbours (old friends, rivals, sweethearts, kin, a mentor or an apprentice), worked out from the seedless
 * roster so they never change and cost nothing to keep. Residents talk about them, about where their neighbours are
 * at this hour, and pass on the kingdom's news.
 */
import { NPC_BY_ID, scheduleAt, type NpcDef } from './npcs';
import type { Weather } from './weather';

export type TieKind =
  | 'friend'
  | 'rival'
  | 'sweetheart'
  | 'kin'
  | 'mentor'
  | 'apprentice'
  // what ties grow into over the seasons (tiesOn)
  | 'betrothed'
  | 'spouse'
  | 'former'
  | 'reconciled';
export interface Tie {
  kind: TieKind;
  other: string;
}

/** What a resident does for a living, in a few words. */
const ROLE_WORK: Record<string, string> = {
  ruler: 'rules from the palace',
  court: 'serves at court',
  commander: 'commands the garrison',
  guard: 'keeps the watch',
  archer: 'stands guard on the walls',
  innkeeper: 'keeps the inn',
  smith: 'works the forge',
  merchant: 'keeps a shop',
  herbalist: 'grows and sells herbs',
  scholar: 'keeps the library',
  elder: 'speaks for the elders',
  farmer: 'farms the fields',
  hand: 'works the farm',
  soldier: 'serves as a soldier',
};
export function professionOf(def: NpcDef): string {
  if (def.role && ROLE_WORK[def.role]) return ROLE_WORK[def.role]!;
  if (def.shop) return `keeps ${def.shop.name}`;
  return 'lives here';
}

/** FNV-1a: a stable small hash of a string */
function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const placeOf = (d: NpcDef) => d.site ?? d.settlement ?? 'hadamere';

let groups: Map<string, NpcDef[]> | null = null;
function neighbours(def: NpcDef): NpcDef[] {
  if (!groups) {
    groups = new Map();
    for (const d of Object.values(NPC_BY_ID)) {
      const k = placeOf(d);
      const g = groups.get(k) ?? [];
      g.push(d);
      groups.set(k, g);
    }
    for (const g of groups.values()) g.sort((a, b) => (a.id < b.id ? -1 : 1));
  }
  return groups.get(placeOf(def)) ?? [];
}

const tieCache = new Map<string, Tie[]>();
/**
 * A resident's ties. Pairs are formed round a ring of the settlement's residents (each with the next one and with
 * the one three along), so every tie is mutual: if A counts B a rival, B counts A one too.
 */
export function tiesOf(npcId: string): Tie[] {
  const hit = tieCache.get(npcId);
  if (hit) return hit;
  const def = NPC_BY_ID[npcId];
  const g = def ? neighbours(def) : [];
  const out: Tie[] = [];
  const i = g.findIndex((d) => d.id === npcId);
  if (i >= 0 && g.length > 1) {
    const pair = (a: NpcDef, b: NpcDef, salt: number): TieKind => {
      const [x, y] = a.id < b.id ? [a, b] : [b, a];
      const h = strHash(`${x.id}|${y.id}|${salt}`) % 100;
      if (x.role === 'scholar' || x.role === 'smith' || x.role === 'herbalist')
        if (y.role === 'hand' || y.role === 'soldier' || y.role === 'merchant') return h < 50 ? 'mentor' : 'friend';
      return h < 38 ? 'friend' : h < 58 ? 'rival' : h < 74 ? 'kin' : h < 88 ? 'sweetheart' : 'friend';
    };
    const add = (j: number, salt: number) => {
      const o = g[((j % g.length) + g.length) % g.length]!;
      if (o.id === npcId || out.some((t) => t.other === o.id)) return;
      let kind = pair(def!, o, salt);
      // a mentor's pupil sees it the other way round
      if (kind === 'mentor' && !(def!.role === 'scholar' || def!.role === 'smith' || def!.role === 'herbalist'))
        kind = 'apprentice';
      out.push({ kind, other: o.id });
    };
    add(i + 1, 1);
    add(i - 1, 1);
    if (g.length > 4) {
      add(i + 3, 2);
      add(i - 3, 2);
    }
  }
  tieCache.set(npcId, out);
  return out;
}

/** days between the turns of a relationship's story */
export const TIE_ARC_DAYS = 18;
/** how each kind of tie can grow, one stage per TIE_ARC_DAYS (the last stage holds) */
const ARCS: Partial<Record<TieKind, TieKind[][]>> = {
  friend: [['friend'], ['friend', 'sweetheart', 'betrothed', 'spouse']],
  sweetheart: [
    ['sweetheart', 'betrothed', 'spouse'],
    ['sweetheart', 'sweetheart', 'former'],
  ],
  rival: [['rival'], ['rival', 'rival', 'reconciled', 'friend']],
  mentor: [['mentor', 'mentor', 'friend']],
  apprentice: [['apprentice', 'apprentice', 'friend']],
};

export interface TieNow extends Tie {
  /** the world day this stage began (0 = always so) */
  since: number;
}

/**
 * A resident's ties as they stand on world day `day`. Each pair's story is fixed by the pair itself (so both sides
 * always agree): some friends fall in love, sweethearts wed or part, rivals make their peace, pupils become peers.
 */
export function tiesOn(npcId: string, day: number): TieNow[] {
  return tiesOf(npcId).map((t) => {
    const [x, y] = npcId < t.other ? [npcId, t.other] : [t.other, npcId];
    const h = strHash(`${x}|${y}|arc`);
    // a mentor/apprentice pair shares one story told from either side
    const base: TieKind = t.kind === 'apprentice' ? 'mentor' : t.kind;
    const arcs = ARCS[base];
    if (!arcs) return { ...t, since: 0 };
    const arc = arcs[h % arcs.length]!;
    // the story's first turn comes on day `start`, and each later one TIE_ARC_DAYS after that
    const start = 6 + (h % 40);
    const stage = day < start ? 0 : Math.min(arc.length - 1, 1 + Math.floor((day - start) / TIE_ARC_DAYS));
    let kind = arc[stage]!;
    if (t.kind === 'apprentice' && kind === 'mentor') kind = 'apprentice';
    // the tie has been this way since the first stage of the run of equal kinds it is in
    let first = stage;
    while (first > 0 && arc[first - 1] === arc[stage]) first--;
    const since = first === 0 ? 0 : start + (first - 1) * TIE_ARC_DAYS;
    return { kind, other: t.other, since };
  });
}

/** Fresh news a resident is bursting to share about one of their own ties (within three days of it). */
export function tieNewsOn(npcId: string, day: number): string | null {
  for (const t of tiesOn(npcId, day)) {
    if (!t.since || day - t.since > 3) continue;
    const o = NPC_BY_ID[t.other];
    if (!o) continue;
    const n = first(o);
    switch (t.kind) {
      case 'sweetheart':
        return `Can I tell you a secret? ${n} and I... we've started walking out together.`;
      case 'betrothed':
        return `${n} asked me to marry! We're to be wed before the season turns.`;
      case 'spouse':
        return `${n} and I were married ${day - t.since === 0 ? 'today' : `${day - t.since} day${day - t.since === 1 ? '' : 's'} ago`}. I still can't believe it.`;
      case 'former':
        return `${n} and I... it's over between us. Please don't ask.`;
      case 'reconciled':
        return `${n} and I finally talked it all out. Years of quarrelling, gone.`;
      case 'friend':
        return `Who'd have thought ${n} and I would end up friends? Funny old world.`;
      default:
        break;
    }
  }
  return null;
}

/** Village gossip: fresh news about two other residents (a neighbour of the speaker and one of their ties). */
export function tieGossipOn(npcId: string, day: number): string | null {
  for (const n of tiesOf(npcId)) {
    for (const t of tiesOn(n.other, day)) {
      if (t.other === npcId || !t.since || day - t.since > 5) continue;
      const a = NPC_BY_ID[n.other],
        b = NPC_BY_ID[t.other];
      if (!a || !b) continue;
      const pair = `${first(a)} and ${first(b)}`;
      switch (t.kind) {
        case 'betrothed':
          return `Did you hear? ${pair} are to be wed!`;
        case 'spouse':
          return `${pair} were married. Lovely ceremony, everyone cried.`;
        case 'sweetheart':
          return `Between you and me, ${pair} have been seen walking out together.`;
        case 'former':
          return `Poor ${first(a)}. ${pair} have parted ways.`;
        case 'reconciled':
          return `${pair} have made up at last, after all these years!`;
        default:
          break;
      }
    }
  }
  return null;
}

const first = (d: NpcDef) => d.name.split(' ')[0]!;
const TIE_TEXT: Record<TieKind, (o: NpcDef) => string> = {
  friend: (o) => `${first(o)} and I go back years; there's no better friend in this place.`,
  rival: (o) => `${first(o)}? We don't see eye to eye, and everyone knows it.`,
  sweetheart: (o) => `${first(o)}... well. Don't tell anyone, but we've been walking out together.`,
  kin: (o) => `${first(o)} is family. Cousins, if you want the long version.`,
  mentor: (o) => `I've been teaching ${first(o)} the trade. Coming along nicely.`,
  apprentice: (o) => `${first(o)} taught me everything I know about the work.`,
  betrothed: (o) => `${first(o)} and I are to be married! You'll come to the wedding, won't you?`,
  spouse: (o) =>
    `My ${o.role === 'farmer' || o.role === 'hand' ? 'better half' : 'spouse'}, ${first(o)}. Best thing that ever happened to me.`,
  former: (o) => `${first(o)} and I were close once. Not any more.`,
  reconciled: (o) => `${first(o)} and I used to fight like cats. We're mending it now.`,
};

/** One line about a neighbour: who they are to this resident, what they do and where they are just now. */
export function neighbourLine(npcId: string, hour: number, weather: Weather, pick: number, day = 0): string | null {
  const ties = tiesOn(npcId, day);
  if (!ties.length) return null;
  const t = ties[Math.floor(pick * ties.length) % ties.length]!;
  const o = NPC_BY_ID[t.other];
  if (!o) return null;
  const doing = scheduleAt(o, hour, weather).doing;
  return `${TIE_TEXT[t.kind](o)} ${first(o)} ${professionOf(o)}, and is ${doing} about now.`;
}

/** The full list, for "Who are your neighbours?". */
export function neighboursText(npcId: string, day = 0): string {
  const ties = tiesOn(npcId, day);
  if (!ties.length) return "I keep to myself, mostly. It's a quiet life.";
  return ties
    .map((t) => {
      const o = NPC_BY_ID[t.other];
      return o ? `• ${o.name} (${t.kind}) ${professionOf(o)}.` : '';
    })
    .filter(Boolean)
    .join('\n');
}

const weddingCache = new Map<string, Array<[string, string]>>();
/** Couples marrying in a settlement on world day `day` (they and their neighbours celebrate in the square). */
export function weddingsOn(place: string, day: number): Array<[string, string]> {
  const key = `${place}:${day}`;
  let out = weddingCache.get(key);
  if (out) return out;
  out = [];
  const seen = new Set<string>();
  for (const d of Object.values(NPC_BY_ID)) {
    if (placeOf(d) !== place) continue;
    for (const t of tiesOn(d.id, day))
      if (t.kind === 'spouse' && t.since === day && !seen.has(t.other)) {
        seen.add(d.id);
        out.push([d.id, t.other]);
      }
  }
  if (weddingCache.size > 64) weddingCache.clear();
  weddingCache.set(key, out);
  return out;
}
/** Is this resident getting married today? */
export const marriesOn = (npcId: string, day: number): boolean =>
  tiesOn(npcId, day).some((t) => t.kind === 'spouse' && t.since === day);

// ───────────────────────── word travels ─────────────────────────

const CLOSE: ReadonlySet<TieKind> = new Set([
  'friend',
  'kin',
  'sweetheart',
  'betrothed',
  'spouse',
  'mentor',
  'apprentice',
  'reconciled',
]);

/**
 * How a kindness to one resident spreads (master plan §17 "NPC memories"): those close to them think a little better of
 * you (a quarter of it), while a rival who hears of it cools a little (a sixth, and only for kindnesses).
 */
export function tieSpill(npcId: string, day: number, delta: number): Array<{ npc: string; delta: number }> {
  if (!delta) return [];
  const out: Array<{ npc: string; delta: number }> = [];
  for (const t of tiesOn(npcId, day)) {
    if (CLOSE.has(t.kind)) out.push({ npc: t.other, delta: Math.round(delta / 4) });
    else if (t.kind === 'rival' && delta > 0) out.push({ npc: t.other, delta: -Math.round(delta / 6) });
  }
  return out.filter((x) => x.delta !== 0);
}

/**
 * What a resident says about you and the people they know: a close tie who counts you a friend speaks well of you;
 * standing with their rival earns a sniff. `heartsWith` gives your hearts with any resident.
 */
export function standingLine(npcId: string, day: number, heartsWith: (npc: string) => number): string | null {
  for (const t of tiesOn(npcId, day)) {
    const o = NPC_BY_ID[t.other];
    if (!o || heartsWith(t.other) < 4) continue;
    const n = first(o);
    if (t.kind === 'rival') return `I see you keep company with ${n}. Well. Each to their own.`;
    if (CLOSE.has(t.kind)) return `${n} speaks well of you, you know. That counts for something with me.`;
  }
  return null;
}
