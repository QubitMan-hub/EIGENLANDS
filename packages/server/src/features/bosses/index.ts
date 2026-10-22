/**
 * Bosses: called with a crafted item, scaled to the summoner's level, with phases and scripted specials on top of the
 * ordinary enemy AI (leap / charge / slam). Killing one pays out through the normal drop table (guaranteed here) and
 * records the first kill on the character. See docs/design/adventure.md.
 */
import { BOSS_BY_ITEM, BOSS_BY_KIND, MSG34, townFor, type BossDef, type BossEvent, type BossId } from '@eigenlands/shared';
import type { Enemy, EnemyKind } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import type { Module, Registrar } from '../types';

interface Run {
  def: BossDef;
  e: Enemy;
  phase: number;
  nextSpecial: number;
  rage: boolean;
  summoner: string;
  /** scheduled effects (telegraphed rings etc.): fire when `t` reaches `at` */
  later: Array<{ at: number; fn: () => void }>;
  born: number;
}

const KEY: Record<BossId, EnemyKind> = { slime_king: 'slime_king', warden: 'warden', colossus: 'colossus' };
const SPECIAL_EVERY: Record<BossId, number> = { slime_king: 9, warden: 8, colossus: 7 };

export class BossModule implements Module {
  private runs = new Map<string, Run>();
  private t = 0;

  constructor(private room: GameRoom) {}

  install(_reg: Registrar): void { /* bosses are driven by items and the tick */ }

  // ───────────────────────── summoning ─────────────────────────

  summon(p: ServerPlayer, itemId: string, x: number, y: number): boolean {
    const def = BOSS_BY_ITEM[itemId];
    if (!def) return false;
    if (p.level < def.level) { p.toast(`The ${def.name} would crush you. (Level ${def.level} needed.)`, 'bad'); return false; }
    for (const r of this.runs.values()) if (r.def.id === def.id && Math.hypot(r.e.x - p.sim.x, r.e.y - p.sim.y) < 120) { p.toast(`The ${def.name} is already here.`, 'bad'); return false; }
    const t = townFor(this.room.seed);
    if (Math.hypot(x, y) < def.townGap || Math.hypot(x - t.cx, y - t.cy) < def.townGap + 25) { p.toast('The summoning fizzles: too close to home. Go further out.', 'bad'); return false; }
    if (this.room.store.solidAt(Math.floor(x), Math.floor(y))) { p.toast('There is no room to call it here.', 'bad'); return false; }
    const e = this.room.spawnEnemy(KEY[def.id], x, y, false, { level: Math.max(p.level, def.level) });
    this.runs.set(e.id, { def, e, phase: 0, nextSpecial: this.t + 6, rage: false, summoner: p.id, later: [], born: this.t });
    this.say(x, y, { kind: 'start', boss: def.id, name: def.name, intro: def.intro });
    this.room.fx({ kind: 'crash', x, y, id: e.id, dx: 0, dy: 1 });
    return true;
  }

  // ───────────────────────── fight ─────────────────────────

  tick(_now: number, dt: number): void {
    this.t += dt;
    for (const [id, r] of [...this.runs]) {
      const e = r.e;
      if (!this.room.enemies.has(id) || e.hp <= 0) { this.runs.delete(id); continue; }
      // run scheduled effects
      for (const l of [...r.later]) if (l.at <= this.t) { r.later.splice(r.later.indexOf(l), 1); l.fn(); }
      const ratio = e.hp / e.maxHp;
      while (r.phase < r.def.phases.length && ratio <= r.def.phases[r.phase]!) { r.phase++; this.phaseUp(r); }
      if (this.t >= r.nextSpecial && e.mode !== 'stagger' && this.hasTarget(e)) {
        r.nextSpecial = this.t + SPECIAL_EVERY[r.def.id] * (r.rage ? 0.7 : 1);
        this.special(r);
      }
    }
  }

  private hasTarget(e: Enemy): boolean {
    for (const p of this.room.players.values()) if (p.deadT <= 0 && Math.hypot(p.sim.x - e.x, p.sim.y - e.y) < e.def.sight) return true;
    return false;
  }

  private phaseUp(r: Run): void {
    const e = r.e, id = r.def.id;
    const say = (text: string) => this.say(e.x, e.y, { kind: 'phase', boss: id, phase: r.phase, text });
    this.room.fx({ kind: 'stagger', x: e.x, y: e.y, id: e.id });
    if (id === 'slime_king') {
      if (r.phase === 1) { say('It splits! Slimes spill from its body.'); this.spawnAdds(r, 'slime', 4); }
      else { say('The Sovereign boils with rage.'); r.rage = true; e.speedMult = 1.4; e.windMult = 0.8; this.spawnAdds(r, 'slime', 3); }
    } else if (id === 'warden') {
      say('The Warden bellows. The pack answers.'); r.rage = true; e.speedMult = 1.3; e.windMult = 0.85; this.spawnAdds(r, 'wolf', 2);
    } else {
      if (r.phase === 1) say('The Colossus phases out of sync with itself.');
      else { say('It is everywhere at once.'); r.rage = true; e.speedMult = 1.3; e.windMult = 0.85; }
    }
  }

  private spawnAdds(r: Run, kind: EnemyKind, n: number): void {
    const e = r.e;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.t, x = e.x + Math.cos(a) * 2.6, y = e.y + Math.sin(a) * 2.6;
      if (this.room.store.solidAt(Math.floor(x), Math.floor(y))) continue;
      this.room.spawnEnemy(kind, x, y, false, { level: Math.max(1, e.level - 3) });
    }
  }

  private special(r: Run): void {
    const e = r.e, id = r.def.id;
    const target = [...this.room.players.values()].filter((p) => p.deadT <= 0).sort((a, b) => Math.hypot(a.sim.x - e.x, a.sim.y - e.y) - Math.hypot(b.sim.x - e.x, b.sim.y - e.y))[0];
    if (!target) return;
    if (id === 'slime_king') {
      // Gel Rain: a ring of slow orbs, then (when enraged) a second one rotated half a step
      const ring = (off: number) => { for (let i = 0; i < 8; i++) { const a = off + (i / 8) * Math.PI * 2; this.room.fireOrbs(e, Math.cos(a), Math.sin(a)); } };
      ring(0);
      if (r.rage) r.later.push({ at: this.t + 0.6, fn: () => ring(Math.PI / 8) });
    } else if (id === 'warden') {
      // Howl: wolves answer, and the Warden surges at its target
      this.room.fx({ kind: 'stagger', x: e.x, y: e.y, id: e.id });
      this.spawnAdds(r, 'wolf', r.rage ? 3 : 2);
    } else {
      // Fault Line: three expanding rings with a clear telegraph each, plus an orb storm once past the first phase
      for (let i = 0; i < 3; i++) {
        const radius = 3 + i * 2, delay = 1.0 + i * 0.55;
        r.later.push({ at: this.t, fn: () => this.room.fx({ kind: 'bomb', x: e.x, y: e.y, v: delay, w: radius, id: `${e.id}r${i}` }) });
        r.later.push({ at: this.t + delay, fn: () => { if (this.room.enemies.has(e.id)) this.room.enemyStrike(e, e.x, e.y, radius, 0.9); } });
      }
      if (r.phase >= 1) for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; this.room.fireOrbs(e, Math.cos(a), Math.sin(a)); }
    }
  }

  private say(x: number, y: number, ev: BossEvent): void {
    for (const q of this.room.nearby(x, y, 90)) q.client.send(MSG34.BOSS_EV, ev);
  }

  // ───────────────────────── rewards ─────────────────────────

  killed(e: Enemy, killer: ServerPlayer | undefined): void {
    const def = BOSS_BY_KIND[e.def.kind];
    if (!def) return;
    this.runs.delete(e.id);
    for (const q of this.room.nearby(e.x, e.y, 60)) {
      const first = !q.data.prog.bosses.includes(def.id);
      if (first) { q.data.prog.bosses.push(def.id); q.dirty('inv'); }
      q.client.send(MSG34.BOSS_EV, { kind: 'defeated', boss: def.id, name: def.name, first } satisfies BossEvent);
      if (first) q.toast(`First victory over the ${def.name}!`, 'good');
    }
    void killer;
  }

  debug(): { bosses: number } { return { bosses: this.runs.size }; }
}
