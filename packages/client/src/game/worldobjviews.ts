import { Sprite, type Container } from 'pixi.js';
import { CHUNK_SIZE, TILE_SIZE, chunkKey, hash2, objLight, type ChunkStore, type WorldObj } from '@eigenlands/shared';
import type { SeasonIdx } from '../art/objects';
import { worldObjDef, type ObjSpriteDef } from '../art/worldobjs';
import type { Sun } from './objectviews';

export interface TileLight { x: number; y: number; radius: number; color: number; intensity: number }

interface View {
  obj: WorldObj;
  def: ObjSpriteDef;
  root: Sprite;
  shadow: Sprite;
  phase: number;
  ck: string;
  /** signature of what is drawn (so upsert only rebuilds when it changed) */
  sig: string;
}

const sigOf = (o: WorldObj): string => {
  const d = o.data as Record<string, unknown> | undefined;
  if (o.kind === 'crop') return `${o.sub}|${d?.growth}|${d?.dead ? 1 : 0}|${d?.alt ?? ''}`;
  if (o.kind === 'sprinkler') return `${o.sub}|${d?.watering ? 1 : 0}`;
  return `${o.kind}|${o.sub}`;
};

/**
 * Sprites for world objects: crops by growth stage, stations, chests, shelters, furniture, signs and the
 * furnishing of Hadamere. Sprites are y-sorted into the entity layer; each casts a sun-driven shadow.
 */
export class WorldObjViews {
  private views = new Map<string, View>();
  private byChunk = new Map<string, Set<string>>();
  private season: SeasonIdx = 1;

  constructor(private store: ChunkStore, private shadowLayer: Container, private layer: Container) {}

  get count(): number { return this.views.size; }
  setSeason(season: SeasonIdx): void { this.season = season; }

  private make(o: WorldObj): View {
    const def = worldObjDef(o);
    const f = def.frames[0]!;
    const root = new Sprite(f.tex);
    root.anchor.set(f.ax / f.tex.width, f.ay / f.tex.height);
    root.x = Math.round((o.x + 0.5) * TILE_SIZE);
    root.y = (o.y + 1) * TILE_SIZE - 2;
    // rugs and crops sit on the ground: draw them behind anything standing on the tile
    root.zIndex = o.kind === 'furniture' && o.sub === 'rug' ? root.y - 1000 : o.kind === 'crop' ? root.y - 2 : root.y;
    const shadow = new Sprite(f.tex);
    shadow.anchor.copyFrom(root.anchor);
    shadow.tint = 0x2a1060;
    shadow.position.copyFrom(root);
    this.layer.addChild(root);
    this.shadowLayer.addChild(shadow);
    const ck = chunkKey(Math.floor(o.x / CHUNK_SIZE), Math.floor(o.y / CHUNK_SIZE));
    return { obj: o, def, root, shadow, phase: hash2(this.store.seed, o.x, o.y, 77) * 6.28, ck, sig: sigOf(o) };
  }

  upsert(o: WorldObj): void {
    const key = `${o.x},${o.y}`;
    const old = this.views.get(key);
    if (old && old.sig === sigOf(o)) { old.obj = o; return; }
    if (old) this.drop(key, old);
    const v = this.make(o);
    this.views.set(key, v);
    let set = this.byChunk.get(v.ck);
    if (!set) { set = new Set(); this.byChunk.set(v.ck, set); }
    set.add(key);
  }

  private drop(key: string, v: View): void {
    v.root.destroy(); v.shadow.destroy();
    this.views.delete(key);
    this.byChunk.get(v.ck)?.delete(key);
  }

  remove(x: number, y: number): void {
    const key = `${x},${y}`;
    const v = this.views.get(key);
    if (v) this.drop(key, v);
  }

  buildChunk(cx: number, cy: number): void {
    const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE;
    const ck = chunkKey(cx, cy);
    // remove sprites whose object disappeared while the chunk was away
    for (const key of [...(this.byChunk.get(ck) ?? [])]) {
      const v = this.views.get(key);
      if (v && !this.store.objects.has(key)) this.drop(key, v);
    }
    for (const o of this.store.objects.values()) {
      if (o.x >= x0 && o.x < x0 + CHUNK_SIZE && o.y >= y0 && o.y < y0 + CHUNK_SIZE) this.upsert(o);
    }
  }

  retain(keep: Set<string>): void {
    for (const [ck, set] of [...this.byChunk]) {
      if (keep.has(ck)) continue;
      for (const key of [...set]) { const v = this.views.get(key); if (v) this.drop(key, v); }
      this.byChunk.delete(ck);
    }
  }

  private forVisible(minX: number, minY: number, maxX: number, maxY: number, fn: (v: View) => void): void {
    const c0x = Math.floor(minX / CHUNK_SIZE), c1x = Math.floor(maxX / CHUNK_SIZE);
    const c0y = Math.floor(minY / CHUNK_SIZE), c1y = Math.floor(maxY / CHUNK_SIZE);
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      const set = this.byChunk.get(chunkKey(cx, cy));
      if (!set) continue;
      for (const key of set) {
        const v = this.views.get(key);
        if (v && v.obj.x >= minX && v.obj.x <= maxX && v.obj.y >= minY && v.obj.y <= maxY) fn(v);
      }
    }
  }

  update(now: number, sun: Sun, reduced: boolean, minX: number, minY: number, maxX: number, maxY: number): void {
    const t = now / 1000;
    this.forVisible(minX, minY, maxX, maxY, (v) => {
      const d = v.def;
      if (d.frames.length > 1) {
        const f = reduced ? 0 : Math.floor(t * d.fps + v.phase) % d.frames.length;
        const tex = d.frames[f]!.tex;
        if (v.root.texture !== tex) { v.root.texture = tex; v.shadow.texture = tex; }
      }
      const sway = reduced || !d.sway ? 0 : Math.sin(t * 1.5 + v.phase + v.root.x * 0.02) * d.sway;
      v.root.skew.x = sway;
      const show = !d.noShadow && sun.alpha > 0.02;
      v.shadow.visible = show;
      if (show) {
        v.shadow.alpha = sun.alpha * 0.9;
        v.shadow.scale.y = -(0.26 + 0.18 * sun.len);
        v.shadow.skew.x = sun.dx * sun.len * 0.55 + sway;
      }
    });
  }

  /** Light sources among the visible objects (tile-space centres). Superposed crops glow faintly. */
  lights(minX: number, minY: number, maxX: number, maxY: number): TileLight[] {
    const out: TileLight[] = [];
    this.forVisible(minX, minY, maxX, maxY, (v) => {
      const o = v.obj;
      const sub = o.kind === 'crop' && (o.data as { alt?: string } | undefined)?.alt ? `*${o.sub}` : o.sub;
      const l = objLight(o.kind, sub);
      if (!l) return;
      const flick = 0.9 + 0.1 * Math.sin(performance.now() / 160 + v.phase);
      out.push({ x: o.x + 0.5, y: o.y + 0.5, radius: l.radius * (0.95 + 0.05 * flick), color: l.color, intensity: 0.9 * flick });
    });
    return out;
  }
}
