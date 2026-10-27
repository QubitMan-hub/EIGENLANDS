/**
 * The three realms on the server (layouts and lore in shared/src/otherworlds.ts).
 *
 * Portals: a realm portal near Hadamere takes a traveller of the realm's level to its arrival room; the return portal
 * there brings them back. Creatures roam each realm near anyone in it; each realm's guardian rises when someone walks
 * into its arena, and falls once per traveller for the first-conquest reward (its drops are the ordinary loot table).
 *
 * The mechanics:
 *  - Aetheria: updrafts carry you between islands; the eyrie's updraft only once you have rung the three wind chimes.
 *  - The Umbral Abyss: away from light (your lantern, the fungus, the Hollow's lamps) the dark gnaws at you and the
 *    shade stalkers come; the Umbral Lantern keeps it off entirely.
 *  - Chronoria: rewind rifts return you to where and how you were eight seconds ago; the chrono gate opens onto the
 *    Unwound's court when its three dials read the hour the archive keeps.
 */
import {
  CHUNK_SIZE,
  DIAL_WORDS,
  MSG,
  OTHERWORLDS,
  OTHERWORLD_CREATURES,
  OTHERWORLD_IDS,
  OTHERWORLD_LORE,
  OTHERWORLD_NODES,
  T,
  TILE_DEFS,
  chronoCode,
  chronoGate,
  isSolid,
  objLight,
  otherworldArena,
  otherworldArrival,
  otherworldOf,
  realmPortals,
  tileAt,
  type EnemyKindName,
  type OtherworldId,
  type WorldObj,
} from '@eigenlands/shared';
import type { Enemy } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { giveStacks } from '../../systems/helpers';
import type { Module, Registrar } from '../types';

const ROAM_MAX = 5;
const NODE_COOLDOWN_MS = 5 * 60_000;
const BOSS_RESPAWN_S = 180;
const REWIND_S = 8;
const DARK_GRACE = 4;
/** keys in prog.ruins */
export const chimeKey = (i: number) => `aechime:${i}`;
export const conquestKey = (w: OtherworldId) => `realmboss:${w}`;

export class OtherworldModule implements Module {
  private t = 0;
  private next = 0;
  private second = 0;
  /** account:x,y -> when the node may be gathered again */
  private gathered = new Map<string, number>();
  /** realm -> the guardian's enemy id while it is up, and when it may rise again */
  private boss = new Map<OtherworldId, { id: string | null; readyAt: number }>();
  /** Chronoria's dials, shared by everyone in the room */
  private dials = [0, 0, 0];
  /** player id -> where and how they were, a second apart (Chronoria) */
  private history = new Map<string, Array<{ x: number; y: number; hp: number }>>();
  /** player id -> seconds spent in the dark (the Abyss) */
  private dark = new Map<string, number>();

  constructor(private room: GameRoom) {}

  install(_reg: Registrar): void {}

  private active(): boolean {
    return this.room.store.generation >= 6;
  }

  private async move(p: ServerPlayer, to: { x: number; y: number }): Promise<void> {
    await this.room.ensureChunk(Math.floor(to.x / CHUNK_SIZE), Math.floor(to.y / CHUNK_SIZE));
    p.sim.x = to.x;
    p.sim.y = to.y;
    p.sim.dashT = 0;
    p.sim.mount = 0;
    p.sim.boat = 0;
    p.queue.length = 0;
    this.room.fx({ kind: 'craft', x: to.x, y: to.y });
  }

  /** where the surface portal of realm `w` stands */
  private surfacePortal(w: OtherworldId): { x: number; y: number } {
    const g = this.room.store.generation;
    return realmPortals(`${this.room.seed}:${g}`, (x, y) => tileAt(this.room.seed, x, y, g))[w];
  }

  // ───────────────────────── interaction ─────────────────────────

  async interact(p: ServerPlayer, o: WorldObj): Promise<boolean> {
    if (!this.active() || p.deadT > 0) return false;
    const w = ((o.data as { realm?: string } | undefined)?.realm ?? otherworldOf(o.y)) as OtherworldId | null;
    if (!w || !OTHERWORLDS[w]) return false;
    const def = OTHERWORLDS[w];
    switch (o.sub) {
      case 'realm_portal': {
        if (p.level < def.level) {
          p.toast(`The portal to ${def.name} will not open for you yet. Return at level ${def.level}.`, 'bad');
          return true;
        }
        await this.move(p, otherworldArrival(w));
        p.toast(`You step through into ${def.name}, ${def.title}. ${def.blurb}`, 'info');
        return true;
      }
      case 'realm_return': {
        const s = this.surfacePortal(w);
        await this.move(p, { x: s.x + 0.5, y: s.y + 1.5 });
        p.toast('You step back through the portal into the world you know.', 'info');
        return true;
      }
      case 'realm_lore':
        this.lore(p, w, o);
        return true;
      case 'realm_altar': {
        const won = p.data.prog.ruins.includes(conquestKey(w));
        p.toast(
          won
            ? `You have bested ${OTHERWORLD_CREATURES[w].bossName}. It will rise again for whoever dares.`
            : `${OTHERWORLD_CREATURES[w].bossName} is bound to this place. Stand your ground in its arena.`,
          'info',
        );
        return true;
      }
      case 'updraft':
        await this.updraft(p, o);
        return true;
      case 'wind_chime': {
        const i = Number((o.data as { chime?: unknown }).chime);
        if (!p.data.prog.ruins.includes(chimeKey(i))) p.data.prog.ruins.push(chimeKey(i));
        p.dirty('stats');
        const rung = [0, 1, 2].filter((k) => p.data.prog.ruins.includes(chimeKey(k))).length;
        this.room.fx({ kind: 'craft', x: o.x + 0.5, y: o.y + 0.5 });
        p.toast(
          rung >= 3
            ? 'The third chime sings, and far off the high wind wakes. The updraft to the eyrie will carry you now.'
            : `The chime rings out across the cloud. (${rung} of 3)`,
          rung >= 3 ? 'good' : 'info',
        );
        return true;
      }
      case 'chrono_dial': {
        const i = Number((o.data as { dial?: unknown }).dial);
        if (!(i >= 0 && i < 3)) return true;
        this.dials[i] = (this.dials[i]! + 1) % 4;
        this.room.fx({ kind: 'craft', x: o.x + 0.5, y: o.y + 0.5 });
        p.toast(`The dial turns with a grinding click. It now points to ${DIAL_WORDS[this.dials[i]!]}.`, 'info');
        return true;
      }
      case 'chrono_gate':
        await this.gate(p);
        return true;
      case 'chrono_rift':
        this.rewind(p);
        return true;
      default: {
        const node = OTHERWORLD_NODES[o.sub];
        if (!node) return false;
        this.gather(p, o, node.item, node.verb);
        return true;
      }
    }
  }

  private lore(p: ServerPlayer, w: OtherworldId, o: WorldObj): void {
    const d = o.data as { lore?: number; archive?: boolean };
    const l = OTHERWORLD_LORE[w][Math.max(0, Math.min(2, Number(d.lore) || 0))]!;
    const pages = [...l.pages];
    if (d.archive)
      pages.push(
        `The tablet's last line is cut deeper: THE HOUR IS ${chronoCode(this.room.seed)
          .map((c) => DIAL_WORDS[c]!.toUpperCase())
          .join(', ')}.`,
      );
    p.client.send(MSG.PANEL, {
      kind: 'lore',
      tx: o.x,
      ty: o.y,
      sub: o.sub,
      lore: { title: d.archive ? 'The Archive’s Tablet' : l.title, plaque: OTHERWORLDS[w].name, epitaph: '', pages },
    });
  }

  private async updraft(p: ServerPlayer, o: WorldObj): Promise<void> {
    const d = o.data as { to?: { x: number; y: number }; eyrie?: boolean };
    if (!d.to) return;
    if (d.eyrie && [0, 1, 2].some((k) => !p.data.prog.ruins.includes(chimeKey(k)))) {
      p.toast('The air here stirs, but will not lift you. Somewhere, three chimes are waiting to be rung.', 'bad');
      return;
    }
    await this.move(p, d.to);
    p.toast(
      d.eyrie
        ? 'The high wind lifts you up to the Eyrie!'
        : 'The updraft lifts you and sets you down across the cloud.',
      'good',
    );
  }

  private async gate(p: ServerPlayer): Promise<void> {
    const code = chronoCode(this.room.seed);
    if (this.dials.some((v, i) => v !== code[i])) {
      p.toast(`The gate does not move. The dials read ${this.dials.map((v) => DIAL_WORDS[v]).join(', ')}.`, 'bad');
      return;
    }
    const a = otherworldArena(this.room.seed, 'chronoria');
    await this.move(p, { x: a.x + 0.5, y: a.y + a.r - 3.5 });
    p.toast(
      'The dials lock, the gate swings through a moment that never was, and you stand in the Unwound’s court.',
      'good',
    );
  }

  private rewind(p: ServerPlayer): void {
    const h = this.history.get(p.id) ?? [];
    const then = h.length > REWIND_S ? h[h.length - 1 - REWIND_S]! : h[0];
    if (!then) {
      p.toast('The rift shimmers. You have not been here long enough for it to remember you.', 'info');
      return;
    }
    p.sim.x = then.x;
    p.sim.y = then.y;
    p.sim.dashT = 0;
    p.queue.length = 0;
    p.hp = Math.max(1, Math.min(p.maxHp, then.hp));
    this.room.fx({ kind: 'craft', x: then.x, y: then.y });
    p.toast('The rift folds around you: you are where, and as, you were a few breaths ago.', 'info');
  }

  private gather(p: ServerPlayer, o: WorldObj, item: string, verb: string): void {
    const key = `${p.accountId}:${o.x},${o.y}`;
    const now = Date.now();
    if ((this.gathered.get(key) ?? 0) > now) {
      p.toast('Nothing left to gather here for now. It will grow back.', 'info');
      return;
    }
    const n = 1 + (this.room.rand() < 0.4 ? 1 : 0);
    if (!giveStacks(p, [{ id: item, n }])) {
      p.toast('Your pack is full.', 'bad');
      return;
    }
    this.gathered.set(key, now + NODE_COOLDOWN_MS);
    p.dirty('inv');
    this.room.grantXp(p, 12);
    this.room.fx({ kind: 'craft', x: o.x + 0.5, y: o.y + 0.5 });
    p.toast(`${verb} (+${n})`, 'good');
  }

  // ───────────────────────── the living realms ─────────────────────────

  tick(_now: number, dt: number): void {
    if (!this.active()) return;
    this.t += dt;
    if (this.t >= this.second) {
      this.second = this.t + 1;
      this.everySecond();
    }
    if (this.t < this.next) return;
    this.next = this.t + 3;
    for (const p of this.room.players.values()) {
      const w = otherworldOf(p.sim.y);
      if (!w || p.deadT > 0) continue;
      this.roam(p, w);
      this.guardian(p, w);
    }
  }

  private everySecond(): void {
    for (const p of this.room.players.values()) {
      const w = otherworldOf(p.sim.y);
      if (w !== 'chronoria') this.history.delete(p.id);
      if (w !== 'umbra') this.dark.delete(p.id);
      if (!w || p.deadT > 0) continue;
      if (w === 'chronoria') {
        const h = this.history.get(p.id) ?? [];
        h.push({ x: p.sim.x, y: p.sim.y, hp: p.hp });
        if (h.length > REWIND_S + 2) h.shift();
        this.history.set(p.id, h);
      }
      if (w === 'umbra') this.darkness(p);
    }
  }

  /** Is the traveller lit: carrying a light, or near the fungus, a crystal seam or the Hollow's lamps? */
  lit(p: ServerPlayer): boolean {
    if (p.data.equip.light) return true;
    const store = this.room.store,
      tx = Math.floor(p.sim.x),
      ty = Math.floor(p.sim.y);
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 4) continue;
        const def = TILE_DEFS[store.getTile(tx + dx, ty + dy)];
        if (def && def.light > 0 && d <= def.light + 0.5) return true;
        const o = store.objectAt(tx + dx, ty + dy);
        const l = o && objLight(o.kind, o.sub);
        if (l && d <= l.radius * 0.7) return true;
      }
    return false;
  }

  private darkness(p: ServerPlayer): void {
    const umbral = p.data.equip.light?.id === 'umbral_lantern';
    if (umbral || this.lit(p)) {
      this.dark.delete(p.id);
      return;
    }
    const n = (this.dark.get(p.id) ?? 0) + 1;
    this.dark.set(p.id, n);
    if (n === DARK_GRACE) p.toast('The dark presses in around you. Find light, or carry it.', 'bad');
    if (n > DARK_GRACE && n % 2 === 0 && p.hp > 1) {
      p.hp = Math.max(1, p.hp - 2);
      this.room.fx({ kind: 'hurt', x: p.sim.x, y: p.sim.y, v: 2, id: p.client.sessionId, w: 1 });
    }
    // the stalkers come for whoever lingers in the dark
    if (n > DARK_GRACE * 2 && this.room.rand() < 0.08) this.spawnNear(p, 'umbra', 'shade_stalker', 8, 12);
  }

  private nearCount(p: ServerPlayer, r: number): number {
    let n = 0;
    for (const e of this.room.enemies.values()) if (Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < r) n++;
    return n;
  }

  private roam(p: ServerPlayer, w: OtherworldId): void {
    if (this.nearCount(p, 30) >= ROAM_MAX) return;
    const kinds = OTHERWORLD_CREATURES[w].roam;
    this.spawnNear(p, w, kinds[Math.floor(this.room.rand() * kinds.length)]!, 13, 22);
  }

  /** a creature on open ground 13–22 tiles away (never in the arrival room or the Hollow) */
  private spawnNear(p: ServerPlayer, w: OtherworldId, kind: string, r0: number, r1: number): Enemy | null {
    const def = OTHERWORLDS[w];
    for (let k = 0; k < 8; k++) {
      const a = this.room.rand() * Math.PI * 2,
        r = r0 + this.room.rand() * (r1 - r0);
      const x = Math.floor(p.sim.x + Math.cos(a) * r),
        y = Math.floor(p.sim.y + Math.sin(a) * r);
      if (!this.room.owns(x, y) || !this.room.store.has(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE)))
        continue;
      if (isSolid(this.room.store.getTile(x, y)) || this.room.store.objectAt(x, y)) continue;
      if (Math.hypot(x, y - def.oy) < 18) continue; // the arrival room is a safe landing
      if (w === 'umbra' && this.room.store.getTile(x, y) === T.VAULT_FLOOR) continue; // the Hollow's floor
      return this.room.spawnEnemy(kind as EnemyKindName, x + 0.5, y + 0.5, false, {
        level: Math.max(def.creatureLevel, p.level - 1),
      });
    }
    return null;
  }

  private guardian(p: ServerPlayer, w: OtherworldId): void {
    const a = otherworldArena(this.room.seed, w);
    if (Math.hypot(p.sim.x - a.x, p.sim.y - a.y) > a.r - 1 || !this.room.owns(a.x, a.y)) return;
    const b = this.boss.get(w) ?? { id: null, readyAt: 0 };
    if (b.id && this.room.enemies.has(b.id)) return;
    if (this.t < b.readyAt) return;
    const e = this.room.spawnEnemy(OTHERWORLD_CREATURES[w].boss as EnemyKindName, a.x + 0.5, a.y - 2.5, false, {
      level: Math.max(OTHERWORLDS[w].creatureLevel + 2, p.level),
    });
    e.provoked = true;
    this.boss.set(w, { id: e.id, readyAt: 0 });
    for (const q of this.room.players.values())
      if (Math.hypot(q.sim.x - a.x, q.sim.y - a.y) < a.r + 10)
        q.toast(`${OTHERWORLD_CREATURES[w].bossName} rises!`, 'bad');
  }

  killed(e: Enemy): void {
    for (const w of OTHERWORLD_IDS) {
      const b = this.boss.get(w);
      if (!b || b.id !== e.id) continue;
      this.boss.set(w, { id: null, readyAt: this.t + BOSS_RESPAWN_S });
      for (const p of this.room.players.values()) {
        if (Math.hypot(p.sim.x - e.x, p.sim.y - e.y) > 30) continue;
        const key = conquestKey(w);
        if (!p.data.prog.ruins.includes(key)) {
          p.data.prog.ruins.push(key);
          p.dirty('stats');
          this.room.grantXp(p, 400 + p.level * 30);
          p.toast(
            `${OTHERWORLD_CREATURES[w].bossName} is vanquished! ${OTHERWORLDS[w].name} will remember you.`,
            'good',
          );
        } else p.toast(`${OTHERWORLD_CREATURES[w].bossName} falls once more.`, 'good');
      }
    }
  }

  /** for tests */
  state(): { dials: number[]; boss: Record<string, string | null> } {
    return {
      dials: [...this.dials],
      boss: Object.fromEntries(OTHERWORLD_IDS.map((w) => [w, this.boss.get(w)?.id ?? null])),
    };
  }
}
