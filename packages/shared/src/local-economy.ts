import type { ItemKind } from './items';
import { REALM_SITE_BY_ID, type SiteKind } from './realms';
import { hash2 } from './rng';

/**
 * Local economies (master plan §16): every kingdom settlement makes some kinds of goods and wants others, so the same
 * pick or loaf costs differently in a mining outpost and a farm. Each day one kind runs short in each settlement. It
 * is a pure function of seed, site and day: nothing is simulated or stored. (Supply-driven base prices live in economy.ts.)
 */
export interface LocalEconomy {
  produces: ItemKind[];
  needs: ItemKind[];
  /** the kind that ran short today, and how folk say it */
  shortage: ItemKind;
  short: string;
  /** one line for the shop window */
  note: string;
}

const TRADE: Record<SiteKind, { produces: ItemKind[]; needs: ItemKind[]; word: string; want: string }> = {
  capital: {
    produces: ['ring', 'outfit', 'scroll', 'potion'],
    needs: ['crop', 'food', 'fish'],
    word: 'finery and charms',
    want: 'food',
  },
  town: {
    produces: ['tool', 'weapon', 'armor', 'gear'],
    needs: ['resource', 'material'],
    word: 'tools and arms',
    want: 'raw stuff',
  },
  village: {
    produces: ['forage', 'fish', 'seed', 'bug'],
    needs: ['tool', 'weapon'],
    word: 'forage and fish',
    want: 'tools',
  },
  farm: {
    produces: ['crop', 'food', 'animal', 'fertilizer'],
    needs: ['tool', 'material'],
    word: 'crops and food',
    want: 'tools',
  },
  outpost: {
    produces: ['resource', 'material'],
    needs: ['food', 'potion'],
    word: 'ore and timber',
    want: 'food and potions',
  },
};
const SHORT: ItemKind[] = ['food', 'crop', 'fish', 'potion', 'tool', 'material', 'resource', 'forage'];
const SHORT_WORD: Record<string, string> = {
  food: 'food',
  crop: 'crops',
  fish: 'fish',
  potion: 'potions',
  tool: 'tools',
  material: 'materials',
  resource: 'raw stuff',
  forage: 'forage',
};

export const LOCAL_CHEAP = 0.85;
export const LOCAL_DEAR = 1.15;
export const LOCAL_SHORT = 1.25;

export function localEconomy(seed: number, siteId: string, day: number): LocalEconomy | null {
  const site = REALM_SITE_BY_ID[siteId];
  if (!site) return null;
  const t = TRADE[site.kind];
  const pool = SHORT.filter((k) => !t.produces.includes(k));
  const shortage = pool[Math.floor(hash2(seed, day, siteId.length * 131 + site.cx, 77) * pool.length)]!;
  return {
    produces: t.produces,
    needs: t.needs,
    shortage,
    short: SHORT_WORD[shortage]!,
    note: `Made here: ${t.word} (cheap). Wanted: ${t.want}. Short today: ${SHORT_WORD[shortage]}.`,
  };
}

/** Multiplier on a shop's buy price for an item of this kind in this settlement (sell prices use its inverse). */
export function localPriceFactor(e: LocalEconomy | null, kind: ItemKind | undefined): number {
  if (!e || !kind) return 1;
  let f = 1;
  if (e.produces.includes(kind)) f *= LOCAL_CHEAP;
  if (e.needs.includes(kind)) f *= LOCAL_DEAR;
  if (e.shortage === kind) f *= LOCAL_SHORT;
  return f;
}
