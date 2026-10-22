import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { C, PALETTE, type Weather } from '@eigenlands/shared';
import { makeCanvas } from '../art/draw';

const MAX_RAIN = 260, MAX_SNOW = 170, MAX_SPLASH = 40;

interface Drop { s: Sprite; x: number; y: number; v: number; d: number }

/**
 * Screen-space weather: rain (slanted streaks + ground splashes), storm (heavier rain and lightning flashes),
 * snow (drifting flakes) and fog (slow noise veil). Particle sprites are pooled; `reduced` swaps motion for a
 * calm static tint with a handful of slow particles and no flashes.
 */
export class WeatherFx {
  private root = new Container();
  private rain: Drop[] = [];
  private snow: Drop[] = [];
  private splash: Array<{ s: Sprite; life: number }> = [];
  private veil: Sprite[] = [];
  private tint = new Graphics();
  private flash = new Graphics();
  private streak: Texture;
  private flake: Texture;
  private ring: Texture;
  private t = 0;
  private nextFlash = 6;
  private flashT = 0;
  private w = 0;
  private h = 0;

  constructor(parent: Container) {
    parent.addChild(this.root);
    this.root.addChild(this.tint);
    const mk = (w: number, h: number, f: (ctx: CanvasRenderingContext2D) => void) => { const { canvas, ctx } = makeCanvas(w, h); f(ctx); const t = Texture.from(canvas); t.source.scaleMode = 'nearest'; return t; };
    this.streak = mk(3, 10, (c) => { c.fillStyle = PALETTE[C.w5]!; for (let i = 0; i < 9; i++) c.fillRect(Math.floor(2 - i / 4.5), i, 1, 1); c.fillStyle = PALETTE[C.w6]!; c.fillRect(2, 0, 1, 2); });
    this.flake = mk(3, 3, (c) => { c.fillStyle = PALETTE[C.white]!; c.fillRect(1, 0, 1, 3); c.fillRect(0, 1, 3, 1); });
    this.ring = mk(7, 3, (c) => { c.fillStyle = PALETTE[C.w6]!; c.fillRect(1, 0, 5, 1); c.fillRect(0, 1, 1, 1); c.fillRect(6, 1, 1, 1); c.fillRect(1, 2, 5, 1); });
    // fog: tileable value-noise veil
    const fog = mk(128, 128, (c) => {
      const img = c.createImageData(128, 128);
      const v = (x: number, y: number, s: number) => { const n = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }; const G = 128 / s; const gx = x / G, gy = y / G; const x0 = Math.floor(gx) % s, y0 = Math.floor(gy) % s; const fx = gx - Math.floor(gx), fy = gy - Math.floor(gy); const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); const x1 = (x0 + 1) % s, y1 = (y0 + 1) % s; return (n(x0, y0) * (1 - ux) + n(x1, y0) * ux) * (1 - uy) + (n(x0, y1) * (1 - ux) + n(x1, y1) * ux) * uy; };
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const a = 0.55 * v(x, y, 4) + 0.3 * v(x, y, 8) + 0.15 * v(x, y, 16); const i = (y * 128 + x) * 4; img.data[i] = 168; img.data[i + 1] = 181; img.data[i + 2] = 178; img.data[i + 3] = Math.max(0, Math.min(255, Math.round((a - 0.35) * 330))); }
      c.putImageData(img, 0, 0);
    });
    for (let i = 0; i < 2; i++) { const s = new Sprite(fog); s.alpha = 0; s.visible = false; this.veil.push(s); this.root.addChild(s); }
    this.root.addChild(this.flash);
    for (let i = 0; i < MAX_RAIN; i++) { const s = new Sprite(this.streak); s.visible = false; this.root.addChild(s); this.rain.push({ s, x: 0, y: 0, v: 0, d: 0 }); }
    for (let i = 0; i < MAX_SNOW; i++) { const s = new Sprite(this.flake); s.visible = false; this.root.addChild(s); this.snow.push({ s, x: 0, y: 0, v: 0, d: 0 }); }
    for (let i = 0; i < MAX_SPLASH; i++) { const s = new Sprite(this.ring); s.visible = false; s.anchor.set(0.5); this.root.addChild(s); this.splash.push({ s, life: 0 }); }
  }

  /** viewW/viewH in CSS px; hour is the in-game hour (reserved: storms are more dramatic at night) */
  update(dt: number, weather: Weather, viewW: number, viewH: number, reduced: boolean, hour: number): void {
    this.t += dt;
    if (viewW !== this.w || viewH !== this.h) {
      this.w = viewW; this.h = viewH;
      for (const v of this.veil) { v.width = viewW + 256; v.height = viewH + 256; }
      for (const p of [...this.rain, ...this.snow]) { p.x = Math.random() * viewW; p.y = Math.random() * viewH; }
    }
    const raining = weather === 'rain' || weather === 'storm';
    const snowing = weather === 'snow';
    const heavy = weather === 'storm';
    const nRain = raining ? (reduced ? 14 : heavy ? MAX_RAIN : 150) : 0;
    const nSnow = snowing ? (reduced ? 18 : MAX_SNOW) : 0;
    const scale = Math.max(2, Math.round(viewW / 420));

    this.tint.clear();
    if (raining) this.tint.rect(0, 0, viewW, viewH).fill({ color: heavy ? 0x172038 : 0x253a5e, alpha: reduced ? 0.12 : heavy ? 0.22 : 0.12 });
    else if (snowing) this.tint.rect(0, 0, viewW, viewH).fill({ color: 0xa8b5b2, alpha: 0.06 });

    this.rain.forEach((p, i) => {
      const on = i < nRain;
      p.s.visible = on;
      if (!on) return;
      const speed = (heavy ? 900 : 650) * (reduced ? 0.4 : 1);
      p.s.scale.set(scale);
      p.x -= speed * 0.32 * dt; p.y += speed * dt;
      if (p.y > viewH || p.x < -20) {
        if (!reduced && Math.random() < 0.18) this.spawnSplash(p.x, viewH * (0.35 + Math.random() * 0.65));
        p.x = Math.random() * (viewW + 160); p.y = -20 - Math.random() * 60;
      }
      p.s.x = Math.round(p.x); p.s.y = Math.round(p.y); p.s.alpha = 0.3 + (i % 4) * 0.08;
    });
    this.snow.forEach((p, i) => {
      const on = i < nSnow;
      p.s.visible = on;
      if (!on) return;
      p.s.scale.set(Math.max(1, scale - 1) + (i % 3 === 0 ? 1 : 0));
      const fall = (reduced ? 18 : 46) + (i % 5) * 9;
      p.y += fall * dt; p.d += dt;
      p.x += Math.sin(p.d * 1.3 + i) * (reduced ? 6 : 22) * dt - 6 * dt;
      if (p.y > viewH) { p.y = -6; p.x = Math.random() * viewW; }
      if (p.x < -6) p.x = viewW + 4; else if (p.x > viewW + 6) p.x = -4;
      p.s.x = Math.round(p.x); p.s.y = Math.round(p.y); p.s.alpha = 0.6 + (i % 3) * 0.15;
    });
    for (const sp of this.splash) {
      if (sp.life <= 0) { sp.s.visible = false; continue; }
      sp.life -= dt; sp.s.alpha = Math.max(0, sp.life / 0.3); sp.s.scale.set(scale * (1.6 - sp.life * 2)); sp.s.visible = sp.life > 0;
    }

    const fogOn = weather === 'fog';
    this.veil.forEach((v, i) => {
      v.visible = fogOn;
      if (!fogOn) return;
      const drift = reduced ? 0 : this.t * (i ? -7 : 5);
      v.x = -((drift + i * 90) % 128) - 64; v.y = -((i ? drift * 0.3 : -drift * 0.2) % 128) - 64;
      v.alpha = reduced ? 0.35 : 0.42 + 0.06 * Math.sin(this.t * 0.2 + i);
    });

    // lightning
    this.flash.clear();
    if (heavy && !reduced) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) { this.flashT = 0.35; this.nextFlash = 7 + Math.random() * 9 + (hour > 19 || hour < 5 ? 0 : 3); }
      if (this.flashT > 0) {
        this.flashT -= dt;
        const k = this.flashT > 0.25 ? 1 : this.flashT > 0.18 ? 0.2 : this.flashT > 0.1 ? 0.7 : this.flashT / 0.1 * 0.2;
        this.flash.rect(0, 0, viewW, viewH).fill({ color: 0xd6f0ea, alpha: 0.32 * k });
      }
    }
  }

  private spawnSplash(x: number, y: number): void {
    const sp = this.splash.find((s) => s.life <= 0);
    if (!sp) return;
    sp.life = 0.3; sp.s.x = Math.round(x); sp.s.y = Math.round(y); sp.s.visible = true;
  }

  /** multiplier applied to the lightmap ambient colour (overcast/storm darkening) */
  ambient(weather: Weather): [number, number, number] {
    switch (weather) {
      case 'cloudy': return [0.92, 0.93, 0.95];
      case 'rain': return [0.8, 0.83, 0.9];
      case 'storm': return [0.62, 0.66, 0.78];
      case 'snow': return [0.95, 0.97, 1.0];
      case 'fog': return [0.9, 0.92, 0.95];
      default: return [1, 1, 1];
    }
  }
}
