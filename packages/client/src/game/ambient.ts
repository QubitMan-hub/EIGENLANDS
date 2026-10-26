import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  T,
  hash2,
  townFor,
  windScreenX,
  type ChunkStore,
  type Town,
  type Weather,
  type Wind,
} from '@eigenlands/shared';
import { buildAmbientArt, type AmbientArt } from '../art/ambient';
import type { Sheets } from '../art/actors';
import { dirOf, COSMETIC_OUTFITS, WALK_FRAMES } from '../art/actors';
import { depth, isoX, isoY, screenDir } from './iso';
import type { Fx } from './fx';

/**
 * The living-world layer: everything that moves around purely for atmosphere. Butterflies in sunny flowers, fireflies
 * at night, flocks of birds on the wind, fish that jump, and in Hadamere chickens, cats, a dog, pigeons that scatter
 * when you run through them, and villagers strolling the streets and greeting you. Visual only: none of it is
 * synced, collides with you or costs the server anything. All of it reacts to the same time, season, weather and
 * wind as the rest of the world.
 */
interface Crit {
  kind: 'butterfly' | 'firefly' | 'bird' | 'fish' | 'chicken' | 'cat' | 'dog' | 'pigeon' | 'walker';
  root: Container;
  sp: Sprite;
  shadow: Graphics | null;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  face: 1 | -1;
  t: number;
  ttl: number;
  phase: number;
  /** state machine: idle | walk | peck | sleep | fly | sit | talk */
  st: string;
  tx: number;
  ty: number;
  home: { x: number; y: number; r: number } | null;
  variant: number;
  // walkers: road graph position
  node?: [number, number];
  bark?: { text: string; until: number };
}

export interface AmbientDeps {
  layer: () => Container;
  labels: () => Container;
  store: () => ChunkStore;
  seed: () => number;
  sheets: () => Sheets;
  fx: () => Fx;
  toScreen: (x: number, y: number) => { x: number; y: number };
}

export interface AmbientFrame {
  now: number;
  dt: number;
  view: { x0: number; y0: number; x1: number; y1: number };
  me: { x: number; y: number };
  hour: number;
  weather: Weather;
  season: number;
  wind: Wind;
  reduced: boolean;
}

const BARKS: Record<string, string[]> = {
  clear: [
    'Fine weather today!',
    "Lovely morning, isn't it?",
    'Have you seen the statue? Splendid.',
    'Fresh bread at the bakery!',
    'Mind the carts!',
  ],
  rain: [
    'Mind the puddles!',
    'Good for the crops, this.',
    'Hate getting my boots wet...',
    'Best stay under the awning.',
  ],
  night: ['Late for a walk, friend.', 'The lamps look pretty tonight.', 'Wolves again? Be careful out there.'],
  snow: ['Brr! Cold enough for you?', 'The pond will freeze soon.', 'Snow! The children will be thrilled.'],
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Ambient {
  private art: AmbientArt | null = null;
  private crits: Crit[] = [];
  private bubbles: Text[] = [];
  private nextBird = 20;
  private nextFish = 4;
  private townSeed = -1;
  private town: Town | null = null;
  private spawnedVillage = false;
  private clock = 0;

  constructor(private d: AmbientDeps) {}

  artOf(): AmbientArt | null {
    return this.art;
  }
  count(): number {
    return this.crits.length;
  }
  kinds(): Record<string, number> {
    const o: Record<string, number> = {};
    for (const c of this.crits) o[c.kind] = (o[c.kind] ?? 0) + 1;
    return o;
  }

  // ───────────────────────── frame ─────────────────────────

  frame(f: AmbientFrame): void {
    if (!this.art) this.art = buildAmbientArt();
    this.clock += f.dt;
    const day = f.hour >= 6.5 && f.hour < 19;
    const fair = f.weather === 'clear' || f.weather === 'cloudy';
    this.spawnWild(f, day, fair);
    this.villageLife(f, day);
    for (const c of this.crits) this.step(c, f, day);
    // despawn the dead and the far
    const m = 14;
    this.crits = this.crits.filter((c) => {
      const far = c.x < f.view.x0 - m || c.x > f.view.x1 + m || c.y < f.view.y0 - m || c.y > f.view.y1 + m;
      const gone = c.ttl > 0 && c.t > c.ttl;
      if ((far && !c.home && c.kind !== 'walker') || gone) {
        c.root.destroy({ children: true });
        return false;
      }
      return true;
    });
    this.bubblesFrame(f);
  }

  // ───────────────────────── wild spawns ─────────────────────────

  private count0(k: Crit['kind']): number {
    let n = 0;
    for (const c of this.crits) if (c.kind === k) n++;
    return n;
  }

  private spawnWild(f: AmbientFrame, day: boolean, fair: boolean): void {
    const store = this.d.store();
    const w = f.view.x1 - f.view.x0,
      h = f.view.y1 - f.view.y0;
    const rpos = () => ({ x: f.view.x0 + Math.random() * w, y: f.view.y0 + Math.random() * h });
    if (f.reduced) {
      /* reduced motion keeps the ground critters but drops the fluttering swarms */
    }
    // butterflies: sunny days in bloom season, over flowers and grass
    if (
      day &&
      fair &&
      f.season <= 2 &&
      !f.reduced &&
      f.wind.strength < 0.75 &&
      this.count0('butterfly') < 14 &&
      Math.random() < 0.06
    ) {
      const p = rpos(),
        tile = store.getTile(Math.floor(p.x), Math.floor(p.y));
      if (
        tile === T.FLOWERS ||
        (tile === T.GRASS_TALL && Math.random() < 0.5) ||
        (tile === T.GRASS && Math.random() < 0.12)
      )
        this.add('butterfly', p.x, p.y, { z: 10, variant: Math.floor(Math.random() * 4), ttl: rnd(20, 50) });
    }
    // fireflies: after dusk (not in winter or rain), near grass, trees and water
    const night = f.hour >= 19.5 || f.hour < 5;
    if (night && f.season !== 3 && fair && !f.reduced && this.count0('firefly') < 26 && Math.random() < 0.12) {
      const p = rpos(),
        tile = store.getTile(Math.floor(p.x), Math.floor(p.y));
      if (tile === T.GRASS || tile === T.GRASS_TALL || tile === T.FLOWERS || tile === T.TREE)
        this.add('firefly', p.x, p.y, { z: rnd(6, 18), ttl: rnd(14, 30) });
    }
    // birds: a flock crosses the sky now and then, riding the wind
    this.nextBird -= f.dt;
    if (this.nextBird <= 0) {
      this.nextBird = rnd(35, 80);
      if (day && fair && !f.reduced) {
        const ws = windScreenX(f.wind) >= 0 ? 1 : -1,
          n = 3 + Math.floor(Math.random() * 4);
        const sx = ws > 0 ? f.view.x0 - 6 : f.view.x1 + 6,
          sy = f.view.y0 + Math.random() * h;
        for (let i = 0; i < n; i++)
          this.add('bird', sx - ws * i * 1.2, sy + i * 0.5 * (i % 2 ? 1 : -1), {
            z: rnd(60, 86),
            vx: ws * 2.6 + f.wind.dx * 0.4,
            vy: 0.3,
            ttl: 40,
            variant: i,
          });
      }
    }
    // fish jump in ponds and rivers
    this.nextFish -= f.dt;
    if (this.nextFish <= 0 && !f.reduced) {
      this.nextFish = rnd(5, 12);
      for (let i = 0; i < 10; i++) {
        const p = rpos(),
          tile = store.getTile(Math.floor(p.x), Math.floor(p.y));
        if (tile === T.WATER || tile === T.DEEP_WATER) {
          this.add('fish', p.x, p.y, { z: 0, ttl: 0.9 });
          break;
        }
      }
    }
  }

  // ───────────────────────── Hadamere ─────────────────────────

  private villageLife(f: AmbientFrame, day: boolean): void {
    const seed = this.d.seed();
    if (seed !== this.townSeed) {
      this.townSeed = seed;
      this.town = townFor(seed);
      this.spawnedVillage = false;
    }
    const t = this.town!;
    const near = f.view.x1 >= t.x0 - 20 && f.view.x0 <= t.x1 + 20 && f.view.y1 >= t.y0 - 20 && f.view.y0 <= t.y1 + 20;
    if (!near) {
      if (this.spawnedVillage) {
        for (const c of this.crits) if (c.home || c.kind === 'walker') c.root.destroy({ children: true });
        this.crits = this.crits.filter((c) => !c.home && c.kind !== 'walker');
        this.spawnedVillage = false;
      }
      return;
    }
    if (!this.spawnedVillage) {
      this.spawnedVillage = true;
      const farm = t.buildings.find((b) => b.id === 'farmhouse')!;
      const inn = t.buildings.find((b) => b.id === 'inn')!;
      const store = t.buildings.find((b) => b.id === 'store')!;
      for (let i = 0; i < 5; i++)
        this.add('chicken', farm.x + farm.w + 1 + Math.random() * 3, farm.y + 2 + Math.random() * 4, {
          home: { x: farm.x + farm.w + 3, y: farm.y + 4, r: 4.5 },
          variant: i,
        });
      this.add('cat', inn.x - 2, inn.y + inn.h + 1, { home: { x: inn.x + 4, y: inn.y + inn.h + 2, r: 7 } });
      this.add('cat', store.x + store.w + 1, store.y + store.h, {
        home: { x: store.x + store.w + 3, y: store.y + store.h + 1, r: 6 },
        variant: 1,
      });
      this.add('dog', t.cx - 10, t.cy + 5, { home: { x: t.cx, y: t.cy + 6, r: 11 } });
      for (let i = 0; i < 7; i++)
        this.add('pigeon', t.cx + Math.cos(i) * 4, t.cy + 4 + Math.sin(i) * 3.4, {
          home: { x: t.cx, y: t.cy + 4, r: 5.5 },
          variant: i,
        });
      for (let i = 0; i < 12; i++) this.spawnWalker(t, i);
    }
    // villagers thin out after dark
    const walkers = this.crits.filter((c) => c.kind === 'walker');
    const want = day ? 12 : f.hour >= 19 && f.hour < 22 ? 5 : 2;
    for (const w of walkers.slice(want)) w.root.visible = false;
    for (const w of walkers.slice(0, want)) w.root.visible = true;
  }

  private spawnWalker(t: Town, i: number): void {
    const [X, Y] = this.roadGrid(t);
    const nx = Math.floor(hash2(this.townSeed, i, 1, 777) * X.length),
      ny = Math.floor(hash2(this.townSeed, i, 2, 777) * Y.length);
    const c = this.add('walker', X[nx]!, Y[ny]!, {
      variant: Math.floor(hash2(this.townSeed, i, 3, 777) * COSMETIC_OUTFITS),
    });
    c.node = [nx, ny];
    c.tx = c.x;
    c.ty = c.y;
    c.st = 'idle';
    c.t = Math.random() * 3;
  }

  /** Road centre lines: streets (Y) and avenues/lanes (X), matching the generator in shared/town.ts. */
  private roadGrid(t: Town): [number[], number[]] {
    return [
      [t.cx - 36, t.cx - 16, t.cx, t.cx + 17, t.cx + 36],
      [t.cy - 17, t.cy - 7, t.cy + 3, t.cy + 17],
    ];
  }
  private avenue(ix: number): boolean {
    return ix === 1 || ix === 2 || ix === 3;
  }

  // ───────────────────────── creation ─────────────────────────

  private add(
    kind: Crit['kind'],
    x: number,
    y: number,
    o: Partial<Pick<Crit, 'z' | 'vx' | 'vy' | 'variant' | 'ttl' | 'home'>> = {},
  ): Crit {
    const art = this.art!;
    const root = new Container();
    const sp = new Sprite(kind === 'firefly' ? art.glow : this.tex(kind, 0, o.variant ?? 0));
    sp.anchor.set(0.5, kind === 'butterfly' || kind === 'bird' || kind === 'firefly' ? 0.5 : 0.92);
    let shadow: Graphics | null = null;
    if (kind !== 'firefly' && kind !== 'fish') {
      shadow = new Graphics();
      root.addChild(shadow);
    }
    root.addChild(sp);
    if (kind === 'firefly') sp.blendMode = 'add';
    this.d.layer().addChild(root);
    const c: Crit = {
      kind,
      root,
      sp,
      shadow,
      x,
      y,
      z: o.z ?? 0,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      face: Math.random() < 0.5 ? 1 : -1,
      t: 0,
      ttl: o.ttl ?? 0,
      phase: Math.random() * 6.28,
      st: 'idle',
      tx: x,
      ty: y,
      home: o.home ?? null,
      variant: o.variant ?? 0,
    };
    if (kind === 'butterfly') sp.tint = [0xffd36a, 0xff9ac8, 0x9ad0ff, 0xc8a0ff][c.variant % 4]!;
    if (kind === 'chicken') sp.tint = [0xffffff, 0xffe0b0, 0xe8c090, 0xffffff, 0xd0d0e0][c.variant % 5]!;
    if (kind === 'cat') sp.tint = c.variant ? 0xd0d0d8 : 0xffffff;
    if (kind === 'walker') sp.anchor.set(0.5, 31 / 32);
    this.crits.push(c);
    this.place(c);
    return c;
  }

  private tex(kind: Crit['kind'], frame: number, variant: number) {
    const a = this.art!;
    switch (kind) {
      case 'chicken':
        return a.chicken[frame % 4]!;
      case 'cat':
        return a.cat[frame % 4]!;
      case 'dog':
        return a.dog[frame % 4]!;
      case 'pigeon':
        return a.pigeon[frame % 4]!;
      case 'butterfly':
        return a.butterfly[frame % 2]!;
      case 'bird':
        return a.bird[frame % 3]!;
      case 'fish':
        return a.fish[frame % 3]!;
      case 'walker':
        return this.d.sheets().person(variant, 0, frame);
      default:
        return a.glow;
    }
  }

  private place(c: Crit): void {
    c.root.x = Math.round(isoX(c.x, c.y));
    c.root.y = Math.round(isoY(c.x, c.y));
    c.root.zIndex = depth(c.x, c.y) + (c.z > 20 ? 400 : 0);
    c.sp.y = -Math.round(c.z) + (c.kind === 'butterfly' || c.kind === 'bird' || c.kind === 'firefly' ? 0 : 1);
    if (c.shadow) {
      c.shadow.clear();
      const big = c.kind === 'dog' ? 7 : c.kind === 'walker' ? 5 : c.kind === 'bird' ? 3 : 4;
      const a = Math.max(0.05, 0.26 - c.z * 0.004);
      c.shadow
        .ellipse(c.kind === 'bird' ? 0 : 0, c.kind === 'bird' ? 2 : 0, big * (1 - Math.min(0.5, c.z * 0.01)), big * 0.5)
        .fill({ color: 0x2a1060, alpha: a });
    }
  }

  // ───────────────────────── behaviour ─────────────────────────

  private blocked(x: number, y: number): boolean {
    return this.d.store().solidAt(Math.floor(x), Math.floor(y));
  }

  private moveTo(c: Crit, dt: number, speed: number): boolean {
    const dx = c.tx - c.x,
      dy = c.ty - c.y,
      d = Math.hypot(dx, dy);
    if (d < 0.08) return true;
    const s = Math.min(d, speed * dt),
      nx = c.x + (dx / d) * s,
      ny = c.y + (dy / d) * s;
    if (this.blocked(nx, ny)) return true; // give up; the caller picks a new goal
    c.x = nx;
    c.y = ny;
    if (Math.abs(dx - dy) > 0.01) c.face = dx - dy >= 0 ? 1 : -1; // screen-x of the heading
    return false;
  }

  private wander(c: Crit, r: number): void {
    const h = c.home!;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2,
        d = Math.random() * r;
      const x = h.x + Math.cos(a) * d,
        y = h.y + Math.sin(a) * d;
      if (!this.blocked(x, y)) {
        c.tx = x;
        c.ty = y;
        return;
      }
    }
    c.tx = c.x;
    c.ty = c.y;
  }

  private step(c: Crit, f: AmbientFrame, day: boolean): void {
    const dt = f.dt,
      now = f.now / 1000;
    c.t += dt;
    const art = this.art!;
    const pd = Math.hypot(c.x - f.me.x, c.y - f.me.y);
    const ws = windScreenX(f.wind);
    switch (c.kind) {
      case 'butterfly': {
        // wander, drift downwind, and bolt when approached
        const flee = pd < 2.4;
        c.vx += (Math.random() - 0.5) * 3 * dt + f.wind.dx * 0.5 * dt;
        c.vy += (Math.random() - 0.5) * 3 * dt + f.wind.dy * 0.5 * dt;
        if (flee) {
          c.vx += ((c.x - f.me.x) / (pd || 1)) * 6 * dt;
          c.vy += ((c.y - f.me.y) / (pd || 1)) * 6 * dt;
        }
        const sp = Math.hypot(c.vx, c.vy),
          max = flee ? 2.6 : 1.0;
        if (sp > max) {
          c.vx = (c.vx / sp) * max;
          c.vy = (c.vy / sp) * max;
        }
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.z = 11 + Math.sin(c.t * 2.1 + c.phase) * 4 + (flee ? 4 : 0);
        c.sp.texture = art.butterfly[Math.floor(c.t * (flee ? 14 : 9) + c.phase) % 2]!;
        c.sp.scale.x = c.vx - c.vy >= 0 ? 1 : -1;
        if (!day || f.weather === 'rain' || f.weather === 'storm') c.ttl = Math.min(c.ttl || 1, c.t + 1.5);
        break;
      }
      case 'firefly': {
        c.vx += (Math.random() - 0.5) * 1.6 * dt;
        c.vy += (Math.random() - 0.5) * 1.6 * dt;
        const sp = Math.hypot(c.vx, c.vy);
        if (sp > 0.45) {
          c.vx = (c.vx / sp) * 0.45;
          c.vy = (c.vy / sp) * 0.45;
        }
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.z = 10 + Math.sin(c.t * 0.9 + c.phase) * 6;
        const on = 0.5 + 0.5 * Math.sin(c.t * 2.2 + c.phase * 3);
        c.sp.alpha = on * on * (c.t < 1.5 ? c.t / 1.5 : 1) * (c.ttl && c.ttl - c.t < 1.5 ? (c.ttl - c.t) / 1.5 : 1);
        c.sp.scale.set(0.8 + 0.4 * on);
        break;
      }
      case 'bird': {
        c.x += c.vx * dt;
        c.y += c.vy * dt + Math.sin(c.t * 1.3 + c.variant) * 0.15 * dt;
        c.sp.texture = art.bird[Math.floor(c.t * 7 + c.variant) % 3]!;
        c.sp.scale.x = c.vx - c.vy >= 0 ? 1 : -1;
        c.z = 70 + Math.sin(c.t * 0.8 + c.variant) * 4;
        break;
      }
      case 'fish': {
        const k = Math.min(1, c.t / 0.9);
        c.z = Math.sin(k * Math.PI) * 11;
        c.sp.texture = art.fish[k < 0.33 ? 0 : k < 0.66 ? 1 : 2]!;
        if (c.t < dt * 1.5) this.d.fx().ring(c.x, c.y, 46, 0.7);
        if (k >= 1) {
          this.d.fx().ring(c.x, c.y, 46, 0.9);
          c.ttl = c.t;
        }
        break;
      }
      case 'chicken':
      case 'cat':
      case 'dog':
      case 'pigeon':
        this.animal(c, f, day, pd, now);
        break;
      case 'walker':
        this.walker(c, f, day, pd);
        break;
    }
    c.sp.scale.x = c.kind === 'butterfly' || c.kind === 'bird' ? c.sp.scale.x : c.face * (c.sp.scale.y || 1);
    this.place(c);
  }

  private animal(c: Crit, f: AmbientFrame, day: boolean, pd: number, now: number): void {
    const art = this.art!,
      dt = f.dt;
    const asleep = !day && (c.kind === 'cat' || c.kind === 'dog');
    // chickens roost at night; everyone else sleeps or sits
    c.root.visible =
      !(c.kind === 'chicken' && (f.hour >= 20 || f.hour < 5.5)) &&
      !(c.kind === 'pigeon' && (f.hour >= 21.5 || f.hour < 5));
    if (!c.root.visible) return;
    const scare = c.kind === 'pigeon' ? 3.2 : c.kind === 'chicken' ? 2.2 : c.kind === 'cat' ? 1.6 : 0;
    if (pd < scare && c.st !== 'fly') {
      c.st = c.kind === 'pigeon' ? 'fly' : 'walk';
      const a = Math.atan2(c.y - f.me.y, c.x - f.me.x) + (Math.random() - 0.5);
      const dist = c.kind === 'pigeon' ? 5 + Math.random() * 3 : 3.5;
      c.tx = c.x + Math.cos(a) * dist;
      c.ty = c.y + Math.sin(a) * dist;
      c.t = 0;
      if (this.blocked(c.tx, c.ty)) {
        c.tx = c.x;
        c.ty = c.y;
      }
    }
    if (c.st === 'fly') {
      const done = this.moveTo(c, dt, 4.5);
      c.z = Math.min(16, c.z + 40 * dt) * (done ? 0.6 : 1) + (done ? 0 : Math.sin(c.t * 14) * 0.4);
      c.sp.texture = art.pigeon[2 + (Math.floor(c.t * 14) % 2)]!;
      if (done) {
        c.z = Math.max(0, c.z - 50 * dt);
        if (c.z <= 0.2) {
          c.z = 0;
          c.st = 'idle';
          c.t = 0;
        }
      }
      return;
    }
    c.z = 0;
    if (c.st === 'walk') {
      const sp = c.kind === 'dog' ? 1.6 : c.kind === 'chicken' ? 1.1 : c.kind === 'cat' ? 1.3 : 0.7;
      const run = pd < scare + 0.5 ? 2.2 : 1;
      const done = this.moveTo(c, dt, sp * run);
      const fr = 1 + (Math.floor(c.t * (c.kind === 'chicken' ? 6 : 7) * run) % 2);
      c.sp.texture =
        c.kind === 'chicken'
          ? (art.chicken[1 + fr] ?? art.chicken[2]!)
          : c.kind === 'pigeon'
            ? art.pigeon[1]!
            : c.kind === 'cat'
              ? art.cat[fr]!
              : art.dog[fr]!;
      if (done) {
        c.st = 'idle';
        c.t = 0;
        c.ttl = 0;
      }
    } else {
      // idle: chickens peck, cats sit/sleep, dogs sit, pigeons shuffle
      const pause = c.kind === 'cat' ? 6 : 3;
      c.sp.texture =
        c.kind === 'chicken'
          ? art.chicken[Math.floor(now * 2 + c.phase) % 3 === 0 ? 1 : 0]!
          : c.kind === 'cat'
            ? art.cat[asleep ? 3 : 0]!
            : c.kind === 'dog'
              ? art.dog[asleep ? 3 : pd < 3 ? 0 : 3]!
              : art.pigeon[Math.floor(now * 1.5 + c.phase) % 4 === 0 ? 1 : 0]!;
      if (c.t > pause * (0.5 + hash2(Math.floor(c.phase * 100), Math.floor(now / 3), 1, 5)) && !asleep && c.home) {
        this.wander(c, c.home.r);
        c.st = 'walk';
        c.t = 0;
      }
    }
  }

  private walker(c: Crit, f: AmbientFrame, day: boolean, pd: number): void {
    const t = this.town!,
      [X, Y] = this.roadGrid(t);
    const sheets = this.d.sheets();
    if (c.st === 'idle') {
      c.t -= 0; // c.t counts up; idle until its pause is over
      if (c.t > 1.5 + (c.phase % 3)) {
        // choose the next road node: along streets always, along avenues only at avenue columns
        const [ix, iy] = c.node!;
        const opts: Array<[number, number]> = [];
        if (ix > 0) opts.push([ix - 1, iy]);
        if (ix < X.length - 1) opts.push([ix + 1, iy]);
        if (this.avenue(ix) && iy > 0) opts.push([ix, iy - 1]);
        if (this.avenue(ix) && iy < Y.length - 1) opts.push([ix, iy + 1]);
        const [nx, ny] = opts[Math.floor(Math.random() * opts.length)]!;
        c.node = [nx, ny];
        c.tx = X[nx]! + (Math.random() - 0.5) * 0.8;
        c.ty = Y[ny]! + (Math.random() - 0.5) * 0.8;
        c.st = 'walk';
        c.t = 0;
      }
    }
    let frame = 0;
    if (c.st === 'walk') {
      const speed = f.weather === 'rain' ? 1.8 : 1.25;
      const done = this.moveTo(c, f.dt, speed);
      frame = 1 + (Math.floor(c.t * 7) % (WALK_FRAMES - 1));
      if (done) {
        c.st = 'idle';
        c.t = Math.random() < 0.3 ? -3 : 0;
      }
    }
    // greet the player
    const bark = c.bark;
    if (!bark || bark.until < f.now) {
      c.bark = undefined;
      if (pd < 3.2 && c.root.visible && Math.random() < 0.004) {
        const pool =
          f.hour >= 21 || f.hour < 5
            ? BARKS.night!
            : f.weather === 'rain' || f.weather === 'storm'
              ? BARKS.rain!
              : f.weather === 'snow'
                ? BARKS.snow!
                : BARKS.clear!;
        c.bark = { text: pool[Math.floor(Math.random() * pool.length)]!, until: f.now + 3200 };
        c.st = 'idle';
        c.t = 0;
      }
    }
    const heading = c.st === 'walk' ? { x: c.tx - c.x, y: c.ty - c.y } : { x: f.me.x - c.x, y: f.me.y - c.y };
    const sd = screenDir(heading.x, heading.y);
    c.sp.texture = sheets.person(c.variant, dirOf(sd.x, sd.y), frame);
    c.sp.scale.set(1);
    c.face = 1;
    c.shadow && (c.shadow.visible = true);
    void day;
  }

  // ───────────────────────── speech bubbles ─────────────────────────

  private bubblesFrame(f: AmbientFrame): void {
    const talkers = this.crits.filter((c) => c.bark && c.root.visible);
    while (this.bubbles.length < talkers.length) {
      const t = new Text({
        text: '',
        style: {
          fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
          fontSize: 11,
          fontWeight: 'bold',
          fill: 0xfff6dc,
          stroke: { color: 0x2a1c10, width: 3 },
          wordWrap: true,
          wordWrapWidth: 150,
          align: 'center',
        },
      });
      t.anchor.set(0.5, 1);
      this.d.labels().addChild(t);
      this.bubbles.push(t);
    }
    this.bubbles.forEach((b, i) => {
      const c = talkers[i];
      b.visible = !!c;
      if (!c) return;
      const p = this.d.toScreen(c.x, c.y);
      if (b.text !== c.bark!.text) b.text = c.bark!.text;
      b.x = Math.round(p.x);
      b.y = Math.round(p.y - 74);
      b.alpha = Math.min(1, (c.bark!.until - f.now) / 400);
    });
  }
}
