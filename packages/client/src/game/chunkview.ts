import { Container, RenderTexture, Sprite, type Renderer } from 'pixi.js';
import { CHUNK_SIZE, TILE_DEFS, TILE_SIZE, chunkKey, type ChunkStore } from '@eigenlands/shared';
import type { TileAtlas } from '../art/tiles';

interface View {
  cx: number;
  cy: number;
  sprite: Sprite;
  a: RenderTexture;
  b: RenderTexture | null;
}

/** Each 32x32 chunk is baked into one texture (two for chunks with animated tiles) and drawn as a single sprite. */
export class ChunkViews {
  private views = new Map<string, View>();
  private frame = 0;

  constructor(
    private renderer: Renderer,
    private atlas: TileAtlas,
    private store: ChunkStore,
    readonly layer: Container,
  ) {}

  get count(): number { return this.views.size; }
  has(cx: number, cy: number): boolean { return this.views.has(chunkKey(cx, cy)); }

  private bake(cx: number, cy: number, frame: number): RenderTexture {
    const chunk = this.store.get(cx, cy);
    const c = new Container();
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.tiles[y * CHUNK_SIZE + x]!;
        const s = new Sprite(this.atlas.tex(id, this.atlas.variantOf(cx * CHUNK_SIZE + x, cy * CHUNK_SIZE + y), TILE_DEFS[id]?.animated ? frame : 0));
        s.x = x * TILE_SIZE;
        s.y = y * TILE_SIZE;
        c.addChild(s);
      }
    }
    const rt = RenderTexture.create({ width: CHUNK_SIZE * TILE_SIZE, height: CHUNK_SIZE * TILE_SIZE, scaleMode: 'nearest' });
    this.renderer.render({ container: c, target: rt, clear: true });
    c.destroy({ children: true });
    return rt;
  }

  private hasAnimated(cx: number, cy: number): boolean {
    const t = this.store.get(cx, cy).tiles;
    for (let i = 0; i < t.length; i++) if (TILE_DEFS[t[i]!]?.animated) return true;
    return false;
  }

  /** (Re)build a chunk's textures, e.g. after the server sends its edits. */
  build(cx: number, cy: number): void {
    const k = chunkKey(cx, cy);
    const old = this.views.get(k);
    const animated = this.hasAnimated(cx, cy);
    const a = this.bake(cx, cy, 0);
    const b = animated ? this.bake(cx, cy, 1) : null;
    if (old) {
      old.sprite.texture = this.frame && b ? b : a;
      old.a.destroy(true); old.b?.destroy(true);
      old.a = a; old.b = b;
      return;
    }
    const sprite = new Sprite(a);
    sprite.x = cx * CHUNK_SIZE * TILE_SIZE;
    sprite.y = cy * CHUNK_SIZE * TILE_SIZE;
    this.layer.addChild(sprite);
    this.views.set(k, { cx, cy, sprite, a, b });
  }

  /** Free chunks not in `keep`. */
  retain(keep: Set<string>): void {
    for (const [k, v] of this.views) {
      if (keep.has(k)) continue;
      v.sprite.destroy();
      v.a.destroy(true); v.b?.destroy(true);
      this.views.delete(k);
    }
  }

  setFrame(f: number): void {
    if (f === this.frame) return;
    this.frame = f;
    for (const v of this.views.values()) if (v.b) v.sprite.texture = f ? v.b : v.a;
  }
}
