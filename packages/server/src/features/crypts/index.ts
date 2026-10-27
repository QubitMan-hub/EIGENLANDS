/**
 * Ruin crypts (master plan §16 "dungeons and ruins"; layout in shared/src/crypts.ts). The sealed door under a ruin
 * leads down to a real interior: an entrance with stairs back up, a passage, the wardens' hall and the reliquary
 * chamber. The first time a traveller steps into the hall the wardens rise there in three waves; everyone in the
 * crypt fights them together. Clearing the hall unseals the reliquary for each traveller who was there, once each.
 * Leaving the crypt, falling or taking too long lets the wardens sink back, and the hall can be tried again.
 */
import {
  CHUNK_SIZE,
  brazierName,
  cryptAt,
  cryptOrder,
  cryptPlaqueText,
  cryptArrival,
  cryptOf,
  cryptSurface,
  cryptWardenSpots,
  inCryptHall,
  isCryptY,
  ruinLoot,
  ruinOfCell,
  storyText,
  type CryptSite,
  type EnemyKindName,
  type Stack,
  type WorldObj,
} from '@eigenlands/shared';
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
const TRIAL_SECS = 300;
const RARE = ['heart_crystal', 'shrine_shard', 'qubit_tea', 'outfit_gold'];

interface Trial {
  crypt: CryptSite;
  wave: number;
  enemies: Set<string>;
  next: number;
  until: number;
  /** everyone who has fought in the hall this time */
  party: Set<string>;
}

const chunkOf = (v: number) => Math.floor(v / CHUNK_SIZE);
const clearedKey = (ruin: string) => `cryptclear:${ruin}`;
const lootedKey = (ruin: string) => `crypt:${ruin}`;
const cacheKey = (ruin: string) => `cryptcache:${ruin}`;

export class CryptModule implements Module {
  private t = 0;
  private trials = new Map<string, Trial>();

  constructor(private room: GameRoom) {}

  install(_reg: Registrar): void {}

  private cryptOfObj(o: WorldObj): CryptSite | null {
    const id = (o.data as { ruin?: unknown } | undefined)?.ruin;
    const m = typeof id === 'string' ? /^ru(-?\d+)_(-?\d+)$/.exec(id) : null;
    const r = m ? ruinOfCell(this.room.seed, Number(m[1]), Number(m[2])) : null;
    return r ? cryptOf(this.room.seed, r) : null;
  }

  private async move(p: ServerPlayer, to: { x: number; y: number }): Promise<void> {
    await this.room.ensureChunk(chunkOf(to.x), chunkOf(to.y));
    p.sim.x = to.x;
    p.sim.y = to.y;
    p.sim.dashT = 0;
    p.sim.mount = 0;
    p.queue.length = 0;
    this.room.fx({ kind: 'craft', x: to.x, y: to.y });
  }

  async interact(p: ServerPlayer, o: WorldObj): Promise<void> {
    const c = this.cryptOfObj(o);
    if (!c || p.deadT > 0) return;
    const prog = p.data.prog.ruins;
    if (o.sub === 'ruin_crypt') {
      if (p.level < CRYPT_LEVEL) {
        p.toast(`The seal will not yield to you. Return at level ${CRYPT_LEVEL}.`, 'bad');
        return;
      }
      const txt = storyText(this.room.seed, c.ruin.id, 'crypt', c.ruin.biome, c.door.x, c.door.y);
      await this.move(p, cryptArrival(c));
      p.toast(
        prog.includes(lootedKey(c.ruin.id))
          ? 'You go down into the crypt. The wardens sleep; the reliquary stands empty.'
          : `${txt.plaque}. You go down the steps into the dark.`,
        'info',
      );
    } else if (o.sub === 'crypt_exit') {
      await this.move(p, cryptSurface(c));
      p.toast('You climb back up into the ruin.', 'info');
    } else if (o.sub === 'crypt_reliquary') this.openReliquary(p, c, o);
    else if (o.sub === 'crypt_plaque') p.toast(cryptPlaqueText(this.room.seed, c), 'info');
    else if (o.sub === 'trial_brazier') this.lightBrazier(p, c, o);
  }

  /** player id -> braziers lit so far, in order, in one crypt */
  private lit = new Map<string, { ruin: string; seq: number[] }>();

  /** The braziers' riddle: light the four flames in the order the dead were laid, and the ossuary opens. */
  private lightBrazier(p: ServerPlayer, c: CryptSite, o: WorldObj): void {
    const idx = Number((o.data as { idx?: unknown } | undefined)?.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) return;
    const ruins = p.data.prog.ruins,
      id = c.ruin.id;
    const name = brazierName(this.room.seed, c, idx);
    if (this.trials.has(id) || !ruins.includes(clearedKey(id))) {
      p.toast(`The brazier is carved with ${name}'s name. Its bowl is cold while the wardens stand.`, 'info');
      return;
    }
    if (ruins.includes(cacheKey(id))) {
      p.toast(`${name}'s flame burns low and steady. The dead have shared what they kept.`, 'info');
      return;
    }
    const st = this.lit.get(p.id)?.ruin === id ? this.lit.get(p.id)! : { ruin: id, seq: [] };
    if (st.seq.includes(idx)) {
      p.toast(`${name}'s flame is already lit.`, 'info');
      return;
    }
    st.seq.push(idx);
    this.lit.set(p.id, st);
    this.room.fx({ kind: 'craft', x: o.x + 0.5, y: o.y + 0.5 });
    const order = cryptOrder(this.room.seed, c);
    if (st.seq.some((v, i) => order[i] !== v)) {
      this.lit.delete(p.id);
      p.toast(`${name}'s flame gutters out, and every flame with it. A cold draught: that was not the order.`, 'bad');
      const spot = cryptWardenSpots(c)[0]!;
      this.room.spawnEnemy('wisp', spot.x, spot.y, false, { level: Math.max(3, p.level) });
      return;
    }
    if (st.seq.length < 4) {
      p.toast(`You light ${name}'s flame. (${st.seq.length} of 4)`, 'info');
      return;
    }
    // all four in order: the ossuary behind the sarcophagi opens
    this.lit.delete(p.id);
    const loot: Stack[] = [...ruinLoot(this.room.seed, id, c.ruin.biome, this.room.rand)];
    if (this.room.rand() < 0.5) loot.push({ id: RARE[Math.floor(this.room.rand() * RARE.length)]!, n: 1 });
    if (!giveStacks(p, loot)) {
      p.toast('A hidden niche grinds open, but your pack is too full. Make room and light them again.', 'bad');
      return;
    }
    ruins.push(cacheKey(id));
    const coins = 40 + p.level * 8;
    p.data.coins += coins;
    p.dirty('inv', 'coins', 'stats');
    this.room.grantXp(p, 90 + p.level * 10);
    p.toast(`All four flames roar. Stone grinds in the walls: a hidden ossuary opens! (+${coins} coins)`, 'good');
  }

  private openReliquary(p: ServerPlayer, c: CryptSite, o: WorldObj): void {
    const prog = p.data.prog.ruins;
    if (prog.includes(lootedKey(c.ruin.id))) {
      p.toast('The reliquary stands open and empty.', 'info');
      return;
    }
    if (!prog.includes(clearedKey(c.ruin.id))) {
      p.toast('The reliquary is sealed while its wardens still stand.', 'bad');
      return;
    }
    const rand = this.room.rand;
    const loot: Stack[] = [
      ...ruinLoot(this.room.seed, c.ruin.id, c.ruin.biome, rand),
      ...ruinLoot(this.room.seed, c.ruin.id, c.ruin.biome, rand),
    ];
    if (rand() < 0.35) loot.push({ id: RARE[Math.floor(rand() * RARE.length)]!, n: 1 });
    if (!giveStacks(p, loot)) {
      p.toast('Your pack is too full to carry the reliquary’s treasure. Make room and come back.', 'bad');
      return;
    }
    const coins = 60 + p.level * 10;
    p.data.coins += coins;
    prog.push(lootedKey(c.ruin.id));
    p.dirty('inv', 'coins');
    this.room.grantXp(p, 120 + p.level * 15);
    this.room.fx({ kind: 'chest', x: o.x + 0.5, y: o.y + 0.5 });
    p.toast(`The reliquary opens! (+${coins} coins)`, 'good');
  }

  /** the trial in a crypt, for tests */
  trialOf(ruin: string): { wave: number; enemies: string[]; party: string[] } | null {
    const tr = this.trials.get(ruin);
    return tr ? { wave: tr.wave, enemies: [...tr.enemies], party: [...tr.party] } : null;
  }

  private spawnWave(tr: Trial, level: number): void {
    const spots = cryptWardenSpots(tr.crypt);
    WAVES[tr.wave]!.forEach((kind, i) => {
      const s = spots[(i + tr.wave) % spots.length]!;
      const e = this.room.spawnEnemy(kind, s.x, s.y, false, { level: Math.max(3, level) });
      tr.enemies.add(e.id);
    });
    for (const pid of tr.party)
      this.room.players.get(pid)?.toast(`Wave ${tr.wave + 1} of ${WAVES.length}: the wardens rise!`, 'bad');
  }

  private end(tr: Trial, won: boolean): void {
    this.trials.delete(tr.crypt.ruin.id);
    for (const id of tr.enemies) {
      this.room.enemies.delete(id);
      this.room.state.enemies.delete(id);
    }
    for (const pid of tr.party) {
      const p = this.room.players.get(pid);
      if (!p) continue;
      if (won) {
        if (!p.data.prog.ruins.includes(clearedKey(tr.crypt.ruin.id)))
          p.data.prog.ruins.push(clearedKey(tr.crypt.ruin.id));
        p.dirty('stats');
        p.toast(
          'The last warden falls. At the far end of the crypt, the reliquary’s seal breaks. The four braziers stand cold, waiting.',
          'good',
        );
      } else if (isCryptY(p.sim.y)) p.toast('The wardens sink back into the stone. The hall falls silent.', 'bad');
    }
  }

  tick(_now: number, dt: number): void {
    this.t += dt;
    // who is in which crypt
    const inside = new Map<string, ServerPlayer[]>();
    for (const p of this.room.players.values()) {
      if (p.deadT > 0 || !isCryptY(p.sim.y)) continue;
      const c = cryptAt(this.room.seed, Math.floor(p.sim.x), Math.floor(p.sim.y));
      if (!c) continue;
      const list = inside.get(c.ruin.id) ?? [];
      list.push(p);
      inside.set(c.ruin.id, list);
      // stepping into the hall wakes the wardens for anyone who has not yet cleared it
      if (
        inCryptHall(c, p.sim.x, p.sim.y) &&
        !this.trials.has(c.ruin.id) &&
        !p.data.prog.ruins.includes(clearedKey(c.ruin.id))
      ) {
        this.trials.set(c.ruin.id, {
          crypt: c,
          wave: 0,
          enemies: new Set(),
          next: this.t + 1.2,
          until: this.t + TRIAL_SECS,
          party: new Set([p.id]),
        });
        p.toast('Dust falls from the ceiling. Something stirs in the hall…', 'bad');
      }
    }
    for (const tr of [...this.trials.values()]) {
      const here = inside.get(tr.crypt.ruin.id) ?? [];
      for (const p of here) if (inCryptHall(tr.crypt, p.sim.x, p.sim.y)) tr.party.add(p.id);
      if (!here.length || this.t > tr.until) {
        this.end(tr, false);
        continue;
      }
      for (const id of tr.enemies) if (!this.room.enemies.has(id)) tr.enemies.delete(id);
      if (tr.enemies.size || this.t < tr.next) continue;
      if (tr.wave >= WAVES.length) this.end(tr, true);
      else {
        this.spawnWave(tr, Math.max(...here.map((p) => p.level)));
        tr.wave++;
        tr.next = this.t + 2;
      }
    }
  }

  killed(e: Enemy): void {
    for (const tr of this.trials.values()) tr.enemies.delete(e.id);
  }
}
