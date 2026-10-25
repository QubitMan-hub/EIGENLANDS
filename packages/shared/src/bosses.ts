/**
 * Boss encounters, Terraria style: each boss is called with a crafted summoning item, and what it drops is the
 * ingredient for the next boss's item, so they form a chain. Player level scales their health and damage.
 */
export type BossId = 'slime_king' | 'warden' | 'colossus' | 'bellkeeper' | 'veyr';
export interface BossDef {
  id: BossId;
  name: string;
  /** enemy kind (ENEMY_DEFS) */
  kind: number;
  /** summoning item id */
  item: string;
  /** minimum player level to summon */
  level: number;
  /** tiles from the town / spawn shrine the item refuses to work (so villages stay safe) */
  townGap: number;
  /** hp fractions at which a new phase starts */
  phases: number[];
  intro: string;
  /** what it teaches/drops, for the journal */
  loot: string;
}
export const BOSSES: Record<BossId, BossDef> = {
  veyr: {
    id: 'veyr',
    name: 'Veyr, the Stormbound Colossus',
    kind: 33,
    item: 'storm_beacon',
    level: 22,
    townGap: 45,
    phases: [0.65, 0.3],
    intro: 'The crystal veins answer the beacon. Thunder wakes an ancient sentinel.',
    loot: 'Storm Heart, Heart Crystal, Qubit Crystals and gold. Craft a Storm Beacon and use it on open surface ground far from settlements.',
  },
  bellkeeper: {
    id: 'bellkeeper',
    name: 'The Hollow Bellkeeper',
    kind: 32,
    item: 'deep_sigil',
    level: 12,
    townGap: 30,
    phases: [0.66, 0.33],
    intro: 'A bell sounds beneath the stone. Its keeper remembers your footsteps.',
    loot: 'Heart Crystal, Qubit Crystals and gold. Bring a Deep Sigil to a surveyed cave arena.',
  },
  slime_king: {
    id: 'slime_king',
    name: 'Gelatinous Sovereign',
    kind: 10,
    item: 'slime_crown',
    level: 10,
    townGap: 30,
    phases: [0.66, 0.33],
    intro: 'The ground ripples. Something enormous and wobbling answers the crown.',
    loot: 'Slime Core, Heart Crystal. The core calls the Warden.',
  },
  warden: {
    id: 'warden',
    name: 'Warden of the Grove',
    kind: 11,
    item: 'warden_horn',
    level: 18,
    townGap: 30,
    phases: [0.5],
    intro: 'The forest goes silent. Antlers rise between the trees.',
    loot: 'Warden Heart, Heart Crystal, fangs and tusks. The heart wakes the Colossus.',
  },
  colossus: {
    id: 'colossus',
    name: 'Decoherent Colossus',
    kind: 12,
    item: 'colossus_core',
    level: 28,
    townGap: 30,
    phases: [0.66, 0.33],
    intro: 'Reality stutters. A shape that is in too many places at once steps into one.',
    loot: 'Void Core, Heart Crystals, Qubit Crystals.',
  },
};
export const BOSS_BY_KIND: Record<number, BossDef> = Object.fromEntries(Object.values(BOSSES).map((b) => [b.kind, b]));
export const BOSS_BY_ITEM: Record<string, BossDef> = Object.fromEntries(Object.values(BOSSES).map((b) => [b.item, b]));

export type BossEvent =
  | { kind: 'start'; boss: BossId; name: string; intro: string }
  | { kind: 'phase'; boss: BossId; phase: number; text: string }
  | { kind: 'defeated'; boss: BossId; name: string; first: boolean };

/** Max hearts a character can hold (each is +10 max health). */
export const HEARTS_MAX = 20;
