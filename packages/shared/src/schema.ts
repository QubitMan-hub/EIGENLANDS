import { MapSchema, Schema, type, view } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') faceX = 0;
  @type('float32') faceY = 1;
  @type('int16') hp = 0;
  @type('int16') maxHp = 0;
  @type('uint16') level = 1;
  @type('uint32') xp = 0;
  /** outfit index (wardrobe) */
  @type('uint8') look = 0;
  /** bit0 dashing, bit1 swinging, bit2 dead */
  @type('uint8') flags = 0;
  /** last processed input sequence, for reconciliation */
  @type('uint32') ack = 0;
}

export class EnemyState extends Schema {
  @type('string') id = '';
  @type('uint8') kind = 0;
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') faceX = 0;
  @type('float32') faceY = 1;
  @type('int16') hp = 0;
  @type('int16') maxHp = 0;
  /** telegraph progress 0..100 (0 = not winding up) */
  @type('uint8') tele = 0;
  @type('boolean') night = false;
}

/** Village NPCs: public, synced to everyone in range. */
export class NpcState extends Schema {
  @type('string') id = '';
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') faceX = 0;
  @type('float32') faceY = 1;
  @type('uint8') look = 0;
  /** bit0 walking, bit1 inside a building (hidden), bit2 talking */
  @type('uint8') flags = 0;
}

export class ProjectileState extends Schema {
  @type('string') id = '';
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('string') owner = '';
}

export class WorldState extends Schema {
  // `@view()` makes each child visible only to clients that add it to their StateView.
  @view() @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @view() @type({ map: EnemyState }) enemies = new MapSchema<EnemyState>();
  @view() @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
  @view() @type({ map: NpcState }) npcs = new MapSchema<NpcState>();
  @type('float64') serverTime = 0;
  @type('uint32') tick = 0;
}

export const WS_LIMITS = { name: 16 };
