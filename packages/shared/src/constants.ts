export const TILE_SIZE = 16;
export const CHUNK_SIZE = 32;
export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;
export const TICK_MS = 1000 / TICK_RATE;

/** highest terrain elevation level (revision-3 worlds have levels 0..MAX_LEVEL) */
export const MAX_LEVEL = 9;
/** a step of this many levels between neighbouring tiles is a cliff: it blocks walking, shots and sight */
export const CLIFF = 2;
/** Range multiplier for a shooter standing on high ground: +5% per level, up to six levels. */
export const highGroundRange = (level: number): number => 1 + 0.05 * Math.min(Math.max(level, 0), 6);
export const PLAYER_SPEED = 4.5; // tiles / s
/** a sloop under sail outruns a walker */
export const BOAT_SPEED_MULT = 1.55;
export const PLAYER_RADIUS = 0.3;
export const DASH_TIME = 0.18;
export const DASH_SPEED = 13;
/** recharge time of ONE dash charge (charges refill one after another) */
export const DASH_COOLDOWN = 4.0;
/** dash charges (Hades-style double dash) */
export const DASH_CHARGES = 2;
/** invulnerability from the start of a dash (a little longer than the dash itself) */
export const IFRAME_TIME = 0.26;
/** a strike that meets the first PERFECT_WINDOW seconds of a dash is a perfect dodge ("phase slip") */
export const PERFECT_WINDOW = 0.16;
/** after a perfect dodge the next attack within this time is a guaranteed critical counter */
export const SLIP_TIME = 1.25;
/** enemies near a perfect dodge run at this fraction of normal speed for SLIP_SLOW_TIME */
export const SLIP_SLOW = 0.35;
export const SLIP_SLOW_TIME = 0.9;
export const SLIP_SLOW_RADIUS = 4.5;

/** legacy: base swing recovery (per-hit recovery lives in COMBO) */
export const ATTACK_COOLDOWN = 0.3;
export const COMBO_WINDOW = 0.7;
/** an attack pressed during recovery / a dash is remembered this long and fires as soon as possible */
export const ATTACK_BUFFER = 0.3;
/** hold attack: charge starts after the opening swing recovers; heavy is ready at CHARGE_MIN, maxed at CHARGE_FULL */
export const CHARGE_MIN = 0.3;
export const CHARGE_FULL = 0.8;
export const CHARGE_MOVE_MULT = 0.5;
/** movement multiplier during the committed part of a swing */
export const SWING_MOVE_MULT = 0.4;
export const SKILL_COOLDOWN = 1.6;
export const PROJECTILE_SPEED = 11;
export const PROJECTILE_RANGE = 9;
export const PROJECTILE_DAMAGE = 12;
export const PROJECTILE_RADIUS = 0.25;

/** Lag compensation: server rewinds targets by at most this many ticks (250 ms). */
export const MAX_REWIND_TICKS = 5;
/** Chunks around a player (Chebyshev radius) that are synced. */
export const INTEREST_RADIUS = 2;

export const DAY_MS = 24 * 60 * 1000;
export const DAYS_PER_SEASON = 7;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

export const BASE_PLAYER_HP = 60;
export const EDIT_REACH = 2.2;
export const NAME_MAX = 16;
