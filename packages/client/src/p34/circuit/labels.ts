import { Text } from 'pixi.js';
import type { P34Deps } from '../types';

interface Label { t: Text; x: number; y: number; born: number; life: number; lift: number }

/** Crisp floating cast labels ("Frost twin-shot!", "Misfire!", "Locked") in screen space, anchored to a world point. */
export class FloatLabels {
  private items: Label[] = [];
  constructor(private d: P34Deps) {}

  add(x: number, y: number, text: string, color: number, opts: { size?: number; delay?: number; lift?: number; life?: number } = {}): void {
    const scale = this.d.settings().textScale ?? 1;
    const t = new Text({
      text,
      style: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: Math.round((opts.size ?? 15) * scale), fontWeight: 'bold', fill: color, stroke: { color: 0x0b0c1a, width: 4 }, letterSpacing: 0.5 },
    });
    t.anchor.set(0.5, 1);
    t.resolution = Math.min(3, window.devicePixelRatio || 1);
    t.alpha = 0;
    this.d.labelLayer().addChild(t);
    // stack labels spawned close together so they never overlap
    const near = this.items.filter((l) => performance.now() - l.born < 500 && Math.hypot(l.x - x, l.y - y) < 1.5).length;
    this.items.push({ t, x, y, born: performance.now() + (opts.delay ?? 0), life: opts.life ?? 1300, lift: (opts.lift ?? 34) + near * 18 * scale });
  }

  frame(now: number): void {
    const reduced = this.d.settings().reducedMotion;
    const s0 = this.d.toScreen(0, 0), s1 = this.d.toScreen(0, 1);
    const sc = Math.max(1, (s1.y - s0.y) / 8);
    this.items = this.items.filter((l) => {
      const age = now - l.born;
      if (age < 0) return true;
      if (age > l.life) { l.t.destroy(); return false; }
      const k = age / l.life;
      const p = this.d.toScreen(l.x, l.y);
      const rise = reduced ? 0 : k * 22;
      l.t.x = Math.round(p.x);
      l.t.y = Math.round(p.y - l.lift * sc / 2 - rise - 18);
      l.t.alpha = k < 0.08 ? k / 0.08 : k > 0.75 ? (1 - k) / 0.25 : 1;
      l.t.scale.set(reduced ? 1 : k < 0.1 ? 0.7 + 3 * k : 1);
      return true;
    });
  }
}
