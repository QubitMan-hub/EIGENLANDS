import { setExtraLights } from './worldobjviews';
import { Container, Sprite, Texture } from 'pixi.js';
import { findPath, packAppearance, randomAppearance, mulberry32 } from '@eigenlands/shared';
import { arrivalArt } from '../art/arrival';
import { PixelLabel } from '../art/pixel-label';
import { C } from '../art/shade';
import {
  faceVillageTexture,
  villageHeading,
  VILLAGE_AX,
  VILLAGE_AY,
  VILLAGE_W,
  VILLAGE_H,
} from '../art/village-animals';
import { dirOf } from '../art/actors';
import { contactShadow } from './grounding';
import { arrivalPlan, arrivalGround, arrivalNotices, ARRIVAL_BOARD, type ArrivalProp } from './arrival-plan';
import { NoticeCard } from './noticeboard';
import { SceneLife, type SceneActor } from './scene-life';
import type { LifeDeps, LifeFrame } from './life';
import { isoX, isoY, depth, screenDir } from './iso';
interface ArrivalActor extends SceneActor {
  root: Container;
  app: number;
  look: number;
  label: PixelLabel;
  heading: number;
}
/** The safe landing's small social garden. It decorates existing ground without editing a save or collision. */
export class ArrivalGarden {
  private props: Array<{ at: ArrivalProp; sp: Sprite }> = [];
  private actors: ArrivalActor[] = [];
  private owned: Texture[] = [];
  private key = '';
  private budget = 0;
  private card = new NoticeCard('arrival-guide');
  private scenes: SceneLife;
  constructor(private d: LifeDeps) {
    setExtraLights('arrival-lantern', (x0, y0, x1, y1) =>
      this.actors
        .filter((a) => a.sc?.kind === 'watchman' && a.root.visible && a.x >= x0 && a.x <= x1 && a.y >= y0 && a.y <= y1)
        .map((a) => ({ x: a.x, y: a.y, radius: 4, color: 0xffc870, intensity: 0.8 })),
    );
    this.scenes = new SceneLife({
      tex: (a, dir, frame) => {
        const sh = d.sheets(),
          actor = a as ArrivalActor;
        a.dir = dir;
        a.personFrame = frame;
        const ready = sh.styledReady(actor.look, actor.app, dir, frame);
        if (!ready && this.budget <= 0) {
          a.body.visible = false;
          return a.body.texture;
        }
        if (!ready) this.budget--;
        a.body.visible = true;
        return sh.styled(actor.look, actor.app, dir, frame);
      },
      moveTo: (a, dt, speed) => this.move(a, dt, speed),
      say: (a, text, now) => {
        a.bark = { text, until: now + 3000 };
      },
      walkFrame: (a, speed) => 1 + (Math.floor(a.t * 7 * speed) % 8),
      burst: (x, y, c, n) => d.fx().burst(x, y, c, n),
      ring: (x, y, c, r, life) => d.fx().ring(x, y, c, r, life),
      sound: (s, x, y) => d.sound(s, x, y),
      held: () => d.held?.() ?? null,
      art: () => d.art(),
      all: () => this.actors,
      findPath: (sx, sy, tx, ty) =>
        findPath(
          sx,
          sy,
          tx,
          ty,
          Object.assign((x: number, y: number) => !arrivalGround(d.store(), x, y), { level: d.store().solidAt.level }),
          500,
        ),
    });
  }
  private move(a: SceneActor, dt: number, speed: number): boolean {
    const dx = a.tx - a.x,
      dy = a.ty - a.y,
      d = Math.hypot(dx, dy);
    if (d < 0.08) return true;
    const n = Math.min(d, speed * dt),
      x = a.x + (dx / d) * n,
      y = a.y + (dy / d) * n;
    if (!arrivalGround(this.d.store(), x, y)) return false;
    a.x = x;
    a.y = y;
    const sd = screenDir(dx, dy);
    a.dir = dirOf(sd.x, sd.y);
    (a as ArrivalActor).heading = villageHeading(dx, dy);
    return d <= n + 0.08;
  }
  private clear(): void {
    for (const p of this.props) p.sp.destroy();
    for (const a of this.actors) a.root.destroy({ children: true });
    for (const t of this.owned) t.destroy(true);
    this.props = [];
    this.actors = [];
    this.owned = [];
    this.key = '';
    this.card.hide();
  }
  private build(season: number): void {
    const plan = arrivalPlan(this.d.seed());
    for (const at of plan.props) {
      const art = arrivalArt(at.kind, at.variant, season),
        sp = new Sprite(art.tex);
      sp.anchor.set(art.ax / sp.texture.width, art.ay / sp.texture.height);
      this.d.layer().addChild(sp);
      this.props.push({ at, sp });
      this.owned.push(art.tex);
    }
    for (const [i, sc] of plan.scenes.entries()) {
      const count = sc.kind === 'hens' ? 2 : 1;
      for (let j = 0; j < count; j++) {
        const root = new Container(),
          body = new Sprite(),
          label = new PixelLabel('', C.pale);
        contactShadow(root, sc.kind === 'cat' || sc.kind === 'hens' ? 3 : 4).alpha = 0.28;
        root.addChild(body, label);
        label.anchor.set(0.5, 1);
        label.y = -47;
        label.visible = false;
        this.d.layer().addChild(root);
        body.anchor.set(0.5, 1);
        const a: ArrivalActor = {
          x: sc.x + j * 0.6,
          y: sc.y,
          z: 0,
          tx: sc.x,
          ty: sc.y,
          t: 0,
          phase: i * 0.71 + j,
          dir: 0,
          face: 0,
          st: 'idle',
          root,
          body,
          label,
          sc,
          part: 0,
          app: packAppearance(randomAppearance(mulberry32(sc.seed + j))),
          look: 0,
          heading: 0,
        };
        if (sc.kind === 'cat' || sc.kind === 'hens') {
          a.animal = sc.kind === 'cat' ? 'cat' : 'chicken';
          const art = this.d.art();
          if (art) body.texture = (sc.kind === 'cat' ? art.cat : art.chicken)[0]!;
        }
        if (sc.kind === 'garden' && this.d.held) {
          const held = new Sprite();
          held.anchor.set(0.5, 0.75);
          (held as Sprite & { id: string }).id = 'can';
          root.addChild(held);
          a.heldSprite = held;
        }
        this.actors.push(a);
      }
    }
  }
  frame(f: LifeFrame, season: number): void {
    const nearby = !f.underground && Math.hypot(f.me.x, f.me.y) < 28;
    if (!nearby) {
      if (this.key) this.clear();
      return;
    }
    const key = `${this.d.seed()}:${season}`;
    if (this.key !== key) {
      this.clear();
      this.build(season);
      this.key = key;
    }
    this.budget = 1;
    for (const { at, sp } of this.props) {
      sp.visible = arrivalGround(this.d.store(), at.x, at.y);
      if (!sp.visible) continue;
      sp.position.set(Math.round(isoX(at.x + 0.5, at.y + 0.5)), Math.round(isoY(at.x + 0.5, at.y + 0.5)));
      sp.zIndex = at.kind === 'stone' || at.kind === 'blanket' ? -1e6 : depth(at.x + 0.5, at.y + 0.5);
    }
    for (const a of this.actors) {
      a.t += Math.min(f.dt, 0.1);
      const natural = arrivalGround(this.d.store(), a.sc!.x, a.sc!.y) && arrivalGround(this.d.store(), a.x, a.y);
      a.root.visible = natural && this.scenes.step(a, f);
      if (!a.root.visible) continue;
      a.root.position.set(Math.round(isoX(a.x, a.y)), Math.round(isoY(a.x, a.y)));
      a.root.zIndex = depth(a.x, a.y);
      a.body.y = -Math.round(a.z);
      if (a.animal) {
        const tex = faceVillageTexture(a.body.texture, a.heading);
        if (tex) a.body.texture = tex;
        a.body.anchor.set(VILLAGE_AX / VILLAGE_W, VILLAGE_AY / VILLAGE_H);
        a.body.scale.set(1);
      }
      this.scenes.refreshCarry(a);
      a.label.visible = !!a.bark && a.bark.until > f.now && Math.hypot(a.x - f.me.x, a.y - f.me.y) < 10;
      if (a.label.visible) a.label.text = a.bark!.text;
    }
    if (
      arrivalGround(this.d.store(), ARRIVAL_BOARD.x, ARRIVAL_BOARD.y) &&
      Math.hypot(f.me.x - ARRIVAL_BOARD.x - 0.5, f.me.y - ARRIVAL_BOARD.y - 0.5) < 2
    )
      this.card.show('Wayfarer’s Glade', arrivalNotices(this.d.seed()));
    else this.card.hide();
  }
  debug() {
    return {
      props: this.props.filter((p) => p.sp.visible).length,
      actors: this.actors.filter((a) => a.root.visible).length,
    };
  }
}
