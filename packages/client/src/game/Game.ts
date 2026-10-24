import { planeOf } from '../features/atlas/model';
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  BOSSES, xpForLevel, sanctuaryAt, CAVE_OY, isCaveY, isDiveY, isUpperY, DIVE_OY, UPPER_OY, MSG,
  ChunkStore, ELITE_NAMES, ENEMY_BY_KIND, INTEREST_RADIUS, NPC_BY_ID, TILE_DEFS, TILE_SIZE, ambientColor, SEASONS, chunkOf,
  darkness, decodeDiff, dayNumber, formatClock, gameHour, season, PALETTE, townFor, townsFor, weatherForDay, biomeWeather, biomeAt, type Ack, type ChunkMsg,
  type DialogueMsg, type FishBiteMsg, type FxMsg, type ObjMsg, type PanelMsg, type ProfileMsg, type RhythmResultMsg, type RhythmStartMsg,
  type ShopViewMsg, type TileMsg, type ToastMsg, type WelcomeMsg, type ForgePreviewReply,
} from '@eigenlands/shared';
import { buildActorSheets, dirOf, COSMETIC_OUTFITS, OUTFITS, WALK_FRAMES, ATTACK_FRAME, SHOT_FRAME, CAST_FRAME, RUN_FRAME, RUN_FRAMES, DIR_DOWN, DIR_LEFT, type Sheets } from '../art/actors';
import { buildObjectArt, destroyObjectArt, type ObjectArt, type SeasonIdx } from '../art/objects';
import { HeldWeapons, isHeldId } from '../art/weapons';
import { Audio, SFX_CAPTIONS, type Sfx } from '../audio';
import type { Input } from '../input/input';
import { Interpolator, ServerClock, type Pose } from '../net/interp';
import { P34Client } from '../features';
import type { KeyMap } from '../input/keymap';
import type { Net, NetHandlers } from '../net/session';
import { Predictor } from '../net/prediction';
import type { Settings } from '../ui/ui';
import { depth, isoX, isoY, screenDir, unproject, ISO_HH, ISO_HW } from './iso';
import { Gameplay } from './gameplay';

/** The Undercroft's ambient light: near-black, a little warm (torches and crystals do the rest). */
const CAVE_AMBIENT: [number, number, number] = [0.4, 0.37, 0.46];
import { BuildingViews } from './buildingviews';
import { WeatherFx } from './weatherfx';
import { WorldObjViews } from './worldobjviews';
import { ObjectViews, sunFor } from './objectviews';
import { Terrain } from './terrain';
import { Fx } from './fx';
import { Lighting, type Light } from './lighting';
import { buildFoeSheets, type FoeSheets } from '../art/foes';
import { CombatView } from './combatview';
import { WindField } from './windfield';
import { Ambient } from './ambient';
import { HUE_PALETTE, ITEMS, MSG34, SHADOW_RANKS, WEAPONS, setMeleeWeapon, isRangedWeapon, isWeaponId } from '@eigenlands/shared';
import { Critters } from '../art/critters';
import { Ships } from '../art/ships';
import { TargetFrame } from '../ui/targetframe';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const pc = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);

interface Snap extends Pose {
  hp: number; maxHp: number; flags: number; tele: number; kind: number; night: boolean; name: string; level: number; look: number; weapon: string; held: string;
  /** combat 2.0 (enemies) */
  st: number; atk: number; tx: number; ty: number; poise: number; elite: number;
  /** Shadow Army rank (shadows only) */
  rank: number; bonded: boolean;
}

interface ActorView {
  id: string;
  type: 'player' | 'enemy' | 'proj' | 'npc' | 'shadow';
  npcId?: string;
  root: Container;
  sprite: Sprite;
  gfx: Graphics;
  shadow: Sprite;
  label?: Text;
  lx: number; ly: number;
  travel: number;
  movingUntil: number;
  outfit: number;
  trail: number;
  held?: Sprite;
  /** combat presentation (see combatview.ts) */
  fl: Sprite;
  kind: number;
  flash: number;
  punch: number;
  ghostT: number;
}

export class Game {
  net!: Net;
  readonly audio = new Audio();
  readonly clock = new ServerClock();

  private app!: Application;
  private sheets!: Sheets;
  private heldWeapons = new HeldWeapons();
  private hops = new Map<string, { at: number; x: number; y: number; tx: number; ty: number }>();
  private foes!: FoeSheets;
  private critters!: Critters;
  private ships = new Ships();
  private combat!: CombatView;
  private decalLayer = new Graphics();
  private deadAt = 0;
  private store!: ChunkStore;
  private terrain!: Terrain;
  private objects!: ObjectViews;
  private art: ObjectArt | null = null;
  private seasonIdx: SeasonIdx = 1;
  private seasonOverride: SeasonIdx | null = (() => { const q = new URLSearchParams(location.search).get('season'); return q !== null && ['0', '1', '2', '3'].includes(q) ? (Number(q) as SeasonIdx) : null; })();
  private shadowLayer = new Container();
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
  /** chunks whose objects (trees, rocks, furniture) are built; the terrain builds its own texture independently */
  private shown = new Set<string>();
  private myId = '';
  private seed = 0;
  accountId = '';
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
  gameplay!: Gameplay;
  private worldObjs!: WorldObjViews;
  private buildings!: BuildingViews;
  private weatherFx!: WeatherFx;
  private roofLayer = new Container();
  private weatherLayer = new Container();
  private cursor = new Graphics();
  private aimGfx = new Graphics();
  readonly wind = new WindField();
  private ambient!: Ambient;
  private targetId: string | null = null;
  private targetFrame = new TargetFrame();
  private bobber = new Graphics();
  features = { aiDialogue: false };
  private portraitCache = new Map<string, string>();
  private lastLocalSwing = 0;
  private hurtTimer = 0;
  accountInfo = '';
  /** test/screenshot aid: ?hour=12 pins the in-game clock */
  private hourOverride: number | null = (() => { const h = new URLSearchParams(location.search).get('hour'); return h !== null && !Number.isNaN(Number(h)) ? Number(h) : null; })();
  private frameMs = 0;
  private lastFrameAt = 0;
  private vis = { x0: -20, y0: -20, x1: 20, y1: 20 };
  /** Phase 3/4: Circuit Board, abilities, tutorial, party, chat, trading, shards */
  ext!: P34Client;

  constructor(private input: Input, private settings: () => Settings, private onClosed: (code: number) => void, private keys: () => KeyMap = () => input.keys) {}

  // ───────────── boot ─────────────
  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      canvas, resizeTo: window, background: 0x0b0c1a, antialias: false, roundPixels: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3), autoDensity: true, preference: 'webgl',
    });
    this.sheets = buildActorSheets();
    this.foes = buildFoeSheets();
    this.critters = await Critters.load();
    this.entityLayer.sortableChildren = true;
    this.world.addChild(this.shadowLayer, this.decalLayer, this.entityLayer, this.roofLayer, this.cursor, this.aimGfx, this.bobber, this.fxLayer);
    this.lighting = new Lighting(this.app.renderer);
    this.app.stage.addChild(this.lighting.sprite, this.weatherLayer, this.labelLayer);
    this.gameplay = new Gameplay({
      net: () => this.net, clock: this.clock, audio: this.audio, input: this.input, store: () => this.store, season: () => this.seasonIdx,
      portrait: (id) => this.portraitUrl(id), selfPortrait: () => this.selfPortraitEl(),
      npcNear: (x, y, m) => this.npcNear(x, y, m),
      player: () => (this.predictor ? { x: this.predictor.sim.x, y: this.predictor.sim.y, fx: this.predictor.sim.faceX, fy: this.predictor.sim.faceY } : { x: 0, y: 0, fx: 0, fy: 1 }),
      sfx: (s) => this.sound(s), features: () => this.features,
      guidance: () => this.ext?.circuit.hint() ?? null,
      journey: () => {
        const p = this.ext?.circuit.progress;
        return p?.loaded ? { level:this.self?.level ?? 1, xp:this.selfXp, cls:p.cls, spec:p.spec, second:p.second, qubits:p.qubits,
          gates:Object.values(p.gates).reduce((a,b)=>a+b,0), runes:p.runes,
          summons:Object.fromEntries(Object.values(BOSSES).map(b=>[b.item,this.gameplay.profile.count(b.item)])) } : null;
      },
      openBoard: () => { this.ext.circuit.action('board'); },
      trackQuest: (id, map) => this.ext.atlas.trackQuest(id, map), trackedQuest: () => this.ext.atlas.trackedQuest(),
      seed: () => this.seed, reduced: () => this.settings().reducedMotion,
      npcScreens: () => [...this.views.values()].filter((v) => v.type === 'npc').map((v) => ({ id: v.id, x: v.lx, y: v.ly, sx: this.world.x + v.root.x * this.scale, sy: this.world.y + (v.root.y - 32) * this.scale, visible: v.root.visible })),
    });
    this.fx = new Fx(this.fxLayer, () => this.settings().reducedMotion);
    this.ambient = new Ambient({
      layer: () => this.entityLayer, labels: () => this.labelLayer, store: () => this.store, seed: () => this.seed, sheets: () => this.sheets, fx: () => this.fx,
      toScreen: (x, y) => ({ x: this.world.x + isoX(x, y) * this.scale, y: this.world.y + isoY(x, y) * this.scale }),
    });
    this.combat = new CombatView({
      fx: () => this.fx, sound: (s, x, y) => this.sound(s, x, y), rawSound: (s) => this.audio.play(s),
      reduced: () => this.settings().reducedMotion, sheets: () => this.sheets, foes: () => this.foes, critters: () => this.critters, heldWeapons: () => this.heldWeapons, ships: () => this.ships, weapon: () => this.weaponInfo(), myId: () => this.myId,
      me: () => (this.predictor ? { x: this.predictor.sim.x, y: this.predictor.sim.y } : null), views: () => this.views.values(),
    }, this.decalLayer);
    this.ext = new P34Client({
      net: () => this.net, clock: this.clock, audio: this.audio, sfx: (s) => this.sound(s), input: this.input, keys: this.keys,
      shrineProgress: (ids) => { this.worldObjs?.setSolvedShrines(ids); this.ext?.atlas.setSolved(ids); },
      identity: () => this.accountId,
      learn: action => { this.gameplay.acts[action] = true; },
      settings: this.settings, store: () => this.store, sheets: () => this.sheets, entityLayer: () => this.entityLayer,
      fxLayer: () => this.fxLayer, labelLayer: () => this.labelLayer, fx: () => this.fx,
      me: () => (this.predictor ? { x: this.predictor.visual(0).x, y: this.predictor.visual(0).y, fx: this.predictor.sim.faceX, fy: this.predictor.sim.faceY } : null),
      myId: () => this.myId,
      entityPos: (id) => { const v = this.views.get(id); return v ? { x: v.lx, y: v.ly } : null; },
      interp: () => this.interp as unknown as Interpolator<Pose & Record<string, unknown>>,
      renderTime: () => this.clock.serverNow(performance.now()) - this.clock.interpDelay,
      toScreen: (x, y) => ({ x: this.world.x + isoX(x, y) * this.scale, y: this.world.y + isoY(x, y) * this.scale }),
      aim: () => this.input.aimNow(this.predictor ? { x: this.predictor.sim.faceX, y: this.predictor.sim.faceY } : { x: 0, y: 1 }),
      target: () => this.currentTarget(), setTarget: (id) => this.setTarget(id),
      wins: this.gameplay.wins, tip: this.gameplay.tip, toasts: this.gameplay.toasts, profile: this.gameplay.profile,
      level: () => this.self?.level ?? 1, dead: () => this.dead,
    });
    this.input.onWorldClick = (x, y) => this.clickWorld(x, y);
    this.input.onClearTarget = () => this.setTarget(null);
    const menu = document.getElementById('hud-menu');
    this.input.blocked = () => !this.connected || this.dead || this.settingsOpen() || this.gameplay.blocking || this.ext.blocking || !!this.net?.switching || !!menu?.matches(':popover-open');
    this.store = new ChunkStore(0); // replaced once the seed is known
    window.addEventListener('resize', () => this.layout());
    this.layout();
  }

  /** Called once the server told us the world seed. */
  private startWorld(seed: number): void {
    this.seed = seed;
    this.store = new ChunkStore(seed, 400);
    this.terrain = new Terrain(this.app.renderer, this.store);
    this.objects = new ObjectViews(this.store, this.shadowLayer, this.entityLayer);
    this.worldObjs = new WorldObjViews(this.store, this.shadowLayer, this.entityLayer);
    this.buildings = new BuildingViews(seed, this.shadowLayer, this.entityLayer, this.roofLayer);
    this.weatherFx = new WeatherFx(this.weatherLayer);
    this.app.stage.addChildAt(this.terrain.sprite, 0);
    this.app.stage.addChildAt(this.world, 1);
    this.setSeason(this.seasonOverride ?? 1);
    this.layout();
  }

  private setSeason(s: SeasonIdx): void {
    if (this.art && s === this.seasonIdx) return;
    this.seasonIdx = s;
    const old = this.art;
    this.art = buildObjectArt(s);
    this.objects.setArt(this.art);
    this.worldObjs.setSeason(s);
    if (old) destroyObjectArt(old);
  }

  /** Make chunk (cx,cy) visible: terrain tile-class texture + object sprites. */
  private showChunk(cx: number, cy: number): void {
    this.shown.add(`${cx},${cy}`);
    this.terrain.build(cx, cy);
    this.objects.buildChunk(cx, cy);
    this.worldObjs.buildChunk(cx, cy);
    this.requestDiff(cx, cy);
  }

  private layout(): void {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = this.app.renderer.resolution || 1;
    // Landscape phones need phone-sized artwork too. Width alone classified
    // them as desktops and quadrupled the terrain fill cost at a tiny zoom.
    const phone = matchMedia('(pointer: coarse)').matches && Math.min(w, h) < 600;
    const target = phone ? (w > h ? 12 : 9) : w < 700 ? 9 : 18;
    this.scale = Math.max(1, Math.floor((w * dpr) / (32 * target))) / dpr;
    this.world.scale.set(this.scale);
    this.lighting.sprite.scale.set(this.scale);
    const vw = Math.ceil(w / this.scale) + 2, vh = Math.ceil(h / this.scale) + 2;
    this.lighting.resize(vw, vh);
    if (this.terrain) { this.terrain.resize(vw, vh); this.terrain.sprite.scale.set(this.scale); }
    this.fx.textRes = this.scale * dpr;
  }

  /** Resolves when the first state containing the local player has been received and the area is drawn. */
  async ready(): Promise<void> {
    await new Promise<void>((res) => { if (this.self) res(); else this.selfReady = res; });
    // synchronously draw the 3x3 around the player so the first frame is never empty
    const cx = chunkOf(Math.floor(this.predictor.sim.x)), cy = chunkOf(Math.floor(this.predictor.sim.y));
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) this.showChunk(x, y);
    this.app.ticker.add((t) => this.frame(t.deltaMS));
  }

  // ───────────── network handlers ─────────────
  private welcome(w: WelcomeMsg): void {
    this.myId = w.playerId; this.features = w.features ?? { aiDialogue: false };
    // a shard handoff re-sends WELCOME: keep the drawn world, only restart it for a new seed
    if (!this.terrain || w.seed !== this.seed) this.startWorld(w.seed);
    this.gameplay.onWelcome(this.accountId, w.seed);
    this.ext.onWelcome();
    this.net.send(MSG.HOLD, { slot: this.gameplay.hotbar.selected });
  }

  private ack(a: Ack): void {
    if (!this.predictor) return;
    this.predictor.reconcile(a);
  }

  private state(s: any): void {
    if (!s?.players || !this.myId || !this.terrain) return;
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
        night: !!e.night, name: e.name ?? '', level: e.level ?? 1, look: e.look ?? 0, weapon: e.weapon ?? '', held: e.held ?? '',
        st: e.st ?? 0, atk: e.atk ?? 0, tx: e.tx ?? 0, ty: e.ty ?? 0, poise: e.poise ?? 100, elite: e.elite ?? 0, rank: e.rank ?? 0, bonded: !!e.bonded,
      });
      if (!this.views.has(id)) this.makeView(id, type, e);
    };
    s.players.forEach((p: any, id: string) => push(id, p, 'player'));
    s.enemies.forEach((e: any, id: string) => push(id, e, 'enemy'));
    s.projectiles.forEach((p: any, id: string) => push(id, p, 'proj'));
    s.shadows?.forEach((p: any, id: string) => push(id, p, 'shadow'));
    s.npcs?.forEach((n: any, id: string) => push(id, n, 'npc'));
    for (const id of [...this.views.keys()]) if (!present.has(id)) this.dropView(id);

    const me = s.players.get(this.myId);
    if (me) {
      const wasDead = this.dead;
      this.dead = (me.flags & 4) !== 0;
      if (this.dead !== wasDead) { $('dead').hidden = !this.dead; if (this.dead) this.deadAt = performance.now(); }
      this.selfXp = me.xp;
      this.self = this.interp.sample(this.myId, t)?.pose ?? null;
      this.gameplay.profile.setLevel(me.level);
      if (!this.predictor) {
        this.predictor = new Predictor(me.x, me.y, this.store.solidAt);
        this.selfReady?.();
      }
    }
    this.ext.onState(s);
  }

  private chunk(m: ChunkMsg): void {
    const diff = decodeDiff(m.diff);
    this.store.applyDiff(m.cx, m.cy, diff);
    for (const o of m.objs ?? []) this.store.putObject(o);
    if (this.terrain.has(m.cx, m.cy)) this.terrain.invalidate(m.cx, m.cy);
    if (this.shown.has(`${m.cx},${m.cy}`)) { this.objects.buildChunk(m.cx, m.cy); this.worldObjs.buildChunk(m.cx, m.cy); }
  }
  private obj(m: ObjMsg): void {
    if (m.obj) { this.store.putObject(m.obj); this.worldObjs.upsert(m.obj); } else { this.store.removeObject(m.x, m.y); this.worldObjs.remove(m.x, m.y); }
    this.objects.refreshTile(m.x, m.y);
  }
  private tile(m: TileMsg): void {
    const { cx, cy } = this.store.setTile(m.tx, m.ty, m.tile);
    this.terrain.invalidate(cx, cy, ((m.tx % 32) + 32) % 32, ((m.ty % 32) + 32) % 32);
    this.objects.refreshTile(m.tx, m.ty);
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
      profile: (m: ProfileMsg) => this.gameplay.onProfile(m), obj: (m) => this.obj(m), panel: (m: PanelMsg) => this.gameplay.onPanel(m),
      rhythmStart: (m: RhythmStartMsg) => this.gameplay.onRhythmStart(m), rhythmResult: (m: RhythmResultMsg) => this.gameplay.onRhythmResult(m),
      fishBite: (m: FishBiteMsg) => this.gameplay.onFishBite(m), fishCast: (m) => this.gameplay.onFishCast(m),
      dialogue: (m: DialogueMsg) => this.gameplay.onDialogue(m), shopView: (m: ShopViewMsg) => this.gameplay.onShopView(m),
      forgePreview: (_m: ForgePreviewReply) => {}, toast: (m: ToastMsg) => this.gameplay.onToast(m),
      extra: this.ext.handlers(),
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

  private toolSwings = new WeakMap<ActorView, { at: number; received: number; tool: 'axe' | 'pickaxe' | 'hoe' | 'can' | 'rod' | 'net'; x: number; y: number }>();

  private fxFromServer(f: FxMsg): void {
    if ((['chop','mine','till','water','cast','dust'].includes(f.kind)) && f.id && (f.weapon === 'axe' || f.weapon === 'pickaxe' || f.weapon === 'hoe' || f.weapon === 'can' || f.weapon === 'rod' || f.weapon === 'net')) {
      const actor = this.views.get(f.id);
      if (actor) this.toolSwings.set(actor, { at: 0, received: performance.now(), tool: f.weapon, x: f.x, y: f.y });
    }
    if (f.kind === 'jump' && f.id && f.dx !== undefined && f.dy !== undefined) {
      this.hops.set(f.id, { at: performance.now(), x: f.x, y: f.y, tx: f.dx, ty: f.dy });
      this.sound('dash', f.x, f.y); return;
    }
    if (this.combat.onFx(f, (id) => this.views.get(id))) { if (f.kind === 'hurt' && f.id === this.myId) this.hurtTimer = 0.25; return; }
    switch (f.kind) {
      case 'shot': this.fx.burst(f.x, f.y, f.v !== undefined ? [f.v >= 8 ? 22 : HUE_PALETTE[f.v] ?? 45, 7] : [45, 46], 4); this.sound('shot', f.x, f.y); break;
      case 'form': this.fx.number(f.x, f.y - 1.2, f.v ? 'BEAR' : 'WOLF', f.v ? 37 : 46); this.fx.burst(f.x, f.y, f.v ? [37, 38, 22] : [46, 47, 7], f.v ? 10 : 6); break;
      case 'dash': this.fx.dash(f.x, f.y, f.dx ?? 0, f.dy ?? 1); this.sound('dash', f.x, f.y); break;
      case 'levelup': this.fx.ring(f.x, f.y, 38); this.fx.burst(f.x, f.y, [38, 39, 22], 12); this.fx.number(f.x, f.y - 1, `LEVEL ${f.v}!`, 38); this.sound('levelup'); break;
      case 'break': this.fx.burst(f.x, f.y, [4, 5, 20], 10); this.sound('break', f.x, f.y); break;
      case 'chop': this.fx.burst(f.x, f.y, [4, 5, 20], 5); this.sound('chop', f.x, f.y); break;
      case 'mine': this.fx.burst(f.x, f.y, [4, 5, 6], 6); this.sound('hit', f.x, f.y); break;
      case 'till': this.fx.burst(f.x, f.y, [17, 18, 19], 6); this.sound('till', f.x, f.y); break;
      case 'plant': this.fx.burst(f.x, f.y, [12, 13, 14], 5); this.sound('till', f.x, f.y); break;
      case 'water': this.fx.burst(f.x, f.y, [28, 29, 30], 8); this.sound('splash', f.x, f.y); break;
      case 'harvest': this.fx.burst(f.x, f.y, [21, 22, 38], 10); this.sound('harvest', f.x, f.y); break;
      case 'splash': this.fx.burst(f.x, f.y, [29, 30, 31], 8); this.sound('splash', f.x, f.y); break;
      case 'cast': this.sound('splash', f.x, f.y); break;
      case 'catch': this.fx.ring(f.x, f.y, 29, 1.4); this.fx.burst(f.x, f.y, [29, 30, 31], 10); this.sound('harvest', f.x, f.y); break;
      case 'heal': this.fx.burst(f.x, f.y, [13, 14, 15], 8); this.fx.number(f.x, f.y - 0.6, `+${f.v ?? ''}`, 14); break;
      case 'craft': this.fx.burst(f.x, f.y, [21, 22, 23], 8); this.sound('craft', f.x, f.y); break;
      case 'place': this.fx.burst(f.x, f.y, [18, 19, 20], 5); this.sound('till', f.x, f.y); break;
      case 'dust': this.fx.burst(f.x, f.y, [5, 6, 7], 4); break;
      case 'poof': this.fx.burst(f.x, f.y, [5, 6, 7], 8); break;
      case 'shadow': {
        const v = f.v ?? 0;
        if (v === 4) { this.fx.burst(f.x, f.y, [5, 6, 7], 8); break; }
        if (v === 5) { this.fx.ring(f.x, f.y, 46, 1.2, 0.25, 1); this.fx.burst(f.x, f.y, [46, 47, 7], 8); this.fx.number(f.x, f.y - 1, 'PHASE', 46); break; }
        this.fx.burst(f.x, f.y, v === 2 ? [43, 45, 7, 47] : [43, 44, 45], v === 2 ? 22 : 12);
        this.fx.ring(f.x, f.y, 44, v === 2 ? 2.4 : 1.4);
        this.sound(v === 2 ? 'levelup' : 'craft', f.x, f.y);
        break;
      }
    }
  }

  // ───────────── views ─────────────
  private makeView(id: string, type: ActorView['type'], e: any): void {
    const root = new Container();
    const gfx = new Graphics();
    const sprite = new Sprite();
    sprite.anchor.set(0.5, 1);
    sprite.y = 1;
    root.addChild(gfx, sprite);
    const shadow = new Sprite();
    shadow.anchor.set(0.5, 1);
    shadow.tint = 0x2a1060;
    this.shadowLayer.addChild(shadow);
    let outfit = 0;
    let label: Text | undefined;
    if (type === 'npc') {
      label = new Text({ text: NPC_BY_ID[id]?.name.split(' ')[0] ?? '', style: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11, fontWeight: 'bold', fill: pc(46), stroke: { color: pc(0), width: 3 } } });
      label.resolution = this.app.renderer.resolution || 1;
      label.anchor.set(0.5, 1);
      this.labelLayer.addChild(label);
    }
    if (type === 'shadow') {
      label = new Text({ text: e.name || '', style: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 10, fontWeight: 'bold', fill: e.bonded ? 0xe6d5a5 : 0xd49aff, stroke: { color: pc(0), width: 3 } } });
      label.resolution = this.app.renderer.resolution || 1;
      label.anchor.set(0.5, 1);
      this.labelLayer.addChild(label);
    }
    if (type === 'player') {
      outfit = id === this.myId ? 0 : [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COSMETIC_OUTFITS;
      // names live in screen space (crisp, not darkened by the night lightmap)
      label = new Text({ text: e.name || '', style: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, fontWeight: 'bold', fill: pc(id === this.myId ? 47 : 7), stroke: { color: pc(0), width: 3 } } });
      label.resolution = this.app.renderer.resolution || 1;
      label.anchor.set(0.5, 1);
      this.labelLayer.addChild(label);
    }
    this.entityLayer.addChild(root);
    const fl = new Sprite();
    fl.anchor.set(0.5, 1);
    fl.y = 1;
    fl.blendMode = 'add';
    fl.alpha = 0;
    root.addChild(fl);
    this.views.set(id, {
      id, type, npcId: type === 'npc' ? id : undefined, root, sprite, gfx, shadow, label, lx: e.x, ly: e.y, travel: 0, movingUntil: 0, outfit, trail: 0,
      fl, kind: e.kind ?? 0, flash: 0, punch: 0, ghostT: 0,
    });
  }

  private dropView(id: string): void {
    this.hops.delete(id);
    const v = this.views.get(id);
    if (!v) return;
    v.label?.destroy();
    v.shadow.destroy();
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
      if (!this.shown.has(`${x},${y}`)) want.push([x, y]);
    }
    want.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    this.pendingBuild = want;
    // free far chunks and forget their request flags so returning re-fetches fresh edits
    const far = new Set<string>();
    for (let y = cy - R - 1; y <= cy + R + 1; y++) for (let x = cx - R - 1; x <= cx + R + 1; x++) far.add(`${x},${y}`);
    this.terrain.retain(far);
    this.objects.retain(far);
    for (const k of [...this.shown]) if (!far.has(k)) this.shown.delete(k);
    for (const k of [...this.requested]) if (!far.has(k)) this.requested.delete(k);
  }

  // ───────────── main loop ─────────────
  private frame(dtMs: number): void {
    const now = performance.now();
    const t0 = now;
    // Pixi caps deltaMS on slow frames; use wall time for an honest FPS readout.
    const frameInterval = this.lastFrameAt ? now - this.lastFrameAt : dtMs;
    this.lastFrameAt = now;
    this.fps = this.fps * 0.95 + (1000 / Math.max(1, frameInterval)) * 0.05;
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
      if (!this.shown.has(`${x},${y}`)) this.showChunk(x, y);
    }

    const reduced = this.settings().reducedMotion;
    const hour = this.hourOverride ?? gameHour(this.clock.serverNow(now));
    const sun = sunFor(hour);
    const wall = this.clock.serverNow(now);
    const diving = isDiveY(this.predictor.sim.y), upper = isUpperY(this.predictor.sim.y);
    const underground = isCaveY(this.predictor.sim.y) || diving || upper;
    const weather = underground ? 'clear' : biomeWeather(weatherForDay(this.seed, dayNumber(wall)), biomeAt(this.seed, Math.floor(this.predictor.sim.x), Math.floor(this.predictor.sim.y)));
    this.wind.update(this.seed, wall / 1000, now / 1000, weather);
    this.setSeason(this.seasonOverride ?? ((SEASONS.indexOf(season(wall)) as SeasonIdx)));

    const me = this.predictor.visual(alpha);
    const W = window.innerWidth, H = window.innerHeight, S = this.scale, dpr = this.app.renderer.resolution;
    let ox = 0, oy = 0;
    if (this.fx.shake > 0 && !reduced) { ox = Math.round((Math.random() - 0.5) * 6 * this.fx.shake); oy = Math.round((Math.random() - 0.5) * 6 * this.fx.shake); }
    // iso camera: centred on the player's body (feet minus 6px), snapped to device pixels
    const camX = Math.round((isoX(me.x, me.y)) * S * dpr) / (S * dpr), camY = Math.round((isoY(me.x, me.y) - 6) * S * dpr) / (S * dpr);
    this.world.x = Math.round((W / 2 - camX * S) * dpr) / dpr + ox;
    this.world.y = Math.round((H / 2 - camY * S) * dpr) / dpr + oy;
    {
      const ow = Math.floor(camX - W / 2 / S), oh = Math.floor(camY - H / 2 / S);
      this.terrain.render(ow, oh, chunkOf(Math.floor(me.x)), chunkOf(Math.floor(me.y)), now / 1000, this.seasonIdx, !reduced, this.wind.w);
      this.terrain.sprite.x = this.world.x + ow * S;
      this.terrain.sprite.y = this.world.y + oh * S;
      // visible tile bounds = bounding box of the four unprojected screen corners
      const c = [unproject(ow, oh), unproject(ow + W / S, oh), unproject(ow, oh + H / S), unproject(ow + W / S, oh + H / S)];
      const vx0 = Math.floor(Math.min(...c.map((p) => p.x))) - 4, vx1 = Math.ceil(Math.max(...c.map((p) => p.x))) + 4;
      const vy0 = Math.floor(Math.min(...c.map((p) => p.y))) - 4, vy1 = Math.ceil(Math.max(...c.map((p) => p.y))) + 4;
      this.vis = { x0: vx0, y0: vy0, x1: vx1, y1: vy1 };
      this.objects.update(now, sun, reduced, vx0, vy0, vx1, vy1, this.wind);
      this.worldObjs.update(now, sun, reduced, vx0, vy0, vx1, vy1, this.wind);
      this.buildings.update(now, Math.floor(me.x), Math.floor(me.y), reduced, sun, vx0, vy0, vx1, vy1, this.wind);
      const m = this.input.mouseXY;
      const u = unproject((m.x - this.world.x) / S, (m.y - this.world.y) / S);
      this.input.mouseTile = { tx: Math.floor(u.x), ty: Math.floor(u.y) };
    }
    this.input.playerScreen = { x: W / 2 + (isoX(me.x, me.y) - camX) * S, y: H / 2 + (isoY(me.x, me.y) - 10 - camY) * S };
    this.input.feetScreen = { x: this.world.x + isoX(me.x, me.y) * S, y: this.world.y + isoY(me.x, me.y) * S };
    this.input.worldScale = S;

    // hit-stop / phase slip: remote entities and effects run on a slightly delayed, dilated clock (visual only)
    const fxScale = this.combat.frame(dt);
    const renderT = this.clock.serverNow(now) - this.clock.interpDelay - this.combat.warp;
    this.updateViews(me, alpha, renderT, now, dtMs);
    this.ambient.frame({ now, dt, view: this.vis, me, hour: underground ? 0 : hour, weather, season: this.seasonIdx, wind: this.wind.w, reduced });
    this.updateTarget34(renderT, me);
    this.syncFocus(now);
    this.drawAim(me, now);
    for (const v of this.views.values()) this.castShadow(v, sun);
    this.fx.update(dt * fxScale);
    if (this.self) this.combat.vignette($('vignette'), this.self.hp, this.self.maxHp, this.dead, dt);
    this.ext.frame(now, dtMs);

    // lighting
    const topLeftIso = { x: camX - W / 2 / S, y: camY - H / 2 / S };
    this.weatherFx.update(dt, weather, W, H, reduced, underground ? 0 : hour, underground ? undefined : this.wind.w, this.seasonIdx);
    const wa = this.weatherFx.ambient(weather), amb = diving ? [0.27, 0.53, 0.61] : upper ? [0.72, 0.67, 0.59] : underground ? CAVE_AMBIENT : ambientColor(hour);
    this.lighting.render([amb[0] * wa[0], amb[1] * wa[1], amb[2] * wa[2]], this.collectLights(topLeftIso.x, topLeftIso.y, underground ? 0 : hour, now, reduced));
    this.updateTarget(now);
    this.gameplay.frame(now);
    if (!this.gameplay.blocking) this.gameplay.holdUse(now);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);

    if (now - this.lastHud > 100) { this.lastHud = now; this.hud(hour, now); }
    this.frameMs = this.frameMs * 0.95 + (performance.now() - t0) * 0.05;
  }

  /** wielded weapon summary for prediction and effects */
  private weaponInfo(): { ranged: boolean; hue: number; id: string } {
    const id = this.gameplay.profile.equip.weapon ? ITEMS[this.gameplay.profile.equip.weapon.id]?.weapon : undefined;
    const w = id ? WEAPONS[id] : null;
    return { ranged: isRangedWeapon(w), hue: w ? w.hue : -1,id: w?.id ?? 'sword' };
  }

  currentTarget(): { id: string; kind: 'enemy' | 'player' } | null {
    const v = this.targetId ? this.views.get(this.targetId) : undefined;
    return v && (v.type === 'enemy' || v.type === 'player') ? { id: v.id, kind: v.type } : null;
  }

  /** the shadows' focus: the selected enemy (or nothing); synced at most 4 times a second */
  private focusSent: string | null = null;
  private focusAt = 0;
  private syncFocus(now: number): void {
    const t = this.currentTarget();
    const want = t && t.kind === 'enemy' ? t.id : null;
    if (want === this.focusSent || now - this.focusAt < 250) return;
    this.focusSent = want; this.focusAt = now;
    try { this.net.send(MSG34.SHADOW_CMD, { act: 'focus', target: want }); } catch { /* offline */ }
  }

  setTarget(id: string | null): void {
    this.targetId = id && id !== this.myId && this.views.has(id) ? id : null;
    if (this.targetId) this.sound('pickup');
  }

  /** Left click on an enemy selects it (the click still swings). Players are picked by the social layer. */
  private clickWorld(cx: number, cy: number): void {
    const S = this.scale;
    let best: ActorView | null = null, bd = Infinity;
    for (const v of this.views.values()) {
      if (v.type !== 'enemy' || !v.root.visible) continue;
      const sx = this.world.x + v.root.x * S, sy = this.world.y + v.root.y * S;
      const big = v.kind === 5 ? 1.4 : 1;
      const dx = cx - sx, dy = cy - (sy - 9 * S * big);
      if (Math.abs(dx) > 9 * S * big || Math.abs(dy) > 13 * S * big) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = v; }
    }
    if (best) this.setTarget(best.id);
  }

  private updateTarget34(renderT: number, me: { x: number; y: number }): void {
    const id = this.targetId;
    const smp = id ? this.interp.sample(id, renderT) : null;
    const v = id ? this.views.get(id) : undefined;
    if (!id || !v || !smp || (v.type !== 'enemy' && v.type !== 'player') || smp.pose.hp <= 0 && v.type === 'enemy' || Math.hypot(smp.x - me.x, smp.y - me.y) > 26) {
      if (id) this.targetId = null;
      this.targetFrame.update(null);
      return;
    }
    const p = smp.pose;
    const def = v.type === 'enemy' ? ENEMY_BY_KIND[p.kind] : null;
    if (def?.boss) { this.targetFrame.update(null); return; } // The encounter bar owns boss information.
    const tags = v.type === 'enemy'
      ? [def?.passive ? 'Passive' : def?.neutral ? 'Neutral' : 'Hostile', ...Object.entries(ELITE_NAMES).filter(([bit]) => (p.elite & Number(bit)) !== 0).map(([, n]) => n), ...(p.night ? ['Night'] : []), ...(p.st === 2 ? ['Preparing strike'] : p.st === 5 ? ['Staggered'] : p.st === 4 ? ['Recovering'] : [])]
      : ['Ally'];
    this.targetFrame.update({
      id: v.id, name: v.type === 'enemy' ? def?.name ?? 'Creature' : p.name || 'Player', level: v.type === 'enemy' ? null : p.level,
      hp: p.hp, maxHp: p.maxHp, kind: v.type, tags, poise: def?.poise ? p.poise : null, dist: Math.hypot(smp.x - me.x, smp.y - me.y),
    });
  }

  /** aim line + landing ring while an ability is armed; a soft view cone while the right mouse button looks */
  private drawAim(me: { x: number; y: number }, now: number): void {
    const g = this.aimGfx;
    g.clear();
    g.zIndex = 1e9;
    const tv = this.targetId ? this.views.get(this.targetId) : undefined;
    if (tv && tv.root.visible) {
      const ally = tv.type === 'player', c = ally ? 0x7dffa0 : 0xff5a5a, pulse = this.settings().reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(now / 160);
      const rx = tv.type === 'enemy' && tv.kind === 5 ? 13 : 9;
      g.ellipse(tv.root.x, tv.root.y, rx, rx / 2).stroke({ width: 1.5, color: c, alpha: pulse });
      g.ellipse(tv.root.x, tv.root.y, rx + 3, (rx + 3) / 2).stroke({ width: 1, color: c, alpha: 0.3 * pulse });
    }
    const armed = this.input.armed, look = this.input.lookHeld;
    if ((!armed && !look) || this.dead || !this.input.mouseActive) return;
    const a = this.input.aimNow({ x: this.predictor.sim.faceX, y: this.predictor.sim.faceY });
    const px = isoX(me.x, me.y), py = isoY(me.x, me.y) - 6;
    if (look) {
      // 70° cone, 9 tiles deep, projected onto the iso ground
      const pts: number[] = [px, py];
      const base = Math.atan2(a.y, a.x), half = (70 * Math.PI) / 360;
      for (let i = 0; i <= 14; i++) { const t = base - half + (i / 14) * half * 2; pts.push(isoX(me.x + Math.cos(t) * 9, me.y + Math.sin(t) * 9), isoY(me.x + Math.cos(t) * 9, me.y + Math.sin(t) * 9) - 6); }
      g.poly(pts).fill({ color: 0xcfe8ff, alpha: 0.07 });
    }
    if (armed) {
      const pulse = this.settings().reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(now / 120);
      const range = this.ext.circuit.aimRange() ?? 7;
      const ex = me.x + a.x * range, ey = me.y + a.y * range;
      const n = 12;
      for (let i = 1; i <= n; i++) {
        const t0 = (i - 0.55) / n, t1 = i / n;
        g.moveTo(isoX(me.x + a.x * range * t0, me.y + a.y * range * t0), isoY(me.x + a.x * range * t0, me.y + a.y * range * t0) - 6)
          .lineTo(isoX(me.x + a.x * range * t1, me.y + a.y * range * t1), isoY(me.x + a.x * range * t1, me.y + a.y * range * t1) - 6);
      }
      g.stroke({ width: 1.5, color: 0x9ff3ff, alpha: 0.85 * pulse });
      g.ellipse(isoX(ex, ey), isoY(ex, ey), 9, 4.5).stroke({ width: 1.5, color: 0xffffff, alpha: pulse });
    }
  }

  private fixedStep(now: number): void {
    const r = this.input.read(now);
    const frozen = this.dead || !this.connected || this.settingsOpen() || this.gameplay.blocking || this.ext.blocking || this.net.switching || now - (this.hops.get(this.myId)?.at ?? -1e9) < 650;
    if (frozen) { this.input.read(now); return; }
    const viewTick = Math.max(0, Math.floor(this.clock.tickAt(this.clock.serverNow(now) - this.clock.interpDelay - this.combat.warp)));
    const weapon = this.weaponInfo();
    this.predictor.sim.ranged = weapon.ranged;
    setMeleeWeapon(this.predictor.sim,weapon.id);
    const { cmd, ev } = this.predictor.step(r, viewTick);
    this.net.sendInput(cmd);
    const acts = this.gameplay.acts;
    if (r.dx || r.dy) acts.moved = true;
    if (ev.attacked) acts.attacked = true;
    if (ev.skill) acts.skillShot = true;
    if (ev.dashed) acts.dashed = true;
    this.combat.onLocalStep(ev, this.predictor.sim, this.views.get(this.myId));
    if (ev.skill) { this.fx.burst(this.predictor.sim.x, this.predictor.sim.y, [45, 46], 4); this.sound('shot'); }
    if (r.interact) this.gameplay.interact();
  }

  settingsOpen = (): boolean => false;

  private updateViews(me: { x: number; y: number }, alpha: number, renderT: number, now: number, dtMs: number): void {
    const reduced = this.settings().reducedMotion;
    this.combat.beginFrame();
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
      if (moved > 0.003 * (dtMs / 16)) v.movingUntil = now + 90;
      const walking = now < v.movingUntil;
      const pixels = this.scale * this.app.renderer.resolution;
      v.lx = x; v.ly = y;
      v.root.x = Math.round(isoX(x, y) * pixels) / pixels;
      v.root.y = Math.round(isoY(x, y) * pixels) / pixels;
      const hop = this.hops.get(v.id);
      if (hop) {
        const k = Math.min(1, (now - hop.at) / 650);
        if (k >= 1) this.hops.delete(v.id);
        else if (!reduced) { const hx = hop.x + (hop.tx - hop.x) * k, hy = hop.y + (hop.ty - hop.y) * k; v.root.x = Math.round(isoX(hx, hy) * pixels) / pixels; v.root.y = Math.round((isoY(hx, hy) - Math.sin(k * Math.PI) * 20) * pixels) / pixels; }
      }
      v.root.zIndex = depth(x, y);
      v.gfx.clear();

      if (v.type === 'player') {
        const dash = isMe ? this.predictor.sim.dashT > 0 : ((s?.flags ?? 0) & 1) !== 0;
        const deadP = isMe ? this.dead : ((s?.flags ?? 0) & 4) !== 0;
        const combatStrike = !deadP && !dash ? this.combat.attackFrame(v, now, reduced) : -1;
        const use = this.toolSwings.get(v);
        if (use && use.at === 0) use.at = now;
        const harvesting = !!use && now - use.received < 1500 && now - use.at < 300 && !deadP && !dash && combatStrike < 0;
        const strike = harvesting ? reduced ? 2 : Math.min(3, Math.floor((now-use!.at)/75)) : combatStrike;
        const running = dash || moved / Math.max(0.001, dtMs / 1000) > 5.6;
        const weaponId = isMe ? (this.gameplay.profile.equip.weapon ? ITEMS[this.gameplay.profile.equip.weapon.id]?.weapon : undefined) : s?.weapon;
        const weapon = isWeaponId(weaponId) ? weaponId : null;
        const tool = isMe ? ITEMS[this.gameplay.selected()?.id ?? '']?.tool?.type : s?.held;
        const heldItem = harvesting ? use!.tool : strike < 0 && isHeldId(tool) ? tool : weapon;
        const family = harvesting ? (use!.tool === 'can' || use!.tool === 'rod' ? CAST_FRAME : ATTACK_FRAME) : weapon && WEAPONS[weapon].cls === 'crossbow' ? SHOT_FRAME : weapon && WEAPONS[weapon].cls === 'staff' ? CAST_FRAME : ATTACK_FRAME;
        const frame = deadP ? -1 : strike >= 0 ? family + strike : walking
          ? running ? RUN_FRAME + (Math.floor(v.travel / 0.21) % RUN_FRAMES) : 1 + (Math.floor(v.travel / 0.17) % (WALK_FRAMES - 1))
          : reduced ? -1 : 0;
        const look = s?.look ?? (isMe ? this.gameplay.profile.equip.outfit : v.outfit);
        const sd = harvesting ? screenDir(use!.x-x, use!.y-y) : screenDir(fx, fy);
        v.sprite.texture = this.sheets.person(((look % OUTFITS.length) + OUTFITS.length) % OUTFITS.length, dirOf(sd.x, sd.y), frame);
        v.sprite.alpha = deadP ? 0.35 : dash ? 0.6 : 1;
        v.sprite.rotation = deadP ? Math.PI / 2 : 0;
        v.sprite.scale.set(1);
        const boat = isMe ? this.predictor.sim.boat > 0 : ((s?.flags ?? 0) & 128) !== 0;
        this.combat.rig(v, boat, fx, fy, now / 1000);
        if (heldItem && !boat && !deadP) {
          if (!v.held) { v.held = new Sprite(); v.held.anchor.set(0.5, 0.75); v.held.y = 1; v.root.addChild(v.held); }
          const direction = dirOf(sd.x, sd.y);
          // Stable idle uses the body's resolved breath column, so the hand never drifts off the grip.
          const pose = v.sprite.texture.frame.x / 24;
          v.held.texture = this.heldWeapons.texture(heldItem, direction, pose);
          v.held.visible = true; v.held.alpha = v.sprite.alpha;
          v.root.setChildIndex(v.held, direction === 1 || direction >= 6 ? 1 : v.root.children.length - 1);
        } else if (v.held) v.held.visible = false;

        if (!boat) v.gfx.ellipse(0, 0, 7, 3).fill({ color: 0x2a1060, alpha: 0.28 });
        if (!deadP) this.combat.decoratePlayer(v, s?.flags ?? 0, isMe ? this.predictor.sim : null, x, y, now, dtMs / 1000);
        v.flash *= Math.exp(-dtMs / 45);
        v.fl.texture = v.sprite.texture; v.fl.scale.copyFrom(v.sprite.scale); v.fl.rotation = v.sprite.rotation; v.fl.alpha = v.flash;
        if (dash && !reduced) { v.trail = 0.2; }
        if (v.label) {
          if (s?.name && v.label.text !== s.name) v.label.text = s.name;
          v.label.x = Math.round(this.world.x + v.root.x * this.scale);
          v.label.y = Math.round(this.world.y + (v.root.y - 30) * this.scale);
        }
      } else if (v.type === 'npc') {
        const inside = ((s?.flags ?? 0) & 2) !== 0;
        const myB = this.buildings.insideBuilding(Math.floor(me.x), Math.floor(me.y));
        const hisB = this.buildings.insideBuilding(Math.floor(x), Math.floor(y));
        const hidden = inside && (!hisB || hisB !== myB);
        v.root.visible = !hidden;
        const frame = walking || ((s?.flags ?? 0) & 1) !== 0 ? 1 + (Math.floor(v.travel / 0.17) % (WALK_FRAMES - 1)) : reduced ? -1 : 0;
        const nd = screenDir(fx, fy);
        v.sprite.texture = this.sheets.npc(v.id, dirOf(nd.x, nd.y), frame);
        v.gfx.ellipse(0, 0, 7, 3).fill({ color: 0x2a1060, alpha: 0.28 });
        if (v.label) {
          const near = Math.hypot(x - me.x, y - me.y) < 4;
          v.label.visible = !hidden && near;
          v.label.x = Math.round(this.world.x + v.root.x * this.scale);
          v.label.y = Math.round(this.world.y + (v.root.y - 30) * this.scale);
        }
      } else if (v.type === 'enemy' || v.type === 'shadow') {
        this.combat.drawEnemy(v, s, x, y, fx, now, dtMs / 1000, walking);
        if (v.type === 'shadow' && v.label) {
          v.label.visible = v.root.visible;
          const txt = s?.kind === 21 || s?.bonded ? s.name : `${s?.name ?? ''} · ${SHADOW_RANKS[s?.rank ?? 0]}`;
          if (v.label.text !== txt) v.label.text = txt;
          v.label.x = Math.round(this.world.x + v.root.x * this.scale);
          v.label.y = Math.round(this.world.y + (v.root.y - 34) * this.scale);
        }
      } else {
        this.combat.drawProjectile(v, s, now);
      }
    }
    this.combat.drawBombs(now);
    void alpha;
  }

  /** Tile cursor + prompt for what Use would do right now, and the bobber while fishing. */
  private updateTarget(now: number): void {
    const g = this.cursor;
    g.clear();
    this.bobber.clear();
    const f = this.gameplay.fishing;
    if (f) {
      const bx = isoX(f.tx + 0.5, f.ty + 0.5), by = isoY(f.tx + 0.5, f.ty + 0.5) + Math.sin(now / 250) * (f.bite ? 2.5 : 0.8);
      this.bobber.circle(bx, by - 2, 2.2).fill(pc(f.bite ? 38 : 35)).stroke({ color: pc(7), width: 1 });
      this.bobber.ellipse(bx, by + 1, 5, 2.2).stroke({ color: pc(30), width: 1, alpha: 0.7 });
      if (this.predictor) { const p = this.predictor.sim; this.bobber.moveTo(isoX(p.x, p.y), isoY(p.x, p.y) - 10).lineTo(bx, by - 2).stroke({ color: pc(6), width: 0.5, alpha: 0.7 }); }
    }
    if (this.gameplay.blocking || this.dead) { this.gameplay.setHint(null); return; }
    const pr = this.gameplay.prompt();
    const info = pr.info;
    if (info && info.kind !== 'talk') {
      const col = info.ok ? pc(info.kind === 'none' ? 6 : 47) : pc(37);
      const pulse = 0.55 + 0.25 * Math.sin(now / 200);
      g.poly([isoX(pr.tx, pr.ty), isoY(pr.tx, pr.ty), isoX(pr.tx + 1, pr.ty), isoY(pr.tx + 1, pr.ty), isoX(pr.tx + 1, pr.ty + 1), isoY(pr.tx + 1, pr.ty + 1), isoX(pr.tx, pr.ty + 1), isoY(pr.tx, pr.ty + 1)]).stroke({ color: col, width: 1, alpha: pulse });
    }
    this.gameplay.setHint(pr.label, info?.ok ?? true);
  }

  private npcNear(x: number, y: number, max: number): { id: string; x: number; y: number } | null {
    let best: { id: string; x: number; y: number } | null = null, bd = max;
    for (const v of this.views.values()) {
      if (v.type !== 'npc' || !v.root.visible) continue;
      const d = Math.hypot(v.lx - x, v.ly - y);
      if (d < bd) { bd = d; best = { id: v.id, x: v.lx, y: v.ly }; }
    }
    return best;
  }

  /** Data-URL portrait of an NPC (or `me`) cut from the sprite sheet, for dialogue and journal. */
  private portraitUrl(npcId: string): string {
    let u = this.portraitCache.get(npcId);
    if (u) return u;
    try {
      const tex = npcId === 'me' ? this.sheets.person(this.gameplay.profile.equip.outfit, DIR_DOWN, 0) : this.sheets.npc(npcId, DIR_DOWN, 0);
      const src = tex.source.resource as CanvasImageSource;
      const c = document.createElement('canvas');
      c.width = tex.frame.width; c.height = tex.frame.height;
      c.getContext('2d')!.drawImage(src, tex.frame.x, tex.frame.y, tex.frame.width, tex.frame.height, 0, 0, c.width, c.height);
      u = c.toDataURL();
    } catch { u = ''; }
    this.portraitCache.set(npcId, u);
    return u;
  }
  private selfPortraitEl(): HTMLElement {
    this.portraitCache.delete('me');
    const box = document.createElement('div');
    box.className = 'portrait-box';
    const img = document.createElement('img');
    img.src = this.portraitUrl('me');
    img.style.cssText = 'image-rendering:pixelated;height:88px';
    box.append(img);
    return box;
  }

  /** Cast the sprite's silhouette along the sun direction (same flat shadow model as world objects). */
  private castShadow(v: ActorView, sun: { dx: number; len: number; alpha: number }): void {
    const sh = v.shadow;
    sh.visible = v.root.visible && v.type !== 'proj' && sun.alpha > 0.02;
    if (!sh.visible) return;
    sh.texture = v.sprite.texture;
    sh.anchor.copyFrom(v.sprite.anchor);
    sh.position.set(v.root.x, v.root.y);
    sh.alpha = sun.alpha * v.sprite.alpha;
    sh.scale.y = -(0.22 + 0.14 * sun.len);
    sh.skew.x = sun.dx * sun.len * 0.55;
    sh.rotation = v.sprite.rotation;
  }

  private collectLights(isoX0: number, isoY0: number, hour: number, now: number, reduced: boolean): Light[] {
    const out: Light[] = [];
    const dark = darkness(hour);
    const toL = (tx: number, ty: number) => ({ x: isoX(tx, ty) - isoX0, y: isoY(tx, ty) - isoY0 });
    const v = this.vis;
    const small: Light[] = [];
    for (let ty = v.y0; ty < v.y1; ty++) {
      for (let tx = v.x0; tx < v.x1; tx++) {
        const def = TILE_DEFS[this.store.getTile(tx, ty)];
        if (!def || def.light <= 0) continue;
        const flick = reduced ? 1 : 0.88 + 0.12 * Math.sin(now / 130 + tx * 3.1 + ty * 1.7);
        const l = { ...toL(tx + 0.5, ty + 0.5), radius: def.light * (reduced ? 1 : flick), color: pc(def.lightColor), intensity: 0.95 * flick };
        if (def.light >= 4) out.push(l); else if (small.length < 24) small.push(l);
      }
    }
    out.push(...small);
    for (const l of this.worldObjs.lights(v.x0, v.y0, v.x1, v.y1)) out.push({ ...toL(l.x, l.y), radius: l.radius, color: l.color, intensity: l.intensity });
    const me = this.predictor.visual(0);
    const lantern = this.gameplay.profile.buffs.lantern && this.gameplay.profile.buffs.lantern.until > this.clock.serverNow(now);
    out.push({ ...toL(me.x, me.y), y: toL(me.x, me.y).y - 10, radius: lantern ? 8 : isCaveY(me.y) ? 6.5 : 4.5, color: pc(22), intensity: Math.min(1, dark * (lantern ? 1.4 : 1.1)) });
    for (const view of this.views.values()) {
      const p = toL(view.lx, view.ly);
      if (view.type === 'proj') out.push({ ...p, y: p.y - 8, radius: 2.2, color: pc(this.interp.sample(view.id, 0)?.pose.kind === 1 ? 45 : 46), intensity: 0.9 });
      else if (view.type === 'enemy' && dark > 0.3) out.push({ ...p, y: p.y - 6, radius: 1.6, color: pc(this.interp.sample(view.id, 0)?.pose.kind === 1 ? 37 : 45), intensity: 0.5 });
      else if ((view.type === 'player' && view.id !== this.myId) || view.type === 'npc') out.push({ ...p, y: p.y - 10, radius: 3, color: pc(22), intensity: dark });
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
      const orb = $('orb'), pct = Math.max(0, Math.min(100, (s.hp / Math.max(1, s.maxHp)) * 100));
      orb.style.setProperty('--hp', `${pct}%`);
      orb.classList.toggle('low', pct < 30);
      const health = `${s.hp} / ${s.maxHp}`;
      if (orb.dataset.v !== health) { orb.dataset.v = health; orb.textContent = health; orb.setAttribute('aria-valuenow', String(s.hp)); orb.setAttribute('aria-valuemax', String(s.maxHp)); }
      $('xp-orb').style.width = `${Math.min(100, (this.selfXp / xpForLevel(s.level)) * 100)}%`;
      const need = xpForLevel(s.level);
      $('xp-fill').style.width = `${Math.min(100, (this.selfXp / need) * 100)}%`;
    }
    const sn = this.clock.serverNow(now);
    $('clock').textContent = `${hour >= 6 && hour < 18 ? '☀' : '☾'} ${formatClock(hour)}`;
    $('dial-time').textContent = formatClock(hour);
    $('dial').style.setProperty('--t', `${(hour / 24) * 360}deg`);
    $('dial').classList.toggle('night', !(hour >= 6 && hour < 18));
    $('dayinfo').textContent = `Day ${dayNumber(sn) + 1} · ${season(sn)}`;
    if (this.dead) {
      const left = Math.max(0, Math.ceil(3 - (now - this.deadAt) / 1000));
      const p = $('dead').querySelector('p');
      const txt = `${this.combat.killedBy ? `Felled by a ${this.combat.killedBy}. ` : ''}Respawning at the shrine in ${left}… Tip: dash through a red warning just before it fills for a Phase Slip.`;
      if (p && p.textContent !== txt) p.textContent = txt;
    }
    let nearest = Infinity;
    for (const v of this.views.values()) if (v.type === 'enemy' && !ENEMY_BY_KIND[v.kind]?.passive) nearest = Math.min(nearest, Math.hypot(v.lx - this.predictor.sim.x, v.ly - this.predictor.sim.y));
    this.combat.noticeEnemies(nearest);

    this.gameplay.tutorialHint(); // Persist tutorial progress without covering the world.
    const hintEl = $('hint');
    const tip = this.combat.currentTip(now) ?? this.ext.hint();
    hintEl.hidden = !tip || this.gameplay.blocking || this.settingsOpen() || this.input.armed !== null;
    if (tip) hintEl.textContent = tip;
    const needs=this.gameplay.profile.needs;
    $('needs-hud').hidden=needs.mode!=='adventure';document.body.classList.toggle('needs-enabled',needs.mode==='adventure');
    for(const key of ['food','water'] as const){const bar=$(`needs-${key}`) as HTMLProgressElement;bar.value=needs[key];$(`needs-${key}-value`).textContent=String(Math.ceil(needs[key]));bar.classList.toggle('low',needs[key]<=20);}
    $('coins').textContent = `${this.gameplay.profile.coins} coins`;
    const buffs = Object.entries(this.gameplay.profile.buffs).filter(([, b]) => b.until > sn);
    const bb = $('buffs');
    bb.textContent = '';
    for (const [k, b] of buffs) { const el = document.createElement('span'); el.className = 'buff'; el.textContent = `${k} ${Math.ceil((b.until - sn) / 1000)}s`; bb.append(el); }
    const me = this.predictor.sim;
    const surfaceY = isDiveY(me.y) ? me.y - DIVE_OY : isUpperY(me.y) ? me.y - UPPER_OY : isCaveY(me.y) ? me.y - CAVE_OY : me.y;
    const town = townsFor(this.seed).reduce((best, t) => Math.hypot(t.cx - me.x, t.cy - surfaceY) < Math.hypot(best.cx - me.x, best.cy - surfaceY) ? t : best);
    const tdx = town.cx - me.x, tdy = town.cy - surfaceY, td = Math.hypot(tdx, tdy);
    const place = isDiveY(me.y) ? 'Submerged sanctuary · ' : isUpperY(me.y) ? 'Upper floor · ' : isCaveY(me.y) ? 'Undercroft · ' : '';
    const arrow = (dx: number, dy: number) => ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][Math.round(((Math.atan2(isoY(dx, dy), isoX(dx, dy)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
    const ward = sanctuaryAt(this.seed, me.x, me.y);
    const route = this.ext.atlas.navigation();
    if (route) {
      const dest = route.point;
      const label = dest ? planeOf(dest.y) !== planeOf(me.y) ? `${route.title} · ${planeOf(dest.y)}` : `${route.title} ${arrow(dest.x - me.x, dest.y - me.y)} ${Math.round(Math.hypot(dest.x - me.x, dest.y - me.y))} tiles` : `${route.title} · See Journal`;
      $('townhint').textContent = label + (ward ? ' · Sanctuary' : '');
      $('townhint').title = `${route.detail}. Tracked quest; manage it in Journal → Quests. Sanctuary wards protect towns from monsters.`;
    } else {
      $('townhint').textContent = place + (ward ? `${ward.name} · Sanctuary` : td > 30 ? `${town.name} ${arrow(tdx, tdy)} ${Math.round(td)} tiles` : town.name);
      $('townhint').title = ward ? 'Sanctuary: monsters cannot harm you here. Combat resumes beyond the settlement wards.' : $('townhint').textContent ?? '';
    }

    const dbg = $('debug');
    if (!dbg.hidden) {
      const p = this.predictor.sim;
      dbg.textContent = `fps ${this.fps.toFixed(0)} (js ${this.frameMs.toFixed(1)}ms)  ping ${this.rtt.toFixed(0)}ms  correction ${this.predictor.lastCorrection.toFixed(3)}\n` +
        `pos ${p.x.toFixed(2)},${p.y.toFixed(2)}  chunk ${chunkOf(Math.floor(p.x))},${chunkOf(Math.floor(p.y))}  views ${this.terrain.count}\n` +
        `entities ${this.views.size}  pending ${this.predictor.pending.length}  net-in ${(this.net.bytesIn / 1024).toFixed(0)}KB  seed ${this.seed}`;
    }
  }

  /** Hooks for automated browser tests. */
  debugState() {
    const p = this.predictor?.sim;
    return {
      ready: !!p, x: p?.x, y: p?.y, fps: this.fps, rtt: this.rtt, chunks: this.terrain?.count, entities: this.views.size,
      hp: this.self?.hp, level: this.self?.level, scale: this.scale, dead: this.dead,
      pending: this.predictor?.pending.length, correction: this.predictor?.lastCorrection, hour: this.hourOverride ?? gameHour(this.clock.serverNow(performance.now())),
      snapAge: performance.now() - this.lastSnapTime,
      enemies: [...this.views.values()].filter((v) => v.type === 'enemy').length,
      npcs: [...this.views.values()].filter((v) => v.type === 'npc').map((v) => ({ id: v.id, x: v.lx, y: v.ly, visible: v.root.visible })),
      coins: this.gameplay?.profile.coins, inv: this.gameplay?.profile.inv,
      objects: this.store?.objects.size,
      tile: (x: number, y: number) => this.store.getTile(x, y),
      p34: this.ext?.debug(), interpDelay: this.clock.interpDelay, shard: this.net?.shard,
      combat: p ? {
        dashN: p.dashN, charge: p.charge, slipT: p.slipT, combo: p.combo, warp: this.combat?.warp,
        foes: [...this.views.values()].filter((v) => v.type === 'enemy').map((v) => { const s = this.interp.sample(v.id, 0)?.pose; return { id: v.id, kind: v.kind, x: v.lx, y: v.ly, st: s?.st, atk: s?.atk, hp: s?.hp, elite: s?.elite }; }),
      } : null,
    };
  }

  /** test hook: server-time now */
  serverNow(): number { return this.clock.serverNow(performance.now()); }
  toggleDebug(): void { const d = $('debug'); d.hidden = !d.hidden; }
}
