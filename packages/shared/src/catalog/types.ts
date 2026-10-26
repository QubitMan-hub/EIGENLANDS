import type { Bonus } from '../equipment';

/** Where equipment sits beyond the six that existed first (weapon, head, chest, legs, feet, two rings). */
export type GearSlot = 'shield' | 'back' | 'neck' | 'belt' | 'charm' | 'light';
export const GEAR_SLOTS: readonly GearSlot[] = ['shield', 'back', 'neck', 'belt', 'charm', 'light'];
export const GEAR_SLOT_NAMES: Record<GearSlot, string> = {
  shield: 'Shield',
  back: 'Cloak / Pack',
  neck: 'Amulet',
  belt: 'Belt',
  charm: 'Charm',
  light: 'Lantern',
};

/** Stats a piece of gear can add: the combat ones plus survival and crafting. */
export interface GearBonus extends Bonus {
  /** points of warmth resistance (positive resists cold, negative heat is handled by `cool`) */
  warm?: number;
  cool?: number;
  /** fraction less hunger and thirst drain (0.1 = 10%) */
  drain?: number;
  /** light radius in tiles, worn at night and underground */
  light?: number;
  /** percent chance to save an ingredient */
  craft?: number;
  /** extra stamina */
  stamina?: number;
}

export interface GearSpec {
  slot: GearSlot;
  /** player level to wear it */
  level: number;
  bonus: GearBonus;
  /** uses before it breaks */
  dur: number;
  /** the material it is made from, when it has one */
  mat?: string;
}

/** What using an item does besides eating it or drinking it. */
export type ItemUse =
  | { t: 'recipe'; id: string }
  | { t: 'repair'; pct: number; kinds: Array<'weapon' | 'armor' | 'tool' | 'gear'>; tier: number }
  | { t: 'rune'; key: string }
  | { t: 'whetstone'; atk: number; secs: number }
  | { t: 'reveal' };

/** The runes and gems that can be set into gear at an enchanting table. */
export interface EnchantDef {
  key: string;
  name: string;
  bonus: GearBonus;
  /** minimum gear rarity to take it (0 = anything) */
  minRarity: number;
}

/** How an item enters the world, so every item can be traced to a source (the catalog test walks these). */
export type Source =
  | { k: 'node'; tile: number; chance: number; min: number; max: number; tier: number; realm?: string; cave?: string }
  | { k: 'mob'; family: string; chance: number; min: number; max: number; minLevel?: number; realm?: string }
  | { k: 'forage'; seasons: number[]; realm?: string; weight: number }
  | { k: 'fish'; water: 'shallow' | 'deep' | 'any'; ocean?: boolean }
  | { k: 'shop'; realm?: string; role: string; markup: number }
  | { k: 'vault'; table: string; weight: number }
  | { k: 'animal'; kind: string }
  | { k: 'crop' }
  | { k: 'boss'; boss: string; chance: number }
  | { k: 'quest' };
