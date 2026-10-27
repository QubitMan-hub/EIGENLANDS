/**
 * Seafaring: the Sloop Charter turns the player into a ship (water is open, land is solid, cannons replace melee),
 * and the open sea beyond the home continent is patrolled by Corsair sloops and Brine Serpents. The movement itself
 * lives in the shared sim (`PlayerSim.boat`) so prediction stays exact. See docs/design/seafaring.md.
 */
import { MSG34, SEA_START, T, TILE_DEFS, countItem, newPlayerSim, chunkOf, type SeaEvent } from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import type { Module, Registrar } from '../types';

const REACH = 2.6;
const SPAWN_EVERY = 5;
const SEA_BUDGET = 4;

export class SailingModule implements Module {
  private t = 0;
  private next = 0;

  constructor(private room: GameRoom) {}

  install(reg: Registrar): void {
    reg.on<Record<string, never>>(MSG34.BOARD, 'board', (p) => this.toggle(p));
  }

  private say(p: ServerPlayer, e: SeaEvent): void {
    p.client.send(MSG34.SEA_EV, e);
  }

  private isWater(x: number, y: number): boolean {
    const t = this.room.store.getTile(Math.floor(x), Math.floor(y));
    return (t === T.WATER || t === T.DEEP_WATER) && !this.room.store.solidAt.sea!(Math.floor(x), Math.floor(y));
  }

  /** Board at the water's edge, or step ashore. Needs the Sloop Charter in the pack. */
  toggle(p: ServerPlayer): void {
    if (p.deadT > 0) return;
    if (p.sim.boat) {
      this.disembark(p);
      return;
    }
    if (countItem(p.data.inv, 'sloop') < 1) {
      p.toast('You need a Sloop Charter. (Craft one at a workbench.)', 'bad');
      return;
    }
    let best: { x: number; y: number; d: number } | null = null;
    const R = Math.ceil(REACH);
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const tx = Math.floor(p.sim.x) + dx,
          ty = Math.floor(p.sim.y) + dy;
        if (!this.isWater(tx + 0.5, ty + 0.5)) continue;
        // the hull needs a little sea room, not a puddle
        let room = 0;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) if (this.isWater(tx + ox + 0.5, ty + oy + 0.5)) room++;
        if (room < 6) continue;
        const d = Math.hypot(tx + 0.5 - p.sim.x, ty + 0.5 - p.sim.y);
        if (d <= REACH && (!best || d < best.d)) best = { x: tx + 0.5, y: ty + 0.5, d };
      }
    if (!best) {
      p.toast('There is no open water within reach.', 'bad');
      return;
    }
    p.sim.x = best.x;
    p.sim.y = best.y;
    p.sim.boat = 1;
    p.sim.dashT = 0;
    p.sim.charge = 0;
    p.toast('You cast off. Attack fires the cannons; use the charter again at a shore to step off.', 'good');
    this.say(p, { kind: 'board' });
  }

  private disembark(p: ServerPlayer): void {
    const st = this.room.store;
    let best: { x: number; y: number; d: number } | null = null;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const tx = Math.floor(p.sim.x) + dx,
          ty = Math.floor(p.sim.y) + dy;
        const t = st.getTile(tx, ty);
        if (st.solidAt(tx, ty) || TILE_DEFS[t]?.solid || t === T.TORCH) continue;
        const d = Math.hypot(tx + 0.5 - p.sim.x, ty + 0.5 - p.sim.y);
        if (d <= 4 && (!best || d < best.d)) best = { x: tx + 0.5, y: ty + 0.5, d };
      }
    if (!best) {
      p.toast('There is no shore to step onto here.', 'bad');
      return;
    }
    p.sim.x = best.x;
    p.sim.y = best.y;
    p.sim.boat = 0;
    this.say(p, { kind: 'land' });
  }

  async join(p: ServerPlayer): Promise<void> {
    // a player saved mid-voyage reappears at the spawn shrine, never inside the sea
    await this.room.ensureChunk(chunkOf(Math.floor(p.sim.x)), chunkOf(Math.floor(p.sim.y)));
    const t = this.room.store.getTile(Math.floor(p.sim.x), Math.floor(p.sim.y));
    if (t === T.WATER || t === T.DEEP_WATER) {
      if (countItem(p.data.inv, 'sloop') > 0) p.sim.boat = 1;
      else {
        const s = newPlayerSim(0.5, 0.5);
        p.sim.x = s.x;
        p.sim.y = s.y;
      }
    }
  }

  tick(_now: number, dt: number): void {
    this.t += dt;
    if (this.t < this.next) return;
    this.next = this.t + SPAWN_EVERY;
    for (const p of this.room.players.values()) {
      if (p.deadT > 0 || !p.sim.boat) continue;
      if (Math.hypot(p.sim.x, p.sim.y) < SEA_START * 0.8) continue; // the home waters are safe
      let used = 0;
      for (const e of this.room.enemies.values())
        if (e.def.sea && Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 40) used += e.def.budget ?? 1;
      if (used >= SEA_BUDGET) continue;
      for (let tries = 0; tries < 8; tries++) {
        const a = this.room.rand() * Math.PI * 2,
          d = 17 + this.room.rand() * 8;
        const x = Math.floor(p.sim.x + Math.cos(a) * d),
          y = Math.floor(p.sim.y + Math.sin(a) * d);
        let open = 0;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) if (this.isWater(x + ox + 0.5, y + oy + 0.5)) open++;
        if (open < 9) continue;
        const deep = this.room.store.getTile(x, y) === T.DEEP_WATER;
        const kind =
          deep && p.level >= 12 && this.room.rand() < 0.12
            ? 'siren'
            : deep && p.level >= 8 && this.room.rand() < 0.3
              ? 'serpent'
              : 'pirate';
        this.room.spawnEnemy(kind, x + 0.5, y + 0.5, false, { level: Math.max(2, p.level) });
        break;
      }
    }
  }
}
