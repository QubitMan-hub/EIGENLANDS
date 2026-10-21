export const TILE_SIZE = 16;
export const CHUNK_SIZE = 32;
export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;
export const TICK_MS = 1000 / TICK_RATE;

export const PLAYER_SPEED = 4.5; // tiles / s
export const PLAYER_RADIUS = 0.3;
export const DASH_TIME = 0.18;
export const DASH_SPEED = 13;
export const DASH_COOLDOWN = 0.9;

export const ATTACK_COOLDOWN = 0.3;
export const COMBO_WINDOW = 0.65;
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
