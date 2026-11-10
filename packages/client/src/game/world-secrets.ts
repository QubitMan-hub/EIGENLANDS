import { Container, Sprite } from 'pixi.js';
import { C, makeCanvas } from '../art/shade';
import { Iso } from '../art/isokit';
import { Texture } from 'pixi.js';
import { contactShadow } from './grounding';
import { NoticeCard } from './noticeboard';
import { secretSites, secretGround, SECRET_STORIES, type SecretKind } from './secret-plan';
import { depth, isoX, isoY } from './iso';
import type { LifeDeps, LifeFrame } from './life';
/** Tiny, quiet isometric vignettes. No loot, collision, saves, or remote-world generation. */
export class WorldSecrets {
  voxelProps(): import('./voxel/world').VoxelProp[] {
    return [...this.views].map(([id, v]) => ({
      id: `secret:${id}`,
      x: v.x + 0.5,
      y: v.y + 0.5,
      kind: `secret_${v.kind}`,
    }));
  }
  private views = new Map<string, { root: Container; x: number; y: number; kind: SecretKind }>();
  private textures = new Map<SecretKind, Texture>();
  private card = new NoticeCard('world-secret', '');
  private next = 0;
  constructor(private d: LifeDeps) {}
  private art(kind: SecretKind): Texture {
    const old = this.textures.get(kind);
    if (old) return old;
    const { canvas, ctx } = makeCanvas(48, 48),
      I = new Iso(ctx, 24, 32);
    if (kind === 'ladle') {
      I.box(4, 4, 0, 8, 8, 4, { top: C.mist, left: C.steel, right: C.slate });
      I.box(7.5, 7.5, 4, 1, 1, 17, { top: C.pale, left: C.fog, right: C.steel });
      I.cyl(8, 8, 20, 2.5, 1, [C.slate, C.steel, C.mist]);
    } else if (kind === 'tea') {
      I.box(3, 3, 0, 10, 10, 2, { top: C.e4, left: C.e3, right: C.e2 });
      for (const [u, v] of [
        [6, 6],
        [10, 10],
      ])
        I.cyl(u!, v!, 2, 1.6, 2, [C.w2, C.w4, C.pale]);
      I.top(6, 10, 2.1, 2, 2, C.pale);
    } else if (kind === 'crown') {
      I.cyl(8, 8, 0, 4, 6, [C.e1, C.e2, C.e3, C.e4]);
      I.box(6, 6, 6, 4, 4, 2, { top: C.e6, left: C.e5, right: C.e4 });
      for (const [u, v] of [
        [6, 6],
        [9, 6],
        [6, 9],
        [9, 9],
      ])
        I.box(u!, v!, 8, 1, 1, 2, { top: C.pale, left: C.e6, right: C.e5 });
    } else if (kind === 'fish') {
      I.box(4, 4, 0, 8, 8, 2, { top: C.mist, left: C.steel, right: C.slate });
      I.box(6, 7, 2, 6, 2, 4, { top: C.e6, left: C.e5, right: C.e4 });
      I.box(4, 6, 3, 2, 4, 3, { top: C.e5, left: C.e4, right: C.e3 });
      I.box(10, 7, 5, 1, 1, 1, { top: C.ink, left: C.ink, right: C.ink });
    } else {
      I.top(3, 3, 0.3, 10, 8, (s, t) => (s + t < 1 ? C.r3 : C.e5));
      I.box(7, 3, 0.4, 1, 8, 0.5, { top: C.e2, left: C.e1, right: C.e1 });
      I.cyl(12, 11, 0, 1.5, 2, [C.e3, C.e4, C.pale]);
    }
    const tex = Texture.from(canvas);
    tex.source.scaleMode = 'nearest';
    this.textures.set(kind, tex);
    return tex;
  }
  frame(f: LifeFrame): void {
    if (f.now < this.next) return;
    this.next = f.now + 750;
    const store = this.d.store(),
      sites = secretSites(this.d.seed(), f.me.x, f.me.y).filter((s) => secretGround(store, s.x, s.y));
    const wanted = new Set(sites.map((s) => s.id));
    for (const [id, v] of this.views)
      if (!wanted.has(id)) {
        v.root.destroy({ children: true });
        this.views.delete(id);
      }
    for (const s of sites) {
      if (this.views.has(s.id)) continue;
      const root = new Container(),
        sp = new Sprite(this.art(s.kind));
      sp.anchor.set(0.5, 40 / 48);
      contactShadow(root, 5).alpha = 0.24;
      root.addChild(sp);
      root.position.set(isoX(s.x + 0.5, s.y + 0.5), isoY(s.x + 0.5, s.y + 0.5));
      root.zIndex = depth(s.x + 0.5, s.y + 0.5);
      this.d.layer().addChild(root);
      this.views.set(s.id, { root, ...s });
    }
    const near = sites.find((s) => Math.hypot(s.x + 0.5 - f.me.x, s.y + 0.5 - f.me.y) < 1.8);
    if (near) {
      const [title, text] = SECRET_STORIES[near.kind];
      this.card.show(title, [{ head: 'A small discovery', text }]);
    } else this.card.hide();
  }
}
