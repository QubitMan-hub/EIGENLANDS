/**
 * Words about an item for the player: where it comes from, what it gives, what it does. Pure text rules shared by the
 * tooltip, the crafting book and the journal, so every screen says the same thing.
 */
import { catalogSources, type GearBonus, type Source } from './catalog';
import { STATION_BY_ID } from './crafting';
import { SET_BY_ID, WEAPONS, armorClimate } from './equipment';
import { ITEMS, itemDef, type BuffKind, type Stack } from './items';
import { recipesMaking } from './recipes';
import { TILE_DEFS } from './tiles';

const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`;
const r1 = (n: number): string => String(Math.round(n * 10) / 10);

export const BUFF_TEXT: Record<BuffKind, (p: number) => string> = {
  regen: (p) => `Regenerates health (+${r1(p * 4)} every few seconds)`,
  might: (p) => `Strikes hit ${pct(p)} harder`,
  ward: (p) => `Damage taken -${pct(p)}`,
  lantern: () => 'See further in the dark',
  bleed: () => 'Bleeding',
  poison: () => 'Poisoned',
  burn: () => 'Burning',
  frostbite: () => 'Frostbitten',
  fracture: () => 'Fractured: no running or dodging',
  curse: () => 'Cursed: weaker blows, no healing over time',
  rested: (p) => `Well rested: +${Math.round((p - 1) * 100)}% experience`,
  warmth: () => 'Resist cold',
  coolness: () => 'Resist heat',
  vigor: (p) => `Maximum health +${Math.round(p)}`,
  fortune: (p) => `Luck +${r1(p)}`,
  swift: (p) => `Haste +${r1(p)}`,
  fury: (p) => `Attack +${Math.round(p)}`,
  bulwark: (p) => `Damage taken -${pct(p)}`,
  steady: (p) => `Stamina +${Math.round(p)}`,
  focus: (p) => `${Math.round(p)}% chance to save an ingredient`,
};

const minutes = (secs: number): string => (secs >= 120 ? `${Math.round(secs / 60)} min` : `${secs}s`);

/** The numbers a gear bonus gives, as short phrases. */
export function bonusLines(b: GearBonus | undefined, k = 1): string[] {
  if (!b) return [];
  const out: string[] = [];
  const n = (v: number | undefined, f: (x: number) => string): void => {
    if (v) out.push(f(v * k));
  };
  n(b.hp, (v) => `+${Math.round(v)} health`);
  n(b.atk, (v) => `+${Math.round(v)} attack`);
  n(b.def, (v) => `-${pct(v)} damage taken`);
  n(b.luck, (v) => `+${r1(v)} luck`);
  n(b.haste, (v) => `+${r1(v)} haste`);
  n(b.phase, (v) => `${pct(v)} of hits pass through`);
  n(b.warm, (v) => `+${Math.round(v)} warmth`);
  n(b.cool, (v) => (v > 0 ? `+${Math.round(v)} coolness` : `Bakes in the heat (${Math.round(v)} coolness)`));
  n(b.drain, (v) => `-${pct(v)} hunger and thirst`);
  n(b.light, (v) => `Light radius ${Math.round(v)}`);
  n(b.craft, (v) => `${Math.round(v)}% to save an ingredient`);
  n(b.stamina, (v) => `+${Math.round(v)} stamina`);
  return out;
}

/** What an item gives or does, when worn, eaten or used. */
export function effectLines(s: Stack, k = 1): string[] {
  const d = itemDef(s.id);
  if (!d) return [];
  const out: string[] = [];
  if (d.gear) out.push(...bonusLines(d.gear.bonus, k));
  if (d.weapon) out.push(...bonusLines(WEAPONS[d.weapon]?.bonus, k));
  if (d.armor) {
    const set = SET_BY_ID[d.armor.set];
    if (set) {
      out.push(...bonusLines(set.piece, k));
      out.push(...bonusLines(armorClimate(set)));
      out.push(`Set ${set.name}: 2 pieces ${bonusLines(set.two).join(', ') || 'no bonus'}`);
      out.push(`4 pieces ${bonusLines(set.four).join(', ') || 'no bonus'}`);
    }
  }
  if (d.buff) out.push(`${BUFF_TEXT[d.buff.kind](d.buff.power)} for ${minutes(d.buff.secs)}`);
  if (d.use) {
    if (d.use.t === 'repair') out.push(`Restores ${d.use.pct}% durability`);
    if (d.use.t === 'whetstone') out.push(`+${d.use.atk} attack for ${minutes(d.use.secs)}`);
    if (d.use.t === 'recipe') out.push('Read to learn a recipe');
    if (d.use.t === 'rune') out.push('Bind to gear at an enchanting table');
  }
  if (d.fert)
    out.push(`Saves ${d.fert.days} day${d.fert.days > 1 ? 's' : ''} of growth${d.fert.yield ? ' and adds yield' : ''}`);
  return out;
}

const tileName = (tile: number): string => TILE_DEFS[tile]?.name?.toLowerCase() ?? 'rock';
const nice = (id: string): string => id.replace(/_/g, ' ');
const realmName = (r: string | undefined): string => (r ? ` in ${r[0]!.toUpperCase()}${r.slice(1)}` : '');
const caveName = (c: string | undefined): string => (c ? ` in the ${c} caves` : '');

/** One sentence per way an item enters the world. */
export function describeSource(s: Source): string {
  switch (s.k) {
    case 'node':
      return `Mined or felled from ${tileName(s.tile)}${realmName(s.realm)}${caveName(s.cave)}`;
    case 'mob':
      return `Dropped by ${nice(s.family)}${realmName(s.realm)}`;
    case 'forage':
      return `Foraged in ${s.seasons.map((x) => ['spring', 'summer', 'autumn', 'winter'][x]).join(' and ')}`;
    case 'fish':
      return `Fished from ${s.def.oceanOnly ? 'the sea' : s.def.water === 'deep' ? 'deep water' : 'the shallows'}`;
    case 'shop':
      return `Sold by ${nice(s.role)} shops${realmName(s.realm)}`;
    case 'vault':
      return `Found in ${s.table === 'any' ? 'vaults' : `${s.table} vaults`}`;
    case 'animal':
      return `Given by your ${nice(s.kind)}`;
    case 'crop':
      return 'Grown from its seed';
    case 'boss':
      return `Won from ${nice(s.boss)}`;
    case 'quest':
      return 'A quest reward';
  }
}

let sourceIndex: Map<string, Source[]> | null = null;
/** Where to get an item: how it is found, and which bench makes it. */
export function sourceLines(id: string): string[] {
  if (!sourceIndex) {
    sourceIndex = new Map();
    for (const { item, src } of catalogSources()) {
      const l = sourceIndex.get(item);
      if (l) l.push(src);
      else sourceIndex.set(item, [src]);
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of sourceIndex.get(id) ?? []) {
    const line = describeSource(s);
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  const rec = recipesMaking(id)[0];
  if (rec) out.push(`Made at the ${STATION_BY_ID[rec.station].name} (${rec.disc} ${rec.lvl})`);
  if (!out.length && ITEMS[id]) out.push('Found out in the world');
  return out.slice(0, 5);
}
