import { Container, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import {
  KINGDOMS,
  WAYFARER_BARKS,
  WILD_BARKS,
  armyKind,
  dayNumber,
  gameHour,
  cottagerOf,
  isCivOwner,
  plotsNear,
  weatherForDay,
  hash2,
  wayfarersNear,
  wildFolkNear,
  wildFolkOut,
  type WayfarerPos,
  type WildFolk,
} from '@eigenlands/shared';
import { ATTACK_FRAME, COSMETIC_OUTFITS, WALK_FRAMES, dirOf } from '../../art/actors';
import { livestockTexture } from '../../art/livestock';
import { handcartSprite, lanternGlow, stoolSprite } from '../../art/roadlife';
import { standardSprite } from '../../art/scene-props';
import { dir4 } from '../../art/sprite';
import { depth, isoX, isoY, screenDir } from '../../game/iso';
import type { P34Deps } from '../types';

/** how far away travellers and wild workers are drawn */
const VIEW = 44;
/** how close you must pass for someone to speak, and how long before they speak again */
const BARK_NEAR = 3.4;
const BARK_EVERY = 30;

interface Member {
  sp: Sprite;
  /** sheep, cart and lantern ride along with their person */
  kind:
    | 'person'
    | 'soldier'
    | 'archer'
    | 'cavalry'
    | 'officer'
    | 'standard'
    | 'horse'
    | 'rider'
    | 'sheep'
    | 'cow'
    | 'goat'
    | 'pig'
    | 'cart'
    | 'glow'
    | 'prop';
  /** a fixed look (monks share a habit, a noble dresses finely) */
  look?: number;
  ox: number;
  oy: number;
}
interface View {
  root: Container;
  members: Member[];
  last: { x: number; y: number };
  travel: number;
  bark: Text | null;
  barkUntil: number;
  nextBark: number;
  seen: boolean;
}
/** where a wild worker is in their patch, and what they are doing */
interface Wander {
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  fx: number;
  fy: number;
}

const crops = new WeakMap<Texture, Texture>();
/** the courier sits on the horse: drawn from the hips up */
function seated(t: Texture): Texture {
  let c = crops.get(t);
  if (!c) {
    const f = t.frame;
    c = new Texture({ source: t.source, frame: new Rectangle(f.x, f.y, f.width, f.height - 9) });
    crops.set(t, c);
  }
  return c;
}
const facing4 = (fx: number, fy: number) => (Math.abs(fx) >= Math.abs(fy) ? (fx < 0 ? 2 : 0) : fy < 0 ? 3 : 1);

/**
 * Road and wild life (master plan §16/§19): the travellers on the kingdom roads (shared wayfarers.ts) and the people
 * working out in the wilds (shared wildfolk.ts). Visual only, like the town life: positions come from the seed and
 * clock (travellers) or wander on the client (wild folk), nothing collides or is synced, and only what is near the
 * player is built.
 */
export class RoadLife {
  private views = new Map<string, View>();
  private wander = new Map<string, Wander>();
  private at = 0;
  private folk: WildFolk[] = [];

  constructor(private d: P34Deps) {}

  frame(now: number, dt: number): void {
    const me = this.d.me();
    const store = this.d.store();
    if (!me || store.generation < 5) {
      this.clear();
      return;
    }
    const seed = store.seed;
    const server = this.d.clock.serverNow(now);
    const hour = gameHour(server);
    const reduced = this.d.settings().reducedMotion;
    const seen = new Set<string>();
    for (const p of wayfarersNear(seed, me.x, me.y, VIEW, server)) {
      seen.add(p.w.id);
      this.drawWayfarer(this.views.get(p.w.id) ?? this.make(p.w.id, p), p, hour, now, reduced);
    }
    // wild folk: look the spots up a few times a second, move them every frame
    if (now - this.at > 400) {
      this.at = now;
      const weather = weatherForDay(seed, dayNumber(server));
      // the families in a kingdom's new cottages (only where a cottage really stands)
      const cottagers = plotsNear(seed, me.x, me.y, VIEW)
        .filter((pl) => Math.hypot(pl.x - me.x, pl.y - me.y) < VIEW && isCivOwner(store.structureAt(pl.x, pl.y)?.owner))
        .map((pl) => cottagerOf(pl.x, pl.y));
      this.folk = [...wildFolkNear(seed, me.x, me.y, VIEW), ...cottagers].filter((f) => wildFolkOut(f, hour, weather));
    }
    for (const f of this.folk) {
      seen.add(f.id);
      const v = this.views.get(f.id) ?? this.makeFolk(f);
      this.drawFolk(v, f, dt / 1000, now, reduced);
    }
    for (const [id, v] of this.views)
      if (!seen.has(id)) {
        v.root.destroy({ children: true });
        v.bark?.destroy();
        this.views.delete(id);
        this.wander.delete(id);
      }
    // speech: someone close by says hello now and then
    for (const [id, v] of this.views) {
      const x = v.last.x,
        y = v.last.y;
      if (v.bark && now > v.barkUntil) {
        v.bark.destroy();
        v.bark = null;
      }
      if (!v.bark && now > v.nextBark && Math.hypot(x - me.x, y - me.y) < BARK_NEAR) {
        const lines = id.startsWith('wf')
          ? WILD_BARKS[this.folk.find((f) => f.id === id)?.kind ?? 'forager']
          : WAYFARER_BARKS[(this.kindOf.get(id) ?? 'pilgrim') as keyof typeof WAYFARER_BARKS];
        const text = lines[Math.floor(Math.random() * lines.length)]!;
        v.bark = new Text({
          text,
          style: { fontFamily: 'monospace', fontSize: 11, fill: 0xfff6dc, stroke: { color: 0x1b1420, width: 3 } },
        });
        v.bark.anchor.set(0.5, 1);
        this.d.labelLayer().addChild(v.bark);
        v.barkUntil = now + 3200;
        v.nextBark = now + BARK_EVERY * 1000;
      }
      if (v.bark) {
        const s = this.d.toScreen(x, y);
        v.bark.position.set(Math.round(s.x), Math.round(s.y - 46));
      }
    }
  }

  private kindOf = new Map<string, string>();

  count(): number {
    return this.views.size;
  }

  private clear(): void {
    for (const v of this.views.values()) {
      v.root.destroy({ children: true });
      v.bark?.destroy();
    }
    this.views.clear();
    this.wander.clear();
  }

  private newView(id: string, nextBark: number): View {
    const root = new Container();
    root.sortableChildren = true;
    this.d.entityLayer().addChild(root);
    const v: View = {
      root,
      members: [],
      last: { x: NaN, y: NaN },
      travel: 0,
      bark: null,
      barkUntil: 0,
      nextBark,
      seen: true,
    };
    this.views.set(id, v);
    return v;
  }
  private add(v: View, kind: Member['kind'], ox = 0, oy = 0, look?: number): Sprite {
    const sp = new Sprite();
    sp.anchor.set(0.5, 1);
    v.root.addChild(sp);
    v.members.push({ sp, kind, ox, oy, look });
    return sp;
  }

  private make(id: string, p: WayfarerPos): View {
    const w = p.w;
    this.kindOf.set(id, w.kind);
    const v = this.newView(id, performance.now() + hash2(w.look, 1, 2, 3) * 8000);
    switch (w.kind) {
      case 'courier':
        this.add(v, 'horse');
        this.add(v, 'rider');
        this.add(v, 'glow');
        break;
      case 'patrol':
        for (let i = 0; i < 3; i++) this.add(v, 'soldier', -i * 1.1, (i % 2 ? 0.45 : -0.45) * (i ? 1 : 0));
        this.add(v, 'glow');
        break;
      case 'shepherd':
        this.add(v, 'person');
        for (let i = 0; i < w.party; i++)
          this.add(v, 'sheep', 0.9 + (i % 3) * 0.8, ((i % 2) - 0.5) * 1.2 + (i > 2 ? 0.4 : 0));
        break;
      case 'carter':
        this.add(v, 'person');
        this.add(v, 'cart', 1.3, 0);
        break;
      case 'hunter':
        this.add(v, 'person');
        this.add(v, 'person', -1, 0.5);
        break;
      case 'column': {
        // a mounted officer, the standard-bearer, then the company two abreast, archers at the rear
        this.add(v, 'officer', 1.6, 0);
        this.add(v, 'soldier', 0, -0.45);
        this.add(v, 'standard', 0, -0.45);
        this.add(v, 'soldier', 0, 0.45);
        for (let rank = 1; rank <= 3; rank++)
          for (const side of [-0.45, 0.45]) this.add(v, rank === 3 ? 'archer' : 'soldier', -rank * 1.15, side);
        this.add(v, 'glow');
        break;
      }
      case 'knights':
        for (let i = 0; i < 3; i++) this.add(v, 'cavalry', -i * 2, i % 2 ? 0.35 : -0.35);
        break;
      case 'drover':
      case 'goatherd':
      case 'swineherd': {
        const beast = w.kind === 'drover' ? 'cow' : w.kind === 'goatherd' ? 'goat' : 'pig';
        // the herd goes ahead, the herder walks behind with a stick
        this.add(v, 'person', -1.4, 0);
        for (let i = 0; i < w.party; i++)
          this.add(v, beast, (i % 2) * 1.1 + Math.floor(i / 2) * 1.3, ((i % 3) - 1) * 0.55);
        break;
      }
      case 'monks': {
        const habit = Math.floor(hash2(w.look, 9, 9, 9) * COSMETIC_OUTFITS);
        for (let i = 0; i < 3; i++) this.add(v, 'person', -i * 1.05, 0, habit);
        break;
      }
      case 'market':
        this.add(v, 'person');
        this.add(v, 'cart', 1.3, 0);
        this.add(v, 'person', -0.6, 0.6).scale.set(0.72);
        break;
      case 'noble':
        this.add(v, 'horse');
        this.add(v, 'rider');
        this.add(v, 'soldier', -1.6, -0.45);
        this.add(v, 'soldier', -1.6, 0.45);
        break;
      case 'family':
        this.add(v, 'person');
        this.add(v, 'person', -0.9, 0.5);
        this.add(v, 'person', -0.5, -0.6).scale.set(0.72);
        break;
      default:
        this.add(v, 'person');
    }
    return v;
  }

  private drawWayfarer(v: View, p: WayfarerPos, hour: number, now: number, reduced: boolean): void {
    const sheets = this.d.sheets();
    const moved = Number.isFinite(v.last.x) ? Math.hypot(p.x - v.last.x, p.y - v.last.y) : 0;
    v.last = { x: p.x, y: p.y };
    v.travel += moved > 2 ? 0 : moved;
    v.root.position.set(isoX(p.x, p.y), isoY(p.x, p.y));
    v.root.zIndex = depth(p.x, p.y);
    const sd = screenDir(p.fx, p.fy);
    const dir = dirOf(sd.x, sd.y);
    const night = hour >= 20 || hour < 6.5;
    const step = (k: number, per: number) =>
      reduced ? 0 : 1 + (Math.floor((v.travel + k * 0.37) / per) % (WALK_FRAMES - 1));
    v.members.forEach((m, i) => {
      // members walk in a file behind the leader (offsets are along / across the heading)
      const ax = p.fx * -m.ox * -1 + -p.fy * m.oy,
        ay = p.fy * -m.ox * -1 + p.fx * m.oy;
      const s = screenDir(ax, ay);
      m.sp.position.set(s.x, s.y);
      m.sp.zIndex = s.y;
      const look = m.look ?? (p.w.look + i * 7) % COSMETIC_OUTFITS;
      switch (m.kind) {
        case 'person':
          m.sp.texture = sheets.person(look, dir, step(i, 0.17));
          break;
        case 'soldier': {
          const foes = this.d.foes?.();
          const model = armyKind(p.w.route.realm, 'infantry');
          // a marching column keeps step; a patrol's three walk at their own pace
          const inStep = p.w.kind === 'column';
          if (foes) {
            m.sp.anchor.set(0.5, foes.anchor(model));
            const n = foes.frames(model, 'move');
            m.sp.texture = foes.frame(
              model,
              false,
              dir4(sd.x, sd.y),
              'move',
              reduced ? 0 : Math.floor(v.travel / 0.2 + (inStep ? 0 : i)) % n,
            );
          } else m.sp.texture = sheets.person(look, dir, step(i, 0.17));
          break;
        }
        case 'archer':
        case 'cavalry':
        case 'officer': {
          const foes = this.d.foes?.();
          const cls = m.kind === 'archer' ? 'ranged' : m.kind === 'officer' ? 'elite' : 'cavalry';
          const model = armyKind(p.w.route.realm, cls === 'elite' ? 'cavalry' : cls);
          if (foes) {
            m.sp.anchor.set(0.5, foes.anchor(model));
            const n = foes.frames(model, 'move');
            // a company marches in step: every soldier on the same foot
            m.sp.texture = foes.frame(
              model,
              false,
              dir4(sd.x, sd.y),
              'move',
              reduced ? 0 : Math.floor(v.travel / 0.2) % n,
            );
          } else m.sp.texture = sheets.person(look, dir, step(0, 0.17));
          break;
        }
        case 'standard': {
          const k = KINGDOMS[p.w.route.realm].banner;
          const st = standardSprite(k.field, k.charge, p.fx !== 0 ? 'sw' : 'se', reduced ? 0 : Math.floor(now / 400));
          m.sp.texture = st.tex;
          m.sp.anchor.set(st.ax / st.tex.width, st.ay / st.tex.height);
          // carried at the bearer's shoulder, a little to the side
          m.sp.x += 5;
          m.sp.y -= 14;
          m.sp.zIndex += 1;
          break;
        }
        case 'cow':
        case 'goat':
        case 'pig':
          m.sp.anchor.set(0.5, 49 / 56);
          m.sp.texture = livestockTexture(
            m.kind,
            reduced ? 0 : 2 + (Math.floor((v.travel + i * 0.4) / 0.28) % 2),
            facing4(p.fx, p.fy),
          );
          m.sp.scale.set(m.kind === 'cow' ? 0.9 : 0.8);
          break;
        case 'horse':
          m.sp.anchor.set(0.5, 49 / 52);
          m.sp.anchor.set(0.5, 49 / 56); // livestock canvases are 48×56, standing at (24, 49)
          m.sp.texture = livestockTexture(
            'horse',
            reduced ? 0 : 2 + (Math.floor(v.travel / 0.3) % 2),
            facing4(p.fx, p.fy),
          );
          break;
        case 'rider':
          m.sp.texture = seated(sheets.person(look, dir, 0));
          m.sp.y -= 13;
          m.sp.zIndex += 1;
          break;
        case 'sheep':
          m.sp.anchor.set(0.5, 49 / 52);
          m.sp.anchor.set(0.5, 49 / 56); // livestock canvases are 48×56, standing at (24, 49)
          m.sp.texture = livestockTexture(
            'sheep',
            reduced ? 0 : 2 + (Math.floor((v.travel + i * 0.4) / 0.25) % 2),
            facing4(p.fx, p.fy),
          );
          m.sp.scale.set(0.8);
          break;
        case 'cart': {
          const c = handcartSprite(p.fx !== 0 ? 'sw' : 'se', Math.floor(v.travel / 0.3) % 2);
          m.sp.texture = c.tex;
          m.sp.anchor.set(c.ax / c.tex.width, c.ay / c.tex.height);
          break;
        }
        case 'glow':
          m.sp.texture = lanternGlow();
          m.sp.anchor.set(0.5);
          m.sp.visible = night;
          m.sp.y -= 22;
          m.sp.zIndex += 2;
          m.sp.alpha = 0.75 + (reduced ? 0 : Math.sin(now / 180 + i) * 0.15);
          break;
        default:
          break;
      }
    });
  }

  private makeFolk(f: WildFolk): View {
    const v = this.newView(f.id, performance.now() + hash2(f.look, 4, 5, 6) * 8000);
    this.add(v, 'person');
    if (f.kind === 'fisher') this.add(v, 'prop', 0.6, 0.4);
    this.wander.set(f.id, { x: f.x, y: f.y, tx: f.x, ty: f.y, wait: 1 + hash2(f.look, 2, 3, 4) * 3, fx: 1, fy: 0 });
    return v;
  }

  private drawFolk(v: View, f: WildFolk, dt: number, now: number, reduced: boolean): void {
    const w = this.wander.get(f.id)!;
    const store = this.d.store();
    // a wild worker strolls between spots in their patch, then stops to work there a while
    const dx = w.tx - w.x,
      dy = w.ty - w.y,
      dist = Math.hypot(dx, dy);
    let moving = false;
    if (dist > 0.05) {
      const sp = 0.9 * dt;
      w.x += (dx / dist) * Math.min(sp, dist);
      w.y += (dy / dist) * Math.min(sp, dist);
      w.fx = dx / dist;
      w.fy = dy / dist;
      moving = true;
    } else if ((w.wait -= dt) <= 0) {
      w.wait = 4 + Math.random() * 8;
      for (let k = 0; k < 6; k++) {
        const a = Math.random() * Math.PI * 2,
          r = Math.random() * f.r;
        const tx = f.x + Math.cos(a) * r,
          ty = f.y + Math.sin(a) * r;
        if (!store.solidAt(Math.floor(tx), Math.floor(ty))) {
          w.tx = tx;
          w.ty = ty;
          break;
        }
      }
    }
    const moved = Number.isFinite(v.last.x) ? Math.hypot(w.x - v.last.x, w.y - v.last.y) : 0;
    v.last = { x: w.x, y: w.y };
    v.travel += moved;
    v.root.position.set(isoX(w.x, w.y), isoY(w.x, w.y));
    v.root.zIndex = depth(w.x, w.y);
    const sd = screenDir(w.fx, w.fy);
    const dir = dirOf(sd.x, sd.y);
    const sheets = this.d.sheets();
    const look = f.look % COSMETIC_OUTFITS;
    // at work: woodcutters and prospectors swing, the rest stand (the fisher sits by a creel)
    const swing =
      !moving && !reduced && (f.kind === 'woodcutter' || f.kind === 'prospector') && Math.floor(now / 600) % 2 === 0;
    for (const m of v.members) {
      if (m.kind === 'person')
        m.sp.texture = sheets.person(
          look,
          dir,
          moving && !reduced ? 1 + (Math.floor(v.travel / 0.17) % (WALK_FRAMES - 1)) : swing ? ATTACK_FRAME : 0,
        );
      else if (m.kind === 'prop') {
        const s = stoolSprite('sw');
        m.sp.texture = s.tex;
        m.sp.anchor.set(s.ax / s.tex.width, s.ay / s.tex.height);
        const o = screenDir(m.ox, m.oy);
        m.sp.position.set(o.x, o.y);
        m.sp.zIndex = o.y - 1;
      }
    }
  }
}
