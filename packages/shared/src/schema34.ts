import { Schema, type } from '@colyseus/schema';

/** Spell kinds synced to clients (Phase 3 abilities). */
export const SPELL = { BOLT: 0, RING: 1, ECHO: 2, TETHER: 3, SHIELD: 4, WARD: 5, MIRROR: 6, BLINK: 7 } as const;

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
