import { Graphics, Sprite } from 'pixi.js';
import { hash2, type Weather } from '@eigenlands/shared';
import { dirOf } from '../art/actors';
import { actionFrame, type PersonAction } from '../art/person-actions';
import type { HeldId, HeldWeapons } from '../art/weapons';
import { SCENE_TALK, sceneSheltered, type Scene } from './scenes';
import { screenDir } from './iso';

/**
 * Animates the everyday scenes planned in scenes.ts. Each scene owns its people (ordinary WorldLife actors with a
 * `sc` field) and, where it has one, a prop: a washing line, a chopping block and log pile, a bench's birds. Visual
 * only, like the rest of the street life: nothing collides, nothing is synced.
 */

/** the slice of a WorldLife actor the scenes drive */
export interface SceneActor {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  t: number;
  dir: number;
  phase: number;
  st: 'idle' | 'walk' | 'work' | 'flee' | 'fly';
  body: Sprite;
  root: {
    visible: boolean;
    addChild: (c: Graphics | Sprite) => unknown;
    setChildIndex: (c: Sprite, i: number) => void;
  };
  bark?: { text: string; until: number };
  sc?: Scene;
  /** which part this actor plays: 0 the main person, 1 a second person, 2+ children/pets */
  part?: number;
  /** step within the scene's loop */
  beat?: number;
  /** what is carried or held, drawn at the hands */
  carry?: Graphics;
  heldSprite?: Sprite;
  /** 'cat' | 'dog' | 'pigeon' | 'prop' for non-people */
  animal?: string;
  /** a walk around buildings: tile waypoints toward `goal` */
  path?: Array<[number, number]>;
  goal?: string;
  face: number;
}

export interface SceneDeps {
  tex: (a: SceneActor, dir: number, frame: number) => SceneActor['body']['texture'];
  moveTo: (a: SceneActor, dt: number, speed: number) => boolean;
  say: (a: SceneActor, text: string, now: number) => void;
  walkFrame: (a: SceneActor, speed: number) => number;
  burst: (x: number, y: number, colors: number[], n: number) => void;
  ring: (x: number, y: number, color: number, r: number, life: number) => void;
  sound: (s: 'chop' | 'splash' | 'lute' | 'sweep' | 'coin', x: number, y: number) => void;
  held: () => HeldWeapons | null;
  art: () => {
    cat: SceneActor['body']['texture'][];
    dog: SceneActor['body']['texture'][];
    pigeon: SceneActor['body']['texture'][];
  } | null;
  /** every scene actor of the settlement (pets look for each other) */
  all: () => SceneActor[];
  /** a tile route around solid ground, or null */
  findPath: (sx: number, sy: number, tx: number, ty: number) => Array<[number, number]> | null;
}

export interface SceneFrame {
  now: number;
  dt: number;
  hour: number;
  weather: Weather;
  reduced: boolean;
  me: { x: number; y: number };
}

/** tile offset → iso pixel offset */
const ix = (dx: number, dy: number) => (dx - dy) * 16;
const iy = (dx: number, dy: number) => (dx + dy) * 8;
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

export function sceneOut(sc: Scene, hour: number, weather: string): boolean {
  const [a, b] = sc.hours;
  return hour >= a && hour < b && !sceneSheltered(sc.kind, weather);
}

/** A per-scene clock in [0, 1) so related actors keep time with each other. */
const loop = (now: number, secs: number, seed: number) => (now / 1000 / secs + (seed % 997) / 997) % 1;

export class SceneLife {
  constructor(private d: SceneDeps) {}

  /** one actor's frame; returns false when the actor should be hidden */
  step(a: SceneActor, f: SceneFrame): boolean {
    const sc = a.sc!;
    if (a.animal === 'prop') {
      this.prop(a, f);
      return true;
    }
    if (!sceneOut(sc, f.hour, f.weather)) return false;
    switch (sc.kind) {
      case 'well':
        this.well(a, f);
        break;
      case 'laundry':
        this.laundry(a, f);
        break;
      case 'woodchop':
        this.woodchop(a, f);
        break;
      case 'sweep':
        this.sweep(a, f);
        break;
      case 'chat':
        this.chat(a, f);
        break;
      case 'kids':
        this.kids(a, f);
        break;
      case 'bench':
        if (a.animal === 'pigeon') this.pigeon(a, f);
        else this.bench(a, f);
        break;
      case 'porter':
        this.porter(a, f);
        break;
      case 'busker':
        this.busker(a, f);
        break;
      case 'cat':
        this.cat(a, f);
        break;
      case 'dog':
        this.dog(a, f);
        break;
      case 'garden':
        this.garden(a, f);
        break;
      case 'lamplighter':
        this.lamplighter(a, f);
        break;
    }
    return true;
  }

  // ───────────── helpers ─────────────

  private pose(a: SceneActor, action: PersonAction, progress: number, f: SceneFrame, dir = a.dir): void {
    a.body.texture = this.d.tex(a, dir, actionFrame(action, progress, f.reduced));
    this.hold(a, dir, actionFrame(action, progress, f.reduced));
  }
  private stand(a: SceneActor, dir = a.dir): void {
    a.body.texture = this.d.tex(a, dir, 0);
    this.hold(a, dir, 0);
  }
  /** walk to (a.tx, a.ty), around houses rather than through them */
  private walk(a: SceneActor, f: SceneFrame, speed: number): boolean {
    const gx = a.tx,
      gy = a.ty,
      goal = `${gx.toFixed(2)},${gy.toFixed(2)}`;
    if (a.goal !== goal) {
      a.goal = goal;
      a.path = this.d.findPath(Math.floor(a.x), Math.floor(a.y), Math.floor(gx), Math.floor(gy)) ?? undefined;
      a.path?.shift();
      if (!a.path) {
        // nowhere to walk (a blocked yard): step straight there out of sight of nobody's business
        a.x = gx;
        a.y = gy;
      }
    }
    if (a.path && a.path.length > 1) {
      const [px, py] = a.path[0]!;
      a.tx = px + 0.5;
      a.ty = py + 0.5;
      if (Math.hypot(a.tx - a.x, a.ty - a.y) < 0.35) a.path.shift();
    }
    const done = this.d.moveTo(a, f.dt, speed);
    a.tx = gx;
    a.ty = gy;
    const arrived = Math.hypot(gx - a.x, gy - a.y) < 0.15 || (done && (!a.path || a.path.length <= 1));
    const fr = this.d.walkFrame(a, speed);
    a.body.texture = this.d.tex(a, a.dir, fr);
    this.hold(a, a.dir, fr);
    if (arrived) a.goal = undefined;
    return arrived;
  }
  /** a straight dash for moving targets (children at tag): no route search every frame */
  private run(a: SceneActor, f: SceneFrame, speed: number): boolean {
    const done = this.d.moveTo(a, f.dt, speed);
    const fr = this.d.walkFrame(a, speed);
    a.body.texture = this.d.tex(a, a.dir, fr);
    return done;
  }
  private faceTo(a: SceneActor, x: number, y: number): void {
    const s = screenDir(x - a.x, y - a.y);
    a.dir = dirOf(s.x, s.y);
  }
  /** the tool in hand (axe, can) follows the body's grip at every pose */
  private hold(a: SceneActor, dir: number, frame: number): void {
    const id = a.heldSprite ? ((a.heldSprite as unknown as { id?: HeldId }).id ?? null) : null;
    const held = this.d.held();
    if (!a.heldSprite || !id || !held) return;
    a.heldSprite.texture = held.texture(id, dir, frame);
    a.heldSprite.y = a.body.y;
    a.root.setChildIndex(a.heldSprite, dir === 1 || dir >= 6 ? 1 : 2);
  }
  private chatter(a: SceneActor, f: SceneFrame, pool: string, odds = 0.004): void {
    const pd = Math.hypot(a.x - f.me.x, a.y - f.me.y);
    if (!a.bark && pd < 7 && Math.random() < odds) this.d.say(a, pick(SCENE_TALK[pool]!), f.now);
  }
  private carryDraw(a: SceneActor, what: 'bucket' | 'sack' | 'none' | 'broom' | 'pole' | 'lute', k = 0): void {
    const g = a.carry;
    if (!g) return;
    g.clear();
    // villagers are 32×48: hands hang at about y -20, shoulders at -34, the head tops out near -46; small people scale
    const m = a.body.scale.y;
    const Y = (y: number) => y * m,
      X = (x: number) => x * m;
    if (what === 'bucket')
      g.poly([X(6), Y(-20), X(13), Y(-20), X(12), Y(-12), X(7), Y(-12)])
        .fill(0x6b4a2a)
        .rect(X(6), Y(-20), X(7), 1.5)
        .fill(0x9aa4a8)
        .rect(X(7), Y(-19), X(5), 1)
        .fill(0x4a8ac2)
        .moveTo(X(6), Y(-20))
        .quadraticCurveTo(X(9.5), Y(-26), X(13), Y(-20))
        .stroke({ color: 0x46565b, width: 1 });
    else if (what === 'sack')
      g.ellipse(X(-3), Y(-38), X(9), Y(5.5))
        .fill(0xcbb48a)
        .ellipse(X(-4), Y(-40), X(6), Y(3))
        .fill(0xe1d0a6)
        .rect(X(-12), Y(-39), 3, 4)
        .fill(0x8a6a40);
    else if (what === 'broom') {
      const sw = Math.sin(k) * 5;
      g.moveTo(X(4), Y(-24))
        .lineTo(X(8) + sw, 0)
        .stroke({ color: 0x8a6034, width: 1.6 })
        .poly([X(4) + sw, 1, X(13) + sw, 1, X(11) + sw, -5, X(6) + sw, -5])
        .fill(0xc8a14a);
    } else if (what === 'pole')
      g.moveTo(X(6), Y(-20))
        .lineTo(X(13), Y(-64 - k * 5))
        .stroke({ color: 0x6b4a2a, width: 1.6 })
        .circle(X(13), Y(-65 - k * 5), 2)
        .fill(0xffd36a);
    else if (what === 'lute')
      g.ellipse(X(2), Y(-21), X(6), Y(4.5))
        .fill(0x9a5a2a)
        .ellipse(X(1), Y(-22), X(3), Y(2))
        .fill(0xaf6a3a)
        .circle(X(2), Y(-21), 1.3)
        .fill(0x2a1a10)
        .moveTo(X(6), Y(-23))
        .lineTo(X(15), Y(-31 - k))
        .stroke({ color: 0x6b4a2a, width: 1.8 });
  }

  // ───────────── scenes ─────────────

  /** walk to the well, wind up a bucket, carry it home, come back for more */
  private well(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    a.beat ??= 0;
    if (a.beat === 0) {
      a.tx = sc.x;
      a.ty = sc.y;
      this.carryDraw(a, 'none');
      if (this.walk(a, f, 1.1)) ((a.beat = 1), (a.t = 0));
    } else if (a.beat === 1) {
      this.faceTo(a, sc.x, sc.y - 1);
      const k = (a.t % 1.1) / 1.1;
      this.pose(a, 'gather', k, f);
      if (a.t > 3.3) {
        a.beat = 2;
        a.t = 0;
        this.d.ring(sc.x, sc.y - 1, 29, 0.8, 0.5);
        if (Math.hypot(a.x - f.me.x, a.y - f.me.y) < 10) this.d.sound('splash', sc.x, sc.y);
        this.chatter(a, f, 'well', 0.5);
      }
    } else if (a.beat === 2) {
      a.tx = sc.x2;
      a.ty = sc.y2;
      this.carryDraw(a, 'bucket');
      if (this.walk(a, f, 0.85)) ((a.beat = 3), (a.t = 0));
    } else {
      // set the bucket down inside and linger a moment
      this.carryDraw(a, 'none');
      this.stand(a);
      if (a.t > 3 + (sc.seed % 4)) a.beat = 0;
    }
  }

  /** scrub at the tub, then peg each piece along the line */
  private laundry(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    a.beat ??= 0;
    if (a.beat === 0) {
      a.tx = sc.x;
      a.ty = sc.y + 0.6;
      if (this.walk(a, f, 0.9)) ((a.beat = 1), (a.t = 0));
    } else if (a.beat === 1) {
      this.pose(a, 'craft', (a.t % 1.2) / 1.2, f, dirOf(0, 1));
      if (a.t > 4) ((a.beat = 2), (a.t = 0));
    } else if (a.beat === 2) {
      const k = Math.min(1, ((sc.seed + Math.floor(f.now / 9000)) % 4) / 3);
      a.tx = sc.x + (sc.x2 - sc.x) * k;
      a.ty = sc.y + 0.4;
      if (this.walk(a, f, 0.9)) ((a.beat = 3), (a.t = 0));
    } else {
      this.faceTo(a, a.x, a.y - 1);
      this.pose(a, 'gather', 0.3 + 0.2 * Math.sin(a.t * 3), f);
      if (a.t > 2.4) {
        a.beat = 0;
        this.chatter(a, f, 'laundry', 0.3);
      }
    }
  }

  /** split a log on the block, stack the halves, fetch the next */
  private woodchop(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    a.beat ??= 0;
    if (a.beat === 0) {
      a.tx = sc.x - 0.6;
      a.ty = sc.y + 0.5;
      if (this.walk(a, f, 1)) ((a.beat = 1), (a.t = 0));
      return;
    }
    if (a.beat === 1) {
      this.faceTo(a, sc.x + 0.5, sc.y);
      const cyc = 1.25,
        k = (a.t % cyc) / cyc;
      this.pose(a, 'chop', k, f);
      const strike = Math.floor(a.t / cyc);
      if (strike !== (a as { lastStrike?: number } & SceneActor).lastStrike && k > 0.4) {
        (a as { lastStrike?: number } & SceneActor).lastStrike = strike;
        if (!f.reduced) this.d.burst(sc.x + 0.3, sc.y, [20, 21, 22], 4);
        if (Math.hypot(a.x - f.me.x, a.y - f.me.y) < 12) this.d.sound('chop', sc.x, sc.y);
      }
      if (a.t > cyc * 5) {
        a.beat = 2;
        a.t = 0;
        this.chatter(a, f, 'woodchop', 0.25);
      }
      return;
    }
    // stack the split wood on the pile
    a.tx = sc.x + 1.6;
    a.ty = sc.y - 0.4;
    if (a.beat === 2 && this.walk(a, f, 0.9)) ((a.beat = 3), (a.t = 0));
    if (a.beat === 3) {
      this.pose(a, 'gather', Math.min(1, a.t / 1.5), f);
      if (a.t > 1.6) a.beat = 0;
    }
  }

  /** sweep the doorstep in the morning, a stroke at a time */
  private sweep(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    const k = loop(f.now, 6, sc.seed);
    a.tx = sc.x + Math.sin(k * Math.PI * 2) * 1.2;
    a.ty = sc.y + 0.3 + Math.cos(k * Math.PI * 4) * 0.3;
    this.d.moveTo(a, f.dt, 0.5);
    const stroke = f.reduced ? 0 : f.now / 180 + a.phase;
    this.stand(a, dirOf(Math.cos(k * Math.PI * 2), 0.7));
    this.carryDraw(a, 'broom', stroke);
    if (!f.reduced && Math.sin(stroke) > 0.97) {
      this.d.burst(a.x + 0.4, a.y + 0.3, [5, 6], 2);
      if (Math.random() < 0.15 && Math.hypot(a.x - f.me.x, a.y - f.me.y) < 8) this.d.sound('sweep', a.x, a.y);
    }
    this.chatter(a, f, 'sweep', 0.003);
  }

  /** two neighbours at a door: one tells, the other reacts */
  private chat(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    const me = a.part === 1 ? { x: sc.x2, y: sc.y2 } : { x: sc.x, y: sc.y };
    const other = a.part === 1 ? { x: sc.x, y: sc.y } : { x: sc.x2, y: sc.y2 };
    a.tx = me.x;
    a.ty = me.y;
    if (Math.hypot(a.x - me.x, a.y - me.y) > 0.2) {
      this.walk(a, f, 0.9);
      return;
    }
    this.faceTo(a, other.x, other.y);
    // a story told in turns: 9 s each way
    const k = loop(f.now, 18, sc.seed);
    const speaking = k < 0.5 === (a.part !== 1);
    if (speaking) this.pose(a, 'talk', (f.now / 900 + a.phase) % 1, f);
    else this.stand(a);
    const pd = Math.hypot(a.x - f.me.x, a.y - f.me.y);
    const line = Math.floor(f.now / 18000 + (sc.seed % 6));
    const beatKey = `${line}:${k < 0.5 ? 0 : 1}`;
    if (speaking && pd < 9 && (a as { said?: string } & SceneActor).said !== beatKey) {
      (a as { said?: string } & SceneActor).said = beatKey;
      const pool = a.part === 1 ? SCENE_TALK.chatB! : SCENE_TALK.chatA!;
      this.d.say(a, pool[line % pool.length]!, f.now);
    }
  }

  /** children playing tag around the square */
  private kids(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    const crew = this.d.all().filter((o) => o.sc === sc && o.root.visible);
    const it = Math.floor(loop(f.now, 7 * crew.length, sc.seed) * crew.length);
    const idx = crew.indexOf(a);
    if (idx === it) {
      // "it" chases the nearest friend
      let best: SceneActor | null = null,
        bd = 99;
      for (const o of crew)
        if (o !== a) {
          const d = Math.hypot(o.x - a.x, o.y - a.y);
          if (d < bd) ((bd = d), (best = o));
        }
      if (best) ((a.tx = best.x), (a.ty = best.y));
      if (bd < 0.7) this.chatter(a, f, 'kids', 0.3);
      this.run(a, f, 2.1);
      return;
    }
    const chaser = crew[it];
    const d = chaser ? Math.hypot(chaser.x - a.x, chaser.y - a.y) : 99;
    if (chaser && d < 3.5) {
      const ang = Math.atan2(a.y - chaser.y, a.x - chaser.x) + Math.sin(f.now / 700 + a.phase) * 0.8;
      a.tx = a.x + Math.cos(ang) * 2;
      a.ty = a.y + Math.sin(ang) * 2;
      // stay within the square
      if (Math.hypot(a.tx - sc.x, a.ty - sc.y) > 5) ((a.tx = sc.x), (a.ty = sc.y));
      this.run(a, f, 1.9);
      this.chatter(a, f, 'kids', 0.006);
    } else {
      // catch a breath, hopping on the spot
      this.stand(a);
      a.z = f.reduced ? 0 : Math.abs(Math.sin(f.now / 160 + a.phase)) * 2;
    }
    // called in for supper in the last half hour
    if (f.hour > sc.hours[1] - 0.5 && idx === 0) this.chatter(a, f, 'supper', 0.01);
  }

  /** an elder on the bench, now and then tossing crumbs to the pigeons */
  private bench(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    a.tx = sc.x + (a.part === 1 ? 0.8 : 0);
    a.ty = sc.y;
    a.x = a.tx;
    a.y = a.ty;
    this.pose(a, 'sit', 0.5, f, dirOf(0.2, 1));
    if (!f.reduced && Math.random() < 0.004 && a.part !== 1) this.d.burst(sc.x + 0.6, sc.y + 1.4, [22, 23], 3);
    this.chatter(a, f, 'bench', 0.002);
  }
  private pigeon(a: SceneActor, f: SceneFrame): void {
    const art = this.d.art();
    if (!art) return;
    const sc = a.sc!;
    const pd = Math.hypot(a.x - f.me.x, a.y - f.me.y);
    if (pd < 1.6) {
      // flutter off and settle again a little further on
      a.tx = sc.x + (Math.random() - 0.5) * 3;
      a.ty = sc.y + 1.5 + Math.random() * 1.5;
      a.z = 4;
    }
    const done = this.d.moveTo(a, f.dt, pd < 1.6 ? 3 : 0.6);
    a.z = Math.max(0, a.z - f.dt * 8);
    a.body.texture = done ? art.pigeon[Math.floor(f.now / 400 + a.phase) % 3 === 0 ? 1 : 0]! : art.pigeon[1]!;
    if (done && Math.random() < 0.01) {
      a.tx = sc.x + (Math.random() - 0.3) * 2.4;
      a.ty = sc.y + 1.2 + Math.random() * 1.2;
    }
    a.body.scale.x = a.tx >= a.x ? 1 : -1;
  }

  /** hauling sacks from the cart to the shop and walking back for the next */
  private porter(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    a.beat ??= 0;
    const loaded = a.beat === 1;
    a.tx = loaded ? sc.x2 : sc.x;
    a.ty = loaded ? sc.y2 : sc.y;
    if (a.beat === 0 || a.beat === 1) {
      this.carryDraw(a, loaded ? 'sack' : 'none');
      if (this.walk(a, f, loaded ? 0.75 : 1.15)) {
        a.beat = loaded ? 3 : 2;
        a.t = 0;
        if (loaded) this.chatter(a, f, 'porter', 0.4);
      }
    } else {
      // lift the next sack, or set this one down
      this.pose(a, 'gather', Math.min(1, a.t / 1.4), f);
      if (a.t > 1.5) {
        this.carryDraw(a, a.beat === 2 ? 'sack' : 'none');
        a.beat = a.beat === 2 ? 1 : 0;
      }
    }
  }

  /** a busker on the square: a phrase on the lute, notes in the air, a coin now and then */
  private busker(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    a.x = a.tx = sc.x;
    a.y = a.ty = sc.y;
    this.stand(a, dirOf(0.4, 1));
    const strum = f.reduced ? 0 : Math.sin(f.now / 120) > 0 ? 1 : 0;
    this.carryDraw(a, 'lute', strum);
    a.z = f.reduced ? 0 : Math.max(0, Math.sin(f.now / 400 + a.phase)) * 0.8;
    const pd = Math.hypot(a.x - f.me.x, a.y - f.me.y);
    const phrase = Math.floor(f.now / 2600);
    const ref = a as { phrase?: number } & SceneActor;
    if (ref.phrase !== phrase) {
      ref.phrase = phrase;
      if (pd < 11) this.d.sound('lute', sc.x, sc.y);
      if (!f.reduced) this.d.burst(sc.x + 0.3, sc.y - 1, [22, 7], 2);
      if (Math.random() < 0.12 && pd < 9) {
        this.d.sound('coin', sc.x, sc.y);
        this.d.say(a, SCENE_TALK.busker![2]!, f.now);
      } else this.chatter(a, f, 'busker', 0.08);
    }
  }

  /** a cat on the doorstep: sits, dozes in the midday sun, strolls, and bolts from dogs and strangers */
  private cat(a: SceneActor, f: SceneFrame): void {
    const art = this.d.art();
    if (!art) return;
    const sc = a.sc!;
    const dog = this.d.all().find((o) => o.animal === 'dog' && Math.hypot(o.x - a.x, o.y - a.y) < 4);
    const pd = Math.hypot(a.x - f.me.x, a.y - f.me.y);
    const threat = dog ?? (pd < 1.8 ? f.me : null);
    if (threat) {
      const ang = Math.atan2(a.y - threat.y, a.x - threat.x);
      a.tx = a.x + Math.cos(ang) * 3;
      a.ty = a.y + Math.sin(ang) * 3;
      a.st = 'fly'; // bolting (WorldLife reserves 'flee' for people running from monsters)
    }
    if (a.st === 'fly' || a.st === 'walk') {
      const done = this.d.moveTo(a, f.dt, a.st === 'fly' ? 3.2 : 0.7);
      a.body.texture = art.cat[1 + (Math.floor(f.now / 120) % 2)]!;
      a.body.scale.x = a.tx >= a.x ? 1 : -1;
      if (done) ((a.st = 'idle'), (a.t = 0));
      return;
    }
    const nap = f.hour > 11 && f.hour < 15 && f.weather === 'clear';
    a.body.texture = art.cat[nap ? 3 : 0]!;
    if (a.t > 9 + (sc.seed % 7)) {
      // stroll back toward the step
      a.tx = sc.x + (Math.random() - 0.5) * 2.5;
      a.ty = sc.y + Math.random() * 1.5;
      a.st = 'walk';
      a.t = 0;
    }
  }

  /** a dog: trots about the yard, sits by the door, and cannot resist a cat */
  private dog(a: SceneActor, f: SceneFrame): void {
    const art = this.d.art();
    if (!art) return;
    const sc = a.sc!;
    const cat = this.d.all().find((o) => o.animal === 'cat' && o.root.visible && Math.hypot(o.x - a.x, o.y - a.y) < 6);
    if (cat) {
      a.tx = cat.x;
      a.ty = cat.y;
      a.st = 'walk';
      if (!a.bark && Math.random() < 0.02) this.d.say(a, 'Woof! Woof!', f.now);
    }
    if (a.st === 'walk') {
      const fast = !!cat;
      const done = this.d.moveTo(a, f.dt, fast ? 2.6 : 1);
      a.body.texture = art.dog[1 + (Math.floor(f.now / (fast ? 90 : 160)) % 2)]!;
      a.body.scale.x = a.tx >= a.x ? 1 : -1;
      if (done || Math.hypot(a.x - sc.x, a.y - sc.y) > 9) {
        a.st = 'idle';
        a.t = 0;
      }
      return;
    }
    a.body.texture = art.dog[a.t > 3 ? 3 : 0]!;
    if (a.t > 6 + (sc.seed % 5)) {
      a.tx = sc.x + (Math.random() - 0.5) * 6;
      a.ty = sc.y + 0.5 + Math.random() * 3;
      a.st = 'walk';
      a.t = 0;
    }
  }

  /** watering the window boxes before the sun gets high */
  private garden(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    const k = loop(f.now, 16, sc.seed);
    const spot = k < 0.5 ? -1 : 1;
    a.tx = sc.x + spot * 1.3;
    a.ty = sc.y + 0.4;
    if (Math.hypot(a.x - a.tx, a.y - a.ty) > 0.15) {
      this.walk(a, f, 0.8);
      return;
    }
    this.faceTo(a, a.x, a.y - 1);
    this.pose(a, 'water', ((f.now / 1000) % 2) / 2, f);
    if (!f.reduced && Math.random() < 0.08) this.d.burst(a.x + 0.2, a.y - 0.6, [28, 29], 1);
    this.chatter(a, f, 'garden', 0.002);
  }

  /** at dusk, the lamplighter goes lamp to lamp with a long pole */
  private lamplighter(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!,
      route = sc.route!;
    a.beat ??= 0;
    const leg = Math.floor(a.beat / 2) % route.length;
    const [x, y] = route[leg]!;
    if (a.beat % 2 === 0) {
      a.tx = x;
      a.ty = y;
      this.carryDraw(a, 'pole', 0);
      if (this.walk(a, f, 1)) {
        a.beat++;
        a.t = 0;
      }
      return;
    }
    this.faceTo(a, x, y - 1);
    this.stand(a);
    this.carryDraw(a, 'pole', Math.min(1, a.t));
    if (a.t > 1.6) {
      if (!f.reduced) this.d.burst(x, y - 1, [22, 45], 5);
      if (leg === 0 || Math.random() < 0.2) this.chatter(a, f, 'lamplighter', 0.6);
      a.beat++;
      a.t = 0;
    }
  }

  // ───────────── props ─────────────

  /** what stands by a door: six everyday sets, each with a little seeded variety */
  private dressing(g: Graphics, set: number, seed: number): void {
    const flowers = [0xd06a5a, 0xf0c040, 0xc8a0d8, 0xf1efdb, 0xe88aa8][seed % 5]!;
    switch (set) {
      case 0: // a pair of flower pots
        pot(g, -5, 0, flowers);
        pot(g, 5, 3, [0xd06a5a, 0xf0c040, 0xc8a0d8][(seed >> 3) % 3]!);
        break;
      case 1: // a barrel and a crate
        barrel(g, -4, 0);
        box(g, 7, 4, 12, 9, 0xcba67c, 0x89604b, 0xaf855e);
        break;
      case 2: // sacks of flour and a basket of apples
        sack(g, -4, 1);
        sack(g, 2, 3, 0xbba67c);
        g.ellipse(9, 2, 5, 2.5).fill(0x9a7444).rect(4, -2, 10, 4).fill(0xaf855e);
        for (let i = 0; i < 5; i++) g.circle(5.5 + i * 1.8, -2.5 - (i % 2), 1.6).fill(i % 3 ? 0xc23b3b : 0x97ae70);
        break;
      case 3: // firewood stacked against the wall
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 4 - (r >> 1); c++) {
            const x = -8 + c * 4.5 + r * 1.5,
              y = -2 - r * 4;
            g.circle(x, y, 2.4).fill(0x89604b).circle(x, y, 1.6).fill(0xcba67c).circle(x, y, 0.6).fill(0xaf855e);
          }
        break;
      case 4: // a stack of crates
        box(g, -2, 2, 13, 9, 0xcba67c, 0x89604b, 0xaf855e);
        box(g, -2, -7, 11, 8, 0xe1c49b, 0xaf855e, 0xcba67c);
        box(g, 9, 5, 9, 6, 0xcba67c, 0x89604b, 0xaf855e);
        break;
      default: // a potted shrub and a broom leaning by the door
        g.poly([-7, -7, 1, -7, 0, 0, -6, 0]).fill(0x6b7c7c);
        g.circle(-3, -12, 5).fill(0x305343).circle(-5, -14, 3).fill(0x45694c).circle(-1, -15, 3).fill(0x5b8056);
        g.moveTo(6, -24).lineTo(9, -2).stroke({ color: 0x8a6034, width: 1.4 });
        g.poly([6, -3, 13, -3, 11, 2, 7, 2]).fill(0xc8a14a);
    }
  }

  /** washing lines with cloth stirring in the wind, a chopping block and log pile, the bench under the elders */
  private prop(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!,
      g = a.carry!;
    // doorstep things and the chopping block never move: draw them once
    const still = sc.kind === 'dressing' || sc.kind === 'woodchop';
    if (still && a.beat === 1) return;
    a.beat = 1;
    g.clear();
    if (sc.kind === 'laundry') {
      const dx = sc.x2 - sc.x,
        dy = sc.y2 - sc.y;
      const p0 = { x: 0, y: 0 },
        p1 = { x: ix(dx, dy), y: iy(dx, dy) };
      const H = 36;
      for (const p of [p0, p1])
        g.rect(p.x - 1.5, p.y - H, 3, H)
          .fill(0x62433f)
          .rect(p.x - 1.5, p.y - H, 1, H)
          .fill(0x89604b);
      const sag = (k: number) => Math.sin(k * Math.PI) * 5;
      g.moveTo(p0.x, p0.y - H + 2);
      for (let i = 1; i <= 8; i++) {
        const k = i / 8;
        g.lineTo(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k - H + 2 + sag(k));
      }
      g.stroke({ color: 0xd8d0bc, width: 1 });
      // a wicker basket by the first post
      const bx = ix(-0.5, 0.7),
        by = iy(-0.5, 0.7);
      g.ellipse(bx, by - 3, 7, 3.5)
        .fill(0x9a7444)
        .rect(bx - 7, by - 7, 14, 4)
        .fill(0xaf855e)
        .ellipse(bx, by - 7, 7, 3)
        .fill(0xe8e0d0);
      // the washing is in when nobody would hang it out
      if (!sceneOut(sc, f.hour, f.weather)) return;
      const shown = 3 + ((sc.seed + Math.floor(f.now / 9000)) % 3);
      const cols = [0xf1efdb, 0x7aa0d0, 0xd06a5a, 0xe1c49b, 0x97ae70, 0xc8a0d8];
      for (let i = 0; i < shown; i++) {
        const k = (i + 0.6) / (shown + 0.2);
        const x = p0.x + (p1.x - p0.x) * k,
          y = p0.y + (p1.y - p0.y) * k - H + 2 + sag(k);
        const sway = f.reduced ? 0 : Math.sin(f.now / 450 + i * 1.3 + sc.seed) * 2;
        const col = cols[(sc.seed + i * 5) % cols.length]!;
        const shade = 0x000000;
        const shape = (sc.seed + i) % 3;
        if (shape === 0) {
          // a sheet
          g.poly([x - 6, y, x + 6, y, x + 6 + sway, y + 15, x - 6 + sway, y + 14]).fill(col);
          g.poly([x + 2, y, x + 6, y, x + 6 + sway, y + 15, x + 2 + sway, y + 14.5]).fill({
            color: shade,
            alpha: 0.12,
          });
        } else if (shape === 1) {
          // a shirt with its sleeves
          g.poly([
            x - 4,
            y,
            x + 4,
            y,
            x + 7,
            y + 4,
            x + 4,
            y + 5,
            x + 4 + sway,
            y + 11,
            x - 4 + sway,
            y + 11,
            x - 4,
            y + 5,
            x - 7,
            y + 4,
          ]).fill(col);
        } else {
          // trousers
          g.poly([
            x - 4,
            y,
            x + 4,
            y,
            x + 4 + sway,
            y + 12,
            x + 1 + sway,
            y + 12,
            x + sway * 0.5,
            y + 5,
            x - 1 + sway,
            y + 12,
            x - 4 + sway,
            y + 12,
          ]).fill(col);
        }
        g.rect(x - 3, y - 1, 1, 2)
          .fill(0x8a6034)
          .rect(x + 2, y - 1, 1, 2)
          .fill(0x8a6034);
      }
      return;
    }
    if (sc.kind === 'dressing') {
      this.dressing(g, sc.set ?? 0, sc.seed);
      return;
    }
    if (sc.kind === 'woodchop') {
      // chopping block with a log on it, and the split stack behind
      g.ellipse(ix(0.5, 0), iy(0.5, 0), 5, 2.5).fill(0x62433f);
      g.rect(ix(0.5, 0) - 5, iy(0.5, 0) - 5, 10, 5).fill(0x89604b);
      g.ellipse(ix(0.5, 0), iy(0.5, 0) - 5, 5, 2.5).fill(0xcba67c);
      const sx = ix(1.6, -0.6),
        sy = iy(1.6, -0.6);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 4 - r; c++)
          g.circle(sx - 6 + c * 4 + r * 2, sy - 2 - r * 3.5, 2).fill(r % 2 ? 0xaf855e : 0xcba67c);
      return;
    }
  }
}

/** a small isometric box (crate, barrel body) with lit top and two shaded faces, feet at (x, y) */
function box(g: Graphics, x: number, y: number, w: number, h: number, top: number, left: number, right: number): void {
  const hw = w / 2,
    hh = w / 4;
  g.poly([x - hw, y - hh - h, x, y - h, x, y, x - hw, y - hh]).fill(left);
  g.poly([x, y - h, x + hw, y - hh - h, x + hw, y - hh, x, y]).fill(right);
  g.poly([x - hw, y - hh - h, x, y - 2 * hh - h, x + hw, y - hh - h, x, y - h]).fill(top);
}
function pot(g: Graphics, x: number, y: number, flower: number): void {
  g.poly([x - 4, y - 7, x + 4, y - 7, x + 3, y, x - 3, y]).fill(0xaf5a3a);
  g.rect(x - 4.5, y - 8, 9, 2).fill(0xc8704a);
  g.circle(x - 2, y - 11, 3)
    .fill(0x45694c)
    .circle(x + 2, y - 12, 3)
    .fill(0x5b8056)
    .circle(x, y - 14, 3)
    .fill(0x45694c);
  for (const [fx, fy] of [
    [-2, -13],
    [2, -14],
    [0, -16],
    [3, -11],
  ])
    g.circle(x + fx!, y + fy!, 1.3).fill(flower);
}
function barrel(g: Graphics, x: number, y: number): void {
  g.ellipse(x, y - 1, 6, 3).fill(0x62433f);
  g.rect(x - 6, y - 14, 12, 13).fill(0x89604b);
  g.rect(x - 6, y - 14, 4, 13).fill(0xaf855e);
  g.rect(x - 6, y - 11, 12, 1.5)
    .fill(0x46565b)
    .rect(x - 6, y - 5, 12, 1.5)
    .fill(0x46565b);
  g.ellipse(x, y - 14, 6, 3)
    .fill(0xcba67c)
    .ellipse(x, y - 14, 4, 2)
    .fill(0xaf855e);
}
function sack(g: Graphics, x: number, y: number, c = 0xcbb48a): void {
  g.ellipse(x, y - 5, 5, 6)
    .fill(c)
    .ellipse(x - 1.5, y - 7, 2.5, 3)
    .fill(0xe1d0a6);
  g.rect(x - 1.5, y - 12, 3, 2).fill(0x8a6a40);
}

/** a stable look index for a scene's n-th person */
export const sceneLook = (sc: Scene, n: number, outfits: number) => Math.floor(hash2(sc.seed, n, 3, 77) * outfits);
