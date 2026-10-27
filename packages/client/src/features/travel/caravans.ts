import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { CARAVAN_REACH, caravansNear, hash2, type CaravanPos } from '@eigenlands/shared';
import { wagonSprite } from '../../art/caravan';
import { mountDir, mountSprite } from '../../art/mounts';
import { COSMETIC_OUTFITS, WALK_FRAMES, dirOf } from '../../art/actors';
import { depth, isoX, isoY, screenDir } from '../../game/iso';
import type { P34Deps } from '../types';

interface View {
  root: Container;
  wagon: Sprite;
  horse: Sprite;
  driver: Sprite;
  escorts: Sprite[];
  last: { x: number; y: number };
  travel: number;
}

const crops = new WeakMap<Texture, Texture>();
/** the driver sits on the bench: draw them from the hips up */
function seated(t: Texture): Texture {
  let c = crops.get(t);
  if (!c) {
    const f = t.frame;
    c = new Texture({ source: t.source, frame: new Rectangle(f.x, f.y, f.width, f.height - 9) });
    crops.set(t, c);
  }
  return c;
}

/**
 * Draws the road caravans near the player from the shared schedule (no network traffic): the wagon, the horse that
 * pulls it, the driver on the bench and two escorts walking alongside. Also answers "is a caravan in reach?".
 */
export class CaravanViews {
  private views = new Map<string, View>();
  private near: CaravanPos[] = [];

  constructor(private d: P34Deps) {}

  /** The caravan within trading reach of the player, if any. */
  reachable(): CaravanPos | null {
    const me = this.d.me();
    if (!me) return null;
    let best: CaravanPos | null = null,
      bd = Infinity;
    for (const c of this.near) {
      const dist = Math.hypot(c.x - me.x, c.y - me.y);
      if (dist <= CARAVAN_REACH && dist < bd) {
        bd = dist;
        best = c;
      }
    }
    return best;
  }
  list(): CaravanPos[] {
    return this.near;
  }

  frame(dt: number): void {
    const me = this.d.me();
    if (!me || this.d.store().generation < 5) {
      for (const v of this.views.values()) v.root.visible = false;
      return;
    }
    const now = this.d.clock.serverNow(performance.now());
    this.near = caravansNear(this.d.store().seed, me.x, me.y, 48, now);
    const seen = new Set<string>();
    for (const c of this.near) {
      seen.add(c.route.id);
      const v = this.views.get(c.route.id) ?? this.make(c.route.id);
      this.draw(v, c, dt);
    }
    for (const [id, v] of this.views)
      if (!seen.has(id)) {
        v.root.destroy({ children: true });
        this.views.delete(id);
      }
  }

  private make(id: string): View {
    const root = new Container();
    root.sortableChildren = true;
    const v: View = {
      root,
      wagon: new Sprite(),
      horse: new Sprite(),
      driver: new Sprite(),
      escorts: [new Sprite(), new Sprite()],
      last: { x: NaN, y: NaN },
      travel: 0,
    };
    for (const s of [v.horse, v.driver, ...v.escorts]) s.anchor.set(0.5, 1);
    root.addChild(v.wagon, v.horse, v.driver, ...v.escorts);
    this.d.entityLayer().addChild(root);
    this.views.set(id, v);
    return v;
  }

  private draw(v: View, c: CaravanPos, dt: number): void {
    const sheets = this.d.sheets();
    const moved = Number.isFinite(v.last.x) ? Math.hypot(c.x - v.last.x, c.y - v.last.y) : 0;
    v.last = { x: c.x, y: c.y };
    v.travel += moved;
    const k = Math.floor(hash2(c.route.offset, c.route.period, 3, 51) * COSMETIC_OUTFITS);
    v.root.visible = true;
    v.root.x = isoX(c.x, c.y);
    v.root.y = isoY(c.x, c.y);
    v.root.zIndex = depth(c.x, c.y);
    const alongX = c.fx !== 0,
      rev = (alongX ? c.fx : c.fy) < 0;
    const wheel = c.moving ? Math.floor(v.travel / 0.45) & 1 : 0;
    const w = wagonSprite(c.route.peddler ? 'home' : c.route.realm, alongX ? 'sw' : 'se', wheel, rev);
    v.wagon.texture = w.tex;
    v.wagon.anchor.set(w.ax / w.tex.width, w.ay / w.tex.height);
    // the horse walks ahead in the shafts; the nearer of horse and wagon draws on top
    const ahead = 1.9;
    const m = mountSprite('horse', mountDir(c.fx, c.fy), c.moving ? 1 + (Math.floor(v.travel / 0.32) % 4) : 0);
    v.horse.texture = m.tex;
    v.horse.anchor.set(m.ax / m.tex.width, m.ay / m.tex.height);
    const hs = screenDir(c.fx * ahead, c.fy * ahead);
    v.horse.position.set(hs.x, hs.y);
    v.horse.zIndex = hs.y;
    v.wagon.zIndex = 0;
    // the driver on the bench, facing the road
    const sd = screenDir(c.fx, c.fy);
    const dir = dirOf(sd.x, sd.y);
    const bench = screenDir(c.fx * 0.95, c.fy * 0.95);
    v.driver.texture = seated(sheets.person(k, dir, 0));
    v.driver.position.set(bench.x, bench.y - 11);
    v.driver.zIndex = bench.y + 0.5;
    // two escorts walk beside the wagon, one each side, a little behind the bench
    v.escorts.forEach((e, i) => {
      const side = i ? 1 : -1;
      const ox = -c.fy * side * 1.25 + c.fx * (i ? -0.6 : 0.4),
        oy = c.fx * side * 1.25 + c.fy * (i ? -0.6 : 0.4);
      const p = screenDir(ox, oy);
      const frame = c.moving ? 1 + (Math.floor((v.travel + i * 0.3) / 0.17) % (WALK_FRAMES - 1)) : 0;
      e.texture = sheets.person((k + 3 + i * 5) % COSMETIC_OUTFITS, dir, frame);
      e.position.set(p.x, p.y);
      e.zIndex = p.y;
    });
    void dt;
  }
}
