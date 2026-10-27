/** Runtime sprites decode shipped PNGs; no model rasterisation on a region-entry frame. */
import { Assets, Rectangle, Texture } from 'pixi.js';
import manifest from './bestiary-manifest.json';
import bosses from './boss-manifest.json';
import type { Anim } from './foes';
interface Layout {
  w: number;
  h: number;
  ay: number;
  cols: number;
  rows: number;
  poseRows?: number;
  fallback?: string;
  frames: Record<Anim, number>;
}
const layouts = { ...manifest.atlases, ...bosses.atlases } as Record<string, Layout>;
const authored = new Set<string>(Object.keys(bosses.atlases));
interface Atlas {
  base: Texture;
  frames: Map<number, Texture>;
  used: number;
  url: string;
}
const loaded = new Map<string, Atlas>(),
  pending = new Map<string, Promise<void>>(),
  failed = new Set<string>(),
  unloading = new Map<string, Promise<void>>();
const url = (path: string) => `${import.meta.env.BASE_URL}art/bestiary/${path}`;
const thumbnails = new Map<string, Texture>();
const atlasUrl = (id: string, night: boolean) => url(`${id}-${night ? 'night' : 'day'}.png`);
async function trimCache(): Promise<void> {
  let pixels = [...loaded.values()].reduce((n, a) => n + a.base.width * a.base.height, 0);
  for (const [key, a] of [...loaded].sort((a, b) => a[1].used - b[1].used)) {
    if (loaded.size <= 24 && pixels <= 12 * 1024 * 1024) break;
    if (!loaded.has(key)) continue;
    if (performance.now() - a.used < 5000) continue; // Keep every recently visible kind alive.
    loaded.delete(key);
    pixels -= a.base.width * a.base.height;
    for (const f of a.frames.values()) f.destroy(false);
    const dispose = Assets.unload(a.url);
    unloading.set(key, dispose);
    await dispose;
    unloading.delete(key);
  }
}
function request(id: string, night: boolean, key: string): void {
  if (pending.has(key) || failed.has(key)) return;
  const job = (async () => {
    await unloading.get(key);
    const src = atlasUrl(id, night),
      base = await Assets.load<Texture>(src);
    const d = layouts[id]!;
    if (base.width !== d.w * d.cols || base.height !== d.h * d.rows) throw Error(`Bad creature atlas ${id}`);
    base.source.scaleMode = 'nearest';
    loaded.set(key, { base, frames: new Map(), used: performance.now(), url: src });
    await trimCache();
  })()
    .catch(async (error) => {
      failed.add(key);
      const d = layouts[id];
      if (authored.has(id) && d?.fallback) {
        const base = await Assets.load<Texture>(d.fallback);
        base.source.scaleMode = 'nearest';
        thumbnails.set(key, new Texture({ source: base.source, orig: new Rectangle(0, 0, d.w, d.h) }));
        console.warn('Creature atlas unavailable; showing its embedded authored thumbnail.', id, error);
      } else console.error('Creature atlas load failed; using the authored model fallback.', id, error);
    })
    .finally(() => pending.delete(key));
  pending.set(key, job);
}
/** Authoring tools must await decoding before reading CanvasImageSource or checking pixels. */
export async function preloadBestiary(ids: string[], night = false): Promise<void> {
  await Promise.all(
    ids.map(async (id) => {
      if (!layouts[id]) return;
      const key = `${id}:${night ? 1 : 0}`;
      if (loaded.has(key)) return;
      request(id, night, key);
      await pending.get(key);
    }),
  );
}
/** null delegates old creatures and failed downloads to the original model renderer. */
export function bestiaryFrame(id: string, night: boolean, dir: number, anim: Anim, frame: number): Texture | null {
  const d = layouts[id];
  if (!d) return null;
  const key = `${id}:${night ? 1 : 0}`,
    a = loaded.get(key);
  if (!a) {
    if (failed.has(key)) return authored.has(id) ? (thumbnails.get(key) ?? Texture.EMPTY) : null;
    request(id, night, key);
    return Texture.EMPTY;
  }
  a.used = performance.now();
  let col = 0;
  for (const k of ['idle', 'move', 'windup', 'attack', 'hurt', 'death'] as Anim[]) {
    if (k === anim) break;
    col += d.frames[k];
  }
  const n = d.frames[anim],
    f = anim === 'death' ? Math.max(0, Math.min(n - 1, frame)) : ((frame % n) + n) % n,
    row = ((dir % 4) + 4) % 4;
  const pose = col + f,
    packedRow = row * (d.poseRows ?? 1) + Math.floor(pose / d.cols),
    packedCol = pose % d.cols;
  const index = packedRow * d.cols + packedCol;
  let tex = a.frames.get(index);
  if (!tex) {
    tex = new Texture({ source: a.base.source, frame: new Rectangle(packedCol * d.w, packedRow * d.h, d.w, d.h) });
    a.frames.set(index, tex);
  }
  return tex;
}
export const bestiaryAnchor = (id: string): number | undefined =>
  layouts[id] ? layouts[id]!.ay / layouts[id]!.h : undefined;
const portraits = new Set<string>([...manifest.portraits, ...bosses.portraits]);
export const bestiaryPortrait = (id: string): string | null => (portraits.has(id) ? url(`portraits/${id}.png`) : null);
export const bestiaryAtlasStats = () => ({
  loaded: loaded.size,
  pending: pending.size,
  failed: failed.size,
  pixels: [...loaded.values()].reduce((n, a) => n + a.base.width * a.base.height, 0),
});

const fallbackFrames = new WeakMap<Texture, Texture>();
/** Failed downloads keep the exact same crop and ground anchor as shipped atlases. */
export function bestiaryFallback(id: string, raw: Texture, ay: number): Texture {
  const d = layouts[id];
  if (!d) return raw;
  let frame = fallbackFrames.get(raw);
  if (!frame) {
    frame = new Texture({
      source: raw.source,
      frame: new Rectangle(raw.frame.x + (raw.width - d.w) / 2, raw.frame.y + ay - d.ay, d.w, d.h),
    });
    fallbackFrames.set(raw, frame);
  }
  return frame;
}
