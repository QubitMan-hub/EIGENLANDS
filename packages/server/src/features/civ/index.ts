/**
 * Living kingdoms on the server (master plan §16): loads the world's civilization, steps it once per world day,
 * tells players what changed, and lets a player decide a kingdom's court intrigue. The model itself is pure and
 * shared (shared/src/civ.ts); player deeds reach it through recordCiv (registry.ts).
 */
import {
  CHUNK_SIZE,
  COTTAGE_H,
  COTTAGE_W,
  KINGDOMS,
  REALM_SITES,
  T,
  civOwner,
  civSiteName,
  cottageCells,
  cottageFurniture,
  cottagesEarned,
  growthPlots,
  townsNear,
  MSG_CIV,
  REALM_IDS,
  civSummary,
  inRealmLand,
  resolveIntrigue,
  stepCiv,
  validCiv,
  type CivWorld,
  type RealmId,
} from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { runtime } from '../../rooms/runtime';
import { gainRep } from '../../systems/reputation';
import type { Module, Registrar } from '../types';
import { civEntry } from './registry';

const SAVE_EVERY = 20;
/** ground a cottage may stand on (no roads: those stay clear) */
const BUILDABLE = new Set<number>([T.GRASS, T.GRASS_TALL, T.FLOWERS, T.SAND, T.STUMP]);
const key = (seed: number) => `civ:${seed}`;

export class CivModule implements Module {
  private t = 0;
  private nextCheck = 0;
  private savedAt = 0;
  private growing = false;
  private grownDay = -1;

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
    await this.grow();
  }

  /**
   * Settlement growth: each settlement this room holds that has earned more cottages than stand on its outskirts
   * raises one more, on the first of its seeded plots that is clear, level, off the roads and outside every town.
   */
  async grow(force = false): Promise<number> {
    const w = this.entry().w;
    if (!w || this.room.store.generation < 6 || this.growing || (!force && this.grownDay === w.day)) return 0;
    this.growing = true;
    this.grownDay = w.day;
    try {
      return await this.growNow(w);
    } finally {
      this.growing = false;
    }
  }

  private async growNow(w: CivWorld): Promise<number> {
    let raised = 0;
    for (const site of REALM_SITES) {
      if (!this.room.owns(Math.floor(site.cx), Math.floor(site.cy))) continue;
      const want = cottagesEarned(w.kingdoms[site.realm], site);
      if (!want) continue;
      const owner = civOwner(site.realm);
      const plots = growthPlots(this.room.seed, site);
      let have = 0;
      for (const pl of plots)
        if (this.room.store.structureAt(pl.x, pl.y)?.owner === owner) {
          have++;
          // a cottage raised before furnishing came in gets its furniture now
          for (const f of cottageFurniture(pl.x, pl.y))
            if (!this.room.store.objectAt(f.x, f.y))
              this.room.objects.put({ x: f.x, y: f.y, kind: 'furniture', sub: f.sub, owner, data: {} });
        }
      if (have >= want) continue;
      for (const pl of plots) {
        if (this.room.store.structureAt(pl.x, pl.y)) continue;
        if (!(await this.plotClear(pl.x, pl.y))) continue;
        for (const c of cottageCells(site.realm, pl.x, pl.y))
          this.room.objects.put({ x: c.x, y: c.y, kind: 'structure', sub: 'cell', owner, data: c.data });
        // furnished, and a family moves in
        for (const f of cottageFurniture(pl.x, pl.y))
          this.room.objects.put({ x: f.x, y: f.y, kind: 'furniture', sub: f.sub, owner, data: {} });
        raised++;
        const k = w.kingdoms[site.realm];
        k.chronicle.unshift({ day: w.day, text: `A new cottage goes up on the edge of ${civSiteName(site)}.` });
        if (k.chronicle.length > 24) k.chronicle.length = 24;
        this.entry().dirty = true;
        break;
      }
    }
    return raised;
  }

  private async plotClear(x0: number, y0: number): Promise<boolean> {
    const x1 = x0 + COTTAGE_W - 1,
      y1 = y0 + COTTAGE_H - 1;
    for (let cy = Math.floor((y0 - 1) / CHUNK_SIZE); cy <= Math.floor((y1 + 1) / CHUNK_SIZE); cy++)
      for (let cx = Math.floor((x0 - 1) / CHUNK_SIZE); cx <= Math.floor((x1 + 1) / CHUNK_SIZE); cx++) {
        if (!this.room.ownsChunk(cx, cy)) return false;
        await this.room.ensureChunk(cx, cy);
      }
    if (
      townsNear(this.room.seed, x0 - 3, y0 - 3, x1 + 3, y1 + 3).some(
        (t) => x1 >= t.x0 - 3 && x0 <= t.x1 + 3 && y1 >= t.y0 - 3 && y0 <= t.y1 + 3,
      )
    )
      return false;
    const store = this.room.store;
    const level = store.levelAt(x0, y0);
    for (let y = y0 - 1; y <= y1 + 1; y++)
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        const t = store.getTile(x, y);
        if (!BUILDABLE.has(t)) return false;
        if (store.levelAt(x, y) !== level || store.objectAt(x, y) || store.structureAt(x, y)) return false;
      }
    for (const p of this.room.players.values())
      if (p.sim.x >= x0 - 1 && p.sim.x <= x1 + 2 && p.sim.y >= y0 - 1 && p.sim.y <= y1 + 2) return false;
    return true;
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
      void this.grow();
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
