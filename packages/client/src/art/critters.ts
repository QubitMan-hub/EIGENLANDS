import { Assets, Rectangle, Texture } from 'pixi.js';

/**
 * Hand-drawn wildlife (boar, stag, badger, wolf) from the critter sprite packs in src/assets/critters.
 * Each file is a horizontal strip of one animation facing one of the four iso diagonals (the wolf packs all four
 * facings into rows of one sheet). Frames are sliced once at load.
 */
export type CritterId = 'boar' | 'stag' | 'badger' | 'wolf';
export type CritterDir = 'NE' | 'NW' | 'SE' | 'SW';

interface Strip { frames: Texture[]; fps: number }
interface Spec { fw: number; fh: number; /** feet anchor inside the frame (0..1) */ ax: number; ay: number; anims: Record<string, { n: number; fps: number; loop?: boolean }> }

const SPECS: Record<CritterId, Spec> = {
  boar: { fw: 41, fh: 25, ax: 0.5, ay: 0.9, anims: { idle: { n: 7, fps: 5 }, run: { n: 4, fps: 12 } } },
  stag: { fw: 32, fh: 41, ax: 0.5, ay: 0.9, anims: { idle: { n: 24, fps: 8 }, walk: { n: 11, fps: 10 }, run: { n: 10, fps: 14 } } },
  badger: { fw: 42, fh: 32, ax: 0.5, ay: 0.86, anims: { idle: { n: 22, fps: 8 }, walk: { n: 9, fps: 10 }, burrow: { n: 25, fps: 14 }, tunnel: { n: 5, fps: 10 }, unburrow: { n: 13, fps: 14 } } },
  wolf: { fw: 64, fh: 64, ax: 0.5, ay: 0.74, anims: { idle: { n: 4, fps: 5 }, run: { n: 8, fps: 14 }, bite: { n: 15, fps: 20 }, howl: { n: 9, fps: 8 }, death: { n: 12, fps: 10 } } },
};
/** wolf sheet row per facing */
const WOLF_ROW: Record<CritterDir, number> = { SW: 0, SE: 1, NW: 2, NE: 3 };
const DIRS: CritterDir[] = ['NE', 'NW', 'SE', 'SW'];

const URLS = import.meta.glob('../assets/critters/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const urlOf = (name: string): string => URLS[`../assets/critters/${name}.png`]!;

/** First idle frame, cropped at native pixels for roster portraits; no duplicate image assets. */
export function companionPortrait(kind: number): { url: string; width: number; height: number } | null {
  const id = kind === 7 ? 'boar' : kind === 9 ? 'badger' : kind === 3 ? 'stag' : null;
  return id ? { url: urlOf(`${id}_SE_idle`), width: SPECS[id].fw, height: SPECS[id].fh } : null;
}

export class Critters {
  private strips = new Map<string, Strip>();

  static async load(): Promise<Critters> {
    const c = new Critters();
    const names: Array<{ key: string; file: string; id: CritterId; anim: string; dir?: CritterDir }> = [];
    for (const id of ['boar', 'stag', 'badger'] as const) {
      for (const anim of Object.keys(SPECS[id].anims)) for (const dir of DIRS) names.push({ key: `${id}/${anim}/${dir}`, file: `${id}_${dir}_${anim}`, id, anim, dir });
    }
    for (const anim of Object.keys(SPECS.wolf.anims)) names.push({ key: `wolf/${anim}`, file: `wolf_${anim}`, id: 'wolf', anim });
    const tex = await Promise.all(names.map((n) => Assets.load<Texture>(urlOf(n.file))));
    names.forEach((n, i) => {
      const t = tex[i]!;
      t.source.scaleMode = 'nearest';
      const spec = SPECS[n.id], a = spec.anims[n.anim]!;
      if (n.id === 'wolf') {
        for (const dir of DIRS) c.strips.set(`wolf/${n.anim}/${dir}`, { fps: a.fps, frames: cut(t, spec, a.n, WOLF_ROW[dir]) });
      } else c.strips.set(n.key, { fps: a.fps, frames: cut(t, spec, a.n, 0) });
    });
    return c;
  }

  /** Anchor (feet) inside the frame for `id`. */
  anchor(id: CritterId): { x: number; y: number } { return { x: SPECS[id].ax, y: SPECS[id].ay }; }
  has(id: CritterId, anim: string): boolean { return !!SPECS[id].anims[anim]; }
  fps(id: CritterId, anim: string): number { return SPECS[id].anims[anim]?.fps ?? 8; }
  length(id: CritterId, anim: string): number { return SPECS[id].anims[anim]?.n ?? 1; }

  /** Frame `i` (wrapped) of an animation. */
  frame(id: CritterId, anim: string, dir: CritterDir, i: number): Texture {
    const s = this.strips.get(`${id}/${anim}/${dir}`) ?? this.strips.get(`${id}/idle/${dir}`)!;
    return s.frames[((Math.floor(i) % s.frames.length) + s.frames.length) % s.frames.length]!;
  }
}

function cut(tex: Texture, spec: Spec, n: number, row: number): Texture[] {
  const out: Texture[] = [];
  for (let i = 0; i < n; i++) out.push(new Texture({ source: tex.source, frame: new Rectangle(i * spec.fw, row * spec.fh, spec.fw, spec.fh) }));
  return out;
}

/** Iso facing from a world-space direction: screen right/left × down/up. */
export function critterDir(fx: number, fy: number): CritterDir {
  const sx = fx - fy, sy = fx + fy; // (up to a positive scale) the iso screen direction
  return `${sy >= 0 ? 'S' : 'N'}${sx >= 0 ? 'E' : 'W'}` as CritterDir;
}
