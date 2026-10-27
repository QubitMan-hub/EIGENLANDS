/**
 * Wonders and hunts on the server (shared rules in shared/src/wonders.ts).
 *
 * Starfall: on a starfall night one star comes down near each traveller out in the open, a little way off, with a
 * flash and a word of where it fell. It lies glowing until mid-morning; anyone may break it open for star shards.
 *
 * Bounties: each town posts a beast to hunt today. Walk into the town and you hear of it; go out toward where it was
 * seen and it is there, hardened and a level above you. Everyone near when it falls is paid, once per bounty.
 */
import {
  CHUNK_SIZE,
  BOUNTY_SIGNATURE,
  ELITE,
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
    }
  >();
  /** bounties already brought down today */
  private slain = new Set<string>();
  /** account -> bounty ids they have heard of */
  private heard = new Map<string, Set<string>>();

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

  // ───────────────────────── bounties ─────────────────────────

  private bounties(): void {
    const day = this.room.wclock.day();
    for (const p of this.room.players.values()) {
      if (p.deadT > 0 || !outdoors(p.sim.y)) continue;
      // hearing of it: walk into a town that has posted one
      const here = townAt(this.room.seed, Math.floor(p.sim.x), Math.floor(p.sim.y));
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
        e.provoked = false;
        this.hunting.set(b.id, { enemy: e.id, bounty: b, realm: t.site?.realm, sigCd: 4, uses: 0 });
        for (const q of this.room.players.values())
          if (Math.hypot(q.sim.x - at.x, q.sim.y - at.y) < 30)
            q.toast(`${b.name} is near! ${BOUNTY_SIGNATURE[b.kind].lore}`, 'bad');
      }
    }
    // a beast that wandered out of the world (despawned unkilled) may be met again
    for (const [id, h] of this.hunting) if (!this.room.enemies.has(h.enemy)) this.hunting.delete(id);
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
      if ((kind === 'wolf' || kind === 'badger') && (frac > 0.75 || h.uses >= 2)) continue;
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

  /** for tests */
  bountyState(id: string): 'out' | 'slain' | null {
    return this.slain.has(id) ? 'slain' : this.hunting.has(id) ? 'out' : null;
  }
}
