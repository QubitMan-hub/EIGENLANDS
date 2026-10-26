import { livestockTexture } from '../art/livestock';
import { readHerd, LIVESTOCK, type FarmAnimal } from '@eigenlands/shared';
import { Sprite, type Container } from 'pixi.js';
import {
  C,
  CHUNK_SIZE,
  PALETTE,
  T,
  chunkKey,
  hash2,
  objLight,
  sampleClimate,
  type ChunkStore,
  type WorldObj,
} from '@eigenlands/shared';
import { WindField, CALM } from './windfield';
import { depth, isoX, isoY } from './iso';
import { GROUND_Z } from '../gl/terrain.frag';
import type { SeasonIdx } from '../art/objects';

const hexOf = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);
/** cast shadows are deep navy, quantum echoes pink (qubit things) or cyan (flux ground) */
const SHADOW = hexOf(C.night),
  ECHO_Q = hexOf(C.q6),
  ECHO_FLUX = hexOf(C.q7);
import { worldObjDef, type ObjSpriteDef } from '../art/worldobjs';
import type { Facing } from '../art/isokit';
import type { Sun } from './objectviews';

export interface TileLight {
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
}

type LightSource = (minX: number, minY: number, maxX: number, maxY: number) => TileLight[];
let buildingLights: LightSource | null = null;
const extraLights = new Map<string, LightSource>();
/** BuildingViews registers its window lights here; they ride along with WorldObjViews.lights(). */
export function setBuildingLights(fn: LightSource | null): void {
  buildingLights = fn;
}
/** Other art-side light sources (fireflies, glowing crystals...) keyed by name (re-registering replaces). */
export function setExtraLights(key: string, fn: LightSource | null): void {
  if (fn) extraLights.set(key, fn);
  else extraLights.delete(key);
}

interface FarmView {
  animal: FarmAnimal;
  sprite: Sprite;
  shadow: Sprite;
  x: number;
  y: number;
  young: boolean;
  facing: number;
}
interface View {
  farm: FarmView[];
  obj: WorldObj;
  def: ObjSpriteDef;
  root: Sprite;
  shadow: Sprite;
  echo: Sprite | null;
  phase: number;
  ck: string;
  /** signature of what is drawn (so upsert only rebuilds when it changed) */
  sig: string;
  opened?: number;
}

const sigOf = (o: WorldObj): string => {
  const d = o.data as Record<string, unknown> | undefined;
  if (o.kind === 'crop')
    return `${o.sub}|${d?.growth}|${d?.dead ? 1 : 0}|${d?.alt ?? ''}:${d?.dormant}:${d?.established}`;
  if (o.kind === 'shelter') return `${o.sub}:${JSON.stringify(d?.herd ?? d?.animals)}:${d?.lastDay}`;
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
  private visibleBounds = '';
  private season: SeasonIdx = 1;
  private solvedShrines = new Set<string>();

  setSolvedShrines(ids: string[]): void {
    this.solvedShrines = new Set(ids);
  }
  private hidden(v: View): boolean {
    return this.solvedShrines.has(String(v.obj.data?.shrine ?? ''));
  }

  constructor(
    private store: ChunkStore,
    private shadowLayer: Container,
    private layer: Container,
  ) {}

  animateChest(x: number, y: number, now = performance.now()): void {
    const v = this.views.get(`${x},${y}`);
    if (v?.def.interactive) v.opened = now;
  }

  get count(): number {
    return this.views.size;
  }
  setSeason(season: SeasonIdx): void {
    this.season = season;
  }

  /** Props stand with their back to a wall: a wall behind (north-east) faces them south-west, one to the north-west faces them south-east. */
  private facing(o: WorldObj): Facing {
    const wall = (x: number, y: number) => {
      const t = this.store.getTile(x, y);
      return t === T.WALL || t === T.FACE;
    };
    if (wall(o.x, o.y - 1)) return 'sw';
    if (wall(o.x - 1, o.y)) return 'se';
    return 'sw';
  }

  private seatTurn(o: WorldObj): number | undefined {
    if (o.sub !== 'chair') return undefined;
    const dirs = [
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ];
    for (let i = 0; i < dirs.length; i++) {
      const [dx, dy] = dirs[i]!,
        near = this.store.objectAt(o.x + dx!, o.y + dy!);
      if (near && ['table', 'desk', 'counter'].includes(near.sub)) return i;
    }
    return undefined;
  }
  private signature(o: WorldObj): string {
    return o.sub === 'chair' ? `${sigOf(o)}:${this.seatTurn(o)}` : sigOf(o);
  }
  private refreshSeats(o: WorldObj): void {
    if (!['table', 'desk', 'counter'].includes(o.sub)) return;
    for (const [dx, dy] of [
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ]) {
      const chair = this.store.objectAt(o.x + dx!, o.y + dy!);
      if (chair?.sub === 'chair') this.upsert(chair);
    }
  }

  private make(o: WorldObj): View {
    const seatTurn = this.seatTurn(o);
    const def = worldObjDef(o, this.facing(o), seatTurn);
    const f = def.frames[0]!;
    const root = new Sprite(f.tex);
    root.anchor.set(f.ax / f.tex.width, f.ay / f.tex.height);
    // iso billboard: feet on the tile's ground centre
    root.x = Math.round(isoX(o.x + 0.5, o.y + 0.5));
    // crops stand in tilled soil, which the terrain draws a little below the turf
    root.y =
      Math.round(isoY(o.x + 0.5, o.y + 0.5)) -
      (o.kind === 'crop'
        ? GROUND_Z.soil
        : o.sub === 'sea_cache' ||
            (['cave_waterfall', 'magma_fall', 'sea_arch'].includes(o.sub) &&
              [T.WATER, T.DEEP_WATER, T.LAVA].some((t) => t === this.store.getTile(o.x, o.y)))
          ? GROUND_Z.water
          : 0);
    // rugs sit on the ground: behind anything standing on the tile; crops just under entities of the same tile
    const dz = depth(o.x + 0.5, o.y + 0.5);
    root.zIndex =
      (o.kind === 'furniture' && o.sub === 'rug') || o.sub === 'cave_seal' || o.sub === 'mine_rail'
        ? dz - 1e6
        : o.kind === 'crop'
          ? dz - 6
          : dz;
    const shadow = new Sprite(f.tex);
    shadow.anchor.copyFrom(root.anchor);
    shadow.tint = SHADOW;
    shadow.position.copyFrom(root);
    this.layer.addChild(root);
    this.shadowLayer.addChild(shadow);
    // quantum echo: superposed crops and anything qubit-flavoured carry a faint offset ghost
    let echo: Sprite | null = null;
    const sup = o.kind === 'crop' && !!(o.data as { alt?: string } | undefined)?.alt;
    const flux = o.kind === 'crop' ? sampleClimate(this.store.seed, o.x, o.y).flux : -1;
    if (sup || o.sub === 'phase_lantern' || o.sub === 'statue' || flux > 0.45) {
      echo = new Sprite(f.tex);
      echo.anchor.copyFrom(root.anchor);
      echo.tint = o.sub === 'statue' || o.sub === 'phase_lantern' || sup ? ECHO_Q : ECHO_FLUX;
      echo.alpha = 0.22;
      echo.position.set(root.x + 2, root.y - 1);
      echo.zIndex = root.zIndex - 0.5;
      this.layer.addChild(echo);
    }
    const ck = chunkKey(Math.floor(o.x / CHUNK_SIZE), Math.floor(o.y / CHUNK_SIZE));
    const farm: FarmView[] = [];
    if (o.kind === 'shelter' && o.sub !== 'apiary') {
      const data = readHerd(o.data, o.sub, Number(o.data?.lastDay ?? 0));
      for (let i = 0; i < data.herd.length; i++) {
        const animal = data.herd[i]!,
          x = o.x + (i % 2),
          y = o.y + 1 + Math.floor(i / 2),
          facing = animal.id % 2;
        if (this.store.solidAt(x, y) || this.store.levelAt(x, y) !== this.store.levelAt(o.x, o.y)) continue;
        const young = data.lastDay - animal.born < LIVESTOCK[animal.species].growth;
        const sprite = new Sprite(livestockTexture(animal.species, 0, facing)),
          shadow = new Sprite(sprite.texture);
        sprite.anchor.set(24 / 48, 49 / 56);
        sprite.scale.set(young ? 0.62 : 0.9);
        sprite.position.set(Math.round(isoX(x + 0.5, y + 0.5)), Math.round(isoY(x + 0.5, y + 0.5)));
        sprite.zIndex = depth(x + 0.5, y + 0.5);
        shadow.anchor.copyFrom(sprite.anchor);
        shadow.tint = SHADOW;
        shadow.position.copyFrom(sprite);
        shadow.scale.copyFrom(sprite.scale);
        this.layer.addChild(sprite);
        this.shadowLayer.addChild(shadow);
        farm.push({ animal, sprite, shadow, x, y, young, facing });
      }
    }
    return {
      farm,
      obj: o,
      def,
      root,
      shadow,
      echo,
      phase: hash2(this.store.seed, o.x, o.y, 77) * 6.28,
      ck,
      sig: this.signature(o),
    };
  }

  upsert(o: WorldObj): void {
    this.visibleBounds = '';
    const key = `${o.x},${o.y}`;
    const old = this.views.get(key);
    if (old && old.sig === this.signature(o)) {
      old.obj = o;
      return;
    }
    if (old) this.drop(key, old);
    const v = this.make(o);
    this.views.set(key, v);
    let set = this.byChunk.get(v.ck);
    if (!set) {
      set = new Set();
      this.byChunk.set(v.ck, set);
    }
    set.add(key);
    this.refreshSeats(o);
  }

  private drop(key: string, v: View): void {
    for (const f of v.farm) {
      f.sprite.destroy();
      f.shadow.destroy();
    }
    v.root.destroy();
    v.shadow.destroy();
    v.echo?.destroy();
    this.views.delete(key);
    this.byChunk.get(v.ck)?.delete(key);
  }

  remove(x: number, y: number): void {
    const key = `${x},${y}`;
    const v = this.views.get(key);
    if (v) {
      this.drop(key, v);
      this.refreshSeats(v.obj);
    }
  }

  buildChunk(cx: number, cy: number): void {
    const x0 = cx * CHUNK_SIZE,
      y0 = cy * CHUNK_SIZE;
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
      for (const key of [...set]) {
        const v = this.views.get(key);
        if (v) this.drop(key, v);
      }
      this.byChunk.delete(ck);
    }
  }

  private forVisible(minX: number, minY: number, maxX: number, maxY: number, fn: (v: View) => void): void {
    const c0x = Math.floor(minX / CHUNK_SIZE),
      c1x = Math.floor(maxX / CHUNK_SIZE);
    const c0y = Math.floor(minY / CHUNK_SIZE),
      c1y = Math.floor(maxY / CHUNK_SIZE);
    for (let cy = c0y; cy <= c1y; cy++)
      for (let cx = c0x; cx <= c1x; cx++) {
        const set = this.byChunk.get(chunkKey(cx, cy));
        if (!set) continue;
        for (const key of set) {
          const v = this.views.get(key);
          if (v && v.obj.x >= minX && v.obj.x <= maxX && v.obj.y >= minY && v.obj.y <= maxY) fn(v);
        }
      }
  }

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
      for (const v of this.views.values()) {
        const show = v.obj.x >= minX && v.obj.x <= maxX && v.obj.y >= minY && v.obj.y <= maxY && !this.hidden(v);
        v.root.visible = show;
        for (const f of v.farm) {
          f.sprite.visible = show;
          if (!show) f.shadow.visible = false;
        }
        if (v.echo) v.echo.visible = show;
        if (!show) v.shadow.visible = false;
      }
    }
    const t = now / 1000;
    this.forVisible(minX, minY, maxX, maxY, (v) => {
      const hidden = this.hidden(v);
      v.root.visible = !hidden;
      if (v.echo) v.echo.visible = !hidden;
      if (hidden) {
        v.shadow.visible = false;
        return;
      }
      for (const f of v.farm) {
        const frame = !reduced && v.obj.data?.fed && Math.sin(t * 0.6 + f.animal.id * 3.1 + v.phase) > 0.94 ? 1 : 0;
        f.sprite.texture = livestockTexture(f.animal.species, frame, f.facing);
        f.shadow.texture = f.sprite.texture;
        f.sprite.visible =
          !hidden &&
          !this.store.solidAt(f.x, f.y) &&
          this.store.levelAt(f.x, f.y) === this.store.levelAt(v.obj.x, v.obj.y);
        f.shadow.visible = f.sprite.visible && sun.alpha > 0.02;
        f.shadow.alpha = sun.alpha * 0.8;
        f.shadow.scale.set(f.young ? 0.62 : 0.9, -(f.young ? 0.62 : 0.9) * (0.22 + 0.14 * sun.len));
        f.shadow.skew.x = sun.dx * sun.len * 0.9;
      }
      const d = v.def;
      if (d.frames.length > 1) {
        const age = v.opened === undefined ? Infinity : (now - v.opened) / 1000;
        const f = d.interactive
          ? age < 0.24
            ? reduced
              ? 3
              : Math.min(3, 1 + Math.floor(age / 0.08))
            : age < 1.8
              ? 3
              : age < 2.04 && !reduced
                ? Math.max(0, 2 - Math.floor((age - 1.8) / 0.08))
                : 0
          : reduced
            ? 0
            : Math.floor(t * d.fps + v.phase) % d.frames.length;
        const frame = d.frames[f]!,
          tex = frame.tex;
        v.root.anchor.set(frame.ax / tex.width, frame.ay / tex.height);
        v.shadow.anchor.copyFrom(v.root.anchor);
        if (v.echo) v.echo.anchor.copyFrom(v.root.anchor);
        if (v.root.texture !== tex) {
          v.root.texture = tex;
          v.shadow.texture = tex;
          if (v.echo) v.echo.texture = tex;
        }
      }
      const sway = reduced || !d.sway ? 0 : wind.sway(v.obj.x, v.obj.y, v.phase, d.sway * 4);
      v.root.skew.x = sway;
      if (v.echo) {
        v.echo.skew.x = sway;
        v.echo.alpha = reduced ? 0.2 : 0.15 + 0.1 * Math.sin(t * 1.9 + v.phase);
      }
      const show = !d.noShadow && sun.alpha > 0.02;
      v.shadow.visible = show;
      if (show) {
        v.shadow.alpha = sun.alpha * 0.9;
        v.shadow.scale.y = -(0.22 + 0.14 * sun.len);
        v.shadow.skew.x = sun.dx * sun.len * 0.55 + sway;
      }
    });
  }

  /** Light sources among the visible objects (tile-space centres). Superposed crops glow faintly. */
  lights(minX: number, minY: number, maxX: number, maxY: number): TileLight[] {
    const out: TileLight[] = [];
    this.forVisible(minX, minY, maxX, maxY, (v) => {
      if (this.hidden(v)) return;
      const o = v.obj;
      const sub = o.kind === 'crop' && (o.data as { alt?: string } | undefined)?.alt ? `*${o.sub}` : o.sub;
      const l = objLight(o.kind, sub);
      if (!l) return;
      const flick = 0.9 + 0.1 * Math.sin(performance.now() / 160 + v.phase);
      out.push({
        x: o.x + 0.5,
        y: o.y + 0.5,
        radius: l.radius * (0.95 + 0.05 * flick),
        color: l.color,
        intensity: 0.9 * flick,
      });
    });
    if (buildingLights) out.push(...buildingLights(minX, minY, maxX, maxY));
    for (const fn of extraLights.values()) out.push(...fn(minX, minY, maxX, maxY));
    return out;
  }
}
