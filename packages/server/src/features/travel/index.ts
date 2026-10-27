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
  GRIFFIN_AT,
  isCaveY,
  isFlying,
  sanctuaryAt,
  ITEMS,
  MOUNT_DEFAULT_NAME,
  MOUNT_FED_MS,
  MOUNT_FEED,
  mountCode,
  mountKindOf,
  mountFed,
  validMountName,
  type MountKind,
  type StableEntry,
  MOUNT_REST_PER_SEC,
  MOUNT_TIRE_PER_TILE,
  MOUNT_TOO_TIRED,
  STABLE_FEE,
  T,
  RECALL_CHANNEL,
  STAG_AT,
  TRAVEL_CHANNEL,
  VOYAGE_CHANNEL,
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
    if (n >= GRIFFIN_AT && !p.data.recipes.has('griffin_whistle')) {
      p.data.recipes.add('griffin_whistle');
      p.dirty('recipes');
      rewards.push('learned the Griffin Whistle (three Gilded Griffin plumes)');
    }
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
      stable: this.stable(p),
      feed: p.data.inv.reduce((n, st) => n + (st && (MOUNT_FEED as readonly string[]).includes(st.id) ? st.n : 0), 0),
    };
  }

  // ───────────────────────── mounts: names, feeding ─────────────────────────

  private owned(p: ServerPlayer): MountKind[] {
    const out: MountKind[] = [];
    if (p.data.inv.some((st) => st?.id === 'horse_whistle')) out.push('horse');
    if ((p.data.prog.mounts ?? []).includes('stag')) out.push('stag');
    if (p.data.inv.some((st) => st?.id === 'griffin_whistle')) out.push('griffin');
    return out;
  }
  private nameOf(p: ServerPlayer, kind: MountKind): string {
    return p.data.prog.mountNames?.[kind] ?? MOUNT_DEFAULT_NAME[kind];
  }
  private fedUntil(p: ServerPlayer, kind: MountKind): number {
    return p.data.prog.mountFed?.[kind] ?? 0;
  }
  private stable(p: ServerPlayer): StableEntry[] {
    const now = this.room.wclock.now();
    return this.owned(p).map((kind) => ({
      kind,
      name: this.nameOf(p, kind),
      fedMs: Math.max(0, this.fedUntil(p, kind) - now),
      fatigue: Math.round(this.worn(p, kind)),
    }));
  }
  private worn(p: ServerPlayer, kind: MountKind): number {
    return p.data.prog.mountWorn?.[kind] ?? 0;
  }
  private setWorn(p: ServerPlayer, kind: MountKind, v: number): void {
    const w = (p.data.prog.mountWorn ??= {});
    const next = Math.max(0, Math.min(100, v));
    if (next <= 0) delete w[kind];
    else w[kind] = next;
  }

  /** Stable a mount at this waystone for the fee: it is rested and given a good feed. */
  stableMount(p: ServerPlayer, kind: MountKind): boolean {
    if (p.data.coins < STABLE_FEE) {
      p.toast(`The stable hand wants ${STABLE_FEE} coins.`, 'bad');
      return false;
    }
    p.data.coins -= STABLE_FEE;
    this.setWorn(p, kind, 0);
    (p.data.prog.mountFed ??= {})[kind] = this.room.wclock.now() + MOUNT_FED_MS;
    if (mountKindOf(p.sim.mount) === kind) p.sim.mount = mountCode(kind, true);
    p.dirty('coins', 'stats');
    p.toast(`${this.nameOf(p, kind)} is rubbed down, watered and fed: fresh as morning.`, 'good');
    return true;
  }

  /** Feed a mount from the pack (a stable's Feed button, or using feed while riding). Returns whether it ate. */
  feedMount(p: ServerPlayer, kind: MountKind, slot?: number): boolean {
    const i =
      slot !== undefined && (MOUNT_FEED as readonly string[]).includes(p.data.inv[slot]?.id ?? '')
        ? slot
        : p.data.inv.findIndex((st) => !!st && (MOUNT_FEED as readonly string[]).includes(st.id));
    const st = i >= 0 ? p.data.inv[i] : null;
    if (!st) {
      p.toast('You have nothing a mount will eat: hay, carrots, apples or oats.', 'bad');
      return false;
    }
    const food = ITEMS[st.id]?.name ?? st.id;
    st.n--;
    if (st.n <= 0) p.data.inv[i] = null;
    p.dirty('inv', 'stats');
    const fed = (p.data.prog.mountFed ??= {});
    fed[kind] = this.room.wclock.now() + MOUNT_FED_MS;
    this.setWorn(p, kind, this.worn(p, kind) - 20);
    if (mountKindOf(p.sim.mount) === kind) p.sim.mount = mountCode(kind, true);
    p.toast(
      `${this.nameOf(p, kind)} munches the ${food.toLowerCase()} happily: 10% swifter for a quarter of an hour.`,
      'good',
    );
    return true;
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
    if (m.stable) {
      if (this.owned(p).includes(m.stable)) this.stableMount(p, m.stable);
      p.client.send(MSG.PANEL, { kind: 'travel', tx: here.x, ty: here.y, sub: '', travel: this.panel(p, here) });
      return;
    }
    if (m.rename || m.feed) {
      const kind = m.rename?.kind ?? m.feed;
      if (kind !== 'horse' && kind !== 'stag' && kind !== 'griffin') return;
      if (!this.owned(p).includes(kind)) {
        p.toast('You do not own that mount.', 'bad');
        return;
      }
      if (m.rename) {
        const name = validMountName(m.rename.name);
        if (!name) {
          p.toast('A name of 1-18 letters, please.', 'bad');
          return;
        }
        (p.data.prog.mountNames ??= {})[kind] = name;
        p.dirty('stats');
        p.toast(
          `Your ${kind === 'stag' ? 'Stag' : kind === 'griffin' ? 'griffin' : 'horse'} is now called ${name}.`,
          'good',
        );
      } else this.feedMount(p, kind);
      p.client.send(MSG.PANEL, { kind: 'travel', tx: here.x, ty: here.y, sub: '', travel: this.panel(p, here) });
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
    const voyage =
      here.kind === 'harbor' && to.kind === 'harbor'
        ? { from: { name: here.name, x: here.x, y: here.y }, to: { name: to.name, x: to.x, y: to.y } }
        : undefined;
    this.begin(
      p,
      { ...arrivalOf(to), name: to.name, id: to.id },
      voyage ? VOYAGE_CHANNEL : TRAVEL_CHANNEL,
      fare,
      undefined,
      voyage,
    );
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

  private begin(
    p: ServerPlayer,
    to: Channel['to'],
    seconds: number,
    fare: number,
    shard?: number,
    voyage?: Extract<TravelEvent, { kind: 'channel' }>['voyage'],
  ): void {
    this.channels.set(p.id, { to, until: this.t + seconds, x: p.sim.x, y: p.sim.y, hp: p.hp, fare, shard });
    this.send(p, { kind: 'channel', seconds, to: to.name, ...(voyage ? { voyage } : {}) });
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
      if (isFlying(p.sim.mount)) {
        // a griffin can only set you down on open, walkable ground
        const lx = Math.floor(p.sim.x),
          ly = Math.floor(p.sim.y);
        const lt = this.room.store.getTile(lx, ly);
        if (this.room.store.solidAt(lx, ly) || lt === T.WATER || lt === T.DEEP_WATER || lt === T.LAVA) {
          p.toast('There is nowhere to land here: find open ground.', 'bad');
          return;
        }
      }
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
    if (kind === 'griffin') {
      if (isCaveY(p.sim.y)) {
        p.toast('The griffin will not fly beneath the earth.', 'bad');
        return;
      }
      if (sanctuaryAt(this.room.seed, p.sim.x, p.sim.y)) {
        p.toast('The town wards unsettle your griffin: take off outside the settlement.', 'bad');
        return;
      }
    }
    const mk: MountKind = kind === 'stag' ? 'stag' : kind === 'griffin' ? 'griffin' : 'horse';
    if (this.worn(p, mk) >= MOUNT_TOO_TIRED) {
      p.toast(
        `${this.nameOf(p, mk)} is worn out. Let it rest a while, feed it, or stable it at a waystone's hitching post.`,
        'bad',
      );
      return;
    }
    p.sim.mount = mountCode(mk, this.fedUntil(p, mk) > this.room.wclock.now());
    p.toast(`You call ${this.nameOf(p, mk)} and swing into the saddle.`, 'info');
    p.sim.sprint = 0;
    p.sim.charge = 0;
    p.sim.hold = 0;
    this.room.fx({ kind: 'dust', x: p.sim.x, y: p.sim.y });
  }

  private ridden = new Map<string, { x: number; y: number }>();
  private staminaAt = 0;
  /** Once a second: riding tires the mount by the distance covered; mounts not being ridden rest. */
  private stamina(): void {
    for (const p of this.room.players.values()) {
      const mk = mountKindOf(p.sim.mount);
      const last = this.ridden.get(p.id);
      for (const kind of this.owned(p)) {
        const before = this.worn(p, kind);
        if (kind === mk) {
          const d = last ? Math.min(12, Math.hypot(p.sim.x - last.x, p.sim.y - last.y)) : 0;
          const next = before + d * MOUNT_TIRE_PER_TILE[kind];
          this.setWorn(p, kind, next);
          if (before < 75 && next >= 75)
            p.toast(`${this.nameOf(p, kind)} is tiring. Rest, feed or stable it soon.`, 'info');
          if (next >= 100) this.exhausted(p, kind);
        } else if (before > 0) this.setWorn(p, kind, before - MOUNT_REST_PER_SEC);
      }
      if (mk) this.ridden.set(p.id, { x: p.sim.x, y: p.sim.y });
      else this.ridden.delete(p.id);
    }
  }
  /** an exhausted mount sets its rider down (a griffin only once there is ground to land on) */
  private exhausted(p: ServerPlayer, kind: MountKind): void {
    if (isFlying(p.sim.mount)) {
      const lx = Math.floor(p.sim.x),
        ly = Math.floor(p.sim.y);
      const lt = this.room.store.getTile(lx, ly);
      if (this.room.store.solidAt(lx, ly) || lt === T.WATER || lt === T.DEEP_WATER || lt === T.LAVA) {
        if (Math.floor(this.t) % 5 === 0)
          p.toast(`${this.nameOf(p, kind)} is flagging: find ground to land on!`, 'bad');
        return;
      }
    }
    p.sim.mount = 0;
    this.room.fx({ kind: 'dust', x: p.sim.x, y: p.sim.y });
    p.toast(`${this.nameOf(p, kind)} is exhausted and will carry you no further for now.`, 'bad');
  }

  tick(_now: number, dt: number): void {
    this.t += dt;
    if (this.t >= this.staminaAt) {
      this.staminaAt = this.t + 1;
      this.stamina();
    }
    // a rider who is struck is thrown from the saddle; a good feed wears off
    const wnow = this.room.wclock.now();
    for (const p of this.room.players.values()) {
      const mk = mountKindOf(p.sim.mount);
      if (mk && mountFed(p.sim.mount) && this.fedUntil(p, mk) <= wnow) p.sim.mount = mountCode(mk, false);
      const last = this.hp.get(p.id);
      if (p.sim.mount && !isFlying(p.sim.mount) && last !== undefined && p.hp < last) {
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
