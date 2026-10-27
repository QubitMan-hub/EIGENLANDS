import { bestiaryKind } from './bestiary';

export interface CompanionBond {
  kind: number;
  name: string;
  food: string;
  count: number;
  trait: string;
  detail: string;
  level?: number;
  boss?: string;
}
/** Living wildlife bonds reuse the companion roster, slots, progression and reform rules. */
export const COMPANION_BONDS: readonly CompanionBond[] = [
  {
    kind: 7,
    name: 'Brambleback',
    food: 'hazelnut',
    count: 3,
    trait: 'Earthshove',
    detail: 'Charges push enemies 2 tiles/s harder.',
  },
  {
    kind: 9,
    name: 'Mossburrow',
    food: 'mushroom',
    count: 2,
    trait: 'Rootbite',
    detail: 'Bites slow an enemy for 2 seconds.',
  },
  {
    kind: 3,
    name: 'Glimmerhart',
    food: 'blackberry',
    count: 3,
    trait: 'Quiet haven',
    detail: 'Heals you 2 HP every 12 seconds while nearby, ashore and out of combat. Does not attack.',
  },
  {
    kind: bestiaryKind('unicorn'),
    name: 'Dawnmane',
    food: 'honey',
    count: 12,
    level: 18,
    trait: 'Quiet sanctuary',
    detail:
      'Restores 3 HP to you and nearby party members every 12 seconds while ashore and out of combat. Does not attack.',
  },
  {
    kind: 44,
    name: 'Galesworn',
    food: 'grilled_meat',
    count: 10,
    level: 22,
    boss: 'colossus',
    trait: 'Wingguard',
    detail: 'Hits push enemies 1.5 tiles/s harder.',
  },
  {
    kind: bestiaryKind('dragon'),
    name: 'Cinderbond',
    food: 'grilled_meat',
    count: 20,
    level: 24,
    boss: 'primordial_dragon',
    trait: 'Crownfire',
    detail: 'Hits suppress enemy regrowth for 8 seconds.',
  },
];
export const companionBond = (kind: number) => COMPANION_BONDS.find((b) => b.kind === kind);
export const BOND_RANGE = 4;
