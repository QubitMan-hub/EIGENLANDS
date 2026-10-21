import { Container, Sprite } from 'pixi.js';
import { CHUNK_SIZE, T, TILE_DEFS, TILE_SIZE, chunkKey, hash2, type ChunkStore } from '@eigenlands/shared';
import { FRAMES_PER_VARIANT, type ObjectArt, type ObjSprite } from '../art/objects';

export interface Sun { dx: number; len: number; alpha: number }

interface Obj {
  root: Sprite;
  shadow: Sprite;
  kind: string;
  phase: number;
  variant: number;
  frames: number;
  base: ObjSprite;
}

/** Sun azimuth/elevation from the in-game hour: long shadows at dawn/dusk, short at noon, faint moon shadows at night. */
export function sunFor(hour: number): Sun {
  if (hour >= 6 && hour <= 18) {
    const a = ((hour - 6) / 12) * Math.PI;
    const elev = Math.max(0.22, Math.sin(a));
    return { dx: -Math.cos(a), len: Math.min(2.4, 0.55 / elev), alpha: 0.34 * Math.min(1, elev * 2.2) };
  }
  return { dx: 0.3, len: 0.9, alpha: 0.1 };
}

/** Sprites for every tile that carries an object (trees, rocks, flowers...), with sun-cast shadows. */
export class ObjectViews {
  private chunks = new Map<string, Map<number, Obj>>();
  private art!: ObjectArt;

  constructor(
    private store: ChunkStore,
    private shadowLayer: Container,
    private layer: Container,
  ) {}

  setArt(art: ObjectArt): void {
    this.art = art;
    // rebuild existing chunks with the new (season) art
    const keys = [...this.chunks.keys()];
    for (const k of keys) {
      const [cx, cy] = k.split(',').map(Number) as [number, number];
      this.dropChunk(k);
      this.buildChunk(cx, cy);
    }
  }

  get count(): number { let n = 0; for (const m of this.chunks.values()) n += m.size; return n; }

  private pickSprite(kind: string, tx: number, ty: number): { s: ObjSprite; variant: number; frames: number } | null {
    const list = (this.art as unknown as Record<string, ObjSprite[]>)[kind];
    if (!list || !list.length) return null;
    if (kind === 'fence') {
      // connect to neighbouring fences: N=1 E=2 S=4 W=8
      const f = (x: number, y: number) => (this.store.getTile(x, y) === T.FENCE ? 1 : 0);
      const mask = f(tx, ty - 1) | (f(tx + 1, ty) << 1) | (f(tx, ty + 1) << 2) | (f(tx - 1, ty) << 3);
      return { s: list[mask]!, variant: mask, frames: 1 };
    }
    const frames = FRAMES_PER_VARIANT[kind] ?? 1;
    const nvar = Math.max(1, Math.floor(list.length / frames));
    const variant = Math.floor(hash2(this.store.seed, tx, ty, 99) * nvar);
    return { s: list[variant * frames]!, variant, frames };
  }

  private makeObj(tx: number, ty: number, kind: string): Obj | null {
    const p = this.pickSprite(kind, tx, ty);
    if (!p) return null;
    const root = new Sprite(p.s.tex);
    root.anchor.set(p.s.ax / p.s.tex.width, p.s.ay / p.s.tex.height);
    root.x = Math.round((tx + 0.5) * TILE_SIZE);
    root.y = (ty + 1) * TILE_SIZE - 2;
    root.zIndex = root.y;
    const shadow = new Sprite(p.s.tex);
    shadow.anchor.copyFrom(root.anchor);
    shadow.tint = 0x2a1060;
    shadow.position.copyFrom(root);
    this.layer.addChild(root);
    this.shadowLayer.addChild(shadow);
    return { root, shadow, kind, phase: hash2(this.store.seed, tx, ty, 98) * 6.28, variant: p.variant, frames: p.frames, base: p.s };
  }

  buildChunk(cx: number, cy: number): void {
    const k = chunkKey(cx, cy);
    if (this.chunks.has(k)) this.dropChunk(k);
    const chunk = this.store.get(cx, cy);
    const m = new Map<number, Obj>();
    for (let i = 0; i < chunk.tiles.length; i++) {
      const kind = TILE_DEFS[chunk.tiles[i]!]?.obj;
      if (!kind) continue;
      const o = this.makeObj(cx * CHUNK_SIZE + (i % CHUNK_SIZE), cy * CHUNK_SIZE + Math.floor(i / CHUNK_SIZE), kind);
      if (o) m.set(i, o);
    }
    this.chunks.set(k, m);
  }

  /** A single tile changed (smashed rock, felled tree...). */
  refreshTile(tx: number, ty: number, noPropagate = false): void {
    const cx = Math.floor(tx / CHUNK_SIZE), cy = Math.floor(ty / CHUNK_SIZE);
    const m = this.chunks.get(chunkKey(cx, cy));
    if (!m) return;
    const idx = (ty - cy * CHUNK_SIZE) * CHUNK_SIZE + (tx - cx * CHUNK_SIZE);
    const old = m.get(idx);
    if (old) { old.root.destroy(); old.shadow.destroy(); m.delete(idx); }
    const kind = TILE_DEFS[this.store.getTile(tx, ty)]?.obj;
    if (kind) { const o = this.makeObj(tx, ty, kind); if (o) m.set(idx, o); }
    // a changed fence tile changes how its neighbours connect
    if (!noPropagate && (kind === 'fence' || old?.kind === 'fence')) {
      for (const [nx, ny] of [[tx, ty - 1], [tx + 1, ty], [tx, ty + 1], [tx - 1, ty]] as const) {
        if (this.store.getTile(nx, ny) === T.FENCE) this.refreshTile(nx, ny, true);
      }
    }
  }

  private dropChunk(k: string): void {
    const m = this.chunks.get(k);
    if (!m) return;
    for (const o of m.values()) { o.root.destroy(); o.shadow.destroy(); }
    this.chunks.delete(k);
  }

  retain(keep: Set<string>): void {
    for (const k of [...this.chunks.keys()]) if (!keep.has(k)) this.dropChunk(k);
  }

  has(cx: number, cy: number): boolean { return this.chunks.has(chunkKey(cx, cy)); }

  /** Per-frame: wind sway, torch flicker, and sun-driven shadows for objects near the camera. */
  update(now: number, sun: Sun, reduced: boolean, minX: number, minY: number, maxX: number, maxY: number): void {
    const t = now / 1000;
    const c0x = Math.floor(minX / CHUNK_SIZE), c1x = Math.floor(maxX / CHUNK_SIZE);
    const c0y = Math.floor(minY / CHUNK_SIZE), c1y = Math.floor(maxY / CHUNK_SIZE);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const m = this.chunks.get(chunkKey(cx, cy));
        if (!m) continue;
        for (const o of m.values()) {
          const sway = reduced ? 0 : Math.sin(t * 1.6 + o.phase + o.root.x * 0.01) * (o.kind === 'tallgrass' || o.kind === 'flowers' ? 0.09 : o.kind === 'tree' ? 0.012 : 0);
          o.root.skew.x = sway;
          if (o.frames > 1) {
            const list = (this.art as unknown as Record<string, ObjSprite[]>)[o.kind]!;
            const rate = o.kind === 'crystal' ? 2.2 : o.kind === 'torch' ? 6 : o.kind === 'bloom' ? 3 : 1.4;
            const f = reduced ? 0 : Math.floor(t * rate + o.phase) % o.frames;
            o.root.texture = list[o.variant * o.frames + f]!.tex;
            o.shadow.texture = o.root.texture;
            if (o.kind === 'bloom') o.root.alpha = reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 2 + o.phase);
          }
          const flat = o.kind === 'tallgrass' || o.kind === 'flowers' || o.kind === 'bloom' || o.kind === 'forage';
          o.shadow.visible = !flat && sun.alpha > 0.02;
          if (o.shadow.visible) {
            o.shadow.alpha = sun.alpha;
            o.shadow.scale.y = -(0.28 + 0.2 * sun.len);
            o.shadow.skew.x = sun.dx * sun.len * 0.55 + sway;
          }
        }
      }
    }
  }
}
