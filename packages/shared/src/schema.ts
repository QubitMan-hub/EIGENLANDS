import { MapSchema, Schema, type, view } from '@colyseus/schema';
import { ShadowState, SpellState } from './schema34';

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
  /** bit0 dashing, bit1 swinging, bit2 dead, bit3 charging, bit4 heavy ready, bit5 phase slip, bit6 i-frames */
  @type('uint8') flags = 0;
  /** last processed input sequence, for reconciliation */
  @type('uint32') ack = 0;
  /** Phase 3: class index (CLASS_INDEX) for nameplates */
  @type('uint8') cls = 0;
  /** Phase 4: party id ('' when not in a party) */
  @type('string') party = '';
  /** Held equipment appearance; appended for schema field compatibility. Empty means unarmed. */
  @type('string') weapon = '';
  /** Selected tool appearance, derived from the actual hotbar slot on the server. */
  @type('string') held = '';
  /** Minecart riding state, appended without renumbering existing fields. */
  @type('boolean') cart = false;
  /** Packed Appearance (see appearance.ts); 0 = never chosen. Appended for schema field compatibility. */
  @type('uint32') app = 0;
  /** Riding: 0 on foot, 1 horse, 2 Moonlit Stag, 3 Glimmerhart. Appended for schema field compatibility. */
  @type('uint8') mount = 0;
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
  // ── combat 2.0
  /** animation state: 0 idle, 1 move, 2 windup, 3 active (leap/charge/cast), 4 recover, 5 stagger */
  @type('uint8') st = 0;
  /** attack being telegraphed (ATK.*), drives the ground decal */
  @type('uint8') atk = 0;
  /** telegraph target point (leap landing, charge end, aim end) */
  @type('float32') tx = 0;
  @type('float32') ty = 0;
  /** poise left 0..100 (armour bar for armoured enemies) */
  @type('uint8') poise = 100;
  /** elite modifier bits (ELITE.*) */
  @type('uint8') elite = 0;
  /** army unit: 0 = ordinary creature, else realm index + 1 */
  @type('uint8') fac = 0;
  /** army unit that defends (friendly to players, cannot be hurt by them) */
  @type('boolean') ally = false;
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
  @type('string') name = '';
  @type('string') farm = '';
  @type('boolean') young = false;
}

export class ProjectileState extends Schema {
  @type('string') id = '';
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('string') owner = '';
  /** 0 player bolt, 1 enemy orb, 2 reflected orb */
  @type('uint8') kind = 0;
}

export class WorldState extends Schema {
  // `@view()` makes each child visible only to clients that add it to their StateView.
  @view() @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @view() @type({ map: EnemyState }) enemies = new MapSchema<EnemyState>();
  @view() @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
  @view() @type({ map: NpcState }) npcs = new MapSchema<NpcState>();
  /** Phase 3: visible ability effects */
  @view() @type({ map: SpellState }) spells = new MapSchema<SpellState>();
  /** Shadow Army: summoned shadows */
  @view() @type({ map: ShadowState }) shadows = new MapSchema<ShadowState>();
  @type('float64') serverTime = 0;
  @type('uint32') tick = 0;
  /** standing army garrisons (world revision 5): soldiers patrolling settlements */
  @view() @type({ map: ShadowState }) army = new MapSchema<ShadowState>();
}

export const WS_LIMITS = { name: 16 };
