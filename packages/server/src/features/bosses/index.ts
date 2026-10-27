import {
  ARENA_BOSS,
  BOSSES,
  sanctuaryAt,
  isCaveY,
  isDiveY,
  isCryptY,
  isUpperY,
  caveBiomeAt,
  caveRegionAt,
  caveTownAt,
} from '@eigenlands/shared';
/**
 * Bosses: called with a crafted item, scaled to the summoner's level, with phases and scripted specials on top of the
 * ordinary enemy AI (leap / charge / slam). Killing one pays out through the normal drop table (guaranteed here) and
 * records the first kill on the character. See docs/design/adventure.md.
 */
import {
  BOSS_BY_ITEM,
  BOSS_BY_KIND,
  MSG34,
  townFor,
  type BossDef,
  type BossEvent,
  type BossId,
} from '@eigenlands/shared';
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

const KEY: Record<BossId, EnemyKind> = {
  slime_king: 'slime_king',
  warden: 'warden',
  colossus: 'colossus',
  bellkeeper: 'bellkeeper',
  veyr: 'veyr',
  geode_tyrant: 'geode_tyrant',
  cinder_wyrm: 'cinder_wyrm',
  rime_sovereign: 'rime_sovereign',
  tide_leviathan: 'tide_leviathan',
};
const SPECIAL_EVERY: Record<BossId, number> = {
  slime_king: 9,
  warden: 8,
  colossus: 7,
  bellkeeper: 8,
  veyr: 9,
  geode_tyrant: 8,
  cinder_wyrm: 7,
  rime_sovereign: 8,
  tide_leviathan: 8,
};

export class BossModule implements Module {
  private runs = new Map<string, Run>();
  private t = 0;

  constructor(private room: GameRoom) {}

  install(_reg: Registrar): void {
    /* bosses are driven by items and the tick */
  }

  // ───────────────────────── summoning ─────────────────────────

  summon(p: ServerPlayer, itemId: string, x: number, y: number): boolean {
    let def = BOSS_BY_ITEM[itemId];
    if (!def) return false;
    // revision-4 arenas answer the Deep Sigil with the boss of their cave biome
    if (def.id === 'bellkeeper' && isCaveY(y) && this.room.store.generation >= 4)
      def = BOSSES[ARENA_BOSS[caveBiomeAt(this.room.seed, x, y)]];
    if (def.id === 'veyr') {
      if (isCaveY(y) || isDiveY(y) || isUpperY(y) || isCryptY(y)) {
        p.toast('The Storm Beacon needs open sky.', 'bad');
        return false;
      }
      for (const [dx, dy] of [
        [0, 0],
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ]) {
        if (this.room.store.solidAt(Math.floor(x + dx!), Math.floor(y + dy!))) {
          p.toast('Find a wider clearing before calling Veyr.', 'bad');
          return false;
        }
      }
    }
    if (def.item === 'deep_sigil') {
      const r = caveRegionAt(this.room.seed, x, y);
      if (!isCaveY(y) || r.feature !== 'arena' || caveTownAt(x, y) || Math.hypot(x - r.x, y - r.y) > 10) {
        p.toast(
          'The Deep Sigil answers only in a surveyed cave arena. Follow the survey roads and look for a resonant altar.',
          'bad',
        );
        return false;
      }
    }
    if (p.level < def.level) {
      p.toast(`The ${def.name} would crush you. (Level ${def.level} needed.)`, 'bad');
      return false;
    }
    for (const r of this.runs.values())
      if (r.def.id === def.id && Math.hypot(r.e.x - p.sim.x, r.e.y - p.sim.y) < 120) {
        p.toast(`The ${def.name} is already here.`, 'bad');
        return false;
      }
    const t = townFor(this.room.seed);
    if (
      sanctuaryAt(this.room.seed, x, y) ||
      Math.hypot(x, y) < def.townGap ||
      Math.hypot(x - t.cx, y - t.cy) < def.townGap + 25
    ) {
      p.toast('The summoning fizzles: too close to home. Go further out.', 'bad');
      return false;
    }
    if (this.room.store.solidAt(Math.floor(x), Math.floor(y))) {
      p.toast('There is no room to call it here.', 'bad');
      return false;
    }
    const e = this.room.spawnEnemy(KEY[def.id], x, y, false, { level: Math.max(p.level, def.level) });
    this.runs.set(e.id, {
      def,
      e,
      phase: 0,
      nextSpecial: this.t + 6,
      rage: false,
      summoner: p.id,
      later: [],
      born: this.t,
    });
    this.say(x, y, { kind: 'start', boss: def.id, name: def.name, intro: def.intro });
    this.room.fx({ kind: 'crash', x, y, id: e.id, dx: 0, dy: 1 });
    return true;
  }

  // ───────────────────────── fight ─────────────────────────

  tick(_now: number, dt: number): void {
    this.t += dt;
    for (const [id, r] of [...this.runs]) {
      const e = r.e;
      if (!this.room.enemies.has(id) || e.hp <= 0) {
        this.runs.delete(id);
        continue;
      }
      // Breaking Veyr's poise interrupts the storm; lingering warning marks expire harmlessly.
      if (r.def.id === 'veyr' && e.mode === 'stagger') r.later = [];
      // run scheduled effects
      for (const l of [...r.later])
        if (l.at <= this.t) {
          r.later.splice(r.later.indexOf(l), 1);
          l.fn();
        }
      const ratio = e.hp / e.maxHp;
      while (r.phase < r.def.phases.length && ratio <= r.def.phases[r.phase]!) {
        r.phase++;
        this.phaseUp(r);
      }
      if (this.t >= r.nextSpecial && e.mode !== 'stagger' && this.hasTarget(e)) {
        r.nextSpecial = this.t + SPECIAL_EVERY[r.def.id] * (r.rage ? 0.7 : 1);
        this.special(r);
      }
    }
  }

  private hasTarget(e: Enemy): boolean {
    for (const p of this.room.players.values())
      if (p.deadT <= 0 && Math.hypot(p.sim.x - e.x, p.sim.y - e.y) < e.def.sight) return true;
    return false;
  }

  private phaseUp(r: Run): void {
    const e = r.e,
      id = r.def.id;
    const say = (text: string) => this.say(e.x, e.y, { kind: 'phase', boss: id, phase: r.phase, text });
    this.room.fx({ kind: 'stagger', x: e.x, y: e.y, id: e.id });
    if (id === 'slime_king') {
      if (r.phase === 1) {
        say('It splits! Slimes spill from its body.');
        this.spawnAdds(r, 'slime', 4);
      } else {
        say('The Sovereign boils with rage.');
        r.rage = true;
        e.speedMult = 1.4;
        e.windMult = 0.8;
        this.spawnAdds(r, 'slime', 3);
      }
    } else if (id === 'warden') {
      say('The Warden bellows. The pack answers.');
      r.rage = true;
      e.speedMult = 1.3;
      e.windMult = 0.85;
      this.spawnAdds(r, 'wolf', 2);
    } else if (id === 'bellkeeper') {
      say(
        r.phase === 1
          ? 'The first seal breaks. Echoes gather beneath the bell.'
          : 'The final chime. Leave the marked ground before it rings.',
      );
      r.rage = r.phase > 1;
      this.spawnAdds(r, r.phase === 1 ? 'echo_bat' : 'prism_beetle', 2);
    } else if (id === 'geode_tyrant') {
      say(
        r.phase === 1
          ? 'Prisms bud along its back. Scarabs hatch from the facets.'
          : 'The Tyrant shatters its own crown. Shards rain on the floor.',
      );
      r.rage = r.phase > 1;
      if (r.rage) e.speedMult = 1.25;
      this.spawnAdds(r, 'prism_beetle', 2);
    } else if (id === 'cinder_wyrm') {
      say(
        r.phase === 1
          ? 'Embers pour from its jaws. A drake answers the heat.'
          : 'The Wyrm coils tight, scales glowing white. The floor itself begins to run.',
      );
      r.rage = r.phase > 1;
      if (r.rage) {
        e.speedMult = 1.3;
        e.windMult = 0.85;
      }
      this.spawnAdds(r, 'cinder_drake', 1);
    } else if (id === 'rime_sovereign') {
      say(
        r.phase === 1
          ? 'Frost climbs the walls. Wraiths rise from the rime.'
          : 'The crown cracks open. Cold breath fills the hall.',
      );
      r.rage = r.phase > 1;
      this.spawnAdds(r, 'frost_wraith', r.phase === 1 ? 2 : 1);
    } else if (id === 'tide_leviathan') {
      say(
        r.phase === 1
          ? 'The moat boils. Eels race the surface.'
          : 'The Leviathan rolls beneath the seal. Stay off the dark water.',
      );
      r.rage = r.phase > 1;
      this.spawnAdds(r, 'tide_eel', 2);
    } else if (id === 'veyr') {
      say(
        r.phase === 1
          ? 'Conduction: thunder marks the cardinal stones. Move between the marks.'
          : 'Overcharge: the core burns. Bait the strikes, then punish its recovery.',
      );
      r.rage = r.phase > 1;
    } else {
      if (r.phase === 1) say('The Colossus phases out of sync with itself.');
      else {
        say('It is everywhere at once.');
        r.rage = true;
        e.speedMult = 1.3;
        e.windMult = 0.85;
      }
    }
  }

  private spawnAdds(r: Run, kind: EnemyKind, n: number): void {
    const e = r.e;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.t,
        x = e.x + Math.cos(a) * 2.6,
        y = e.y + Math.sin(a) * 2.6;
      if (this.room.store.solidAt(Math.floor(x), Math.floor(y))) continue;
      this.room.spawnEnemy(kind, x, y, false, { level: Math.max(1, e.level - 3) });
    }
  }

  private special(r: Run): void {
    const e = r.e,
      id = r.def.id;
    const target = [...this.room.players.values()]
      .filter((p) => p.deadT <= 0)
      .sort((a, b) => Math.hypot(a.sim.x - e.x, a.sim.y - e.y) - Math.hypot(b.sim.x - e.x, b.sim.y - e.y))[0];
    if (!target) return;
    if (id === 'slime_king') {
      // Gel Rain: a ring of slow orbs, then (when enraged) a second one rotated half a step
      const ring = (off: number) => {
        for (let i = 0; i < 8; i++) {
          const a = off + (i / 8) * Math.PI * 2;
          this.room.fireOrbs(e, Math.cos(a), Math.sin(a));
        }
      };
      ring(0);
      if (r.rage) r.later.push({ at: this.t + 0.6, fn: () => ring(Math.PI / 8) });
    } else if (id === 'warden') {
      // Howl: wolves answer, and the Warden surges at its target
      this.room.fx({ kind: 'stagger', x: e.x, y: e.y, id: e.id });
      this.spawnAdds(r, 'wolf', r.rage ? 3 : 2);
    } else if (id === 'veyr') {
      // Fixed impact sites, generous windup, and a stationary recovery. No homing damage or add spam.
      const origin = { x: e.x, y: e.y };
      const points =
        r.phase === 0
          ? [
              { x: target.sim.x, y: target.sim.y },
              { x: target.sim.x - 3, y: target.sim.y },
              { x: target.sim.x + 3, y: target.sim.y },
            ]
          : [
              [4, 0],
              [-4, 0],
              [0, 4],
              [0, -4],
            ].map(([dx, dy]) => ({ x: origin.x + dx!, y: origin.y + dy! }));
      const delay = r.phase > 1 ? 1.35 : 1.7;
      e.mode = 'windup';
      e.t = delay;
      e.lockX = target.sim.x;
      e.lockY = target.sim.y;
      // Scheduled strikes own this windup; leave the generic AI in recovery before its timer can attack.
      r.later.push({
        at: this.t + delay - 0.1,
        fn: () => {
          if (e.mode === 'windup') {
            e.mode = 'recover';
            e.t = 2.1;
            e.cd = 2.1;
          }
        },
      });
      points.forEach((point, i) => {
        if (this.room.store.solidAt(Math.floor(point.x), Math.floor(point.y))) return;
        this.room.fx({ kind: 'bomb', x: point.x, y: point.y, v: delay, w: 1.5, id: `${e.id}storm${i}` });
        r.later.push({
          at: this.t + delay,
          fn: () => {
            if (this.room.enemies.has(e.id)) this.room.enemyStrike(e, point.x, point.y, 1.5, 0.85);
          },
        });
      });
      if (r.phase > 1) {
        const point = { x: target.sim.x, y: target.sim.y },
          echo = delay + 0.8;
        this.room.fx({ kind: 'bomb', x: point.x, y: point.y, v: echo, w: 1.5, id: `${e.id}overcharge` });
        r.later.push({
          at: this.t + echo,
          fn: () => {
            if (this.room.enemies.has(e.id)) this.room.enemyStrike(e, point.x, point.y, 1.5, 0.85);
          },
        });
      }
    } else if (id === 'geode_tyrant' || id === 'cinder_wyrm' || id === 'rime_sovereign' || id === 'tide_leviathan') {
      // Every arena boss telegraphs fixed impact sites with a generous windup, then recovers in place.
      const dirx = target.sim.x - e.x,
        diry = target.sim.y - e.y,
        len = Math.hypot(dirx, diry) || 1;
      const ux = dirx / len,
        uy = diry / len;
      let sites: Array<{ x: number; y: number; delay: number; w: number }> = [];
      if (id === 'geode_tyrant') {
        // Shard volley: a ring of prisms bursts around the target, one after another
        const n = r.rage ? 8 : 6;
        sites = Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2;
          return {
            x: target.sim.x + Math.cos(a) * 3,
            y: target.sim.y + Math.sin(a) * 3,
            delay: 1.4 + i * 0.16,
            w: 1.4,
          };
        });
      } else if (id === 'cinder_wyrm') {
        // Lava sweep: a rolling line of eruptions marches from the Wyrm toward its target
        const n = r.rage ? 8 : 6;
        sites = Array.from({ length: n }, (_, i) => ({
          x: e.x + ux * (2.4 + i * 2.2),
          y: e.y + uy * (2.4 + i * 2.2),
          delay: 1.2 + i * 0.26,
          w: 1.5,
        }));
      } else if (id === 'rime_sovereign') {
        // Glacial rings: two expanding rings around the Sovereign
        for (const [radius, delay] of [
          [3.4, 1.3],
          [6.2, 1.9],
        ] as const)
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + (radius > 4 ? Math.PI / 8 : 0);
            sites.push({ x: e.x + Math.cos(a) * radius, y: e.y + Math.sin(a) * radius, delay, w: 1.5 });
          }
      } else {
        // Tidal maw: strikes cross the target's position, widening as the Leviathan rages
        const reach = r.rage ? 3.4 : 2.8;
        sites = [
          [0, 0],
          [reach, 0],
          [-reach, 0],
          [0, reach],
          [0, -reach],
        ].map(([dx, dy], i) => ({ x: target.sim.x + dx!, y: target.sim.y + dy!, delay: 1.4 + i * 0.12, w: 1.6 }));
      }
      const last = Math.max(...sites.map((q) => q.delay));
      e.mode = 'windup';
      e.t = last;
      e.lockX = target.sim.x;
      e.lockY = target.sim.y;
      r.later.push({
        at: this.t + last - 0.1,
        fn: () => {
          if (e.mode === 'windup') {
            e.mode = 'recover';
            e.t = 2;
            e.cd = 2;
          }
        },
      });
      sites.forEach((q, i) => {
        if (this.room.store.solidAt(Math.floor(q.x), Math.floor(q.y))) return;
        this.room.fx({ kind: 'bomb', x: q.x, y: q.y, v: q.delay, w: q.w, id: `${e.id}sp${i}` });
        r.later.push({
          at: this.t + q.delay,
          fn: () => {
            if (this.room.enemies.has(e.id)) this.room.enemyStrike(e, q.x, q.y, q.w, 0.85);
          },
        });
      });
    } else if (id === 'bellkeeper') {
      // Echo toll: three fixed, clearly marked impact sites. Move out, then punish its recovery.
      const points = [{ x: target.sim.x, y: target.sim.y }, ...[-1, 1].map((side) => ({ x: e.x + side * 4, y: e.y }))];
      points.forEach((p, i) => {
        const delay = 1.4 + i * 0.35;
        this.room.fx({ kind: 'bomb', x: p.x, y: p.y, v: delay, w: 2, id: `${e.id}echo${i}` });
        r.later.push({
          at: this.t + delay,
          fn: () => {
            if (this.room.enemies.has(e.id)) this.room.enemyStrike(e, p.x, p.y, 2, 0.9);
          },
        });
      });
      if (r.phase > 0) this.spawnAdds(r, 'echo_bat', 1);
    } else {
      // Fault Line: three expanding rings with a clear telegraph each, plus an orb storm once past the first phase
      for (let i = 0; i < 3; i++) {
        const radius = 3 + i * 2,
          delay = 1.0 + i * 0.55;
        r.later.push({
          at: this.t,
          fn: () => this.room.fx({ kind: 'bomb', x: e.x, y: e.y, v: delay, w: radius, id: `${e.id}r${i}` }),
        });
        r.later.push({
          at: this.t + delay,
          fn: () => {
            if (this.room.enemies.has(e.id)) this.room.enemyStrike(e, e.x, e.y, radius, 0.9);
          },
        });
      }
      if (r.phase >= 1)
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          this.room.fireOrbs(e, Math.cos(a), Math.sin(a));
        }
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
      if (first) {
        q.data.prog.bosses.push(def.id);
        q.dirty('inv');
      }
      q.client.send(MSG34.BOSS_EV, { kind: 'defeated', boss: def.id, name: def.name, first } satisfies BossEvent);
      if (first) q.toast(`First victory over the ${def.name}!`, 'good');
    }
    void killer;
  }

  debug(): { bosses: number } {
    return { bosses: this.runs.size };
  }
}
