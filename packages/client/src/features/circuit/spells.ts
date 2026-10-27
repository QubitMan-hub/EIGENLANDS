/**
 * Draws synced ability effects (WorldState.spells) in iso space: element-coloured bolts with trails (interpolated),
 * expanding rings, Echoes (a shimmering, chromatically split copy of the caster), tethers, shields/wards/mirrors
 * and blink flashes. Reduced motion keeps everything readable but drops trails, wobble and shimmer.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { SPELL } from '@eigenlands/shared';
import { DIR_DOWN, OUTFITS, dirOf } from '../../art/actors';
import { ISO_HH, ISO_HW, depth, isoX, isoY, screenDir } from '../../game/iso';
import { Interpolator, type Pose } from '../../net/interp';
import type { P34Deps } from '../types';
import { elCol } from './art';

/** gate ranks E, D, C, B, A, S: grey-blue, green, blue, violet, amber, red */
const GATE_COLORS = [0x9fb8c8, 0x5fd06a, 0x4aa3ff, 0xb06bff, 0xffb347, 0xff4a5a];
const GATE_LETTERS = ['E', 'D', 'C', 'B', 'A', 'S'];
/** 3 x 5 pixel letters for the gate ranks */
const GLYPHS: Record<string, string[]> = {
  E: ['###', '#..', '##.', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
};

export interface SpellLike {
  id: string;
  kind: number;
  x: number;
  y: number;
  hue: number;
  owner: string;
  target: string;
  r: number;
  dx: number;
  dy: number;
}

interface View {
  id: string;
  kind: number;
  s: SpellLike;
  root: Container;
  g: Graphics;
  born: number;
  /** set when the server removed it: fade out from this time */
  dead: number;
  trail: Array<{ x: number; y: number }>;
  echo?: { main: Sprite; red: Sprite; cyan: Sprite };
}

const SQ2 = Math.SQRT2;
const FADE_MS = 260;

export class SpellRenderer {
  private views = new Map<string, View>();
  private interp = new Interpolator<Pose & { s: SpellLike }>();

  constructor(private d: P34Deps) {}

  /** Feed the current spell set (from state or a dev fake) stamped with server time `t`. */
  ingest(list: Iterable<SpellLike>, t: number): void {
    const now = performance.now();
    const seen = new Set<string>();
    for (const sp of list) {
      seen.add(sp.id);
      const s: SpellLike = {
        id: sp.id,
        kind: sp.kind,
        x: sp.x,
        y: sp.y,
        hue: sp.hue,
        owner: sp.owner,
        target: sp.target,
        r: sp.r,
        dx: sp.dx,
        dy: sp.dy,
      };
      this.interp.push(sp.id, t, { x: s.x, y: s.y, faceX: s.dx, faceY: s.dy, s });
      let v = this.views.get(sp.id);
      if (!v) {
        v = this.make(s, now);
        this.views.set(sp.id, v);
      } else {
        v.s = s;
        v.dead = 0;
      }
    }
    for (const [id, v] of this.views) if (!seen.has(id) && !v.dead) v.dead = now;
  }

  private make(s: SpellLike, now: number): View {
    const root = new Container();
    const g = new Graphics();
    root.addChild(g);
    const world = s.kind === SPELL.ECHO || s.kind === SPELL.BOLT || s.kind === SPELL.GATE;
    (world ? this.d.entityLayer() : this.d.fxLayer()).addChild(root);
    const v: View = { id: s.id, kind: s.kind, s, root, g, born: now, dead: 0, trail: [] };
    if (s.kind === SPELL.ECHO) {
      const mk = (tint: number, alpha: number, add: boolean) => {
        const sp = new Sprite();
        sp.anchor.set(0.5, 1);
        sp.y = 1;
        sp.tint = tint;
        sp.alpha = alpha;
        if (add) sp.blendMode = 'add';
        root.addChild(sp);
        return sp;
      };
      v.echo = { red: mk(0xff6ad0, 0.35, true), cyan: mk(0x5af0d0, 0.35, true), main: mk(0xd8e8ff, 0.5, false) };
    }
    if (s.kind === SPELL.BLINK) {
      this.d.fx().ring(s.x, s.y, 46, 1.2);
      this.d.fx().burst(s.x, s.y, [46, 47, 7], 10);
    }
    return v;
  }

  frame(now: number): void {
    const reduced = this.d.settings().reducedMotion;
    const t = this.d.renderTime();
    for (const [id, v] of this.views) {
      const fade = v.dead ? 1 - (now - v.dead) / FADE_MS : 1;
      if (fade <= 0) {
        v.root.destroy({ children: true });
        this.views.delete(id);
        this.interp.remove(id);
        continue;
      }
      const age = (now - v.born) / 1000;
      const smp = this.interp.sample(id, t);
      const x = smp?.x ?? v.s.x,
        y = smp?.y ?? v.s.y;
      v.root.alpha = Math.max(0, fade);
      v.g.clear();
      const col = elCol(v.s.hue);
      switch (v.kind) {
        case SPELL.BOLT:
          this.bolt(v, x, y, col, age, reduced);
          break;
        case SPELL.ARENA:
          this.arena(v, x, y);
          break;
        case SPELL.STRIKE:
          this.strike(v, x, y, col, age, reduced);
          break;
        case SPELL.RING:
          this.ring(v, x, y, col, age, reduced);
          break;
        case SPELL.ECHO:
          this.echoView(v, x, y, age, reduced, t);
          break;
        case SPELL.TETHER:
          this.tether(v, x, y, col, age, reduced);
          break;
        case SPELL.SHIELD:
        case SPELL.WARD:
        case SPELL.MIRROR:
          this.bubble(v, x, y, col, age, reduced);
          break;
        case SPELL.BLINK:
          this.flash(v, x, y, col, age);
          break;
        case SPELL.RESIDUE:
          this.residue(v, x, y, age, reduced);
          break;
        case SPELL.GATE:
          this.gate(v, x, y, age, reduced);
          break;
      }
    }
  }

  private bolt(v: View, x: number, y: number, col: number, age: number, reduced: boolean): void {
    const px = isoX(x, y),
      py = isoY(x, y);
    v.root.x = Math.round(px);
    v.root.y = Math.round(py);
    v.root.zIndex = depth(x, y) + 1;
    const g = v.g;
    if (!reduced) {
      v.trail.push({ x: px, y: py });
      if (v.trail.length > 9) v.trail.shift();
      v.trail.forEach((p, i) => {
        const k = (i + 1) / v.trail.length;
        g.rect(Math.round(p.x - px) - 1, Math.round(p.y - py) - 9, 2, 2).fill({ color: col, alpha: 0.12 + 0.45 * k });
      });
    }
    const pulse = reduced ? 1 : 1 + 0.15 * Math.sin(age * 30);
    g.ellipse(0, 0, 4, 2).fill({ color: 0x0b0c1a, alpha: 0.25 }); // ground shadow
    g.circle(0, -8, 6 * pulse).fill({ color: col, alpha: 0.18 });
    g.circle(0, -8, 3.5).fill({ color: col, alpha: 0.85 });
    g.rect(-1, -9, 2, 2).fill(0xffffff);
  }

  /** Quiet runework is fixed to the encounter's ground, below actors and warnings. */
  private arena(v: View, x: number, y: number): void {
    v.root.x = Math.round(isoX(x, y));
    v.root.y = Math.round(isoY(x, y));
    v.root.zIndex = depth(x, y) - 10000;
    const g = v.g,
      r = v.s.r || 9,
      pattern = v.s.hue,
      phase = v.s.dx || 0,
      color = elCol([0, 5, 6, 1, 3][pattern] ?? 6);
    const at = (x: number, y: number) => [Math.round(isoX(x, y)), Math.round(isoY(x, y))];
    const diamond = (x: number, y: number, size: number) => {
      const pts = [at(x - size, y), at(x, y - size), at(x + size, y), at(x, y + size)].flat();
      g.poly(pts).stroke({ color, width: 1, alpha: 0.34 });
    };
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      diamond(Math.cos(a) * r, Math.sin(a) * r, 0.24);
    }
    if (pattern === 2) {
      for (const [dx, dy] of [
        [-4, -4],
        [4, -4],
        [-4, 4],
        [4, 4],
      ])
        diamond(dx!, dy!, 1.1);
      g.poly([at(-4, -4), at(4, -4), at(4, 4), at(-4, 4)].flat()).stroke({ color, width: 1, alpha: 0.13 });
    } else if (pattern === 3) {
      for (const d of [-4, 0, 4])
        g.moveTo(...(at(-6, d) as [number, number]))
          .lineTo(...(at(6, d) as [number, number]))
          .stroke({ color, width: 1, alpha: 0.18 });
      diamond(0, 0, 2);
    } else {
      const n = pattern === 4 ? 6 : pattern === 1 ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const a = ((i + (pattern === 4 ? phase * 0.5 : 0)) / n) * Math.PI * 2,
          dx = Math.cos(a),
          dy = Math.sin(a);
        g.moveTo(...(at(dx * 5.5, dy * 5.5) as [number, number]))
          .lineTo(...(at(dx * 7.5, dy * 7.5) as [number, number]))
          .stroke({ color, width: 1, alpha: 0.25 });
        diamond(dx * 6.5, dy * 6.5, pattern === 1 ? 0.55 : 0.75);
      }
    }
  }

  /** A short world-space fan agrees with the server's forward strike cone. */
  private strike(v: View, x: number, y: number, col: number, age: number, reduced: boolean): void {
    v.root.x = Math.round(isoX(x, y));
    v.root.y = Math.round(isoY(x, y)) - 8;
    v.root.zIndex = depth(x, y) + 1;
    const r = Math.max(0.5, v.s.r),
      base = Math.atan2(v.s.dy, v.s.dx),
      sweep = reduced ? 1 : Math.min(1, age / 0.16);
    const points: number[] = [0, 0];
    for (let i = 0; i <= 14; i++) {
      const a = base - 1.2 + (i / 14) * 2.4 * sweep;
      points.push(
        Math.round(isoX(Math.cos(a) * r, Math.sin(a) * r)),
        Math.round(isoY(Math.cos(a) * r, Math.sin(a) * r)),
      );
    }
    v.g.poly(points).fill({ color: col, alpha: 0.16 }).stroke({ color: col, width: 2, alpha: 0.9 });
  }

  private ring(v: View, x: number, y: number, col: number, age: number, reduced: boolean): void {
    v.root.x = isoX(x, y);
    v.root.y = isoY(x, y);
    const R = Math.max(0.5, v.s.r || 2.5);
    const k = reduced ? 1 : Math.min(1, age / 0.3);
    const ease = 1 - (1 - k) ** 3;
    const rx = R * ease * ISO_HW * SQ2,
      ry = R * ease * ISO_HH * SQ2;
    const g = v.g;
    g.ellipse(0, 0, rx, ry).fill({ color: col, alpha: 0.12 * (1 - k * 0.5) });
    g.ellipse(0, 0, rx, ry).stroke({ color: col, width: 2, alpha: 0.9 });
    g.ellipse(0, 0, rx * 0.82, ry * 0.82).stroke({ color: 0xffffff, width: 1, alpha: 0.35 * (1 - k) + 0.1 });
    if (!reduced)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + age * 2;
        g.rect(Math.cos(a) * rx - 1, Math.sin(a) * ry - 1 - 3 * Math.sin(age * 8 + i), 2, 2).fill({
          color: col,
          alpha: 0.8,
        });
      }
  }

  private echoView(v: View, x: number, y: number, age: number, reduced: boolean, t: number): void {
    const e = v.echo!;
    v.root.x = Math.round(isoX(x, y));
    v.root.y = Math.round(isoY(x, y));
    v.root.zIndex = depth(x, y);
    const me = v.s.owner === this.d.myId();
    const pose = me ? null : (this.d.interp().sample(v.s.owner, t)?.pose as (Pose & { look?: number }) | undefined);
    const look = me ? this.d.profile.equip.outfit : Number(pose?.look ?? 0);
    const fx = v.s.dx || pose?.faceX || 0,
      fy = v.s.dy || pose?.faceY || 1;
    const sd = screenDir(fx, fy);
    const tex = this.d
      .sheets()
      .person(((look % OUTFITS.length) + OUTFITS.length) % OUTFITS.length, fx || fy ? dirOf(sd.x, sd.y) : DIR_DOWN, 0);
    for (const s of [e.main, e.red, e.cyan]) s.texture = tex;
    const off = reduced ? 1 : 1 + Math.round(Math.sin(age * 9) * 1.2);
    e.red.x = -off;
    e.cyan.x = off;
    e.main.alpha = reduced ? 0.55 : 0.42 + 0.12 * Math.sin(age * 6);
    e.main.y = 1 - (reduced ? 0 : Math.round(Math.sin(age * 3)));
    const g = v.g;
    g.ellipse(0, 0, 7, 3).stroke({ color: 0x5af0d0, width: 1, alpha: 0.5 });
    if (!reduced)
      for (let i = 0; i < 3; i++) {
        const yy = -((age * 14 + i * 8) % 24);
        g.rect(-6 + ((i * 5 + Math.floor(age * 10)) % 12), yy, 1, 1).fill({ color: 0xd49aff, alpha: 0.8 });
      }
  }

  private tether(v: View, x: number, y: number, col: number, age: number, reduced: boolean): void {
    const a = this.d.entityPos(v.s.owner) ?? (v.s.owner === this.d.myId() ? this.d.me() : null) ?? { x, y };
    const b = this.d.entityPos(v.s.target) ?? { x: v.s.x, y: v.s.y };
    v.root.x = 0;
    v.root.y = 0;
    const ax = isoX(a.x, a.y),
      ay = isoY(a.x, a.y) - 9,
      bx = isoX(b.x, b.y),
      by = isoY(b.x, b.y) - 8;
    const g = v.g;
    const seg = 14;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len,
      ny = (bx - ax) / len;
    const pts: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const k = i / seg;
      const w = reduced ? 0 : Math.sin(k * Math.PI) * Math.sin(age * 7 + k * 9) * 2.5;
      pts.push(ax + (bx - ax) * k + nx * w, ay + (by - ay) * k + ny * w);
    }
    g.poly(pts, false).stroke({ color: col, width: 4, alpha: 0.18 });
    g.poly(pts, false).stroke({ color: col, width: 1.5, alpha: 0.95 });
    // a bead of light runs along the thread
    const k = reduced ? 0.5 : (age * 0.9) % 1;
    g.circle(ax + (bx - ax) * k, ay + (by - ay) * k, 1.6).fill(0xffffff);
    g.circle(bx, by, 2).stroke({ color: col, width: 1, alpha: 0.9 });
  }

  private bubble(v: View, x: number, y: number, col: number, age: number, reduced: boolean): void {
    const p = this.d.entityPos(v.s.owner) ?? { x, y };
    v.root.x = isoX(p.x, p.y);
    v.root.y = isoY(p.x, p.y) - 10;
    const R = (v.s.r || 0.8) * 13;
    const g = v.g;
    const breathe = reduced ? 1 : 1 + 0.04 * Math.sin(age * 4);
    const pop = reduced ? 1 : Math.min(1, age / 0.18);
    const r = R * breathe * pop;
    if (v.kind === SPELL.SHIELD) {
      g.ellipse(0, 0, r, r * 1.1)
        .fill({ color: col, alpha: 0.14 })
        .stroke({ color: col, width: 1.5, alpha: 0.85 });
      g.ellipse(-r * 0.35, -r * 0.45, r * 0.25, r * 0.15).fill({ color: 0xffffff, alpha: 0.5 });
    } else if (v.kind === SPELL.WARD) {
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + (reduced ? 0 : age * 0.8);
        pts.push(Math.cos(a) * r, Math.sin(a) * r * 1.05);
      }
      g.poly(pts).fill({ color: col, alpha: 0.1 }).stroke({ color: col, width: 1.5, alpha: 0.9 });
    } else {
      g.ellipse(0, 0, r, r * 1.1)
        .fill({ color: 0xffffff, alpha: 0.06 })
        .stroke({ color: col, width: 2, alpha: 0.9 });
      const a = reduced ? -0.8 : age * 3;
      g.moveTo(Math.cos(a) * r, Math.sin(a) * r * 1.1)
        .lineTo(Math.cos(a + 0.6) * r, Math.sin(a + 0.6) * r * 1.1)
        .stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
    }
  }

  /** The lingering echo of a defeated creature: a violet rune on the ground and motes rising from it. */
  private residue(v: View, x: number, y: number, age: number, reduced: boolean): void {
    v.root.x = isoX(x, y);
    v.root.y = isoY(x, y);
    v.root.zIndex = depth(x, y) - 1;
    const mine = v.s.owner === this.d.myId();
    const a = mine ? 1 : 0.35;
    const g = v.g;
    const pulse = reduced ? 0.8 : 0.7 + 0.3 * Math.sin(age * 4);
    g.ellipse(0, 0, 12, 6).fill({ color: 0x2a1060, alpha: 0.35 * a });
    g.ellipse(0, 0, 12, 6).stroke({ color: 0xa46aff, width: 1.5, alpha: 0.9 * pulse * a });
    g.ellipse(0, 0, 7, 3.5).stroke({ color: 0xd49aff, width: 1, alpha: 0.7 * a });
    const rot = reduced ? 0 : age * 1.4;
    for (let i = 0; i < 4; i++) {
      const t = rot + (i * Math.PI) / 2;
      g.rect(Math.round(Math.cos(t) * 9.5) - 1, Math.round(Math.sin(t) * 4.7) - 1, 2, 2).fill({
        color: 0xffffff,
        alpha: 0.8 * a,
      });
    }
    if (!reduced)
      for (let i = 0; i < 6; i++) {
        const k = (age * 0.7 + i / 6) % 1,
          yy = -k * 26;
        g.rect(Math.round(Math.sin(i * 2.4 + age) * 5) - 1, yy, 2, 2).fill({
          color: i % 2 ? 0xd49aff : 0x7a3ad0,
          alpha: (1 - k) * 0.9 * a,
        });
      }
  }

  /**
   * A dungeon gate: a standing oval rift in its rank's colour (E grey-blue through D, C, B, A to S red), swirling,
   * with its rank lettered beneath. The way out of a dungeon (r = 2) is a smaller, pale rift.
   */
  private gate(v: View, x: number, y: number, age: number, reduced: boolean): void {
    v.root.x = Math.round(isoX(x, y));
    v.root.y = Math.round(isoY(x, y));
    v.root.zIndex = depth(x, y);
    const g = v.g;
    const exit = v.s.r === 2;
    const rank = Math.max(0, Math.min(5, v.s.hue));
    const col = exit ? 0xd8f4ff : GATE_COLORS[rank]!;
    const w = exit ? 9 : 10 + rank,
      h = exit ? 15 : 17 + rank * 1.5;
    const cy = -h - 2;
    const pulse = reduced ? 1 : 1 + 0.05 * Math.sin(age * 3);
    g.ellipse(0, 0, w + 4, (w + 4) / 2).fill({ color: 0x0b0c1a, alpha: 0.3 });
    g.ellipse(0, 0, w + 2, (w + 2) / 2).stroke({ color: col, width: 1, alpha: 0.5 });
    // outer glow, the rift's dark heart, its rim
    g.ellipse(0, cy, (w + 4) * pulse, (h + 4) * pulse).fill({ color: col, alpha: 0.16 });
    g.ellipse(0, cy, w, h).fill({ color: 0x0b0c1a, alpha: 0.9 });
    g.ellipse(0, cy, w * 0.72, h * 0.8).fill({ color: col, alpha: 0.22 });
    g.ellipse(0, cy, w, h).stroke({ color: col, width: 2, alpha: 0.95 });
    // the swirl: motes winding inward
    const n = reduced ? 6 : 14;
    for (let i = 0; i < n; i++) {
      const k = ((reduced ? 0 : age * 0.45) + i / n) % 1,
        a = i * 2.39996 + (reduced ? 0 : age * 2.2);
      const rr = 1 - k;
      g.rect(Math.round(Math.cos(a) * w * 0.9 * rr) - 1, Math.round(cy + Math.sin(a) * h * 0.9 * rr) - 1, 2, 2).fill({
        color: i % 3 ? col : 0xffffff,
        alpha: 0.35 + 0.6 * rr,
      });
    }
    if (exit) return;
    // its rank, in a pixel glyph beneath
    const glyph = GLYPHS[GATE_LETTERS[rank]!]!;
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++)
        if (glyph[r]![c] === '#') g.rect(-3 + c * 2, 4 + r * 2, 2, 2).fill({ color: col, alpha: 0.95 });
  }

  private flash(v: View, x: number, y: number, col: number, age: number): void {
    v.root.x = isoX(x, y);
    v.root.y = isoY(x, y);
    const k = Math.min(1, age / 0.35);
    v.g.ellipse(0, -8, 4 + 10 * k, 8 + 14 * k).fill({ color: col, alpha: 0.5 * (1 - k) });
    v.g.rect(-1, -24 * (1 - k) - 4, 2, 24 * (1 - k)).fill({ color: 0xffffff, alpha: 1 - k });
  }

  /** Circuit auras (shield, ward, mirror) currently wrapped around `owner`, for the status row. */
  aurasOf(owner: string): Array<'shield' | 'ward' | 'mirror'> {
    const out: Array<'shield' | 'ward' | 'mirror'> = [];
    for (const v of this.views.values()) {
      if (v.dead || v.s.owner !== owner) continue;
      if (v.kind === SPELL.SHIELD) out.push('shield');
      else if (v.kind === SPELL.WARD) out.push('ward');
      else if (v.kind === SPELL.MIRROR) out.push('mirror');
    }
    return out;
  }

  count(): number {
    return this.views.size;
  }
  kinds(): number[] {
    return [...this.views.values()].map((v) => v.kind);
  }
}
