import { Container, Sprite, Texture } from 'pixi.js';
import { T, type Biome, type ChunkStore, type Weather } from '@eigenlands/shared';
import { C, makeCanvas, put } from '../art/shade';
import { isoX, isoY } from './iso';

/**
 * Marks on the ground (visual only): footprints left in snow, sand and rain-soaked earth that fade behind whoever
 * walks there, and puddles that gather on paths and bare earth while it rains and slowly dry out afterwards. Built
 * from a handful of tiny textures in fixed-size pools, so a long walk costs nothing extra.
 */
const MAX_PRINTS = 220;
const MAX_PUDDLES = 40;
/** tiles between steps */
const STRIDE = 0.55;

type Soft = 'snow' | 'sand' | 'mud' | null;
interface Print {
  s: Sprite;
  age: number;
  life: number;
}
interface Puddle {
  s: Sprite;
  x: number;
  y: number;
  size: number;
}
interface Walker {
  x: number;
  y: number;
  left: boolean;
  acc: number;
}

let texCache: Record<string, Texture> | null = null;
function textures(): Record<string, Texture> {
  if (texCache) return texCache;
  const mk = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
    const { canvas, ctx } = makeCanvas(w, h);
    draw(ctx);
    const t = Texture.from(canvas);
    t.source.scaleMode = 'nearest';
    return t;
  };
  const print = (c: number, edge: number) =>
    mk(4, 3, (x) => {
      put(x, 1, 0, edge, 2, 1);
      put(x, 0, 1, c, 4, 1);
      put(x, 1, 2, edge, 2, 1);
    });
  const puddle = (w: number) =>
    mk(w, Math.ceil(w / 2), (x) => {
      const h = Math.ceil(w / 2);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const dx = (i + 0.5 - w / 2) / (w / 2),
            dy = (j + 0.5 - h / 2) / (h / 2);
          const r = dx * dx + dy * dy;
          if (r > 1) continue;
          put(x, i, j, r > 0.6 ? C.w2 : j < h / 2 && i > w / 3 && i < (w * 2) / 3 ? C.w5 : C.w3);
        }
    });
  texCache = {
    snow: print(C.mist, C.steel),
    sand: print(C.e3, C.e2),
    mud: print(C.e1, C.e0),
    puddleS: puddle(8),
    puddleM: puddle(12),
    puddleL: puddle(16),
  };
  return texCache;
}

export interface GroundFrame {
  /** seconds */
  dt: number;
  weather: Weather;
  season: number;
  biome: Biome;
  reduced: boolean;
  /** everyone walking near the player (the player first), in tiles */
  walkers: Array<{ id: string; x: number; y: number }>;
  me: { x: number; y: number };
}

export class GroundMarks {
  readonly layer = new Container();
  private prints: Print[] = [];
  private puddles: Puddle[] = [];
  private walkers = new Map<string, Walker>();
  /** 0 dry .. 1 soaked: rises in rain, falls slowly after */
  private wetness = 0;
  private spawnT = 0;

  constructor(
    private store: () => ChunkStore,
    private tex: () => Record<string, Texture> = textures,
  ) {}

  /** what the ground under (x, y) takes a print in, if anything */
  private soft(x: number, y: number, f: GroundFrame): Soft {
    const t = this.store().getTile(Math.floor(x), Math.floor(y));
    const snowy = f.weather === 'snow' || (f.season === 3 && (f.biome === 'taiga' || f.biome === 'meadow'));
    if (t === T.SAND) return snowy ? 'snow' : 'sand';
    if (t === T.GRASS || t === T.GRASS_TALL || t === T.FLOWERS || t === T.TILLED || t === T.TILLED_WET)
      return snowy && f.biome === 'taiga' ? 'snow' : this.wetness > 0.35 || t === T.TILLED_WET ? 'mud' : null;
    if (t === T.PATH) return snowy && f.biome === 'taiga' ? 'snow' : this.wetness > 0.6 ? 'mud' : null;
    return null;
  }

  frame(f: GroundFrame): void {
    const raining = f.weather === 'rain' || f.weather === 'storm';
    this.wetness = Math.max(0, Math.min(1, this.wetness + f.dt * (raining ? 0.02 : -0.004)));
    this.stepPrints(f);
    this.stepPuddles(f, raining);
  }

  private stepPrints(f: GroundFrame): void {
    const tex = this.tex();
    const seen = new Set<string>();
    for (const w of f.walkers) {
      seen.add(w.id);
      const s = this.walkers.get(w.id);
      if (!s) {
        this.walkers.set(w.id, { x: w.x, y: w.y, left: false, acc: 0 });
        continue;
      }
      const dx = w.x - s.x,
        dy = w.y - s.y,
        d = Math.hypot(dx, dy);
      s.x = w.x;
      s.y = w.y;
      if (d > 3) continue; // a teleport, not a step
      s.acc += d;
      if (s.acc < STRIDE || d < 1e-4) continue;
      s.acc = 0;
      const ground = this.soft(w.x, w.y, f);
      if (!ground) continue;
      // left and right feet a little either side of the line of travel
      s.left = !s.left;
      const side = (s.left ? 1 : -1) * 0.13;
      const px = w.x + (-dy / d) * side,
        py = w.y + (dx / d) * side;
      const p = this.prints.length >= MAX_PRINTS ? this.prints.shift()! : null;
      const sprite = p?.s ?? new Sprite();
      if (!p) this.layer.addChild(sprite);
      sprite.texture = tex[ground]!;
      sprite.anchor.set(0.5);
      sprite.position.set(Math.round(isoX(px, py)), Math.round(isoY(px, py)));
      sprite.alpha = 0.7;
      this.prints.push({ s: sprite, age: 0, life: ground === 'snow' ? 90 : ground === 'sand' ? 45 : 30 });
    }
    for (const id of this.walkers.keys()) if (!seen.has(id)) this.walkers.delete(id);
    for (const p of this.prints) {
      p.age += f.dt;
      p.s.alpha = Math.max(0, 0.7 * (1 - p.age / p.life));
      p.s.visible = p.age < p.life;
    }
  }

  private stepPuddles(f: GroundFrame, raining: boolean): void {
    const tex = this.tex();
    // while it rains (and for a while after) puddles collect on paths and bare earth near you
    this.spawnT -= f.dt;
    if (this.wetness > 0.25 && this.spawnT <= 0 && this.puddles.length < MAX_PUDDLES * this.wetness) {
      this.spawnT = raining ? 0.4 : 3;
      for (let k = 0; k < 4; k++) {
        const x = f.me.x + (Math.random() - 0.5) * 30,
          y = f.me.y + (Math.random() - 0.5) * 30;
        const t = this.store().getTile(Math.floor(x), Math.floor(y));
        if (t !== T.PATH && t !== T.TILLED && t !== T.TILLED_WET && t !== T.SAND) continue;
        const size = Math.random();
        const s = new Sprite(tex[size < 0.5 ? 'puddleS' : size < 0.85 ? 'puddleM' : 'puddleL']!);
        s.anchor.set(0.5);
        s.position.set(
          Math.round(isoX(Math.floor(x) + 0.5, Math.floor(y) + 0.5)),
          Math.round(isoY(Math.floor(x) + 0.5, Math.floor(y) + 0.5)),
        );
        this.layer.addChildAt(s, 0);
        this.puddles.push({ s, x, y, size });
        break;
      }
    }
    // puddles shrink as the ground dries; far-away ones are let go
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i]!;
      const far = Math.hypot(p.x - f.me.x, p.y - f.me.y) > 40;
      const dry = this.wetness < 0.25 + p.size * 0.3;
      p.s.alpha = Math.max(0, Math.min(0.75, (this.wetness - 0.2) * 2));
      if (!f.reduced && raining) p.s.scale.set(1 + Math.sin(performance.now() / 300 + i) * 0.03);
      if (far || dry) {
        p.s.destroy();
        this.puddles.splice(i, 1);
      }
    }
  }

  /** for tests and the debug panel */
  counts(): { prints: number; puddles: number; wetness: number } {
    return {
      prints: this.prints.filter((p) => p.s.visible).length,
      puddles: this.puddles.length,
      wetness: this.wetness,
    };
  }
}
