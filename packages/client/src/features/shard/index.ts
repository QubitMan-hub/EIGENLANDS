import { Container, Sprite, Text } from 'pixi.js';
import { MSG34, PALETTE, type Ghost, type GhostsMsg, type ShardInfoMsg } from '@eigenlands/shared';
import { OUTFITS, WALK_FRAMES, dirOf } from '../../art/actors';
import { depth, isoX, isoY, screenDir } from '../../game/iso';
import { Interpolator, type Pose } from '../../net/interp';
import type { ClientModule, P34Deps } from '../types';

const pc = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);
interface GhostView {
  root: Container;
  sprite: Sprite;
  label: Text;
  lx: number;
  ly: number;
  travel: number;
  seen: number;
}
type GPose = Pose & { g: Ghost };

/** Shard awareness: which region we are in, and players standing just across the border (ghosts). */
export class ShardClient implements ClientModule {
  info: ShardInfoMsg | null = null;
  private ghosts = new Interpolator<GPose>();
  private views = new Map<string, GhostView>();
  private lastList = new Set<string>();

  constructor(readonly d: P34Deps) {}

  handlers(): Record<string, (m: any) => void> {
    return {
      [MSG34.SHARD]: (m: ShardInfoMsg) => {
        const first = !this.info;
        const moved = this.info && this.info.id !== m.id;
        this.info = m;
        if (moved && !first) this.d.toasts.add('You crossed into a new region of the world.', 'info');
      },
      [MSG34.GHOSTS]: (m: GhostsMsg) => this.onGhosts(m),
    };
  }

  private onGhosts(m: GhostsMsg): void {
    const now = new Set<string>();
    for (const g of m.list ?? []) {
      now.add(g.id);
      this.ghosts.push(g.id, m.t, { x: g.x, y: g.y, faceX: g.faceX, faceY: g.faceY, g });
    }
    for (const id of this.lastList) if (!now.has(id)) this.drop(id);
    this.lastList = now;
  }

  private drop(id: string): void {
    const v = this.views.get(id);
    if (v) {
      v.root.destroy({ children: true });
      v.label.destroy();
      this.views.delete(id);
    }
    this.ghosts.remove(id);
  }

  frame(_now: number, dtMs: number): void {
    const t = this.d.renderTime();
    for (const id of this.lastList) {
      const smp = this.ghosts.sample(id, t);
      if (!smp) continue;
      let v = this.views.get(id);
      const g = smp.pose.g;
      if (!v) {
        const root = new Container();
        const sprite = new Sprite();
        sprite.anchor.set(0.5, 1);
        sprite.y = 1;
        sprite.alpha = 0.92;
        root.addChild(sprite);
        this.d.entityLayer().addChild(root);
        const label = new Text({
          text: g.name,
          style: {
            fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
            fontSize: 12,
            fontWeight: 'bold',
            fill: pc(6),
            stroke: { color: pc(0), width: 3 },
          },
        });
        label.anchor.set(0.5, 1);
        this.d.labelLayer().addChild(label);
        v = { root, sprite, label, lx: smp.x, ly: smp.y, travel: 0, seen: 0 };
        this.views.set(id, v);
      }
      const moved = Math.hypot(smp.x - v.lx, smp.y - v.ly);
      v.travel += moved;
      v.lx = smp.x;
      v.ly = smp.y;
      const walking = moved > 0.003 * (dtMs / 16);
      const frame = walking ? 1 + (Math.floor(v.travel / 0.17) % (WALK_FRAMES - 1)) : 0;
      const sd = screenDir(g.faceX, g.faceY);
      v.sprite.texture = this.d
        .sheets()
        .person(((g.look % OUTFITS.length) + OUTFITS.length) % OUTFITS.length, dirOf(sd.x, sd.y), frame);
      v.root.x = Math.round(isoX(smp.x, smp.y));
      v.root.y = Math.round(isoY(smp.x, smp.y));
      v.root.zIndex = depth(smp.x, smp.y);
      const s = this.d.toScreen(smp.x, smp.y);
      v.label.x = Math.round(s.x);
      v.label.y = Math.round(s.y - (30 * (this.d.toScreen(0, 1).y - this.d.toScreen(0, 0).y)) / 8);
    }
  }

  debug(): Record<string, unknown> {
    return { shard: this.info?.id ?? null, ghosts: [...this.lastList] };
  }
}
