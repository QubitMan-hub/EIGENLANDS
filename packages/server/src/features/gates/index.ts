/**
 * Dungeon gates (shared/src/gates.ts) on the server.
 *
 *  - In the wilds: from dawn to dusk each day's gates stand as portals near whoever is about. Step into one and, if
 *    you are strong enough for its rank, you are inside its dungeon.
 *  - Inside: each room wakes its pack as you walk in; a side chamber pays a cache of mana stones once it is cleared;
 *    the last hall holds the gate's master. Bring the master down and everyone inside is paid, and the gate closes.
 *    The portal by the entry takes you back to where you came in.
 *  - At dusk a gate nobody closed breaks: if a hunter is near, its monsters and a lesser copy of its master spill
 *    out around it, and anyone still inside is thrown back into the world.
 *
 * Nothing here is saved: a gate lasts a day, and what is going on inside it lasts as long as the room does.
 */
import {
  CHUNK_SIZE,
  ELITE,
  GATE_BREAK_HOUR,
  GATE_OPEN_HOUR,
  GATE_RANKS,
  GATE_RANK_INFO,
  SPELL,
  SpellState,
  gateEntry,
  gateExit,
  gateLayout,
  gateRoomAt,
  gateSlotAt,
  gatesNear,
  isCaveY,
  isCryptY,
  isDiveY,
  isGateY,
  isOtherworldY,
  isSolid,
  isUpperY,
  sanctuaryAt,
  townAt,
  GATE_OY,
  ENEMY_DEFS,
  type EnemyKindName,
  type Gate,
} from '@eigenlands/shared';
import type { Enemy } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { giveStacks } from '../../systems/helpers';
import type { Carry, Module, Registrar } from '../types';

/** how near a hunter must be for a day's gate to stand, and to be seen */
const SHOW_RANGE = 70;
const HIDE_RANGE = 100;
/** stepping into a portal */
const STEP_IN = 1.1;
/** a gate breaking at dusk needs someone to see it */
const BREAK_RANGE = 60;

interface Open {
  gate: Gate;
  st: SpellState | null;
  state: 'open' | 'cleared' | 'broken';
}
interface Instance {
  gate: Gate;
  /** rooms whose monsters have woken */
  woke: Set<number>;
  master: string | null;
  cleared: boolean;
  /** side chambers: the monsters still standing in each, and the chambers already paid out */
  side: Map<number, Set<string>>;
  paid: Set<number>;
  exit: SpellState;
}

const outdoors = (y: number) => !isCaveY(y) && !isUpperY(y) && !isDiveY(y) && !isCryptY(y) && !isOtherworldY(y);
const rankName = (r: number) => `${GATE_RANKS[r]}-rank`;

export class GateModule implements Module {
  private t = 0;
  private next = 0;
  private open = new Map<string, Open>();
  /** dungeon instances, by slot (one gate per slot per day) */
  private inst = new Map<number, Instance>();
  /** where each hunter stepped in from, to be set down again, and the gate they went through */
  private back = new Map<string, { x: number; y: number }>();
  private trip = new Map<string, Gate>();
  /** gates closed in a dungeon run by another room, and who is carrying the news back */
  private closed = new Set<string>();
  private news = new Map<string, string>();
  private warned = new Map<string, number>();
  private moving = new Set<string>();
  private seq = 0;

  constructor(private room: GameRoom) {}

  install(_reg: Registrar): void {}

  leave(p: ServerPlayer): void {
    this.warned.delete(p.id);
    this.moving.delete(p.id);
    this.back.delete(p.id);
    this.trip.delete(p.id);
    this.news.delete(p.id);
  }

  /** A dungeon is run by the shard its region belongs to, the wilds by theirs: the trip travels with the hunter. */
  carry(p: ServerPlayer, into: Carry): void {
    const trip = this.trip.get(p.id),
      back = this.back.get(p.id),
      cleared = this.news.get(p.id);
    if (trip || back || cleared)
      into.gate = { ...(trip ? { trip } : {}), ...(back ? { back } : {}), ...(cleared ? { cleared } : {}) };
  }

  join(p: ServerPlayer, carry: Carry | null): void {
    const g = carry?.gate;
    if (!g) return;
    if (g.trip) this.trip.set(p.id, g.trip);
    if (g.back) this.back.set(p.id, g.back);
    if (g.cleared) {
      this.closed.add(g.cleared);
      const o = this.open.get(g.cleared);
      if (o) {
        o.state = 'cleared';
        this.hide(o);
      }
    }
  }

  private active(): boolean {
    return this.room.store.generation >= 6;
  }

  tick(_now: number, dt: number): void {
    if (!this.active()) return;
    this.t += dt;
    if (this.t < this.next) return;
    this.next = this.t + 0.25;
    const day = this.room.wclock.day(),
      hour = this.room.wclock.hour();
    const lit = hour >= GATE_OPEN_HOUR && hour < GATE_BREAK_HOUR;
    this.dusk(day, hour);
    for (const p of this.room.players.values()) {
      if (p.deadT > 0 || this.moving.has(p.id)) continue;
      if (isGateY(p.sim.y)) this.inside(p, day);
      else if (lit && outdoors(p.sim.y)) this.wilds(p, day);
    }
    // gates nobody is near fade from view (they are still there when someone comes back)
    for (const o of this.open.values())
      if (o.st && (o.state !== 'open' || !this.someoneWithin(o.gate.x, o.gate.y, HIDE_RANGE))) this.hide(o);
  }

  // ───────────────────────── in the wilds ─────────────────────────

  private wilds(p: ServerPlayer, day: number): void {
    const store = this.room.store;
    const clear = (x: number, y: number) =>
      this.room.owns(x, y) &&
      store.has(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE)) &&
      !isSolid(store.getTile(x, y)) &&
      !store.objectAt(x, y) &&
      !store.structureAt(x, y) &&
      !townAt(this.room.seed, x, y) &&
      !sanctuaryAt(this.room.seed, x, y);
    const x0 = p.sim.x - SHOW_RANGE,
      y0 = p.sim.y - SHOW_RANGE;
    for (const g of gatesNear(this.room.seed, day, x0, y0, p.sim.x + SHOW_RANGE, p.sim.y + SHOW_RANGE, clear)) {
      // the first place a gate is found is where it stays all day
      const o: Open = this.open.get(g.id) ?? { gate: g, st: null, state: this.closed.has(g.id) ? 'cleared' : 'open' };
      this.open.set(g.id, o);
      if (o.state === 'open' && !o.st && Math.hypot(o.gate.x - p.sim.x, o.gate.y - p.sim.y) <= SHOW_RANGE) this.show(o);
    }
    for (const o of this.open.values()) {
      if (o.state !== 'open' || !o.st) continue;
      if (Math.hypot(o.gate.x + 0.5 - p.sim.x, o.gate.y + 0.5 - p.sim.y) <= STEP_IN) void this.enter(p, o);
    }
  }

  private show(o: Open): void {
    const st = new SpellState();
    st.id = `gate${++this.seq}`;
    st.kind = SPELL.GATE;
    st.x = o.gate.x + 0.5;
    st.y = o.gate.y + 0.5;
    st.hue = o.gate.rank;
    st.r = 1;
    st.dx = o.gate.slot;
    this.room.state.spells.set(st.id, st);
    o.st = st;
  }

  private hide(o: Open): void {
    if (o.st) this.room.state.spells.delete(o.st.id);
    o.st = null;
  }

  private someoneWithin(x: number, y: number, r: number): boolean {
    for (const p of this.room.players.values()) if (Math.hypot(p.sim.x - x, p.sim.y - y) <= r) return true;
    return false;
  }

  private async enter(p: ServerPlayer, o: Open): Promise<void> {
    const info = GATE_RANK_INFO[o.gate.rank]!;
    if (p.level < info.level) {
      if ((this.warned.get(p.id) ?? -1e9) + 8 < this.t) {
        this.warned.set(p.id, this.t);
        p.toast(
          `The ${rankName(o.gate.rank)} gate pushes you back. Hunters below level ${info.level} cannot pass.`,
          'bad',
        );
      }
      return;
    }
    this.instanceFor(o.gate);
    this.back.set(p.id, { x: o.gate.x + 0.5, y: o.gate.y + 2.5 });
    this.trip.set(p.id, o.gate);
    await this.move(p, gateEntry(this.room.seed, o.gate.slot));
    const L = gateLayout(this.room.seed, o.gate.slot);
    p.toast(
      `You step through the ${rankName(o.gate.rank)} gate: ${L.rooms.filter((r) => r.kind !== 'side').length} halls, and its master at the end. The portal behind you leads out.`,
      'info',
    );
  }

  private instanceFor(g: Gate): Instance {
    const have = this.inst.get(g.slot);
    if (have && have.gate.id === g.id) return have;
    if (have) this.closeInstance(have);
    const ex = gateExit(this.room.seed, g.slot);
    const st = new SpellState();
    st.id = `gexit${++this.seq}`;
    st.kind = SPELL.GATE;
    st.x = ex.x;
    st.y = ex.y;
    st.hue = g.rank;
    st.r = 2;
    st.dx = g.slot;
    this.room.state.spells.set(st.id, st);
    const inst: Instance = {
      gate: g,
      woke: new Set([0]),
      master: null,
      cleared: false,
      side: new Map(),
      paid: new Set(),
      exit: st,
    };
    this.inst.set(g.slot, inst);
    return inst;
  }

  private closeInstance(inst: Instance): void {
    this.room.state.spells.delete(inst.exit.id);
    this.inst.delete(inst.gate.slot);
  }

  private async move(p: ServerPlayer, to: { x: number; y: number }): Promise<void> {
    this.moving.add(p.id);
    try {
      await this.room.ensureChunk(Math.floor(to.x / CHUNK_SIZE), Math.floor(to.y / CHUNK_SIZE));
      p.sim.x = to.x;
      p.sim.y = to.y;
      p.sim.dashT = 0;
      p.sim.mount = 0;
      p.sim.boat = 0;
      p.queue.length = 0;
      this.room.fx({ kind: 'warp', x: to.x, y: to.y, v: 1, id: p.id });
    } finally {
      this.moving.delete(p.id);
    }
  }

  /** back to where a hunter stepped in from (the spawn shrine if that was lost) */
  private async expel(p: ServerPlayer, why: string): Promise<void> {
    const to = this.back.get(p.id) ?? { x: 0.5, y: 2.5 };
    this.back.delete(p.id);
    this.trip.delete(p.id);
    await this.move(p, to);
    p.toast(why, 'info');
  }

  // ───────────────────────── inside a dungeon ─────────────────────────

  private inside(p: ServerPlayer, day: number): void {
    const slot = gateSlotAt(p.sim.x);
    // a hunter handed over from the wilds brings the gate with them
    const trip = this.trip.get(p.id);
    const inst =
      slot === null
        ? undefined
        : (this.inst.get(slot) ??
          (trip && trip.slot === slot && trip.day === day ? this.instanceFor(trip) : undefined));
    if (!inst || inst.gate.day !== day) {
      void this.expel(p, 'The gate has closed behind you; you are back in the world.');
      return;
    }
    if (!inst.cleared && this.room.wclock.hour() >= GATE_BREAK_HOUR) {
      void this.expel(p, `Dusk: the ${rankName(inst.gate.rank)} gate breaks around you and throws you out!`);
      return;
    }
    const ex = inst.exit;
    if (Math.hypot(p.sim.x - ex.x, p.sim.y - ex.y) <= STEP_IN) {
      void this.expel(p, inst.cleared ? 'You step out of the closed gate.' : 'You step back out through the gate.');
      return;
    }
    const at = gateRoomAt(this.room.seed, p.sim.x, p.sim.y);
    if (!at || at.room < 0) return;
    this.wake(inst, at.room);
  }

  /** the monsters of room `i` wake as the first hunter walks in */
  private wake(inst: Instance, i: number): void {
    const L = gateLayout(this.room.seed, inst.gate.slot);
    const room = L.rooms[i]!;
    const info = GATE_RANK_INFO[inst.gate.rank]!;
    if (room.kind === 'master') {
      if (inst.cleared || (inst.master && this.room.enemies.has(inst.master))) return;
      const e = this.spawnIn(L.ox + room.x, GATE_OY + room.y, 0, info.master, info.creature + 2, ELITE.HARDENED);
      if (!e) return;
      e.maxHp = Math.round(e.maxHp * info.masterHp);
      e.hp = e.maxHp;
      e.provoked = true;
      inst.master = e.id;
      for (const q of this.hunters(inst))
        q.toast(
          `The gate's master stirs: ${ENEMY_DEFS[info.master as EnemyKindName].name}, ${rankName(inst.gate.rank)}!`,
          'bad',
        );
      return;
    }
    if (inst.woke.has(i)) return;
    inst.woke.add(i);
    const n = room.kind === 'side' ? Math.max(1, info.pack - 1) : info.pack;
    const ids = new Set<string>();
    for (let k = 0; k < n; k++) {
      const kind = info.pool[Math.floor(this.room.rand() * info.pool.length)]!;
      const elite = inst.gate.rank >= 2 && this.room.rand() < 0.15 ? ELITE.HARDENED : 0;
      const e = this.spawnIn(L.ox + room.x, GATE_OY + room.y, room.r - 2, kind, info.creature, elite);
      if (e) {
        e.provoked = true;
        ids.add(e.id);
      }
    }
    if (room.kind === 'side') inst.side.set(i, ids);
  }

  private spawnIn(x: number, y: number, spread: number, kind: string, level: number, elite: number): Enemy | null {
    for (let k = 0; k < 10; k++) {
      const a = this.room.rand() * Math.PI * 2,
        r = spread * Math.sqrt(this.room.rand());
      const tx = Math.floor(x + Math.cos(a) * r),
        ty = Math.floor(y + Math.sin(a) * r);
      if (isSolid(this.room.store.getTile(tx, ty))) continue;
      return this.room.spawnEnemy(kind as EnemyKindName, tx + 0.5, ty + 0.5, false, { level, elite });
    }
    return null;
  }

  /** the hunters inside a dungeon */
  private hunters(inst: Instance): ServerPlayer[] {
    const out: ServerPlayer[] = [];
    for (const p of this.room.players.values())
      if (isGateY(p.sim.y) && gateSlotAt(p.sim.x) === inst.gate.slot) out.push(p);
    return out;
  }

  killed(e: Enemy, _killer?: ServerPlayer): void {
    for (const inst of this.inst.values()) {
      for (const [i, ids] of inst.side)
        if (ids.delete(e.id) && ids.size === 0 && !inst.paid.has(i)) {
          inst.paid.add(i);
          this.cache(inst, i);
        }
      if (inst.master === e.id && !inst.cleared) this.clear(inst);
    }
  }

  /** a side chamber cleared: a cache of the rank's stones for whoever stands in it */
  private cache(inst: Instance, i: number): void {
    const L = gateLayout(this.room.seed, inst.gate.slot);
    const r = L.rooms[i]!;
    const info = GATE_RANK_INFO[inst.gate.rank]!;
    for (const p of this.hunters(inst)) {
      if (Math.hypot(p.sim.x - (L.ox + r.x), p.sim.y - (GATE_OY + r.y)) > r.r + 4) continue;
      const loot = [{ id: info.stones.id, n: 1 }];
      if (giveStacks(p, loot)) {
        p.dirty('inv');
        p.toast(`The chamber falls quiet. In its corner, a cache: 1 ${info.stones.id.replace(/_/g, ' ')}.`, 'good');
      }
    }
  }

  /** the master is down: everyone inside is paid, and the gate in the wilds closes */
  private clear(inst: Instance): void {
    inst.cleared = true;
    const info = GATE_RANK_INFO[inst.gate.rank]!;
    const o = this.open.get(inst.gate.id);
    if (o) {
      o.state = 'cleared';
      this.hide(o);
    }
    for (const p of this.hunters(inst)) {
      p.data.coins += info.coins;
      p.dirty('coins');
      if (giveStacks(p, [{ ...info.stones }])) p.dirty('inv');
      this.room.grantXp(p, info.xp);
      this.news.set(p.id, inst.gate.id);
      const key = `gate:${GATE_RANKS[inst.gate.rank]}`;
      const first = !p.data.prog.ruins.includes(key);
      if (first) {
        p.data.prog.ruins.push(key);
        p.dirty('stats');
      }
      p.toast(
        `[Gate cleared] ${rankName(inst.gate.rank)}. ${info.coins} coins, ${info.stones.n} ${info.stones.id.replace(/_/g, ' ')}s${first ? `. Your first ${rankName(inst.gate.rank)} gate: the guilds will hear of it.` : '.'} The gate is closing; the portal by the entry leads out.`,
        'good',
      );
      this.room.fx({ kind: 'levelup', x: p.sim.x, y: p.sim.y, id: p.id });
    }
  }

  // ───────────────────────── dusk: gates break ─────────────────────────

  private dusk(day: number, hour: number): void {
    for (const [id, o] of this.open) {
      if (o.gate.day < day) {
        this.hide(o);
        this.open.delete(id);
        continue;
      }
      if (hour < GATE_BREAK_HOUR || o.state !== 'open') continue;
      o.state = 'broken';
      this.hide(o);
      if (this.someoneWithin(o.gate.x, o.gate.y, BREAK_RANGE)) this.breakOut(o.gate);
      const inst = this.inst.get(o.gate.slot);
      if (inst && inst.gate.id === o.gate.id)
        for (const p of this.hunters(inst))
          void this.expel(p, `The ${rankName(o.gate.rank)} gate breaks around you and throws you out!`);
    }
    for (const inst of [...this.inst.values()])
      if (inst.gate.day < day || (hour >= GATE_BREAK_HOUR && !this.hunters(inst).length)) this.closeInstance(inst);
  }

  /** a dungeon break: the gate's monsters, and a lesser copy of its master, pour out around it */
  private breakOut(g: Gate): void {
    const info = GATE_RANK_INFO[g.rank]!;
    if (!this.room.owns(g.x, g.y)) return;
    this.room.fx({ kind: 'blast', x: g.x + 0.5, y: g.y + 0.5, v: 3 });
    for (let k = 0; k < info.pack * 2; k++)
      this.spawnIn(g.x + 0.5, g.y + 0.5, 5, info.pool[k % info.pool.length]!, info.creature, 0);
    const m = this.spawnIn(g.x + 0.5, g.y + 0.5, 2, info.master, info.creature, ELITE.HARDENED);
    if (m) m.provoked = true;
    for (const p of this.room.players.values())
      if (Math.hypot(p.sim.x - g.x, p.sim.y - g.y) <= BREAK_RANGE + 20)
        p.toast(
          `Dungeon break! The ${rankName(g.rank)} gate nobody closed tears open, and its monsters pour out.`,
          'bad',
        );
  }

  // ───────────────────────── tests ─────────────────────────

  state(): { open: Array<{ id: string; state: string; shown: boolean }>; inside: number[] } {
    return {
      open: [...this.open.values()].map((o) => ({ id: o.gate.id, state: o.state, shown: !!o.st })),
      inside: [...this.inst.keys()],
    };
  }
  instance(slot: number): Instance | undefined {
    return this.inst.get(slot);
  }
}
