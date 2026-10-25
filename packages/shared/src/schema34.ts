import { Schema, type } from '@colyseus/schema';

/** Spell kinds synced to clients (Phase 3 abilities). */
export const SPELL = {
  BOLT: 0,
  RING: 1,
  ECHO: 2,
  TETHER: 3,
  SHIELD: 4,
  WARD: 5,
  MIRROR: 6,
  BLINK: 7,
  RESIDUE: 8,
} as const;

/** A visible ability effect: bolts, rings, Echoes, tethers, shields. Interest-managed like other entities. */
export class SpellState extends Schema {
  @type('string') id = '';
  @type('uint8') kind = 0;
  @type('float32') x = 0;
  @type('float32') y = 0;
  /** element (0..7, see ELEMENTS) */
  @type('uint8') hue = 0;
  /** caster session id */
  @type('string') owner = '';
  /** tether end: an entity id (enemy or player session id) */
  @type('string') target = '';
  /** ring radius / shield size (tiles) */
  @type('float32') r = 0;
  /** direction (bolts) */
  @type('float32') dx = 0;
  @type('float32') dy = 0;
}

/**
 * A summoned shadow (Shadow Army). Mirrors EnemyState so the client can animate it with the same wildlife/foe art;
 * `owner` is the session id of the summoner.
 */
export class ShadowState extends Schema {
  @type('string') id = '';
  @type('string') owner = '';
  @type('string') name = '';
  /** enemy kind index the shadow was extracted from */
  @type('uint8') kind = 0;
  @type('uint8') rank = 0;
  @type('uint8') level = 1;
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') faceX = 0;
  @type('float32') faceY = 1;
  @type('int16') hp = 0;
  @type('int16') maxHp = 0;
  /** animation state like EnemyState.st: 0 idle, 1 move, 2 windup, 3 active, 4 recover, 5 stagger, 6 down */
  @type('uint8') st = 0;
  @type('uint8') tele = 0;
  @type('uint8') atk = 0;
  @type('float32') tx = 0;
  @type('float32') ty = 0;
  /** Append fields to preserve existing wire field indices. */
  @type('boolean') bonded = false;
}
