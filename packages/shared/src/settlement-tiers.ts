import type { Place } from './realm-npcs';
import type { RealmSite } from './realms';

/** Physical settlement stages; SiteKind still carries its existing civic meaning. */
export type SettlementTier = 'village' | 'town' | 'medium_town' | 'big_town' | 'capital';
export const SETTLEMENT_TIERS: readonly SettlementTier[] = ['village', 'town', 'medium_town', 'big_town', 'capital'];
export interface SettlementProfile {
  w: number;
  h: number;
  homes: readonly [number, number];
  population: number;
  ambientLimit: number;
  guards: number;
  services: readonly Place[];
  fieldRows: number;
  streetPitch: number;
  layout: 'lanes' | 'market' | 'districts' | 'citadel';
  defense: 'open' | 'palisade' | 'wall' | 'fortified';
}
export const SETTLEMENT_PROFILES: Record<SettlementTier, SettlementProfile> = {
  village: {
    w: 64,
    h: 52,
    homes: [4, 6],
    population: 6,
    ambientLimit: 22,
    guards: 0,
    services: ['store', 'farmhouse'],
    fieldRows: 8,
    streetPitch: 13,
    layout: 'lanes',
    defense: 'open',
  },
  town: {
    w: 96,
    h: 76,
    homes: [10, 13],
    population: 12,
    ambientLimit: 32,
    guards: 2,
    services: ['hall', 'inn', 'store', 'farmhouse'],
    fieldRows: 9,
    streetPitch: 14,
    layout: 'market',
    defense: 'palisade',
  },
  medium_town: {
    w: 136,
    h: 104,
    homes: [22, 26],
    population: 22,
    ambientLimit: 46,
    guards: 4,
    services: ['hall', 'barracks', 'inn', 'store', 'smithy', 'herbalist', 'farmhouse'],
    fieldRows: 10,
    streetPitch: 14,
    layout: 'districts',
    defense: 'wall',
  },
  big_town: {
    w: 176,
    h: 132,
    homes: [36, 42],
    population: 36,
    ambientLimit: 62,
    guards: 7,
    services: ['hall', 'barracks', 'inn', 'store', 'smithy', 'herbalist', 'library', 'farmhouse'],
    fieldRows: 11,
    streetPitch: 13,
    layout: 'districts',
    defense: 'fortified',
  },
  capital: {
    w: 224,
    h: 168,
    homes: [52, 60],
    population: 54,
    ambientLimit: 80,
    guards: 12,
    services: ['hall', 'barracks', 'inn', 'store', 'smithy', 'herbalist', 'library', 'farmhouse'],
    fieldRows: 12,
    streetPitch: 13,
    layout: 'citadel',
    defense: 'fortified',
  },
};
export function settlementTier(site: RealmSite): SettlementTier {
  return site.tier ?? (site.kind === 'capital' ? 'capital' : site.kind === 'town' ? 'medium_town' : 'village');
}
export function settlementProfile(site: RealmSite): SettlementProfile {
  return SETTLEMENT_PROFILES[settlementTier(site)];
}

export const SETTLEMENT_TIER_NAMES: Record<SettlementTier, string> = {
  village: 'Village',
  town: 'Town',
  medium_town: 'Medium town',
  big_town: 'Big town',
  capital: 'Kingdom capital',
};
/** Named plots retain their identity and bounds; auxiliary farms/outposts retain their existing purpose. */
export function settlementSite(site: RealmSite, generation: number): RealmSite {
  return generation >= 7 && (site.tier || site.kind === 'capital' || site.kind === 'town' || site.kind === 'village')
    ? { ...site, tier: settlementTier(site) }
    : site;
}
