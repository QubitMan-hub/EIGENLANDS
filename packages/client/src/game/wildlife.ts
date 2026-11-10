import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  CHUNK_SIZE,
  T,
  hash2,
  findPath,
  townAt,
  wildlifeFor,
  type ChunkStore,
  type WildlifeDef,
} from '@eigenlands/shared';
import type { AmbientFrame } from './ambient';
import { natureContextAt } from './nature-context';
import { depth, isoX, isoY } from './iso';
import { makeCanvas } from '../art/shade';
import { paintWildlife } from '../art/nature';
import { villageHeading } from '../art/village-animals';
import type { Heading } from '../art/voxel';

export const WILDLIFE_LIMIT = 28;
const CELL = 16;
const GROUND = new Set<number>([T.GRASS, T.GRASS_TALL, T.FLOWERS, T.SAND, T.CAVE_FLOOR, T.SCORIA]);
interface WildlifeDeps {
  volumetric?: () => boolean;
  store(): ChunkStore;
  layer(): Container;
  /** Optional external atlas provider; its textures remain owned by the caller. */
  texture?: (id: string, frame: number, season: number, heading?: Heading) => Texture;
}
interface Animal {
  species: WildlifeDef;
  root: Container;
  sprite: Sprite;
  shadow: Graphics;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  route: Array<[number, number]>;
  wait: number;
  clock: number;
  decision: number;
  alpha: number;
  retiring: boolean;
  facing: Heading;
  moving: boolean;
}

/** Small, harmless wildlife lives in streamed habitat cells, without network entities or terrain edits. */
export class Wildlife {
  voxelActors(): import('./voxel/world').VoxelActor[] {
    const directions = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    return [...this.actors].flatMap(([id, a]) =>
      !a.root.visible
        ? []
        : [
            {
              id: `wildlife:${id}`,
              type: 'animal',
              species: a.species.id,
              x: a.x,
              y: a.y,
              faceX: directions[a.facing][0],
              faceY: directions[a.facing][1],
              walking: a.moving,
            },
          ],
    );
  }
  private actors = new Map<string, Animal>();
  private textures = new Map<string, Texture>();
  private seed = NaN;
  private season = -1;
  private nextDiscovery = -Infinity;
  private cursor = 0;
  /** Bound first-use SDF raster work; cached frames stay cheap. */
  private textureBuilds = 0;
  constructor(private d: WildlifeDeps) {}
  count(): number {
    return this.actors.size;
  }
  kinds(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const a of this.actors.values()) result[a.species.id] = (result[a.species.id] ?? 0) + 1;
    return result;
  }
  private clear(): void {
    for (const a of this.actors.values()) a.root.destroy({ children: true });
    this.actors.clear();
    for (const texture of this.textures.values()) texture.destroy(true);
    this.textures.clear();
  }
  private texture(id: string, frame: number, heading: Heading): Texture | null {
    if (this.d.volumetric?.()) return Texture.EMPTY;
    if (this.d.texture) return this.d.texture(id, frame, this.season, heading);
    const key = `${id}:${frame}:${heading}`;
    let t = this.textures.get(key);
    if (!t) {
      if (this.textureBuilds >= 2) return null;
      this.textureBuilds++;
      const { canvas, ctx } = makeCanvas(40, 40);
      paintWildlife(ctx, id, frame, this.season, heading);
      t = Texture.from(canvas);
      t.source.scaleMode = 'nearest';
      this.textures.set(key, t);
    }
    return t;
  }
  private natural(store: ChunkStore, x: number, y: number): boolean {
    const cx = Math.floor(x / CHUNK_SIZE),
      cy = Math.floor(y / CHUNK_SIZE);
    if (!store.has(cx, cy)) return false;
    const c = store.get(cx, cy);
    return (
      !c.diff.has((y - cy * CHUNK_SIZE) * CHUNK_SIZE + x - cx * CHUNK_SIZE) &&
      GROUND.has(store.getTile(x, y)) &&
      !store.solidAt(x, y) &&
      !store.objectAt(x, y) &&
      !store.structureAt(x, y)
    );
  }
  frame(f: AmbientFrame): void {
    this.textureBuilds = 0;
    const store = this.d.store();
    if (this.seed !== store.seed || this.season !== f.season) {
      this.clear();
      this.seed = store.seed;
      this.season = f.season;
      this.nextDiscovery = -Infinity;
      this.cursor = 0;
    }
    for (const [key, a] of this.actors) {
      if (Math.hypot(a.x - f.me.x, a.y - f.me.y) > 76 || !this.natural(store, Math.floor(a.x), Math.floor(a.y))) {
        a.root.destroy({ children: true });
        this.actors.delete(key);
        continue;
      }
      this.step(a, f, store);
      if (a.retiring && a.alpha <= 0) {
        a.root.destroy({ children: true });
        this.actors.delete(key);
      }
    }
    if (f.now >= this.nextDiscovery) {
      this.nextDiscovery = f.now + 500;
      this.discover(f, store);
      const active = new Set([...this.actors.values()].map((a) => a.species.id));
      for (const [key, texture] of this.textures)
        if (!active.has(key.split(':')[0]!)) {
          texture.destroy(true);
          this.textures.delete(key);
        }
    }
  }
  private discover(f: AmbientFrame, store: ChunkStore): void {
    for (const a of this.actors.values()) {
      const context = natureContextAt(store, Math.floor(a.x), Math.floor(a.y), f.season, f.hour, f.weather);
      a.retiring = !context || !wildlifeFor(context).includes(a.species);
    }
    // Only a 7×7 neighbourhood, and at most 24 candidates per half second, regardless of zoom.
    const gx0 = Math.floor(f.me.x / CELL) - 3,
      gy0 = Math.floor(f.me.y / CELL) - 3;
    for (let i = 0; i < 24 && this.actors.size < WILDLIFE_LIMIT; i++) {
      const index = this.cursor++ % 49,
        gx = gx0 + (index % 7),
        gy = gy0 + Math.floor(index / 7);
      const key = `${gx},${gy}`;
      if (this.actors.has(key) || hash2(store.seed, gx, gy, 17300) > 0.8) continue;
      const x = gx * CELL + 3 + Math.floor(hash2(store.seed, gx, gy, 17301) * 10);
      const y = gy * CELL + 3 + Math.floor(hash2(store.seed, gx, gy, 17302) * 10);
      if (
        x < f.view.x0 ||
        y < f.view.y0 ||
        x > f.view.x1 ||
        y > f.view.y1 ||
        Math.hypot(x - f.me.x, y - f.me.y) < 5 ||
        Math.hypot(x, y) < 12
      )
        continue;
      if (!this.natural(store, x, y) || townAt(store.seed, x, y, store.generation)) continue;
      const context = natureContextAt(store, x, y, f.season, f.hour, f.weather);
      if (!context) continue;
      const pool = wildlifeFor(context);
      const species = pool[Math.floor(hash2(store.seed, gx, gy, 17303) * pool.length)];
      if (!species) continue;
      const initial = this.texture(species.id, 0, 0);
      if (!initial) continue;
      const root = new Container(),
        shadow = new Graphics(),
        sprite = new Sprite(initial);
      shadow.ellipse(0, 0, species.motion === 'flutter' ? 2 : 4, 1.5).fill({ color: 0x1c2630, alpha: 0.2 });
      sprite.anchor.set(0.5, 32 / 40);
      root.addChild(shadow, sprite);
      this.d.layer().addChild(root);
      const a: Animal = {
        species,
        root,
        sprite,
        shadow,
        x: x + 0.5,
        y: y + 0.5,
        homeX: x + 0.5,
        homeY: y + 0.5,
        route: [],
        wait: 1 + hash2(store.seed, gx, gy, 17304) * 3,
        clock: 0,
        decision: 0,
        alpha: 0,
        retiring: false,
        facing: 0,
        moving: false,
      };
      this.actors.set(key, a);
      this.place(a, f);
    }
  }
  private goal(a: Animal, f: AmbientFrame, store: ChunkStore, fleeing: boolean): void {
    a.decision++;
    for (let i = 0; i < 4; i++) {
      const roll = hash2(store.seed, Math.floor(a.homeX), Math.floor(a.homeY), a.decision * 7 + i + 17310);
      const direction = fleeing ? Math.atan2(a.y - f.me.y, a.x - f.me.x) + (roll - 0.5) : roll * Math.PI * 2;
      const distance = fleeing ? 3.5 : 1 + roll * 2;
      const x = Math.floor((fleeing ? a.x : a.homeX) + Math.cos(direction) * distance);
      const y = Math.floor((fleeing ? a.y : a.homeY) + Math.sin(direction) * distance);
      if (
        Math.hypot(x - a.homeX, y - a.homeY) > 7 ||
        !this.natural(store, x, y) ||
        townAt(store.seed, x, y, store.generation)
      )
        continue;
      const context = natureContextAt(store, x, y, f.season, f.hour, f.weather);
      if (!context || !wildlifeFor(context).includes(a.species)) continue;
      const solid = Object.assign(
        (tx: number, ty: number) =>
          !store.has(Math.floor(tx / CHUNK_SIZE), Math.floor(ty / CHUNK_SIZE)) || store.solidAt(tx, ty),
        { level: store.solidAt.level },
      );
      const path = findPath(Math.floor(a.x), Math.floor(a.y), x, y, solid, 192);
      if (path?.length) {
        a.route = path;
        a.wait = fleeing ? 0.9 : 2 + roll * 4;
        return;
      }
    }
    a.route = [];
    a.wait = 1.5;
  }
  private step(a: Animal, f: AmbientFrame, store: ChunkStore): void {
    const dt = Math.min(f.dt, 0.1),
      distance = Math.hypot(a.x - f.me.x, a.y - f.me.y);
    if (!a.route.length && a.moving)
      a.wait = Math.max(a.wait, 1 + hash2(store.seed, Math.floor(a.homeX), a.decision, 17320) * 3);
    a.clock += dt;
    a.wait -= dt;
    a.alpha = Math.max(0, Math.min(1, a.alpha + (a.retiring ? -dt : dt * 1.6)));
    if (!a.retiring && a.wait <= 0 && (!a.route.length || distance < a.species.scare))
      this.goal(a, f, store, distance < a.species.scare);
    const next = a.route[0];
    a.moving = !!next && !a.retiring;
    if (next && a.moving) {
      const dx = next[0] + 0.5 - a.x,
        dy = next[1] + 0.5 - a.y,
        d = Math.hypot(dx, dy);
      if (!this.natural(store, next[0], next[1])) {
        a.route = [];
        a.wait = 0.3;
      } else if (d < 0.06) a.route.shift();
      else {
        const length = Math.min(d, a.species.speed * dt * (distance < a.species.scare ? 2 : 1));
        a.x += (dx / d) * length;
        a.y += (dy / d) * length;
        if (d > 0.01) a.facing = villageHeading(dx, dy) as Heading;
      }
    }
    this.place(a, f);
  }
  private place(a: Animal, f: AmbientFrame): void {
    const flutter = a.species.motion === 'flutter',
      hop = a.species.motion === 'hop' && a.moving;
    const frame = f.reduced || (!a.moving && !flutter) ? 0 : 1 + (Math.floor(a.clock * (flutter ? 12 : 7)) % 3);
    const texture = this.texture(a.species.id, frame, a.facing);
    if (texture) a.sprite.texture = texture;
    a.sprite.scale.set(1);
    a.sprite.y = flutter
      ? -7 - (f.reduced ? 0 : Math.sin(a.clock * 5) * 2)
      : hop && !f.reduced
        ? -Math.abs(Math.sin(a.clock * 8)) * 2
        : 0;
    a.root.position.set(Math.round(isoX(a.x, a.y)), Math.round(isoY(a.x, a.y)));
    a.root.zIndex = depth(a.x, a.y);
    a.root.alpha = a.alpha;
  }
}
