/**
 * Festivals and royal tournaments on the server (master plan §16; rules in shared/src/pageantry.ts). A player brings
 * a dish to a festival feast once per festival, and may enter a capital's tournament on its tourney days: three
 * bouts in the lists against the kingdom's own soldiers. While a bout is fought the settlement's ward is lifted over
 * the lists only, so the champion can fight there.
 */
import {
  CHAMPION_TITLE,
  ITEMS,
  KINGDOMS,
  MSG_FEST,
  REALM_IDS,
  REALM_SITES,
  TOURNEY_BOUTS,
  TOURNEY_BOUT_SECS,
  TOURNEY_HOURS,
  armyKey,
  countItem,
  feastReward,
  festivalToday,
  homeTowns,
  inRealmLand,
  removeItem,
  tourneyOn,
  tourneyPurse,
  realmTowns,
  type FestHost,
  type RealmId,
  type TourneyState,
} from '@eigenlands/shared';
import type { Enemy } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { gainRep } from '../../systems/reputation';
import { recordCiv } from '../civ/registry';
import type { Module, Registrar } from '../types';

/** the lists: a 21×15 fenced sand ground (realm-towns.ts); half extents round its centre spot */
const LISTS_HW = 10.5,
  LISTS_HH = 7.5;
/** how far past the fence a contender may step before forfeiting */
const FORFEIT = 3;
/** pause between bouts, seconds */
const BREATHER = 3;
const HOME_REACH = 45;

interface Bout {
  pid: string;
  realm: RealmId;
  bout: number;
  enemy: string | null;
  /** room seconds when this bout is called lost, or when the next bout starts (between bouts) */
  until: number;
  next: number;
  centre: { x: number; y: number };
  foe: { x: number; y: number };
}

export class FestivalModule implements Module {
  private t = 0;
  private bouts = new Map<RealmId, Bout>();
  private lists = new Map<RealmId, { c: { x: number; y: number }; b: { x: number; y: number } } | null>();

  constructor(private room: GameRoom) {}

  install(reg: Registrar): void {
    reg.on<{ host?: unknown; act?: unknown }>(MSG_FEST.JOIN, 'board', (p, m) => this.join_(p, m));
  }

  private day(): number {
    return this.room.wclock.day();
  }

  /** whose festival land the player stands in: a kingdom's settlement, or a home town */
  hostAt(x: number, y: number): FestHost | null {
    const realm = inRealmLand(this.room.seed, x, y);
    if (realm)
      return REALM_SITES.some(
        (s) => s.realm === realm && Math.abs(x - s.cx) <= s.w / 2 + 6 && Math.abs(y - s.cy) <= s.h / 2 + 6,
      )
        ? realm
        : null;
    return homeTowns(this.room.seed).some((t) => Math.hypot(t.cx - x, t.cy - y) < HOME_REACH) ? 'home' : null;
  }

  /**
   * The capital's tourney ground: its centre and the end where the challenger rides in. Goldspire has fenced lists
   * beside its moat; the other capitals fight their tournaments in the palace square.
   */
  listsOf(realm: RealmId): { c: { x: number; y: number }; b: { x: number; y: number } } | null {
    if (this.lists.has(realm)) return this.lists.get(realm)!;
    const cap = REALM_SITES.find((s) => s.realm === realm && s.kind === 'capital')!;
    // realm towns are generated in REALM_SITES order
    const t = realmTowns(this.room.seed, this.room.store.generation)[REALM_SITES.indexOf(cap)];
    const c = t?.spots[`${cap.id}.tourney`],
      b = t?.spots[`${cap.id}.tourney_b`],
      plaza = t?.spots[`${cap.id}.plaza`];
    const out = c && b ? { c, b } : plaza ? { c: plaza, b: { x: plaza.x + 7, y: plaza.y } } : null;
    this.lists.set(realm, out);
    return out;
  }

  private inLists(realm: RealmId, x: number, y: number, slack = 0): boolean {
    const l = this.listsOf(realm);
    return !!l && Math.abs(x - (l.c.x + 0.5)) <= LISTS_HW + slack && Math.abs(y - (l.c.y + 0.5)) <= LISTS_HH + slack;
  }

  /** the ward is lifted over lists where a bout is being fought */
  warZone(x: number, y: number): boolean {
    for (const b of this.bouts.values()) if (this.inLists(b.realm, x, y, 1)) return true;
    return false;
  }

  private fest(p: ServerPlayer): string[] {
    return (p.data.prog.fest ??= []);
  }
  private mark(p: ServerPlayer, key: string): void {
    const f = this.fest(p);
    f.push(key);
    if (f.length > 40) f.splice(0, f.length - 40);
    p.dirty('stats');
  }

  private join_(p: ServerPlayer, m: { host?: unknown; act?: unknown }): void {
    const host = m.host as FestHost;
    if (host !== 'home' && !REALM_IDS.includes(host as RealmId)) return;
    if (m.act === 'feast') this.feast(p, host);
    else if (m.act === 'tourney' && host !== 'home') this.enter(p, host);
  }

  feast(p: ServerPlayer, host: FestHost): boolean {
    const day = this.day();
    const f = festivalToday(host, day);
    if (!f) return (p.toast('There is no festival today.', 'bad'), false);
    if (this.hostAt(p.sim.x, p.sim.y) !== host)
      return (p.toast(`Bring your dish to the ${f.name} itself.`, 'bad'), false);
    const key = `f:${host}:${day}`;
    if (this.fest(p).includes(key)) return (p.toast('You have already shared a dish at this feast.', 'info'), false);
    // the festival dish, or failing that any cooked food
    const signature = countItem(p.data.inv, f.feast) > 0;
    const dish = signature ? f.feast : p.data.inv.find((s) => s && ITEMS[s.id]?.kind === 'food')?.id;
    if (!dish)
      return (p.toast(`Bring a dish to share: ${ITEMS[f.feast]?.name ?? 'any cooked food'} is best.`, 'bad'), false);
    removeItem(p.data.inv, dish, 1);
    const r = feastReward(p.level, signature);
    p.data.coins += r.coins;
    p.dirty('inv', 'coins');
    this.room.grantXp(p, r.xp);
    if (host !== 'home') {
      gainRep(p, host, r.rep);
      recordCiv(this.room.seed, host, 'cheer', signature ? 2 : 1);
    }
    this.mark(p, key);
    p.toast(
      signature
        ? `The ${f.name} cheers your ${ITEMS[dish]?.name}! (+${r.coins} coins)`
        : `Your ${ITEMS[dish]?.name} is welcome at the ${f.name}. (+${r.coins} coins)`,
      'good',
    );
    return true;
  }

  /** Enter the tournament: stand in the lists of the capital on a tourney day, in the afternoon. */
  enter(p: ServerPlayer, realm: RealmId): boolean {
    const day = this.day(),
      h = this.room.wclock.hour();
    const name = KINGDOMS[realm].name;
    if (!tourneyOn(realm, day)) return (p.toast(`${name} holds no tournament today.`, 'bad'), false);
    if (h < TOURNEY_HOURS[0] || h >= TOURNEY_HOURS[1])
      return (p.toast('The lists open at noon and close at six.', 'bad'), false);
    if (p.level < 3) return (p.toast('The herald turns you away: come back at level 3.', 'bad'), false);
    if (!this.inLists(realm, p.sim.x, p.sim.y)) return (p.toast('Step into the lists to enter.', 'bad'), false);
    if (this.fest(p).includes(`t:${realm}:${day}`))
      return (p.toast('You are already this tournament’s champion.', 'info'), false);
    const cur = this.bouts.get(realm);
    if (cur) return (p.toast('A bout is being fought: wait your turn.', 'bad'), false);
    const l = this.listsOf(realm)!;
    const b: Bout = {
      pid: p.id,
      realm,
      bout: 0,
      enemy: null,
      until: 0,
      next: this.t,
      centre: { x: l.c.x + 0.5, y: l.c.y + 0.5 },
      foe: { x: l.b.x + 0.5, y: l.b.y + 0.5 },
    };
    this.bouts.set(realm, b);
    p.toast(`The herald calls your name: three bouts for the ${name} purse!`, 'good');
    return true;
  }

  /** which bout the player is fighting, for tests and the HUD */
  boutOf(p: { id: string }): { realm: RealmId; bout: number; enemy: string | null } | null {
    for (const b of this.bouts.values()) if (b.pid === p.id) return { realm: b.realm, bout: b.bout, enemy: b.enemy };
    return null;
  }

  private send(p: ServerPlayer, b: Bout, status: TourneyState['status']): void {
    const msg: TourneyState = { realm: b.realm, bout: b.bout, left: Math.max(0, Math.ceil(b.until - this.t)), status };
    p.client.send(MSG_FEST.TOURNEY, msg);
  }

  private end(b: Bout, p: ServerPlayer | undefined, won: boolean, why = ''): void {
    this.bouts.delete(b.realm);
    if (b.enemy) {
      this.room.enemies.delete(b.enemy);
      this.room.state.enemies.delete(b.enemy);
    }
    if (!p) return;
    this.send(p, b, won ? 'won' : 'lost');
    if (!won) {
      p.toast(why || 'You are beaten in the lists. Try again another bout.', 'bad');
      return;
    }
    const day = this.day();
    const purse = tourneyPurse(p.level, !!festivalToday(b.realm, day));
    p.data.coins += purse.coins;
    p.dirty('coins');
    this.room.grantXp(p, purse.xp);
    gainRep(p, b.realm, purse.rep);
    recordCiv(this.room.seed, b.realm, 'cheer', 3);
    this.mark(p, `t:${b.realm}:${day}`);
    const title = CHAMPION_TITLE[b.realm];
    const titles = (p.data.prog.titles ??= []);
    if (!titles.includes(title)) titles.push(title);
    p.dirty('stats');
    p.toast(`Champion! The crowd roars for the ${title}. (+${purse.coins} coins)`, 'good');
    for (const o of this.room.players.values())
      if (o !== p && this.inLists(b.realm, o.sim.x, o.sim.y, 30))
        o.toast(`${p.name} is crowned ${title} of ${KINGDOMS[b.realm].name}!`, 'info');
  }

  tick(_now: number, dt: number): void {
    this.t += dt;
    for (const b of [...this.bouts.values()]) {
      const p = this.room.players.get(b.pid);
      if (!p) {
        this.end(b, undefined, false);
        continue;
      }
      if (p.deadT > 0) {
        this.end(b, p, false, 'You are carried from the lists. Better luck next time.');
        continue;
      }
      if (!this.inLists(b.realm, p.sim.x, p.sim.y, FORFEIT)) {
        this.end(b, p, false, 'You left the lists and forfeit the tournament.');
        continue;
      }
      if (!b.enemy) {
        if (this.t < b.next) continue;
        // the next challenger rides in at the far end
        const kind = armyKey(b.realm, TOURNEY_BOUTS[b.bout]!);
        const e = this.room.spawnEnemy(kind, b.foe.x, b.foe.y, false, { level: Math.max(3, p.level) });
        b.enemy = e.id;
        b.until = this.t + TOURNEY_BOUT_SECS;
        this.send(p, b, 'fighting');
        continue;
      }
      if (!this.room.enemies.has(b.enemy)) {
        // gone without being struck down (despawned): the same challenger rides in again
        b.enemy = null;
        b.next = this.t + BREATHER;
        continue;
      }
      if (this.t > b.until) this.end(b, p, false, 'The herald calls time: the bout is lost.');
    }
  }

  private won(b: Bout, p: ServerPlayer): void {
    b.enemy = null;
    b.bout++;
    if (b.bout >= TOURNEY_BOUTS.length) {
      this.end(b, p, true);
      return;
    }
    b.next = this.t + BREATHER;
    b.until = b.next;
    this.send(p, b, 'fighting');
    p.toast(`Bout ${b.bout} of ${TOURNEY_BOUTS.length} won!`, 'good');
  }

  killed(e: Enemy): void {
    for (const b of this.bouts.values())
      if (b.enemy === e.id) {
        const p = this.room.players.get(b.pid);
        if (p) this.won(b, p);
      }
  }

  leave(p: ServerPlayer): void {
    for (const b of [...this.bouts.values()]) if (b.pid === p.id) this.end(b, undefined, false);
  }
}
