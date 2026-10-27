/**
 * Ruin crypts (master plan §16 "dungeons and ruins"; layout in shared/src/crypts.ts). The sealed door under a ruin
 * leads down to a real interior: an entrance with stairs back up, a passage, the wardens' hall and the reliquary
 * chamber. The first time a traveller steps into the hall the wardens rise there in three waves; everyone in the
 * crypt fights them together. Clearing the hall unseals the reliquary for each traveller who was there, once each.
 * Leaving the crypt, falling or taking too long lets the wardens sink back, and the hall can be tried again.
 *
 * Below the reliquary a stair leads to the second floor, the Sunken Vault: a hall of three levers whose seals must all
 * burn before the gate opens, a crypt lord who rises in the chamber beyond, and three statues of which the
 * inscription's riddle names one. Touch the right statue and the vault opens; touch another and the dead answer.
 */
import {
  CHUNK_SIZE,
  DEEP_GATE,
  DEEP_LORD,
  ELITE,
  SEALS_LIT,
  cryptDeepAt,
  cryptRiddle,
  deepAnchor,
  deepArrival,
  deepReturn,
  inDeepRoom,
  isCryptDeepY,
  leverMasks,
  leverStart,
  sealWords,
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
const gateKey = (ruin: string) => `cryptgate:${ruin}`;
const lordKey = (ruin: string) => `cryptlord:${ruin}`;
const riddleKey = (ruin: string) => `cryptriddle:${ruin}`;
const deepKey = (ruin: string) => `cryptdeep:${ruin}`;
/** the crypt lord: how much above the strongest of the party it rises */
const LORD_LEVELS = 2;

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
    else if (o.sub === 'crypt_plaque')
      p.toast(
        (o.data as { deep?: boolean } | undefined)?.deep
          ? `Three seals guard the gate below. Each lever turns over its own seal and one beside it. Bring all three to flame. (${sealWords(this.seals(c))})`
          : cryptPlaqueText(this.room.seed, c),
        'info',
      );
    else if (o.sub === 'trial_brazier') this.lightBrazier(p, c, o);
    else if (o.sub === 'crypt_stairs_down') {
      if (!prog.includes(lootedKey(c.ruin.id))) {
        p.toast('Behind the reliquary a stair goes down, barred while the reliquary stays sealed.', 'bad');
        return;
      }
      await this.move(p, deepArrival(c));
      p.toast('You go further down, into the Sunken Vault. The air is colder here.', 'info');
    } else if (o.sub === 'crypt_stairs_up') {
      await this.move(p, deepReturn(c));
      p.toast('You climb back up to the reliquary chamber.', 'info');
    } else if (o.sub === 'crypt_lever') this.pullLever(p, c, o);
    else if (o.sub === 'crypt_gate') await this.passGate(p, c);
    else if (o.sub === 'crypt_inscription') {
      const r = cryptRiddle(this.room.seed, c);
      p.toast(`${r.text} The statues, left to right: ${r.names.join(', ')}.`, 'info');
    } else if (o.sub === 'crypt_statue') this.touchStatue(p, c, o);
    else if (o.sub === 'crypt_vault') this.openVault(p, c, o);
  }

  // ───────────────────────── the Sunken Vault ─────────────────────────

  /** ruin -> the seals burning in its hall of levers (shared by everyone down there) */
  private sealsOf = new Map<string, number>();
  /** ruin -> the crypt lord risen in its chamber */
  private lords = new Map<string, { enemy: string; party: Set<string> }>();

  private seals(c: CryptSite): number {
    return this.sealsOf.get(c.ruin.id) ?? leverStart(this.room.seed, c);
  }
  /** everyone on crypt `c`'s deep floor */
  private deepParty(c: CryptSite): ServerPlayer[] {
    return [...this.room.players.values()].filter(
      (q) =>
        q.deadT <= 0 && cryptDeepAt(this.room.seed, Math.floor(q.sim.x), Math.floor(q.sim.y))?.ruin.id === c.ruin.id,
    );
  }

  private pullLever(p: ServerPlayer, c: CryptSite, o: WorldObj): void {
    const idx = Number((o.data as { idx?: unknown } | undefined)?.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx > 2) return;
    const id = c.ruin.id;
    if (p.data.prog.ruins.includes(gateKey(id))) {
      p.toast('The lever is stiff. All three seals burn; the gate stands open.', 'info');
      return;
    }
    const s = this.seals(c) ^ leverMasks(this.room.seed, c)[idx]!;
    this.sealsOf.set(id, s);
    this.room.fx({ kind: 'craft', x: o.x + 0.5, y: o.y + 0.5 });
    if (s !== SEALS_LIT) {
      p.toast(`Clank. The seals: ${sealWords(s)}.`, 'info');
      return;
    }
    // all three burn: the gate grinds open for everyone down here
    for (const q of this.deepParty(c)) {
      if (!q.data.prog.ruins.includes(gateKey(id))) q.data.prog.ruins.push(gateKey(id));
      q.dirty('stats');
      q.toast('All three seals burst into flame. With a groan of old iron, the gate rises.', 'good');
    }
    this.sealsOf.delete(id);
  }

  private async passGate(p: ServerPlayer, c: CryptSite): Promise<void> {
    if (!p.data.prog.ruins.includes(gateKey(c.ruin.id))) {
      p.toast(`The gate is shut fast. Three seals above it: ${sealWords(this.seals(c))}.`, 'bad');
      return;
    }
    const a = deepAnchor(c);
    const north = p.sim.y < a.y + DEEP_GATE[1] + 0.5;
    await this.move(p, { x: a.x + DEEP_GATE[0] + 0.5, y: a.y + DEEP_GATE[1] + (north ? 2.5 : -1.5) });
    p.toast(
      north ? 'You duck beneath the raised gate into the chamber beyond.' : 'You go back beneath the gate.',
      'info',
    );
  }

  private touchStatue(p: ServerPlayer, c: CryptSite, o: WorldObj): void {
    const id = c.ruin.id,
      ruins = p.data.prog.ruins;
    const idx = Number((o.data as { idx?: unknown } | undefined)?.idx);
    const r = cryptRiddle(this.room.seed, c);
    const name = r.names[idx] ?? 'a statue';
    if (!ruins.includes(lordKey(id))) {
      p.toast(`The statue of ${name} stands cold while the crypt lord walks.`, 'bad');
      return;
    }
    if (ruins.includes(riddleKey(id))) {
      p.toast(`The statue of ${name} is silent. The vault has heard its answer.`, 'info');
      return;
    }
    if (idx !== r.answer) {
      p.toast(`The eyes of ${name} burn. The dead answer!`, 'bad');
      const a = deepAnchor(c);
      for (const dx of [-2, 2])
        this.room.spawnEnemy('wisp', a.x + dx + 0.5, a.y + 26.5, false, { level: Math.max(3, p.level) });
      return;
    }
    ruins.push(riddleKey(id));
    p.dirty('stats');
    this.room.fx({ kind: 'craft', x: o.x + 0.5, y: o.y + 0.5 });
    p.toast(`You lay your hand on ${name}. Stone grinds: the vault in the middle of the chamber unseals.`, 'good');
  }

  private openVault(p: ServerPlayer, c: CryptSite, o: WorldObj): void {
    const id = c.ruin.id,
      ruins = p.data.prog.ruins;
    if (ruins.includes(deepKey(id))) {
      p.toast('The vault stands open and empty.', 'info');
      return;
    }
    if (!ruins.includes(riddleKey(id))) {
      p.toast('The vault is sealed. The inscription on the wall speaks of who may open it.', 'bad');
      return;
    }
    const rand = this.room.rand;
    const loot: Stack[] = [
      ...ruinLoot(this.room.seed, id, c.ruin.biome, rand),
      ...ruinLoot(this.room.seed, id, c.ruin.biome, rand),
      ...ruinLoot(this.room.seed, id, c.ruin.biome, rand),
      { id: RARE[Math.floor(rand() * RARE.length)]!, n: 1 },
    ];
    if (!giveStacks(p, loot)) {
      p.toast('Your pack is too full to carry the vault’s treasure. Make room and come back.', 'bad');
      return;
    }
    const coins = 120 + p.level * 15;
    p.data.coins += coins;
    ruins.push(deepKey(id));
    p.dirty('inv', 'coins', 'stats');
    this.room.grantXp(p, 220 + p.level * 20);
    this.room.fx({ kind: 'chest', x: o.x + 0.5, y: o.y + 0.5 });
    p.toast(`The vault of the Sunken Crypt opens! (+${coins} coins)`, 'good');
  }

  /** the crypt lord rises when someone who has not yet beaten it walks into its chamber */
  private deepTick(): void {
    const here = new Map<string, { c: CryptSite; ps: ServerPlayer[] }>();
    for (const p of this.room.players.values()) {
      if (p.deadT > 0 || !isCryptDeepY(p.sim.y)) continue;
      const c = cryptDeepAt(this.room.seed, Math.floor(p.sim.x), Math.floor(p.sim.y));
      if (!c) continue;
      const e = here.get(c.ruin.id) ?? { c, ps: [] };
      e.ps.push(p);
      here.set(c.ruin.id, e);
      const lord = this.lords.get(c.ruin.id);
      if (!inDeepRoom(c, 'chamber', p.sim.x, p.sim.y) || p.data.prog.ruins.includes(lordKey(c.ruin.id))) continue;
      if (lord) lord.party.add(p.id);
      else {
        const a = deepAnchor(c);
        const level = Math.max(6, p.level + LORD_LEVELS);
        const en = this.room.spawnEnemy('vault_guardian', a.x + DEEP_LORD[0] + 0.5, a.y + DEEP_LORD[1] + 0.5, false, {
          level,
          elite: ELITE.HARDENED,
        });
        en.def = {
          ...en.def,
          name: 'Crypt Lord',
          aoe: (en.def.aoe ?? 1) * 1.4,
          damage: Math.round(en.def.damage * 1.3),
        };
        this.lords.set(c.ruin.id, { enemy: en.id, party: new Set([p.id]) });
        p.toast('The air turns to ice. The Crypt Lord rises from its bier!', 'bad');
      }
    }
    // a lord with nobody left down there sinks back
    for (const [id, lord] of this.lords)
      if (!here.has(id) && this.room.enemies.has(lord.enemy)) {
        this.room.enemies.delete(lord.enemy);
        this.room.state.enemies.delete(lord.enemy);
        this.lords.delete(id);
      } else if (!this.room.enemies.has(lord.enemy) && !here.has(id)) this.lords.delete(id);
  }

  /** the crypt lord in a crypt, for tests */
  lordOf(ruin: string): string | null {
    return this.lords.get(ruin)?.enemy ?? null;
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
    this.deepTick();
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
    for (const [id, lord] of this.lords) {
      if (lord.enemy !== e.id) continue;
      this.lords.delete(id);
      for (const pid of lord.party) {
        const p = this.room.players.get(pid);
        if (!p || p.data.prog.ruins.includes(lordKey(id))) continue;
        p.data.prog.ruins.push(lordKey(id));
        p.dirty('stats');
        this.room.grantXp(p, 150 + p.level * 15);
        p.toast('The Crypt Lord crumbles to dust. The three statues turn their faces toward you.', 'good');
      }
    }
  }
}
