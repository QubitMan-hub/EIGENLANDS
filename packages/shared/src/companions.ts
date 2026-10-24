/** Living wildlife bonds reuse the companion roster, slots, progression and reform rules. */
export const COMPANION_BONDS = [
  { kind: 7, name: 'Brambleback', food: 'hazelnut', count: 3, trait: 'Earthshove', detail: 'Charges push enemies 2 tiles/s harder.' },
  { kind: 9, name: 'Mossburrow', food: 'mushroom', count: 2, trait: 'Rootbite', detail: 'Bites slow an enemy for 2 seconds.' },
  { kind: 3, name: 'Glimmerhart', food: 'blackberry', count: 3, trait: 'Quiet haven', detail: 'Heals you 2 HP every 12 seconds while nearby, ashore and out of combat. Does not attack.' },
] as const;
export const companionBond = (kind: number) => COMPANION_BONDS.find(b => b.kind === kind);
export const BOND_RANGE = 4;
