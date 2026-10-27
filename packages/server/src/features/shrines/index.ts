/**
 * Resonance Shrines: a Simon-says Resonance puzzle (watch the pillars light up, strike them in order) and a three-wave
 * Gauntlet. Solving one pays a Shrine Shard, coins and XP, once per character. Placement lives in shared/shrines.ts.
 */
import {
  MSG34,
  SHRINE_REACH,
  shrineOfId,
  trapSafe,
  toggleShrineLantern,
  type Stack,
  type Shrine,
  type ShrineEvent,
  type WorldObj,
} from '@eigenlands/shared';
import type { EnemyKind } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { giveStacks } from '../../systems/helpers';
import type { Module, Registrar } from '../types';

interface Session {
  shrine: Shrine;
  player: string;
  /** sequence puzzle */
  pattern: number[];
  stage: number;
  fails: number;
  /** gauntlet */
  wave: number;
  enemies: Set<string>;
  until: number;
  mask: number;
  ready: boolean;
  gift?: Stack[];
  hopUntil?: number;
  landing?: { x: number; y: number };
  hitUntil?: number;
}

const STEP_MS = 650;
const WAVES: EnemyKind[][] = [
  ['slime', 'slime', 'hopper'],
  ['hopper', 'wisp', 'wisp', 'slime'],
  ['brute', 'wisp', 'hopper'],
];

export class ShrineModule implements Module {
  private sessions = new Map<string, Session>();
  private t = 0;

  constructor(private room: GameRoom) {}

  install(_reg: Registrar): void {
    /* driven by OPEN on the static objects */
  }

  private shrineById(id: string): Shrine | null {
    return shrineOfId(this.room.seed, id);
  }

  private send(p: ServerPlayer, ev: ShrineEvent): void {
    p.client.send(MSG34.SHRINE_EV, ev);
  }

  async join(p: ServerPlayer): Promise<void> {
    this.send(p, { kind: 'state', solved: p.data.prog.shrines });
  }

  leave(p: ServerPlayer): void {
    for (const [id, s] of this.sessions) if (s.player === p.id) this.abort(id, s);
  }

  /** An object of a shrine was interacted with (OPEN on a static shrine_altar / shrine_pillar). */
  interact(p: ServerPlayer, o: WorldObj): void {
    const sid = String((o.data as { shrine?: string } | undefined)?.shrine ?? '');
    const sh = this.shrineById(sid);
    if (!sh || Math.hypot(sh.x - p.sim.x, sh.y - p.sim.y) > SHRINE_REACH + 4) return;
    if (o.sub === 'shrine_altar') return this.touchAltar(p, sh);
    if (o.sub === 'shrine_pillar') return this.touchPillar(p, sh, Number((o.data as { idx?: number }).idx));
  }

  private touchAltar(p: ServerPlayer, sh: Shrine): void {
    // any shrine hears a prayer to lift a curse
    if (p.data.buffs.curse || p.data.buffs.grave_rot) {
      const rot = !p.data.buffs.curse;
      delete p.data.buffs.curse;
      delete p.data.buffs.grave_rot;
      p.dirty('buffs');
      p.toast(
        rot
          ? 'You kneel and pray. The grave rot leaves your wounds.'
          : 'You kneel and pray. The curse lifts from you like a shadow at dawn.',
        'good',
      );
      return;
    }
    if (p.data.prog.shrines.includes(sh.id)) {
      p.toast('The shrine is quiet. Its gift is already yours.');
      return;
    }
    const old = this.sessions.get(sh.id);
    if (old && old.player !== p.id && this.room.players.has(old.player)) {
      p.toast('Someone else is working this shrine.');
      return;
    }
    if (old?.ready) {
      this.solve(p, old);
      return;
    }
    if (old) this.abort(sh.id, old);
    const s: Session = {
      shrine: sh,
      player: p.id,
      pattern: [],
      stage: 0,
      fails: 0,
      wave: 0,
      enemies: new Set(),
      until: this.t + 240,
      mask: 15,
      ready: false,
    };
    this.sessions.set(sh.id, s);
    if (sh.type === 'sequence') {
      const n = p.level >= 20 ? 6 : p.level >= 10 ? 5 : 4;
      for (let i = 0; i < n; i++) s.pattern.push(Math.floor(this.room.rand() * 4));
      p.toast('The pillars hum. Watch the order they wake in, then strike them the same way (E).', 'info');
      this.send(p, { kind: 'show', shrine: sh.id, pattern: s.pattern, stepMs: STEP_MS });
    } else if (sh.type === 'balance') {
      // Construct from legal moves, so every generated lantern puzzle is solvable.
      for (let i = 0; i < 4; i++) if (this.room.rand() < 0.5) s.mask = toggleShrineLantern(s.mask, i);
      if (s.mask === 15) s.mask = toggleShrineLantern(s.mask, 0);
      p.toast(
        'Light all four lanterns. Each pillar toggles itself and its clockwise neighbour. Touch the pillars to experiment.',
        'info',
      );
      this.send(p, { kind: 'balance', shrine: sh.id, mask: s.mask });
    } else if (sh.type === 'trail' || sh.type === 'traps' || sh.type === 'platform') {
      s.pattern = [0, 1, 2, 3];
      for (let i = 3; i > 0; i--) {
        const j = Math.floor(this.room.rand() * (i + 1));
        [s.pattern[i], s.pattern[j]] = [s.pattern[j]!, s.pattern[i]!];
      }
      if (sh.type === 'platform') {
        s.pattern = [3, 0, 1, 2, 3];
        this.jump(p, s, 3);
      }
      s.until = this.t + 60;
      p.toast(
        sh.type === 'platform'
          ? 'Phase platforms: stand on a pad and press E to jump when the NEXT pad is green. Complete the circuit.'
          : sh.type === 'traps'
            ? 'Tide traps: visit the seals in order during their green safe phase. Red spikes hurt; three mistakes end the trial.'
            : 'Rune trail: walk or dash onto each glowing seal in order. You have one minute.',
        'info',
      );
      this.send(p, { kind: 'trail', shrine: sh.id, pattern: s.pattern, stage: 0, seconds: 60 });
    } else {
      p.toast('Stone seals around you. Survive three waves.', 'info');
      this.send(p, { kind: 'barrier', shrine: sh.id, on: true, wave: 1, waves: WAVES.length });
      this.spawnWave(p, s);
    }
  }

  private touchPillar(p: ServerPlayer, sh: Shrine, idx: number): void {
    const s = this.sessions.get(sh.id);
    if (s?.player === p.id && sh.type === 'platform') {
      if (s.ready || (s.hopUntil ?? 0) > this.t || idx !== s.pattern[s.stage]) return;
      const point = sh.pillars[idx];
      if (!point || Math.hypot(p.sim.x - sh.x - point[0] - 0.5, p.sim.y - sh.y - point[1] - 0.5) > 1.2) return;
      const next = s.pattern[s.stage + 1];
      if (next === undefined) return;
      if (!trapSafe(this.room.wclock.now(), next)) {
        this.trapHit(p, s);
        return;
      }
      s.stage++;
      this.jump(p, s, next);
      this.send(p, {
        kind: 'trail',
        shrine: sh.id,
        pattern: s.pattern,
        stage: s.stage,
        seconds: Math.max(0, Math.ceil(s.until - this.t)),
      });
      if (s.stage === s.pattern.length - 1) this.solve(p, s);
      return;
    }
    if (!s || s.player !== p.id || (sh.type !== 'sequence' && sh.type !== 'balance')) {
      p.toast('The pillar is cold. Wake the altar first.');
      return;
    }
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) return;
    if (s.ready) {
      p.toast('Return to the altar to claim your gift.');
      return;
    }
    if (sh.type === 'balance') {
      s.mask = toggleShrineLantern(s.mask, idx);
      this.send(p, { kind: 'balance', shrine: sh.id, mask: s.mask });
      if (s.mask === 15) this.solve(p, s);
      return;
    }
    const ok = s.pattern[s.stage] === idx;
    this.send(p, { kind: 'hit', shrine: sh.id, idx, ok });
    if (ok) {
      s.stage++;
      if (s.stage >= s.pattern.length) this.solve(p, s);
    } else {
      s.fails++;
      s.stage = 0;
      this.send(p, { kind: 'fail', shrine: sh.id });
      // the shrine bites back, a little, then shows the pattern again
      for (let i = 0; i < 2; i++) {
        const a = this.room.rand() * Math.PI * 2;
        this.room.spawnEnemy('mite', sh.x + Math.cos(a) * 3, sh.y + Math.sin(a) * 3, false, {
          level: Math.max(1, p.level - 2),
        });
      }
      setTimeout(() => {
        if (this.sessions.get(sh.id) === s && this.room.players.has(p.id))
          this.send(p, { kind: 'show', shrine: sh.id, pattern: s.pattern, stepMs: STEP_MS });
      }, 1400);
    }
  }

  private spawnWave(p: ServerPlayer, s: Session): void {
    const sh = s.shrine;
    const kinds: EnemyKind[] = s.shrine.id.startsWith('cs')
      ? (
          [
            ['echo_bat', 'echo_bat'],
            ['spore_sage', 'rime_skitter'],
            ['prism_beetle', 'echo_bat'],
          ] as EnemyKind[][]
        )[s.wave]!
      : WAVES[s.wave]!;
    kinds.forEach((k, i) => {
      const a = (i / kinds.length) * Math.PI * 2 + s.wave,
        x = sh.x + Math.cos(a) * 5.5,
        y = sh.y + Math.sin(a) * 5.5;
      const e = this.room.spawnEnemy(k, x, y, false, { level: Math.max(2, p.level + s.wave) });
      s.enemies.add(e.id);
    });
  }

  tick(_now: number, dt: number): void {
    this.t += dt;
    for (const [id, s] of [...this.sessions]) {
      const p = this.room.players.get(s.player);
      if (!p || p.deadT > 0 || this.t > s.until || Math.hypot(s.shrine.x - p.sim.x, s.shrine.y - p.sim.y) > 22) {
        this.abort(id, s, p);
        continue;
      }
      if ((s.hopUntil ?? 0) > this.t && s.landing) {
        p.sim.x = s.landing.x;
        p.sim.y = s.landing.y;
        p.queue.length = 0;
        continue;
      }
      if (s.ready) continue;
      if (s.shrine.type === 'trail' || s.shrine.type === 'traps') {
        const idx = s.pattern[s.stage],
          point = idx === undefined ? null : s.shrine.pillars[idx];
        if (point && Math.hypot(p.sim.x - s.shrine.x - point[0] - 0.5, p.sim.y - s.shrine.y - point[1] - 0.5) < 1) {
          if (s.shrine.type === 'traps' && !trapSafe(this.room.wclock.now(), idx!)) {
            this.trapHit(p, s);
            continue;
          }
          this.send(p, { kind: 'hit', shrine: id, idx: idx!, ok: true });
          s.stage++;
          if (s.stage >= s.pattern.length) this.solve(p, s);
          else
            this.send(p, {
              kind: 'trail',
              shrine: id,
              pattern: s.pattern,
              stage: s.stage,
              seconds: Math.ceil(s.until - this.t),
            });
        }
      }
      if (s.shrine.type === 'gauntlet') {
        for (const eid of [...s.enemies]) if (!this.room.enemies.has(eid)) s.enemies.delete(eid);
        if (s.enemies.size === 0) {
          s.wave++;
          if (s.wave >= WAVES.length) this.solve(p, s);
          else {
            this.send(p, { kind: 'barrier', shrine: id, on: true, wave: s.wave + 1, waves: WAVES.length });
            this.spawnWave(p, s);
          }
        }
      }
    }
  }

  private jump(p: ServerPlayer, s: Session, idx: number): void {
    const [dx, dy] = s.shrine.pillars[idx]!;
    const to = { x: s.shrine.x + dx + 0.5, y: s.shrine.y + dy + 0.5 };
    if (this.room.store.solidAt(Math.floor(to.x), Math.floor(to.y))) return;
    this.room.fx({ kind: 'jump', id: p.id, x: p.sim.x, y: p.sim.y, dx: to.x, dy: to.y });
    p.sim.x = to.x;
    p.sim.y = to.y;
    p.sim.dashT = 0;
    p.queue.length = 0;
    s.landing = to;
    s.hopUntil = this.t + 0.65;
  }

  private trapHit(p: ServerPlayer, s: Session): void {
    if ((s.hitUntil ?? 0) > this.t) return;
    s.hitUntil = this.t + 1;
    s.fails++;
    p.hp = Math.max(1, p.hp - Math.max(3, Math.round(p.maxHp * 0.12)));
    this.room.fx({ kind: 'hurt', id: p.id, x: p.sim.x, y: p.sim.y });
    p.toast('The spikes surge! Wait for the green phase.', 'bad');
    if (s.fails >= 3) this.abort(s.shrine.id, s, p);
  }

  private abort(id: string, s: Session, p?: ServerPlayer): void {
    this.sessions.delete(id);
    for (const eid of s.enemies) {
      const e = this.room.enemies.get(eid);
      if (e) {
        this.room.enemies.delete(eid);
        this.room.state.enemies.delete(eid);
      }
    }
    const who = p ?? this.room.players.get(s.player);
    if (who) {
      this.send(who, { kind: 'barrier', shrine: id, on: false });
      if (!who.data.prog.shrines.includes(id)) who.toast('The shrine falls quiet. Touch the altar to try again.');
    }
  }

  private solve(p: ServerPlayer, s: Session): void {
    if (p.data.prog.shrines.includes(s.shrine.id)) return;
    s.ready = true;
    const gift: Stack[] = s.gift ?? [{ id: 'shrine_shard', n: 1 }];
    // an occasional piece of gear, scaled to the solver
    const r = this.room.rand();
    if (!s.gift && r < 0.2) gift.push({ id: p.level >= 12 ? 'armor_iron_feet' : 'armor_leather_feet', n: 1 });
    else if (!s.gift && r < 0.3 && p.level >= 8) gift.push({ id: 'crossbow', n: 1 });
    s.gift = gift;
    if (!giveStacks(p, gift)) {
      p.toast('Your gift is safe at the altar. Clear pack space, then touch the altar to claim it.', 'info');
      return;
    }
    this.sessions.delete(s.shrine.id);
    p.data.prog.shrines.push(s.shrine.id);
    p.data.coins += 100 + p.level * 12;
    p.dirty('coins', 'inv');
    this.room.grantXp(p, 80 + p.level * 14);
    const text =
      s.shrine.type === 'sequence'
        ? 'The pillars sing in unison. A shard of resonance is yours.'
        : 'The seal breaks. A shard of resonance is yours.';
    p.toast(text, 'good');
    this.send(p, { kind: 'solved', shrine: s.shrine.id, text });
    this.send(p, { kind: 'state', solved: p.data.prog.shrines });
    this.send(p, { kind: 'barrier', shrine: s.shrine.id, on: false });
  }

  debug(): { sessions: number } {
    return { sessions: this.sessions.size };
  }
}
