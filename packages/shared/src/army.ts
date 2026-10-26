import type { DropDef, EnemyDef } from './combat';
import { REALM_IDS, type RealmId } from './realms';

/**
 * The standing armies of the six kingdoms (world revision 5): four field classes per realm, drawn as real units in
 * the world. Mythical units are the realm beasts (griffin, spirit stag, iron golem, raiju, reef naga, hellhound).
 * Units are ordinary enemy kinds 50..73; whether one is hostile to players or a defender is a per-instance flag.
 */
export const ARMY_CLASSES = ['infantry', 'ranged', 'cavalry', 'elite'] as const;
export type ArmyClass = (typeof ARMY_CLASSES)[number];
export type ArmyKey = `${RealmId}_${ArmyClass}`;
export const ARMY_KIND_BASE = 50;
export const armyKind = (realm: RealmId, cls: ArmyClass): number =>
  ARMY_KIND_BASE + REALM_IDS.indexOf(realm) * ARMY_CLASSES.length + ARMY_CLASSES.indexOf(cls);
export const armyKey = (realm: RealmId, cls: ArmyClass): ArmyKey => `${realm}_${cls}`;
/** realm and class of an enemy kind number, or null when the kind is not an army unit */
export function armyOfKind(kind: number): { realm: RealmId; cls: ArmyClass } | null {
  const i = kind - ARMY_KIND_BASE;
  if (i < 0 || i >= REALM_IDS.length * ARMY_CLASSES.length) return null;
  return { realm: REALM_IDS[Math.floor(i / ARMY_CLASSES.length)]!, cls: ARMY_CLASSES[i % ARMY_CLASSES.length]! };
}

/** Unit names from each kingdom's lore, by class. */
export const ARMY_NAMES: Record<RealmId, Record<ArmyClass, string>> = {
  aurelion: { infantry: 'Shield-Pike', ranged: 'Longbow Warden', cavalry: 'Charger Lancer', elite: 'Gilded Knight' },
  sylvaris: {
    infantry: 'Forest Guardian',
    ranged: 'Thornbow Archer',
    cavalry: 'Spirit Rider',
    elite: 'Druid of the Rings',
  },
  khardum: { infantry: 'Ironguard', ranged: 'Crossbow Engineer', cavalry: 'Ram Rider', elite: 'Runic Warrior' },
  raijin: { infantry: 'Ashigaru Spearman', ranged: 'Yumi Archer', cavalry: 'Yabusame Rider', elite: 'Samurai' },
  thalassara: { infantry: 'Merfolk Spearman', ranged: 'Reef Siren', cavalry: 'Tide Rider', elite: 'Sea Knight' },
  nethrakar: { infantry: 'Ogre Soldier', ranged: 'Ember Gunner', cavalry: 'Hellhound Rider', elite: 'Demon Knight' },
};

const LOOT: Record<RealmId, DropDef> = {
  aurelion: { item: 'gold_ore', min: 1, max: 1, chance: 0.12 },
  sylvaris: { item: 'healing_herb', min: 1, max: 3, chance: 0.5 },
  khardum: { item: 'iron_ore', min: 1, max: 3, chance: 0.5 },
  raijin: { item: 'silver_ore', min: 1, max: 1, chance: 0.2 },
  thalassara: { item: 'doubloon', min: 1, max: 3, chance: 0.5 },
  nethrakar: { item: 'coal', min: 1, max: 3, chance: 0.5 },
};

const BASE: Record<ArmyClass, Omit<EnemyDef, 'kind' | 'name' | 'drops'>> = {
  infantry: {
    hp: 85,
    speed: 2.5,
    radius: 0.45,
    damage: 9,
    sight: 10,
    windup: 0.55,
    strikeRange: 1.7,
    xp: 28,
    ai: 'melee',
    poise: 22,
    staggerTime: 0.8,
    cooldown: 0.9,
    budget: 1.5,
  },
  ranged: {
    hp: 55,
    speed: 2.7,
    radius: 0.4,
    damage: 8,
    sight: 13,
    windup: 0.8,
    strikeRange: 9,
    xp: 30,
    ai: 'harrier',
    poise: 10,
    staggerTime: 0.8,
    cooldown: 2.0,
    budget: 1.5,
  },
  cavalry: {
    hp: 130,
    speed: 4.2,
    radius: 0.62,
    damage: 13,
    sight: 12,
    windup: 0.7,
    strikeRange: 6,
    xp: 55,
    ai: 'boar',
    poise: 34,
    staggerTime: 1.0,
    cooldown: 2.2,
    budget: 3,
  },
  elite: {
    hp: 200,
    speed: 2.3,
    radius: 0.55,
    damage: 17,
    sight: 10,
    windup: 0.85,
    strikeRange: 2.2,
    xp: 90,
    ai: 'brute',
    armor: true,
    poise: 50,
    staggerTime: 1.4,
    cooldown: 2.4,
    aoe: 1.0,
    budget: 4,
  },
};

export const ARMY_DEFS = Object.fromEntries(
  REALM_IDS.flatMap((realm) =>
    ARMY_CLASSES.map((cls) => [
      armyKey(realm, cls),
      {
        ...BASE[cls],
        kind: armyKind(realm, cls),
        name: ARMY_NAMES[realm][cls],
        drops: [LOOT[realm], ...(cls === 'elite' ? [{ item: 'qubit_crystal', min: 1, max: 1, chance: 0.25 }] : [])],
      } satisfies EnemyDef,
    ]),
  ),
) as Record<ArmyKey, EnemyDef>;
