/**
 * Classes, abilities and elements for the Circuit Board (Phase 3).
 * Every ability has two forms; which one fires is decided by the ability's orb (qubit) when it is cast.
 * Form B is always the opposite element of form A (four steps around the colour wheel), so a Flip (X) gate
 * literally "flips the ability to its opposite element".
 */

/** Palette indices of the 8 phase colours (same wheel as forging's material phases). */
export const HUE_PALETTE = [35, 36, 38, 13, 47, 27, 43, 45] as const;

export interface ElementDef { id: number; name: string; color: number; rider: string }
export const ELEMENTS: ElementDef[] = [
  { id: 0, name: 'Ember', color: 35, rider: 'Burns for 3 seconds.' },
  { id: 1, name: 'Spark', color: 36, rider: 'Extra damage against night creatures.' },
  { id: 2, name: 'Radiant', color: 38, rider: 'Knocks foes back.' },
  { id: 3, name: 'Verdant', color: 13, rider: 'Heals you for part of the damage.' },
  { id: 4, name: 'Frost', color: 47, rider: 'Slows foes.' },
  { id: 5, name: 'Tide', color: 27, rider: 'Heavy knockback.' },
  { id: 6, name: 'Void', color: 43, rider: 'Pierces armour: extra damage.' },
  { id: 7, name: 'Flux', color: 45, rider: 'Wild: anything from weak to huge.' },
];
export const FLUX = 7;
export const hueWrap = (h: number): number => ((Math.round(h) % 8) + 8) % 8;

export type ClassId = 'wanderer' | 'superposer' | 'entangler';
export const PLAYABLE_CLASSES: ClassId[] = ['superposer', 'entangler'];

export type AbilityId =
  | 'glimmer'
  | 'split_shot' | 'echo_step' | 'wavefront' | 'prob_ward'
  | 'tether' | 'pulse' | 'swap' | 'mend';

export type EffectKind =
  | 'bolt' | 'ring' | 'blink' | 'blink_back' | 'shield' | 'mirror'
  | 'link_enemy' | 'link_ally' | 'pulse_dmg' | 'pulse_heal' | 'pull' | 'swap' | 'heal' | 'ward';

export interface AbilityForm {
  /** short player-facing name, e.g. "Frost twin-shot" */
  name: string;
  hue: number;
  kind: EffectKind;
  dmg?: number;
  heal?: number;
  /** bolts per cast (bolt) */
  count?: number;
  /** degrees between bolts */
  spread?: number;
  /** tiles: ring radius, blink distance, pulse/swap range */
  radius?: number;
  /** tiles: bolt range */
  range?: number;
  /** tiles / s */
  speed?: number;
  /** seconds: shield/ward/echo/slow duration */
  secs?: number;
  /** absorb amount (shield) or damage reduction 0..1 (ward) */
  amount?: number;
  /** slow 0..1 applied on hit */
  slow?: number;
  /** knockback impulse; negative pulls */
  push?: number;
}

export interface AbilityDef {
  id: AbilityId;
  cls: ClassId;
  name: string;
  /** cooldown in seconds */
  cd: number;
  forms: [AbilityForm, AbilityForm];
  /** one friendly line for tooltips */
  desc: string;
  /** glyph for the action bar (no letters needed) */
  glyph: string;
}

const A = (d: AbilityDef): AbilityDef => d;

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  glimmer: A({
    id: 'glimmer', cls: 'wanderer', name: 'Glimmer Bolt', cd: 1.2, glyph: '✦',
    desc: 'A spark of light thrown from your orb.',
    forms: [
      { name: 'Ember bolt', hue: 0, kind: 'bolt', dmg: 14, count: 1, range: 9, speed: 12 },
      { name: 'Frost bolt', hue: 4, kind: 'bolt', dmg: 10, count: 1, range: 9, speed: 12, slow: 0.35, secs: 2 },
    ],
  }),
  split_shot: A({
    id: 'split_shot', cls: 'superposer', name: 'Split Shot', cd: 1.4, glyph: '⟡',
    desc: 'One heavy bolt, or two light ones fanning apart.',
    forms: [
      { name: 'Ember heavy bolt', hue: 0, kind: 'bolt', dmg: 18, count: 1, range: 10, speed: 12 },
      { name: 'Frost twin-shot', hue: 4, kind: 'bolt', dmg: 10, count: 2, spread: 12, range: 9, speed: 13, slow: 0.35, secs: 2 },
    ],
  }),
  echo_step: A({
    id: 'echo_step', cls: 'superposer', name: 'Echo Step', cd: 6, glyph: '⇶',
    desc: 'Blink ahead and leave a shimmering Echo of yourself behind.',
    forms: [
      { name: 'Spark step (Echo stays)', hue: 1, kind: 'blink', radius: 4, secs: 4 },
      { name: 'Tide step (snap back)', hue: 5, kind: 'blink_back', radius: 4, secs: 1.5 },
    ],
  }),
  wavefront: A({
    id: 'wavefront', cls: 'superposer', name: 'Wavefront', cd: 5, glyph: '◎',
    desc: 'A ring of force bursts out from you.',
    forms: [
      { name: 'Radiant push', hue: 2, kind: 'ring', dmg: 14, radius: 2.5, push: 7 },
      { name: 'Void pull', hue: 6, kind: 'ring', dmg: 10, radius: 2.5, push: -5, slow: 0.4, secs: 2 },
    ],
  }),
  prob_ward: A({
    id: 'prob_ward', cls: 'superposer', name: 'Probability Ward', cd: 9, glyph: '⛉',
    desc: 'A shield that might absorb a blow, or might send it back.',
    forms: [
      { name: 'Verdant shield', hue: 3, kind: 'shield', amount: 30, secs: 5 },
      { name: 'Flux mirror', hue: 7, kind: 'mirror', amount: 1.5, secs: 5 },
    ],
  }),
  tether: A({
    id: 'tether', cls: 'entangler', name: 'Tether', cd: 2.5, glyph: '⌇',
    desc: 'Throw a thread that links whatever it touches to you.',
    forms: [
      { name: 'Void tether (foe)', hue: 6, kind: 'link_enemy', dmg: 8, range: 9, speed: 14, secs: 8 },
      { name: 'Radiant tether (friend)', hue: 2, kind: 'link_ally', range: 9, secs: 8 },
    ],
  }),
  pulse: A({
    id: 'pulse', cls: 'entangler', name: 'Pulse', cd: 5, glyph: '⌁',
    desc: 'Send a pulse down every thread at once.',
    forms: [
      { name: 'Spark pulse (hurts foes)', hue: 1, kind: 'pulse_dmg', dmg: 16, radius: 14 },
      { name: 'Tide pulse (heals friends)', hue: 5, kind: 'pulse_heal', heal: 14, radius: 14 },
    ],
  }),
  swap: A({
    id: 'swap', cls: 'entangler', name: 'Swap', cd: 7, glyph: '⇄',
    desc: 'Use a thread to move: pull a foe in, or trade places.',
    forms: [
      { name: 'Flux pull', hue: 7, kind: 'pull', radius: 12 },
      { name: 'Verdant swap', hue: 3, kind: 'swap', radius: 12 },
    ],
  }),
  mend: A({
    id: 'mend', cls: 'entangler', name: 'Mend', cd: 8, glyph: '✚',
    desc: 'Knit yourself back together, or brace for impact.',
    forms: [
      { name: 'Verdant mend', hue: 3, kind: 'heal', heal: 20 },
      { name: 'Flux brace', hue: 7, kind: 'ward', amount: 0.35, secs: 6 },
    ],
  }),
};

export interface SpecDef { id: string; name: string; desc: string }
export interface ClassDef {
  id: ClassId;
  name: string;
  /** one-line pitch */
  title: string;
  blurb: string;
  /** palette index used for nameplates and frames */
  color: number;
  resource: { name: string; color: number; desc: string };
  abilities: AbilityId[];
  passive: { name: string; desc: string };
  ultimate: { name: string; desc: string; secs: number; glyph: string };
  specs: SpecDef[];
}

export const CLASSES: Record<ClassId, ClassDef> = {
  wanderer: {
    id: 'wanderer', name: 'Wanderer', title: 'Not yet attuned', color: 6,
    blurb: 'You carry a single flickering orb. Lumen can teach you to use it.',
    resource: { name: 'Glow', color: 38, desc: 'Wanderers have no resource yet.' },
    abilities: ['glimmer'],
    passive: { name: 'Curious', desc: 'Everything is new.' },
    ultimate: { name: 'None yet', desc: 'Choose a class to unlock an ultimate.', secs: 0, glyph: '·' },
    specs: [],
  },
  superposer: {
    id: 'superposer', name: 'Superposer', title: 'Exists in two places at once', color: 42,
    blurb: 'Fights from two places at once and picks which one was real at the moment a blow lands. Fast, tricky, hard to pin down.',
    resource: { name: 'Coherence', color: 44, desc: 'Builds when you cast split abilities and land hits. Fades when you stop fighting.' },
    abilities: ['split_shot', 'echo_step', 'wavefront', 'prob_ward'],
    passive: { name: 'Two Places at Once', desc: 'While an Echo of you exists, a hit has an even chance to land on the Echo instead. You appear where it was.' },
    ultimate: { name: 'Many Worlds', desc: 'Three Echoes surround you for 6 seconds and repeat every ability you cast.', secs: 6, glyph: '✺' },
    specs: [
      { id: 'phantom', name: 'Phantom', desc: 'Echoes last 2 seconds longer and take hits for you more often.' },
      { id: 'splitter', name: 'Splitter', desc: 'Split Shot fires three bolts, and the heavy bolt hits harder.' },
      { id: 'collapse', name: 'Collapse', desc: 'Locked-in lines hit much harder.' },
    ],
  },
  entangler: {
    id: 'entangler', name: 'Entangler', title: 'What happens to one happens to all', color: 47,
    blurb: 'Links foes and friends with glowing threads. Damage on one foe echoes to every other linked foe; healing spreads between friends.',
    resource: { name: 'Bond', color: 46, desc: 'Builds whenever damage or healing echoes along your threads.' },
    abilities: ['tether', 'pulse', 'swap', 'mend'],
    passive: { name: 'Spooky Action', desc: 'Damage to a linked foe echoes to every other linked foe. Healing on a linked friend echoes to the others.' },
    ultimate: { name: 'Bell State', desc: 'Pairs up every nearby foe for 6 seconds: whatever hits one, hits its partner just as hard.', secs: 6, glyph: '∞' },
    specs: [
      { id: 'weaver', name: 'Weaver', desc: 'Hold five links at once, and echoes are stronger.' },
      { id: 'bondkeeper', name: 'Bondkeeper', desc: 'Healing echoes are stronger and Mend heals your whole nearby party.' },
      { id: 'paradox', name: 'Paradox', desc: 'Swap stuns, and is free right after a Tether lands.' },
    ],
  },
};

export const SPEC_LEVEL = 10;
export const MULTICLASS_LEVEL = 30;
/** Number of ability lines that sit on the action bar; the rest only fire through Links. */
export const ACTIVE_LINES = 4;
export const RESOURCE_MAX = 100;
/** Echo casts through a Link fire at this power. */
export const LINK_POWER = 0.6;
export const LOCK_POWER = 0.25;
export const LOCK_POWER_COLLAPSE = 0.45;

export const isClassId = (v: unknown): v is ClassId => typeof v === 'string' && Object.hasOwn(CLASSES, v);
export const isAbilityId = (v: unknown): v is AbilityId => typeof v === 'string' && Object.hasOwn(ABILITIES, v);

/** Abilities a character may slot: their class's (plus the second class's from level 30). Wanderers also keep Glimmer. */
export function allowedAbilities(cls: ClassId, second: ClassId | null): AbilityId[] {
  const out = new Set<AbilityId>(CLASSES[cls].abilities);
  if (second && second !== cls) for (const a of CLASSES[second].abilities) out.add(a);
  if (cls === 'wanderer') out.add('glimmer');
  return [...out];
}

/** Class index for the synced nameplate byte. */
export const CLASS_INDEX: ClassId[] = ['wanderer', 'superposer', 'entangler'];
