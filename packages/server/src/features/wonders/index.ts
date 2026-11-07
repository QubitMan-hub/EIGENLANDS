/**
 * Wonders and hunts on the server (shared rules in shared/src/wonders.ts).
 *
 * Starfall: on a starfall night one star comes down near each traveller out in the open, a little way off, with a
 * flash and a word of where it fell. It lies glowing until mid-morning; anyone may break it open for star shards.
 *
 * Bounties: each town posts a beast to hunt today, on its request board or on a notice board by the well. Walk into
 * the town and you hear of it; go out toward where it was seen and it is there: hardened, a level above you, larger,
 * and fighting in its own way (BOUNTY_STYLE). Everyone near when it falls is paid, once per bounty.
 */
import {
  localFindAt,
  hash2,
  BOUNTY_STYLE,
  CHUNK_SIZE,
  BOUNTY_SIGNATURE,
  ELITE,
  MSG,
  bountyView,
  type BountyView,
  type PanelMsg,
  type Town,
  FALLEN_STAR_SHARDS,
  bountySignatureDamage,
  T,
  bountyOf,
  compassWord,
  isCaveY,
  isCryptY,
  isOtherworldY,
  isDiveY,
  isUpperY,
  sanctuaryAt,
  starfallHour,
  starfallOn,
  townAt,
  townsNear,
  type Bounty,
  type WorldObj,
} from '@eigenlands/shared';
import type { Enemy } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { giveStacks } from '../../systems/helpers';
import { gainRep } from '../../systems/reputation';
import { inflict } from '../../systems/travel-needs';
import type { Module, Registrar } from '../types';

/** ground a star may land on */
const LANDING = new Set<number>([T.GRASS, T.GRASS_TALL, T.FLOWERS, T.SAND, T.PATH, T.STUMP]);
/** chance per check (every two seconds) that a traveller's star falls, once the night has begun */
const FALL_CHANCE = 0.05;
const BOUNTY_SPAWN_RANGE = 60;
const BOUNTY_PAY_RANGE = 25;
const FIND_GROUND = new Set<number>([T.GRASS, T.SAND, T.FLOWERS, T.STUMP, T.CAVE_FLOOR, T.VAULT_FLOOR]);

const outdoors = (y: number) => !isCaveY(y) && !isUpperY(y) && !isDiveY(y) && !isCryptY(y) && !isOtherworldY(y);

export class WondersModule implements Module {
  private t = 0;
  private next = 0;
  /** account -> the starfall night (its evening's day) a star has already fallen for them */
  private fell = new Map<string, number>();
  /** stars lying on the ground: key -> night */
  private stars = new Map<string, { x: number; y: number; night: number }>();
  /** bounty id -> the beast's enemy id while it is out */
  private hunting = new Map<
    string,
    {
      enemy: string;
      bounty: Bounty;
      realm?: string;
      /** seconds until its signature move may come again */
      sigCd: number;
      /** a signature move telegraphed and about to land: where, and how long until it does */
      pending?: { x: number; y: number; t: number; from?: { x: number; y: number } };
      /** wolves call the pack at most twice; badgers burrow at most twice */
      uses: number;
      /** Hunters already warned on approaching this beast, including arrivals after it spawned. */
      warned: Set<string>;
    }
  >();
  /** Town boards already checked this session. */
  private boards = new Set<string>();
  /** bounties already brought down today */
  private slain = new Set<string>();
  /** account -> bounty ids they have heard of */
  private heard = new Map<string, Set<string>>();
  /** Active glimmers, capped across the room; claims themselves live in character progress. */
  private finds = new Map<string, { x: number; y: number; day: number }>();
  private findSweep: IterableIterator<WorldObj> | null = null;

  constructor(private room: GameRoom) {}

  install(_reg: Registrar): void {}

  /** the starfall night now under way (the evening's day), or null */
  private night(): number | null {
    const day = this.room.wclock.day(),
      hour = this.room.wclock.hour();
    if (!starfallHour(hour)) return null;
    const n = hour < 4 ? day - 1 : day;
    return starfallOn(this.room.seed, n) ? n : null;
  }

  tick(_now: number, dt: number): void {
    this.signatures(dt);
    this.t += dt;
    if (this.t < this.next) return;
    this.next = this.t + 2;
    this.starfall();
    this.expireStars();
    this.bounties();
    this.localFinds();
  }

  // ───────────────────────── starfall ─────────────────────────

  private starfall(): void {
    const n = this.night();
    if (n === null) return;
    for (const p of this.room.players.values()) {
      if (p.deadT > 0 || !outdoors(p.sim.y) || this.fell.get(p.accountId) === n) continue;
      if (sanctuaryAt(this.room.seed, p.sim.x, p.sim.y) || this.room.rand() > FALL_CHANCE) continue;
      const spot = this.landing(p);
      if (!spot) continue;
      this.fell.set(p.accountId, n);
      this.drop(spot.x, spot.y, n);
      const dir = compassWord(spot.x - p.sim.x, spot.y - p.sim.y);
      for (const q of this.room.players.values())
        if (Math.hypot(q.sim.x - spot.x, q.sim.y - spot.y) < 60)
          q.toast(`A falling star streaks down and lands to the ${dir}! It glows where it fell.`, 'good');
    }
  }

  /** a clear patch of open ground 10–22 tiles from the traveller */
  private landing(p: ServerPlayer): { x: number; y: number } | null {
    const store = this.room.store;
    for (let k = 0; k < 12; k++) {
      const a = this.room.rand() * Math.PI * 2,
        r = 10 + this.room.rand() * 12;
      const x = Math.floor(p.sim.x + Math.cos(a) * r),
        y = Math.floor(p.sim.y + Math.sin(a) * r);
      if (!this.room.owns(x, y) || !store.has(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE))) continue;
      if (!LANDING.has(store.getTile(x, y)) || store.objectAt(x, y) || store.structureAt(x, y)) continue;
      if (townAt(this.room.seed, x, y) || sanctuaryAt(this.room.seed, x, y)) continue;
      return { x, y };
    }
    return null;
  }

  /** set a fallen star down at (x, y) (also used by tests) */
  drop(x: number, y: number, night: number): void {
    this.room.objects.put({ x, y, kind: 'deco', sub: 'fallen_star', data: { night } });
    this.stars.set(`${x},${y}`, { x, y, night });
    this.room.fx({ kind: 'blast', x: x + 0.5, y: y + 0.5, v: 1.5 });
  }

  /** stars fade by mid-morning after their night */
  private expireStars(): void {
    const day = this.room.wclock.day(),
      hour = this.room.wclock.hour();
    for (const [k, s] of this.stars)
      if (day > s.night + 1 || (day === s.night + 1 && hour >= 10)) {
        if (this.room.store.objectAt(s.x, s.y)?.sub === 'fallen_star') this.room.objects.remove(s.x, s.y);
        this.stars.delete(k);
      }
  }

  /** Break a fallen star open: star shards (and now and then a qubit crystal), and some experience. */
  openStar(p: ServerPlayer, o: WorldObj): void {
    if (o.data?.localFind) {
      this.openLocalFind(p, o);
      return;
    }
    const [lo, hi] = FALLEN_STAR_SHARDS;
    const loot = [{ id: 'star_shard', n: lo + Math.floor(this.room.rand() * (hi - lo + 1)) }];
    if (this.room.rand() < 0.3) loot.push({ id: 'qubit_crystal', n: 1 });
    if (!giveStacks(p, loot)) {
      p.toast('Your pack is too full to carry the star’s shards.', 'bad');
      return;
    }
    this.room.objects.remove(o.x, o.y);
    this.stars.delete(`${o.x},${o.y}`);
    p.dirty('inv');
    this.room.grantXp(p, 60 + p.level * 6);
    this.room.fx({ kind: 'craft', x: o.x + 0.5, y: o.y + 0.5 });
    p.toast(`You break the fallen star open: ${loot[0]!.n} star shards, still warm.`, 'good');
  }

  /** Small nonblocking opportunities reuse the glimmer's renderer and OPEN interaction. */
  private localFinds(): void {
    const day = this.room.wclock.day();
    const accounts = new Map([...this.room.players.values()].map((p) => [p.accountId, p]));
    // Rehydrate persisted props and clear old ones incrementally, including after a restart.
    this.findSweep ??= this.room.objects.all();
    for (let i = 0; i < 64; i++) {
      const next = this.findSweep.next();
      if (next.done) {
        this.findSweep = null;
        break;
      }
      const o = next.value;
      if (!o.data?.localFind) continue;
      const p = o.owner ? accounts.get(o.owner) : undefined;
      const prior = o.owner ? this.finds.get(o.owner) : undefined;
      if (
        o.data.day !== day ||
        !p ||
        (p.data.prog.localFindDay ?? -Infinity) >= day ||
        (prior && (prior.x !== o.x || prior.y !== o.y)) ||
        (!prior && this.finds.size >= 32)
      ) {
        this.room.objects.remove(o.x, o.y);
      } else this.finds.set(p.accountId, { x: o.x, y: o.y, day });
    }
    for (const [account, f] of this.finds) {
      if (f.day === day && accounts.has(account)) continue;
      const o = this.room.store.objectAt(f.x, f.y);
      if (o?.data?.localFind && o.owner === account) this.room.objects.remove(f.x, f.y);
      this.finds.delete(account);
    }
    if (this.room.store.generation < 7) return;
    for (const p of this.room.players.values()) {
      if (this.finds.size >= 32) break;
      if (p.deadT > 0 || (p.data.prog.localFindDay ?? -Infinity) >= day || this.finds.has(p.accountId)) continue;
      // Twelve loaded, owned candidates, with a bounded straight walkability check.
      for (let k = 0; k < 12; k++) {
        const a = hash2(this.room.seed, day, k, 6820) * Math.PI * 2;
        const x = Math.floor(p.sim.x + Math.cos(a) * 7),
          y = Math.floor(p.sim.y + Math.sin(a) * 7);
        if (!this.room.owns(x, y) || !this.room.store.has(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE)))
          continue;
        if (
          !FIND_GROUND.has(this.room.store.getTile(x, y)) ||
          this.room.store.objectAt(x, y) ||
          this.room.store.structureAt(x, y)
        )
          continue;
        if (sanctuaryAt(this.room.seed, x, y)) continue;
        let clear = true;
        for (let step = 1; step <= 8; step++) {
          const tx = Math.floor(p.sim.x + ((x + 0.5 - p.sim.x) * step) / 8);
          const ty = Math.floor(p.sim.y + ((y + 0.5 - p.sim.y) * step) / 8);
          if (this.room.store.solidAt(tx, ty)) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;
        const f = localFindAt(this.room.seed, day, x, y, this.room.store.generation);
        if (!f) continue;
        this.room.objects.put({
          x,
          y,
          kind: 'deco',
          sub: 'fallen_star',
          owner: p.accountId,
          data: { localFind: f.id, day },
        });
        this.finds.set(p.accountId, { x, y, day });
        p.toast(
          `${f.title}: ${f.reason} A glimmer to the ${compassWord(x - p.sim.x, y - p.sim.y)} marks it. Walk up and interact to gather it before tomorrow.`,
          'good',
        );
        break;
      }
    }
  }

  private openLocalFind(p: ServerPlayer, o: WorldObj): void {
    const day = this.room.wclock.day();
    if (o.owner !== p.accountId || o.data?.day !== day || (p.data.prog.localFindDay ?? -Infinity) >= day) return;
    if (Math.hypot(o.x + 0.5 - p.sim.x, o.y + 0.5 - p.sim.y) > 4) return;
    if (!this.room.owns(o.x, o.y) || this.room.store.objectAt(o.x, o.y)?.data?.localFind !== o.data.localFind) return;
    const f = localFindAt(this.room.seed, day, o.x, o.y, this.room.store.generation);
    if (!f || f.id !== o.data.localFind) return;
    if (!giveStacks(p, f.items)) {
      p.toast('Make room in your pack; the glimmer will wait until tomorrow.', 'bad');
      return;
    }
    p.data.prog.localFindDay = day;
    p.dirty('stats');
    this.room.objects.remove(o.x, o.y);
    this.finds.delete(p.accountId);
    this.room.grantXp(p, 40);
    p.toast(`${f.title} gathered. Another local discovery may await tomorrow.`, 'good');
  }

  // ───────────────────────── bounties ─────────────────────────

  private bounties(): void {
    const day = this.room.wclock.day();
    for (const p of this.room.players.values()) {
      if (p.deadT > 0 || !outdoors(p.sim.y)) continue;
      // hearing of it: walk into a town that has posted one
      const here = townAt(this.room.seed, Math.floor(p.sim.x), Math.floor(p.sim.y));
      if (here) this.ensureBoard(here);
      const posted = here && bountyOf(this.room.seed, here, day);
      if (posted && !this.slain.has(posted.id)) {
        const heard = this.heard.get(p.accountId) ?? new Set<string>();
        if (!heard.has(posted.id)) {
          heard.add(posted.id);
          this.heard.set(p.accountId, heard);
          p.toast(
            `Bounty posted in ${posted.town}: ${posted.name}, a ${posted.kind}, was seen to the ${posted.dir}. ${posted.reward} coins to whoever brings it down.`,
            'info',
          );
        }
      }
      // meeting it: out toward where it was seen
      for (const t of townsNear(this.room.seed, p.sim.x - 90, p.sim.y - 90, p.sim.x + 90, p.sim.y + 90)) {
        const b = bountyOf(this.room.seed, t, day);
        if (!b || this.slain.has(b.id) || this.hunting.has(b.id)) continue;
        if (Math.hypot(p.sim.x - b.x, p.sim.y - b.y) > BOUNTY_SPAWN_RANGE) continue;
        const at = this.open(b.x, b.y);
        // a ward would disperse it the moment it appeared (and it would be met again every two seconds)
        if (!at || sanctuaryAt(this.room.seed, at.x + 0.5, at.y + 0.5)) continue;
        const e = this.room.spawnEnemy(b.kind, at.x + 0.5, at.y + 0.5, false, {
          level: Math.max(4, p.level + 1),
          elite: ELITE.HARDENED | ELITE.BOUNTY,
        });
        // not an ordinary beast: its own way of fighting
        const style = BOUNTY_STYLE[b.kind];
        e.def = {
          ...e.def,
          name: b.name,
          ai: style.ai,
          trait: style.trait ?? e.def.trait,
          aoe: (e.def.aoe ?? 1) * style.aoe,
          damage: Math.round(e.def.damage * style.damage),
          radius: e.def.radius * 1.2,
          strikeRange: Math.max(e.def.strikeRange, style.ai === 'harrier' ? 6 : style.ai === 'brute' ? 6 : 3.2),
          sight: Math.max(e.def.sight, 9),
        };
        e.provoked = false;
        this.hunting.set(b.id, {
          enemy: e.id,
          bounty: b,
          realm: t.site?.realm,
          sigCd: 4,
          uses: 0,
          warned: new Set(),
        });
      }
    }
    // Warn each approaching hunter once; a beast despawned unkilled may be met again.
    for (const [id, h] of this.hunting) {
      const e = this.room.enemies.get(h.enemy);
      if (!e) {
        this.hunting.delete(id);
        continue;
      }
      for (const p of this.room.players.values()) {
        if (p.deadT > 0 || h.warned.has(p.accountId) || Math.hypot(p.sim.x - e.x, p.sim.y - e.y) >= 30) continue;
        h.warned.add(p.accountId);
        p.toast(`${h.bounty.name} is near! ${BOUNTY_SIGNATURE[h.bounty.kind].lore}`, 'bad');
      }
    }
    // yesterday's bounties are taken down
    for (const id of this.slain) if (!id.endsWith(`:${day}`)) this.slain.delete(id);
  }

  /**
   * Each bounty beast's signature move: a warning on the ground first (`bomb` draws the ring and its fuse), then the
   * move lands. Runs every tick; only the few beasts out on the hunt are looked at.
   */
  private signatures(dt: number): void {
    for (const h of this.hunting.values()) {
      const e = this.room.enemies.get(h.enemy);
      if (!e || e.hp <= 0) continue;
      const sig = BOUNTY_SIGNATURE[h.bounty.kind];
      const dmg = bountySignatureDamage(h.bounty.kind, e.level);
      if (h.pending) {
        h.pending.t -= dt;
        if (h.pending.t > 0) continue;
        const at = h.pending;
        h.pending = undefined;
        this.land(h.bounty.kind, e, at, sig.radius, dmg);
        continue;
      }
      h.sigCd -= dt;
      if (h.sigCd > 0) continue;
      // only in a fight: someone within reach who has drawn its attention
      let near: ServerPlayer | null = null,
        nd = 9;
      for (const p of this.room.players.values()) {
        if (p.deadT > 0) continue;
        const d = Math.hypot(p.sim.x - e.x, p.sim.y - e.y);
        if (d < nd) ((nd = d), (near = p));
      }
      if (!near) continue;
      const frac = e.hp / e.maxHp;
      const kind = h.bounty.kind;
      if ((kind === 'wolf' || kind === 'badger') && (frac > 0.75 || h.uses >= (kind === 'wolf' ? 1 : 2))) continue;
      h.sigCd = sig.cd;
      h.uses++;
      // where it lands: on the target (rampage, burrow), around the beast (earthshaker, brambles), at its side (howl)
      const target =
        kind === 'boar'
          ? { x: near.sim.x, y: near.sim.y }
          : kind === 'badger'
            ? { x: near.sim.x - near.sim.faceX * 1.2, y: near.sim.y - near.sim.faceY * 1.2 }
            : { x: e.x, y: e.y };
      h.pending = { ...target, t: sig.warn, from: { x: e.x, y: e.y } };
      if (sig.radius > 0) this.room.fx({ kind: 'bomb', x: target.x, y: target.y, v: sig.warn, w: sig.radius });
      else this.room.fx({ kind: 'telegraph', x: e.x, y: e.y, id: e.id, v: sig.warn });
      for (const p of this.room.players.values())
        if (Math.hypot(p.sim.x - e.x, p.sim.y - e.y) < 24) p.toast(`${h.bounty.name}: ${sig.name}!`, 'bad');
    }
  }

  /** a signature move lands */
  private land(
    kind: Bounty['kind'],
    e: Enemy,
    at: { x: number; y: number; from?: { x: number; y: number } },
    radius: number,
    dmg: number,
  ): void {
    if (kind === 'wolf') {
      // the howl: two of the pack come running from the brush
      for (let i = 0; i < 2; i++) {
        const spot = this.open(Math.round(e.x + (i ? 3 : -3)), Math.round(e.y + 2));
        if (spot) this.room.spawnEnemy('wolf', spot.x + 0.5, spot.y + 0.5, false, { level: Math.max(1, e.level - 2) });
      }
      this.room.fx({ kind: 'blast', x: e.x, y: e.y, v: 2 });
      return;
    }
    if (kind === 'boar' || kind === 'badger') {
      // the charge or the burrow carries the beast to where the warning was
      const spot = this.open(Math.round(at.x), Math.round(at.y));
      if (spot) {
        this.room.fx({ kind: kind === 'boar' ? 'jump' : 'dust', x: e.x, y: e.y, dx: spot.x + 0.5, dy: spot.y + 0.5 });
        e.x = spot.x + 0.5;
        e.y = spot.y + 0.5;
        e.state.x = e.x;
        e.state.y = e.y;
      }
      if (kind === 'badger') {
        // and it comes up a little healed
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.12);
        e.state.hp = Math.round(e.hp);
      }
    }
    this.room.fx({ kind: 'blast', x: at.x, y: at.y, v: radius });
    for (const p of this.room.players.values()) {
      if (p.deadT > 0) continue;
      const dx = p.sim.x - at.x,
        dy = p.sim.y - at.y,
        d = Math.hypot(dx, dy);
      if (d > radius) continue;
      const hit = this.room.hurtPlayer(p, dmg, e, kind === 'brute' ? 3 : 1, dx / (d || 1), dy / (d || 1));
      // brambles leave you bleeding
      if (hit && kind === 'thornling') inflict(this.room, p, 'bleed');
    }
  }

  /** a walkable tile at or near (x, y) in this room */
  private open(x: number, y: number): { x: number; y: number } | null {
    const store = this.room.store;
    for (let r = 0; r <= 6; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = x + dx,
            ty = y + dy;
          if (!this.room.owns(tx, ty) || !store.has(Math.floor(tx / CHUNK_SIZE), Math.floor(ty / CHUNK_SIZE))) continue;
          if (!store.solidAt(tx, ty) && LANDING.has(store.getTile(tx, ty))) return { x: tx, y: ty };
        }
    return null;
  }

  killed(e: Enemy): void {
    for (const [id, h] of this.hunting) {
      if (h.enemy !== e.id) continue;
      this.hunting.delete(id);
      this.slain.add(id);
      for (const p of this.room.players.values()) {
        if (p.deadT > 0 || Math.hypot(p.sim.x - e.x, p.sim.y - e.y) > BOUNTY_PAY_RANGE) continue;
        p.data.coins += h.bounty.reward;
        p.dirty('coins');
        this.room.grantXp(p, 80 + p.level * 8);
        if (h.realm) gainRep(p, h.realm as Parameters<typeof gainRep>[1], 15);
        p.toast(`${h.bounty.name} is slain! ${h.bounty.town} pays the bounty: ${h.bounty.reward} coins.`, 'good');
      }
    }
  }

  // ───────────────────────── notice boards ─────────────────────────

  /** today's bounty in the town standing at (x, y), as a notice board tells it */
  bountyAt(x: number, y: number): BountyView | undefined {
    const town = townAt(this.room.seed, Math.floor(x), Math.floor(y));
    const b = town && bountyOf(this.room.seed, town, this.room.wclock.day());
    if (!b) return undefined;
    return bountyView(b, this.slain.has(b.id) ? 'slain' : this.hunting.has(b.id) ? 'out' : 'posted');
  }

  /** Every town without a request board gets a notice board by its well, once (it persists like any object). */
  ensureBoard(town: Town): void {
    if (this.boards.has(town.name) || town.abandoned || town.objects.some((o) => o.sub === 'board')) return;
    const store = this.room.store;
    const well = town.objects.find((o) => o.sub === 'well');
    const cx = well ? well.x : Math.round(town.cx),
      cy = well ? well.y : Math.round(town.cy);
    for (let dy = -10; dy <= 10; dy++)
      for (let dx = -10; dx <= 10; dx++) {
        const x = cx + dx,
          y = cy + dy;
        if (!store.has(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE))) return; // not all loaded yet
        if (store.objectAt(x, y)?.sub === 'bounty_board') {
          this.boards.add(town.name);
          return;
        }
      }
    for (let r = 2; r <= 8; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx,
            y = cy + dy;
          if (!this.room.owns(x, y) || store.solidAt(x, y) || store.objectAt(x, y) || store.structureAt(x, y)) continue;
          // keep the way around it open: the tile in front (south) must be walkable
          if (store.solidAt(x, y + 1) || store.objectAt(x, y + 1)) continue;
          this.room.objects.put({ x, y, kind: 'deco', sub: 'bounty_board', data: { town: town.name } });
          this.boards.add(town.name);
          return;
        }
  }

  /** Read a notice board: today's bounty, its kind, where it was seen, how it fights, the reward. */
  readBoard(p: ServerPlayer, o: WorldObj): void {
    const town = townAt(this.room.seed, o.x, o.y);
    const msg: PanelMsg = {
      kind: 'board',
      tx: o.x,
      ty: o.y,
      sub: 'bounty_board',
      board: { day: this.room.wclock.day(), requests: [], bounty: this.bountyAt(o.x, o.y), town: town?.name },
    };
    p.client.send(MSG.PANEL, msg);
  }

  /** for tests */
  bountyState(id: string): 'out' | 'slain' | null {
    return this.slain.has(id) ? 'slain' : this.hunting.has(id) ? 'out' : null;
  }
}
