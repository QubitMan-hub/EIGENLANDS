import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { COMBO, PALETTE, heavyHit, type ComboHit } from '@eigenlands/shared';
import { ISO_HH, ISO_HW, isoX, isoY } from './iso';

const pc = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);
interface Item { alive: boolean; update(dt: number): void }
const SQ2 = Math.SQRT2;
/** typical enemy radius: the drawn arc reaches range + this, i.e. exactly where an average foe's edge gets hit */
const ARC_PAD = 0.38;

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

  /** camera shake request (0..1); ignored under reduced motion */
  kick(amount: number): void { if (!this.reduced()) this.shake = Math.max(this.shake, amount); }

  private add(it: Item): void { this.items.push(it); }

  /** Light combo swing (kept for callers that only know the combo index). */
  swing(x: number, y: number, dx: number, dy: number, combo: number): void {
    const hit = COMBO[Math.max(0, Math.min(2, combo))]!;
    this.arc(x, y, dx, dy, hit, combo === 2 ? 37 : 7, combo === 1 ? -1 : 1, combo === 2 ? 0.2 : 0.15);
    if (combo === 2) this.kick(0.2);
  }

  /** Charged heavy: a wide two-tone cleave with a ground shock ring. */
  heavy(x: number, y: number, dx: number, dy: number, level: number): void {
    const hit = heavyHit(level);
    this.arc(x, y, dx, dy, hit, level >= 1 ? 39 : 46, 1, 0.26, true);
    this.ring(x + dx * 0.6, y + dy * 0.6, level >= 1 ? 38 : 45, hit.range * 0.8, 0.35);
    this.kick(0.35 + 0.25 * level);
  }

  /**
   * A swing arc that covers EXACTLY the hit area: the fan's half-angle is acos(hit.arc) and its radius is the hit range
   * plus a typical target radius, projected flat on the ground. The point-blank circle is drawn too.
   */
  arc(x: number, y: number, dx: number, dy: number, hit: Pick<ComboHit, 'range' | 'arc'>, color: number, dir: number, life: number, thick = false): void {
    const g = new Graphics();
    this.layer.addChild(g);
    const ang = Math.atan2(dy, dx);
    const half = Math.acos(Math.max(-1, Math.min(1, hit.arc)));
    const reach = hit.range + ARC_PAD;
    let t = 0;
    const P = (a: number, r: number): [number, number] => [isoX(x + Math.cos(a) * r, y + Math.sin(a) * r), isoY(x + Math.cos(a) * r, y + Math.sin(a) * r) - 3];
    this.add({
      alive: true,
      update(dtt) {
        t += dtt;
        const k = t / life;
        if (k >= 1) { g.destroy(); this.alive = false; return; }
        g.clear();
        const sweep = Math.min(1, k * 2.2);
        const a0 = ang - half * dir, a1 = a0 + 2 * half * dir * sweep;
        const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
        const n = 16;
        // filled fan (fades), bright leading edge (the "blade")
        const pts: number[] = [...P(ang, 0.15)];
        for (let i = 0; i <= n; i++) pts.push(...P(lo + ((hi - lo) * i) / n, reach));
        g.poly(pts).fill({ color: pc(color), alpha: (thick ? 0.24 : 0.12) * (1 - k) });
        const inner: number[] = [];
        for (let i = 0; i <= n; i++) inner.push(...P(lo + ((hi - lo) * i) / n, reach * 0.62));
        const outer: number[] = [];
        for (let i = n; i >= 0; i--) outer.push(...P(lo + ((hi - lo) * i) / n, reach));
        g.poly([...inner, ...outer]).fill({ color: pc(7), alpha: 0.4 * (1 - k) });
        const tip = P(a1, reach);
        g.moveTo(...P(a1, reach * 0.3)).lineTo(tip[0], tip[1]).stroke({ color: pc(7), width: thick ? 2 : 1.4, alpha: 1 - k });
      },
    });
  }

  hit(x: number, y: number, dmg?: number, color = 6): void {
    const n = this.reduced() ? 3 : 6;
    for (let i = 0; i < n; i++) this.spark(x, y, color);
    if (dmg !== undefined) this.number(x, y, `${dmg}`, 6, 22);
  }

  /** Directional impact sparks + a white flash disc, scaled by hit weight. */
  impact(x: number, y: number, weight: number, crit: boolean, dx = 0, dy = 0): void {
    const n = (this.reduced() ? 3 : 6) + weight * 3 + (crit ? 4 : 0);
    const base = Math.atan2(isoY(dx, dy), isoX(dx, dy));
    const dirOk = dx !== 0 || dy !== 0;
    for (let i = 0; i < n; i++) this.spark(x, y, crit ? (i % 2 ? 38 : 39) : i % 3 === 0 ? 7 : 6, dirOk ? base + (Math.random() - 0.5) * 1.6 : undefined, 1 + weight * 0.3);
    const g = new Graphics();
    g.x = isoX(x, y); g.y = isoY(x, y) - 7;
    this.layer.addChild(g);
    let t = 0;
    const r0 = 3 + weight * 2 + (crit ? 3 : 0);
    this.add({
      alive: true,
      update(dt) {
        t += dt;
        const k = t / 0.12;
        if (k >= 1) { g.destroy(); this.alive = false; return; }
        g.clear().circle(0, 0, r0 * (0.6 + k * 0.8)).fill({ color: pc(crit ? 39 : 7), alpha: 0.85 * (1 - k) });
      },
    });
  }

  private spark(x: number, y: number, color: number, angle?: number, speed = 1): void {
    const g = new Graphics().rect(-1, -1, 2, 2).fill(pc(color));
    g.x = isoX(x, y); g.y = isoY(x, y) - 8;
    this.layer.addChild(g);
    const a = angle ?? Math.random() * Math.PI * 2, s = (30 + Math.random() * 40) * speed;
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
  number(x: number, y: number, text: string, color: number, lift = 16, size = 8, pop = 1): void {
    const t = new Text({ text, style: { fontFamily: 'monospace', fontSize: size, fontWeight: 'bold', fill: pc(color), stroke: { color: pc(0), width: 2 } } });
    t.resolution = this.textRes;
    t.anchor.set(0.5);
    t.x = isoX(x, y) + (Math.random() - 0.5) * 6; t.y = isoY(x, y) - lift;
    this.layer.addChild(t);
    let life = 0;
    const reduced = this.reduced();
    this.add({
      alive: true,
      update(dt) {
        life += dt;
        t.y -= 14 * dt;
        const s = reduced ? 1 : 1 + (pop - 1) * Math.max(0, 1 - life / 0.12);
        t.scale.set(s);
        t.alpha = Math.min(1, 2 - life * 2);
        if (life > 0.9) { t.destroy(); this.alive = false; }
      },
    });
  }

  /** Damage number styled by weight / crit / who got hurt. */
  damage(x: number, y: number, dmg: number, o: { crit?: boolean; weight?: number; hurt?: boolean; stagger?: boolean }): void {
    const w = o.weight ?? 0;
    if (o.hurt) { this.number(x, y, `-${dmg}`, 35, 24, 9, 1.4); return; }
    if (o.crit) this.number(x, y, `${dmg}!`, 38, 26, 11, 1.9);
    else this.number(x, y, `${dmg}`, w >= 2 ? 37 : w === 1 ? 22 : 7, 22, w >= 2 ? 10 : 8, w >= 1 ? 1.5 : 1.2);
    if (o.stagger) this.number(x, y - 0.4, 'BREAK', 37, 34, 7, 1.3);
  }

  /** Little banner word ("PERFECT", "COUNTER!") */
  banner(x: number, y: number, text: string, color: number): void { this.number(x, y, text, color, 36, 9, 1.8); }

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

  /** Fading afterimage of a sprite (dash, phase slip). */
  ghost(tex: Texture, x: number, y: number, tint: number, alpha = 0.55, flip = false, life = 0.28): void {
    if (this.reduced()) return;
    const s = new Sprite(tex);
    s.anchor.set(0.5, 1);
    s.x = Math.round(isoX(x, y)); s.y = Math.round(isoY(x, y)) + 1;
    s.tint = pc(tint);
    s.blendMode = 'add';
    if (flip) s.scale.x = -1;
    this.layer.addChildAt(s, 0);
    let t = 0;
    this.add({ alive: true, update(dt) { t += dt; s.alpha = alpha * (1 - t / life); if (t > life) { s.destroy(); this.alive = false; } } });
  }

  burst(x: number, y: number, colors: number[], count = 12): void {
    const n = this.reduced() ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) this.spark(x, y, colors[i % colors.length]!);
  }

  /** Expanding ring lying on the ground (an ellipse in iso). */
  ring(x: number, y: number, color: number, maxR = 2.2, life = 0.6, width = 2): void {
    const g = new Graphics();
    g.x = isoX(x, y); g.y = isoY(x, y);
    this.layer.addChild(g);
    let t = 0;
    this.add({
      alive: true,
      update(dt) {
        t += dt;
        const k = t / life;
        if (k >= 1) { g.destroy(); this.alive = false; return; }
        g.clear().ellipse(0, 0, k * maxR * ISO_HW * SQ2, k * maxR * ISO_HH * SQ2).stroke({ color: pc(color), width, alpha: 1 - k });
      },
    });
  }

  /** Ground shockwave: filled flash disc + two rings + dust. */
  shockwave(x: number, y: number, r: number, color = 36): void {
    const g = new Graphics();
    g.x = isoX(x, y); g.y = isoY(x, y);
    this.layer.addChildAt(g, 0);
    let t = 0;
    this.add({
      alive: true,
      update(dt) {
        t += dt;
        const k = t / 0.25;
        if (k >= 1) { g.destroy(); this.alive = false; return; }
        g.clear().ellipse(0, 0, r * ISO_HW * SQ2, r * ISO_HH * SQ2).fill({ color: pc(color), alpha: 0.45 * (1 - k) });
      },
    });
    this.ring(x, y, color, r * 1.1, 0.4, 3);
    this.ring(x, y, 7, r * 0.7, 0.3, 1);
    this.burst(x, y, [4, 5, 19], 10);
  }

  /** Screen-space-ish full flash around the player for the phase slip. */
  slip(x: number, y: number): void {
    this.ring(x, y, 47, 3.2, 0.45, 3);
    this.ring(x, y, 44, 2.0, 0.35, 2);
    this.burst(x, y, [47, 44, 7], 14);
  }
}
