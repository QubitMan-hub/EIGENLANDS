import { Sprite, type Container } from 'pixi.js';
import { buildKey, buildSolid, type BuildCell, type BuildPiece, type ChunkStore } from '@eigenlands/shared';
import { BUILD_AX, BUILD_AY, constructionTexture } from '../art/construction';
import { depth, isoX, isoY } from './iso';
import type { Sun } from './objectviews';

type Part = { sprite: Sprite; shadow?: Sprite; layer: string };
type View = { cell: BuildCell; parts: Part[]; sig: string };
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
/** Connected room cutaway is separate from the authored town rectangles. No entity/collision duplication. */
export function constructionRoom(store: ChunkStore, px: number, py: number): Set<string> {
  const out = new Set<string>(),
    start = store.structureAt(px, py);
  if (!start?.data.roof || buildSolid(start.data)) return out;
  const q: Array<[number, number]> = [[px, py]],
    seen = new Set<string>();
  for (let i = 0; i < q.length && seen.size < 4096; i++) {
    const [x, y] = q[i]!,
      k = buildKey(x, y);
    if (seen.has(k)) continue;
    seen.add(k);
    const c = store.structureAt(x, y);
    if (!c?.data.floor || c.owner !== start.owner) continue;
    out.add(k);
    if (buildSolid(c.data)) continue;
    for (const [dx, dy] of DIRS) q.push([x + dx, y + dy]);
  }
  return out;
}
/** Shared gable profile across adjacent panels. Rotating chooses the ridge axis. */
function roofProfile(store: ChunkStore, c: BuildCell): [number, number, number] {
  const d = c.data,
    dx = (d.roofTurn ?? 0) % 2 === 0 ? 1 : 0,
    dy = 1 - dx;
  const matches = (n: number) => {
    const b = store.structureAt(c.x + dx * n, c.y + dy * n);
    return b?.owner === c.owner && b.data.roof === d.roof && (b.data.roofTurn ?? 0) % 2 === (d.roofTurn ?? 0) % 2;
  };
  let left = 0,
    right = 0;
  while (left < 64 && matches(-left - 1)) left++;
  while (right < 64 && matches(right + 1)) right++;
  const n = left + right + 1,
    h = (t: number) => Math.round(Math.min(24, Math.min(left + t, n - left - t) * 5));
  return [h(0), h(0.5), h(1)];
}
export class ConstructionViews {
  private views = new Map<string, View>();
  private room = new Set<string>();
  private roomKey = '';
  constructor(
    private store: ChunkStore,
    private floors: Container,
    private shadows: Container,
    private entities: Container,
    private roofs: Container,
  ) {}
  get count(): number {
    return this.views.size;
  }
  private drop(k: string, v: View): void {
    for (const p of v.parts) {
      p.sprite.destroy();
      p.shadow?.destroy();
    }
    this.views.delete(k);
  }
  update(px: number, py: number, sun: Sun, x0: number, y0: number, x1: number, y1: number): void {
    if (!this.store.structures.size) {
      for (const [k, v] of this.views) this.drop(k, v);
      this.room.clear();
      this.roomKey = '';
      return;
    }
    const key = `${px},${py}:${this.store.structureRevision}`;
    if (key !== this.roomKey) {
      this.room = constructionRoom(this.store, px, py);
      this.roomKey = key;
    }
    for (const [k, v] of this.views)
      if (!this.store.structures.has(k) || v.cell.x < x0 || v.cell.x > x1 || v.cell.y < y0 || v.cell.y > y1)
        this.drop(k, v);
    // Only the visible tile rectangle is visited: distant houses add no frame cost.
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const c = this.store.structureAt(x, y);
        if (!c) continue;
        const k = buildKey(x, y),
          d = c.data,
          inside = this.room.has(k),
          cut = inside && x + y >= px + py - 1,
          profile = d.roof ? roofProfile(this.store, c) : undefined;
        const sig = `${JSON.stringify(d)}:${cut}:${profile}`;
        let v = this.views.get(k);
        if (!v || v.sig !== sig) {
          if (v) this.drop(k, v);
          v = { cell: c, parts: [], sig };
          this.views.set(k, v);
          const add = (id: BuildPiece, layer: string, turn = 0) => {
            const tex = constructionTexture(
                id,
                turn,
                layer === 'wall' && cut,
                layer === 'stairs' ? d.stairs === 'down' : !!d.open,
                profile,
              ),
              sprite = new Sprite(tex);
            sprite.anchor.set(BUILD_AX / tex.width, BUILD_AY / tex.height);
            sprite.position.set(Math.round(isoX(x + 0.5, y + 0.5)), Math.round(isoY(x + 0.5, y + 0.5)));
            sprite.zIndex = depth(x + 0.5, y + 0.5);
            (layer === 'roof' ? this.roofs : layer === 'floor' ? this.floors : this.entities).addChild(sprite);
            let shadow: Sprite | undefined;
            if (layer === 'wall' || layer === 'stairs') {
              shadow = new Sprite(
                constructionTexture(id, turn, false, layer === 'stairs' ? d.stairs === 'down' : !!d.open),
              );
              shadow.anchor.copyFrom(sprite.anchor);
              shadow.position.copyFrom(sprite.position);
              shadow.tint = 0x101724;
              this.shadows.addChild(shadow);
            }
            v!.parts.push({ sprite, shadow, layer });
          };
          if (d.floor) add(d.floor, 'floor');
          if (d.wall) add(d.wall, 'wall', d.wallTurn);
          if (d.stairs) add('timber_stairs', 'stairs', d.stairsTurn);
          if (d.roof) add(d.roof, 'roof', d.roofTurn);
        }
        for (const p of v.parts) {
          p.sprite.visible = p.layer !== 'roof' || !inside;
          if (p.shadow) {
            p.shadow.alpha = sun.alpha * 0.85;
            p.shadow.scale.y = -(0.22 + 0.14 * sun.len);
            p.shadow.skew.x = sun.dx * sun.len * 0.55;
          }
        }
      }
  }
}
