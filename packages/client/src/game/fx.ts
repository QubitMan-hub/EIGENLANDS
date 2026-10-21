import { Container, Graphics, Text } from 'pixi.js';
import { PALETTE } from '@eigenlands/shared';
import { ISO_HH, ISO_HW, isoX, isoY } from './iso';

const pc = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);
interface Item { alive: boolean; update(dt: number): void }
const SQ2 = Math.SQRT2;

/** Short-lived world effects. Positions are world tile units; everything is drawn in iso art pixels. */
export class Fx {
  private items: Item[] = [];
  shake = 0;
  textRes = 2;

  constructor(readonly layer: Container, private reduced: () => boolean) {}

  update(dt: number): void {
    for (const it of this.items) it.update(dt);
    this.items = this.items.filter((i) => i.alive);
    this.shake = Math.max(0, this.shake - dt * 3);
  }

  private add(it: Item): void { this.items.push(it); }

  /** Sword arc, drawn as a world-space fan then projected so it lies flat on the ground. */
  swing(x: number, y: number, dx: number, dy: number, combo: number): void {
    const g = new Graphics();
    this.layer.addChild(g);
    const ang = Math.atan2(dy, dx);
    const span = combo === 2 ? 1.9 : 1.2;
    const reach = combo === 2 ? 1.8 : 1.4;
    let t = 0;
    const dir = combo === 1 ? -1 : 1;
    this.add({
      alive: true,
      update(dtt) {
        t += dtt;
        const k = t / 0.16;
        if (k >= 1) { g.destroy(); this.alive = false; return; }
        g.clear();
        const a0 = ang - (span / 2) * dir, a1 = a0 + span * dir * Math.min(1, k * 1.6);
        const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
        const pts: number[] = [isoX(x, y), isoY(x, y) - 5];
        for (let i = 0; i <= 10; i++) { const a = lo + ((hi - lo) * i) / 10; pts.push(isoX(x + Math.cos(a) * reach, y + Math.sin(a) * reach), isoY(x + Math.cos(a) * reach, y + Math.sin(a) * reach) - 5); }
        g.poly(pts).fill({ color: combo === 2 ? pc(37) : pc(7), alpha: 0.6 * (1 - k) });
      },
    });
    if (combo === 2 && !this.reduced()) this.shake = Math.max(this.shake, 0.35);
  }

  hit(x: number, y: number, dmg?: number, color = 6): void {
    const n = this.reduced() ? 3 : 6;
    for (let i = 0; i < n; i++) this.spark(x, y, color);
    if (dmg !== undefined) this.number(x, y, `${dmg}`, 6, 22);
  }

  private spark(x: number, y: number, color: number): void {
    const g = new Graphics().rect(-1, -1, 2, 2).fill(pc(color));
    g.x = isoX(x, y); g.y = isoY(x, y) - 8;
    this.layer.addChild(g);
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 40;
    let t = 0;
    this.add({
      alive: true,
      update(dt) {
        t += dt;
        g.x += Math.cos(a) * s * dt; g.y += Math.sin(a) * s * 0.6 * dt - 14 * dt + 40 * t * dt;
        g.alpha = 1 - t / 0.4;
        if (t > 0.4) { g.destroy(); this.alive = false; }
      },
    });
  }

  /** Floating text above a world point (lift in art pixels). */
  number(x: number, y: number, text: string, color: number, lift = 16): void {
    const t = new Text({ text, style: { fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', fill: pc(color), stroke: { color: pc(0), width: 2 } } });
    t.resolution = this.textRes;
    t.anchor.set(0.5);
    t.x = isoX(x, y); t.y = isoY(x, y) - lift;
    this.layer.addChild(t);
    let life = 0;
    this.add({
      alive: true,
      update(dt) {
        life += dt;
        t.y -= 14 * dt;
        t.alpha = Math.min(1, 2 - life * 2);
        if (life > 0.9) { t.destroy(); this.alive = false; }
      },
    });
  }

  dash(x: number, y: number, dx: number, dy: number): void {
    if (this.reduced()) return;
    for (let i = 0; i < 4; i++) {
      const px = x - dx * i * 0.3, py = y - dy * i * 0.3;
      const g = new Graphics().ellipse(0, 0, 3, 1.5).fill({ color: pc(6), alpha: 0.7 });
      g.x = isoX(px, py); g.y = isoY(px, py);
      this.layer.addChild(g);
      let t = 0;
      this.add({ alive: true, update(dt) { t += dt; g.scale.set(1 + t * 4); g.alpha = 0.7 * (1 - t / 0.3); if (t > 0.3) { g.destroy(); this.alive = false; } } });
    }
  }

  burst(x: number, y: number, colors: number[], count = 12): void {
    const n = this.reduced() ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) this.spark(x, y, colors[i % colors.length]!);
  }

  /** Expanding ring lying on the ground (an ellipse in iso). */
  ring(x: number, y: number, color: number, maxR = 2.2): void {
    const g = new Graphics();
    g.x = isoX(x, y); g.y = isoY(x, y);
    this.layer.addChild(g);
    let t = 0;
    this.add({
      alive: true,
      update(dt) {
        t += dt;
        const k = t / 0.6;
        g.clear().ellipse(0, 0, k * maxR * ISO_HW * SQ2, k * maxR * ISO_HH * SQ2).stroke({ color: pc(color), width: 2, alpha: 1 - k });
        if (k >= 1) { g.destroy(); this.alive = false; }
      },
    });
  }
}
