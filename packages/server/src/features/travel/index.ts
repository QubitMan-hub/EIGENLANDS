/**
 * Teleportation & travel (master plan §14): attuning waystones by walking up to them, travelling between attuned
 * stones from the stone you stand at, binding a Recall home, and the Wayfarer milestones that reward exploring. The
 * network itself (placement, rules, prices) is pure and shared: shared/src/travel.ts. A jump only moves the player;
 * the shard module hands them to the right shard on its next tick, exactly as when walking across a border.
 */
import {
  ATTUNE_REACH,
  ENEMY_DEFS,
  ENEMY_KEY_BY_KIND,
  MSG,
  MSG_TRAVEL,
  RECALL_AT,
  T,
  RECALL_CHANNEL,
  STAG_AT,
  TRAVEL_CHANNEL,
  WAY_SUBS,
  arrivalOf,
  buildingAt,
  isUpperY,
  canTravel,
  chunkOf,
  netName,
  travelCost,
  waystoneById,
  waystonesNear,
  wayfarerRank,
  type TravelEvent,
  type TravelGoMsg,
  type TravelPanel,
  type Waystone,
  type WorldObj,
} from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import type { Module, Registrar } from '../types';

/** How close to a stone you must stand to use it (its tile plus a step). */
const USE_REACH = 3.2;

interface Channel {
  to: { x: number; y: number; name: string; id: string };
  until: number;
  x: number;
  y: number;
  hp: number;
  /** coins taken when the jump lands */
  fare: number;
  /** a Recall Shard to consume when the jump lands */
  shard?: number;
}

export class TravelModule implements Module {
  private t = 0;
  private nextScan = 0;
  private channels = new Map<string, Channel>();
  private hp = new Map<string, number>();

  constructor(private room: GameRoom) {}

  install(reg: Registrar): void {
    reg.on<TravelGoMsg>(MSG_TRAVEL.GO, 'board', (p, m) => this.go(p, m));
  }

  private send(p: ServerPlayer, ev: TravelEvent): void {
    p.client.send(MSG_TRAVEL.EV, ev);
  }
  private ways(p: ServerPlayer): string[] {
    return (p.data.prog.ways ??= []);
  }
  private stone(id: string): Waystone | null {
    return waystoneById(this.room.seed, id, this.room.store.generation);
  }

  private sendState(p: ServerPlayer): void {
    const attuned = this.ways(p)
      .map((id) => this.stone(id))
      .filter((s): s is Waystone => !!s)
      .map((s) => ({ id: s.id, name: s.name, kind: s.kind, x: s.x, y: s.y }));
    this.send(p, { kind: 'state', attuned, home: p.data.prog.home ?? null });
  }

  join(p: ServerPlayer): void {
    this.sendState(p);
  }
  leave(p: ServerPlayer): void {
    this.channels.delete(p.id);
    this.hp.delete(p.id);
  }

  /** Something may be hunting the player: no rest, no travel. */
  private threatened(p: ServerPlayer): boolean {
    for (const e of this.room.state.enemies.values()) {
      if (e.ally || ENEMY_DEFS[ENEMY_KEY_BY_KIND[e.kind] as keyof typeof ENEMY_DEFS]?.passive) continue;
      if (Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 10) return true;
    }
    return false;
  }

  private attune(p: ServerPlayer, s: Waystone): void {
    const ways = this.ways(p);
    if (ways.includes(s.id)) return;
    const before = wayfarerRank(ways.length);
    ways.push(s.id);
    const n = ways.length;
    const rank = wayfarerRank(n);
    const rewards: string[] = [];
    // exploring pays: wild stones far more than the ones in town squares
    const xp = s.wild ? 60 + p.level * 8 : 20 + p.level * 3;
    this.room.grantXp(p, xp);
    rewards.push(`+${xp} XP`);
    if (s.wild) {
      const coins = 25 + p.level * 4;
      p.data.coins += coins;
      p.dirty('coins');
      rewards.push(`+${coins} coins`);
    }
    if (n === 1 && !p.data.prog.home) p.data.prog.home = s.id;
    if (n >= RECALL_AT && !p.data.recipes.has('recall_shard')) {
      p.data.recipes.add('recall_shard');
      p.dirty('recipes');
      rewards.push('learned the Recall Shard');
    }
    const mounts = (p.data.prog.mounts ??= []);
    if (n >= STAG_AT && !mounts.includes('stag')) {
      mounts.push('stag');
      rewards.push('the Moonlit Stag answers your call');
      if (!p.data.inv.some((st) => st?.id === 'stag_bell')) {
        const free = p.data.inv.findIndex((st) => !st);
        if (free >= 0) {
          p.data.inv[free] = { id: 'stag_bell', n: 1 };
          p.dirty('inv');
        }
      }
    }
    if (rank > before) rewards.push(`Wayfarer rank ${rank}: travel costs ${rank * 12}% less`);
    p.dirty('stats');
    this.send(p, {
      kind: 'attune',
      id: s.id,
      name: s.name,
      wayKind: s.kind,
      x: s.x,
      y: s.y,
      reward: rewards.join(' · '),
      rank,
    });
    this.sendState(p);
    this.room.fx({ kind: 'levelup', x: s.x + 0.5, y: s.y + 0.5, v: 0, id: p.id });
  }

  /** OPEN on a waystone, gate or ferry post: attune it and show where it can take you. */
  interact(p: ServerPlayer, o: WorldObj): void {
    if (!WAY_SUBS.has(o.sub)) return;
    const s = this.stone(String((o.data as { way?: string } | undefined)?.way ?? ''));
    if (!s || Math.hypot(s.x + 0.5 - p.sim.x, s.y + 0.5 - p.sim.y) > USE_REACH + 1) return;
    this.attune(p, s);
    p.client.send(MSG.PANEL, { kind: 'travel', tx: o.x, ty: o.y, sub: o.sub, travel: this.panel(p, s) });
  }

  panel(p: ServerPlayer, here: Waystone): TravelPanel {
    const ways = this.ways(p);
    const rank = wayfarerRank(ways.length);
    const dests = ways
      .filter((id) => id !== here.id)
      .map((id) => this.stone(id))
      .filter((s): s is Waystone => !!s)
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        net: s.net,
        x: s.x,
        y: s.y,
        cost: travelCost(here, s, rank),
        reachable: canTravel(here, s),
      }));
    return {
      here: { id: here.id, name: here.name, kind: here.kind, net: here.net },
      home: p.data.prog.home ?? null,
      attuned: ways.length,
      rank,
      coins: p.data.coins,
      dests,
    };
  }

  private standingAt(p: ServerPlayer, id: string | undefined): Waystone | null {
    const s = id ? this.stone(id) : null;
    if (!s || !this.ways(p).includes(s.id)) return null;
    return Math.hypot(s.x + 0.5 - p.sim.x, s.y + 0.5 - p.sim.y) <= USE_REACH + 1 ? s : null;
  }

  private canLeave(p: ServerPlayer): string | null {
    if (p.deadT > 0) return 'You cannot travel while down.';
    if (p.sim.boat) return 'Step ashore first.';
    if (p.sim.cart) return 'Step out of the cart first.';
    if (this.threatened(p)) return 'Something is hunting you. Deal with it before you travel.';
    if (this.channels.has(p.id)) return 'You are already travelling.';
    return null;
  }

  go(p: ServerPlayer, m: TravelGoMsg): void {
    if (m.cancel) {
      if (this.channels.delete(p.id)) this.send(p, { kind: 'cancel', why: 'You let the waystone fall silent.' });
      return;
    }
    const here = this.standingAt(p, m.from);
    if (!here) {
      p.toast('Stand at an attuned waystone to use it.', 'bad');
      return;
    }
    if (m.bind) {
      p.data.prog.home = here.id;
      p.dirty('stats');
      p.toast(`${here.name} is now your Recall home.`, 'good');
      this.sendState(p);
      p.client.send(MSG.PANEL, { kind: 'travel', tx: here.x, ty: here.y, sub: '', travel: this.panel(p, here) });
      return;
    }
    const to = m.to ? this.stone(m.to) : null;
    if (!to || !this.ways(p).includes(to.id)) {
      p.toast('You have not attuned that stone yet.', 'bad');
      return;
    }
    if (!canTravel(here, to)) {
      p.toast(`${to.name} lies in ${netName(to.net)}. Cross between kingdoms from a Realm Gate or a Ferry.`, 'bad');
      return;
    }
    const why = this.canLeave(p);
    if (why) {
      p.toast(why, 'bad');
      return;
    }
    const fare = travelCost(here, to, wayfarerRank(this.ways(p).length));
    if (p.data.coins < fare) {
      p.toast(`The journey costs ${fare} coins.`, 'bad');
      return;
    }
    this.begin(p, { ...arrivalOf(to), name: to.name, id: to.id }, TRAVEL_CHANNEL, fare);
  }

  /** Use of a Recall Shard: back to the bound stone from anywhere on the surface. */
  recall(p: ServerPlayer, slot: number): void {
    const home = p.data.prog.home ? this.stone(p.data.prog.home) : null;
    if (!home) {
      p.toast('Bind a waystone as your home first.', 'bad');
      return;
    }
    const why = this.canLeave(p);
    if (why) {
      p.toast(why, 'bad');
      return;
    }
    this.begin(p, { ...arrivalOf(home), name: home.name, id: home.id }, RECALL_CHANNEL, 0, slot);
  }

  private begin(p: ServerPlayer, to: Channel['to'], seconds: number, fare: number, shard?: number): void {
    this.channels.set(p.id, { to, until: this.t + seconds, x: p.sim.x, y: p.sim.y, hp: p.hp, fare, shard });
    this.send(p, { kind: 'channel', seconds, to: to.name });
    this.room.fx({ kind: 'warp', x: p.sim.x, y: p.sim.y, v: 0, id: p.id });
  }

  private land(p: ServerPlayer, c: Channel): void {
    if (c.fare) {
      if (p.data.coins < c.fare) {
        this.send(p, { kind: 'cancel', why: 'You cannot pay the fare.' });
        return;
      }
      p.data.coins -= c.fare;
      p.dirty('coins');
    }
    if (c.shard !== undefined) {
      const st = p.data.inv[c.shard];
      if (!st || st.id !== 'recall_shard') {
        this.send(p, { kind: 'cancel', why: 'The Recall Shard is gone.' });
        return;
      }
      st.n--;
      if (st.n <= 0) p.data.inv[c.shard] = null;
      p.dirty('inv');
    }
    this.room.fx({ kind: 'warp', x: p.sim.x, y: p.sim.y, v: 2, id: p.id });
    p.sim.x = c.to.x;
    p.sim.y = c.to.y;
    p.sim.dashT = 0;
    p.sim.charge = 0;
    p.sim.hold = 0;
    p.queue.length = 0;
    void this.room.ensureChunk(chunkOf(Math.floor(c.to.x)), chunkOf(Math.floor(c.to.y)));
    this.send(p, { kind: 'arrive', name: c.to.name, x: c.to.x, y: c.to.y });
    this.room.fx({ kind: 'warp', x: c.to.x, y: c.to.y, v: 1, id: p.id });
  }

  /** Use of a mount item: call the horse (or the Stag) and climb on, or step down. */
  toggleMount(p: ServerPlayer, kind: string): void {
    if (p.sim.mount) {
      p.sim.mount = 0;
      this.room.fx({ kind: 'dust', x: p.sim.x, y: p.sim.y });
      return;
    }
    if (p.deadT > 0) return;
    if (p.sim.boat || p.sim.cart) {
      p.toast('There is no room for a mount here.', 'bad');
      return;
    }
    const tx = Math.floor(p.sim.x),
      ty = Math.floor(p.sim.y);
    const t = this.room.store.getTile(tx, ty);
    if (buildingAt(this.room.seed, tx, ty) || isUpperY(p.sim.y) || t === T.DOOR || t === T.VAULT_FLOOR) {
      p.toast('Lead your mount outdoors first.', 'bad');
      return;
    }
    if (kind === 'stag' && !(p.data.prog.mounts ?? []).includes('stag')) {
      p.toast('The bell is silent: the Stag answers only one who has attuned twelve waystones.', 'bad');
      return;
    }
    p.sim.mount = kind === 'stag' ? 2 : 1;
    p.sim.sprint = 0;
    p.sim.charge = 0;
    p.sim.hold = 0;
    this.room.fx({ kind: 'dust', x: p.sim.x, y: p.sim.y });
  }

  tick(_now: number, dt: number): void {
    this.t += dt;
    // a rider who is struck is thrown from the saddle
    for (const p of this.room.players.values()) {
      const last = this.hp.get(p.id);
      if (p.sim.mount && last !== undefined && p.hp < last) {
        p.sim.mount = 0;
        p.toast('You are thrown from the saddle!', 'bad');
      }
      this.hp.set(p.id, p.hp);
    }
    for (const [id, c] of this.channels) {
      const p = this.room.players.get(id);
      if (!p) {
        this.channels.delete(id);
        continue;
      }
      const why =
        p.deadT > 0
          ? 'You fell.'
          : p.hp < c.hp
            ? 'The blow breaks your focus.'
            : Math.hypot(p.sim.x - c.x, p.sim.y - c.y) > 0.6
              ? 'You stepped away; the stone falls silent.'
              : null;
      if (why) {
        this.channels.delete(id);
        this.send(p, { kind: 'cancel', why });
        continue;
      }
      if (this.t >= c.until) {
        this.channels.delete(id);
        this.land(p, c);
      }
    }
    // attunement: walking up to a stone is enough (four times a second is plenty)
    if (this.t < this.nextScan) return;
    this.nextScan = this.t + 0.25;
    for (const p of this.room.players.values()) {
      if (p.deadT > 0) continue;
      for (const s of waystonesNear(this.room.seed, p.sim.x, p.sim.y, ATTUNE_REACH + 1, this.room.store.generation))
        if (Math.hypot(s.x + 0.5 - p.sim.x, s.y + 0.5 - p.sim.y) <= ATTUNE_REACH) this.attune(p, s);
    }
  }
}
