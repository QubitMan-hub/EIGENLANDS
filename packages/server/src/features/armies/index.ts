import { questEvent } from '../../systems/quests';
/**
 * Standing armies and border wars (world revision 5). Settlements are garrisoned by their kingdom's soldiers, who
 * patrol the walls and fight anything hostile; the seasonal war calendar (shared wars.ts) sends raiding parties of a
 * rival realm against a settlement when a player is near enough to see it. Garrison units reuse the enemy AI aimed at
 * hostiles (like Shadow Army companions); raiders are ordinary enemies flagged with their realm, so players fight,
 * loot and level against them exactly as against any monster. Nothing is simulated while no player is nearby.
 */
import {
  ARMY_CLASSES,
  KINGDOMS,
  REALM_BEAST,
  REALM_GEO,
  REALM_IDS,
  REALM_SITES,
  ShadowState,
  armyKey,
  findPath,
  garrisonOf,
  moveBody,
  raidHeadline,
  raidsOn,
  shapeHits,
  type RaidPlan,
  type RealmSite,
  type StrikeShape,
} from '@eigenlands/shared';
import type { Schema } from '@colyseus/schema';
import { createEnemy, enemyDamage, lineOfSight, stepEnemy, type Enemy, type Target } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { gainRep } from '../../systems/reputation';
import type { Module, Registrar } from '../types';

const NEAR = 120; // a garrison exists while a player is this close to its settlement
const FAR = 190;
const RAID_NEAR = 150;
const RAID_SECS = 260;
const MAX_UNITS = 48;

interface AUnit {
  id: string;
  site: RealmSite;
  cls: number;
  en: Enemy;
  st: ShadowState;
  route: Array<[number, number]>;
  leg: number;
  path?: Array<[number, number]>;
  pathAt?: number;
  wait: number;
  chargeHits: Set<string>;
  defender: boolean;
}
interface ActiveRaid {
  plan: RaidPlan;
  ids: Set<string>;
  started: number;
  goal: { x: number; y: number };
  killed: number;
  contrib: Set<string>;
  total: number;
}

let seq = 0;

export class ArmyModule implements Module {
  private units = new Map<string, AUnit>();
  private raids = new Map<string, ActiveRaid>();
  private done = new Set<string>();
  private t = 0;
  private checkT = 0;
  private cooldown = new Map<string, number>();
  private plans: { day: number; list: RaidPlan[] } = { day: -1, list: [] };
  /** last outcome per site id, for rumours and the Journal */
  readonly results = new Map<string, { day: number; text: string; repelled: boolean }>();

  constructor(private room: GameRoom) {}

  install(_reg: Registrar): void {}

  // ───────────────────────── helpers ─────────────────────────

  private nearest(site: RealmSite): number {
    let d = Infinity;
    for (const p of this.room.players.values()) d = Math.min(d, Math.hypot(p.sim.x - site.cx, p.sim.y - site.cy));
    return d;
  }
  private maxLevel(): number {
    let l = 1;
    for (const p of this.room.players.values()) l = Math.max(l, p.level);
    return l;
  }
  private routeOf(site: RealmSite, phase: number, inner = false): Array<[number, number]> {
    const a = inner
        ? site.kind === 'capital'
          ? 26
          : 16
        : Math.min(Math.floor(site.w / 2) - 14, site.kind === 'capital' ? 92 : 30),
      b = inner
        ? site.kind === 'capital'
          ? 14
          : 9
        : Math.min(Math.floor(site.h / 2) - 14, site.kind === 'capital' ? 70 : 24);
    const pts: Array<[number, number]> = [
      [site.cx - a, site.cy - b],
      [site.cx, site.cy - b],
      [site.cx + a, site.cy - b],
      [site.cx + a, site.cy],
      [site.cx + a, site.cy + b],
      [site.cx, site.cy + b],
      [site.cx - a, site.cy + b],
      [site.cx - a, site.cy],
    ];
    return pts.map((_, i) => pts[(i + phase) % pts.length]!);
  }
  private freeSpot(x: number, y: number, r = 6): [number, number] {
    const solid = this.room.store.solidAt;
    for (let i = 0; i < 24; i++) {
      const a = this.room.rand() * Math.PI * 2,
        d = i < 2 ? 0 : 1 + this.room.rand() * r;
      const px = x + Math.cos(a) * d,
        py = y + Math.sin(a) * d;
      if (!solid(Math.floor(px), Math.floor(py))) return [px + 0.5 - 0.5, py];
    }
    return [x, y];
  }

  // ───────────────────────── garrisons ─────────────────────────

  private spawnUnit(site: RealmSite, clsIndex: number, defender: boolean, at?: [number, number]): AUnit | null {
    if (this.units.size >= MAX_UNITS) return null;
    const cls = ARMY_CLASSES[clsIndex]!;
    const en = createEnemy(armyKey(site.realm, cls), 0, 0, false, { level: Math.max(1, this.maxLevel() - 1) });
    const route = this.routeOf(site, Math.floor(this.room.rand() * 8), clsIndex % 2 === 0 || site.kind === 'village');
    const start = at ?? this.freeSpot(route[0]![0], route[0]![1], 3);
    en.x = start[0];
    en.y = start[1];
    en.state.x = en.x;
    en.state.y = en.y;
    const st = new ShadowState();
    const id = `a${++seq}`;
    st.id = id;
    st.owner = site.realm;
    st.name = `${en.def.name}`;
    st.kind = en.def.kind;
    st.bonded = true;
    const u: AUnit = { id, site, cls: clsIndex, en, st, route, leg: 1, wait: 0, chargeHits: new Set(), defender };
    this.units.set(id, u);
    this.room.state.army.set(id, st);
    this.sync(u);
    return u;
  }

  private removeUnit(u: AUnit): void {
    this.units.delete(u.id);
    this.room.state.army.delete(u.id);
  }

  private maintain(): void {
    for (const site of REALM_SITES) {
      const d = this.nearest(site);
      const have = [0, 0, 0, 0];
      for (const u of this.units.values()) if (u.site === site && !u.defender) have[u.cls]!++;
      if (d > FAR) {
        for (const u of [...this.units.values()]) if (u.site === site && !u.defender) this.removeUnit(u);
        continue;
      }
      if (d > NEAR) continue;
      const want = garrisonOf(site);
      for (let c = 0; c < 4; c++) {
        const key = `${site.id}:${c}`;
        if (have[c]! < want[c]! && this.t >= (this.cooldown.get(key) ?? 0)) {
          if (this.spawnUnit(site, c, false)) this.cooldown.set(key, this.t + 4);
        }
      }
    }
  }

  // ───────────────────────── per tick ─────────────────────────

  tick(_now: number, dt: number): void {
    this.t += dt;
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 1;
      this.maintain();
      this.runRaids();
    }
    const tick = this.room.state.tick;
    const hostile = this.hostiles();
    let i = 0;
    for (const u of [...this.units.values()]) this.stepUnit(u, i++, dt, tick, hostile);
    for (const r of this.raids.values()) this.marchRaiders(r, dt);
  }

  private hostiles(): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.room.enemies.values())
      if (e.hp > 0 && !e.def.passive && (!e.def.neutral || e.provoked)) out.push(e);
    return out;
  }

  private stepUnit(u: AUnit, index: number, dt: number, tick: number, hostile: Enemy[]): void {
    const en = u.en,
      solid = this.room.store.solidAt;
    if (en.hp <= 0) return;
    if (en.mode !== 'charge') u.chargeHits.clear();
    if (en.hp < en.maxHp && en.mode === 'idle') en.hp = Math.min(en.maxHp, en.hp + en.maxHp * 0.02 * dt);
    const reach = en.def.sight;
    const targets: Target[] = [];
    for (const h of hostile)
      if (Math.hypot(h.x - en.x, h.y - en.y) <= reach && Math.hypot(h.x - u.site.cx, h.y - u.site.cy) < 70)
        if (lineOfSight(solid, en.x, en.y, h.x, h.y)) targets.push({ id: h.id, x: h.x, y: h.y, alive: true });
    const committed = en.mode === 'windup' || en.mode === 'leap' || en.mode === 'charge';
    if (targets.length || committed) {
      stepEnemy(en, dt, tick, targets, solid, this.room.rand, this.hooks(u), {
        allies: [],
        engaged: new Map(),
        casting: new Map(),
      });
      this.sync(u);
      return;
    }
    // patrol: walk the wall loop, pausing at corners
    en.mode = 'idle';
    en.atk = 0;
    en.state.tele = 0;
    en.targetId = null;
    if (u.wait > 0) {
      u.wait -= dt;
      u.st.st = 0;
      this.sync(u, 0);
      return;
    }
    const [gx, gy] = u.route[u.leg]!;
    let tx = gx,
      ty = gy;
    if (!lineOfSight(solid, en.x, en.y, gx, gy)) {
      if (this.t >= (u.pathAt ?? 0) || !u.path) {
        u.path = findPath(Math.floor(en.x), Math.floor(en.y), Math.floor(gx), Math.floor(gy), solid, 700) ?? [];
        u.pathAt = this.t + 1.5;
      }
      while (u.path?.length && Math.hypot(u.path[0]![0] + 0.5 - en.x, u.path[0]![1] + 0.5 - en.y) < 0.35)
        u.path.shift();
      if (u.path?.length) {
        tx = u.path[0]![0] + 0.5;
        ty = u.path[0]![1] + 0.5;
      }
    } else u.path = undefined;
    const dx = tx - en.x,
      dy = ty - en.y,
      d = Math.hypot(dx, dy);
    if (Math.hypot(gx - en.x, gy - en.y) < 1.6) {
      u.leg = (u.leg + 1) % u.route.length;
      u.wait = 1 + this.room.rand() * 3;
      u.path = undefined;
    } else if (d > 0.01) {
      const speed = en.def.speed * 0.55;
      const step = Math.min(d, speed * dt);
      moveBody(en, (dx / d) * step, (dy / d) * step, en.def.radius, solid);
      en.state.faceX = dx / d;
      en.state.faceY = dy / d;
      this.sync(u, 1);
      return;
    }
    this.sync(u, 0);
    void index;
  }

  private sync(u: AUnit, forceSt?: number): void {
    const en = u.en,
      s = u.st;
    s.x = en.x;
    s.y = en.y;
    s.faceX = en.state.faceX;
    s.faceY = en.state.faceY;
    s.hp = Math.max(0, Math.round(en.hp));
    s.maxHp = Math.round(en.maxHp);
    s.level = en.level;
    s.st = forceSt ?? en.state.st;
    s.tele = en.state.tele;
    s.atk = en.state.atk;
    s.tx = en.state.tx;
    s.ty = en.state.ty;
  }

  /** garrison blows land on hostile enemies (no kill credit: soldiers do not level players) */
  private hooks(u: AUnit) {
    const en = u.en;
    const hit = (e: Enemy, dmg: number, kb: number) => {
      const dx = e.x - en.x,
        dy = e.y - en.y,
        d = Math.hypot(dx, dy) || 1;
      this.room.hitEnemy(e, dmg, null, dx / d, dy / d, kb);
      if (e.hp > 0 && e.def.neutral) e.provoked = true;
    };
    return {
      telegraph: () => {},
      strike: (_e: Enemy, x: number, y: number, r: number, mult = 1) => {
        const dmg = enemyDamage(en, mult);
        for (const e of this.hostiles())
          if (Math.hypot(e.x - x, e.y - y) <= r + e.def.radius) hit(e, dmg, mult > 1 ? 6 : 3);
      },
      lane: (_e: Enemy, ax: number, ay: number, bx: number, by: number, w: number) => {
        const shape: StrikeShape = { kind: 'lane', ax, ay, bx, by, w };
        for (const e of this.hostiles())
          if (!u.chargeHits.has(e.id) && shapeHits(shape, { x: e.x, y: e.y, r: e.def.radius })) {
            u.chargeHits.add(e.id);
            hit(e, enemyDamage(en, 1.3), 8);
          }
      },
      fire: (_e: Enemy, dx: number, dy: number) => {
        let best: Enemy | null = null,
          bd = 11;
        for (const e of this.hostiles()) {
          const t = (e.x - en.x) * dx + (e.y - en.y) * dy;
          if (t < 0 || t > bd) continue;
          if (Math.hypot(en.x + dx * t - e.x, en.y + dy * t - e.y) <= e.def.radius + 0.35) {
            bd = t;
            best = e;
          }
        }
        this.room.fx({ kind: 'orb', x: en.x, y: en.y, dx, dy, id: u.id });
        if (best) hit(best, enemyDamage(en), 3);
      },
    };
  }

  // ───────────────────────── enemies attacking the garrison ─────────────────────────

  targets(): Target[] {
    const out: Target[] = [];
    for (const u of this.units.values()) if (u.en.hp > 0) out.push({ id: u.id, x: u.en.x, y: u.en.y, alive: true });
    return out;
  }

  strikeUnits(e: Enemy, shape: StrikeShape, dmg: number): void {
    if (e.state.fac === 0 && !this.units.size) return;
    for (const u of [...this.units.values()]) {
      if (u.en.hp <= 0 || !shapeHits(shape, { x: u.en.x, y: u.en.y, r: 0.45 })) continue;
      this.hurt(u, Math.max(1, Math.round(dmg * 0.8)));
    }
  }

  /** a hostile archer or mage shot: the first soldier along the ray takes it */
  shot(e: Enemy, dx: number, dy: number): void {
    let best: AUnit | null = null,
      bd = 10;
    for (const u of this.units.values()) {
      const t = (u.en.x - e.x) * dx + (u.en.y - e.y) * dy;
      if (t < 0 || t > bd) continue;
      if (Math.hypot(e.x + dx * t - u.en.x, e.y + dy * t - u.en.y) <= u.en.def.radius + 0.35) {
        bd = t;
        best = u;
      }
    }
    if (best) this.hurt(best, enemyDamage(e));
  }

  private hurt(u: AUnit, dmg: number): void {
    const en = u.en;
    en.hp -= dmg;
    en.flinchT = 0.1;
    this.room.fx({ kind: 'hit', x: en.x, y: en.y, v: dmg, id: u.id, w: 0, c: 0, s: 0 });
    if (en.hp <= 0) {
      this.room.fx({ kind: 'die', x: en.x, y: en.y, id: u.id, v: en.def.kind, w: 0 });
      this.cooldown.set(`${u.site.id}:${u.cls}`, this.t + 60);
      this.removeUnit(u);
    } else this.sync(u);
  }

  // ───────────────────────── raids ─────────────────────────

  private todays(): RaidPlan[] {
    const day = this.room.wclock.day();
    if (this.plans.day !== day) this.plans = { day, list: raidsOn(this.room.seed, day) };
    return this.plans.list;
  }

  private runRaids(): void {
    const hour = this.room.wclock.hour();
    for (const plan of this.todays()) {
      if (this.done.has(plan.id) || this.raids.has(plan.id)) continue;
      const site = REALM_SITES.find((s) => s.id === plan.siteId);
      if (!site || hour < plan.hour || hour >= plan.hour + 8) continue;
      if (this.nearest(site) > RAID_NEAR) continue;
      this.startRaid(plan, site);
    }
    for (const r of [...this.raids.values()]) {
      for (const id of [...r.ids]) if (!this.room.enemies.has(id)) r.ids.delete(id);
      const elapsed = this.t - r.started;
      if (!r.ids.size) this.finishRaid(r, true);
      else if (elapsed > RAID_SECS) {
        for (const id of r.ids) {
          this.room.enemies.delete(id);
          this.room.state.enemies.delete(id);
        }
        r.ids.clear();
        this.finishRaid(r, false);
      }
    }
  }

  private startRaid(plan: RaidPlan, site: RealmSite): void {
    const ai = REALM_IDS.indexOf(plan.attacker);
    const g = REALM_GEO[plan.attacker];
    const dx = g.cx - site.cx,
      dy = g.cy - site.cy,
      dl = Math.hypot(dx, dy) || 1;
    const edge = Math.max(site.w, site.h) / 2 + 34;
    const sx = site.cx + (dx / dl) * edge,
      sy = site.cy + (dy / dl) * edge;
    const level = Math.max(1, this.maxLevel() + (plan.scale - 1));
    const raid: ActiveRaid = {
      plan,
      ids: new Set(),
      started: this.t,
      goal: { x: site.cx, y: site.cy },
      killed: 0,
      contrib: new Set(),
      total: 0,
    };
    const add = (kind: Parameters<GameRoom['spawnEnemy']>[0]) => {
      const [x, y] = this.freeSpot(sx, sy, 7);
      const e = this.room.spawnEnemy(kind, x, y, false, { level });
      e.state.fac = ai + 1;
      raid.ids.add(e.id);
      raid.total++;
    };
    plan.party.forEach((n, ci) => {
      for (let i = 0; i < n; i++) add(armyKey(plan.attacker, ARMY_CLASSES[ci]!));
    });
    if (plan.beast && this.maxLevel() >= 3) add(REALM_BEAST[plan.attacker]);
    // the garrison is reinforced from the gates
    const extra = plan.scale === 1 ? 1 : plan.scale === 2 ? 3 : 6;
    for (let i = 0; i < extra; i++) {
      const u = this.spawnUnit(site, i % 3 === 1 ? 1 : 0, true, this.freeSpot(site.cx, site.cy, 6));
      if (u) u.en.hp = u.en.maxHp = Math.round(u.en.maxHp * 1.2);
    }
    this.raids.set(plan.id, raid);
    const name = this.siteName(site);
    for (const p of this.room.players.values())
      if (Math.hypot(p.sim.x - site.cx, p.sim.y - site.cy) < 260) {
        p.toast(`${raidHeadline(plan, name)}!`, 'bad');
        this.room.fx({ kind: 'poof', x: sx, y: sy }, undefined, 400);
      }
  }

  private siteName(site: RealmSite): string {
    const def = KINGDOMS[site.realm];
    return site.kind === 'capital'
      ? def.capital
      : site.kind === 'town'
        ? def.names.towns[site.ring as 'n']
        : site.kind === 'village'
          ? def.names.villages[site.ring as 'n']
          : def.names.seaward[site.ring as 'n'];
  }

  private marchPaths = new Map<string, { path: Array<[number, number]>; at: number }>();
  private marchRaiders(r: ActiveRaid, dt: number): void {
    const solid = this.room.store.solidAt;
    let planned = 0;
    for (const id of r.ids) {
      const e = this.room.enemies.get(id);
      if (!e || e.hp <= 0) continue;
      if (e.mode === 'windup' || e.mode === 'charge' || e.mode === 'leap' || e.mode === 'stagger') continue;
      // anything worth fighting nearby: players and the garrison are handled by the enemy AI itself
      if (e.targetId) continue;
      let gx = r.goal.x,
        gy = r.goal.y;
      if (!lineOfSight(solid, e.x, e.y, gx, gy)) {
        let m = this.marchPaths.get(id);
        if ((!m || this.t >= m.at) && planned < 1) {
          planned++;
          m = {
            path: findPath(Math.floor(e.x), Math.floor(e.y), Math.floor(gx), Math.floor(gy), solid, 6000) ?? [],
            at: this.t + 4,
          };
          this.marchPaths.set(id, m);
        }
        while (m?.path.length && Math.hypot(m.path[0]![0] + 0.5 - e.x, m.path[0]![1] + 0.5 - e.y) < 0.4) m.path.shift();
        if (m?.path.length) {
          gx = m.path[0]![0] + 0.5;
          gy = m.path[0]![1] + 0.5;
        }
      }
      const dx = gx - e.x,
        dy = gy - e.y,
        d = Math.hypot(dx, dy);
      if (Math.hypot(r.goal.x - e.x, r.goal.y - e.y) < 3) continue;
      const step = e.def.speed * 0.8 * dt;
      moveBody(e, (dx / d) * step, (dy / d) * step, e.def.radius, solid);
      e.state.faceX = dx / d;
      e.state.faceY = dy / d;
      e.state.st = 1;
    }
  }

  private finishRaid(r: ActiveRaid, repelled: boolean): void {
    this.raids.delete(r.plan.id);
    this.done.add(r.plan.id);
    const site = REALM_SITES.find((s) => s.id === r.plan.siteId)!;
    const name = this.siteName(site);
    const day = this.room.wclock.day();
    const text = repelled
      ? `The ${KINGDOMS[r.plan.attacker].name} assault on ${name} was beaten back.`
      : `${KINGDOMS[r.plan.attacker].name} raiders plundered ${name} and withdrew.`;
    this.results.set(site.id, { day, text, repelled });
    for (const p of this.room.players.values()) {
      if (Math.hypot(p.sim.x - site.cx, p.sim.y - site.cy) > 300) continue;
      p.toast(text, repelled ? 'good' : 'bad');
      if (repelled && r.contrib.has(p.id)) {
        const rep = 25 * r.plan.scale,
          coins = 30 * r.plan.scale;
        questEvent(p, { type: 'discover', target: `guild:defend:${r.plan.defender}`, n: 1 });
        gainRep(p, r.plan.defender, rep);
        p.data.coins += coins;
        p.dirty('coins');
        p.toast(`${KINGDOMS[r.plan.defender].name} thanks you: +${rep} standing, +${coins} coins.`, 'good');
      }
    }
    // reinforcements go home
    for (const u of [...this.units.values()]) if (u.defender && u.site === site) u.defender = false;
  }

  killed(e: Enemy, killer: ServerPlayer | undefined): void {
    if (!e.state.fac) return;
    for (const r of this.raids.values())
      if (r.ids.has(e.id)) {
        r.killed++;
        if (killer) {
          r.contrib.add(killer.id);
          gainRep(killer, r.plan.defender, 4 * r.plan.scale, true);
        }
      }
  }

  viewEntities(push: (id: string, x: number, y: number, st: Schema) => void): void {
    this.room.state.army.forEach((s, id) => push(`ar:${id}`, s.x, s.y, s));
  }

  /** the ward of a settlement is lifted while a war party assaults it, so everyone there can fight */
  warZone(x: number, y: number): boolean {
    for (const r of this.raids.values()) {
      const s = REALM_SITES.find((q) => q.id === r.plan.siteId)!;
      if (Math.abs(x - s.cx) <= s.w / 2 + 4 && Math.abs(y - s.cy) <= s.h / 2 + 4) return true;
    }
    return false;
  }

  /** test and Journal access */
  activeRaids(): ActiveRaid[] {
    return [...this.raids.values()];
  }
  garrison(): AUnit[] {
    return [...this.units.values()];
  }
  startNow(plan: RaidPlan): boolean {
    const site = REALM_SITES.find((s) => s.id === plan.siteId);
    if (!site || this.raids.has(plan.id)) return false;
    this.startRaid(plan, site);
    return true;
  }
}
