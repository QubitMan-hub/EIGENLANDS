/**
 * NPC relationships (master plan §16): the folk of each settlement know each other. Every resident has two or three
 * ties to neighbours (old friends, rivals, sweethearts, kin, a mentor or an apprentice), worked out from the seedless
 * roster so they never change and cost nothing to keep. Residents talk about them, about where their neighbours are
 * at this hour, and pass on the kingdom's news.
 */
import { NPC_BY_ID, scheduleAt, type NpcDef } from './npcs';
import type { Weather } from './weather';

export type TieKind = 'friend' | 'rival' | 'sweetheart' | 'kin' | 'mentor' | 'apprentice';
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

const first = (d: NpcDef) => d.name.split(' ')[0]!;
const TIE_TEXT: Record<TieKind, (o: NpcDef) => string> = {
  friend: (o) => `${first(o)} and I go back years; there's no better friend in this place.`,
  rival: (o) => `${first(o)}? We don't see eye to eye, and everyone knows it.`,
  sweetheart: (o) => `${first(o)}... well. Don't tell anyone, but we've been walking out together.`,
  kin: (o) => `${first(o)} is family. Cousins, if you want the long version.`,
  mentor: (o) => `I've been teaching ${first(o)} the trade. Coming along nicely.`,
  apprentice: (o) => `${first(o)} taught me everything I know about the work.`,
};

/** One line about a neighbour: who they are to this resident, what they do and where they are just now. */
export function neighbourLine(npcId: string, hour: number, weather: Weather, pick: number): string | null {
  const ties = tiesOf(npcId);
  if (!ties.length) return null;
  const t = ties[Math.floor(pick * ties.length) % ties.length]!;
  const o = NPC_BY_ID[t.other];
  if (!o) return null;
  const doing = scheduleAt(o, hour, weather).doing;
  return `${TIE_TEXT[t.kind](o)} ${first(o)} ${professionOf(o)}, and is ${doing} about now.`;
}

/** The full list, for "Who are your neighbours?". */
export function neighboursText(npcId: string): string {
  const ties = tiesOf(npcId);
  if (!ties.length) return "I keep to myself, mostly. It's a quiet life.";
  return ties
    .map((t) => {
      const o = NPC_BY_ID[t.other];
      return o ? `• ${o.name} (${t.kind}) ${professionOf(o)}.` : '';
    })
    .filter(Boolean)
    .join('\n');
}
