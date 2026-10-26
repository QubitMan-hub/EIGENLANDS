import { handleOpen } from '../systems/containers';
import {
  NpcState,
  buildingAt,
  LIVESTOCK,
  FARM_ANIMALS,
  readHerd,
  removeItem,
  moveBody,
  isCaveY,
  isDiveY,
  isUpperY,
  type WorldObj,
} from '@eigenlands/shared';
import type { GameRoom } from '../rooms/GameRoom';
import type { ServerPlayer } from '../rooms/player';
import type { Module, Registrar } from './types';
interface Rider {
  x: number;
  y: number;
  animal: number;
  species: string;
}
export class Ranch implements Module {
  private time = 0;
  private clock = 0;
  private actors = new Set<string>();
  private riders = new Map<string, Rider>();
  constructor(private room: GameRoom) {}
  install(reg: Registrar) {
    reg.on<any>('ranch', 'board', (p, m) => this.act(p, m));
  }
  private act(p: ServerPlayer, m: any) {
    if (!m || p.deadT > 0) return;
    if (m.action === 'dismount') {
      this.dismount(p);
      return;
    }
    if (!Number.isInteger(m.tx) || !Number.isInteger(m.ty)) return;
    const o = this.room.store.objectAt(m.tx, m.ty);
    if (
      !o ||
      !FARM_ANIMALS[o.sub] ||
      o.owner !== p.accountId ||
      Math.hypot(p.sim.x - o.x - 0.5, p.sim.y - o.y - 0.5) > 3.5
    )
      return;
    const day = this.room.wclock.day(),
      data = readHerd(o.data, o.sub, day),
      a = data.herd.find((a) => a.id === m.id);
    if (
      !a ||
      !['horse', 'phasehart'].includes(a.species) ||
      day - a.born < LIVESTOCK[a.species].growth ||
      a.happy < 70
    ) {
      p.toast('A mount must be an adult horse or Glimmerhart with happiness 70.');
      return;
    }
    if (m.action === 'train') {
      if (a.trained) return;
      if (p.data.coins < 100 || !removeItem(p.data.inv, 'hay', 5)) {
        p.toast('Training requires 100 coins and 5 hay.');
        return;
      }
      p.data.coins -= 100;
      a.trained = true;
      o.data = { ...o.data, ...data };
      this.room.objects.update(o);
      p.dirty('coins', 'inv');
      p.toast('Mount trained. Ready to saddle up.', 'good');
      void handleOpen(this.room, p, { tx: o.x, ty: o.y });
    } else if (m.action === 'ride') {
      if (!a.trained || p.sim.boat || p.sim.cart || isCaveY(p.sim.y) || isDiveY(p.sim.y) || isUpperY(p.sim.y)) {
        p.toast('Ride a trained mount on the surface, away from boats and carts.');
        return;
      }
      if (
        [...this.room.enemies.values()].some(
          (e) => !e.def.passive && !e.state.ally && Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 7,
        )
      ) {
        p.toast('Clear nearby hostiles before mounting.');
        return;
      }
      this.riders.set(p.id, { x: o.x, y: o.y, animal: a.id, species: a.species });
      p.sim.mount = a.species === 'horse' ? 1 : 2;
      p.sim.dashT = 0;
      p.toast('Mounted. Space, an attack, a skill or dodge dismounts.', 'good');
    }
  }
  private dismount(p: ServerPlayer) {
    p.sim.mount = 0;
    this.riders.delete(p.id);
  }
  leave(p: ServerPlayer) {
    this.dismount(p);
  }
  incomingDamage(p: ServerPlayer, dmg: number) {
    this.dismount(p);
    return dmg;
  }
  tick(_now: number, dt: number) {
    this.clock += dt;
    for (const p of this.room.players.values()) {
      const rider = this.riders.get(p.id);
      if (!rider) {
        p.sim.mount = 0;
        continue;
      }
      const o = this.room.store.objectAt(rider.x, rider.y),
        a = o && readHerd(o.data, o.sub, this.room.wclock.day()).herd.find((a) => a.id === rider.animal);
      if (
        !p.sim.mount ||
        p.deadT > 0 ||
        !a?.trained ||
        o?.owner !== p.accountId ||
        a.happy < 40 ||
        p.sim.boat ||
        p.sim.cart ||
        isCaveY(p.sim.y) ||
        isDiveY(p.sim.y) ||
        isUpperY(p.sim.y) ||
        !!buildingAt(this.room.seed, Math.floor(p.sim.x), Math.floor(p.sim.y)) ||
        this.room.store.structureAt(Math.floor(p.sim.x), Math.floor(p.sim.y))?.data?.roof
      )
        this.dismount(p);
    }
    this.time += dt;
    if (this.time < 0.2) return;
    const step = this.time;
    this.time = 0;
    const live = new Set<string>();
    let count = 0;
    for (const o of this.room.objects.all()) {
      if (count >= 128) break;
      if (
        !FARM_ANIMALS[o.sub] ||
        o.sub === 'apiary' ||
        !o.owner ||
        ![...this.room.players.values()].some((p) => Math.hypot(p.sim.x - o.x, p.sim.y - o.y) < 35)
      )
        continue;
      const data = readHerd(o.data, o.sub, this.room.wclock.day());
      for (const a of data.herd) {
        if ([...this.riders.values()].some((r) => r.x === o.x && r.y === o.y && r.animal === a.id)) continue;
        const id = `livestock:${o.x},${o.y}:${a.id}`;
        live.add(id);
        count++;
        let n = this.room.state.npcs.get(id);
        if (n && this.room.store.solidAt(Math.floor(n.x), Math.floor(n.y))) {
          this.room.state.npcs.delete(id);
          n = undefined;
        }
        if (!n) {
          const spot = this.yard(o, a.id);
          if (!spot) continue;
          n = new NpcState();
          n.id = id;
          n.x = spot[0] + 0.5;
          n.y = spot[1] + 0.5;
          n.name = LIVESTOCK[a.species].name;
          this.room.state.npcs.set(id, n);
        }
        n.farm = a.species;
        n.young = this.room.wclock.day() - a.born < LIVESTOCK[a.species].growth;
        n.flags = 0;
        // Mostly rest. Short quiet walks share server collision and never cross a cliff or wander beyond the yard.
        const cycle = (this.clock + a.id * 2.7 + o.x * 0.17) % 12;
        if (cycle < 2) {
          const angle = a.id * 2.4 + Math.floor(this.clock / 12) * 1.7,
            dx = Math.cos(angle) * step * 0.6,
            dy = Math.sin(angle) * step * 0.6;
          const solid = Object.assign(
            (x: number, y: number) =>
              Math.hypot(x - o.x, y - o.y) > 4 || !this.room.owns(x, y) || this.room.store.solidAt(x, y),
            { level: this.room.store.levelAt },
          );
          const x = n.x,
            y = n.y;
          moveBody(n, dx, dy, 0.25, solid);
          if (Math.hypot(n.x - x, n.y - y) > 0.01) {
            n.faceX = dx / step;
            n.faceY = dy / step;
            n.flags = 1;
          }
        }
      }
    }
    for (const id of this.actors) if (!live.has(id)) this.room.state.npcs.delete(id);
    this.actors = live;
  }
  private yard(o: WorldObj, id: number): [number, number] | undefined {
    const offsets = [
      [0, 1],
      [1, 1],
      [0, 2],
      [-1, 1],
      [2, 0],
      [-1, 0],
      [1, 2],
      [0, -1],
    ];
    for (let i = 0; i < offsets.length; i++) {
      const [dx, dy] = offsets[(i + id) % offsets.length]!,
        x = o.x + dx!,
        y = o.y + dy!;
      if (!this.room.store.solidAt(x, y) && this.room.store.levelAt(x, y) === this.room.store.levelAt(o.x, o.y))
        return [x, y];
    }
  }
}
