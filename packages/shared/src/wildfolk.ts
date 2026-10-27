/**
 * Wild folk (master plan §16/§19): people at work out in the wilds, so walking between towns is never lonely. A
 * woodcutter in the forest, a forager in the meadow, a fisher on a bank, a hunter in the snow pines, an herbalist
 * in the fen, a prospector in the dunes, a hermit in the glade. Each keeps to a small patch of ground near their spot
 * by day and goes home at dusk (the hermit never leaves). Spots are a pure function of the seed; how they move is
 * drawn on the client only, like the rest of the ambient life.
 */
import type { Weather } from './weather';
import { hash2 } from './rng';
import { T, isSolid } from './tiles';
import { HOME_VALE, biomeAt, tileAt, type Biome } from './worldgen';
import { activeGeneration } from './generation-registry';
import { sanctuaryAt } from './sanctuary';
import { townAt } from './town';
import { isCaveY } from './caves';
import { isUpperY } from './floors';
import { isDiveY } from './sanctuaries';
import { isCryptY } from './cryptplane';
import { isOtherworldY } from './otherworlds';

export type WildKind =
  | 'woodcutter'
  | 'forager'
  | 'fisher'
  | 'hunter'
  | 'herbalist'
  | 'prospector'
  | 'hermit'
  /** the family in a kingdom's new cottage (growth.ts) */
  | 'cottager';
export interface WildFolk {
  id: string;
  x: number;
  y: number;
  kind: WildKind;
  look: number;
  /** wander radius in tiles */
  r: number;
}

const BY_BIOME: Record<Biome, WildKind[]> = {
  meadow: ['forager', 'forager', 'hunter'],
  forest: ['woodcutter', 'woodcutter', 'forager'],
  autumn: ['woodcutter', 'forager', 'hunter'],
  taiga: ['hunter', 'woodcutter'],
  swamp: ['herbalist', 'herbalist', 'hunter'],
  desert: ['prospector', 'prospector', 'hunter'],
  enchanted: ['hermit', 'herbalist', 'forager'],
  corrupted: ['prospector', 'hermit'],
};
export const WILD_DAY: [number, number] = [6, 19.5];
const CELL = 40;
const cache = new Map<string, WildFolk | null>();

const wet = (t: number) => t === T.WATER || t === T.DEEP_WATER;

export function wildFolkOfCell(seed: number, gx: number, gy: number): WildFolk | null {
  const key = `${seed}:${gx},${gy}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let out: WildFolk | null = null;
  if (hash2(seed, gx, gy, 9301) < 0.38) {
    const gen = activeGeneration(seed);
    for (let k = 0; k < 6 && !out; k++) {
      const x = gx * CELL + 4 + Math.floor(hash2(seed, gx * 31 + k, gy, 9302) * (CELL - 8));
      const y = gy * CELL + 4 + Math.floor(hash2(seed, gx, gy * 31 + k, 9303) * (CELL - 8));
      if (
        Math.hypot(x, y) < HOME_VALE * 0.6 ||
        isCaveY(y) ||
        isUpperY(y) ||
        isDiveY(y) ||
        isCryptY(y) ||
        isOtherworldY(y)
      )
        continue;
      const t = tileAt(seed, x, y, gen);
      if (isSolid(t) || wet(t) || townAt(seed, x, y) || sanctuaryAt(seed, x, y)) continue;
      // a bank within reach makes a fisher of whoever stands here
      let water = false;
      for (let j = -3; j <= 3 && !water; j++)
        for (let i = -3; i <= 3 && !water; i++) if (wet(tileAt(seed, x + i, y + j, gen))) water = true;
      const pool = BY_BIOME[biomeAt(seed, x, y)];
      const kind =
        water && hash2(seed, gx, gy, 9304) < 0.7
          ? 'fisher'
          : pool[Math.floor(hash2(seed, gx, gy, 9305) * pool.length)]!;
      out = {
        id: `wf${gx}_${gy}`,
        x: x + 0.5,
        y: y + 0.5,
        kind,
        look: Math.floor(hash2(seed, gx, gy, 9306) * 1e6),
        r: kind === 'fisher' ? 1.5 : kind === 'hermit' ? 3 : 5,
      };
    }
  }
  if (cache.size > 6000) cache.clear();
  cache.set(key, out);
  return out;
}

/** Wild folk whose spots lie within `rad` tiles of (x, y). */
export function wildFolkNear(seed: number, x: number, y: number, rad: number): WildFolk[] {
  const out: WildFolk[] = [];
  for (let gy = Math.floor((y - rad) / CELL); gy <= Math.floor((y + rad) / CELL); gy++)
    for (let gx = Math.floor((x - rad) / CELL); gx <= Math.floor((x + rad) / CELL); gx++) {
      const f = wildFolkOfCell(seed, gx, gy);
      if (f && Math.hypot(f.x - x, f.y - y) <= rad) out.push(f);
    }
  return out;
}

/** Whether a wild worker is out at this game hour (the hermit always is). */
/** Out at work by day; a storm sends everyone but the hermit home. */
export const wildFolkOut = (f: WildFolk, hour: number, weather?: Weather): boolean =>
  f.kind === 'hermit' ||
  (hour >= WILD_DAY[0] &&
    hour < WILD_DAY[1] &&
    weather !== 'storm' &&
    !(f.kind === 'cottager' && (weather === 'rain' || weather === 'snow')));

export const WILD_BARKS: Record<WildKind, string[]> = {
  woodcutter: ['Timber!', 'Good oak, this.', 'Mind the swing, friend.'],
  forager: ['Mushrooms are up after the rain.', 'Found some berries, want one?', 'Lovely day for it.'],
  fisher: ['Shh, they are biting.', 'The big one got away again.', 'Patience is the whole trick.'],
  hunter: ['Fresh tracks this morning.', 'Stay downwind.', 'Wolves about. Careful.'],
  herbalist: ['Bogbean for fevers, moss for cuts.', 'Watch your step, it is deep here.', 'Smell that? Marsh mint.'],
  prospector: ['There is a seam here, I can feel it.', 'Sand in everything…', 'Gold! No. Pyrite again.'],
  hermit: ['Few come this way.', 'The stones hum at night. Listen.', 'Sit a while, if you like.'],
  cottager: [
    'We only moved in this season!',
    'The crown built it. Good walls, too.',
    'Mind the herbs by the door.',
    'Times are good here. Long may it last.',
  ],
};
