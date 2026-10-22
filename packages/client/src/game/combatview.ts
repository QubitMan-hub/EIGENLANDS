import { critterDir, type Critters, type CritterId } from '../art/critters';
import type { Container, Graphics, Sprite } from 'pixi.js';
import {
  HUE_PALETTE,
  ATK, BRUTE_SLAM_RADIUS, CHARGE_FULL, CHARGE_MIN, CHARGE_WIDTH, COMBO, DASH_CHARGES, DASH_COOLDOWN, ELITE, ENEMY_BY_KIND, LEAP_RADIUS,
  PALETTE, PLAYER_RADIUS, heavyHit, hitStopMs, inArc, shakeFor, type FxMsg, type PlayerSim, type StepEvents,
} from '@eigenlands/shared';
import type { Sfx } from '../audio';
import type { FoeSheets } from '../art/foes';
import type { Sheets } from '../art/actors';
import { DIR_LEFT } from '../art/actors';
import type { Fx } from './fx';
import { ISO_HH, ISO_HW, isoX, isoY, screenDir } from './iso';

const pc = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);
const SQ2 = Math.SQRT2;

/** The parts of a Game actor view that combat presentation touches. */
export interface CombatActor {
  id: string;
  type: 'player' | 'enemy' | 'proj' | 'npc' | 'shadow';
  root: Container;
  sprite: Sprite;
  /** additive white copy of the sprite: hit flash */
  fl: Sprite;
  gfx: Graphics;
  lx: number; ly: number;
  travel: number;
  outfit: number;
  kind: number;
  flash: number;
  punch: number;
  ghostT: number;
}

/** Synced fields combat reads from interpolated snapshots. */
export interface CombatSnap {
  hp: number; maxHp: number; flags: number; tele: number; kind: number; night: boolean;
  st: number; atk: number; tx: number; ty: number; poise: number; elite: number;
  faceX: number; faceY: number;
  rank?: number;
}

export interface CombatDeps {
  fx: () => Fx;
  sound: (s: Sfx, x?: number, y?: number) => void;
  /** play without a caption (heartbeat) */
  rawSound: (s: Sfx) => void;
  reduced: () => boolean;
  sheets: () => Sheets;
  foes: () => FoeSheets;
  critters: () => Critters;
  /** the wielded weapon: ranged = shoots instead of swinging; hue = its element (-1 physical) */
  weapon: () => { ranged: boolean; hue: number };
  myId: () => string;
  me: () => { x: number; y: number } | null;
  views: () => Iterable<CombatActor>;
}

const TIP_KEY = 'eigen.combatTips';
const TIPS: Record<string, string> = {
  combo: 'Combat: tap Attack (J / left click) for a 3-hit combo — the 3rd hit is a lunging finisher. HOLD Attack to charge a heavy strike, release to unleash it.',
  dodge: 'Red ground = an incoming attack. Dash (Space) THROUGH it just before it fills to Phase Slip: slow-mo, a refunded dash and a guaranteed critical counter.',
  orb: 'Phase Wisps fire slow orbs: dash through them — or swing at one to bat it back at them!',
  brute: 'Decoherent Brutes are armoured: light hits barely stagger them. Use finishers and charged heavies, or bait the charge into a wall.',
  charges: 'You have 2 dash charges (pips under your feet). They refill one at a time.',
  stagger: 'BREAK! Staggered foes take +20% damage — and knocking them into walls slams for bonus damage.',
};

/**
 * Client-side combat presentation: swing arcs, predicted hit confirms, hit-stop and phase-slip time warp,
 * telegraph decals, enemy flashes/squash/stagger, charge and dash-pip widgets, heartbeat, contextual tips.
 * Purely visual: the shared sim and the server decide everything.
 */
export class CombatView {
  /** extra delay (ms) applied to remote-entity render time: hit-stop freezes, phase slip slows */
  warp = 0;
  private stopT = 0;
  private slipT = 0;
  private predicted = new Map<string, number>();
  private bombs: Array<{ x: number; y: number; r: number; t0: number; dur: number }> = [];
  private heartT = 0;
  private hurtT = 0;
  private tip: { text: string; until: number } | null = null;
  private shown: Set<string>;
  private dashesUsed = 0;
  private wasCharging = false;
  killedBy = '';

  constructor(private d: CombatDeps, private decal: Graphics) {
    let s: string[] = [];
    try { s = JSON.parse(localStorage.getItem(TIP_KEY) ?? '[]'); } catch { /* ignore */ }
    this.shown = new Set(Array.isArray(s) ? s : []);
  }

  // ───────────── time ─────────────

  hitStop(ms: number): void { this.stopT = Math.max(this.stopT, ms / 1000); }

  /** Advance time effects; returns the dt scale for world effects this frame. */
  frame(dt: number): number {
    let scale = 1;
    if (this.stopT > 0) { this.stopT -= dt; this.warp += dt * 1000; scale = 0.05; }
    else if (this.slipT > 0) { this.slipT -= dt; this.warp += dt * 1000 * 0.65; scale = 0.4; }
    else this.warp = Math.max(0, this.warp - dt * 1000 * 0.45);
    this.warp = Math.min(this.warp, 220);
    for (const [k, t] of this.predicted) if (performance.now() - t > 600) this.predicted.delete(k);
    this.hurtT = Math.max(0, this.hurtT - dt);
    return scale;
  }

  // ───────────── local prediction ─────────────

  /** A predicted local step: draw the swing that the server will resolve, and confirm hits locally for instant feel. */
  onLocalStep(ev: StepEvents, sim: PlayerSim, me: CombatActor | undefined): void {
    const fx = this.d.fx();
    if (ev.dashed) {
      fx.dash(sim.x, sim.y, sim.faceX, sim.faceY); this.d.sound('dash');
      if (++this.dashesUsed === 3) this.showTip('charges');
    }
    if (ev.chargeReady) { this.d.sound('chargeReady'); fx.ring(sim.x, sim.y, 45, 0.9, 0.3, 1); }
    if (ev.chargeFull) { this.d.sound('chargeReady'); fx.ring(sim.x, sim.y, 39, 1.3, 0.35, 2); }
    const charging = sim.hold > 0 && sim.charge > 0;
    if (charging && !this.wasCharging) this.d.sound('charge');
    this.wasCharging = charging;
    if (!ev.attacked) return;
    const wp = this.d.weapon();
    if (wp.ranged) {
      // a shot: muzzle flash toward the aim, a recoil kick; the server fires and resolves it
      const col = wp.hue < 0 ? [22, 21, 7] : [HUE_PALETTE[wp.hue]!, 7];
      fx.burst(sim.x + sim.faceX * 0.5, sim.y + sim.faceY * 0.5, col, ev.heavy ? 9 : 4);
      if (ev.heavy) fx.ring(sim.x, sim.y, col[0]!, 1.1, 0.25, 1);
      this.d.sound(ev.heavy ? 'heavy' : 'shot');
      if (me) me.punch = ev.heavy ? 0.6 : 0.25;
      return;
    }
    const hit = ev.heavy ? heavyHit(ev.level) : COMBO[ev.combo]!;
    if (ev.heavy) { fx.heavy(sim.x, sim.y, sim.faceX, sim.faceY, ev.level); this.d.sound('heavy'); }
    else { fx.swing(sim.x, sim.y, sim.faceX, sim.faceY, ev.combo); this.d.sound(ev.combo === 2 ? 'finisher' : ev.combo === 1 ? 'swing2' : 'swing'); }
    if (ev.counter) { fx.banner(sim.x, sim.y, 'COUNTER!', 47); this.d.sound('counter'); }
    if (me) me.punch = ev.heavy ? 1 : ev.combo === 2 ? 0.8 : 0.45;
    // predicted hit confirm against what we see (the server rewinds to the same view)
    let any = false;
    for (const v of this.d.views()) {
      if (v.type !== 'enemy' || !v.root.visible) continue;
      const def = ENEMY_BY_KIND[v.kind];
      if (!def || !inArc(sim.x, sim.y, sim.faceX, sim.faceY, hit, { x: v.lx, y: v.ly, r: def.radius })) continue;
      any = true;
      this.predicted.set(v.id, performance.now());
      v.flash = 1; v.punch = 1;
      fx.impact(v.lx, v.ly, hit.weight, ev.counter, sim.faceX, sim.faceY);
    }
    if (any) {
      this.hitStop(hitStopMs(hit.weight, ev.counter, false));
      fx.kick(shakeFor(hit.weight, ev.counter, this.d.reduced()));
      this.d.sound(hit.weight >= 2 ? 'hitHeavy' : hit.weight === 1 ? 'hit' : 'hitLight');
    }
  }

  // ───────────── server effects ─────────────

  /** Handles combat FX; returns false for kinds it does not own. */
  onFx(f: FxMsg, view: (id: string) => CombatActor | undefined): boolean {
    const fx = this.d.fx();
    const mine = f.by !== undefined && f.by === this.d.myId();
    const near = (r = 14) => { const m = this.d.me(); return !m || Math.hypot(m.x - f.x, m.y - f.y) < r; };
    switch (f.kind) {
      case 'swing': fx.swing(f.x, f.y, f.dx ?? 0, f.dy ?? 1, f.v ?? 0); this.d.sound(f.v === 2 ? 'finisher' : 'swing', f.x, f.y); return true;
      case 'heavy': fx.heavy(f.x, f.y, f.dx ?? 0, f.dy ?? 1, f.v ?? 0); this.d.sound('heavy', f.x, f.y); return true;
      case 'hit': {
        const w = f.w ?? 0, crit = f.c === 1;
        const v = f.id ? view(f.id) : undefined;
        if (v) { v.flash = 1; v.punch = Math.max(v.punch, 0.6 + w * 0.15); }
        const wasPredicted = mine && f.id !== undefined && this.predicted.has(f.id);
        if (!wasPredicted) {
          fx.impact(f.x, f.y, w, crit, f.dx ?? 0, f.dy ?? 0);
          if (mine || w >= 2) { this.hitStop(hitStopMs(w, crit, false)); fx.kick(shakeFor(w, crit, this.d.reduced())); }
          this.d.sound(w >= 2 ? 'hitHeavy' : w === 1 ? 'hit' : 'hitLight', f.x, f.y);
        } else if (crit) this.hitStop(35);
        if (f.id) this.predicted.delete(f.id);
        if (crit) { this.d.sound('crit', f.x, f.y); fx.burst(f.x, f.y, [38, 39, 7], 8); }
        if (f.v !== undefined) fx.damage(f.x, f.y, f.v, { crit, weight: w, stagger: f.s === 1 });
        return true;
      }
      case 'stagger': {
        this.d.sound('stagger', f.x, f.y);
        fx.ring(f.x, f.y, 38, 1.0, 0.3, 1);
        if (near(10)) this.showTip('stagger');
        return true;
      }
      case 'slam':
        fx.shockwave(f.x, f.y, 0.9, 19); fx.banner(f.x, f.y, `SLAM +${f.v ?? ''}`, 36);
        this.d.sound('slam', f.x, f.y); this.hitStop(hitStopMs(2, false, false)); fx.kick(shakeFor(2, false, this.d.reduced()));
        return true;
      case 'crash':
        fx.shockwave(f.x + (f.dx ?? 0) * 0.5, f.y + (f.dy ?? 0) * 0.5, 1.3, 19); this.d.sound('crash', f.x, f.y);
        if (near()) fx.kick(shakeFor(2, false, this.d.reduced()));
        return true;
      case 'orb': fx.burst(f.x, f.y, [45, 46, 37], 6); this.d.sound('orb', f.x, f.y); return true;
      case 'reflect': fx.ring(f.x, f.y, 47, 0.8, 0.25, 2); fx.burst(f.x, f.y, [47, 30, 7], 8); this.d.sound('reflect', f.x, f.y); this.hitStop(60); return true;
      case 'blast': fx.shockwave(f.x, f.y, f.v ?? 1.8, 36); this.d.sound('blast', f.x, f.y); if (near(8)) fx.kick(shakeFor(2, false, this.d.reduced())); return true;
      case 'bomb': this.bombs.push({ x: f.x, y: f.y, r: f.w ?? 1.7, t0: performance.now(), dur: (f.v ?? 0.9) * 1000 }); this.d.sound('bomb', f.x, f.y); return true;
      case 'perfect':
        if (f.id === this.d.myId()) {
          this.slipT = this.d.reduced() ? 0 : 0.45;
          fx.slip(f.x, f.y); fx.banner(f.x, f.y, 'PHASE SLIP', 47);
          this.d.sound('perfect');
        } else fx.ring(f.x, f.y, 47, 1.6, 0.4, 2);
        return true;
      case 'telegraph': {
        const v = f.id ? view(f.id) : undefined;
        if (v && v.kind !== 6 && near(11)) this.d.sound('windup', f.x, f.y);
        if (near(9)) {
          if (f.w === ATK.ORB) this.showTip('orb');
          else if (v?.kind === 5) this.showTip('brute');
          else this.showTip('dodge');
        }
        return true;
      }
      case 'hurt':
        fx.damage(f.x, f.y, f.v ?? 0, { hurt: true });
        fx.burst(f.x, f.y, [35, 36], 5);
        this.d.sound('hurt', f.x, f.y);
        if (f.id === this.d.myId()) {
          this.hurtT = 0.3;
          fx.kick(Math.max(0.45, shakeFor((f.w ?? 1) + 1, false, this.d.reduced())));
          this.hitStop(hitStopMs(f.w ?? 1, false, false) * 0.7);
        } else { const v = f.id ? view(f.id) : undefined; if (v) v.flash = 1; }
        return true;
      case 'die':
        if (f.by !== undefined && f.id === this.d.myId()) this.killedBy = ENEMY_BY_KIND[Number(f.by)]?.name ?? '';
        fx.burst(f.x, f.y, [28, 29, 45, 6], 14);
        if (f.v !== undefined) { this.d.sound('kill', f.x, f.y); if ((f.w ?? 0) >= 1) this.hitStop(hitStopMs(f.w ?? 0, false, true) * 0.6); }
        else this.d.sound('die', f.x, f.y);
        return true;
    }
    return false;
  }

  // ───────────── drawing ─────────────

  beginFrame(): void { this.decal.clear(); }

  private groundEllipse(x: number, y: number, r: number): [number, number, number, number] {
    return [isoX(x, y), isoY(x, y), r * ISO_HW * SQ2, r * ISO_HH * SQ2];
  }

  /** Readable ground telegraph that fills up; flashes white in the last 20% (dodge NOW). */
  private telegraph(x: number, y: number, s: CombatSnap, now: number): void {
    const g = this.decal;
    const def = ENEMY_BY_KIND[s.kind];
    if (!def) return;
    const k = s.st === 3 ? 1 : Math.min(1, s.tele / 100);
    const urgent = k > 0.8 && Math.floor(now / 70) % 2 === 0;
    const edge = urgent ? pc(7) : pc(35);
    const fill = pc(s.atk === ATK.ORB ? 45 : 36);
    const circle = (cx: number, cy: number, r: number) => {
      const [ex, ey, rx, ry] = this.groundEllipse(cx, cy, r);
      g.ellipse(ex, ey, rx, ry).fill({ color: pc(35), alpha: 0.1 + 0.18 * k });
      g.ellipse(ex, ey, rx * k, ry * k).fill({ color: fill, alpha: 0.28 });
      g.ellipse(ex, ey, rx, ry).stroke({ color: edge, width: urgent ? 1.5 : 1, alpha: 0.95 });
    };
    const lane = (ax: number, ay: number, bx: number, by: number, w: number, kk: number) => {
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w;
      const P = (px: number, py: number) => [isoX(px, py), isoY(px, py)];
      const quad = (len: number) => [...P(ax + nx, ay + ny), ...P(ax + dx * len + nx, ay + dy * len + ny), ...P(ax + dx * len - nx, ay + dy * len - ny), ...P(ax - nx, ay - ny)];
      g.poly(quad(1)).fill({ color: pc(35), alpha: 0.1 + 0.15 * kk });
      g.poly(quad(kk)).fill({ color: fill, alpha: 0.3 });
      g.poly(quad(1)).stroke({ color: edge, width: urgent ? 1.5 : 1, alpha: 0.95 });
    };
    switch (s.atk) {
      case ATK.SELF: circle(x, y, def.ai === 'boar' ? 1.4 * (def.aoe ?? 1) : def.strikeRange); break;
      case ATK.SLAM: circle(x, y, BRUTE_SLAM_RADIUS * (def.aoe ?? 1)); break;
      case ATK.LEAP:
        circle(s.tx, s.ty, LEAP_RADIUS * (def.aoe ?? 1));
        g.moveTo(isoX(x, y), isoY(x, y)).lineTo(isoX(s.tx, s.ty), isoY(s.tx, s.ty)).stroke({ color: pc(35), width: 1, alpha: 0.5 });
        break;
      case ATK.ORB: lane(x, y, s.tx, s.ty, 0.12 + 0.2 * k, k); break;
      case ATK.CHARGE: lane(x, y, s.tx, s.ty, CHARGE_WIDTH + PLAYER_RADIUS, k); break;
    }
  }

  drawBombs(now: number): void {
    this.bombs = this.bombs.filter((b) => now - b.t0 < b.dur + 100);
    for (const b of this.bombs) {
      const k = Math.min(1, (now - b.t0) / b.dur);
      const [ex, ey, rx, ry] = this.groundEllipse(b.x, b.y, b.r);
      const urgent = k > 0.75 && Math.floor(now / 60) % 2 === 0;
      this.decal.ellipse(ex, ey, rx, ry).fill({ color: pc(36), alpha: 0.15 });
      this.decal.ellipse(ex, ey, rx * k, ry * k).fill({ color: pc(37), alpha: 0.35 });
      this.decal.ellipse(ex, ey, rx, ry).stroke({ color: urgent ? pc(7) : pc(36), width: 1.5 });
    }
  }

  private speeds = new WeakMap<CombatActor, { t: number; v: number }>();

  /** Wildlife sprite: picks the animation from what the animal is doing (moving, resting, winding up, charging...) and its iso facing. */
  private critter(v: CombatActor, kind: number, s: CombatSnap | null, st: number, moved: boolean, t: number, dt: number): void {
    const id: CritterId = kind === 3 ? 'stag' : kind === 7 || kind === 11 ? 'boar' : kind === 8 ? 'wolf' : 'badger';
    const c = this.d.critters();
    // ground speed (tiles/s), smoothed, tells walking from running without a synced flag
    const rec = this.speeds.get(v) ?? { t: v.travel, v: 0 };
    rec.v += ((dt > 0 ? (v.travel - rec.t) / dt : 0) - rec.v) * Math.min(1, dt * 8);
    rec.t = v.travel;
    this.speeds.set(v, rec);
    const spd = rec.v;
    const dir = critterDir(s?.faceX ?? 0, s?.faceY ?? 1);
    let anim = 'idle', frame = t * c.fps(id, 'idle') + v.outfit * 3;
    const run = (a: string, k = 1) => { anim = a; frame = (v.travel * 2.4 + v.outfit) * k; };
    if (id === 'stag') { if (moved && spd > 0.9) { if (spd > 3.4) { anim = 'run'; frame = t * 14 + v.outfit; } else { anim = 'walk'; frame = t * 10 + v.outfit; } } }
    else if (id === 'boar') { if (st === 3 || (moved && spd > 1.4)) { anim = 'run'; frame = t * (st === 3 ? 16 : 11) + v.outfit; } else if (moved && spd > 0.4) run('run', 0.6); }
    else if (id === 'badger') { if (moved && spd > 0.3) { anim = 'walk'; frame = t * Math.min(16, 6 + spd * 2.5) + v.outfit; } }
    else { // wolf
      if (st === 2) { anim = 'howl'; frame = ((s?.tele ?? 0) / 100) * (c.length(id, 'howl') - 1); }
      else if (st === 3) { anim = 'bite'; frame = t * 24; }
      else if (st === 5) { anim = 'idle'; frame = 0; }
      else if (moved && spd > 0.3) { anim = 'run'; frame = t * Math.min(18, 8 + spd * 2) + v.outfit; }
    }
    v.sprite.texture = c.frame(id, anim, dir, frame);
    const a = c.anchor(id);
    v.sprite.anchor.set(a.x, a.y);
    v.fl.anchor.set(a.x, a.y);
  }

  /** Enemy sprite, animation, flash, squash/stretch, stagger, elite aura, bars and its telegraph. */
  drawEnemy(v: CombatActor, s: CombatSnap | null, x: number, y: number, fx: number, now: number, dt: number, moved: boolean): void {
    const isShadow = v.type === 'shadow';
    const kind = s?.kind ?? v.kind, night = !!s?.night || isShadow;
    v.kind = kind;
    const st = s?.st ?? 0;
    const t = now / 1000;
    const sheets = this.d.sheets(), foes = this.d.foes();
    const def = ENEMY_BY_KIND[kind];
    const fsx = screenDir(fx, s?.faceY ?? 1).x;
    let flip = false;
    const isCritter = kind === 3 || (kind >= 7 && kind !== 10 && kind !== 12);
    if (!isCritter && v.sprite.anchor.y !== 1) { v.sprite.anchor.set(0.5, 1); v.fl.anchor.set(0.5, 1); }
    switch (kind) {
      case 0: v.sprite.texture = sheets.slime(night, st === 2 ? 2 : Math.floor(t * 4 + v.outfit) % 4); break;
      case 1: v.sprite.texture = sheets.hopper(night, st === 2 ? 1 : st === 3 ? 2 : Math.floor(t * 3) % 2 === 0 ? 0 : 3); break;
      case 2: v.sprite.texture = sheets.rabbit(moved ? 1 + (Math.floor(v.travel / 0.25) % 3) : 0, fsx < 0 ? DIR_LEFT : 3); break;
      case 3: case 7: case 8: case 9: case 11: this.critter(v, kind, s, st, moved, t, dt); break;
      case 10: v.sprite.texture = sheets.slime(false, st === 2 ? 2 : Math.floor(t * 3 + v.outfit) % 4); break;
      case 12: v.sprite.texture = foes.brute(true, st === 2 ? 2 : st === 3 ? 3 : moved ? Math.floor(v.travel / 0.5) % 2 : Math.floor(t * 1.2) % 2); flip = fsx < 0; break;
      case 4: v.sprite.texture = foes.wisp(night, st === 2 ? 2 : st === 3 || st === 4 ? 3 : Math.floor(t * 5 + v.outfit) % 2); flip = fsx < 0; break;
      case 5: v.sprite.texture = foes.brute(night, st === 2 ? 2 : st === 3 ? 3 : moved ? Math.floor(v.travel / 0.4) % 2 : Math.floor(t * 1.5) % 2); flip = fsx < 0; break;
      case 6: v.sprite.texture = foes.mite(night, st === 2 ? 2 : [0, 1, 3, 1][Math.floor(t * 12 + v.outfit) % 4]!); flip = fsx < 0; break;
    }
    // squash & stretch: hit punch, windup rear-up, stagger wobble
    v.punch *= Math.exp(-dt * 11);
    v.flash *= Math.exp(-dt * 22);
    const reduced = this.d.reduced();
    const tele = st === 2 ? Math.min(1, (s?.tele ?? 0) / 100) : 0;
    const big = (kind === 5 ? 1.25 : kind === 10 ? 3.4 : kind === 11 ? 2.4 : kind === 12 ? 2.4 : 1) * (s && (s.elite & ELITE.HARDENED) ? 1.2 : 1);
    let sx = 1 + 0.28 * v.punch - 0.06 * tele, sy = 1 - 0.22 * v.punch + 0.12 * tele;
    if (reduced) { sx = 1; sy = 1; }
    v.sprite.scale.set(sx * big * (flip ? -1 : 1), sy * big);
    v.sprite.rotation = st === 5 && !reduced ? Math.sin(t * 22) * 0.12 : 0;
    v.sprite.x = st === 2 && !reduced && tele > 0.6 ? Math.round(Math.sin(t * 60) * tele) : 0; // shiver before the hit
    v.fl.texture = v.sprite.texture;
    v.fl.scale.copyFrom(v.sprite.scale);
    v.fl.rotation = v.sprite.rotation;
    v.fl.x = v.sprite.x;
    if (isShadow) {
      // a bound shadow: dark silhouette with a pulsing violet aura (down = a faint ghost until it re-forms)
      const down = st === 6;
      v.sprite.tint = 0x3a2c66;
      v.fl.tint = 0xa46aff;
      v.sprite.alpha = down ? 0.25 : 0.95;
      v.fl.alpha = down ? 0 : Math.min(1, Math.max(v.flash * 1.4, reduced ? 0.25 : 0.28 + 0.14 * Math.sin(t * 3 + v.outfit)));
    } else {
      v.sprite.tint = kind === 10 ? 0xb8ffc8 : kind === 12 ? 0xb8a0ff : kind === 11 ? 0xe0b090 : 0xffffff; v.sprite.alpha = 1; v.fl.tint = 0xffffff;
      v.fl.alpha = Math.min(1, v.flash * 1.4);
    }
    if (kind === 4) v.sprite.y = 1 - 3 - Math.round(Math.sin(t * 3 + v.outfit) * 1.5); // floats
    else v.sprite.y = 1;
    v.fl.y = v.sprite.y;

    const g = v.gfx;
    if (kind !== 3) g.ellipse(0, 0, 7 * (kind === 5 ? 1.5 : kind === 6 ? 0.6 : kind === 7 ? 1.3 : kind === 8 ? 1.1 : kind === 9 ? 0.8 : 1) * (big > 1.4 ? big * 0.75 : 1), 3 * (big > 1.4 ? big * 0.6 : 1)).fill({ color: 0x2a1060, alpha: 0.28 });
    if (s && s.elite) {
      const col = s.elite & ELITE.VOLATILE ? 36 : s.elite & ELITE.SWIFT ? 29 : 6;
      const pulse = 0.5 + 0.3 * Math.sin(t * 6);
      g.ellipse(0, 0, 10 * big, 4.5 * big).stroke({ color: pc(col), width: 1.5, alpha: pulse });
      g.ellipse(0, -9, 9 * big, 9 * big).stroke({ color: pc(col), width: 1, alpha: pulse * 0.4 });
    }
    if (st === 5) { // stagger stars
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + (i * Math.PI * 2) / 3;
        g.rect(Math.round(Math.cos(a) * 6) - 1, Math.round(-20 * big + Math.sin(a) * 2) - 1, 2, 2).fill(pc(38));
      }
    }
    const top = kind === 5 ? -27 : kind === 3 ? -30 : kind === 8 ? -26 : -18;
    if (s && def && !def.passive && (s.hp < s.maxHp || s.elite)) {
      g.rect(-8, top, 16, 3).fill(pc(1));
      g.rect(-7, top + 1, Math.max(0, 14 * (s.hp / s.maxHp)), 1).fill(pc(s.elite ? 37 : 35));
    }
    if (s && def?.armor) { // armour (poise) bar
      g.rect(-8, top + 3, 16, 2).fill(pc(1));
      g.rect(-7, top + 3, Math.max(0, 14 * (s.poise / 100)), 1).fill(pc(st === 5 ? 38 : 6));
    }
    if (isShadow && s && st !== 6) {
      const rc = [0x9a9ec0, 0x7aa8ff, 0xb07aff, 0xff7ad0, 0xffd36a][Math.min(4, s.rank ?? 0)]!;
      g.ellipse(0, 0, 9 * big, 4.5 * big).stroke({ color: rc, width: 1.5, alpha: 0.55 + (reduced ? 0 : 0.2 * Math.sin(t * 4)) });
      g.rect(-8, top, 16, 3).fill(pc(1));
      g.rect(-7, top + 1, Math.max(0, 14 * (s.hp / Math.max(1, s.maxHp))), 1).fill(0xa46aff);
    }
    if (s && s.atk && !isShadow && (st === 2 || st === 3)) this.telegraph(x, y, s, now);
  }

  drawProjectile(v: CombatActor, s: CombatSnap | null, now: number): void {
    const k = s?.kind ?? 0;
    const f = Math.floor(now / 90) % 2;
    v.sprite.texture = k === 0 ? this.d.sheets().orb(f) : this.d.foes().orb(k === 2, f);
    v.sprite.anchor.set(0.5, 0.75);
    if (k === 1) { const g = v.gfx; g.ellipse(0, 0, 4, 2).fill({ color: pc(1), alpha: 0.35 }); }
  }

  /** Charge ring, dash pips, phase-slip aura and afterimages around a player. */
  decoratePlayer(v: CombatActor, flags: number, sim: PlayerSim | null, x: number, y: number, now: number, dt: number): void {
    const g = v.gfx;
    const t = now / 1000;
    const reduced = this.d.reduced();
    const charging = sim ? sim.hold > 0 && sim.charge > 0 : (flags & 8) !== 0;
    const ready = sim ? sim.charge >= CHARGE_MIN : (flags & 16) !== 0;
    const slip = sim ? sim.slipT > 0 : (flags & 32) !== 0;
    v.punch *= Math.exp(-dt * 12);
    if (!reduced && v.punch > 0.01) v.sprite.scale.set(Math.sign(v.sprite.scale.x || 1) * (1 + 0.15 * v.punch), 1 - 0.12 * v.punch);
    if (charging) {
      const lvl = sim ? Math.min(1, sim.charge / CHARGE_FULL) : ready ? 1 : 0.5;
      const full = sim ? sim.charge >= CHARGE_FULL : false;
      const col = full ? 39 : ready ? 45 : 5;
      const r = 9 + 3 * lvl;
      g.ellipse(0, 0, r, r / 2).stroke({ color: pc(col), width: 1, alpha: 0.5 });
      // filling arc
      const a1 = -Math.PI / 2 + Math.PI * 2 * lvl;
      for (let a = -Math.PI / 2; a < a1; a += 0.25) g.rect(Math.cos(a) * r - 0.5, Math.sin(a) * r / 2 - 0.5, 1.5, 1.5).fill(pc(col));
      if (ready && !reduced) {
        const pulse = 0.35 + 0.3 * Math.sin(t * (full ? 22 : 12));
        g.ellipse(0, -9, 7, 11).fill({ color: pc(col), alpha: pulse * 0.35 });
      }
    }
    if (slip) {
      g.ellipse(0, -9, 8, 12).stroke({ color: pc(47), width: 1, alpha: 0.5 + 0.3 * Math.sin(t * 16) });
      v.ghostT -= dt;
      if (v.ghostT <= 0) { v.ghostT = 0.06; this.d.fx().ghost(v.sprite.texture, x, y, 47, 0.45, v.sprite.scale.x < 0); }
    } else if (flags & 1 || (sim && sim.dashT > 0)) {
      v.ghostT -= dt;
      if (v.ghostT <= 0) { v.ghostT = 0.035; this.d.fx().ghost(v.sprite.texture, x, y, 30, 0.5, v.sprite.scale.x < 0, 0.2); }
    }
    if (sim) { // dash pips under the local player
      for (let i = 0; i < DASH_CHARGES; i++) {
        const px = -4 + i * 8, py = 6;
        const full = i < sim.dashN;
        const part = !full && i === sim.dashN ? 1 - sim.dashCd / DASH_COOLDOWN : 0;
        g.poly([px, py - 2, px + 2.5, py, px, py + 2, px - 2.5, py]).fill({ color: pc(1), alpha: 0.6 });
        if (full) g.poly([px, py - 1.5, px + 2, py, px, py + 1.5, px - 2, py]).fill(pc(30));
        else if (part > 0) g.rect(px - 1, py + 1 - 2 * part, 2, 2 * part).fill({ color: pc(28), alpha: 0.8 });
      }
    }
  }

  // ───────────── HUD ─────────────

  /** Vignette: phase slip (cyan), fresh hit (red flash), low HP (heartbeat pulse). */
  vignette(el: HTMLElement, hp: number, maxHp: number, dead: boolean, dt: number): void {
    const reduced = this.d.reduced();
    const ratio = maxHp > 0 ? hp / maxHp : 1;
    let shadow = 'inset 0 0 120px 30px rgba(212,74,74,0)';
    if (this.slipT > 0) shadow = 'inset 0 0 140px 40px rgba(90,240,208,.45)';
    else if (this.hurtT > 0) shadow = 'inset 0 0 120px 30px rgba(212,74,74,.6)';
    else if (!dead && ratio < 0.3 && hp > 0) {
      this.heartT -= dt;
      const period = 0.55 + 0.6 * (ratio / 0.3);
      if (this.heartT <= 0) { this.heartT = period; this.d.rawSound('heartbeat'); }
      const ph = 1 - Math.max(0, this.heartT) / period;
      const pulse = reduced ? 0.5 : Math.max(0, Math.sin(ph * Math.PI * 2)) * (ph < 0.5 ? 1 : 0.4);
      shadow = `inset 0 0 ${110 + 30 * pulse}px ${24 + 16 * pulse}px rgba(160,30,50,${(0.32 + 0.3 * pulse).toFixed(2)})`;
    }
    if (el.style.boxShadow !== shadow) el.style.boxShadow = shadow;
  }

  showTip(id: string): void {
    if (this.shown.has(id) || this.tip) return;
    this.shown.add(id);
    try { localStorage.setItem(TIP_KEY, JSON.stringify([...this.shown])); } catch { /* ignore */ }
    this.tip = { text: TIPS[id]!, until: performance.now() + 8000 };
  }

  /** Combat tip to show in the hint box right now (contextual, each shown once). */
  currentTip(now: number): string | null {
    if (this.tip && now > this.tip.until) this.tip = null;
    return this.tip?.text ?? null;
  }

  /** Called each HUD tick with the nearest hostile distance. */
  noticeEnemies(nearest: number): void { if (nearest < 9) this.showTip('combo'); }
}
