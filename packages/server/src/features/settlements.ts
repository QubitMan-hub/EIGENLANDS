import {
  MSG,
  NpcState,
  readCharter,
  inspectHome,
  CHARTER_TIERS,
  RESIDENT_NAMES,
  removeItem,
  countItem,
  guildRank,
  type Charter,
  type WorldObj,
  type PanelMsg,
  type ResidentRole,
} from '@eigenlands/shared';
import type { GameRoom } from '../rooms/GameRoom';
import type { ServerPlayer } from '../rooms/player';
import type { Module, Registrar } from './types';
import { guildPanel } from '../systems/guild';
export class Settlements implements Module {
  private time = 0;
  private actors = new Set<string>();
  private staff = new Map<string, WorldObj>();
  constructor(private room: GameRoom) {}
  install(reg: Registrar): void {
    reg.on<any>('settlement', 'board', (p, m) => this.act(p, m));
  }
  private homes(p: ServerPlayer, b: WorldObj) {
    return [...this.room.objects.all()]
      .filter(
        (o) =>
          o.owner === p.accountId &&
          ['bed', 'double_bed', 'canopy_bed', 'hammock'].includes(o.sub) &&
          Math.hypot(o.x - b.x, o.y - b.y) <= 24,
      )
      .map((o) => ({ x: o.x, y: o.y, ...inspectHome(this.room.store, p.accountId, o.x, o.y) }));
  }
  private panel(p: ServerPlayer, b: WorldObj, c: Charter) {
    p.client.send(MSG.PANEL, {
      kind: 'settlement',
      tx: b.x,
      ty: b.y,
      sub: b.sub,
      settlement: {
        ...c,
        name: CHARTER_TIERS[c.tier]!,
        homes: this.homes(p, b).map((h) => ({ x: h.x, y: h.y, valid: h.valid, reason: h.reason })),
      },
    } satisfies PanelMsg);
  }
  private act(p: ServerPlayer, m: any): void {
    if (!m || !Number.isInteger(m.tx) || !Number.isInteger(m.ty) || p.deadT > 0) return;
    const b = this.room.store.objectAt(m.tx, m.ty);
    if (
      b?.sub !== 'guild_noticeboard' ||
      b.owner !== p.accountId ||
      Math.hypot(p.sim.x - b.x - 0.5, p.sim.y - b.y - 0.5) > 3.5
    )
      return;
    const c = readCharter(b.data?.charter, this.room.wclock.day());
    if (m.action === 'deposit') {
      if (p.data.coins < 100 || c.bank > 99900) {
        p.toast('Deposit needs 100 coins and treasury space.');
        return;
      }
      p.data.coins -= 100;
      c.bank += 100;
      p.dirty('coins');
    } else if (m.action === 'upgrade') {
      const price = 250 * (c.tier + 1),
        wood = 30 * (c.tier + 1),
        stone = 20 * (c.tier + 1);
      if (
        c.tier >= 3 ||
        !guildRank(p.data.quests) ||
        c.residents.length < (c.tier + 1) * 2 ||
        c.bank < price ||
        countItem(p.data.inv, 'wood') < wood ||
        countItem(p.data.inv, 'stone') < stone
      ) {
        p.toast(
          `Charter needs ${price} treasury coins, ${wood} wood, ${stone} stone, registration and ${(c.tier + 1) * 2} residents.`,
        );
        return;
      }
      c.bank -= price;
      removeItem(p.data.inv, 'wood', wood);
      removeItem(p.data.inv, 'stone', stone);
      p.dirty('inv');
      c.tier++;
    } else if (m.action === 'invite') {
      const home = this.homes(p, b).find((h) => h.x === m.x && h.y === m.y && h.valid);
      if (
        !home ||
        c.residents.some((r) => home.cells.some(([x, y]) => r.x === x && r.y === y)) ||
        c.residents.length >= (c.tier + 1) * 2 ||
        !['gardener', 'artisan', 'warden'].includes(m.role) ||
        c.bank < 50
      ) {
        p.toast('Provide an unused furnished home, a free resident slot and 50 treasury coins.');
        return;
      }
      // Each room is used once across all charters, not once per bed or board.
      for (const o of this.room.objects.all())
        if (o.sub === 'guild_noticeboard' && o !== b) {
          const other = readCharter(o.data?.charter, this.room.wclock.day());
          if (other.residents.some((r) => home.cells.some(([x, y]) => r.x === x && r.y === y))) {
            p.toast('This home already houses a resident.');
            return;
          }
        }
      c.bank -= 50;
      const id = c.serial++;
      c.residents.push({
        id,
        name: RESIDENT_NAMES[id % 8]!,
        role: m.role as ResidentRole,
        x: home.x,
        y: home.y,
        happy: 60,
      });
    } else if (m.action === 'dismiss') {
      c.residents = c.residents.filter((r) => r.id !== m.id);
    } else if (m.action === 'repair') {
      const artisan = c.residents.find(
          (r) => r.role === 'artisan' && r.happy >= 50 && inspectHome(this.room.store, p.accountId, r.x, r.y).valid,
        ),
        weapon = p.data.equip.weapon;
      if (!artisan || !weapon || p.data.coins < 15) {
        p.toast('A content artisan, equipped weapon and 15 coins are required.');
        return;
      }
      // Repair uses the existing durability representation; never invent durability on non-weapons.
      if (typeof weapon.p?.dur !== 'number' || typeof weapon.p.maxDur !== 'number' || weapon.p.dur >= weapon.p.maxDur) {
        p.toast('This item does not need repair.');
        return;
      }
      p.data.coins -= 15;
      weapon.p!.dur = weapon.p!.maxDur;
      p.dirty('coins');
      p.dirty('equip', 'stats');
    } else if (m.action !== 'inspect') return;
    (b.data ??= {}).charter = c;
    this.room.objects.update(b);
    this.panel(p, b, c);
  }
  talk(p: ServerPlayer, id: string): boolean {
    const b = this.staff.get(id);
    if (p.deadT > 0) return !!b;
    if (!b) return false;
    if (Math.hypot(p.sim.x - b.x - 0.5, p.sim.y - b.y - 0.5) <= 4)
      p.client.send(MSG.PANEL, guildPanel(this.room, p, b));
    return true;
  }
  tick(_now: number, dt: number): void {
    this.time += dt;
    if (this.time < 2) return;
    this.time = 0;
    const live = new Set<string>();
    this.staff.clear();
    for (const b of this.room.store.objects.values()) {
      if (live.size >= 48) break;
      if (
        !['guild_board', 'guild_noticeboard'].includes(b.sub) ||
        ![...this.room.players.values()].some((p) => Math.hypot(p.sim.x - b.x, p.sim.y - b.y) < 42)
      )
        continue;
      const spot = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]
        .map(([dx, dy]) => [b.x + dx! + 0.5, b.y + dy! + 0.5])
        .find(([x, y]) => !this.room.store.solidAt(Math.floor(x!), Math.floor(y!)));
      if (spot) {
        const id = `guild-steward:${b.x},${b.y}`;
        live.add(id);
        this.staff.set(id, b);
        let n = this.room.state.npcs.get(id);
        if (!n) {
          n = new NpcState();
          n.id = id;
          n.name = 'Guild Steward';
          n.look = 1;
          n.flags = b.static ? 2 : 0;
          this.room.state.npcs.set(id, n);
        }
        n.x = spot[0]!;
        n.y = spot[1]!;
      }
      if (!b.owner || b.sub !== 'guild_noticeboard') continue;
      const c = readCharter(b.data?.charter, this.room.wclock.day()),
        today = this.room.wclock.day();
      let changed = false;
      if (c.day < today) {
        const paid = c.bank >= c.residents.length * 3;
        c.bank = paid ? c.bank - c.residents.length * 3 : c.bank;
        c.day = today;
        changed = true;
        for (const r of c.residents) {
          const valid = inspectHome(this.room.store, b.owner, r.x, r.y).valid;
          r.happy = Math.max(0, Math.min(100, r.happy + (paid && valid ? 5 : -15)));
          if (paid && valid && r.happy >= 50 && r.role === 'gardener')
            for (const o of this.room.objects.all())
              if (o.owner === b.owner && o.kind === 'crop' && Math.hypot(o.x - r.x, o.y - r.y) <= 8) {
                (o.data ??= {}).watered = today;
                this.room.objects.update(o);
              }
        }
      }
      for (const r of c.residents) {
        const home = inspectHome(this.room.store, b.owner, r.x, r.y);
        if (!home.valid) continue;
        const spot = home.cells.find(([x, y]) => !this.room.store.solidAt(x, y));
        if (!spot) continue;
        const id = `resident:${b.x},${b.y}:${r.id}`;
        live.add(id);
        let n = this.room.state.npcs.get(id);
        if (!n) {
          n = new NpcState();
          n.id = id;
          n.name = `${r.name} · ${r.role}`;
          n.look = r.id % 5;
          this.room.state.npcs.set(id, n);
        }
        n.x = spot[0] + 0.5;
        n.y = spot[1] + 0.5;
      }
      if (changed) {
        (b.data ??= {}).charter = c;
        this.room.objects.update(b);
      }
    }
    for (const id of this.actors) if (!live.has(id)) this.room.state.npcs.delete(id);
    this.actors = live;
  }
  incomingDamage(p: ServerPlayer, dmg: number): number {
    for (const b of this.room.objects.all())
      if (b.sub === 'guild_noticeboard' && b.owner === p.accountId && Math.hypot(p.sim.x - b.x, p.sim.y - b.y) < 20) {
        const c = readCharter(b.data?.charter, this.room.wclock.day());
        if (
          c.residents.some(
            (r) => r.role === 'warden' && r.happy >= 50 && inspectHome(this.room.store, p.accountId, r.x, r.y).valid,
          )
        )
          return dmg * 0.92;
      }
    return dmg;
  }
}
