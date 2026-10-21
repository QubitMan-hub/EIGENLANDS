import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  ChunkStore, ENEMY_BY_KIND, INTEREST_RADIUS, TILE_DEFS, TILE_SIZE, ambientColor, chunkOf,
  darkness, decodeDiff, dayNumber, formatClock, gameHour, dayPhase, season, PALETTE, type Ack, type ChunkMsg,
  type FxMsg, type TileMsg, type WelcomeMsg,
} from '@eigenlands/shared';
import { buildActorSheets, dirOf, OUTFITS, WALK_FRAMES, type Sheets } from '../art/actors';
import { buildTileAtlas } from '../art/tiles';
import { Audio, SFX_CAPTIONS, type Sfx } from '../audio';
import type { Input } from '../input/input';
import { INTERP_DELAY_MS, Interpolator, ServerClock, type Pose } from '../net/interp';
import type { Net, NetHandlers } from '../net/session';
import { Predictor } from '../net/prediction';
import { TUTORIAL, type Acts, type Settings } from '../ui/ui';
import { ChunkViews } from './chunkview';
import { Fx } from './fx';
import { Lighting, type Light } from './lighting';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const pc = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);

interface Snap extends Pose { hp: number; maxHp: number; flags: number; tele: number; kind: number; night: boolean; name: string; level: number }

interface ActorView {
  id: string;
  type: 'player' | 'enemy' | 'proj';
  root: Container;
  sprite: Sprite;
  gfx: Graphics;
  label?: Text;
  lx: number; ly: number;
  travel: number;
  outfit: number;
  trail: number;
}

export class Game {
  net!: Net;
  readonly audio = new Audio();
  readonly clock = new ServerClock();

  private app!: Application;
  private sheets!: Sheets;
  private store!: ChunkStore;
  private chunks!: ChunkViews;
  private lighting!: Lighting;
  private fx!: Fx;
  private world = new Container();
  private entityLayer = new Container();
  private fxLayer = new Container();
  private labelLayer = new Container();
  private predictor!: Predictor;
  private interp = new Interpolator<Snap>();
  private views = new Map<string, ActorView>();
  private requested = new Set<string>();
  private pendingBuild: Array<[number, number]> = [];
  private myId = '';
  private seed = 0;
  private selfReady: ((v: void) => void) | null = null;
  private self: Snap | null = null;
  private selfXp = 0;
  private scale = 3;
  private acc = 0;
  private fps = 60;
  private rtt = 0;
  private lastStream = 0;
  private lastHud = 0;
  private lastSnapTime = 0;
  private dead = false;
  private connected = true;
  private acts: Acts = { moved: false, attacked: false, dashed: false, shot: false, smashed: false };
  private tutorialDone = new Set<string>();
  private lastLocalSwing = 0;
  private hurtTimer = 0;
  accountInfo = '';
  /** test/screenshot aid: ?hour=12 pins the in-game clock */
  private hourOverride: number | null = (() => { const h = new URLSearchParams(location.search).get('hour'); return h !== null && !Number.isNaN(Number(h)) ? Number(h) : null; })();
  private frameMs = 0;

  constructor(private input: Input, private settings: () => Settings, private onClosed: (code: number) => void) {
    try { JSON.parse(localStorage.getItem('eigen.tutorial') ?? '[]').forEach((i: string) => this.tutorialDone.add(i)); } catch { /* fresh */ }
  }

  // ───────────── boot ─────────────
  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      canvas, resizeTo: window, background: 0x0b0c1a, antialias: false, roundPixels: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3), autoDensity: true, preference: 'webgl',
    });
    this.sheets = buildActorSheets();
    const atlas = buildTileAtlas();
    this.entityLayer.sortableChildren = true;
    const chunkLayer = new Container();
    this.world.addChild(chunkLayer, this.entityLayer, this.fxLayer);
    this.app.stage.addChild(this.world);
    this.lighting = new Lighting(this.app.renderer);
    this.app.stage.addChild(this.lighting.sprite, this.labelLayer);
    this.fx = new Fx(this.fxLayer, () => this.settings().reducedMotion);
    this.store = new ChunkStore(0); // replaced once the seed is known
    (this as any)._atlas = atlas;
    (this as any)._chunkLayer = chunkLayer;
    window.addEventListener('resize', () => this.layout());
    this.layout();
  }

  /** Called once the server told us the world seed. */
  private startWorld(seed: number): void {
    this.seed = seed;
    this.store = new ChunkStore(seed, 400);
    this.chunks = new ChunkViews(this.app.renderer, (this as any)._atlas, this.store, (this as any)._chunkLayer);
  }

  private layout(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.scale = Math.max(1, Math.floor(Math.min(w / (TILE_SIZE * 18), h / (TILE_SIZE * 10))));
    this.world.scale.set(this.scale);
    this.lighting.sprite.scale.set(this.scale);
    this.lighting.resize(Math.ceil(w / this.scale) + 2, Math.ceil(h / this.scale) + 2);
    this.fx.textRes = this.scale * (this.app.renderer.resolution || 1);
  }

  /** Resolves when the first state containing the local player has been received and the area is drawn. */
  async ready(): Promise<void> {
    await new Promise<void>((res) => { if (this.self) res(); else this.selfReady = res; });
    // synchronously draw the 3x3 around the player so the first frame is never empty
    const cx = chunkOf(Math.floor(this.predictor.sim.x)), cy = chunkOf(Math.floor(this.predictor.sim.y));
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) { this.chunks.build(x, y); this.requestDiff(x, y); }
    this.app.ticker.add((t) => this.frame(t.deltaMS));
  }

  // ───────────── network handlers ─────────────
  private welcome(w: WelcomeMsg): void { this.myId = w.playerId; this.startWorld(w.seed); }

  private ack(a: Ack): void {
    if (!this.predictor) return;
    this.predictor.reconcile(a);
  }

  private state(s: any): void {
    if (!s?.players || !this.myId || !this.chunks) return;
    const now = performance.now();
    const t: number = s.serverTime;
    this.clock.observe(t, s.tick, now);
    this.lastSnapTime = now;
    const present = new Set<string>();
    const push = (id: string, e: any, type: ActorView['type']) => {
      present.add(id);
      this.interp.push(id, t, {
        x: e.x, y: e.y, faceX: e.faceX ?? 0, faceY: e.faceY ?? 1,
        hp: e.hp ?? 0, maxHp: e.maxHp ?? 0, flags: e.flags ?? 0, tele: e.tele ?? 0, kind: e.kind ?? 0,
        night: !!e.night, name: e.name ?? '', level: e.level ?? 1,
      });
      if (!this.views.has(id)) this.makeView(id, type, e);
    };
    s.players.forEach((p: any, id: string) => push(id, p, 'player'));
    s.enemies.forEach((e: any, id: string) => push(id, e, 'enemy'));
    s.projectiles.forEach((p: any, id: string) => push(id, p, 'proj'));
    for (const id of [...this.views.keys()]) if (!present.has(id)) this.dropView(id);

    const me = s.players.get(this.myId);
    if (me) {
      const wasDead = this.dead;
      this.dead = (me.flags & 4) !== 0;
      if (this.dead !== wasDead) $('dead').hidden = !this.dead;
      this.selfXp = me.xp;
      this.self = this.interp.sample(this.myId, t)?.pose ?? null;
      if (!this.predictor) {
        this.predictor = new Predictor(me.x, me.y, this.store.solidAt);
        this.selfReady?.();
      }
    }
  }

  private chunk(m: ChunkMsg): void {
    const diff = decodeDiff(m.diff);
    this.store.applyDiff(m.cx, m.cy, diff);
    if (this.chunks.has(m.cx, m.cy)) this.chunks.build(m.cx, m.cy);
  }
  private tile(m: TileMsg): void {
    const { cx, cy } = this.store.setTile(m.tx, m.ty, m.tile);
    if (this.chunks.has(cx, cy)) this.chunks.build(cx, cy);
  }
  private notice(text: string): void { this.toast(text); }
  private close(code: number): void { this.connected = false; this.onClosed(code); }
  private rtt_(ms: number): void { this.rtt = this.rtt ? this.rtt * 0.7 + ms * 0.3 : ms; }

  /** Callbacks the network layer invokes. */
  get handlers(): NetHandlers {
    return {
      welcome: (w) => this.welcome(w), ack: (a) => this.ack(a), fx: (f) => this.fxFromServer(f),
      chunk: (m) => this.chunk(m), tile: (m) => this.tile(m), notice: (t) => this.notice(t),
      state: (s) => this.state(s), close: (c) => this.close(c), rtt: (ms) => this.rtt_(ms),
    };
  }

  // ───────────── effects & sound ─────────────
  private sound(s: Sfx, x?: number, y?: number): void {
    this.audio.play(s);
    if (this.settings().captions) this.caption(SFX_CAPTIONS[s], x, y);
  }

  private caption(text: string, x?: number, y?: number): void {
    const box = $('captions');
    let label = text;
    if (x !== undefined && y !== undefined && this.predictor) {
      const dx = x - this.predictor.sim.x;
      label = `${text} ${Math.abs(dx) < 1.5 ? '' : dx < 0 ? '←' : '→'}`.trim();
    }
    const el = document.createElement('span');
    el.textContent = `[${label}]`;
    box.append(el);
    setTimeout(() => el.remove(), 1600);
    while (box.children.length > 4) box.firstChild?.remove();
  }

  private toast(text: string): void { this.caption(text); }

  private fxFromServer(f: FxMsg): void {
    switch (f.kind) {
      case 'swing': this.fx.swing(f.x, f.y, f.dx ?? 0, f.dy ?? 1, f.v ?? 0); this.sound('swing', f.x, f.y); break;
      case 'shot': this.fx.burst(f.x, f.y, [45, 46], 4); this.sound('shot', f.x, f.y); break;
      case 'dash': this.fx.dash(f.x, f.y, f.dx ?? 0, f.dy ?? 1); this.sound('dash', f.x, f.y); break;
      case 'hit': this.fx.hit(f.x, f.y, f.v); this.sound('hit', f.x, f.y); break;
      case 'hurt':
        this.fx.hit(f.x, f.y, f.v, 35); this.sound('hurt', f.x, f.y);
        if (f.id === this.myId) { this.hurtTimer = 0.25; this.fx.shake = this.settings().reducedMotion ? 0 : 0.6; }
        break;
      case 'die': this.fx.burst(f.x, f.y, [28, 29, 45, 6], 14); this.sound('die', f.x, f.y); break;
      case 'levelup': this.fx.ring(f.x, f.y, 38); this.fx.burst(f.x, f.y, [38, 39, 22], 12); this.fx.number(f.x, f.y - 1, `LEVEL ${f.v}!`, 38); this.sound('levelup'); break;
      case 'break': this.fx.burst(f.x, f.y, [4, 5, 20], 10); this.sound('break', f.x, f.y); break;
      case 'telegraph': break; // drawn from enemy state
    }
  }

  // ───────────── views ─────────────
  private makeView(id: string, type: ActorView['type'], e: any): void {
    const root = new Container();
    const gfx = new Graphics();
    const sprite = new Sprite();
    sprite.anchor.set(0.5, 1);
    root.addChild(gfx, sprite);
    let outfit = 0;
    let label: Text | undefined;
    if (type === 'player') {
      outfit = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % OUTFITS.length;
      // names live in screen space (crisp, not darkened by the night lightmap)
      label = new Text({ text: e.name || '', style: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, fontWeight: 'bold', fill: pc(id === this.myId ? 47 : 7), stroke: { color: pc(0), width: 3 } } });
      label.resolution = this.app.renderer.resolution || 1;
      label.anchor.set(0.5, 1);
      this.labelLayer.addChild(label);
    }
    this.entityLayer.addChild(root);
    this.views.set(id, { id, type, root, sprite, gfx, label, lx: e.x, ly: e.y, travel: 0, outfit, trail: 0 });
  }

  private dropView(id: string): void {
    const v = this.views.get(id);
    if (!v) return;
    v.label?.destroy();
    v.root.destroy({ children: true });
    this.views.delete(id);
    this.interp.remove(id);
  }

  // ───────────── chunk streaming ─────────────
  private requestDiff(cx: number, cy: number): void {
    const k = `${cx},${cy}`;
    if (this.requested.has(k)) return;
    this.requested.add(k);
    this.net.requestChunk(cx, cy);
  }

  private stream(): void {
    const px = Math.floor(this.predictor.sim.x), py = Math.floor(this.predictor.sim.y);
    const cx = chunkOf(px), cy = chunkOf(py);
    const keep = new Set<string>();
    const R = INTEREST_RADIUS;
    const want: Array<[number, number]> = [];
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      keep.add(`${x},${y}`);
      if (!this.chunks.has(x, y)) want.push([x, y]);
    }
    want.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    this.pendingBuild = want;
    // free far chunks and forget their request flags so returning re-fetches fresh edits
    const far = new Set<string>();
    for (let y = cy - R - 1; y <= cy + R + 1; y++) for (let x = cx - R - 1; x <= cx + R + 1; x++) far.add(`${x},${y}`);
    this.chunks.retain(far);
    for (const k of [...this.requested]) if (!far.has(k)) this.requested.delete(k);
  }

  // ───────────── main loop ─────────────
  private frame(dtMs: number): void {
    const now = performance.now();
    const t0 = now;
    this.fps = this.fps * 0.95 + (1000 / Math.max(1, dtMs)) * 0.05;
    const dt = Math.min(dtMs, 250) / 1000;
    if (!this.predictor || !this.connected) return;

    // fixed-step simulation (same step as the server)
    this.acc += dt * 1000;
    const stepMs = 1000 / 20;
    let steps = 0;
    while (this.acc >= stepMs && steps < 5) { this.fixedStep(now); this.acc -= stepMs; steps++; }
    if (steps === 5) this.acc = 0;
    const alpha = this.acc / stepMs;
    this.predictor.update(dt);

    if (now - this.lastStream > 200) { this.lastStream = now; this.stream(); }
    for (let i = 0; i < 1 && this.pendingBuild.length; i++) {
      const [x, y] = this.pendingBuild.shift()!;
      if (!this.chunks.has(x, y)) { this.chunks.build(x, y); this.requestDiff(x, y); }
    }

    const reduced = this.settings().reducedMotion;
    const hour = this.hourOverride ?? gameHour(this.clock.serverNow(now));
    this.chunks.setFrame(reduced ? 0 : Math.floor(now / 500) % 2);

    const me = this.predictor.visual(alpha);
    const W = window.innerWidth, H = window.innerHeight, S = this.scale;
    let ox = 0, oy = 0;
    if (this.fx.shake > 0 && !reduced) { ox = Math.round((Math.random() - 0.5) * 6 * this.fx.shake); oy = Math.round((Math.random() - 0.5) * 6 * this.fx.shake); }
    const camX = Math.round(me.x * TILE_SIZE * S) / S, camY = Math.round(me.y * TILE_SIZE * S) / S;
    this.world.x = Math.round(W / 2 - camX * S) + ox;
    this.world.y = Math.round(H / 2 - camY * S) + oy;
    this.input.playerScreen = { x: W / 2 + (me.x * TILE_SIZE - camX) * S, y: H / 2 + (me.y * TILE_SIZE - 6 - camY) * S };

    const renderT = this.clock.serverNow(now) - INTERP_DELAY_MS;
    this.updateViews(me, alpha, renderT, now, dtMs);
    this.fx.update(dt);

    // lighting
    const topLeftX = camX - W / 2 / S, topLeftY = camY - H / 2 / S;
    this.lighting.render(ambientColor(hour), this.collectLights(topLeftX, topLeftY, W / S, H / S, hour, now, reduced));
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);

    if (now - this.lastHud > 100) { this.lastHud = now; this.hud(hour, now); }
    this.frameMs = this.frameMs * 0.95 + (performance.now() - t0) * 0.05;
  }

  private fixedStep(now: number): void {
    const r = this.input.read(now);
    const frozen = this.dead || !this.connected || this.settingsOpen();
    if (frozen) { this.input.read(now); return; }
    const viewTick = Math.max(0, Math.floor(this.clock.tickAt(this.clock.serverNow(now) - INTERP_DELAY_MS)));
    const { cmd, ev } = this.predictor.step(r, viewTick);
    this.net.sendInput(cmd);
    if (r.dx || r.dy) this.acts.moved = true;
    if (ev.attacked) {
      this.acts.attacked = true;
      this.fx.swing(this.predictor.sim.x, this.predictor.sim.y, this.predictor.sim.faceX, this.predictor.sim.faceY, ev.combo);
      this.sound('swing');
    }
    if (ev.skill) { this.acts.shot = true; this.fx.burst(this.predictor.sim.x, this.predictor.sim.y, [45, 46], 4); this.sound('shot'); }
    if (ev.dashed) { this.acts.dashed = true; this.fx.dash(this.predictor.sim.x, this.predictor.sim.y, this.predictor.sim.faceX, this.predictor.sim.faceY); this.sound('dash'); }
    if (r.interact) this.interact();
  }

  settingsOpen = (): boolean => false;

  private interact(): void {
    const s = this.predictor.sim;
    for (const reach of [0.8, 1.4, 0.4]) {
      const tx = Math.floor(s.x + s.faceX * reach), ty = Math.floor(s.y + s.faceY * reach);
      if ((TILE_DEFS[this.store.getTile(tx, ty)]?.breaksTo ?? -1) >= 0) { this.acts.smashed = true; this.net.sendEdit(tx, ty); return; }
    }
  }

  private updateViews(me: { x: number; y: number }, alpha: number, renderT: number, now: number, dtMs: number): void {
    const reduced = this.settings().reducedMotion;
    for (const v of this.views.values()) {
      const isMe = v.id === this.myId;
      let x: number, y: number, s: Snap | null = null, fx = 0, fy = 1;
      if (isMe) {
        x = me.x; y = me.y; fx = this.predictor.sim.faceX; fy = this.predictor.sim.faceY;
        s = this.interp.sample(v.id, renderT)?.pose ?? null;
      } else {
        const smp = this.interp.sample(v.id, renderT);
        if (!smp) { v.root.visible = false; if (v.label) v.label.visible = false; continue; }
        x = smp.x; y = smp.y; s = smp.pose; fx = s.faceX; fy = s.faceY;
      }
      v.root.visible = true;
      if (v.label) v.label.visible = true;
      const moved = Math.hypot(x - v.lx, y - v.ly);
      v.travel += moved;
      v.lx = x; v.ly = y;
      v.root.x = Math.round(x * TILE_SIZE);
      v.root.y = Math.round(y * TILE_SIZE + 6);
      v.root.zIndex = v.root.y;
      v.gfx.clear();

      if (v.type === 'player') {
        const dash = isMe ? this.predictor.sim.dashT > 0 : ((s?.flags ?? 0) & 1) !== 0;
        const deadP = isMe ? this.dead : ((s?.flags ?? 0) & 4) !== 0;
        const walking = moved > 0.003 * (dtMs / 16);
        const frame = walking ? 1 + (Math.floor(v.travel / 0.17) % (WALK_FRAMES - 1)) : 0;
        v.sprite.texture = this.sheets.person(v.outfit, dirOf(fx, fy), frame);
        v.sprite.alpha = deadP ? 0.35 : dash ? 0.6 : 1;
        v.sprite.rotation = deadP ? Math.PI / 2 : 0;
        v.gfx.ellipse(0, -1, 6, 2.5).fill({ color: 0x000000, alpha: 0.3 });
        if (dash && !reduced) { v.trail = 0.2; }
        if (v.label) {
          if (s?.name && v.label.text !== s.name) v.label.text = s.name;
          v.label.x = Math.round(this.world.x + v.root.x * this.scale);
          v.label.y = Math.round(this.world.y + (v.root.y - 19) * this.scale);
        }
      } else if (v.type === 'enemy') {
        const kind = s?.kind ?? 0, night = !!s?.night;
        const t = now / 1000;
        const frame = kind === 0 ? Math.floor(t * 4 + v.outfit) % 4 : (s && s.tele > 0 ? 1 : Math.floor(t * 3) % 2 === 0 ? 0 : 3);
        v.sprite.texture = kind === 0 ? this.sheets.slime(night, frame) : this.sheets.hopper(night, frame % 4);
        v.gfx.ellipse(0, -1, 6, 2.5).fill({ color: 0x000000, alpha: 0.3 });
        if (s && s.tele > 0) {
          const def = ENEMY_BY_KIND[kind]!;
          const k = s.tele / 100;
          const r = (kind === 1 ? def.strikeRange : def.strikeRange) * TILE_SIZE;
          v.gfx.circle(0, -6, r).fill({ color: pc(35), alpha: 0.12 + 0.35 * k });
          v.gfx.circle(0, -6, r * k).fill({ color: pc(36), alpha: 0.3 });
          v.gfx.circle(0, -6, r).stroke({ color: pc(35), width: 1, alpha: 0.9 });
        }
        if (s && s.hp < s.maxHp && s.maxHp > 0) {
          v.gfx.rect(-7, -18, 14, 3).fill(pc(1));
          v.gfx.rect(-6, -17, Math.max(0, 12 * (s.hp / s.maxHp)), 1).fill(pc(35));
        }
      } else {
        v.sprite.texture = this.sheets.orb(Math.floor(now / 90) % 2);
        v.sprite.anchor.set(0.5, 0.75);
      }
    }
    void alpha;
  }

  private collectLights(x0: number, y0: number, wTiles: number, hTiles: number, hour: number, now: number, reduced: boolean): Light[] {
    const out: Light[] = [];
    const dark = darkness(hour);
    const toL = (tx: number, ty: number) => ({ x: (tx - x0) * TILE_SIZE, y: (ty - y0) * TILE_SIZE });
    const sx = Math.floor(x0) - 6, sy = Math.floor(y0) - 6, ex = Math.ceil(x0 + wTiles) + 6, ey = Math.ceil(y0 + hTiles) + 6;
    const small: Light[] = [];
    for (let ty = sy; ty < ey; ty++) {
      for (let tx = sx; tx < ex; tx++) {
        const def = TILE_DEFS[this.store.getTile(tx, ty)];
        if (!def || def.light <= 0) continue;
        const flick = reduced ? 1 : 0.88 + 0.12 * Math.sin(now / 130 + tx * 3.1 + ty * 1.7);
        const p = toL(tx + 0.5, ty + 0.5);
        const l = { ...p, radius: def.light * (reduced ? 1 : flick), color: pc(def.lightColor), intensity: 0.95 * flick };
        // big lights (torches) always render; ambient glows (bloom tiles) are capped
        if (def.light >= 4) out.push(l); else if (small.length < 24) small.push(l);
      }
    }
    out.push(...small);
    const me = this.predictor.visual(0);
    out.push({ ...toL(me.x, me.y - 0.3), radius: 4.5, color: pc(22), intensity: Math.min(1, dark * 1.1) });
    for (const v of this.views.values()) {
      if (v.type === 'proj') out.push({ ...toL(v.lx, v.ly), radius: 2.2, color: pc(46), intensity: 0.9 });
      else if (v.type === 'enemy' && dark > 0.3) out.push({ ...toL(v.lx, v.ly), radius: 1.6, color: pc(this.interp.sample(v.id, 0)?.pose.kind === 1 ? 37 : 45), intensity: 0.5 });
      else if (v.type === 'player' && v.id !== this.myId) out.push({ ...toL(v.lx, v.ly - 0.3), radius: 3, color: pc(22), intensity: dark });
    }
    return out;
  }

  // ───────────── HUD ─────────────
  private hud(hour: number, now: number): void {
    const s = this.self;
    if (s) {
      $('hud-name').textContent = s.name;
      $('hud-level').textContent = `Lv ${s.level}`;
      $('hp-fill').style.width = `${Math.max(0, (s.hp / Math.max(1, s.maxHp)) * 100)}%`;
      $('hp-text').textContent = `${s.hp} / ${s.maxHp}`;
      const need = 30 + 20 * (s.level - 1);
      $('xp-fill').style.width = `${Math.min(100, (this.selfXp / need) * 100)}%`;
    }
    const sn = this.clock.serverNow(now);
    $('clock').textContent = `${hour >= 6 && hour < 18 ? '☀' : '☾'} ${formatClock(hour)}`;
    $('dayinfo').textContent = `${dayPhase(hour)} · day ${dayNumber(sn) + 1} · ${season(sn)}`;
    $('vignette').classList.toggle('hurt', this.hurtTimer > 0);

    const hintEl = $('hint');
    const next = TUTORIAL.find((t) => !this.tutorialDone.has(t.id));
    if (next) {
      if (next.done(this.acts)) {
        this.tutorialDone.add(next.id);
        try { localStorage.setItem('eigen.tutorial', JSON.stringify([...this.tutorialDone])); } catch { /* ignore */ }
      } else { hintEl.hidden = false; hintEl.textContent = next.text; }
    }
    if (!next || this.tutorialDone.size === TUTORIAL.length) hintEl.hidden = true;

    const dbg = $('debug');
    if (!dbg.hidden) {
      const p = this.predictor.sim;
      dbg.textContent = `fps ${this.fps.toFixed(0)} (js ${this.frameMs.toFixed(1)}ms)  ping ${this.rtt.toFixed(0)}ms  correction ${this.predictor.lastCorrection.toFixed(3)}\n` +
        `pos ${p.x.toFixed(2)},${p.y.toFixed(2)}  chunk ${chunkOf(Math.floor(p.x))},${chunkOf(Math.floor(p.y))}  views ${this.chunks.count}\n` +
        `entities ${this.views.size}  pending ${this.predictor.pending.length}  net-in ${(this.net.bytesIn / 1024).toFixed(0)}KB  seed ${this.seed}`;
    }
  }

  /** Hooks for automated browser tests. */
  debugState() {
    const p = this.predictor?.sim;
    return {
      ready: !!p, x: p?.x, y: p?.y, fps: this.fps, rtt: this.rtt, chunks: this.chunks?.count, entities: this.views.size,
      hp: this.self?.hp, level: this.self?.level, scale: this.scale, dead: this.dead,
      pending: this.predictor?.pending.length, correction: this.predictor?.lastCorrection, hour: this.hourOverride ?? gameHour(this.clock.serverNow(performance.now())),
      snapAge: performance.now() - this.lastSnapTime,
      enemies: [...this.views.values()].filter((v) => v.type === 'enemy').length,
      tile: (x: number, y: number) => this.store.getTile(x, y),
    };
  }

  toggleDebug(): void { const d = $('debug'); d.hidden = !d.hidden; }
}
