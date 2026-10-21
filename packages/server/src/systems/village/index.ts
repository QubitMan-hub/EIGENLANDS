import {
  DAY_MS, GIFT_POINTS, ITEMS, NPCS, NpcState, RECIPES, SEASONS, TALK_POINTS, addStack, buildingAt, buyPrice, canAdd, decaySupply,
  findPath, giftTaste, hearts, pickLine, scheduleAt, sellPrice, townFor,
  type DialogueChatMsg, type DialogueMsg, type NpcDef, type ShopMsg, type ShopViewMsg, type Supply,
} from '@eigenlands/shared';
import type { FriendRec, PlayerRef, VillageHost, VillageSystem } from '../types';
import { AiDialogue, type AiOptions } from './ai';
import { RumorBook } from './rumors';

const WALK_SPEED = 1.8;                 // tiles / second
const TICK_DT = 0.05;
const TALK_RANGE = 6;                   // tiles between player and NPC for talk/gift/shop
const TALK_FREEZE_MS = 8000;
const EAR_RANGE = 4;                    // rumor exchange distance
const HOUR_MS = DAY_MS / 24;
const SAVE_EVERY_MS = 3000;

interface Runner {
  def: NpcDef;
  st: NpcState;
  x: number;
  y: number;
  spot: string;
  path: Array<[number, number]>;
  pi: number;
  fails: number;
  talkUntil: number;
  face: { x: number; y: number };
  flags: number;
}

export interface VillageOptions extends AiOptions { }

export class Village implements VillageSystem {
  private runners = new Map<string, Runner>();
  private market: Supply = {};
  private rumors = new RumorBook();
  private ai: AiDialogue;
  private lastHour = -1;
  private marketDirty = false;
  private rumorDirty = false;
  private lastSave = 0;
  private spots: Record<string, { x: number; y: number }>;

  constructor(private host: VillageHost, opts: VillageOptions = {}) {
    this.ai = new AiDialogue(opts);
    this.spots = townFor(host.seed).spots;
  }

  get aiEnabled(): boolean { return this.ai.enabled; }
  /** test/diagnostic accessors */
  supply(item: string): number { return this.market[item] ?? 0; }
  rumorBook(): RumorBook { return this.rumors; }
  npc(id: string): NpcState | undefined { return this.host.state.npcs.get(id); }

  // ───────────────────────── lifecycle ─────────────────────────

  async init(): Promise<void> {
    const m = await this.host.loadBlob<Supply>('market');
    if (m && typeof m === 'object') this.market = Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === 'number' && v > 0)) as Supply;
    this.rumors.load(await this.host.loadBlob<unknown>('rumors'));
    const hour = this.host.clock.hour(), weather = this.host.clock.weather();
    for (const def of NPCS) {
      const block = scheduleAt(def, hour, weather);
      const sp = this.spots[block.spot] ?? this.spots[def.home]!;
      const st = new NpcState();
      st.id = def.id; st.look = def.look; st.x = sp.x + 0.5; st.y = sp.y + 0.5; st.faceX = 0; st.faceY = 1; st.flags = 0;
      this.host.state.npcs.set(def.id, st);
      const r: Runner = { def, st, x: st.x, y: st.y, spot: block.spot, path: [], pi: 0, fails: 0, talkUntil: 0, face: { x: 0, y: 1 }, flags: 0 };
      this.runners.set(def.id, r);
      this.setFlags(r);
    }
    this.lastHour = Math.floor(this.host.clock.now() / HOUR_MS);
    this.lastSave = this.host.clock.now();
  }

  async dispose(): Promise<void> {
    await this.flush(true);
  }

  private async flush(force = false): Promise<void> {
    const now = this.host.clock.now();
    if (!force && now - this.lastSave < SAVE_EVERY_MS) return;
    this.lastSave = now;
    if (this.marketDirty || force) { this.marketDirty = false; await this.host.saveBlob('market', this.market); }
    if (this.rumorDirty || force) { this.rumorDirty = false; await this.host.saveBlob('rumors', this.rumors.list); }
  }

  // ───────────────────────── movement ─────────────────────────

  tick(tick: number): void {
    const now = this.host.clock.now();
    let i = 0;
    for (const r of this.runners.values()) {
      // re-evaluate the schedule once a second, staggered per NPC
      if ((tick + i * 2) % 20 === 0) this.reschedule(r);
      i++;
      this.step(r, now);
    }
    // hourly world step (market decay, rumor spreading); also persists dirty blobs
    const h = Math.floor(now / HOUR_MS);
    if (h !== this.lastHour) {
      const hours = Math.min(48, Math.max(1, h - this.lastHour));
      this.lastHour = h;
      this.hourly(hours);
    }
    if (this.marketDirty || this.rumorDirty) void this.flush().catch(() => { /* retried next time */ });
  }

  private reschedule(r: Runner): void {
    const block = scheduleAt(r.def, this.host.clock.hour(), this.host.clock.weather());
    if (block.spot === r.spot && (r.path.length > r.pi || this.arrived(r))) return;
    r.spot = block.spot;
    this.plan(r);
  }

  private arrived(r: Runner): boolean {
    const sp = this.spots[r.spot];
    return !sp || (Math.abs(r.x - (sp.x + 0.5)) < 0.05 && Math.abs(r.y - (sp.y + 0.5)) < 0.05);
  }

  private teleport(r: Runner): void {
    const sp = this.spots[r.spot];
    if (!sp) return;
    r.x = sp.x + 0.5; r.y = sp.y + 0.5; r.path = []; r.pi = 0; r.fails = 0;
  }

  private plan(r: Runner): void {
    const sp = this.spots[r.spot];
    if (!sp) return;
    const sx = Math.floor(r.x), sy = Math.floor(r.y);
    if (Math.hypot(sp.x + 0.5 - r.x, sp.y + 0.5 - r.y) > 40) { this.teleport(r); return; }
    if (sx === sp.x && sy === sp.y) { r.path = [[sp.x, sp.y]]; r.pi = 0; return; }
    const path = findPath(sx, sy, sp.x, sp.y, this.host.store.solidAt, 6000);
    if (!path) {
      // boxed in (e.g. a player built something): after a few failures just appear at the spot
      if (++r.fails >= 3) this.teleport(r);
      return;
    }
    r.fails = 0;
    r.path = path; r.pi = 0;
  }

  private step(r: Runner, now: number): void {
    let walking = false;
    if (now < r.talkUntil) {
      // stand still, already facing the player
    } else if (r.pi < r.path.length) {
      const [wx, wy] = r.path[r.pi]!;
      if (this.host.store.solidAt(wx, wy)) {
        r.path = []; r.pi = 0;
        this.plan(r);
      } else {
        const tx = wx + 0.5, ty = wy + 0.5;
        const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
        const stepLen = WALK_SPEED * TICK_DT;
        if (d <= stepLen) { r.x = tx; r.y = ty; r.pi++; } else { r.x += (dx / d) * stepLen; r.y += (dy / d) * stepLen; }
        if (d > 1e-4) r.face = { x: dx / d, y: dy / d };
        walking = true;
      }
      if (r.pi >= r.path.length) r.face = { x: 0, y: 1 }; // idle: face south
    }
    if (r.st.x !== r.x) r.st.x = r.x;
    if (r.st.y !== r.y) r.st.y = r.y;
    if (r.st.faceX !== r.face.x) r.st.faceX = r.face.x;
    if (r.st.faceY !== r.face.y) r.st.faceY = r.face.y;
    this.setFlags(r, walking, now < r.talkUntil);
  }

  private setFlags(r: Runner, walking = false, talking = false): void {
    const tx = Math.floor(r.x), ty = Math.floor(r.y);
    const b = buildingAt(this.host.seed, tx, ty);
    // inside = under the roof (everything except the south wall row, where the door stands)
    const inside = !!b && ty < b.y + b.h - 1;
    const f = (walking ? 1 : 0) | (inside ? 2 : 0) | (talking ? 4 : 0);
    if (f !== r.flags) { r.flags = f; r.st.flags = f; }
  }

  // ───────────────────────── hourly world step ─────────────────────────

  private hourly(hours: number): void {
    if (Object.keys(this.market).length) { this.market = decaySupply(this.market, hours); this.marketDirty = true; }
    if (this.rumors.gossipHears()) this.rumorDirty = true;
    const list = [...this.runners.values()];
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const A = list[a]!, B = list[b]!;
        if (Math.hypot(A.x - B.x, A.y - B.y) <= EAR_RANGE && this.rumors.exchange(A.def.id, B.def.id, this.host.rand)) this.rumorDirty = true;
      }
    }
  }

  onNewDay(day: number): void {
    if (this.rumors.prune(day)) this.rumorDirty = true;
  }

  rumor(kind: string, who: string, what = ''): void {
    this.rumors.add(kind, who, what, this.host.clock.day());
    this.rumorDirty = true;
  }

  // ───────────────────────── dialogue ─────────────────────────

  private near(p: PlayerRef, r: Runner): boolean {
    return Math.hypot(p.x - r.x, p.y - r.y) <= TALK_RANGE;
  }

  private friend(p: PlayerRef, id: string): FriendRec {
    return (p.data.friends[id] ??= { pts: 0, talked: -1, gifted: -1 });
  }

  private freeze(r: Runner, p: PlayerRef): void {
    r.talkUntil = this.host.clock.now() + TALK_FREEZE_MS;
    const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy) || 1;
    r.face = { x: dx / d, y: dy / d };
  }

  private teachable(p: PlayerRef, def: NpcDef, pts: number): string[] {
    if (hearts(pts) < 4) return [];
    return RECIPES.filter((x) => x.learn === `npc:${def.id}` && !p.data.recipes.has(x.id)).map((x) => x.id);
  }

  private message(p: PlayerRef, r: Runner, rec: FriendRec, text: string, extra: Partial<DialogueMsg> = {}): DialogueMsg {
    const def = r.def;
    return {
      npcId: def.id, name: def.name, title: def.title, text,
      hearts: hearts(rec.pts), pts: rec.pts,
      doing: scheduleAt(def, this.host.clock.hour(), this.host.clock.weather()).doing,
      canShop: !!def.shop,
      canGift: rec.gifted !== this.host.clock.day(),
      canChat: this.ai.enabled,
      teaches: this.teachable(p, def, rec.pts),
      ...extra,
    };
  }

  private runnerFor(p: PlayerRef, npcId: string): Runner | null {
    const r = this.runners.get(npcId);
    if (!r || !this.near(p, r)) return null;
    return r;
  }

  private scriptedLine(r: Runner, rec: FriendRec, today: boolean): string {
    const c = this.host.clock;
    return pickLine(r.def, { pts: rec.pts, hour: c.hour(), season: c.season(), weather: c.weather(), talkedToday: today, rand: this.host.rand });
  }

  talk(p: PlayerRef, npcId: string): DialogueMsg | null {
    const r = this.runnerFor(p, npcId);
    if (!r) return null;
    const day = this.host.clock.day();
    const rec = this.friend(p, npcId);
    const first = rec.talked !== day;
    if (first) { rec.pts += TALK_POINTS; rec.talked = day; p.dirty('friends'); }
    this.freeze(r, p);
    let text = this.scriptedLine(r, rec, !first);
    // memory: sometimes remember what the player gave us
    if (rec.lastGift && ITEMS[rec.lastGift] && this.host.rand() < 0.35) {
      text = `Thanks again for the ${ITEMS[rec.lastGift]!.name.toLowerCase()}! ${text}`;
    }
    // rumors: share something heard about someone else
    let rumor: string | undefined;
    if (this.host.rand() < 0.25) {
      const mine = this.rumors.heardBy(npcId).filter((x) => x.who !== p.name);
      if (mine.length) { rumor = mine[Math.floor(this.host.rand() * mine.length)]!.text; text += ` I heard that ${rumor.charAt(0).toLowerCase()}${rumor.slice(1)}`; }
    }
    return this.message(p, r, rec, text, rumor ? { rumor } : {});
  }

  gift(p: PlayerRef, npcId: string, slot: number): DialogueMsg | null {
    const r = this.runnerFor(p, npcId);
    if (!r) return null;
    const day = this.host.clock.day();
    const rec = this.friend(p, npcId);
    const stack = Number.isInteger(slot) ? p.data.inv[slot] : null;
    if (!stack) { p.toast('Nothing to give.', 'bad'); return this.message(p, r, rec, this.scriptedLine(r, rec, true), { gift: { taste: 'neutral', delta: 0 } }); }
    this.freeze(r, p);
    if (rec.gifted === day) return this.message(p, r, rec, pickOne(r.def.lines.gift.again, this.host.rand), { gift: { taste: 'neutral', delta: 0 } });
    const taste = giftTaste(r.def, stack.id);
    const delta = GIFT_POINTS[taste];
    stack.n -= 1;
    if (stack.n <= 0) p.data.inv[slot] = null;
    rec.pts = Math.max(0, rec.pts + delta);
    rec.gifted = day;
    rec.lastGift = stack.id;
    p.dirty('inv', 'friends');
    if (taste === 'love') this.rumor('gift_love', p.name, r.def.name);
    const text = pickOne(r.def.lines.gift[taste], this.host.rand);
    return this.message(p, r, rec, text, { gift: { taste, delta } });
  }

  async chat(p: PlayerRef, msg: DialogueChatMsg): Promise<DialogueMsg | null> {
    if (!this.ai.enabled || !msg || typeof msg.npcId !== 'string') return null;
    const r = this.runnerFor(p, msg.npcId);
    if (!r) return null;
    const rec = this.friend(p, msg.npcId);
    const c = this.host.clock;
    this.freeze(r, p);
    const ai = await this.ai.reply(p.accountId, r.def, msg.text, {
      season: SEASONS[c.season()] ?? 'Spring', weather: c.weather(), hour: c.hour(), hearts: hearts(rec.pts),
      doing: scheduleAt(r.def, c.hour(), c.weather()).doing,
    });
    // any failure (disabled, rate limited, timeout, bad output) falls back to the scripted line
    return this.message(p, r, rec, ai ?? this.scriptedLine(r, rec, true));
  }

  // ───────────────────────── shops ─────────────────────────

  private canBuyKind(def: NpcDef, itemId: string): boolean {
    const kind = ITEMS[itemId]?.kind;
    const b = def.shop?.buys;
    return !!kind && !!b && (b.includes('all') || b.includes(kind));
  }

  private unitSell(def: NpcDef, itemId: string, extraSupply = 0): number {
    return Math.max(1, Math.floor(sellPrice(itemId, this.supply(itemId) + extraSupply) * (def.shop?.buyBonus ?? 1)));
  }

  private view(p: PlayerRef, def: NpcDef): ShopViewMsg {
    const season = this.host.clock.season();
    const shop = def.shop;
    const sell: Record<number, number> = {};
    if (shop) p.data.inv.forEach((s, i) => { if (s && this.canBuyKind(def, s.id)) sell[i] = this.unitSell(def, s.id); });
    return {
      npcId: def.id, name: shop?.name ?? def.name, coins: p.data.coins, sell,
      stock: (shop?.stock ?? []).filter((s) => !s.seasons || s.seasons.includes(season)).map((s) => ({ item: s.item, price: buyPrice(s.item, s.markup) })),
    };
  }

  shop(p: PlayerRef, msg: ShopMsg): ShopViewMsg | null {
    if (!msg || typeof msg.npcId !== 'string') return null;
    const r = this.runnerFor(p, msg.npcId);
    if (!r) return null;
    const def = r.def;
    if (msg.action === 'learn') {
      const rec = this.friend(p, def.id);
      const recipe = RECIPES.find((x) => x.id === msg.item);
      if (!recipe || recipe.learn !== `npc:${def.id}`) p.toast('They cannot teach that.', 'bad');
      else if (hearts(rec.pts) < 4) p.toast(`${def.name} will teach you once you are better friends (4 hearts).`, 'bad');
      else if (p.data.recipes.has(recipe.id)) p.toast('You already know that.', 'info');
      else { p.data.recipes.add(recipe.id); p.dirty('recipes'); p.toast(`${def.name} taught you a recipe!`, 'good'); }
      return this.view(p, def);
    }
    if (!def.shop) return null;
    if (msg.action === 'open') { this.freeze(r, p); return this.view(p, def); }
    const n = msg.n === undefined ? 1 : msg.n;
    if (!Number.isInteger(n) || n < 1 || n > 99) return this.view(p, def);
    if (msg.action === 'buy') {
      const season = this.host.clock.season();
      const entry = def.shop.stock.find((s) => s.item === msg.item && (!s.seasons || s.seasons.includes(season)));
      if (!entry) { p.toast('Not for sale right now.', 'bad'); return this.view(p, def); }
      const cost = buyPrice(entry.item, entry.markup) * n;
      if (p.data.coins < cost) { p.toast('You cannot afford that.', 'bad'); return this.view(p, def); }
      const stack = { id: entry.item, n };
      if (!canAdd(p.data.inv, stack)) { p.toast('Your pack is full.', 'bad'); return this.view(p, def); }
      addStack(p.data.inv, stack);
      p.data.coins -= cost;
      p.dirty('inv', 'coins');
      p.toast(`Bought ${n} ${ITEMS[entry.item]!.name} for ${cost}.`, 'good', stack);
      return this.view(p, def);
    }
    if (msg.action === 'sell') {
      const stack = Number.isInteger(msg.slot) ? p.data.inv[msg.slot as number] : null;
      if (!stack || stack.n < n) { p.toast('You do not have that many.', 'bad'); return this.view(p, def); }
      if (!this.canBuyKind(def, stack.id)) { p.toast(`${def.name} is not interested in that.`, 'bad'); return this.view(p, def); }
      let total = 0;
      for (let i = 0; i < n; i++) total += this.unitSell(def, stack.id, i); // price slides as the market saturates
      const id = stack.id;
      stack.n -= n;
      if (stack.n <= 0) p.data.inv[msg.slot as number] = null;
      p.data.coins += total;
      this.market[id] = (this.market[id] ?? 0) + n;
      this.marketDirty = true;
      p.dirty('inv', 'coins');
      p.toast(`Sold ${n} ${ITEMS[id]!.name} for ${total}.`, 'good');
      return this.view(p, def);
    }
    return this.view(p, def);
  }
}

const pickOne = (a: string[], rand: () => number): string => a[Math.floor(rand() * a.length)]!;

export function createVillage(host: VillageHost, opts?: VillageOptions): Village {
  return new Village(host, opts);
}

