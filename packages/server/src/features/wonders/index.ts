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
  BOUNTY_PACK_AT,
  BOUNTY_STYLE,
  CHUNK_SIZE,
  ELITE,
  MSG,
  bountyView,
  type BountyView,
  type PanelMsg,
  type Town,
  FALLEN_STAR_SHARDS,
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
  private hunting = new Map<string, { enemy: string; bounty: Bounty; realm?: string; howled?: boolean }>();
  /** towns whose notice board has been checked for this session (name) */
  private boards = new Set<string>();
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
        if (!at) continue;
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
        this.hunting.set(b.id, { enemy: e.id, bounty: b, realm: t.site?.realm });
      }
    }
    // a wounded wolf bounty howls in its pack, once
    for (const h of this.hunting.values()) {
      const e = this.room.enemies.get(h.enemy);
      if (!e || h.howled || h.bounty.kind !== 'wolf' || e.hp > e.maxHp * BOUNTY_PACK_AT) continue;
      h.howled = true;
      for (const k of [-1, 1]) {
        const at = this.open(Math.round(e.x + k * 3), Math.round(e.y + 2));
        if (at) this.room.spawnEnemy('wolf', at.x + 0.5, at.y + 0.5, false, { level: e.level });
      }
      for (const q of this.room.players.values())
        if (Math.hypot(q.sim.x - e.x, q.sim.y - e.y) < 30)
          q.toast(`${h.bounty.name} howls, and its pack answers!`, 'bad');
    }
    // a beast that wandered out of the world (despawned unkilled) may be met again
    for (const [id, h] of this.hunting) if (!this.room.enemies.has(h.enemy)) this.hunting.delete(id);
    // yesterday's bounties are taken down
    for (const id of this.slain) if (!id.endsWith(`:${day}`)) this.slain.delete(id);
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
