import { Graphics, Sprite } from 'pixi.js';
import { hash2, type Weather } from '@eigenlands/shared';
import { dirOf } from '../art/actors';
import { actionFrame, type PersonAction } from '../art/person-actions';
import type { HeldId, HeldWeapons } from '../art/weapons';
import { SCENE_TALK, sceneSheltered, type Scene } from './scenes';
import { PROPS } from '../art/props';
import { bucketSprite, choppingBlockSprite, sackSprite } from '../art/scene-props';
import type { ObjSprite } from '../art/objects';

/** what may stand by a door, from the town prop library (scenes.ts picks one per spot) */
const DRESSING = ['planter', 'barrel', 'basket', 'woodpile', 'crate', 'plant', 'hay'];
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
  /** isometric prop sprites (scene props; a carried bucket or sack) */
  sprites?: Sprite[];
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
    // a bucket at the hand or a sack on the shoulder: isometric sprites riding along with the body
    const carried = (o: ObjSprite | null, x: number, y: number) => {
      let sp = a.sprites?.[0];
      if (!o) {
        if (sp) sp.visible = false;
        return;
      }
      if (!sp) {
        sp = new Sprite();
        a.root.addChild(sp);
        a.sprites = [sp];
      }
      sp.texture = o.tex;
      sp.anchor.set(o.ax / o.tex.width, o.ay / o.tex.height);
      sp.position.set(X(x), Y(y));
      sp.visible = true;
    };
    carried(
      what === 'bucket' ? bucketSprite() : what === 'sack' ? sackSprite() : null,
      what === 'sack' ? -4 : 9,
      what === 'sack' ? -32 : -10,
    );
    if (what === 'bucket' || what === 'sack') return;
    if (what === 'broom') {
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

  /** washing lines with cloth stirring in the wind, a chopping block and log pile, the bench under the elders */
  private prop(a: SceneActor, f: SceneFrame): void {
    const sc = a.sc!;
    if (!a.sprites) {
      // built once from the isometric prop library: the same art the towns' own barrels and washing lines use
      a.sprites = [];
      const put = (o: ObjSprite, dx = 0, dy = 0) => {
        const sp = new Sprite(o.tex);
        sp.anchor.set(o.ax / o.tex.width, o.ay / o.tex.height);
        sp.position.set(ix(dx, dy), iy(dx, dy));
        a.root.addChild(sp);
        a.sprites!.push(sp);
        return sp;
      };
      if (sc.kind === 'dressing') put(PROPS[DRESSING[(sc.set ?? 0) % DRESSING.length]!]!('sw').frames[0]!);
      else if (sc.kind === 'woodchop') {
        put(PROPS.woodpile!('sw').frames[0]!, 1.2, -0.9);
        put(choppingBlockSprite('sw'), 0.4, 0);
      } else if (sc.kind === 'laundry') put(PROPS.laundry!('sw').frames[0]!);
    }
    if (sc.kind === 'laundry') {
      // the washing is in (the line taken down) when nobody would hang it out; otherwise it stirs in the wind
      const out = sceneOut(sc, f.hour, f.weather);
      const def = PROPS.laundry!('sw');
      const sp = a.sprites[0]!;
      sp.visible = out;
      if (out) sp.texture = def.frames[f.reduced ? 0 : Math.floor((f.now / 1000) * def.fps) % def.frames.length]!.tex;
    }
  }
}

/** a stable look index for a scene's n-th person */
export const sceneLook = (sc: Scene, n: number, outfits: number) => Math.floor(hash2(sc.seed, n, 3, 77) * outfits);
