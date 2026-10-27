/**
 * Road caravans (master plan §14). Positions come from the shared schedule (shared/src/caravans.ts); this module only
 * handles what players do with them: trading at the wagon (its own stock, better prices for what you sell), the first
 * meeting with each caravan, and wolf ambushes on the open road that nearby travellers can beat off for a reward.
 */
import {
  CARAVAN_BUY,
  CARAVAN_REACH,
  ITEMS,
  addStack,
  buyPrice,
  canAdd,
  caravanAt,
  caravanById,
  caravanStock,
  caravansNear,
  caravanNextStop,
  escortPay,
  siteName,
  sanctuaryAt,
  type CaravanRoute,
  type ShopMsg,
  type ShopViewMsg,
} from '@eigenlands/shared';
import type { Enemy } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { gainRep } from '../../systems/reputation';
import { recordCiv } from '../civ/registry';
import type { Module, Registrar } from '../types';

export const CARAVAN_NPC = 'caravan:';
const AMBUSH_EVERY = 4; // seconds between ambush checks
const AMBUSH_CHANCE = 0.06;
const AMBUSH_COOLDOWN = 600; // a caravan is left in peace for ten minutes after an attack
const DEFEND_REACH = 30;

/** A signed-on escort: ride with the caravan to `dest` (a settlement's rest stop) and stay close. */
interface Escort {
  route: CaravanRoute;
  dest: string;
  destName: string;
  pay: number;
  /** seconds spent too far from the wagon */
  away: number;
  ambushed: boolean;
  deadline: number;
}
const ESCORT_NEAR = 16;
const ESCORT_GRACE = 30;

interface Ambush {
  route: CaravanRoute;
  enemies: Set<string>;
  until: number;
}

export class CaravanModule implements Module {
  private t = 0;
  private next = 0;
  private ambushes = new Map<string, Ambush>();
  private calm = new Map<string, number>();
  private escorts = new Map<string, Escort>();
  private escortTick = 0;

  constructor(private room: GameRoom) {}

  install(_reg: Registrar): void {
    /* trading arrives as MSG.SHOP with an npcId of "caravan:<route>" (see WorldRoom) */
  }

  private now(): number {
    return this.room.wclock.now();
  }
  private day(): number {
    return this.room.wclock.day();
  }

  /** The caravan of `id`, if it is within reach of the player right now. */
  private reachable(p: ServerPlayer, id: string): CaravanRoute | null {
    const r = caravanById(this.room.seed, id);
    if (!r) return null;
    const pos = caravanAt(this.room.seed, r, this.now());
    return !pos.hidden && Math.hypot(pos.x - p.sim.x, pos.y - p.sim.y) <= CARAVAN_REACH + 1.5 ? r : null;
  }

  private meet(p: ServerPlayer, r: CaravanRoute): void {
    const met = (p.data.prog.caravans ??= []);
    if (met.includes(r.id)) return;
    met.push(r.id);
    this.room.grantXp(p, 30 + p.level * 4);
    p.dirty('stats');
    p.toast(
      r.peddler
        ? `You meet ${r.master}, who wanders the home towns with curiosities from far away. Look for the wagon in a different town each day.`
        : `You meet ${r.master} of the ${r.name}. Caravans pay well and carry goods from the whole road.`,
      'good',
    );
  }

  private view(p: ServerPlayer, r: CaravanRoute): ShopViewMsg {
    const sell: Record<number, number> = {};
    p.data.inv.forEach((s, i) => {
      const v = s ? (ITEMS[s.id]?.value ?? 0) : 0;
      if (s && v > 0) sell[i] = Math.max(1, Math.floor(v * CARAVAN_BUY));
    });
    const mine = this.escorts.get(p.id);
    const next = caravanNextStop(this.room.seed, r, this.now());
    const job = mine
      ? mine.route.id === r.id
        ? {
            text: `Stay within ${ESCORT_NEAR} tiles of the wagon until it rests at ${mine.destName}.`,
            pay: mine.pay,
            active: true,
            offer: false,
          }
        : { text: `You are already escorting the ${mine.route.name}.`, pay: 0, active: false, offer: false }
      : next
        ? {
            text: `${r.master} needs a guard to ${siteName(next.site)} (about ${Math.round(next.distance)} tiles). Wolves stalk this road.`,
            pay: escortPay(next.distance, p.level),
            active: false,
            offer: true,
          }
        : undefined;
    return {
      npcId: CARAVAN_NPC + r.id,
      job,
      name: `${r.name} · ${r.master}`,
      stock: caravanStock(this.room.seed, r, this.day()).map((s) => ({
        item: s.item,
        price: buyPrice(s.item, s.markup),
      })),
      sell,
      coins: p.data.coins,
    };
  }

  shop(p: ServerPlayer, m: ShopMsg): ShopViewMsg | null {
    const r = this.reachable(p, String(m.npcId).slice(CARAVAN_NPC.length));
    if (!r) {
      p.toast('The caravan has moved on down the road.', 'info');
      return null;
    }
    this.meet(p, r);
    const n = m.n === undefined ? 1 : m.n;
    if (m.action === 'job') {
      this.signOn(p, r);
      return this.view(p, r);
    }
    if (m.action === 'open' || !Number.isInteger(n) || n < 1 || n > 99) return this.view(p, r);
    if (m.action === 'buy') {
      const entry = caravanStock(this.room.seed, r, this.day()).find((s) => s.item === m.item);
      if (!entry) {
        p.toast('Not on the wagon today.', 'bad');
        return this.view(p, r);
      }
      const cost = buyPrice(entry.item, entry.markup) * n;
      const stack = { id: entry.item, n };
      if (p.data.coins < cost) p.toast('You cannot afford that.', 'bad');
      else if (!canAdd(p.data.inv, stack)) p.toast('Your pack is full.', 'bad');
      else {
        addStack(p.data.inv, stack);
        p.data.coins -= cost;
        p.dirty('inv', 'coins');
        p.toast(`Bought ${n} ${ITEMS[entry.item]!.name} for ${cost}.`, 'good', stack);
        if (!r.peddler) {
          gainRep(p, r.realm, Math.max(1, Math.floor(cost / 40)), true);
          recordCiv(this.room.seed, r.realm, 'trade', cost);
        }
      }
      return this.view(p, r);
    }
    if (m.action === 'sell') {
      const slot = m.slot as number;
      const stack = Number.isInteger(slot) ? p.data.inv[slot] : null;
      const value = stack ? (ITEMS[stack.id]?.value ?? 0) : 0;
      if (!stack || stack.n < n || value <= 0) {
        p.toast('You cannot sell that here.', 'bad');
        return this.view(p, r);
      }
      const total = Math.max(1, Math.floor(value * CARAVAN_BUY)) * n;
      const name = ITEMS[stack.id]!.name;
      stack.n -= n;
      if (stack.n <= 0) p.data.inv[slot] = null;
      p.data.coins += total;
      p.dirty('inv', 'coins');
      p.toast(`Sold ${n} ${name} for ${total}.`, 'good');
      if (!r.peddler) {
        gainRep(p, r.realm, Math.max(1, Math.floor(total / 50)), true);
        recordCiv(this.room.seed, r.realm, 'trade', total);
      }
      return this.view(p, r);
    }
    return this.view(p, r);
  }

  private signOn(p: ServerPlayer, r: CaravanRoute): void {
    if (this.escorts.has(p.id)) {
      p.toast('You are already escorting a caravan.', 'bad');
      return;
    }
    const next = caravanNextStop(this.room.seed, r, this.now());
    if (!next) return;
    const name = siteName(next.site);
    this.escorts.set(p.id, {
      route: r,
      dest: next.site.id,
      destName: name,
      pay: escortPay(next.distance, p.level),
      away: 0,
      ambushed: false,
      deadline: this.t + (next.atMs - this.now()) / 1000 + 120,
    });
    p.toast(`You sign on with ${r.master}. Keep close to the wagon until it rests at ${name}.`, 'good');
  }

  /** Escorts: stay near, see the wagon to its stop, and be paid; wander off and the job is lost. */
  private stepEscorts(): void {
    const now = this.now();
    for (const [pid, e] of this.escorts) {
      const p = this.room.players.get(pid);
      if (!p) {
        this.escorts.delete(pid);
        continue;
      }
      const c = caravanAt(this.room.seed, e.route, now);
      const near = !c.hidden && Math.hypot(c.x - p.sim.x, c.y - p.sim.y) <= ESCORT_NEAR;
      // inside a settlement's streets the wagon is out of sight: that is not the escort's fault
      e.away = near || c.hidden ? 0 : e.away + 1;
      if (e.away === Math.floor(ESCORT_GRACE / 2)) p.toast(`Get back to the ${e.route.name}!`, 'bad');
      if (e.away > ESCORT_GRACE || this.t > e.deadline || p.deadT > 0) {
        this.escorts.delete(pid);
        p.toast(`You left the ${e.route.name}. ${e.route.master} will find another guard.`, 'bad');
        continue;
      }
      // the road is dangerous with a guard aboard: one ambush on the open road, guaranteed
      if (!e.ambushed && c.moving && !c.hidden && !sanctuaryAt(this.room.seed, c.x, c.y) && this.room.rand() < 0.08) {
        if (this.ambush(e.route, c.x, c.y, c.fx, c.fy, p.level, true)) e.ambushed = true;
      }
      if (!c.moving && c.at?.id === e.dest && near) {
        this.escorts.delete(pid);
        recordCiv(this.room.seed, e.route.realm, 'caravansSaved');
        p.data.coins += e.pay;
        p.dirty('coins');
        this.room.grantXp(p, 50 + p.level * 8);
        gainRep(p, e.route.realm, 25);
        this.meet(p, e.route);
        p.toast(`${e.route.master} pays you ${e.pay} coins at ${e.destName}: "Safe roads, friend."`, 'good');
      }
    }
  }

  escorting(p: { id: string }): { route: string; dest: string } | null {
    const e = this.escorts.get(p.id);
    return e ? { route: e.route.id, dest: e.dest } : null;
  }

  leave(p: ServerPlayer): void {
    this.escorts.delete(p.id);
  }

  tick(_now: number, dt: number): void {
    this.t += dt;
    if (this.t >= this.escortTick) {
      this.escortTick = this.t + 1;
      this.stepEscorts();
    }
    for (const [id, a] of this.ambushes) {
      // wolves that left the world another way (despawned, warded) no longer count
      for (const e of a.enemies) if (!this.room.enemies.has(e)) a.enemies.delete(e);
      if (this.t > a.until && a.enemies.size) recordCiv(this.room.seed, a.route.realm, 'caravansLost');
      if (this.t > a.until || !a.enemies.size) this.ambushes.delete(id);
    }
    if (this.t < this.next) return;
    this.next = this.t + AMBUSH_EVERY;
    const now = this.now();
    for (const p of this.room.players.values()) {
      if (p.deadT > 0 || p.level < 3) continue;
      for (const c of caravansNear(this.room.seed, p.sim.x, p.sim.y, 24, now)) {
        const id = c.route.id;
        if (!c.moving || this.ambushes.has(id) || (this.calm.get(id) ?? 0) > this.t) continue;
        if (sanctuaryAt(this.room.seed, c.x, c.y)) continue; // settlement wards keep the road near towns safe
        if (this.room.rand() > AMBUSH_CHANCE) continue;
        this.ambush(c.route, c.x, c.y, c.fx, c.fy, p.level);
      }
    }
  }

  /** Wolves (and at higher levels a brute) burst from the verge beside the road ahead of the wagon. */
  ambush(r: CaravanRoute, x: number, y: number, fx: number, fy: number, level: number, force = false): boolean {
    if (this.ambushes.has(r.id) && !force) return false;
    const enemies = new Set<string>();
    const kinds = level >= 10 ? (['wolf', 'wolf', 'brute'] as const) : (['wolf', 'wolf', 'wolf'] as const);
    kinds.forEach((kind, i) => {
      for (let tries = 0; tries < 8; tries++) {
        const side = i % 2 ? 1 : -1;
        const ex = Math.floor(x + fx * (5 + i) + -fy * side * (4 + tries * 0.5)),
          ey = Math.floor(y + fy * (5 + i) + fx * side * (4 + tries * 0.5));
        if (this.room.store.solidAt(ex, ey) || !this.room.owns(ex, ey) || sanctuaryAt(this.room.seed, ex, ey)) continue;
        const e = this.room.spawnEnemy(kind, ex + 0.5, ey + 0.5, false, { level: Math.max(3, level) });
        enemies.add(e.id);
        break;
      }
    });
    if (!enemies.size) return false;
    this.ambushes.set(r.id, { route: r, enemies, until: this.t + 180 });
    this.calm.set(r.id, this.t + AMBUSH_COOLDOWN);
    for (const p of this.room.players.values())
      if (Math.hypot(p.sim.x - x, p.sim.y - y) < DEFEND_REACH)
        p.toast(`Wolves fall on the ${r.name}! Drive them off.`, 'bad');
    return true;
  }

  killed(e: Enemy): void {
    for (const [id, a] of this.ambushes) {
      if (!a.enemies.delete(e.id) || a.enemies.size) continue;
      this.ambushes.delete(id);
      recordCiv(this.room.seed, a.route.realm, 'caravansSaved');
      const pos = caravanAt(this.room.seed, a.route, this.now());
      for (const p of this.room.players.values()) {
        if (p.deadT > 0 || Math.hypot(p.sim.x - pos.x, p.sim.y - pos.y) > DEFEND_REACH) continue;
        const coins = 40 + p.level * 6;
        p.data.coins += coins;
        p.dirty('coins');
        this.room.grantXp(p, 40 + p.level * 6);
        gainRep(p, a.route.realm, 15);
        p.toast(`${a.route.master} presses ${coins} coins into your hand: "The road owes you one."`, 'good');
        this.meet(p, a.route);
      }
    }
  }

  debug(): { ambushes: number } {
    return { ambushes: this.ambushes.size };
  }
}
