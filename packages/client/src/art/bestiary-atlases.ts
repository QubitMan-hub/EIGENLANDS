/** Runtime sprites decode shipped PNGs; no model rasterisation on a region-entry frame. */
import { Assets, Rectangle, Texture } from 'pixi.js';
import manifest from './bestiary-manifest.json';
import type { Anim } from './foes';
interface Layout {
  w: number;
  h: number;
  ay: number;
  cols: number;
  rows: number;
  frames: Record<Anim, number>;
}
const layouts = manifest.atlases as Record<string, Layout>;
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
const atlasUrl = (id: string, night: boolean) => url(`${id}-${night ? 'night' : 'day'}.png`);
async function trimCache(): Promise<void> {
  for (const [key, a] of [...loaded].sort((a, b) => a[1].used - b[1].used)) {
    if (loaded.size <= 24) break;
    if (!loaded.has(key)) continue;
    if (performance.now() - a.used < 5000) continue; // Keep every recently visible kind alive.
    loaded.delete(key);
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
    .catch((error) => {
      failed.add(key);
      console.error('Creature atlas load failed; using the authored model fallback.', id, error);
    })
    .finally(() => pending.delete(key));
  pending.set(key, job);
}
/** null delegates old creatures and failed downloads to the original model renderer. */
export function bestiaryFrame(id: string, night: boolean, dir: number, anim: Anim, frame: number): Texture | null {
  const d = layouts[id];
  if (!d) return null;
  const key = `${id}:${night ? 1 : 0}`,
    a = loaded.get(key);
  if (!a) {
    if (failed.has(key)) return null;
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
  const index = row * d.cols + col + f;
  let tex = a.frames.get(index);
  if (!tex) {
    tex = new Texture({ source: a.base.source, frame: new Rectangle((col + f) * d.w, row * d.h, d.w, d.h) });
    a.frames.set(index, tex);
  }
  return tex;
}
export const bestiaryAnchor = (id: string): number | undefined =>
  layouts[id] ? layouts[id]!.ay / layouts[id]!.h : undefined;
const portraits = new Set<string>(manifest.portraits);
export const bestiaryPortrait = (id: string): string | null => (portraits.has(id) ? url(`portraits/${id}.png`) : null);
export const bestiaryAtlasStats = () => ({ loaded: loaded.size, pending: pending.size, failed: failed.size });
