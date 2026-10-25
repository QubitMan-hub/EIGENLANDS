import { sceneryAt, type SceneryKind } from './scenery';
import { Container, Sprite, type Texture } from 'pixi.js';
import {
  C,
  NODES,
  CHUNK_SIZE,
  PALETTE,
  T,
  TILE_DEFS,
  biomeAt,
  chunkKey,
  darkness,
  hash2,
  isCaveY,
  sampleClimate,
  type ChunkStore,
} from '@eigenlands/shared';
import { depth, isoX, isoY, occluded } from './iso';
import { WindField, CALM } from './windfield';
import { FRAMES_PER_VARIANT, type ObjectArt, type ObjSprite } from '../art/objects';

const hexOf = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);
/** cast shadows are deep navy, quantum echoes pink (qubit things) or cyan (flux ground) */
const SHADOW = hexOf(C.night),
  ECHO_Q = hexOf(C.q6),
  ECHO_FLUX = hexOf(C.q7);

/** kinds that get the quantum echo ghost when standing in flux-rich ground */
const ECHO_KINDS = new Set([
  'tree',
  'rock',
  'flowers',
  'forage',
  'ore_copper',
  'ore_iron',
  'ore_silver',
  'ore_gold',
  'crystal',
  'bloom',
  'stump',
]);

/** how far each kind bends in the wind (skew at full gale); trunks and rocks stay put */
const SWAY: Record<string, number> = {
  wild_reeds: 0.15,
  wild_ferns: 0.07,
  tallgrass: 0.2,
  flowers: 0.14,
  forage: 0.1,
  bloom: 0.06,
  tree: 0.045,
  qtree: 0.05,
  crystal: 0,
  rock: 0,
};

/** dx/len/alpha drive cast shadows; `dark` (0 day .. 1 night) and `hour` let views light windows, fireflies... */
export interface Sun {
  dx: number;
  len: number;
  alpha: number;
  dark?: number;
  hour?: number;
}

interface Obj {
  root: Sprite;
  shadow: Sprite;
  /** quantum echo: faint offset ghost double (flux-rich ground, qubit things) */
  echo: Sprite | null;
  kind: string;
  tx: number;
  ty: number;
  phase: number;
  variant: number;
  frames: number;
  base: ObjSprite;
  /** which ObjectArt list the sprite came from (a tree tile may draw from 'qtree') */
  artKey: string;
  /** stands behind raised ground that covers it (revision-3 elevation): not drawn */
  hidden: boolean;
}

/** Sun azimuth/elevation from the in-game hour: long shadows at dawn/dusk, short at noon, faint moon shadows at night. */
export function sunFor(hour: number): Sun {
  hour = ((hour % 24) + 24) % 24;
  const phase = ((hour - 6) / 12) * Math.PI;
  const elevation = Math.sin(phase),
    daylight = Math.max(0, elevation);
  // Fade at the horizon instead of snapping to a fixed night shadow.
  return {
    dx: -Math.cos(phase),
    len: Math.min(2.4, 0.55 / Math.max(0.22, Math.abs(elevation))),
    alpha: daylight > 0 ? 0.34 * Math.min(1, daylight * 2.2) : 0.08 * Math.min(1, -elevation * 2.2),
    dark: darkness(hour),
    hour,
  };
}

/** Sprites for every tile that carries an object (trees, rocks, flowers...), with sun-cast shadows. */
export class ObjectViews {
  private chunks = new Map<string, Map<number, Obj>>();
  private art!: ObjectArt;
  private visibleBounds = '';
  private hitPixels = new WeakMap<Texture, { data: Uint8ClampedArray; width: number }>();

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

  get count(): number {
    let n = 0;
    for (const m of this.chunks.values()) n += m.size;
    return n;
  }

  /** Actual visible sprite bounds include the raised body above its ground diamond. */
  pickMineable(x: number, y: number, tool: string = 'pickaxe'): { tx: number; ty: number } | null {
    let best: Obj | null = null;
    for (const m of this.chunks.values())
      for (const o of m.values()) {
        if (!o.root.visible || NODES[this.store.getTile(o.tx, o.ty)]?.tool !== tool) continue;
        const b = o.root.getBounds();
        if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY || (best && o.root.zIndex <= best.root.zIndex))
          continue;
        const tex = o.root.texture,
          p = o.root.toLocal({ x, y });
        const px = Math.floor(p.x + o.root.anchor.x * tex.orig.width) + tex.frame.x,
          py = Math.floor(p.y + o.root.anchor.y * tex.orig.height) + tex.frame.y;
        let pixels = this.hitPixels.get(tex);
        if (!pixels) {
          const canvas = tex.source.resource as HTMLCanvasElement,
            ctx = canvas.getContext('2d')!;
          pixels = { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width };
          this.hitPixels.set(tex, pixels);
        }
        if (px >= 0 && py >= 0 && px < pixels.width && pixels.data[(py * pixels.width + px) * 4 + 3]! > 0) best = o;
      }
    return best ? { tx: best.tx, ty: best.ty } : null;
  }

  private pickSprite(
    kind0: string,
    tx: number,
    ty: number,
  ): { s: ObjSprite; variant: number; frames: number; key: string } | null {
    // trees in flux-rich ground are quantum superposition trees
    const biome = biomeAt(this.store.seed, tx, ty);
    const qok = biome === 'meadow' || biome === 'forest';
    const kind =
      qok &&
      kind0 === 'tree' &&
      sampleClimate(this.store.seed, tx, ty).flux > 0.5 &&
      hash2(this.store.seed, tx, ty, 97) < 0.6
        ? 'qtree'
        : kind0;
    // each biome dresses the shared tile kinds in its own flora (pines and snow, cacti, willows, glowcaps...)
    const underground = isCaveY(ty) ? this.art.cave[kind] : undefined;
    const own = (this.art.biome[biome] as Record<string, ObjSprite[]> | undefined)?.[kind];
    const list =
      underground ??
      (kind.startsWith('wild_') ? this.art.scenery[kind as SceneryKind] : undefined) ??
      own ??
      (this.art as unknown as Record<string, ObjSprite[]>)[kind];
    if (!list || !list.length) return null;
    if (kind === 'fence') {
      // connect to neighbouring fences: N=1 E=2 S=4 W=8
      const f = (x: number, y: number) => (this.store.getTile(x, y) === T.FENCE ? 1 : 0);
      const mask = f(tx, ty - 1) | (f(tx + 1, ty) << 1) | (f(tx, ty + 1) << 2) | (f(tx - 1, ty) << 3);
      return { s: list[mask]!, variant: mask, frames: 1, key: kind };
    }
    const frames = FRAMES_PER_VARIANT[kind] ?? 1;
    const nvar = Math.max(1, Math.floor(list.length / frames));
    const variant = Math.floor(hash2(this.store.seed, tx, ty, 99) * nvar);
    return {
      s: list[variant * frames]!,
      variant,
      frames,
      key: underground ? `cave:${kind}` : own ? `${biome}:${kind}` : kind,
    };
  }

  private makeObj(tx: number, ty: number, kind: string): Obj | null {
    const p = this.pickSprite(kind, tx, ty);
    if (!p) return null;
    const root = new Sprite(p.s.tex);
    root.anchor.set(p.s.ax / p.s.tex.width, p.s.ay / p.s.tex.height);
    // billboard standing on the tile's ground centre (iso): feet at the anchor point
    const organic = !['torch', 'fence', 'stump'].includes(kind);
    const jx = organic ? (hash2(this.store.seed, tx, ty, 1600) - 0.5) * 0.26 : 0;
    const jy = organic ? (hash2(this.store.seed, tx, ty, 1601) - 0.5) * 0.26 : 0;
    root.x = Math.round(isoX(tx + 0.5 + jx, ty + 0.5 + jy));
    root.y = Math.round(isoY(tx + 0.5 + jx, ty + 0.5 + jy));
    const flat = kind.startsWith('wild_') || kind === 'flowers' || kind === 'forage' || kind === 'stump';
    root.zIndex = depth(tx + 0.5, ty + 0.5) - (flat ? 200 : 0);
    const shadow = new Sprite(p.s.tex);
    shadow.anchor.copyFrom(root.anchor);
    shadow.tint = SHADOW;
    shadow.position.copyFrom(root);
    this.layer.addChild(root);
    this.shadowLayer.addChild(shadow);
    let echo: Sprite | null = null;
    const flux = ECHO_KINDS.has(kind) ? sampleClimate(this.store.seed, tx, ty).flux : -1;
    if (
      kind === 'crystal' ||
      kind === 'bloom' ||
      p.key === 'qtree' ||
      (flux > 0.6 && (kind === 'rock' || kind === 'stump'))
    ) {
      echo = new Sprite(p.s.tex);
      echo.anchor.copyFrom(root.anchor);
      echo.tint = kind === 'crystal' || kind === 'bloom' || p.key === 'qtree' ? ECHO_Q : ECHO_FLUX;
      echo.alpha = 0.22;
      echo.position.set(root.x + 2, root.y - 1);
      echo.zIndex = root.zIndex - 0.5;
      this.layer.addChild(echo);
    }
    return {
      root,
      shadow,
      echo,
      kind,
      tx,
      ty,
      phase: hash2(this.store.seed, tx, ty, 98) * 6.28,
      variant: p.variant,
      frames: p.frames,
      base: p.s,
      artKey: p.key,
      hidden: this.store.generation >= 3 && occluded(this.store.levelAt, tx, ty, this.store.levelAt(tx, ty)),
    };
  }

  buildChunk(cx: number, cy: number): void {
    const k = chunkKey(cx, cy);
    if (this.chunks.has(k)) this.dropChunk(k);
    const chunk = this.store.get(cx, cy);
    const m = new Map<number, Obj>();
    for (let i = 0; i < chunk.tiles.length; i++) {
      const tx = cx * CHUNK_SIZE + (i % CHUNK_SIZE),
        ty = cy * CHUNK_SIZE + Math.floor(i / CHUNK_SIZE);
      const kind = TILE_DEFS[this.store.getTile(tx, ty)]?.obj ?? sceneryAt(this.store, tx, ty);
      if (!kind) continue;
      const o = this.makeObj(cx * CHUNK_SIZE + (i % CHUNK_SIZE), cy * CHUNK_SIZE + Math.floor(i / CHUNK_SIZE), kind);
      if (o) m.set(i, o);
    }
    this.chunks.set(k, m);
    this.visibleBounds = '';
  }

  /** A single tile changed (smashed rock, felled tree...). */
  refreshTile(tx: number, ty: number, noPropagate = false): void {
    this.visibleBounds = '';
    const cx = Math.floor(tx / CHUNK_SIZE),
      cy = Math.floor(ty / CHUNK_SIZE);
    const m = this.chunks.get(chunkKey(cx, cy));
    if (!m) return;
    const idx = (ty - cy * CHUNK_SIZE) * CHUNK_SIZE + (tx - cx * CHUNK_SIZE);
    const old = m.get(idx);
    if (old) {
      old.root.destroy();
      old.shadow.destroy();
      old.echo?.destroy();
      m.delete(idx);
    }
    const kind = TILE_DEFS[this.store.getTile(tx, ty)]?.obj ?? sceneryAt(this.store, tx, ty);
    if (kind) {
      const o = this.makeObj(tx, ty, kind);
      if (o) m.set(idx, o);
    }
    // a changed fence tile changes how its neighbours connect
    if (!noPropagate && (kind === 'fence' || old?.kind === 'fence')) {
      for (const [nx, ny] of [
        [tx, ty - 1],
        [tx + 1, ty],
        [tx, ty + 1],
        [tx - 1, ty],
      ] as const) {
        if (this.store.getTile(nx, ny) === T.FENCE) this.refreshTile(nx, ny, true);
      }
    }
  }

  private dropChunk(k: string): void {
    const m = this.chunks.get(k);
    if (!m) return;
    for (const o of m.values()) {
      o.root.destroy();
      o.shadow.destroy();
      o.echo?.destroy();
    }
    this.chunks.delete(k);
  }

  retain(keep: Set<string>): void {
    for (const k of [...this.chunks.keys()]) if (!keep.has(k)) this.dropChunk(k);
  }

  has(cx: number, cy: number): boolean {
    return this.chunks.has(chunkKey(cx, cy));
  }

  /** Per-frame: wind sway, torch flicker, and sun-driven shadows for objects near the camera. */
  update(
    now: number,
    sun: Sun,
    reduced: boolean,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    wind: WindField = CALM,
  ): void {
    const bounds = `${minX},${minY},${maxX},${maxY}`;
    if (bounds !== this.visibleBounds) {
      this.visibleBounds = bounds;
      for (const m of this.chunks.values())
        for (const o of m.values()) {
          const visible = o.tx >= minX && o.tx <= maxX && o.ty >= minY && o.ty <= maxY && !o.hidden;
          o.root.visible = visible;
          if (o.echo) o.echo.visible = visible;
          if (!visible) o.shadow.visible = false;
        }
    }
    const t = now / 1000;
    const c0x = Math.floor(minX / CHUNK_SIZE),
      c1x = Math.floor(maxX / CHUNK_SIZE);
    const c0y = Math.floor(minY / CHUNK_SIZE),
      c1y = Math.floor(maxY / CHUNK_SIZE);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const m = this.chunks.get(chunkKey(cx, cy));
        if (!m) continue;
        for (const o of m.values()) {
          if (!o.root.visible) continue;
          const amp = SWAY[o.kind] ?? 0;
          const sway = reduced || !amp ? 0 : wind.sway(o.tx, o.ty, o.phase, amp);
          o.root.skew.x = sway;
          if (o.echo) {
            o.echo.texture = o.root.texture;
            o.echo.skew.x = sway;
            o.echo.alpha = reduced ? 0.2 : 0.16 + 0.1 * Math.sin(t * 1.7 + o.phase);
          }
          if (o.frames > 1) {
            const [context, kind] = o.artKey.split(':');
            const list = kind
              ? context === 'cave'
                ? this.art.cave[kind]!
                : (this.art.biome[context as keyof typeof this.art.biome] as Record<string, ObjSprite[]>)[kind]!
              : (this.art as unknown as Record<string, ObjSprite[]>)[o.artKey]!;
            const rate =
              o.artKey === 'qtree'
                ? 0.9
                : o.kind === 'crystal'
                  ? 2.2
                  : o.kind === 'torch'
                    ? 6
                    : o.kind === 'bloom'
                      ? 3
                      : 1.4;
            const f = reduced ? 0 : Math.floor(t * rate + o.phase) % o.frames;
            const frame = list[o.variant * o.frames + f]!;
            if (o.root.texture !== frame.tex) {
              o.root.texture = frame.tex;
              o.root.anchor.set(frame.ax / frame.tex.width, frame.ay / frame.tex.height);
              o.shadow.anchor.copyFrom(o.root.anchor);
              if (o.echo) o.echo.anchor.copyFrom(o.root.anchor);
              o.shadow.texture = frame.tex;
            }
            if (o.kind === 'bloom') o.root.alpha = reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 2 + o.phase);
          }
          const flat =
            o.kind.startsWith('wild_') ||
            o.kind === 'tallgrass' ||
            o.kind === 'flowers' ||
            o.kind === 'bloom' ||
            o.kind === 'forage';
          o.shadow.visible = !flat && sun.alpha > 0.02;
          if (o.shadow.visible) {
            o.shadow.alpha = sun.alpha;
            o.shadow.scale.y = -(0.22 + 0.14 * sun.len);
            o.shadow.skew.x = sun.dx * sun.len * 0.55 + sway;
          }
        }
      }
    }
  }
}
