import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { auroraAt, rainbowAt, starfallOn, type Weather } from '@eigenlands/shared';
import { makeCanvas } from '../art/draw';

/**
 * The sky over the land (screen space, above the night lighting): shooting stars on clear nights, a shower of them on
 * starfall nights, curtains of aurora over the taiga, and the morning rainbow after a rainy day. Cheap: a small pool
 * of streak sprites and two Graphics redrawn only while something is showing.
 */
const MAX_METEORS = 10;

interface Meteor {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export interface SkyFrame {
  dt: number;
  w: number;
  h: number;
  seed: number;
  day: number;
  hour: number;
  weather: Weather;
  biome: string;
  /** under open sky (not in a cave, upstairs, diving or a crypt) */
  outdoors: boolean;
  reduced: boolean;
}

export class SkyFx {
  readonly root = new Container();
  private meteors: Meteor[] = [];
  private aurora = new Graphics();
  private rainbow = new Graphics();
  private nextMeteor = 3;
  private t = 0;
  private auroraK = 0;
  private rainbowKey = '';

  constructor(parent: Container) {
    parent.addChild(this.root);
    this.aurora.blendMode = 'add';
    this.root.addChild(this.rainbow, this.aurora);
    const { canvas, ctx } = makeCanvas(40, 3);
    // a bright head on the right fading to nothing on the left
    for (let x = 0; x < 40; x++) {
      const a = (x / 39) ** 2;
      ctx.fillStyle = `rgba(230,244,255,${a.toFixed(3)})`;
      ctx.fillRect(x, 1, 1, 1);
      if (x > 30) {
        ctx.fillStyle = `rgba(200,230,255,${(a * 0.4).toFixed(3)})`;
        ctx.fillRect(x, 0, 1, 1);
        ctx.fillRect(x, 2, 1, 1);
      }
    }
    const tex = Texture.from(canvas);
    tex.source.scaleMode = 'nearest';
    for (let i = 0; i < MAX_METEORS; i++) {
      const s = new Sprite(tex);
      s.anchor.set(1, 0.5);
      s.visible = false;
      s.blendMode = 'add';
      this.root.addChild(s);
      this.meteors.push({ s, vx: 0, vy: 0, life: 0, max: 1 });
    }
  }

  update(f: SkyFrame): void {
    this.t += f.dt;
    const night = f.hour >= 20.5 || f.hour < 4.5;
    const clearSky = f.weather === 'clear' || f.weather === 'cloudy';
    const shower = starfallOn(f.seed, f.hour < 4.5 ? f.day - 1 : f.day);
    // shooting stars: a shower on starfall nights, now and then on any clear night
    if (f.outdoors && night && clearSky) {
      this.nextMeteor -= f.dt;
      if (this.nextMeteor <= 0) {
        this.launch(f);
        this.nextMeteor = shower ? (f.reduced ? 2.5 : 0.35 + Math.random() * 0.9) : 25 + Math.random() * 35;
      }
    }
    for (const m of this.meteors) {
      if (m.life <= 0) {
        m.s.visible = false;
        continue;
      }
      m.life -= f.dt;
      m.s.x += m.vx * f.dt;
      m.s.y += m.vy * f.dt;
      const k = m.life / m.max;
      m.s.alpha = Math.min(1, k * 2.2) * (k < 0.85 ? 1 : (1 - k) / 0.15);
    }
    this.drawAurora(f);
    this.drawRainbow(f);
  }

  private launch(f: SkyFrame): void {
    const m = this.meteors.find((x) => x.life <= 0);
    if (!m) return;
    const scale = Math.max(1, Math.min(3, Math.round(f.w / 640)));
    const sp = (f.reduced ? 260 : 620) * (0.8 + Math.random() * 0.5);
    // falling toward the lower left
    const dx = -(0.85 + Math.random() * 0.3),
      dy = 0.32 + Math.random() * 0.22,
      l = Math.hypot(dx, dy);
    m.vx = (dx / l) * sp;
    m.vy = (dy / l) * sp;
    m.s.rotation = Math.atan2(m.vy, m.vx);
    m.s.scale.set(scale * (0.7 + Math.random() * 0.6), scale);
    m.s.x = f.w * (0.25 + Math.random() * 0.85);
    m.s.y = f.h * Math.random() * 0.3;
    m.max = m.life = 0.55 + Math.random() * 0.5;
    m.s.visible = true;
  }

  private drawAurora(f: SkyFrame): void {
    const want = f.outdoors && auroraAt(f.biome, f.weather, f.hour) ? 1 : 0;
    this.auroraK += (want - this.auroraK) * Math.min(1, f.dt * 0.6);
    this.aurora.clear();
    if (this.auroraK < 0.02) return;
    const t = f.reduced ? 0 : this.t;
    const cols = Math.ceil(f.w / 10);
    const bands: Array<[number, number, number]> = [
      [0.1, 0x3fd9a0, 0],
      [0.17, 0x2fb7c6, 2.1],
      [0.24, 0x8a6bd8, 4.3],
    ];
    for (const [base, color, ph] of bands)
      for (let i = 0; i < cols; i++) {
        const x = i * 10;
        const wave = Math.sin(x * 0.006 + t * 0.25 + ph) * 26 + Math.sin(x * 0.017 - t * 0.4 + ph * 2) * 10;
        const top = f.h * base + wave;
        const len = 46 + Math.sin(x * 0.011 + t * 0.3 + ph) * 22;
        const shimmer = 0.5 + 0.5 * Math.sin(x * 0.05 + t * 1.3 + ph);
        const alpha = (0.035 + shimmer * 0.045) * this.auroraK;
        this.aurora.rect(x, top, 10, len).fill({ color, alpha });
        this.aurora.rect(x, top + len, 10, len * 0.6).fill({ color, alpha: alpha * 0.4 });
      }
  }

  private drawRainbow(f: SkyFrame): void {
    const on = f.outdoors && rainbowAt(f.seed, f.day, f.hour);
    // strongest at 8, fading in from 7 and out by 10
    const k = on ? Math.max(0, Math.min(1, (f.hour - 7) * 2, (10 - f.hour) / 1.5)) : 0;
    const key = `${f.w}:${f.h}:${Math.round(k * 20)}`;
    if (key === this.rainbowKey) return;
    this.rainbowKey = key;
    this.rainbow.clear();
    if (k <= 0) return;
    const colors = [0xe2504a, 0xf09a3e, 0xf2d35c, 0x6cc56a, 0x4f9fe0, 0x5a63c9, 0x9a63c9];
    const cx = f.w * 0.62,
      cy = f.h * 1.05,
      r0 = f.h * 0.92,
      band = Math.max(3, Math.round(f.h / 140));
    colors.forEach((c, i) => {
      this.rainbow
        .arc(cx, cy, r0 - i * band, Math.PI * 1.08, Math.PI * 1.92)
        .stroke({ color: c, width: band, alpha: 0.13 * k });
    });
  }

  /** for tests and the debug panel */
  counts(): { meteors: number; aurora: number } {
    return { meteors: this.meteors.filter((m) => m.life > 0).length, aurora: this.auroraK };
  }
}
