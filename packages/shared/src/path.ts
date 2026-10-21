/** A* on the tile grid (8-way, no corner cutting). Used by the server to walk NPCs between schedule spots. */
export function findPath(
  sx: number, sy: number, tx: number, ty: number, solid: (x: number, y: number) => boolean, maxNodes = 3000,
): Array<[number, number]> | null {
  if (sx === tx && sy === ty) return [];
  if (solid(tx, ty)) return null;
  const key = (x: number, y: number) => `${x},${y}`;
  const open: Array<{ x: number; y: number; g: number; f: number }> = [{ x: sx, y: sy, g: 0, f: 0 }];
  const best = new Map<string, number>([[key(sx, sy), 0]]);
  const from = new Map<string, string>();
  const h = (x: number, y: number) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  let visited = 0;
  while (open.length && visited++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bi]!.f) bi = i;
    const cur = open.splice(bi, 1)[0]!;
    if (cur.x === tx && cur.y === ty) {
      const out: Array<[number, number]> = [];
      let k = key(tx, ty);
      while (k !== key(sx, sy)) { const [x, y] = k.split(',').map(Number) as [number, number]; out.push([x, y]); k = from.get(k)!; }
      return out.reverse();
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cur.x + dx, ny = cur.y + dy;
        if (solid(nx, ny)) continue;
        if (dx && dy && (solid(cur.x + dx, cur.y) || solid(cur.x, cur.y + dy))) continue; // no corner cutting
        const g = cur.g + (dx && dy ? 1.41 : 1);
        const k = key(nx, ny);
        if (g >= (best.get(k) ?? Infinity)) continue;
        best.set(k, g);
        from.set(k, key(cur.x, cur.y));
        open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}
