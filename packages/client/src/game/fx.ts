import { Container, Graphics, Text } from 'pixi.js';
import { PALETTE, TILE_SIZE } from '@eigenlands/shared';

const pc = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);
interface Item { alive: boolean; update(dt: number): void }

/** Short-lived world effects. Positions are in tile units; the layer is in world pixels. */
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

  swing(x: number, y: number, dx: number, dy: number, combo: number): void {
    const g = new Graphics();
    this.layer.addChild(g);
    const ang = Math.atan2(dy, dx);
    const span = combo === 2 ? 1.9 : 1.2;
    const reach = (combo === 2 ? 1.8 : 1.4) * TILE_SIZE;
    let t = 0;
    const dir = combo === 1 ? -1 : 1;
    this.add({
      alive: true,
      update(dtt) {
        t += dtt;
        const k = t / 0.16;
        if (k >= 1) { g.destroy(); this.alive = false; return; }
        g.clear();
        const a0 = ang - span / 2 * dir, a1 = a0 + span * dir * Math.min(1, k * 1.6);
        g.moveTo(x * TILE_SIZE, y * TILE_SIZE).arc(x * TILE_SIZE, y * TILE_SIZE, reach, Math.min(a0, a1), Math.max(a0, a1)).closePath();
        g.fill({ color: combo === 2 ? pc(37) : pc(7), alpha: 0.55 * (1 - k) });
      },
    });
    if (combo === 2 && !this.reduced()) this.shake = Math.max(this.shake, 0.35);
  }

  hit(x: number, y: number, dmg?: number, color = 6): void {
    const n = this.reduced() ? 3 : 6;
    for (let i = 0; i < n; i++) this.spark(x, y, color);
    if (dmg !== undefined) this.number(x, y - 0.6, `${dmg}`, 6);
  }

  private spark(x: number, y: number, color: number): void {
    const g = new Graphics().rect(-1, -1, 2, 2).fill(pc(color));
    g.x = x * TILE_SIZE; g.y = y * TILE_SIZE;
    this.layer.addChild(g);
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 40;
    let t = 0;
    this.add({
      alive: true,
      update(dt) {
        t += dt;
        g.x += Math.cos(a) * s * dt; g.y += Math.sin(a) * s * dt - 10 * dt;
        g.alpha = 1 - t / 0.35;
        if (t > 0.35) { g.destroy(); this.alive = false; }
      },
    });
  }

  number(x: number, y: number, text: string, color: number): void {
    const t = new Text({ text, style: { fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', fill: pc(color), stroke: { color: pc(0), width: 2 } } });
    t.resolution = this.textRes;
    t.anchor.set(0.5);
    t.x = x * TILE_SIZE; t.y = y * TILE_SIZE;
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
      const g = new Graphics().circle(0, 0, 2).fill({ color: pc(6), alpha: 0.7 });
      g.x = (x - dx * i * 0.3) * TILE_SIZE; g.y = (y - dy * i * 0.3) * TILE_SIZE + 6;
      this.layer.addChild(g);
      let t = 0;
      this.add({ alive: true, update(dt) { t += dt; g.scale.set(1 + t * 4); g.alpha = 0.7 * (1 - t / 0.3); if (t > 0.3) { g.destroy(); this.alive = false; } } });
    }
  }

  burst(x: number, y: number, colors: number[], count = 12): void {
    const n = this.reduced() ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) this.spark(x, y, colors[i % colors.length]!);
  }

  ring(x: number, y: number, color: number, maxR = 2.2): void {
    const g = new Graphics();
    g.x = x * TILE_SIZE; g.y = y * TILE_SIZE;
    this.layer.addChild(g);
    let t = 0;
    this.add({
      alive: true,
      update(dt) {
        t += dt;
        const k = t / 0.6;
        g.clear().circle(0, 0, k * maxR * TILE_SIZE).stroke({ color: pc(color), width: 2, alpha: 1 - k });
        if (k >= 1) { g.destroy(); this.alive = false; }
      },
    });
  }
}
