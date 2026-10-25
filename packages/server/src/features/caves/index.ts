import {
  CAVE_TOWNS,
  ELITE,
  caveBiomeAt,
  caveRegionAt,
  caveTownAt,
  hasIframes,
  isCaveY,
  isDiveY,
  sanctuaryAt,
  vaultAt,
  vaultLayout,
  type CaveBiome,
  type EnemyKindName,
  type Vault,
  type WorldObj,
} from '@eigenlands/shared';
import type { ServerPlayer } from '../../rooms/player';
import type { GameRoom } from '../../rooms/GameRoom';
import type { Module, Registrar } from '../types';
/** Local discoveries only: bounded encounter state and no world-wide scan or per-frame particles. */
/** Signature monster and two supporting kinds for the ambushes inside each cave biome's vaults. */
const VAULT_FOES: Record<CaveBiome, { sig: EnemyKindName; support: [EnemyKindName, EnemyKindName] }> = {
  limestone: { sig: 'amber_gnawer', support: ['echo_bat', 'blind_ram'] },
  glowmoss: { sig: 'lantern_hound', support: ['spore_sage', 'echo_bat'] },
  crystal: { sig: 'geode_golem', support: ['prism_beetle', 'echo_bat'] },
  basalt: { sig: 'cinder_drake', support: ['blind_ram', 'prism_beetle'] },
  frost: { sig: 'frost_wraith', support: ['rime_skitter', 'echo_bat'] },
  drowned: { sig: 'tide_eel', support: ['pool_lurker', 'spore_sage'] },
};
interface Trial {
  state: 'idle' | 'active' | 'done';
  foes: Set<string>;
  /** plate keys already cleared */
  plates: Set<string>;
  started: number;
}

export class CaveModule implements Module {
  private trials = new Map<string, Trial>();
  private time = 0;
  private pulse = 0;
  private sites = new Map<string, { next: number; enemy?: string; warn?: number; x: number; y: number }>();
  constructor(private room: GameRoom) {}
  install(_reg: Registrar): void {}

  private trial(id: string): Trial {
    let t = this.trials.get(id);
    if (!t) {
      t = { state: 'idle', foes: new Set(), plates: new Set(), started: 0 };
      this.trials.set(id, t);
    }
    return t;
  }
  private alive(t: Trial): number {
    for (const id of [...t.foes]) if (!this.room.enemies.has(id)) t.foes.delete(id);
    return t.foes.size;
  }
  /** One ambush: the biome's own monsters, spawned on open vault floor away from the player. */
  private ambush(v: Vault, p: ServerPlayer, t: Trial, wave: number, guardian = false): void {
    const biome = caveBiomeAt(this.room.seed, (v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2),
      set = VAULT_FOES[biome];
    const kinds: EnemyKindName[] = guardian
      ? [set.sig, set.support[0], set.support[1]]
      : wave === 0
        ? [set.support[0], set.support[1]]
        : wave === 1
          ? [set.sig, set.support[0]]
          : [set.sig, set.sig, set.support[1]];
    const level = Math.max(4, Math.min(30, p.level));
    let n = 0;
    for (const kind of kinds) {
      for (let tries = 0; tries < 30; tries++) {
        const x = v.x0 + 1.5 + this.room.rand() * (v.x1 - v.x0 - 2),
          y = v.y0 + 1.5 + this.room.rand() * (v.y1 - v.y0 - 2);
        if (this.room.store.solidAt(Math.floor(x), Math.floor(y)) || Math.hypot(x - p.sim.x, y - p.sim.y) < 3.5)
          continue;
        const e = this.room.spawnEnemy(kind, x, y, false, {
          level,
          elite: guardian && n === 0 ? ELITE.HARDENED : 0,
        });
        t.foes.add(e.id);
        n++;
        break;
      }
    }
    t.state = 'active';
    t.started = this.time;
  }

  /** A vault chest was opened: true = still locked (the module has told the player why). */
  guard(p: ServerPlayer, o: WorldObj): boolean {
    const v = vaultAt(this.room.seed, o.x, o.y);
    if (!v) return false;
    const t = this.trial(v.id);
    if (this.alive(t) > 0) {
      p.toast(`The vault's guardians still stand. (${t.foes.size} left)`, 'bad');
      return true;
    }
    if (v.kind === 'sealed') {
      if (t.state === 'done') return false;
      if (t.state === 'idle') {
        this.ambush(v, p, t, 0, true);
        p.toast('The chest lid lifts a hand-width and the vault wakes! Its guardians step out of the walls.', 'bad');
        return true;
      }
      t.state = 'done';
      p.toast('The vault falls silent. Whatever it kept is yours.', 'good');
      return false;
    }
    const plates = vaultLayout(v).plates;
    if (t.plates.size < plates.length) {
      p.toast(`The chest will not budge. ${plates.length - t.plates.size} engraved plate(s) are still dormant.`);
      return true;
    }
    t.state = 'done';
    return false;
  }
  tick(_now: number, dt: number): void {
    this.time += dt;
    this.pulse -= dt;
    if (this.pulse > 0) return;
    this.pulse = 0.25;
    // vault trials: stepping on a dormant plate wakes one ambush; clearing it marks the plate spent
    for (const p of this.room.players.values()) {
      if (p.deadT > 0 || !isCaveY(p.sim.y) || isDiveY(p.sim.y) || this.room.store.generation < 4) continue;
      const v = vaultAt(this.room.seed, Math.floor(p.sim.x), Math.floor(p.sim.y));
      if (!v || v.kind !== 'trial') continue;
      const t = this.trial(v.id);
      if (this.alive(t) === 0 && t.state === 'active') {
        t.state = t.plates.size >= vaultLayout(v).plates.length ? 'done' : 'idle';
        p.toast(
          t.state === 'done'
            ? 'The last guardian falls. The chest unlocks.'
            : 'The ambush is broken. Another plate remains.',
          'good',
        );
      }
      if (t.state === 'active') continue;
      for (const pl of vaultLayout(v).plates)
        if (!t.plates.has(pl.key) && Math.hypot(p.sim.x - (pl.x + 0.5), p.sim.y - (pl.y + 0.5)) < 0.9) {
          t.plates.add(pl.key);
          this.ambush(v, p, t, t.plates.size - 1);
          p.toast('The plate sinks. Stone shifts: something answers the engraving!', 'bad');
          this.room.fx({ kind: 'bomb', x: pl.x + 0.5, y: pl.y + 0.5, v: 0.6, w: 1.6, id: `plate:${v.id}:${pl.key}` });
          break;
        }
    }
    const nearby = new Set<string>();
    for (const p of this.room.players.values()) {
      if (p.deadT > 0 || !isCaveY(p.sim.y) || isDiveY(p.sim.y)) continue;
      const r = caveRegionAt(this.room.seed, p.sim.x, p.sim.y);
      const town = CAVE_TOWNS.find((t) => t.abandoned && Math.hypot(t.cx - p.sim.x, t.cy - p.sim.y) < 25);
      const id = town ? town.id : r.id,
        x = town ? town.cx : r.x + 7,
        y = town ? town.cy + 7 : r.y - 6;
      if (!this.room.owns(x, y) || sanctuaryAt(this.room.seed, x, y) || (!town && caveTownAt(x, y))) continue;
      const sites = this.room.store.generation >= 4 ? ['vents', 'grove'] : ['vents', 'ruins', 'grove'];
      if ((!town && !sites.includes(r.feature)) || Math.hypot(p.sim.x - x, p.sim.y - y) > 20) continue;
      nearby.add(id);
      let site = this.sites.get(id);
      if (!site) {
        site = { x, y, next: this.time + 1 };
        this.sites.set(id, site);
      }
      if (!town && r.feature === 'vents') {
        if (site.warn !== undefined && this.time >= site.warn) {
          for (const q of this.room.players.values())
            if (q.deadT <= 0 && !hasIframes(q.sim) && Math.hypot(q.sim.x - x, q.sim.y - y) < 1.8) {
              q.hp = Math.max(1, q.hp - Math.max(3, Math.round(q.maxHp * 0.08)));
              this.room.fx({ kind: 'hurt', id: q.id, x: q.sim.x, y: q.sim.y });
              q.toast('Steam vent! Leave the marked grate before it erupts.', 'bad');
            }
          site.warn = undefined;
          site.next = this.time + 4;
        } else if (site.warn === undefined && this.time >= site.next) {
          site.warn = this.time + 1.5;
          this.room.fx({ kind: 'bomb', x, y, v: 1.5, w: 1.8, id: `vent:${id}` });
        }
      } else if (
        p.level >= 4 &&
        this.time >= site.next &&
        (!site.enemy || !this.room.enemies.has(site.enemy)) &&
        !this.room.store.solidAt(x, y)
      ) {
        // Approach announces an encounter; warded settlements never receive guardians.
        const e = this.room.spawnEnemy(
          r.feature === 'grove' && !town ? 'spore_matriarch' : 'vault_guardian',
          x + 0.5,
          y + 0.5,
          false,
          { level: Math.max(4, Math.min(12, p.level)) },
        );
        site.enemy = e.id;
        site.next = this.time + 600;
        p.toast(`${e.def.name} guards this place. Its long windup leaves an opening.`);
      }
    }
    // Keep cooldowns while the server lives; cap long expeditions without growing forever.
    if (this.sites.size > 256)
      for (const [id, s] of this.sites)
        if (!nearby.has(id) && this.time >= s.next) {
          this.sites.delete(id);
          if (this.sites.size <= 192) break;
        }
  }
}
