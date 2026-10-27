/** Adventurer disciplines share the Circuit rules, never a separate combat/save system. */
import type { AbilityDef, AbilityForm, ClassDef } from './classes';
export const ADVENTURER_FAMILIES = ['warrior', 'ranged', 'mage', 'stealth', 'support', 'hybrid'] as const;
export type AdventurerFamily = (typeof ADVENTURER_FAMILIES)[number];
export type AdventurerAbilityId = `${AdventurerFamily}_${string}`;
export interface PathTraits {
  damage?: number;
  incoming?: number;
  healing?: number;
  shielding?: number;
  recharge?: number;
  opening?: number;
  execute?: number;
  lowHealth?: number;
  distant?: number;
  close?: number;
  mythical?: number;
  lifesteal?: number;
  resource?: number;
  summonDamage?: number;
  summonDuration?: number;
}
export interface AdventurerPath {
  id: string;
  name: string;
  family: AdventurerFamily;
  desc: string;
  gear: string[];
  traits: PathTraits;
  skill: AdventurerAbilityId;
}
const pair = (
  name: string,
  hue: number,
  a: Partial<AbilityForm> & { kind: AbilityForm['kind'] },
  b: Partial<AbilityForm> & { kind: AbilityForm['kind'] },
  other: string,
): [AbilityForm, AbilityForm] => [
  { name, hue, ...a },
  { name: other, hue: (hue + 4) % 8, ...b },
];
const PATHS: Array<
  [string, string, AdventurerFamily, string, string[], PathTraits, string, number, [AbilityForm, AbilityForm]]
> = [
  [
    'knight',
    'Knight',
    'warrior',
    'Disciplined pressure: deal 8% more damage and take 4% less. Hold the line while allies flank.',
    ['sword'],
    { damage: 1.08, incoming: 0.96 },
    'Oath cut',
    9,
    pair(
      'Oath cut',
      2,
      { kind: 'strike', dmg: 27, radius: 2.4, push: 3 },
      { kind: 'party_ward', amount: 0.18, secs: 5, radius: 4 },
      'Oath shelter',
    ),
  ],
  [
    'guardian',
    'Guardian',
    'warrior',
    'Take 14% less damage, but deal 6% less. A defensive anchor for a fragile party.',
    ['warhammer'],
    { incoming: 0.86, damage: 0.94 },
    'Bulwark',
    13,
    pair(
      'Bulwark',
      2,
      { kind: 'party_ward', amount: 0.28, secs: 5, radius: 4 },
      { kind: 'ring', dmg: 14, radius: 6, push: -5, slow: 0.3, secs: 1.5 },
      'Gravity challenge',
    ),
  ],
  [
    'berserker',
    'Berserker',
    'warrior',
    'Below 40% health, deal 28% more damage. Always take 10% more damage; retreat before overcommitting.',
    ['battle_axe'],
    { lowHealth: 1.28, incoming: 1.1 },
    'Blood arc',
    8,
    pair(
      'Blood arc',
      0,
      { kind: 'strike', dmg: 39, radius: 2.3, push: 2 },
      { kind: 'ring', dmg: 24, radius: 3.2, slow: 0.2, secs: 2 },
      'Rime fury',
    ),
  ],
  [
    'samurai',
    'Samurai',
    'warrior',
    'Opening hits against foes above 90% health deal 25% more damage. Precision rewards an unbroken first strike.',
    ['sword'],
    { opening: 1.25 },
    'Iaido',
    10,
    pair(
      'Iaido',
      1,
      { kind: 'strike', dmg: 42, radius: 3.2, push: 1 },
      { kind: 'blink_back', radius: 4, secs: 1.2 },
      'Returning draw',
    ),
  ],
  [
    'paladin',
    'Paladin',
    'warrior',
    'Healing is 18% stronger and incoming damage falls 5%. Lower burst than an offensive specialist.',
    ['warhammer', 'radiant_staff'],
    { healing: 1.18, incoming: 0.95 },
    'Sanctified ground',
    14,
    pair(
      'Sanctified ground',
      2,
      { kind: 'party_heal', heal: 23, radius: 4 },
      { kind: 'ring', dmg: 24, radius: 3, slow: 0.35, secs: 3 },
      'Hollow judgement',
    ),
  ],
  [
    'dragoon',
    'Dragoon',
    'warrior',
    'Hits beyond five tiles deal 15% more damage. Spears and a retreating jump bridge the vulnerable middle range.',
    ['spear'],
    { distant: 1.15 },
    'Sky lance',
    10,
    pair(
      'Sky lance',
      1,
      { kind: 'bolt', dmg: 35, count: 1, range: 10, speed: 19 },
      { kind: 'blink', radius: 4 },
      'Tide vault',
    ),
  ],
  [
    'archer',
    'Archer',
    'ranged',
    'Long shots gain 12% damage. At close range damage falls 10%; use a ward or ally to create distance.',
    ['crossbow', 'longbow'],
    { distant: 1.12, close: 0.9 },
    'Fan of arrows',
    8,
    pair(
      'Fan of arrows',
      3,
      { kind: 'bolt', dmg: 13, count: 5, spread: 10, range: 10, speed: 19 },
      { kind: 'bolt', dmg: 31, count: 1, range: 12, speed: 22 },
      'Flux needle',
    ),
  ],
  [
    'ranger',
    'Ranger',
    'ranged',
    'Summons last 30% longer and healing is 8% stronger. Track patiently and let companions pin prey.',
    ['crossbow', 'spear'],
    { summonDuration: 1.3, healing: 1.08 },
    'Trail companion',
    16,
    pair(
      'Trail companion',
      3,
      { kind: 'summon', summon: 'wolf', secs: 18, amount: 1 },
      { kind: 'party_heal', heal: 22, radius: 4 },
      'Campfire song',
    ),
  ],
  [
    'marksman',
    'Marksman',
    'ranged',
    'Long shots gain 22% damage, but attacks within two tiles lose 15%. Keep clear sight lines.',
    ['crossbow'],
    { distant: 1.22, close: 0.85 },
    'Deadeye',
    12,
    pair(
      'Deadeye',
      1,
      { kind: 'bolt', dmg: 51, count: 1, range: 15, speed: 25 },
      { kind: 'bolt', dmg: 25, count: 2, spread: 4, range: 11, speed: 18, push: 4 },
      'Undertow doublet',
    ),
  ],
  [
    'beast_hunter',
    'Beast Hunter',
    'ranged',
    'Deal 22% more damage to mythical creatures and bosses, but take 5% more damage. Read their telegraphs.',
    ['crossbow', 'spear'],
    { mythical: 1.22, incoming: 1.05 },
    'Binding bolt',
    11,
    pair(
      'Binding bolt',
      4,
      { kind: 'bolt', dmg: 23, count: 1, range: 11, speed: 16, slow: 0.65, secs: 4 },
      { kind: 'strike', dmg: 37, radius: 2.8, push: 5 },
      'Ember harpoon',
    ),
  ],
  [
    'elementalist',
    'Elementalist',
    'mage',
    'Deal 6% more damage. Every opposite form matters: build gates for the terrain and enemy you face.',
    ['ember_staff', 'rime_staff'],
    { damage: 1.06 },
    'Elemental storm',
    13,
    pair(
      'Elemental storm',
      0,
      { kind: 'ring', dmg: 35, radius: 4.2 },
      { kind: 'ring', dmg: 26, radius: 4.8, slow: 0.55, secs: 3 },
      'Winter eye',
    ),
  ],
  [
    'sorcerer',
    'Sorcerer',
    'mage',
    'Deal 15% more damage and take 12% more. Allies must buy time for your powerful casts.',
    ['ember_staff'],
    { damage: 1.15, incoming: 1.12 },
    'Starfall',
    14,
    pair(
      'Starfall',
      6,
      { kind: 'bolt', dmg: 20, count: 3, spread: 7, range: 12, speed: 13 },
      { kind: 'party_ward', amount: 0.25, secs: 6, radius: 3 },
      'Dawn canopy',
    ),
  ],
  [
    'summoner',
    'Summoner',
    'mage',
    'Summoned creatures deal 20% more damage; your direct attacks deal 10% less. Two temporary summons at most.',
    ['morph_staff'],
    { summonDamage: 1.2, damage: 0.9 },
    'Primal pact',
    18,
    pair(
      'Primal pact',
      3,
      { kind: 'summon', summon: 'badger', secs: 24, amount: 1.25 },
      { kind: 'summon', summon: 'cinder_drake', secs: 16, amount: 1.1 },
      'Ember pact',
    ),
  ],
  [
    'druid',
    'Druid',
    'mage',
    'Healing is 20% stronger and incoming damage falls 6%. Support a living front line with roots and companions.',
    ['verdant_staff'],
    { healing: 1.2, incoming: 0.94 },
    'Grove circle',
    15,
    pair(
      'Grove circle',
      3,
      { kind: 'party_heal', heal: 32, radius: 5 },
      { kind: 'ring', dmg: 22, radius: 4, slow: 0.7, secs: 3 },
      'Bramble night',
    ),
  ],
  [
    'necromancer',
    'Necromancer',
    'mage',
    'Recover 5% of damage dealt as health, but take 5% more damage. Conjured guardians expire and grant no free permanent roster.',
    ['morph_staff'],
    { lifesteal: 0.05, incoming: 1.05 },
    'Grave sentinel',
    18,
    pair(
      'Grave sentinel',
      6,
      { kind: 'summon', summon: 'vault_guardian', secs: 20, amount: 0.9 },
      { kind: 'party_heal', heal: 26, radius: 4 },
      'Spirit restitution',
    ),
  ],
  [
    'chronomancer',
    'Chronomancer',
    'mage',
    'Abilities recharge 12% faster but deal 8% less damage. Use slows and a returning step to control the fight.',
    ['rime_staff'],
    { recharge: 0.88, damage: 0.92 },
    'Still hour',
    16,
    pair(
      'Still hour',
      4,
      { kind: 'ring', dmg: 14, radius: 5, slow: 0.8, secs: 4 },
      { kind: 'blink_back', radius: 5, secs: 2 },
      'Borrowed second',
    ),
  ],
  [
    'rogue',
    'Rogue',
    'stealth',
    'Opening strikes deal 20% more damage; attacks within two tiles gain another 8%. Keep an escape ready.',
    ['dagger'],
    { opening: 1.2, close: 1.08 },
    'Dirty trick',
    10,
    pair(
      'Dirty trick',
      6,
      { kind: 'strike', dmg: 26, radius: 2, slow: 0.65, secs: 3 },
      { kind: 'blink_back', radius: 3.5, secs: 1.5 },
      'Lantern feint',
    ),
  ],
  [
    'assassin',
    'Assassin',
    'stealth',
    'Deal 25% more damage to enemies below 35% health. Finish a party target instead of scattering damage.',
    ['dagger'],
    { execute: 1.25 },
    'Final whisper',
    12,
    pair(
      'Final whisper',
      6,
      { kind: 'strike', dmg: 44, radius: 2.2 },
      { kind: 'bolt', dmg: 32, count: 1, range: 8, speed: 21 },
      'Dawn dagger',
    ),
  ],
  [
    'ninja',
    'Ninja',
    'stealth',
    'Abilities recharge 10% faster but deal 5% less damage. Mobile tools reward short planned engagements.',
    ['dagger', 'crossbow'],
    { recharge: 0.9, damage: 0.95 },
    'Shuriken fan',
    9,
    pair(
      'Shuriken fan',
      1,
      { kind: 'bolt', dmg: 14, count: 3, spread: 13, range: 8, speed: 22 },
      { kind: 'blink', radius: 5 },
      'Water shadow',
    ),
  ],
  [
    'shadowblade',
    'Shadowblade',
    'stealth',
    'Recover 8% of damage dealt as health, but take 8% more damage. Sustain requires landing real hits.',
    ['dagger', 'morph_staff'],
    { lifesteal: 0.08, incoming: 1.08 },
    'Night edge',
    11,
    pair(
      'Night edge',
      6,
      { kind: 'strike', dmg: 35, radius: 2.7, push: 2 },
      { kind: 'shield', amount: 38, secs: 4 },
      'Gleaming veil',
    ),
  ],
  [
    'cleric',
    'Cleric',
    'support',
    'Healing is 25% stronger but direct damage falls 15%. Your party must help with sustained offense.',
    ['radiant_staff'],
    { healing: 1.25, damage: 0.85 },
    'Benediction',
    15,
    pair(
      'Benediction',
      2,
      { kind: 'party_heal', heal: 38, radius: 5 },
      { kind: 'party_ward', amount: 0.3, secs: 5, radius: 4 },
      'Quiet sanctuary',
    ),
  ],
  [
    'bard',
    'Bard',
    'support',
    'Earn class resource 20% faster and heal 12% more. Stay near allies to turn short encounters into a shared refrain.',
    ['radiant_staff', 'crossbow'],
    { resource: 1.2, healing: 1.12 },
    'Brave refrain',
    13,
    pair(
      'Brave refrain',
      1,
      { kind: 'party_ward', amount: 0.24, secs: 7, radius: 6 },
      { kind: 'party_heal', heal: 25, radius: 6 },
      'Tidal refrain',
    ),
  ],
  [
    'alchemist',
    'Alchemist',
    'support',
    'Abilities recharge 8% faster and heal 10% more. Prepared mixtures alternate between rescue and area denial.',
    ['verdant_staff', 'ember_staff'],
    { recharge: 0.92, healing: 1.1 },
    'Volatile flask',
    12,
    pair(
      'Volatile flask',
      0,
      { kind: 'ring', dmg: 29, radius: 3.5 },
      { kind: 'party_heal', heal: 26, radius: 3.5 },
      'Restorative flask',
    ),
  ],
  [
    'spirit_healer',
    'Spirit Healer',
    'support',
    'Healing is 30% stronger but incoming damage rises 12%. Protect your own position while sustaining allies.',
    ['verdant_staff', 'radiant_staff'],
    { healing: 1.3, incoming: 1.12 },
    'Ancestral shelter',
    16,
    pair(
      'Ancestral shelter',
      3,
      { kind: 'party_heal', heal: 42, radius: 5 },
      { kind: 'party_ward', amount: 0.32, secs: 5, radius: 5 },
      'Sevenfold vigil',
    ),
  ],
  [
    'spellblade',
    'Spellblade',
    'hybrid',
    'Deal 6% more damage and recharge 4% faster. Alternate blade reach with ranged spell pressure.',
    ['sword', 'ember_staff'],
    { damage: 1.06, recharge: 0.96 },
    'Runeblade',
    10,
    pair(
      'Runeblade',
      0,
      { kind: 'strike', dmg: 35, radius: 3, push: 3 },
      { kind: 'bolt', dmg: 28, count: 1, range: 10, speed: 17, slow: 0.4, secs: 2 },
      'Frost edge',
    ),
  ],
  [
    'beastmaster',
    'Beastmaster',
    'hybrid',
    'Summons last 50% longer and deal 12% more damage. Their limited slots demand deliberate choices.',
    ['spear', 'verdant_staff'],
    { summonDuration: 1.5, summonDamage: 1.12 },
    'Wild covenant',
    18,
    pair(
      'Wild covenant',
      3,
      { kind: 'summon', summon: 'boar', secs: 20, amount: 1.2 },
      { kind: 'summon', summon: 'wolf', secs: 24, amount: 1.1 },
      'Moon covenant',
    ),
  ],
  [
    'artificer',
    'Artificer',
    'hybrid',
    'Shields absorb 20% more and damage rises 4%. Mechanical protection must be timed before a heavy hit.',
    ['crossbow', 'warhammer'],
    { shielding: 1.2, damage: 1.04 },
    'Clockwork sentinel',
    18,
    pair(
      'Clockwork sentinel',
      1,
      { kind: 'summon', summon: 'prism_beetle', secs: 18, amount: 1.15 },
      { kind: 'shield', amount: 58, secs: 6 },
      'Pressure barrier',
    ),
  ],
  [
    'runic_engineer',
    'Runic Engineer',
    'hybrid',
    'Shields absorb 30% more, but abilities recharge 5% slower. Build a defensive window for the party.',
    ['warhammer', 'morph_staff'],
    { shielding: 1.3, recharge: 1.05 },
    'Ward lattice',
    17,
    pair(
      'Ward lattice',
      2,
      { kind: 'party_ward', amount: 0.32, secs: 6, radius: 5 },
      { kind: 'ring', dmg: 36, radius: 4, push: 5 },
      'Void discharge',
    ),
  ],
  [
    'dragon_tamer',
    'Dragon Tamer',
    'hybrid',
    'Summons deal 25% more damage and attacks against mythical foes gain 15%; abilities recharge 12% slower.',
    ['spear', 'ember_staff'],
    { summonDamage: 1.25, mythical: 1.15, recharge: 1.12 },
    'Drake accord',
    20,
    pair(
      'Drake accord',
      0,
      { kind: 'summon', summon: 'cinder_drake', secs: 22, amount: 1.3 },
      { kind: 'party_ward', amount: 0.27, secs: 6, radius: 4 },
      'Frostscale accord',
    ),
  ],
  [
    'quantum_weaver',
    'Quantum Weaver',
    'hybrid',
    'Earn resource 25% faster but deal 6% less damage. Link allies and enemies to amplify the party instead.',
    ['morph_staff'],
    { resource: 1.25, damage: 0.94 },
    'Woven horizon',
    16,
    pair(
      'Woven horizon',
      6,
      { kind: 'link_enemy', dmg: 13, range: 12, speed: 16, secs: 14 },
      { kind: 'link_ally', heal: 15, range: 12, speed: 16, secs: 14 },
      'Radiant horizon',
    ),
  ],
];
export const ADVENTURER_PATHS: AdventurerPath[] = PATHS.map(([id, name, family, desc, gear, traits]) => ({
  id,
  name,
  family,
  desc,
  gear,
  traits,
  skill: `${family}_${id}`,
}));
export const pathFor = (family: string, spec: string | null | undefined) =>
  ADVENTURER_PATHS.find((p) => p.family === family && p.id === spec);
const CORE: Record<AdventurerFamily, Array<[string, number, [AbilityForm, AbilityForm]]>> = {
  warrior: [
    [
      'Cleave',
      5,
      pair(
        'Cleave',
        2,
        { kind: 'strike', dmg: 24, radius: 2.3, push: 3 },
        { kind: 'shield', amount: 25, secs: 4 },
        'Steel resolve',
      ),
    ],
    [
      'Challenge',
      9,
      pair(
        'Challenge',
        5,
        { kind: 'ring', dmg: 12, radius: 5, push: -5, slow: 0.3, secs: 1 },
        { kind: 'strike', dmg: 27, radius: 2.7 },
        'Thunder cut',
      ),
    ],
    [
      'Rally',
      12,
      pair(
        'Rally',
        3,
        { kind: 'party_ward', amount: 0.18, secs: 5, radius: 4 },
        { kind: 'ring', dmg: 21, radius: 3, push: 4 },
        'Fracture',
      ),
    ],
    [
      'Vanguard step',
      8,
      pair(
        'Vanguard step',
        1,
        { kind: 'blink', radius: 3 },
        { kind: 'strike', dmg: 32, radius: 3.2, slow: 0.3, secs: 2 },
        'Tide spear',
      ),
    ],
  ],
  ranged: [
    [
      'Aimed shot',
      4,
      pair(
        'Aimed shot',
        3,
        { kind: 'bolt', dmg: 23, count: 1, range: 12, speed: 20 },
        { kind: 'bolt', dmg: 13, count: 2, spread: 7, range: 10, speed: 18 },
        'Split arrow',
      ),
    ],
    [
      'Pinning shot',
      8,
      pair(
        'Pinning shot',
        4,
        { kind: 'bolt', dmg: 18, range: 10, speed: 17, slow: 0.55, secs: 3 },
        { kind: 'bolt', dmg: 29, range: 10, speed: 20, push: 4 },
        'Flare arrow',
      ),
    ],
    [
      'Backtrail',
      10,
      pair(
        'Backtrail',
        1,
        { kind: 'blink_back', radius: 4, secs: 1.5 },
        { kind: 'shield', amount: 31, secs: 4 },
        'Harbour cover',
      ),
    ],
    [
      'Volley',
      12,
      pair(
        'Volley',
        2,
        { kind: 'bolt', dmg: 13, count: 4, spread: 9, range: 10, speed: 18 },
        { kind: 'link_enemy', dmg: 12, range: 11, speed: 16, secs: 12 },
        'Marked quarry',
      ),
    ],
  ],
  mage: [
    [
      'Aether lance',
      5,
      pair(
        'Aether lance',
        0,
        { kind: 'bolt', dmg: 25, range: 10, speed: 14 },
        { kind: 'bolt', dmg: 19, range: 10, speed: 13, slow: 0.45, secs: 2 },
        'Rime lance',
      ),
    ],
    [
      'Arcane mantle',
      10,
      pair(
        'Arcane mantle',
        2,
        { kind: 'shield', amount: 35, secs: 5 },
        { kind: 'ring', dmg: 22, radius: 3.6 },
        'Void bloom',
      ),
    ],
    [
      'Familiar',
      16,
      pair(
        'Familiar',
        3,
        { kind: 'summon', summon: 'badger', secs: 15, amount: 0.8 },
        { kind: 'summon', summon: 'echo_bat', secs: 15, amount: 0.8 },
        'Night familiar',
      ),
    ],
    [
      'Sanctum',
      13,
      pair(
        'Sanctum',
        1,
        { kind: 'party_ward', amount: 0.2, secs: 5, radius: 4 },
        { kind: 'blink_back', radius: 4, secs: 1.5 },
        'Undertow step',
      ),
    ],
  ],
  stealth: [
    [
      'Quick cut',
      4,
      pair(
        'Quick cut',
        6,
        { kind: 'strike', dmg: 28, radius: 1.9 },
        { kind: 'bolt', dmg: 21, range: 7, speed: 22 },
        'Dawn knife',
      ),
    ],
    [
      'Vanish step',
      9,
      pair(
        'Vanish step',
        1,
        { kind: 'blink_back', radius: 4.5, secs: 1.4 },
        { kind: 'mirror', amount: 1, secs: 3 },
        'Tidal mirror',
      ),
    ],
    [
      'Hamstring',
      8,
      pair(
        'Hamstring',
        4,
        { kind: 'strike', dmg: 20, radius: 2.2, slow: 0.65, secs: 3 },
        { kind: 'ring', dmg: 20, radius: 2.5, push: 5 },
        'Scattering ash',
      ),
    ],
    [
      'Shadow pact',
      13,
      pair(
        'Shadow pact',
        6,
        { kind: 'link_enemy', dmg: 16, range: 8, speed: 18, secs: 12 },
        { kind: 'ward', amount: 0.3, secs: 4 },
        'Bright concealment',
      ),
    ],
  ],
  support: [
    [
      'Guiding light',
      5,
      pair(
        'Guiding light',
        2,
        { kind: 'heal', heal: 24 },
        { kind: 'bolt', dmg: 23, range: 10, speed: 14 },
        'Hollow lance',
      ),
    ],
    [
      'Gathering hymn',
      12,
      pair(
        'Gathering hymn',
        3,
        { kind: 'party_heal', heal: 20, radius: 5 },
        { kind: 'ring', dmg: 19, radius: 4, slow: 0.35, secs: 3 },
        'Discordant hymn',
      ),
    ],
    [
      'Shared shelter',
      13,
      pair(
        'Shared shelter',
        1,
        { kind: 'party_ward', amount: 0.2, secs: 6, radius: 5 },
        { kind: 'party_heal', heal: 24, radius: 4 },
        'Returning tide',
      ),
    ],
    [
      'Pilgrim step',
      10,
      pair('Pilgrim step', 2, { kind: 'blink', radius: 3.5 }, { kind: 'shield', amount: 38, secs: 5 }, 'Spirit veil'),
    ],
  ],
  hybrid: [
    [
      'Infused strike',
      5,
      pair(
        'Infused strike',
        0,
        { kind: 'strike', dmg: 25, radius: 2.5 },
        { kind: 'bolt', dmg: 22, range: 9, speed: 16, slow: 0.3, secs: 2 },
        'Rime projection',
      ),
    ],
    [
      'Resonant link',
      9,
      pair(
        'Resonant link',
        6,
        { kind: 'link_enemy', dmg: 14, range: 10, speed: 16, secs: 12 },
        { kind: 'link_ally', heal: 14, range: 10, speed: 16, secs: 12 },
        'Allied resonance',
      ),
    ],
    [
      'Construct pact',
      16,
      pair(
        'Construct pact',
        1,
        { kind: 'summon', summon: 'prism_beetle', secs: 16, amount: 0.9 },
        { kind: 'party_ward', amount: 0.2, secs: 5, radius: 4 },
        'Tidal lattice',
      ),
    ],
    [
      'Unstable field',
      12,
      pair(
        'Unstable field',
        3,
        { kind: 'party_heal', heal: 21, radius: 4 },
        { kind: 'ring', dmg: 27, radius: 3.5, push: 3 },
        'Flux detonation',
      ),
    ],
  ],
};
export const ADVENTURER_ABILITIES: Record<AdventurerAbilityId, AbilityDef> = {} as Record<
  AdventurerAbilityId,
  AbilityDef
>;
for (const family of ADVENTURER_FAMILIES)
  CORE[family].forEach(([name, cd, forms], i) => {
    const id = `${family}_${i}` as AdventurerAbilityId;
    ADVENTURER_ABILITIES[id] = {
      id,
      cls: family,
      name,
      cd,
      forms,
      desc: `${forms[0].name} ↔ ${forms[1].name}. Circuit gates choose the opposite form.`,
      glyph: ['⚔', '➶', '✦', '◇'][i]!,
    };
  });
for (const [id, name, family, desc, , , skill, cd, forms] of PATHS) {
  const key = `${family}_${id}` as AdventurerAbilityId;
  ADVENTURER_ABILITIES[key] = {
    id: key,
    cls: family,
    path: id,
    name: skill,
    cd,
    forms,
    desc: `${name} path · ${desc}`,
    glyph: '✧',
  };
}
const TEXT: Record<AdventurerFamily, [string, string, string, string, string[], number]> = {
  warrior: [
    'Warrior',
    'A measured front line',
    'Valor',
    'Short reach: casters and archers can punish a lonely advance.',
    ['sword', 'spear', 'warhammer'],
    38,
  ],
  ranged: [
    'Ranged',
    'Distance is your defence',
    'Focus',
    'Close enemies punish your damage and escape cooldowns.',
    ['crossbow'],
    13,
  ],
  mage: [
    'Magic',
    'Shape the field',
    'Aether',
    'Powerful casts leave you vulnerable to incoming damage.',
    ['ember_staff', 'rime_staff', 'morph_staff'],
    35,
  ],
  stealth: [
    'Stealth',
    'Choose when to commit',
    'Guile',
    'Fragile during a sustained face-to-face exchange.',
    ['dagger', 'crossbow'],
    43,
  ],
  support: [
    'Support',
    'Keep the party standing',
    'Grace',
    'Less direct damage: protection and real healing earn your resource.',
    ['radiant_staff', 'verdant_staff'],
    38,
  ],
  hybrid: [
    'Hybrid',
    'Engineer an answer',
    'Ingenuity',
    'No specialised base damage bonus; manage both distance and support windows.',
    ['sword', 'morph_staff', 'crossbow'],
    45,
  ],
};
export const ADVENTURER_CLASSES: Record<AdventurerFamily, ClassDef> = Object.fromEntries(
  ADVENTURER_FAMILIES.map((id) => {
    const [name, title, resource, weakness, gear, color] = TEXT[id];
    const paths = ADVENTURER_PATHS.filter((p) => p.family === id);
    return [
      id,
      {
        id,
        name,
        title,
        color,
        weakness,
        gear,
        blurb: `${title}. Choose a named discipline at level 10; the four core techniques and your path skill all retain opposite quantum forms.`,
        resource: {
          name: resource,
          color,
          desc: 'Earn from real hostile hits or effective party healing/protection. Empty casts do not fill it; it fades outside combat.',
        },
        abilities: [...CORE[id].map((_, i) => `${id}_${i}`), ...paths.map((p) => p.skill)],
        passive: {
          name: 'Field discipline',
          desc:
            id === 'warrior'
              ? 'Take 6% less enemy damage.'
              : id === 'ranged'
                ? 'Deal 10% more beyond five tiles and 8% less within two.'
                : id === 'mage'
                  ? 'Deal 10% more damage; take 8% more.'
                  : id === 'stealth'
                    ? 'Deal 15% more to an enemy targeting someone else; take 5% more damage.'
                    : id === 'support'
                      ? 'Healing is 20% stronger; direct damage is 10% lower.'
                      : 'Every core technique has an offensive and a supportive form.',
        },
        ultimate: {
          name: {
            warrior: 'Last bastion',
            ranged: 'Horizon barrage',
            mage: 'Convergence',
            stealth: 'Nightfall',
            support: 'Dawn chorus',
            hybrid: 'Grand design',
          }[id],
          desc: {
            warrior: 'Level 15 · 100 Valor: nearby party members take 40% less damage for 8 seconds, within six tiles.',
            ranged: 'Level 15 · 100 Focus: eight 19-damage arrows fan across a fourteen-tile sight line.',
            mage: 'Level 15 · 100 Aether: a 61-damage six-tile convergence slows enemies for four seconds; walls block it.',
            stealth: 'Level 15 · 100 Guile: a 67-damage forward strike and five seconds of 30% damage reduction.',
            support:
              'Level 15 · 100 Grace: heal nearby party members for 70 and ward them for six seconds within seven tiles.',
            hybrid: 'Level 15 · 100 Ingenuity: a 28-second clockwork ally and a 55-point shield for seven seconds.',
          }[id],
          secs: 18,
          glyph: '✦',
        },
        specs: paths.map((p) => ({ id: p.id, name: p.name, desc: p.desc, gear: p.gear, skill: p.skill })),
      },
    ];
  }),
) as Record<AdventurerFamily, ClassDef>;
export const isAdventurerFamily = (id: string): id is AdventurerFamily =>
  ADVENTURER_FAMILIES.includes(id as AdventurerFamily);
