import { Assets, Rectangle, Texture } from 'pixi.js';
import { ENEMY_KEY_BY_KIND } from '@eigenlands/shared';
import { bestiaryPortrait } from './bestiary-atlases';
import { critterLayout, normalizeBody } from './creature-pixels';
import { loadStormbound, type StormboundArt } from './stormbound';

/**
 * Hand-drawn wildlife (boar, stag, badger, wolf) from the critter sprite packs in src/assets/critters.
 * Each file is a horizontal strip of one animation facing one of the four iso diagonals (the wolf packs all four
 * facings into rows of one sheet). Palette/scale normalization and slicing happen once at load.
 */
export type CritterId = 'boar' | 'stag' | 'badger' | 'wolf';
export type CritterDir = 'NE' | 'NW' | 'SE' | 'SW';

interface Strip {
  frames: Texture[];
  fps: number;
}
interface Spec {
  fw: number;
  fh: number;
  /** feet anchor inside the frame (0..1) */ ax: number;
  ay: number;
  shadowLift?: number;
  anims: Record<string, { n: number; fps: number; loop?: boolean }>;
}

const SPECS: Record<CritterId, Spec> = {
  boar: { fw: 41, fh: 25, ax: 0.5, ay: 0.9, shadowLift: 18, anims: { idle: { n: 7, fps: 5 }, run: { n: 4, fps: 12 } } },
  stag: {
    fw: 32,
    fh: 41,
    ax: 0.5,
    ay: 0.9,
    anims: { idle: { n: 24, fps: 8 }, walk: { n: 11, fps: 10 }, run: { n: 10, fps: 14 } },
  },
  badger: {
    fw: 42,
    fh: 32,
    ax: 0.5,
    ay: 0.86,
    shadowLift: 8,
    anims: {
      idle: { n: 22, fps: 8 },
      walk: { n: 9, fps: 10 },
      burrow: { n: 25, fps: 14 },
      tunnel: { n: 5, fps: 10 },
      unburrow: { n: 13, fps: 14 },
    },
  },
  wolf: {
    fw: 64,
    fh: 64,
    ax: 0.5,
    ay: 0.74,
    anims: {
      idle: { n: 4, fps: 5 },
      run: { n: 8, fps: 14 },
      bite: { n: 15, fps: 20 },
      howl: { n: 9, fps: 8 },
      death: { n: 12, fps: 10 },
    },
  },
};
/** wolf sheet row per facing */
const WOLF_ROW: Record<CritterDir, number> = { SW: 0, SE: 1, NW: 2, NE: 3 };
const DIRS: CritterDir[] = ['NE', 'NW', 'SE', 'SW'];

const URLS = import.meta.glob('../assets/critters/*.png', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;
const urlOf = (name: string): string => URLS[`../assets/critters/${name}.png`]!;
const portraits = new Map<CritterId, { url: string; width: number; height: number }>();

/** The same normalized first idle frame used in the world, without duplicate image assets. */
export function companionPortrait(kind: number): { url: string; width: number; height: number } | null {
  const id = kind === 7 ? 'boar' : kind === 9 ? 'badger' : kind === 3 ? 'stag' : null;
  if (id) return portraits.get(id) ?? { url: urlOf(`${id}_SE_idle`), width: SPECS[id].fw, height: SPECS[id].fh };
  const key = ENEMY_KEY_BY_KIND[kind];
  const url = key && bestiaryPortrait(key);
  return url ? { url, width: 64, height: 64 } : null;
}

export class Critters {
  stormbound!: StormboundArt;
  private strips = new Map<string, Strip>();
  private layouts = new Map<CritterId, ReturnType<typeof critterLayout>>();

  static async load(): Promise<Critters> {
    const c = new Critters();
    const names: Array<{ key: string; file: string; id: CritterId; anim: string; dir?: CritterDir }> = [];
    for (const id of ['boar', 'stag', 'badger'] as const) {
      for (const anim of Object.keys(SPECS[id].anims))
        for (const dir of DIRS)
          names.push({ key: `${id}/${anim}/${dir}`, file: `${id}_${dir}_${anim}`, id, anim, dir });
    }
    for (const anim of Object.keys(SPECS.wolf.anims))
      names.push({ key: `wolf/${anim}`, file: `wolf_${anim}`, id: 'wolf', anim });
    const [tex, stormbound] = await Promise.all([
      Promise.all(names.map((n) => Assets.load<Texture>(urlOf(n.file)))),
      loadStormbound(),
    ]);
    c.stormbound = stormbound;
    for (const id of ['boar', 'stag', 'badger', 'wolf'] as const) {
      const spec = SPECS[id];
      const index = names.findIndex((n) => n.id === id && n.anim === 'idle' && (id === 'wolf' || n.dir === 'SE'));
      const canvas = document.createElement('canvas');
      canvas.width = spec.fw;
      canvas.height = spec.fh;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(
        tex[index]!.source.resource as CanvasImageSource,
        0,
        id === 'wolf' ? WOLF_ROW.SE * spec.fh : 0,
        spec.fw,
        spec.fh,
        0,
        0,
        spec.fw,
        spec.fh,
      );
      const data = ctx.getImageData(0, 0, spec.fw, spec.fh).data;
      let left = spec.fw,
        top = spec.fh,
        right = 0,
        bottom = 0;
      for (let y = 0; y < spec.fh; y++)
        for (let x = 0; x < spec.fw; x++)
          if (data[(y * spec.fw + x) * 4 + 3]! >= 128) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x + 1);
            bottom = Math.max(bottom, y + 1);
          }
      c.layouts.set(id, critterLayout(spec.fw, spec.fh, spec.ax, spec.ay, right - left, bottom - top));
    }
    names.forEach((n, i) => {
      const spec = SPECS[n.id],
        a = spec.anims[n.anim]!;
      const layout = c.layouts.get(n.id)!;
      const t = normalizeStrip(tex[i]!, spec, layout, a.n, n.id === 'wolf' ? 4 : 1);
      const frameSpec = { ...spec, fw: layout.width, fh: layout.height };
      if (n.id === 'wolf') {
        for (const dir of DIRS)
          c.strips.set(`wolf/${n.anim}/${dir}`, { fps: a.fps, frames: cut(t, frameSpec, a.n, WOLF_ROW[dir]) });
      } else c.strips.set(n.key, { fps: a.fps, frames: cut(t, frameSpec, a.n, 0) });
      if (n.anim === 'idle' && (n.id === 'wolf' || n.dir === 'SE')) {
        const canvas = document.createElement('canvas');
        canvas.width = layout.width;
        canvas.height = layout.height;
        const frame = c.frame(n.id, 'idle', 'SE', 0).frame;
        canvas
          .getContext('2d')!
          .drawImage(
            t.source.resource as CanvasImageSource,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            0,
            0,
            layout.width,
            layout.height,
          );
        portraits.set(n.id, { url: canvas.toDataURL(), width: layout.width, height: layout.height });
      }
    });
    return c;
  }

  /** Anchor (feet) inside the frame for `id`. */
  anchor(id: CritterId): { x: number; y: number } {
    const a = this.layouts.get(id)!;
    return { x: a.ax, y: a.ay };
  }
  has(id: CritterId, anim: string): boolean {
    return !!SPECS[id].anims[anim];
  }
  fps(id: CritterId, anim: string): number {
    return SPECS[id].anims[anim]?.fps ?? 8;
  }
  length(id: CritterId, anim: string): number {
    return SPECS[id].anims[anim]?.n ?? 1;
  }

  /** Frame `i` (wrapped) of an animation. */
  frame(id: CritterId, anim: string, dir: CritterDir, i: number): Texture {
    const s = this.strips.get(`${id}/${anim}/${dir}`) ?? this.strips.get(`${id}/idle/${dir}`)!;
    return s.frames[((Math.floor(i) % s.frames.length) + s.frames.length) % s.frames.length]!;
  }
}

function normalizeStrip(
  source: Texture,
  spec: Spec,
  layout: ReturnType<typeof critterLayout>,
  count: number,
  rows: number,
): Texture {
  const atlas = document.createElement('canvas');
  atlas.width = layout.width * count;
  atlas.height = layout.height * rows;
  const frame = document.createElement('canvas');
  frame.width = layout.width;
  frame.height = layout.height;
  const ctx = frame.getContext('2d', { willReadFrequently: true })!,
    target = atlas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < count; col++) {
      ctx.clearRect(0, 0, layout.width, layout.height);
      ctx.drawImage(
        source.source.resource as CanvasImageSource,
        col * spec.fw,
        row * spec.fh,
        spec.fw,
        spec.fh,
        0,
        0,
        layout.width,
        layout.height,
      );
      const image = ctx.getImageData(0, 0, layout.width, layout.height);
      normalizeBody(image.data, layout.width, layout.height, spec.shadowLift);
      target.putImageData(image, col * layout.width, row * layout.height);
    }
  const texture = Texture.from(atlas);
  texture.source.scaleMode = 'nearest';
  return texture;
}

function cut(tex: Texture, spec: Spec, n: number, row: number): Texture[] {
  const out: Texture[] = [];
  for (let i = 0; i < n; i++)
    out.push(new Texture({ source: tex.source, frame: new Rectangle(i * spec.fw, row * spec.fh, spec.fw, spec.fh) }));
  return out;
}

/** Iso facing from a world-space direction: screen right/left × down/up. */
export function critterDir(fx: number, fy: number): CritterDir {
  const sx = fx - fy,
    sy = fx + fy; // (up to a positive scale) the iso screen direction
  return `${sy >= 0 ? 'S' : 'N'}${sx >= 0 ? 'E' : 'W'}` as CritterDir;
}
