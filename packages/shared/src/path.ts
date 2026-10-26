import { CLIFF } from './constants';
/** A* on the tile grid (8-way, no corner cutting). Used by the server to walk NPCs between schedule spots. */
export function findPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  solid: ((x: number, y: number) => boolean) & { level?: (x: number, y: number) => number },
  maxNodes = 3000,
): Array<[number, number]> | null {
  const level = solid.level;
  /** can a walker step from (ax, ay) to the adjacent tile (bx, by)? Cliffs of CLIFF levels or more cannot be crossed. */
  const step = (ax: number, ay: number, bx: number, by: number) =>
    !level || Math.abs(level(bx, by) - level(ax, ay)) < CLIFF;
  if (sx === tx && sy === ty) return [];
  if (solid(tx, ty)) return null;
  // numeric keys and a binary heap: the old string keys and linear open-list scan cost O(n^2) on long town routes
  const key = (x: number, y: number) => (x + 2097152) * 4194304 + (y + 2097152);
  const heap: Array<{ x: number; y: number; g: number; f: number }> = [];
  const push = (n: { x: number; y: number; g: number; f: number }) => {
    heap.push(n);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (heap[p]!.f <= heap[i]!.f) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0]!,
      last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = i * 2 + 1,
          r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]!.f < heap[m]!.f) m = l;
        if (r < heap.length && heap[r]!.f < heap[m]!.f) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  push({ x: sx, y: sy, g: 0, f: 0 });
  const best = new Map<number, number>([[key(sx, sy), 0]]);
  const from = new Map<number, [number, number]>();
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - tx),
      dy = Math.abs(y - ty);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  };
  let visited = 0;
  while (heap.length && visited < maxNodes) {
    const cur = pop();
    if (cur.g > (best.get(key(cur.x, cur.y)) ?? Infinity)) continue; // a stale, superseded entry
    visited++;
    if (cur.x === tx && cur.y === ty) {
      const out: Array<[number, number]> = [];
      let p: [number, number] = [tx, ty];
      while (p[0] !== sx || p[1] !== sy) {
        out.push(p);
        p = from.get(key(p[0], p[1]))!;
      }
      return out.reverse();
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cur.x + dx,
          ny = cur.y + dy;
        if (solid(nx, ny) || !step(cur.x, cur.y, nx, ny)) continue;
        if (
          dx &&
          dy &&
          (solid(cur.x + dx, cur.y) ||
            solid(cur.x, cur.y + dy) ||
            !step(cur.x, cur.y, cur.x + dx, cur.y) ||
            !step(cur.x, cur.y, cur.x, cur.y + dy))
        )
          continue; // no corner cutting, not even across a cliff corner
        const g = cur.g + (dx && dy ? 1.41 : 1);
        const k = key(nx, ny);
        if (g >= (best.get(k) ?? Infinity)) continue;
        best.set(k, g);
        from.set(k, [cur.x, cur.y]);
        push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}
