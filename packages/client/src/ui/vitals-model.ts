/**
 * Pure model for the vitals HUD: smoothed gauge motion, need thresholds and the expandable status registry.
 * Nothing here touches the DOM or the canvas, so the behaviour is unit-tested.
 */

export type GaugeId = 'health' | 'mana' | 'stamina' | 'food' | 'water';

/** Seconds the pale "damage trail" waits before draining, and how fast fill and trail then move (fraction/second). */
export const TRAIL_HOLD = 0.42;
export const TRAIL_DRAIN = 1.1;
export const RECOVER_RATE = 0.9;
export const FLASH_TIME = 0.28;

/**
 * One gauge. Damage lands instantly on the fill; a pale trail marks what was just lost and drains after a short hold;
 * recovery eases the fill upward so healing is visible. Reduced motion snaps everything.
 */
export class GaugeMotion {
  /** fill fraction currently drawn */
  shown = 1;
  /** pale trail ≥ shown */
  trail = 1;
  /** 0..1, white flash right after a hit */
  flash = 0;
  /** 0..1, glint while recovering */
  gain = 0;
  private hold = 0;
  private primed = false;

  /** Advance by dt seconds toward `target` (0..1). Returns true while anything is still moving. */
  step(dt: number, target: number, reduced: boolean): boolean {
    const t = Math.max(0, Math.min(1, Number.isFinite(target) ? target : 0));
    if (!this.primed || reduced) {
      this.primed = true;
      this.shown = this.trail = t;
      this.flash = this.gain = this.hold = 0;
      return false;
    }
    if (t < this.shown - 0.004) {
      this.flash = t < this.shown - 0.02 ? 1 : this.flash;
      this.hold = TRAIL_HOLD;
      this.shown = t;
    } else if (t > this.shown) {
      this.shown = Math.min(t, this.shown + Math.max(RECOVER_RATE * dt, (t - this.shown) * 6 * dt));
      this.gain = 1;
      if (this.trail < this.shown) this.trail = this.shown;
    } else this.gain = Math.max(0, this.gain - dt * 3);
    if (this.trail > this.shown) {
      this.hold = Math.max(0, this.hold - dt);
      if (this.hold === 0) this.trail = Math.max(this.shown, this.trail - TRAIL_DRAIN * dt);
    }
    this.flash = Math.max(0, this.flash - dt / FLASH_TIME);
    if (this.shown >= t) this.gain = Math.max(0, this.gain - dt * 2.5);
    return this.trail > this.shown || this.flash > 0 || this.gain > 0 || this.shown !== t;
  }
}

export type NeedTone = 'ok' | 'low' | 'empty';
/** Food and water: calm until 20, warn at or below 20, "empty" at 0. Same threshold the old meters used. */
export const NEED_LOW = 20;
export function needTone(v: number): NeedTone {
  return v <= 0 ? 'empty' : v <= NEED_LOW ? 'low' : 'ok';
}

export const LOW_HEALTH = 0.3;
export const lowHealth = (hp: number, max: number): boolean => hp > 0 && max > 0 && hp / max < LOW_HEALTH;

// ───────────── statuses ─────────────

export type StatusTone = 'buff' | 'debuff' | 'aura' | 'need';
export interface StatusDef {
  label: string;
  tone: StatusTone;
  /** pixel icon name (ui/icons.ts) */
  icon: string;
  /** one line shown in the expanded list */
  desc: (power: number) => string;
}

const pct = (p: number) => `${Math.round(p * 100)}%`;
/**
 * Everything the HUD knows how to name. Server buff kinds map onto these by id. Temperature and injury entries are
 * registered but only appear once the server actually reports such a condition (as a buff of that kind): the HUD never
 * invents survival state that the game does not simulate.
 */
export const STATUS_DEFS: Record<string, StatusDef> = {
  regen: {
    label: 'Regeneration',
    tone: 'buff',
    icon: 'st_regen',
    desc: (p) => `Restores health over time (+${p}/tick).`,
  },
  might: { label: 'Might', tone: 'buff', icon: 'st_might', desc: (p) => `Your strikes hit ${pct(p)} harder.` },
  ward: { label: 'Ward', tone: 'buff', icon: 'st_ward', desc: (p) => `Incoming damage reduced by ${pct(p)}.` },
  lantern: { label: 'Lantern light', tone: 'buff', icon: 'st_lantern', desc: () => 'Your light radius is wider.' },
  aura_shield: {
    label: 'Shield',
    tone: 'aura',
    icon: 'st_shield',
    desc: () => 'A circuit shield absorbs damage until it breaks.',
  },
  aura_ward: { label: 'Ward field', tone: 'aura', icon: 'st_ward', desc: () => 'A circuit ward cuts incoming damage.' },
  aura_mirror: {
    label: 'Mirror',
    tone: 'aura',
    icon: 'st_mirror',
    desc: () => 'Reflects the next strikes back at the attacker.',
  },
  hungry: { label: 'Hungry', tone: 'need', icon: 'st_food', desc: () => 'Food is low. Eat something soon.' },
  starving: { label: 'Out of food', tone: 'need', icon: 'st_food', desc: () => 'Food is empty. Eat to refill it.' },
  parched: { label: 'Thirsty', tone: 'need', icon: 'st_drop', desc: () => 'Water is low. Fill a skin at a well.' },
  dehydrated: {
    label: 'Out of water',
    tone: 'need',
    icon: 'st_drop',
    desc: () => 'Water is empty. Fill a skin at a well.',
  },
  // reserved: shown only when the server reports them (survival systems, master plan §8)
  chill: { label: 'Chilled', tone: 'debuff', icon: 'st_chill', desc: () => 'Cold slows you down.' },
  heat: { label: 'Overheated', tone: 'debuff', icon: 'st_heat', desc: () => 'Heat drains stamina faster.' },
  bleed: { label: 'Bleeding', tone: 'debuff', icon: 'st_bleed', desc: () => 'Losing health until bandaged.' },
  fracture: { label: 'Fracture', tone: 'debuff', icon: 'st_crack', desc: () => 'Movement is hampered until healed.' },
  poison: { label: 'Poisoned', tone: 'debuff', icon: 'st_poison', desc: () => 'Poison drains health over time.' },
};

export interface StatusEntry {
  id: string;
  label: string;
  tone: StatusTone;
  icon: string;
  /** seconds remaining, or null for effects without a known timer */
  left: number | null;
  desc: string;
}

export interface StatusInput {
  /** server buffs: kind -> {until (server ms), power} */
  buffs: Record<string, { until: number; power: number }>;
  serverNow: number;
  /** circuit auras currently on the player */
  auras: ReadonlyArray<'shield' | 'ward' | 'mirror'>;
  /** food/water 0..100 when Adventure needs are on, otherwise null */
  needs: { food: number; water: number } | null;
}

const TONE_ORDER: Record<StatusTone, number> = { debuff: 0, need: 1, aura: 2, buff: 3 };

/** Build the ordered status list: afflictions first, then needs, auras and boons; timers shortest first. */
export function collectStatuses(input: StatusInput): StatusEntry[] {
  const out: StatusEntry[] = [];
  const push = (id: string, left: number | null, power = 0) => {
    const def = STATUS_DEFS[id];
    out.push({
      id,
      label: def?.label ?? id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      tone: def?.tone ?? 'buff',
      icon: def?.icon ?? 'hex',
      left,
      desc: def?.desc(power) ?? 'An active effect.',
    });
  };
  for (const [id, b] of Object.entries(input.buffs)) {
    const left = (b.until - input.serverNow) / 1000;
    if (left > 0) push(id, left, b.power);
  }
  for (const a of input.auras) push(`aura_${a}`, null);
  if (input.needs) {
    const f = needTone(input.needs.food),
      w = needTone(input.needs.water);
    if (f !== 'ok') push(f === 'empty' ? 'starving' : 'hungry', null);
    if (w !== 'ok') push(w === 'empty' ? 'dehydrated' : 'parched', null);
  }
  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || (a.left ?? Infinity) - (b.left ?? Infinity));
}

/** "45s", "3m", "1h" — short enough to sit next to an icon. */
export function formatLeft(seconds: number | null): string {
  if (seconds === null) return '';
  const s = Math.ceil(seconds);
  return s < 100 ? `${s}s` : s < 5400 ? `${Math.ceil(s / 60)}m` : `${Math.ceil(s / 3600)}h`;
}

/** How many chips fit before the rest fold into a "+n" chip. */
export const CHIPS_SHOWN = 4;
export function splitChips(list: StatusEntry[], expanded: boolean): { shown: StatusEntry[]; more: number } {
  return expanded || list.length <= CHIPS_SHOWN
    ? { shown: list, more: 0 }
    : { shown: list.slice(0, CHIPS_SHOWN - 1), more: list.length - (CHIPS_SHOWN - 1) };
}

// ───────────── stamina ─────────────

/** Dash charges as a smooth fraction: whole charges plus the recharging one's progress. */
export function staminaFraction(charges: number, cooldownLeft: number, cooldownTotal: number, max: number): number {
  if (max <= 0) return 0;
  if (charges >= max) return 1;
  const part = cooldownTotal > 0 ? Math.max(0, Math.min(1, 1 - cooldownLeft / cooldownTotal)) : 0;
  return Math.max(0, Math.min(1, (charges + part) / max));
}
