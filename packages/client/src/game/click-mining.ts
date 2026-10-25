import { findPath, type ChunkStore, type Stack } from '@eigenlands/shared';
import { describeUse } from './targeting';
const GATHER_KINDS = new Set(['tool', 'forage', 'harvest', 'till', 'water', 'refill']);
type Selection = { slot: number; item: Stack | null };
type Target = {
  tx: number;
  ty: number;
  tile: number;
  slot: number;
  id: string | null;
  object: string;
  path: Array<[number, number]>;
  started: number;
  progress: number;
  best: number;
  lastUse: number;
};
/** One cancellable gathering intent (the historical class name is retained for existing hosts). Movement still passes through ordinary prediction/collision;
 * every swing uses the existing authoritative USE handler. No automatic target chaining. */
export class ClickMining {
  private target: Target | null = null;
  constructor(
    private store: () => ChunkStore,
    private selection: () => Selection,
    private use: (slot: number, tx: number, ty: number) => void,
    private notice: (text: string) => void,
  ) {}
  cancel(): void {
    this.target = null;
  }
  start(x: number, y: number, tx: number, ty: number, now: number): boolean {
    this.cancel();
    const store = this.store(),
      { slot, item } = this.selection(),
      tile = store.getTile(tx, ty),
      obj = store.objectAt(tx, ty),
      info = describeUse(item, tile, obj, 1);
    if (!info || !GATHER_KINDS.has(info.kind) || store.structureAt(tx, ty)) return false;
    if (!info.ok) {
      this.notice(info.label);
      return true;
    }
    if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > 18) {
      this.notice('Move closer to that resource first.');
      return true;
    }
    let path: Array<[number, number]> | null = null;
    if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) <= 1.65) path = [];
    else {
      const goals: Array<[number, number]> = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if ((dx || dy) && !store.solidAt(tx + dx, ty + dy)) goals.push([tx + dx, ty + dy]);
      goals.sort((a, b) => Math.hypot(a[0] + 0.5 - x, a[1] + 0.5 - y) - Math.hypot(b[0] + 0.5 - x, b[1] + 0.5 - y));
      for (const [gx, gy] of goals) {
        path = findPath(Math.floor(x), Math.floor(y), gx, gy, store.solidAt, 512);
        if (path) break;
      }
    }
    if (!path) {
      this.notice('No clear path to that resource.');
      return true;
    }
    this.target = {
      tx,
      ty,
      tile,
      slot,
      id: item?.id ?? null,
      object: JSON.stringify(obj ?? null),
      path,
      started: now,
      progress: now,
      best: Infinity,
      lastUse: -Infinity,
    };
    return true;
  }
  step(now: number, x: number, y: number): { dx: number; dy: number; aimX: number; aimY: number } | null {
    const t = this.target;
    if (!t) return null;
    const store = this.store(),
      { slot, item } = this.selection();
    const obj = store.objectAt(t.tx, t.ty),
      info = describeUse(item, store.getTile(t.tx, t.ty), obj, 1);
    if (
      slot !== t.slot ||
      (item?.id ?? null) !== t.id ||
      !info?.ok ||
      !GATHER_KINDS.has(info.kind) ||
      store.getTile(t.tx, t.ty) !== t.tile ||
      store.structureAt(t.tx, t.ty) ||
      JSON.stringify(obj ?? null) !== t.object ||
      now - t.started > 30000
    ) {
      this.cancel();
      return null;
    }
    const aimX = t.tx + 0.5 - x,
      aimY = t.ty + 0.5 - y;
    if (Math.hypot(aimX, aimY) <= 1.65) {
      if (now - t.lastUse >= 360) {
        t.lastUse = now;
        this.use(t.slot, t.tx, t.ty);
      }
      return { dx: 0, dy: 0, aimX, aimY };
    }
    while (t.path.length && Math.hypot(t.path[0]![0] + 0.5 - x, t.path[0]![1] + 0.5 - y) < 0.12) {
      t.path.shift();
      t.best = Infinity;
      t.progress = now;
    }
    const next = t.path[0];
    if (!next || store.solidAt(next[0], next[1])) {
      this.cancel();
      this.notice('Path blocked. Click the resource again.');
      return null;
    }
    const dx = next[0] + 0.5 - x,
      dy = next[1] + 0.5 - y,
      d = Math.hypot(dx, dy);
    if (d < t.best - 0.02) {
      t.best = d;
      t.progress = now;
    }
    if (now - t.progress > 1500) {
      this.cancel();
      this.notice('Path blocked. Click the resource again.');
      return null;
    }
    const speed = Math.min(1, d / 0.25);
    return { dx: (dx / d) * speed, dy: (dy / d) * speed, aimX, aimY };
  }
}
