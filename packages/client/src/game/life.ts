import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  T,
  REALM_SITE_BY_ID,
  armyKind,
  festivalOn,
  festivalToday,
  weddingsOn,
  royalCelebration,
  isCaveY,
  nearestRealm,
  townFor,
  hash2,
  mulberry32,
  packAppearance,
  randomAppearance,
  townsNear,
  findPath,
  type ChunkStore,
  type RealmId,
  type RealmSite,
  type Town,
  type Weather,
} from '@eigenlands/shared';
import type { AmbientArt } from '../art/ambient';
import { civState } from './civ-store';
import type { Sheets } from '../art/actors';
import { ATTACK_FRAME, COSMETIC_OUTFITS, WALK_FRAMES, dirOf } from '../art/actors';
import type { FoeSheets } from '../art/foes';
import { D4_SE, dir4 } from '../art/sprite';
import type { Sfx } from '../audio';
import type { HeldId, HeldWeapons } from '../art/weapons';
import { planScenes, type Scene } from './scenes';
import { SceneLife, sceneLook, type SceneActor } from './scene-life';
import { rodSprite, umbrellaSprite } from '../art/scene-props';
import { livestockTexture } from '../art/livestock';
import { setExtraLights } from './worldobjviews';
import { depth, isoX, isoY, screenDir } from './iso';
import type { Fx } from './fx';

/**
 * The living-settlement layer for the six kingdoms: everything that makes a walk through a city worth taking. Tavern
 * patrons in the evening, smiths hammering at the forge, farmers in the fields, farm animals, fishermen on the
 * banks, birds on the rooftops, market and festival crowds under bunting (with fireworks after dark), caravans
 * arriving at the gates, Aurelion's jousting ground, royal processions and the town bell. People shelter from rain,
 * and run from monsters. Visual only: nothing here is synced, collides or costs the server anything, and it is only
 * ever built for the settlement the player is standing in.
 */

export interface LifeDeps {
  layer: () => Container;
  labels: () => Container;
  store: () => ChunkStore;
  seed: () => number;
  sheets: () => Sheets;
  foes: () => FoeSheets;
  art: () => AmbientArt | null;
  fx: () => Fx;
  sound: (s: Sfx, x?: number, y?: number) => void;
  toScreen: (x: number, y: number) => { x: number; y: number };
  /** hostile creatures currently on screen, in tile coordinates */
  hostiles: () => Array<{ x: number; y: number }>;
  /** held tool art (axes, watering cans) for people at work in the everyday scenes */
  held?: () => HeldWeapons;
}
export interface LifeFrame {
  now: number;
  dt: number;
  me: { x: number; y: number };
  hour: number;
  day: number;
  weather: Weather;
  reduced: boolean;
  underground: boolean;
}

type Role =
  | 'patron'
  | 'smith'
  | 'farmer'
  | 'fisher'
  | 'crowd'
  | 'vendor'
  | 'trader'
  | 'escort'
  | 'knight'
  | 'royal'
  | 'beast'
  | 'chicken'
  | 'roofbird'
  | 'scene';

interface Actor extends SceneActor {
  role: Role;
  root: Container;
  body: Sprite;
  rider: Sprite | null;
  shadow: Graphics;
  extra: Graphics | null;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  st: 'idle' | 'walk' | 'work' | 'flee' | 'fly';
  t: number;
  phase: number;
  look: number;
  model: number;
  home: { x: number; y: number; r: number };
  /** hours (start, end) during which this actor is out */
  hours: [number, number];
  dir: number;
  face: number;
  speed: number;
  bark?: { text: string; until: number };
  slot: number;
  leave?: boolean;
  ttl?: number;
  umbrella: boolean;
  danger: number;
  slot2?: number;
  /** packed appearance (shared/appearance.ts): every villager is a distinct person */
  app: number;
  /** a scene actor's own scale (children are smaller) */
  small?: boolean;
}

const FARM_COW = 74,
  FARM_SHEEP = 75,
  FARM_PIG = 76,
  FARM_HORSE = 77;
const SPARK = [22, 45, 46];
const FIREWORK = [0xffd36a, 0xff7a5a, 0x9ad0ff, 0xc8a0ff, 0xa6ff9e, 0xffffff];

const TALK: Record<string, string[]> = {
  patron: ['Cheers!', 'Another round!', 'Did you hear about the raiders?', 'The ale here is the best in the kingdom.'],
  smith: ['Fine steel takes patience.', 'Need that blade sharpened?'],
  farmer: ['Good soil this year.', 'Rain would do the barley good.', 'Mind the furrows!'],
  fisher: ['Not a bite all morning...', 'The big one got away.'],
  crowd: ['What a lovely day!', 'Have you tried the honey cakes?', 'Long live the crown!', 'Make way, make way!'],
  festival: ['Happy festival!', 'Look at those lanterns!', 'Dance with me!', 'To the harvest!'],
  trader: ['Spices from the far coast!', 'Fine wares, fair prices!'],
  alarm: ['Monsters!', 'Run!', 'Guards! Guards!', 'Get inside!'],
  rain: ['Wet again...', 'Quick, under the awning!'],
};

const WARE_IDX: Record<string, number> = {
  produce: 0,
  fish: 1,
  cloth: 2,
  bread: 3,
  pots: 4,
  flowers: 5,
  hung: 6,
  herbs: 7,
};
const CRIES: string[][] = [
  ['Apples, sweet as honey!', 'Fresh from the orchard!', 'Ripe plums, ripe plums!'],
  ['Fish! Caught this morning!', 'Silver trout, three coppers!'],
  ['Fine cloth from the loom!', 'Silk! Come and feel it!'],
  ['Hot bread, still warm!', 'Honey rolls! Get your honey rolls!'],
  ['Pots and jugs, sturdy and cheap!', 'Never leaks, I swear.'],
  ['Flowers for your sweetheart!', 'Fresh-cut roses!'],
  ['Smoked ham, smoked sausage!', 'Best cuts in the kingdom!'],
  ['Herbs and remedies!', 'Cures for what ails you!'],
];
const pick = <T>(a: T[], r: number): T => a[Math.floor(r * a.length) % a.length]!;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class WorldLife {
  private town: Town | null = null;
  private site: RealmSite | null = null;
  private realm: RealmId | null = null;
  private cast: Actor[] = [];
  private bubbles: Text[] = [];
  private bunting: Graphics | null = null;
  private shows: Graphics | null = null;
  private rockets: Array<{ x: number; y: number; vy: number; z: number; t: number; hue: number; burst: boolean }> = [];
  private sparks: Array<{ x: number; y: number; vx: number; vy: number; t: number; hue: number }> = [];
  private nextRocket = 0;
  private lastHour = -1;
  private caravanAt = 0;
  private caravanN = 0;
  private joust = { t: 0, round: 0 };
  private procession = { day: -1, started: false };
  private festival = false;
  private clock = 0;
  private budget = 1;
  private fishing: Actor | null = null;
  /** where customers stand to browse: in front of each stall */
  private fronts: Array<{ x: number; y: number }> = [];

  private scenes: SceneLife;
  /** the everyday scenes planned for the settlement being animated (tests, screenshots) */
  private plan: Scene[] = [];

  constructor(private d: LifeDeps) {
    this.scenes = new SceneLife({
      tex: (a, dir, frame) => this.tex(a as Actor, dir, frame),
      moveTo: (a, dt, speed) => this.moveTo(a as Actor, dt, speed),
      say: (a, text, now) => this.say(a as Actor, text, now),
      walkFrame: (a, speed) => this.walkFrame(a as Actor, speed),
      burst: (x, y, c, n) => this.d.fx().burst(x, y, c, n),
      ring: (x, y, c, r, life) => this.d.fx().ring(x, y, c, r, life),
      sound: (s, x, y) => this.d.sound(s, x, y),
      held: () => this.d.held?.() ?? null,
      art: () => this.d.art(),
      all: () => this.cast.filter((a) => a.role === 'scene'),
      findPath: (sx, sy, tx, ty) => findPath(sx, sy, tx, ty, this.d.store().solidAt, 900),
    });
    // the night watch's lantern really lights the street around it
    setExtraLights('life-lanterns', (x0, y0, x1, y1) =>
      this.cast
        .filter((a) => a.sc?.kind === 'watchman' && a.root.visible && a.x >= x0 && a.x <= x1 && a.y >= y0 && a.y <= y1)
        .map((a) => ({ x: a.x + 0.3, y: a.y + 0.3, radius: 4.2, color: 0xffc870, intensity: 0.95 })),
    );
  }

  /** the everyday scenes of the current settlement, by kind (tests, screenshots) */
  sceneKinds(): Record<string, number> {
    const o: Record<string, number> = {};
    for (const s of this.plan) o[s.kind] = (o[s.kind] ?? 0) + 1;
    return o;
  }
  /** where the first scene of a kind happens (tests, screenshots) */
  sceneAt(kind: string): { x: number; y: number } | null {
    const s = this.plan.find((p) => p.kind === kind);
    return s ? { x: s.x, y: s.y } : null;
  }

  count(): number {
    return this.cast.length;
  }
  kinds(): Record<string, number> {
    const o: Record<string, number> = {};
    for (const a of this.cast) o[a.role] = (o[a.role] ?? 0) + 1;
    return o;
  }
  /** how many people have their own sheet built yet (tests) */
  styledCount(): number {
    return this.cast.filter((a) => a.app && this.d.sheets().styledReady(a.look, a.app)).length;
  }
  /** position of the first actor with a role (tests, screenshots) */
  find(role: Role): { x: number; y: number } | null {
    const a = this.cast.find((c) => c.role === role);
    return a ? { x: a.x, y: a.y } : null;
  }
  /** a named spot of the settlement being animated, by suffix, or the door of its first building of a kind (tests) */
  spotOf(suffix: string): { x: number; y: number } | null {
    const t = this.town;
    if (!t) return null;
    const k = Object.keys(t.spots).find((n) => n.endsWith(suffix));
    if (k) return t.spots[k]!;
    const b = t.buildings.find((b) => b.kind === suffix);
    return b ? { x: b.doorX, y: b.doorY + 2 } : null;
  }
  /** the settlement being animated, for tests and screenshots */
  where(): string | null {
    return this.site?.id ?? null;
  }

  // ───────────────────────── frame ─────────────────────────

  frame(f: LifeFrame): void {
    this.clock += f.dt;
    this.budget = f.dt > 0.12 ? 3 : 1;
    if (Number.isNaN(HADAMERE.cx)) Object.assign(HADAMERE, townFor(this.d.seed()));
    const near = this.townNear(f.me.x, f.me.y);
    // underground only the lived-in Undercroft towns have street life
    const town = f.underground && !(near && isCaveY(near.cy)) ? null : near;
    if (town !== this.town) this.enter(town, f);
    if (!this.town || !this.site || !this.realm) return;
    const h = f.hour;
    const wet = f.weather === 'rain' || f.weather === 'storm' || f.weather === 'snow';
    // festivals, and a resident's wedding day, fill the square with revellers under bunting
    this.festival =
      (homeTowns.has(this.town) ? !!festivalToday('home', f.day) : !!festivalOn(this.realm, f.day)) ||
      weddingsOn(this.site.id, f.day).length > 0 ||
      (!homeTowns.has(this.town) && !!royalCelebration(civState()?.kingdoms[this.realm], f.day));
    this.director(f);
    const hostiles = this.d.hostiles();
    for (const a of this.cast) this.step(a, f, h, wet, hostiles);
    this.cast = this.cast.filter((a) => {
      if (a.ttl !== undefined && a.t > a.ttl) {
        a.root.destroy({ children: true });
        return false;
      }
      return true;
    });
    this.sky(f);
    this.bubblesFrame(f);
    this.bellCheck(f);
  }

  private townNear(x: number, y: number): Town | null {
    const ts = townsNear(this.d.seed(), x - 16, y - 16, x + 16, y + 16);
    let best: Town | null = null;
    for (const t of ts) {
      if (!siteOf(t)) continue;
      if (x >= t.x0 - 16 && x <= t.x1 + 16 && y >= t.y0 - 16 && y <= t.y1 + 16) {
        best = t;
        break;
      }
    }
    return best;
  }

  private enter(town: Town | null, f: LifeFrame): void {
    for (const a of this.cast) a.root.destroy({ children: true });
    this.cast = [];
    this.bunting?.destroy();
    this.shows?.destroy();
    this.bunting = this.shows = null;
    this.rockets = [];
    this.sparks = [];
    this.fishing = null;
    this.fronts = [];
    this.plan = [];
    this.town = town;
    this.site = town ? siteOf(town) : null;
    this.realm = this.site?.realm ?? null;
    this.caravanAt = this.clock + 20;
    this.lastHour = f.hour;
    this.procession = { day: -1, started: false };
    if (!town || !this.site) return;
    this.populate(town, this.site);
  }

  // ───────────────────────── population ─────────────────────────

  private populate(t: Town, site: RealmSite): void {
    const seed = this.d.seed();
    const hs = (i: number, k = 0) => hash2(seed, i, k, 9137 + t.cx);
    const look = (i: number) => Math.floor(hs(i, 1) * COSMETIC_OUTFITS);
    const big = site.kind === 'capital' ? 1.8 : site.kind === 'town' ? 1.2 : 1;
    const door = (b: { doorX: number; doorY: number }) => ({ x: b.doorX + 0.5, y: b.doorY + 1.2 });
    let n = 0;

    // tavern patrons: loitering in front of every inn once the work is done
    for (const b of t.buildings.filter((b) => b.kind === 'inn')) {
      const c = door(b);
      const count = 3 + Math.floor(hs(n, 2) * 3 * big);
      for (let i = 0; i < count; i++) {
        const a = this.person('patron', look(n + i), c.x - 2.2 + i * 1.1 + hs(n, i) * 0.4, c.y + 0.6 + (i % 2) * 0.9, {
          hours: [17.5, 24.5],
          home: { ...c, r: 3 },
        });
        a.dir = dirOf(i % 2 ? -1 : 1, 1);
        a.slot = i;
      }
      n += 7;
    }

    // smiths: hammer on the anvil beside the forge door while the sun is up
    for (const b of t.buildings.filter((b) => b.kind === 'smithy')) {
      const c = door(b);
      const a = this.person('smith', look(n), c.x + 1.8, c.y - 0.2, { hours: [6.5, 18], home: { ...c, r: 2 } });
      a.dir = dirOf(-1, -0.2);
      n++;
    }

    // farms: farmers walk the furrows, animals graze in the yard
    for (const b of t.buildings.filter((b) => b.kind === 'farmhouse')) {
      const c = door(b);
      const fl = t.spots[`${site.id}.field`] ?? { x: c.x + 6, y: c.y + 4 };
      for (let i = 0; i < Math.round(1 + hs(n, 3) * 2); i++) {
        const a = this.person('farmer', look(n + i), fl.x + i * 2, fl.y + 1, {
          hours: [6, 18.5],
          home: { x: fl.x, y: fl.y + 2, r: 7 },
        });
        a.slot = i;
      }
      const yard = { x: c.x + 3, y: c.y + 4, r: 6 };
      const herd = [FARM_COW, FARM_SHEEP, FARM_PIG, FARM_SHEEP, FARM_COW, FARM_HORSE];
      for (let i = 0; i < 3 + Math.floor(hs(n, 4) * 3); i++) {
        const k = herd[(i + Math.floor(hs(n, 5) * 6)) % herd.length]!;
        this.beast(k, yard.x + hs(n, i + 10) * 5 - 2.5, yard.y + hs(n, i + 20) * 4 - 2, yard);
      }
      for (let i = 0; i < 4; i++)
        this.chicken(yard.x - 2 + i * 0.8, yard.y + 2, { x: yard.x - 1, y: yard.y + 2, r: 3.5 }, i);
      n += 5;
    }

    // rooftop pigeons on a few houses
    const roofs = t.buildings.filter((b) => b.kind !== 'farmhouse');
    for (let i = 0; i < Math.min(roofs.length, 6 + Math.floor(big * 2)); i++) {
      const b = roofs[Math.floor(hs(i, 7) * roofs.length)]!;
      this.roofBird(b, i);
    }

    // a fisherman wherever a bank touches the settlement
    this.findFishing(t, look(n));
    // the ordinary business of the street: water, washing, firewood, gossip, children, pets
    this.populateScenes(t, big);

    // stall-keepers behind every market stall, calling their wares
    for (const [k, sp] of Object.entries(t.spots)) {
      if (!k.startsWith(`${site.id}.stall.`)) continue;
      const stall = t.objects.find((o) => o.x === sp.x && o.y === sp.y + 1 && o.sub.startsWith('stall_'));
      const goods = stall?.sub.split('_')[2] ?? 'produce';
      const v = this.person('vendor', look(n), sp.x + 0.5, sp.y + 0.6, {
        hours: [7, 18.5],
        home: { x: sp.x + 0.5, y: sp.y + 0.6, r: 0 },
      });
      v.dir = dirOf(0.4, 1);
      v.slot = WARE_IDX[goods] ?? 0;
      v.phase = (n++ % 7) * 0.9;
      this.fronts.push({ x: sp.x + 0.5, y: sp.y + 3 });
    }
    // fairgoers among the rides, out late into the evening
    const fair = t.spots[`${site.id}.fair`];
    if (fair) {
      const goers = Math.round((8 + hs(n, 11) * 5) * big);
      for (let i = 0; i < goers; i++) {
        const a = this.person(
          'crowd',
          look(n + 40 + i),
          fair.x + (hs(i, 12) - 0.5) * 12,
          fair.y + (hs(i, 13) - 0.5) * 8,
          {
            hours: [10, 22.5],
            home: { x: fair.x, y: fair.y, r: 8 },
          },
        );
        a.slot = 50 + i;
        a.st = 'idle';
        a.t = rnd(0, 3);
      }
    }
    // a mourner or two among the graves by day
    const yard = t.spots[`${site.id}.graveyard`];
    if (yard)
      for (let i = 0; i < 2; i++) {
        const a = this.person('crowd', look(n + 70 + i), yard.x + (i ? 2 : -2), yard.y - 2, {
          hours: i ? [9, 12] : [15, 18],
          home: { x: yard.x, y: yard.y - 3, r: 3 },
        });
        a.slot = 90 + i;
      }
    // market and festival crowd around the plaza
    const pa = t.spots[`${site.id}.plaza_a`],
      pb = t.spots[`${site.id}.plaza_b`],
      plaza = t.spots[`${site.id}.plaza`];
    if (pa && pb && plaza) {
      const x0 = Math.min(pa.x, pb.x),
        x1 = Math.max(pa.x, pb.x),
        y0 = Math.min(pa.y, pb.y),
        y1 = Math.max(pa.y, pb.y);
      const cx = (x0 + x1) / 2,
        cy = (y0 + y1) / 2,
        r = Math.max(7, Math.min(x1 - x0, y1 - y0) / 2 + 2);
      const total = Math.round((10 + hs(n, 6) * 4) * big);
      for (let i = 0; i < total; i++) {
        const a = this.person('crowd', look(n + i), cx + (hs(i, 8) - 0.5) * r * 2, cy + (hs(i, 9) - 0.5) * r * 2, {
          hours: i < 4 ? [7, 21.5] : [8, 18],
          home: { x: cx, y: cy, r },
        });
        a.slot = i;
        a.st = 'idle';
        a.t = rnd(0, 3);
      }
    } else {
      // a town without a laid-out square: townsfolk mill about the street before the inn (or the town's heart)
      const inn = t.buildings.find((b) => b.kind === 'inn');
      const c = inn ? { x: inn.doorX + 0.5, y: inn.doorY + 3.5 } : { x: t.cx + 0.5, y: t.cy + 0.5 };
      const total = Math.round((6 + hs(n, 6) * 4) * big);
      for (let i = 0; i < total; i++) {
        const a = this.person('crowd', look(n + i), c.x + (hs(i, 8) - 0.5) * 8, c.y + (hs(i, 9) - 0.5) * 6, {
          hours: i < 3 ? [7, 21.5] : [8, 18.5],
          home: { x: c.x, y: c.y, r: 6 },
        });
        a.slot = i;
        a.st = 'idle';
        a.t = rnd(0, 3);
      }
    }
  }

  // ───────────────────────── everyday scenes ─────────────────────────

  private populateScenes(t: Town, big: number): void {
    const store = this.d.store();
    this.plan = planScenes(t, this.d.seed(), {
      free: (x, y) => !store.solidAt(x, y) && store.getTile(x, y) !== T.WATER,
      size: big,
    });
    for (const sc of this.plan) {
      const people = (n: number, part0: number, small = false) => {
        for (let i = 0; i < n; i++) {
          const x = sc.kind === 'chat' && i === 1 ? sc.x2 : sc.x + (small ? (i - 1) * 1.2 : 0),
            y = sc.kind === 'chat' && i === 1 ? sc.y2 : sc.y + (small ? (i % 2) * 0.8 : 0);
          const a = this.person('scene', sceneLook(sc, i, COSMETIC_OUTFITS), x, y, {
            hours: [0, 24],
            home: { x: sc.x, y: sc.y, r: 5 },
          });
          a.sc = sc;
          a.part = part0 + i;
          a.small = small;
          if (small) a.body.scale.set(0.72);
          a.carry = new Graphics();
          a.root.addChild(a.carry);
          const tool: HeldId | null = sc.kind === 'woodchop' ? 'axe' : sc.kind === 'garden' ? 'can' : null;
          if (tool && this.d.held) {
            const h = new Sprite();
            h.anchor.set(0.5, 0.75);
            (h as unknown as { id: HeldId }).id = tool;
            a.heldSprite = h;
            a.root.addChild(h);
          }
        }
      };
      const animal = (kind: 'cat' | 'dog' | 'pigeon' | 'prop' | 'horse' | 'chicken', x: number, y: number) => {
        const a = this.mk('scene', x, y, { x: sc.x, y: sc.y, r: 5 }, [0, 24]);
        a.sc = sc;
        a.animal = kind;
        a.umbrella = false;
        a.body.anchor.set(0.5, 0.92);
        const art = this.d.art();
        if (kind === 'prop') {
          a.body.visible = false;
          a.carry = new Graphics();
          a.root.addChild(a.carry);
        } else if (kind === 'horse') {
          a.body.anchor.set(0.5, 49 / 56); // livestock canvases are 48×56, standing at (24, 49)
          a.body.texture = livestockTexture('horse', 0, 2);
        } else if (art)
          a.body.texture = (
            kind === 'cat' ? art.cat : kind === 'dog' ? art.dog : kind === 'chicken' ? art.chicken : art.pigeon
          )[0]!;
        return a;
      };
      switch (sc.kind) {
        case 'chat':
          people(2, 0);
          break;
        case 'kids':
          people(3, 2, true);
          break;
        case 'bench':
          people(hash2(sc.seed, 1, 1, 1) < 0.5 ? 2 : 1, 0);
          for (let i = 0; i < 3; i++) animal('pigeon', sc.x - 0.6 + i * 0.7, sc.y + 1.5 + (i % 2) * 0.5);
          break;
        case 'cat':
        case 'dog':
          animal(sc.kind, sc.x, sc.y);
          break;
        case 'laundry':
          animal('prop', sc.x, sc.y);
          people(1, 0);
          break;
        case 'dressing':
          animal('prop', sc.x, sc.y);
          break;
        case 'stablehand':
          animal('horse', sc.x, sc.y);
          people(1, 0);
          break;
        case 'hens':
          for (let i = 0; i < 4; i++) animal('chicken', sc.x - 0.9 + i * 0.6, sc.y + 0.8 + (i % 2) * 0.5);
          people(1, 0);
          break;
        case 'woodchop':
          animal('prop', sc.x, sc.y);
          people(1, 0);
          break;
        default:
          people(1, 0);
      }
    }
  }

  // ───────────────────────── creation ─────────────────────────

  private mk(role: Role, x: number, y: number, home: Actor['home'], hours: [number, number]): Actor {
    const root = new Container(),
      shadow = new Graphics(),
      body = new Sprite();
    root.addChild(shadow, body);
    this.d.layer().addChild(root);
    const a: Actor = {
      role,
      root,
      body,
      rider: null,
      shadow,
      extra: null,
      x,
      y,
      z: 0,
      tx: x,
      ty: y,
      st: 'idle',
      t: 0,
      phase: Math.random() * 6.28,
      look: 0,
      model: -1,
      home,
      hours,
      dir: 2,
      face: D4_SE,
      speed: 1.2,
      slot: 0,
      umbrella: false,
      danger: 0,
      app: 0,
    };
    this.cast.push(a);
    this.place(a);
    return a;
  }

  private person(
    role: Role,
    look: number,
    x: number,
    y: number,
    o: { hours?: [number, number]; home?: Actor['home'] } = {},
  ): Actor {
    const a = this.mk(role, x, y, o.home ?? { x, y, r: 4 }, o.hours ?? [0, 24]);
    a.look = 0;
    const rng = mulberry32(
      Math.floor(hash2(Math.floor(x * 16), Math.floor(y * 16), look, 8113 + this.cast.length) * 2 ** 31),
    );
    a.app = packAppearance(randomAppearance(rng));
    a.body.anchor.set(0.5, 31 / 32);
    a.body.visible = false;
    a.umbrella = hash2(Math.floor(x * 7), Math.floor(y * 7), look, 4412) < 0.65;
    return a;
  }

  private beast(model: number, x: number, y: number, home: Actor['home']): Actor {
    const a = this.mk('beast', x, y, home, [0, 24]);
    a.model = model;
    a.speed = model === FARM_HORSE ? 1.4 : 0.55;
    a.body.anchor.set(0.5, this.d.foes().anchor(model));
    a.body.texture = this.d.foes().frame(model, false, D4_SE, 'idle', 0);
    return a;
  }

  private chicken(x: number, y: number, home: Actor['home'], i: number): void {
    const art = this.d.art();
    if (!art) return;
    const a = this.mk('chicken', x, y, home, [5.5, 20]);
    a.body.anchor.set(0.5, 0.92);
    a.body.texture = art.chicken[0]!;
    a.slot = i;
    a.speed = 0.9;
  }

  private roofBird(b: { x: number; y: number; w: number; h: number; style: number }, i: number): void {
    const art = this.d.art();
    if (!art) return;
    const a = this.mk(
      'roofbird',
      b.x + b.w * (0.25 + 0.5 * hash2(i, b.x, b.y, 61)),
      b.y + b.h * 0.5,
      { x: b.x, y: b.y, r: 0 },
      [6, 20],
    );
    a.body.anchor.set(0.5, 0.92);
    a.body.texture = art.pigeon[0]!;
    a.z = 46 + (b.w > 10 ? 6 : 0);
    a.slot = i;
    a.face = hash2(i, 3, 3, 3) < 0.5 ? 1 : -1;
  }

  private findFishing(t: Town, look: number): void {
    const store = this.d.store();
    const wet = (x: number, y: number) => store.getTile(x, y) === T.WATER;
    for (let y = t.y0 + 2; y < t.y1 - 2; y += 2) {
      for (let x = t.x0 + 2; x < t.x1 - 2; x += 2) {
        if (store.solidAt(x, y) || wet(x, y)) continue;
        const east = wet(x + 1, y) && wet(x + 2, y),
          south = wet(x, y + 1) && wet(x, y + 2);
        if (!east && !south) continue;
        const a = this.person('fisher', look, x + 0.5, y + 0.5, { hours: [5.5, 19], home: { x, y, r: 0 } });
        a.dir = east ? dirOf(1, 0.3) : dirOf(-0.3, 1);
        a.extra = new Graphics();
        a.root.addChild(a.extra);
        a.tx = east ? x + 2.8 : x + 0.5;
        a.ty = east ? y + 0.5 : y + 2.8;
        this.fishing = a;
        return;
      }
    }
  }

  // ───────────────────────── director: scheduled spectacles ─────────────────────────

  private director(f: LifeFrame): void {
    const t = this.town!,
      site = this.site!,
      realm = this.realm!;
    const h = f.hour;
    // caravans reach the gates every few minutes
    if (this.clock > this.caravanAt && site.kind !== 'farm' && site.kind !== 'outpost') {
      this.caravanAt = this.clock + 150 + 100 * hash2(this.caravanN, site.cx, 1, 33);
      if (h > 7 && h < 18 && f.weather !== 'storm') this.spawnCaravan(t, site, realm);
    }
    // royal procession and jousting belong to capitals
    if (site.kind === 'capital') {
      const door = t.spots[`${site.id}.palace_door`],
        plaza = t.spots[`${site.id}.plaza`];
      if (door && plaza && h >= 10.5 && h < 11.4 && this.procession.day !== f.day) {
        this.procession = { day: f.day, started: true };
        this.spawnProcession(door, plaza, realm);
      }
      const ta = t.spots[`${site.id}.tourney_a`],
        tb = t.spots[`${site.id}.tourney_b`];
      if (ta && tb && ((h >= 12 && h < 17) || this.festival)) this.jousting(f, ta, tb, realm);
      else if (this.cast.some((a) => a.role === 'knight')) this.stopJoust();
    }
  }

  private spawnCaravan(t: Town, site: RealmSite, realm: RealmId): void {
    const gate = Object.entries(t.spots).filter(([k]) => k.endsWith('.gate'));
    const g = gate.length ? gate[this.caravanN % gate.length]![1] : { x: t.cx, y: t.y1 - 2 };
    const plaza = t.spots[`${site.id}.plaza`] ?? { x: t.cx, y: t.cy };
    const n = this.caravanN++;
    const style = n % 3; // merchants, adventurers, pilgrims
    const lookBase = Math.floor(hash2(n, t.cx, t.cy, 515) * COSMETIC_OUTFITS);
    const sx = g.x,
      sy = g.y;
    const dest = { x: plaza.x + (n % 3) - 1, y: plaza.y + 2 };
    const mk = (role: Role, i: number, look: number, mounted: boolean, model = -1) => {
      const a = this.person(role, look, sx - i * 1.3, sy - i * 0.4, { hours: [0, 24], home: { ...dest, r: 4 } });
      a.tx = dest.x + (i % 2) * 1.6 - 0.8;
      a.ty = dest.y + i * 0.9;
      a.st = 'walk';
      a.speed = mounted ? 2.1 : 1.35;
      a.ttl = 70;
      a.slot = i;
      if (mounted) {
        a.model = model;
        a.rider = new Sprite();
        a.rider.anchor.set(0.5, 31 / 32);
        a.rider.y = -14;
        a.root.addChild(a.rider);
        a.body.anchor.set(0.5, this.d.foes().anchor(model));
      }
      return a;
    };
    if (style === 0) {
      mk('trader', 0, lookBase, true, FARM_HORSE);
      const pack = this.beast(FARM_HORSE, sx - 3, sy - 1, { ...dest, r: 3 });
      pack.role = 'escort';
      pack.ttl = 70;
      pack.st = 'walk';
      pack.speed = 1.5;
      pack.tx = dest.x + 2;
      pack.ty = dest.y + 1;
      mk('escort', 2, (lookBase + 5) % COSMETIC_OUTFITS, false);
    } else if (style === 1) {
      for (let i = 0; i < 3; i++) mk('escort', i, (lookBase + i * 7) % COSMETIC_OUTFITS, i === 0, FARM_HORSE);
    } else {
      for (let i = 0; i < 4; i++) mk('escort', i, (lookBase + i * 3) % COSMETIC_OUTFITS, false);
    }
    this.d.sound('horn', sx, sy);
  }

  private spawnProcession(door: { x: number; y: number }, plaza: { x: number; y: number }, realm: RealmId): void {
    const mkR = (i: number, look: number, army: boolean) => {
      const a = army
        ? this.beast(armyKind(realm, 'elite'), door.x + (i - 2) * 1.4, door.y + 1, { ...plaza, r: 3 })
        : this.person('royal', look, door.x + (i - 2) * 1.4, door.y + 1, { home: { ...plaza, r: 3 } });
      a.role = 'royal';
      a.hours = [0, 24];
      a.ttl = 55;
      a.st = 'walk';
      a.speed = 0.95;
      a.slot = i;
      a.tx = plaza.x + (i - 2) * 1.4;
      a.ty = plaza.y + 1;
      return a;
    };
    mkR(0, 8, true);
    mkR(1, 9, false);
    mkR(2, 8, false);
    mkR(3, 9, false);
    mkR(4, 8, true);
    this.d.sound('fanfare', door.x, door.y);
  }

  private jousting(f: LifeFrame, ta: { x: number; y: number }, tb: { x: number; y: number }, realm: RealmId): void {
    const knights = this.cast.filter((a) => a.role === 'knight');
    if (!knights.length) {
      const model = armyKind(realm, 'cavalry');
      for (let i = 0; i < 2; i++) {
        const p = i ? tb : ta;
        const a = this.beast(model, p.x, p.y, { x: p.x, y: p.y, r: 1 });
        a.role = 'knight';
        a.hours = [0, 24];
        a.slot = i;
        a.speed = 5.2;
        a.tx = i ? ta.x : tb.x;
        a.ty = i ? ta.y : tb.y;
        a.st = 'idle';
      }
      // spectators along the lists
      const mx = (ta.x + tb.x) / 2,
        my = (ta.y + tb.y) / 2;
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1;
        const a = this.person(
          'crowd',
          Math.floor(hash2(i, 5, 5, 5) * COSMETIC_OUTFITS),
          mx - 8 + i * 1.8,
          my + side * 3.4,
          {
            hours: [0, 24],
            home: { x: mx, y: my, r: 1 },
          },
        );
        a.st = 'work';
        a.slot = 100 + i;
        a.dir = dirOf(0, -side);
      }
      this.joust = { t: 0, round: 0 };
      return;
    }
    this.joust.t += f.dt;
    for (const k of knights) {
      if (k.st === 'idle' && this.joust.t > 1.5 + (k.slot ? 0.2 : 0)) k.st = 'walk';
    }
    const [a, b] = knights;
    if (a && b && a.st === 'walk' && b.st === 'walk') {
      // clash when the two pass the midpoint
      if (Math.hypot(a.x - b.x, a.y - b.y) < 1.6) {
        this.d.fx().burst((a.x + b.x) / 2, (a.y + b.y) / 2, SPARK, 14);
        this.d.fx().ring((a.x + b.x) / 2, (a.y + b.y) / 2, 22, 1.4, 0.5);
        this.d.sound('cheer', a.x, a.y);
        this.joust.round++;
        for (const k of knights) k.speed = 5.2;
      }
    }
    for (const k of knights) {
      if (k.st === 'walk' && Math.hypot(k.tx - k.x, k.ty - k.y) < 0.6) {
        // swap ends and rest before the next pass
        const tmp = { x: ta.x, y: ta.y };
        const goTo = Math.hypot(k.tx - tmp.x, k.ty - tmp.y) < 1 ? tb : ta;
        k.tx = goTo.x;
        k.ty = goTo.y;
        k.st = 'idle';
        this.joust.t = 0;
      }
    }
  }

  private stopJoust(): void {
    for (const a of this.cast) if (a.role === 'knight') a.ttl = a.t;
  }

  // ───────────────────────── behaviour ─────────────────────────

  private blocked(x: number, y: number): boolean {
    return this.d.store().solidAt(Math.floor(x), Math.floor(y));
  }
  private moveTo(a: Actor, dt: number, speed: number): boolean {
    const dx = a.tx - a.x,
      dy = a.ty - a.y,
      d = Math.hypot(dx, dy);
    if (d < 0.1) return true;
    const s = Math.min(d, speed * dt);
    const nx = a.x + (dx / d) * s,
      ny = a.y + (dy / d) * s;
    if (this.blocked(nx, ny)) {
      // slide along an axis before giving up
      if (!this.blocked(a.x + (dx / d) * s, a.y)) a.x += (dx / d) * s;
      else if (!this.blocked(a.x, a.y + (dy / d) * s)) a.y += (dy / d) * s;
      else return true;
      return false;
    }
    a.x = nx;
    a.y = ny;
    this.face(a, dx, dy);
    return false;
  }
  private face(a: Actor, dx: number, dy: number): void {
    const sd = screenDir(dx, dy);
    a.dir = dirOf(sd.x, sd.y);
    a.face = dir4(sd.x, sd.y, a.face);
  }
  private wander(a: Actor, r = a.home.r): void {
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2,
        d = Math.random() * r;
      const x = a.home.x + Math.cos(ang) * d,
        y = a.home.y + Math.sin(ang) * d;
      if (!this.blocked(x, y)) {
        a.tx = x;
        a.ty = y;
        return;
      }
    }
    a.tx = a.x;
    a.ty = a.y;
  }

  private step(a: Actor, f: LifeFrame, h: number, wet: boolean, hostiles: Array<{ x: number; y: number }>): void {
    a.t += f.dt;
    const day = this.hourIn(h, a.hours);
    // rain thins the crowd to the committed, snow and storms more so
    const crowdIdx = a.role === 'crowd' ? a.slot : 0;
    const shelter = wet && a.role === 'crowd' && crowdIdx % 3 !== 0 && !this.festival;
    const out =
      day &&
      !shelter &&
      !(a.role === 'farmer' && f.weather === 'storm') &&
      !(a.role === 'fisher' && f.weather === 'storm') &&
      !(a.role === 'crowd' && !this.festival && crowdIdx >= 4 && (h >= 18 || h < 8) && a.slot < 50);
    // festivals pull everyone out at all hours
    const festivalOut = this.festival && a.role === 'crowd' && h >= 8 && h < 23.5;
    const visible = out || festivalOut || a.ttl !== undefined || a.role === 'knight';
    a.root.visible = visible;
    if (!visible) return;
    const pd = Math.hypot(a.x - f.me.x, a.y - f.me.y);
    if (pd > 60) {
      a.root.visible = false;
      return;
    }

    // frightened villagers run from monsters
    const person =
      a.body.anchor.y > 0.9 && !a.animal && a.role !== 'beast' && a.role !== 'chicken' && a.role !== 'roofbird';
    if (person && a.role !== 'royal' && a.role !== 'knight') {
      let nd = 99,
        nh: { x: number; y: number } | null = null;
      for (const hs of hostiles) {
        const d = Math.hypot(hs.x - a.x, hs.y - a.y);
        if (d < nd) {
          nd = d;
          nh = hs;
        }
      }
      if (nh && nd < 7) {
        a.st = 'flee';
        a.danger = 3;
        const ang = Math.atan2(a.y - nh.y, a.x - nh.x);
        a.tx = a.x + Math.cos(ang) * 8;
        a.ty = a.y + Math.sin(ang) * 8;
        if (!a.bark && Math.random() < 0.02) this.say(a, pick(TALK.alarm!, Math.random()), f.now);
      } else if (a.st === 'flee') {
        a.danger -= f.dt;
        if (a.danger <= 0) {
          a.st = 'idle';
          a.t = 0;
        }
      }
    }

    switch (a.role) {
      case 'patron':
        this.patron(a, f);
        break;
      case 'smith':
        this.smith(a, f);
        break;
      case 'farmer':
        this.farmer(a, f);
        break;
      case 'fisher':
        this.fisher(a, f);
        break;
      case 'crowd':
        this.crowd(a, f);
        break;
      case 'vendor':
        this.vendor(a, f);
        break;
      case 'trader':
      case 'escort':
      case 'royal':
        this.mover(a, f);
        break;
      case 'knight':
        this.knight(a, f);
        break;
      case 'beast':
        this.graze(a, f, pd);
        break;
      case 'chicken':
        this.chickenStep(a, f, pd);
        break;
      case 'roofbird':
        this.roofStep(a, f, pd);
        break;
      case 'scene':
        if (a.st === 'flee' && !a.animal) this.flee(a, f);
        else if (!this.scenes.step(a, f)) a.root.visible = false;
        break;
    }
    // umbrellas in the rain
    if (person) this.umbrella(a, wet && a.umbrella);
    this.place(a);
  }

  private hourIn(h: number, [a, b]: [number, number]): boolean {
    return b > 24 ? h >= a || h < b - 24 : h >= a && h < b;
  }

  private sit(a: Actor, f: LifeFrame): void {
    a.body.texture = this.tex(a, a.dir, f.reduced ? 0 : 0);
  }
  /** a villager's frame: their own sheet once built (at most one build per frame), a plain stand-in until then */
  private tex(a: Actor, dir: number, frame: number) {
    const sh = this.d.sheets();
    if (sh.styledReady(a.look, a.app) || this.budget > 0) {
      if (!sh.styledReady(a.look, a.app)) this.budget--;
      a.body.visible = true;
      return sh.styled(a.look, a.app, dir, frame);
    }
    // not built yet: stay out of sight rather than appear as a stranger in a stock outfit
    a.body.visible = false;
    return a.body.texture;
  }
  private walkFrame(a: Actor, speed: number): number {
    return 1 + (Math.floor(a.t * 7 * speed) % (WALK_FRAMES - 1));
  }

  private patron(a: Actor, f: LifeFrame): void {
    // loiter, turn to talk, now and then raise a cheer
    if (a.st === 'flee') return this.flee(a, f);
    if (a.t > 4 + a.slot * 1.3) {
      a.t = 0;
      a.dir = dirOf(Math.random() < 0.5 ? -1 : 1, Math.random() < 0.5 ? 0.6 : 1);
      if (Math.random() < 0.25 && !a.bark) this.say(a, pick(TALK.patron!, Math.random()), f.now);
    }
    this.sit(a, f);
    a.z = f.reduced ? 0 : Math.max(0, Math.sin(f.now / 400 + a.phase)) * 0.8;
  }

  private smith(a: Actor, f: LifeFrame): void {
    if (a.st === 'flee') return this.flee(a, f);
    // 4-frame hammer cycle with a strike every ~0.8s: sparks and the anvil ring while someone is near
    const cyc = 0.8;
    const k = (a.t % cyc) / cyc;
    const fr = Math.min(3, Math.floor(k * 4));
    a.body.texture = this.tex(a, a.dir, f.reduced ? 0 : ATTACK_FRAME + fr);
    const strike = Math.floor(a.t / cyc);
    if ((a as unknown as { lastStrike?: number }).lastStrike !== strike) {
      (a as unknown as { lastStrike?: number }).lastStrike = strike;
      if (!f.reduced) {
        const pd = Math.hypot(a.x - f.me.x, a.y - f.me.y);
        this.d.fx().burst(a.x + 0.9, a.y - 0.3, SPARK, 5);
        if (pd < 14 && strike % 2 === 0) this.d.sound('anvil', a.x, a.y);
      }
    }
  }

  private farmer(a: Actor, f: LifeFrame): void {
    if (a.st === 'flee') return this.flee(a, f);
    if (a.st === 'idle' && a.t > 1.5 + a.slot) {
      // walk a furrow: pick a point along the row then turn back
      const row = Math.floor(Math.random() * 5);
      a.tx = a.home.x + (a.slot ? 3 : -3) + (Math.random() - 0.5) * 5;
      a.ty = a.home.y - 2 + row * 1.1;
      if (this.blocked(a.tx, a.ty)) this.wander(a);
      a.st = 'walk';
      a.t = 0;
    }
    if (a.st === 'walk') {
      const done = this.moveTo(a, f.dt, 0.8);
      a.body.texture = this.tex(a, a.dir, this.walkFrame(a, 0.8));
      if (done) {
        a.st = 'work';
        a.t = 0;
      }
    } else if (a.st === 'work') {
      // tending the crop: hoe strokes
      const fr = f.reduced ? 0 : ATTACK_FRAME + (Math.floor(a.t * 2.2) % 4);
      a.body.texture = this.tex(a, dirOf(0.5, 1), fr);
      if (a.t > 4 + Math.random()) {
        a.st = 'idle';
        a.t = 0;
        if (Math.random() < 0.2) this.say(a, pick(TALK.farmer!, Math.random()), f.now);
      }
    } else this.sit(a, f);
  }

  private fisher(a: Actor, f: LifeFrame): void {
    if (a.st === 'flee') return this.flee(a, f);
    this.sit(a, f);
    const g = a.extra;
    if (!g) return;
    // rod: a thin line from the hands to a bobber that dips now and then
    const sd = { x: a.tx - a.x, y: a.ty - a.y };
    const p0 = { x: 0, y: -18 };
    const end = { x: isoX(a.tx, a.ty) - isoX(a.x, a.y), y: isoY(a.tx, a.ty) - isoY(a.x, a.y) };
    const dip = Math.max(0, Math.sin(a.t * 0.9 + a.phase) - 0.92) * 40;
    // the rod is an isometric sprite angled out over the water; only the line itself is a drawn string
    if (!g.children.length) {
      const art = rodSprite(a.tx - a.x > a.ty - a.y ? 'sw' : 'se');
      const sp = new Sprite(art.tex);
      sp.anchor.set(art.ax / art.tex.width, art.ay / art.tex.height);
      sp.position.set(p0.x + 3, p0.y);
      g.addChild(sp);
    }
    // the rod tip in screen pixels: 14 units out along the rod's axis, 18 up (see rodSprite)
    const tip = a.tx - a.x > a.ty - a.y ? { x: 14, y: -11 } : { x: -14, y: -11 };
    g.clear()
      .moveTo(p0.x + 3 + tip.x, p0.y + tip.y)
      .quadraticCurveTo((p0.x + tip.x + end.x) / 2, p0.y - 4, end.x, end.y + dip * 0.2)
      .stroke({ color: 0xe8e0d0, width: 0.6, alpha: 0.8 })
      .circle(end.x, end.y + dip * 0.2, 1.3)
      .fill(0xd23a2a);
    void sd;
    if (dip > 0.6 && !(a as unknown as { fish?: boolean }).fish) {
      (a as unknown as { fish?: boolean }).fish = true;
      this.d.fx().ring(a.tx, a.ty, 46, 0.9, 0.7);
      if (Math.random() < 0.4) this.say(a, 'Got one!', f.now);
    } else if (dip <= 0.6) (a as unknown as { fish?: boolean }).fish = false;
  }

  private crowd(a: Actor, f: LifeFrame): void {
    if (a.st === 'flee') return this.flee(a, f);
    if (a.slot >= 100) {
      // spectators cheer when the lances meet
      this.sit(a, f);
      a.z = this.joust.t < 0.6 && this.joust.round > 0 && !f.reduced ? 2 + Math.sin(a.t * 20) : 0;
      return;
    }
    if (a.st === 'idle' && a.t > 1.2 + (a.phase % 3)) {
      const f0 =
        this.fronts.length && !this.festival ? this.fronts[Math.floor(Math.random() * this.fronts.length)]! : null;
      if (f0 && Math.random() < 0.65) {
        a.tx = f0.x + (Math.random() - 0.5) * 1.4;
        a.ty = f0.y - 0.3;
        a.slot2 = 1;
      } else {
        this.wander(a, a.home.r);
        a.slot2 = 0;
      }
      a.st = 'walk';
      a.t = 0;
    }
    if (a.st === 'walk') {
      const wet = f.weather === 'rain' || f.weather === 'storm';
      const spd = (this.festival ? 0.9 : 1.15) * (wet ? 1.5 : 1);
      const done = this.moveTo(a, f.dt, spd);
      a.body.texture = this.tex(a, a.dir, this.walkFrame(a, spd));
      if (done) {
        a.st = 'idle';
        // customers face the stall and linger over the goods
        if (a.slot2) {
          a.dir = dirOf(0, -1);
          a.t = -4 - Math.random() * 5;
        } else a.t = Math.random() < 0.3 ? -3 : 0;
      }
    } else {
      this.sit(a, f);
      // festival revellers dance on the spot
      a.z = this.festival && !f.reduced ? Math.abs(Math.sin(f.now / 220 + a.phase)) * 3 : 0;
    }
    const pd = Math.hypot(a.x - f.me.x, a.y - f.me.y);
    if (!a.bark && pd < 5 && Math.random() < 0.003) {
      const pool =
        f.weather === 'rain' || f.weather === 'storm' ? TALK.rain! : this.festival ? TALK.festival! : TALK.crowd!;
      this.say(a, pick(pool, Math.random()), f.now);
    }
  }

  private vendor(a: Actor, f: LifeFrame): void {
    if (a.st === 'flee') return this.flee(a, f);
    this.sit(a, f);
    a.z = f.reduced ? 0 : Math.max(0, Math.sin(f.now / 500 + a.phase)) * 0.7;
    const pd = Math.hypot(a.x - f.me.x, a.y - f.me.y);
    if (!a.bark && pd < 7 && Math.random() < 0.006) this.say(a, pick(CRIES[a.slot]!, Math.random()), f.now);
    // lean toward whoever is near
    if (pd < 4) {
      const sd = screenDir(f.me.x - a.x, f.me.y - a.y);
      a.dir = dirOf(sd.x, sd.y);
    }
  }

  private mover(a: Actor, f: LifeFrame): void {
    if (a.st === 'flee') return this.flee(a, f);
    if (a.st === 'walk') {
      const done = this.moveTo(a, f.dt, a.speed);
      if (a.model >= 0 && a.rider) {
        a.body.texture = this.d.foes().frame(a.model, false, a.face, 'move', Math.floor(a.t * 6));
        a.rider.texture = this.tex(a, a.dir, 0);
        a.rider.scale.x = 1;
      } else if (a.body.anchor.y < 0.95 && a.model >= 0)
        a.body.texture = this.d
          .foes()
          .frame(a.model, false, a.face, 'move', Math.floor(a.t * 6) % this.d.foes().frames(a.model, 'move'));
      else a.body.texture = this.tex(a, a.dir, this.walkFrame(a, a.speed / 1.2));
      if (done) {
        a.st = 'idle';
        a.t = 0;
        if (a.role === 'trader') this.say(a, pick(TALK.trader!, Math.random()), f.now);
      }
    } else {
      if (a.model >= 0 && a.rider) {
        a.body.texture = this.d.foes().frame(a.model, false, a.face, 'idle', 0);
        a.rider.texture = this.tex(a, a.dir, 0);
      } else if (a.model >= 0) a.body.texture = this.d.foes().frame(a.model, false, a.face, 'idle', 0);
      else this.sit(a, f);
      // visitors linger, then head back out the gate they came from
      if (a.role !== 'royal' && !a.leave && a.t > 38) {
        a.leave = true;
        const t = this.town!;
        const gates = Object.entries(t.spots).filter(([k]) => k.endsWith('.gate'));
        const g = gates.length ? gates[a.slot % gates.length]![1] : { x: t.cx, y: t.y1 };
        a.tx = g.x;
        a.ty = g.y;
        a.st = 'walk';
        a.ttl = a.t + 25;
      }
      if (a.role === 'royal' && a.t > 8 && !a.leave) {
        a.leave = true;
        const t = this.town!;
        const door = t.spots[`${this.site!.id}.palace_door`];
        if (door) {
          a.tx = door.x + (a.slot - 2) * 1.4;
          a.ty = door.y + 1;
          a.st = 'walk';
        }
      }
    }
  }

  private knight(a: Actor, f: LifeFrame): void {
    const moving = a.st === 'walk';
    if (moving) this.moveTo(a, f.dt, a.speed);
    a.body.texture = this.d
      .foes()
      .frame(a.model, false, a.face, moving ? 'move' : 'idle', moving ? Math.floor(a.t * 8) : 0);
  }

  private graze(a: Actor, f: LifeFrame, pd: number): void {
    const foes = this.d.foes();
    if (pd < 2 && a.st !== 'flee') {
      a.st = 'walk';
      const ang = Math.atan2(a.y - f.me.y, a.x - f.me.x);
      a.tx = a.x + Math.cos(ang) * 3;
      a.ty = a.y + Math.sin(ang) * 3;
      if (this.blocked(a.tx, a.ty)) a.tx = a.x;
    }
    if (a.st === 'walk' || a.st === 'flee') {
      const done = this.moveTo(a, f.dt, a.speed * (pd < 2.5 ? 1.7 : 1));
      a.body.texture = foes.frame(
        a.model,
        false,
        a.face,
        'move',
        Math.floor(a.t * 5) % Math.max(1, foes.frames(a.model, 'move')),
      );
      if (done) {
        a.st = 'idle';
        a.t = 0;
      }
    } else {
      a.body.texture = foes.frame(
        a.model,
        false,
        a.face,
        'idle',
        f.reduced ? 0 : Math.floor(a.t * 1.6) % Math.max(1, foes.frames(a.model, 'idle')),
      );
      if (a.t > 3 + (a.phase % 5)) {
        this.wander(a);
        a.st = 'walk';
        a.t = 0;
      }
    }
  }

  private chickenStep(a: Actor, f: LifeFrame, pd: number): void {
    const art = this.d.art();
    if (!art) return;
    if (pd < 2 && a.st !== 'walk') {
      a.st = 'walk';
      a.tx = a.x + (a.x - f.me.x) * 1.2;
      a.ty = a.y + (a.y - f.me.y) * 1.2;
      if (this.blocked(a.tx, a.ty)) {
        a.tx = a.x;
        a.ty = a.y;
      }
    }
    if (a.st === 'walk') {
      const done = this.moveTo(a, f.dt, a.speed * 1.4);
      a.body.texture = art.chicken[2 + (Math.floor(a.t * 8) % 2)]!;
      a.body.scale.x = a.tx - a.x >= a.ty - a.y ? 1 : -1;
      if (done) {
        a.st = 'idle';
        a.t = 0;
      }
    } else {
      a.body.texture = art.chicken[Math.floor(f.now / 500 + a.phase) % 3 === 0 ? 1 : 0]!;
      if (a.t > 2 + (a.phase % 3)) {
        this.wander(a);
        a.st = 'walk';
        a.t = 0;
      }
    }
  }

  private roofStep(a: Actor, f: LifeFrame, pd: number): void {
    const art = this.d.art();
    if (!art) return;
    if (a.st !== 'fly' && pd < 5) {
      // spooked: fly to another roof of the settlement
      const t = this.town!;
      const b = t.buildings[Math.floor(Math.random() * t.buildings.length)]!;
      a.tx = b.x + b.w * 0.5;
      a.ty = b.y + b.h * 0.5;
      a.st = 'fly';
      a.t = 0;
    }
    if (a.st === 'fly') {
      const dx = a.tx - a.x,
        dy = a.ty - a.y,
        d = Math.hypot(dx, dy);
      const s = Math.min(d, 5 * f.dt);
      if (d > 0.1) {
        a.x += (dx / d) * s;
        a.y += (dy / d) * s;
        a.body.scale.x = dx - dy >= 0 ? 1 : -1;
      }
      a.z = 46 + Math.sin(Math.min(1, a.t / 2) * Math.PI) * 14;
      a.body.texture = art.pigeon[2 + (Math.floor(a.t * 14) % 2)]!;
      if (d < 0.2) {
        a.st = 'idle';
        a.z = 46;
        a.t = 0;
      }
    } else {
      a.z = 46;
      a.body.texture = art.pigeon[Math.floor(f.now / 900 + a.phase) % 5 === 0 ? 1 : 0]!;
      a.body.scale.x = a.face;
    }
  }

  private flee(a: Actor, f: LifeFrame): void {
    this.moveTo(a, f.dt, 2.7);
    a.body.texture = this.tex(a, a.dir, this.walkFrame(a, 2));
  }

  private umbrella(a: Actor, on: boolean): void {
    if (!on) {
      if (a.extra && a.role !== 'fisher') {
        a.extra.destroy();
        a.extra = null;
      }
      return;
    }
    if (a.role === 'fisher') return;
    if (!a.extra) {
      // an isometric umbrella held up at the hand (its stick foot sits at the grip)
      const art = umbrellaSprite(['r3', 'w3', 'e5', 'g3'][a.look % 4]!);
      const sp = new Sprite(art.tex);
      sp.anchor.set(art.ax / art.tex.width, art.ay / art.tex.height);
      sp.position.set(3 * a.body.scale.y, -18 * a.body.scale.y);
      a.extra = new Graphics();
      a.extra.addChild(sp);
      a.root.addChild(a.extra);
    }
  }

  // ───────────────────────── speech ─────────────────────────

  private say(a: Actor, text: string, now: number): void {
    a.bark = { text, until: now + 3200 };
  }
  private bubblesFrame(f: LifeFrame): void {
    const talkers = this.cast.filter((a) => a.bark && a.root.visible && a.bark.until > f.now);
    for (const a of this.cast) if (a.bark && a.bark.until <= f.now) a.bark = undefined;
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
      const a = talkers[i];
      b.visible = !!a;
      if (!a) return;
      const p = this.d.toScreen(a.x, a.y);
      if (b.text !== a.bark!.text) b.text = a.bark!.text;
      b.x = Math.round(p.x);
      b.y = Math.round(p.y - 74 - a.z);
      b.alpha = Math.min(1, (a.bark!.until - f.now) / 400);
    });
  }

  // ───────────────────────── bells, bunting, fireworks ─────────────────────────

  private bellCheck(f: LifeFrame): void {
    const h = f.hour;
    const crossed = (x: number) => this.lastHour < x && h >= x && h - this.lastHour < 1;
    if ([6, 12, 18].some(crossed) || (this.lastHour > 23 && h < 1)) {
      const t = this.town!;
      const tower = t.buildings.find((b) => b.kind === 'tower') ?? t.buildings.find((b) => b.kind === 'hall');
      if (tower) {
        const x = tower.x + tower.w / 2,
          y = tower.y + tower.h / 2;
        this.d.sound('bell', x, y);
        this.d.fx().ring(x, y, 22, 5, 1.6, 1);
        for (const a of this.cast)
          if (a.role === 'roofbird' && a.st !== 'fly')
            ((a.t = 0),
              (a.st = 'fly'),
              (a.tx = a.x + (Math.random() - 0.5) * 20),
              (a.ty = a.y + (Math.random() - 0.5) * 20));
      }
    }
    this.lastHour = h;
  }

  private sky(f: LifeFrame): void {
    const layer = this.d.layer();
    // festival bunting between the plaza banners
    if (this.festival && this.town && this.site && !this.bunting) {
      const t = this.town;
      const pa = t.spots[`${this.site.id}.plaza_a`],
        pb = t.spots[`${this.site.id}.plaza_b`];
      if (pa && pb) {
        const g = new Graphics();
        g.zIndex = 1e6;
        const rows = [pa.y + 1, pb.y - 1];
        for (const ry of rows) this.string(g, pa.x, ry, pb.x, ry);
        for (const rx of [pa.x + 1, pb.x - 1]) this.string(g, rx, pa.y, rx, pb.y);
        layer.addChild(g);
        this.bunting = g;
      }
    } else if (!this.festival && this.bunting) {
      this.bunting.destroy();
      this.bunting = null;
    }
    // fireworks over a festival night
    const night = f.hour >= 20 || f.hour < 1;
    if (this.festival && night && !f.reduced && this.town && this.site) {
      this.nextRocket -= f.dt;
      if (this.nextRocket <= 0) {
        this.nextRocket = rnd(1.2, 3.2);
        const plaza = this.town.spots[`${this.site.id}.plaza`] ?? { x: this.town.cx, y: this.town.cy };
        this.rockets.push({
          x: plaza.x + rnd(-8, 8),
          y: plaza.y + rnd(-6, 6),
          vy: rnd(70, 100),
          z: 0,
          t: 0,
          hue: Math.floor(Math.random() * FIREWORK.length),
          burst: false,
        });
        this.d.sound('horn', plaza.x, plaza.y);
      }
    }
    if (!this.rockets.length && !this.sparks.length) {
      if (this.shows) this.shows.clear();
      return;
    }
    if (!this.shows) {
      this.shows = new Graphics();
      this.shows.zIndex = 1e6 + 1;
      this.shows.blendMode = 'add';
      layer.addChild(this.shows);
    }
    const g = this.shows;
    g.clear();
    for (const r of this.rockets) {
      r.t += f.dt;
      r.z += r.vy * f.dt;
      r.vy -= 60 * f.dt;
      const sx = isoX(r.x, r.y),
        sy = isoY(r.x, r.y) - 60 - r.z;
      g.circle(sx, sy, 1.4).fill(0xffe8a0);
      if (r.vy <= 8 && !r.burst) {
        r.burst = true;
        for (let i = 0; i < 30; i++) {
          const ang = (i / 30) * Math.PI * 2,
            sp = rnd(18, 36);
          this.sparks.push({ x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, t: 0, hue: r.hue });
        }
      }
    }
    this.rockets = this.rockets.filter((r) => !r.burst);
    for (const s of this.sparks) {
      s.t += f.dt;
      s.x += s.vx * f.dt;
      s.y += s.vy * f.dt;
      s.vy += 22 * f.dt;
      s.vx *= 0.985;
      const k = 1 - s.t / 1.6;
      if (k > 0) g.circle(s.x, s.y, 1.2).fill({ color: FIREWORK[s.hue]!, alpha: k });
    }
    this.sparks = this.sparks.filter((s) => s.t < 1.6);
  }

  /** a drooping string of pennants between two tile positions */
  private string(g: Graphics, x0: number, y0: number, x1: number, y1: number): void {
    const n = Math.max(6, Math.round(Math.hypot(x1 - x0, y1 - y0) * 1.1));
    const cols = [0xd23a3a, 0xf0c040, 0x3a8ad2, 0xf0f0e0, 0x4aa05a];
    let px = isoX(x0, y0),
      py = isoY(x0, y0) - 40;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const x = isoX(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
      const y = isoY(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k) - 40 + Math.sin(k * Math.PI) * 7;
      g.moveTo(px, py).lineTo(x, y).stroke({ color: 0x3a2a1a, width: 1 });
      // each pennant hangs in the vertical plane of the string: its top edge follows the string's iso slope
      const mx = (px + x) / 2,
        my = (py + y) / 2,
        ux = (x - px) * 0.32,
        uy = (y - py) * 0.32;
      g.poly([mx - ux, my - uy, mx + ux, my + uy, mx, my + 6]).fill(cols[i % cols.length]!);
      px = x;
      py = y;
    }
  }

  private place(a: Actor): void {
    a.root.x = Math.round(isoX(a.x, a.y));
    a.root.y = Math.round(isoY(a.x, a.y));
    a.root.zIndex = depth(a.x, a.y) + (a.role === 'roofbird' ? 300 : 0);
    a.body.y = -Math.round(a.z);
    if (a.rider) a.rider.y = -14 - Math.round(a.z);
    const r =
      a.role === 'beast' || a.role === 'knight' || a.model >= 0
        ? 9
        : a.role === 'chicken' || a.animal === 'cat' || a.animal === 'dog'
          ? 3.5
          : a.animal === 'prop' || a.animal === 'pigeon'
            ? 0
            : a.small
              ? 3.6
              : a.role === 'roofbird'
                ? 0
                : 5;
    a.shadow.clear();
    if (r > 0)
      a.shadow.ellipse(0, 0, r * (1 - Math.min(0.5, a.z * 0.02)), r * 0.5).fill({ color: 0x2a1060, alpha: 0.26 });
  }
}

const siteCache = new WeakMap<Town, RealmSite | null>();
/** home towns, frontier towns and the lived-in Undercroft towns stand in for a kingdom site */
const homeTowns = new WeakSet<Town>();
function siteOf(t: Town): RealmSite | null {
  if (t.site) return t.site;
  const hit = siteCache.get(t);
  if (hit !== undefined) return hit;
  let site: RealmSite | null = null;
  for (const k of Object.keys(t.spots)) {
    const id = k.split('.')[0]!;
    const s = REALM_SITE_BY_ID[id];
    if (s) {
      site = s;
      break;
    }
  }
  // any other lived-in town (not Hadamere itself, which has its own street life): a stand-in village-sized site whose
  // id is the town's own spot prefix, so its inn, smithy and fishing bank fill up like a kingdom town's do
  if (!site && !t.abandoned && t.buildings.length && !(t.cx === HADAMERE.cx && t.cy === HADAMERE.cy)) {
    const id = Object.keys(t.spots)[0]?.split('.')[0] ?? t.name.toLowerCase();
    site = {
      id,
      name: t.name,
      realm: nearestRealm(t.cx, t.cy)?.id ?? 'aurelion',
      kind: 'town',
      cx: t.cx,
      cy: t.cy,
      w: t.x1 - t.x0,
      h: t.y1 - t.y0,
      ring: 'c',
    };
    homeTowns.add(t);
  }
  siteCache.set(t, site);
  return site;
}
const HADAMERE = { cx: NaN, cy: NaN };
