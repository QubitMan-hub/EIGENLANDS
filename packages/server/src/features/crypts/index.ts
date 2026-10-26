/**
 * Ruin crypts (master plan §16 "dungeons and ruins"; placement in shared/src/stories.ts). Breaking a crypt's seal
 * wakes three waves of wardens round its door; a traveller who outlasts them opens the reliquary, once. Walking away,
 * dying or taking too long lets the wardens sink back into the earth, and the seal can be tried again.
 */
import { ruinLoot, storyText, type Biome, type EnemyKindName, type Stack, type WorldObj } from '@eigenlands/shared';
import type { Enemy } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { giveStacks } from '../../systems/helpers';
import type { Module, Registrar } from '../types';

export const CRYPT_LEVEL = 5;
const WAVES: ReadonlyArray<readonly EnemyKindName[]> = [
  ['wisp', 'wisp', 'wisp'],
  ['vault_guardian', 'wisp', 'wisp'],
  ['vault_guardian', 'vault_guardian', 'brute'],
];
/** a trial is lost if the challenger strays this far from the door, or after this long */
const LEASH = 22;
const TRIAL_SECS = 300;
const RARE = ['heart_crystal', 'shrine_shard', 'qubit_tea', 'outfit_gold'];

interface Trial {
  pid: string;
  ruin: string;
  biome: Biome;
  x: number;
  y: number;
  wave: number;
  enemies: Set<string>;
  next: number;
  until: number;
}

export class CryptModule implements Module {
  private t = 0;
  private trials = new Map<string, Trial>();

  constructor(private room: GameRoom) {}

  install(_reg: Registrar): void {}

  private key(ruin: string): string {
    return `crypt:${ruin}`;
  }

  /** Break the seal: the challenger stands at the door. */
  open(p: ServerPlayer, o: WorldObj): boolean {
    const d = (o.data ?? {}) as { ruin?: string; biome?: string };
    if (typeof d.ruin !== 'string') return false;
    if (p.data.prog.ruins.includes(this.key(d.ruin))) {
      p.toast('The reliquary stands open and empty. The wardens sleep.', 'info');
      return false;
    }
    if (this.trials.has(d.ruin)) {
      p.toast('The wardens are already awake!', 'bad');
      return false;
    }
    if (p.level < CRYPT_LEVEL) {
      p.toast(`The seal will not yield to you. Return at level ${CRYPT_LEVEL}.`, 'bad');
      return false;
    }
    const biome = (d.biome ?? 'meadow') as Biome;
    const txt = storyText(this.room.seed, d.ruin, 'crypt', biome, o.x, o.y);
    this.trials.set(d.ruin, {
      pid: p.id,
      ruin: d.ruin,
      biome,
      x: o.x + 0.5,
      y: o.y + 0.5,
      wave: 0,
      enemies: new Set(),
      next: this.t + 1.5,
      until: this.t + TRIAL_SECS,
    });
    p.toast(`${txt.plaque}. The seal cracks and the wardens rise!`, 'bad');
    return true;
  }

  /** the trial a player is in, for tests */
  trialOf(p: { id: string }): { ruin: string; wave: number; enemies: string[] } | null {
    for (const tr of this.trials.values())
      if (tr.pid === p.id) return { ruin: tr.ruin, wave: tr.wave, enemies: [...tr.enemies] };
    return null;
  }

  private spawnWave(tr: Trial, p: ServerPlayer): void {
    const kinds = WAVES[tr.wave]!;
    kinds.forEach((kind, i) => {
      for (let k = 0; k < 10; k++) {
        const a = ((i + k * 0.37) / kinds.length) * Math.PI * 2;
        const r = 4 + (k % 3);
        const ex = Math.floor(tr.x + Math.cos(a) * r),
          ey = Math.floor(tr.y + Math.sin(a) * r);
        if (this.room.store.solidAt(ex, ey) || !this.room.owns(ex, ey)) continue;
        const e = this.room.spawnEnemy(kind, ex + 0.5, ey + 0.5, false, { level: Math.max(3, p.level) });
        tr.enemies.add(e.id);
        break;
      }
    });
    p.toast(`Wave ${tr.wave + 1} of ${WAVES.length}: the wardens come!`, 'bad');
  }

  private end(tr: Trial, p: ServerPlayer | undefined, won: boolean, why = ''): void {
    this.trials.delete(tr.ruin);
    for (const id of tr.enemies) {
      this.room.enemies.delete(id);
      this.room.state.enemies.delete(id);
    }
    if (!p) return;
    if (!won) {
      p.toast(why || 'The wardens sink back into the earth. The seal closes.', 'bad');
      return;
    }
    const rand = this.room.rand;
    const loot: Stack[] = [
      ...ruinLoot(this.room.seed, tr.ruin, tr.biome, rand),
      ...ruinLoot(this.room.seed, tr.ruin, tr.biome, rand),
    ];
    if (rand() < 0.35) loot.push({ id: RARE[Math.floor(rand() * RARE.length)]!, n: 1 });
    if (!giveStacks(p, loot)) {
      p.toast('The reliquary is open, but your pack is too full. Make room and touch the door again.', 'bad');
      return;
    }
    const coins = 60 + p.level * 10;
    p.data.coins += coins;
    p.data.prog.ruins.push(this.key(tr.ruin));
    p.dirty('inv', 'coins');
    this.room.grantXp(p, 120 + p.level * 15);
    this.room.fx({ kind: 'chest', x: tr.x, y: tr.y });
    p.toast(`The last warden falls. The reliquary opens! (+${coins} coins)`, 'good');
  }

  tick(_now: number, dt: number): void {
    this.t += dt;
    for (const tr of [...this.trials.values()]) {
      const p = this.room.players.get(tr.pid);
      if (!p) {
        this.end(tr, undefined, false);
        continue;
      }
      if (p.deadT > 0) {
        this.end(tr, p, false, 'You fall before the crypt. The wardens sink back into the earth.');
        continue;
      }
      if (Math.hypot(p.sim.x - tr.x, p.sim.y - tr.y) > LEASH) {
        this.end(tr, p, false, 'You fled the crypt. The wardens sink back into the earth.');
        continue;
      }
      if (this.t > tr.until) {
        this.end(tr, p, false);
        continue;
      }
      // wardens that left the world another way no longer count
      for (const id of tr.enemies) if (!this.room.enemies.has(id)) tr.enemies.delete(id);
      if (tr.enemies.size || this.t < tr.next) continue;
      if (tr.wave >= WAVES.length) this.end(tr, p, true);
      else {
        this.spawnWave(tr, p);
        if (!tr.enemies.size) {
          this.end(tr, p, false, 'Rubble chokes the crypt: no warden can rise here.');
          continue;
        }
        tr.wave++;
        tr.next = this.t + 2;
      }
    }
  }

  killed(e: Enemy): void {
    for (const tr of this.trials.values()) tr.enemies.delete(e.id);
  }

  leave(p: ServerPlayer): void {
    for (const tr of [...this.trials.values()]) if (tr.pid === p.id) this.end(tr, undefined, false);
  }
}
