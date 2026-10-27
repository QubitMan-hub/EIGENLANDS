/**
 * Living kingdoms on the server (master plan §16): loads the world's civilization, steps it once per world day,
 * tells players what changed, and lets a player decide a kingdom's court intrigue. The model itself is pure and
 * shared (shared/src/civ.ts); player deeds reach it through recordCiv (registry.ts).
 */
import {
  KINGDOMS,
  MSG_CIV,
  REALM_IDS,
  civSummary,
  inRealmLand,
  resolveIntrigue,
  stepCiv,
  validCiv,
  type RealmId,
} from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { runtime } from '../../rooms/runtime';
import { gainRep } from '../../systems/reputation';
import type { Module, Registrar } from '../types';
import { civEntry } from './registry';

const SAVE_EVERY = 20;
const key = (seed: number) => `civ:${seed}`;

export class CivModule implements Module {
  private t = 0;
  private nextCheck = 0;
  private savedAt = 0;

  constructor(private room: GameRoom) {}

  /** Kingdoms exist from world revision 5. */
  private active(): boolean {
    return this.room.store.generation >= 5;
  }

  private entry() {
    return civEntry(this.room.seed);
  }

  /** Load (once per process) and bring up to today. */
  async ready(): Promise<void> {
    if (!this.active()) return;
    const e = this.entry();
    if (!e.w && !e.loading)
      e.loading = (async () => {
        const raw = await runtime()
          .repo.getBlob(key(this.room.seed))
          .catch(() => null);
        e.w = validCiv(this.room.seed, raw, this.room.wclock.day());
        stepCiv(this.room.seed, e.w, this.room.wclock.day());
        e.dirty = true;
      })();
    await e.loading;
  }

  install(reg: Registrar): void {
    reg.on<{ realm?: unknown; choice?: unknown }>(MSG_CIV.CHOOSE, 'board', (p, m) => this.choose(p, m));
    void this.ready();
  }

  async join(p: ServerPlayer): Promise<void> {
    if (!this.active()) return;
    await this.ready();
    const w = this.entry().w;
    if (w) p.client.send(MSG_CIV.STATE, civSummary(w));
  }

  private broadcast(): void {
    const w = this.entry().w;
    if (!w) return;
    const msg = civSummary(w);
    for (const p of this.room.players.values()) p.client.send(MSG_CIV.STATE, msg);
  }

  private choose(p: ServerPlayer, m: { realm?: unknown; choice?: unknown }): void {
    const w = this.entry().w;
    const realm = m.realm as RealmId;
    if (!w || !REALM_IDS.includes(realm) || (m.choice !== 'a' && m.choice !== 'b')) return;
    if (!w.kingdoms[realm].intrigue) {
      p.toast('That matter has already been settled.', 'info');
      return;
    }
    if (inRealmLand(this.room.seed, p.sim.x, p.sim.y) !== realm) {
      p.toast(`Court business of ${KINGDOMS[realm].name} is settled in ${KINGDOMS[realm].name}.`, 'bad');
      return;
    }
    const e = resolveIntrigue(w, realm, m.choice, this.room.wclock.day());
    if (!e) return;
    this.entry().dirty = true;
    if (e.coins) {
      p.data.coins += e.coins;
      p.dirty('coins');
    }
    if (e.rep) gainRep(p, realm, e.rep);
    p.toast(`Your choice shapes ${KINGDOMS[realm].name}. +${e.coins} coins.`, 'good');
    this.broadcast();
  }

  tick(_now: number, dt: number): void {
    this.t += dt;
    if (this.t < this.nextCheck || !this.active()) return;
    this.nextCheck = this.t + 3;
    const e = this.entry();
    if (!e.w) return;
    if (stepCiv(this.room.seed, e.w, this.room.wclock.day())) {
      e.dirty = true;
      this.broadcast();
    }
    if (e.dirty && this.t - this.savedAt > SAVE_EVERY) void this.persist();
  }

  private async persist(): Promise<void> {
    const e = this.entry();
    if (!e.w) return;
    this.savedAt = this.t;
    e.dirty = false;
    await runtime()
      .repo.putBlob(key(this.room.seed), e.w)
      .catch((err) => console.error('civ save failed', err));
  }

  async dispose(): Promise<void> {
    if (this.entry().dirty) await this.persist();
  }

  debug(): unknown {
    const w = this.entry().w;
    return w ? { day: w.day, wars: REALM_IDS.flatMap((r) => w.kingdoms[r].wars.map((x) => `${r}-${x.with}`)) } : null;
  }
}
