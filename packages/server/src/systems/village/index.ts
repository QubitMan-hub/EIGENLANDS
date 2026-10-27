import { civOf, recordCiv } from '../../features/civ/registry';
import { gainRep, gainStanding } from '../reputation';
import {
  DAY_MS,
  GIFT_EXTRA,
  GIFT_POINTS,
  ITEMS,
  civPriceFactor,
  localEconomy,
  neighbourLine,
  neighboursText,
  tieGossipOn,
  marriesOn,
  RECRUIT_ROLES,
  recruitFee,
  royalCelebration,
  tieNewsOn,
  tieSpill,
  REALMFOLK,
  RACES,
  STANDING,
  isRace,
  realmfolkSpots,
  type ShopStock,
  NPC_BY_ID,
  standingLine,
  localPriceFactor,
  DELVER_MERCHANTS,
  type ScheduleBlock,
  KINGDOMS,
  REALM_IDS,
  type RealmId,
  festivalOn,
  repPriceMultiplier,
  tradeModifier,
  realmNpcs,
  NPCS,
  delverSpots,
  NpcState,
  RECIPES,
  SEASONS,
  TALK_POINTS,
  addStack,
  buildingAt,
  buyPrice,
  canAdd,
  composeTalk,
  decaySupply,
  fill,
  findPath,
  giftTaste,
  hearts,
  isWorking,
  objectiveText,
  offerable,
  pendingEvent,
  questComplete,
  questDef,
  scheduleAt,
  sellPrice,
  shopOpen,
  tierOf,
  townsFor,
  voiceOf,
  type DeedKind,
  type DialogueChatMsg,
  type DialogueChoice,
  type DialogueMsg,
  type NpcDef,
  type QuestMsg,
  type ShopMsg,
  type ShopViewMsg,
  type Supply,
} from '@eigenlands/shared';
import type { FriendRec, PlayerRef, VillageHost, VillageSystem } from '../types';
import { acceptQuest, questEvent, syncQuests, turnInQuest } from '../quests';
import { AiDialogue, type AiOptions } from './ai';
import { RumorBook } from './rumors';

const WALK_SPEED = 1.8; // tiles / second
const TICK_DT = 0.05;
const TALK_RANGE = 6; // tiles between player and NPC for talk/gift/shop
const TALK_FREEZE_MS = 8000;
const EAR_RANGE = 4; // rumor exchange distance
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

export interface VillageOptions extends AiOptions {
  npcIds?: string[];
}

export class Village implements VillageSystem {
  private runners = new Map<string, Runner>();
  private market: Supply = {};
  private rumors = new RumorBook();
  private ai: AiDialogue;
  private lastHour = -1;
  private marketDirty = false;
  private rumorDirty = false;
  private lastSave = 0;
  private defs: NpcDef[];
  private spots: Record<string, { x: number; y: number }>;

  constructor(
    private host: VillageHost,
    opts: VillageOptions = {},
  ) {
    this.ai = new AiDialogue(opts);
    const gen = host.store.generation;
    this.spots = Object.assign({}, ...townsFor(host.seed, gen).map((t) => t.spots));
    // revision 4 adds the travelling merchants and the delver camps they trade from
    const modern = host.store.generation >= 4;
    if (modern) Object.assign(this.spots, delverSpots(host.seed));
    // revision 6: the peoples of the three realms
    if (gen >= 6) Object.assign(this.spots, realmfolkSpots(host.seed));
    const all =
      gen >= 6
        ? [...NPCS, ...DELVER_MERCHANTS, ...realmNpcs(), ...REALMFOLK]
        : gen >= 5
          ? [...NPCS, ...DELVER_MERCHANTS, ...realmNpcs()]
          : modern
            ? [...NPCS, ...DELVER_MERCHANTS]
            : NPCS;
    this.defs = opts.npcIds ? all.filter((n) => opts.npcIds!.includes(n.id)) : all;
  }

  /** the schedule block for now; on a kingdom's festival day its folk gather in the plaza from noon until night */
  private blockAt(def: NpcDef, hour: number, weather: ReturnType<VillageHost['clock']['weather']>): ScheduleBlock {
    if (this.host.away?.(def.id)) return { h0: 0, h1: 24, spot: def.home, doing: 'away on a hired contract' };
    const block = scheduleAt(def, hour, weather);
    if (def.realm && hour >= 12 && hour < 22 && def.role !== 'guard' && def.role !== 'archer' && def.role !== 'ruler') {
      const day = this.host.clock.day();
      if (festivalOn(def.realm as RealmId, day))
        return { h0: 12, h1: 22, spot: `${def.id}.plaza`, doing: 'celebrating the festival' };
      if (marriesOn(def.id, day))
        return { h0: 12, h1: 22, spot: `${def.id}.plaza`, doing: 'celebrating their wedding' };
      const royal = royalCelebration(civOf(this.host.seed)?.kingdoms[def.realm as RealmId], day);
      if (royal) return { h0: 12, h1: 22, spot: `${def.id}.plaza`, doing: `celebrating ${royal.title.toLowerCase()}` };
    }
    return block;
  }

  get aiEnabled(): boolean {
    return this.ai.enabled;
  }
  /** test/diagnostic accessors */
  supply(item: string): number {
    return this.market[item] ?? 0;
  }
  rumorBook(): RumorBook {
    return this.rumors;
  }
  npc(id: string): NpcState | undefined {
    return this.host.state.npcs.get(id);
  }

  // ───────────────────────── lifecycle ─────────────────────────

  async init(): Promise<void> {
    const m = await this.host.loadBlob<Supply>('market');
    if (m && typeof m === 'object')
      this.market = Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === 'number' && v > 0)) as Supply;
    this.rumors.load(await this.host.loadBlob<unknown>('rumors'));
    const hour = this.host.clock.hour(),
      weather = this.host.clock.weather();
    for (const def of this.defs) {
      const block = this.blockAt(def, hour, weather);
      const sp = this.spots[block.spot] ?? this.spots[def.home]!;
      const st = new NpcState();
      st.id = def.id;
      st.look = def.look;
      st.x = sp.x + 0.5;
      st.y = sp.y + 0.5;
      st.faceX = 0;
      st.faceY = 1;
      st.flags = 0;
      this.host.state.npcs.set(def.id, st);
      const r: Runner = {
        def,
        st,
        x: st.x,
        y: st.y,
        spot: block.spot,
        path: [],
        pi: 0,
        fails: 0,
        talkUntil: 0,
        face: { x: 0, y: 1 },
        flags: 0,
      };
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
    if (this.marketDirty || force) {
      this.marketDirty = false;
      await this.host.saveBlob('market', this.market);
    }
    if (this.rumorDirty || force) {
      this.rumorDirty = false;
      await this.host.saveBlob('rumors', this.rumors.list);
    }
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
    if (this.marketDirty || this.rumorDirty)
      void this.flush().catch(() => {
        /* retried next time */
      });
  }

  private reschedule(r: Runner): void {
    const block = this.blockAt(r.def, this.host.clock.hour(), this.host.clock.weather());
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
    r.x = sp.x + 0.5;
    r.y = sp.y + 0.5;
    r.path = [];
    r.pi = 0;
    r.fails = 0;
  }

  private plan(r: Runner): void {
    const sp = this.spots[r.spot];
    if (!sp) return;
    const sx = Math.floor(r.x),
      sy = Math.floor(r.y);
    if (Math.hypot(sp.x + 0.5 - r.x, sp.y + 0.5 - r.y) > 40) {
      this.teleport(r);
      return;
    }
    if (sx === sp.x && sy === sp.y) {
      r.path = [[sp.x, sp.y]];
      r.pi = 0;
      return;
    }
    const path = findPath(sx, sy, sp.x, sp.y, this.host.store.solidAt, 6000);
    if (!path) {
      // boxed in (e.g. a player built something): after a few failures just appear at the spot
      if (++r.fails >= 3) this.teleport(r);
      return;
    }
    r.fails = 0;
    r.path = path;
    r.pi = 0;
  }

  private step(r: Runner, now: number): void {
    let walking = false;
    if (now < r.talkUntil) {
      // stand still, already facing the player
    } else if (r.pi < r.path.length) {
      const [wx, wy] = r.path[r.pi]!;
      if (this.host.store.solidAt(wx, wy)) {
        r.path = [];
        r.pi = 0;
        this.plan(r);
      } else {
        const tx = wx + 0.5,
          ty = wy + 0.5;
        const dx = tx - r.x,
          dy = ty - r.y,
          d = Math.hypot(dx, dy);
        const stepLen = WALK_SPEED * TICK_DT;
        if (d <= stepLen) {
          r.x = tx;
          r.y = ty;
          r.pi++;
        } else {
          r.x += (dx / d) * stepLen;
          r.y += (dy / d) * stepLen;
        }
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
    const tx = Math.floor(r.x),
      ty = Math.floor(r.y);
    const b = buildingAt(this.host.seed, tx, ty);
    // inside = under the roof (everything except the south wall row, where the door stands)
    const inside = !!b && ty < b.y + b.h - 1;
    const f = (walking ? 1 : 0) | (inside ? 2 : 0) | (talking ? 4 : 0);
    if (f !== r.flags) {
      r.flags = f;
      r.st.flags = f;
    }
  }

  // ───────────────────────── hourly world step ─────────────────────────

  private hourly(hours: number): void {
    if (Object.keys(this.market).length) {
      this.market = decaySupply(this.market, hours);
      this.marketDirty = true;
    }
    if (this.rumors.gossipHears()) this.rumorDirty = true;
    const list = [...this.runners.values()];
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const A = list[a]!,
          B = list[b]!;
        if (Math.hypot(A.x - B.x, A.y - B.y) <= EAR_RANGE && this.rumors.exchange(A.def.id, B.def.id, this.host.rand))
          this.rumorDirty = true;
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
    const dx = p.x - r.x,
      dy = p.y - r.y,
      d = Math.hypot(dx, dy) || 1;
    r.face = { x: dx / d, y: dy / d };
  }

  private teachable(p: PlayerRef, def: NpcDef, pts: number): string[] {
    if (hearts(pts) < 4) return [];
    return RECIPES.filter((x) => x.learn === `npc:${def.id}` && !p.data.recipes.has(x.id)).map((x) => x.id);
  }

  /** Quests this villager offers, is waiting on, or can take back (story quests and their own board requests). */
  private questList(p: PlayerRef, def: NpcDef): NonNullable<DialogueMsg['quests']> {
    const log = p.data.quests ?? {};
    const out: NonNullable<DialogueMsg['quests']> = [];
    for (const [id, st] of Object.entries(log)) {
      if (st.state !== 'active') continue;
      const d = questDef(id, this.host.seed);
      if (!d || d.giver !== def.id) continue;
      out.push({ id, title: d.title, state: questComplete(d, st) ? 'ready' : 'active' });
    }
    for (const d of offerable(def.id, log)) out.push({ id: d.id, title: d.title, state: 'offer' });
    return out.sort(
      (a, b) => ['ready', 'offer', 'active'].indexOf(a.state) - ['ready', 'offer', 'active'].indexOf(b.state),
    );
  }

  private mainChoices(p: PlayerRef, def: NpcDef): DialogueChoice[] {
    const ch: DialogueChoice[] = this.questList(p, def).map((q) => ({
      id: `quest:${q.id}`,
      kind: q.state === 'ready' ? 'ready' : 'quest',
      text: q.state === 'ready' ? `★ ${q.title} (done!)` : q.state === 'offer' ? `! ${q.title}` : `… ${q.title}`,
    }));
    if (def.settlement && def.shop && this.host.hire)
      ch.push({ id: 'hire', text: 'Guild escort · 250 coins / 30 min · companion slot', kind: 'ask' });
    else if (def.realm && RECRUIT_ROLES.has(def.role ?? '') && this.host.hire)
      ch.push({
        id: 'hire',
        text: `Hire me · from ${recruitFee(def.role, 5)} coins / hour · companion slot`,
        kind: 'ask',
      });
    ch.push({ id: 'ask', text: 'Ask about…', kind: 'ask' });
    return ch;
  }

  private message(
    p: PlayerRef,
    r: Runner,
    rec: FriendRec,
    text: string,
    extra: Partial<DialogueMsg> = {},
  ): DialogueMsg {
    const def = r.def;
    const hour = this.host.clock.hour();
    const open = shopOpen(def, hour);
    return {
      npcId: def.id,
      name: def.name,
      title: def.title,
      text,
      hearts: hearts(rec.pts),
      pts: rec.pts,
      doing: this.blockAt(def, hour, this.host.clock.weather()).doing,
      canShop: !!def.shop && open,
      canGift: rec.gifted !== this.host.clock.day(),
      canChat: this.ai.enabled,
      teaches: this.teachable(p, def, rec.pts),
      quests: this.questList(p, def),
      choices: this.mainChoices(p, def),
      ...(def.shop?.hours ? { hours: def.shop.hours, shopOpen: open } : {}),
      ...extra,
    };
  }

  private runnerFor(p: PlayerRef, npcId: string): Runner | null {
    const r = this.runners.get(npcId);
    if (!r || !this.near(p, r)) return null;
    return r;
  }

  /** A recent deed of the player this villager has not mentioned yet. */
  private deedFor(p: PlayerRef, r: Runner, rec: FriendRec): { kind: DeedKind; what: string; key: string } | null {
    const v = voiceOf(r.def.id);
    if (!v) return null;
    const today = this.host.clock.day();
    let best: { kind: DeedKind; what: string; key: string; day: number } | null = null;
    for (const [k, d] of Object.entries(p.data.deeds ?? {}) as Array<[DeedKind, { day: number; what: string }]>) {
      const key = `${k}:${d.day}`;
      if (!d || d.day < today - 1 || rec.noted?.includes(key) || !v.deeds[k]?.length) continue;
      if (!best || d.day > best.day) best = { kind: k, what: d.what, key, day: d.day };
    }
    return best;
  }

  private scriptedLine(p: PlayerRef, r: Runner, rec: FriendRec, first: boolean): string {
    const c = this.host.clock;
    const doing = this.blockAt(r.def, c.hour(), c.weather()).doing;
    const deed = this.deedFor(p, r, rec);
    const out = composeTalk(r.def, {
      pts: rec.pts,
      hour: c.hour(),
      season: c.season(),
      weather: c.weather(),
      first,
      atWork: isWorking(doing),
      rand: this.host.rand,
      deed,
      lastGift: rec.lastGift ? (ITEMS[rec.lastGift]?.name.toLowerCase() ?? null) : null,
      outfit: p.data.equip?.outfit,
    });
    if (out.usedDeed && deed) rec.noted = [...(rec.noted ?? []), deed.key].slice(-6);
    return out.text;
  }

  talk(p: PlayerRef, npcId: string, topic?: string): DialogueMsg | null {
    const r = this.runnerFor(p, npcId);
    if (!r) return null;
    const day = this.host.clock.day();
    const rec = this.friend(p, npcId);
    const first = rec.talked !== day;
    if (first) {
      rec.pts += TALK_POINTS;
      rec.talked = day;
      p.dirty('friends');
    }
    this.freeze(r, p);
    p.data.quests ??= {};
    questEvent(p, { type: 'talk', target: npcId, n: 1 }, this.host.seed);
    syncQuests(p, this.host.seed);
    const v = voiceOf(npcId);
    const t = typeof topic === 'string' ? topic.slice(0, 48) : '';
    const rand = this.host.rand;

    if (t === 'hire') return this.message(p, r, rec, this.host.hire?.(p, npcId) ?? 'The guild is unavailable.');
    if (t === 'bye') return this.message(p, r, rec, v ? pickOne(v.bye, rand) : 'Goodbye.', { end: true, choices: [] });
    if (t === 'ask' || t.startsWith('ask:')) return this.ask(p, r, rec, t.slice(4));
    if (t.startsWith('quest:')) return this.questTopic(p, r, rec, t.slice(6));
    if (t.startsWith('event:')) return this.eventChoice(p, r, rec, t);
    if (t === 'back') return this.message(p, r, rec, v ? pickOne(v.again, rand) : 'Anything else?');

    // a heart event the player has earned takes over the conversation
    const ev = pendingEvent(npcId, rec.pts, p.data.events ?? []);
    if (ev) {
      const idx = Number(ev.id.split(':')[1]);
      return this.message(p, r, rec, ev.ev.pages[0]!, {
        event: `${'♥'.repeat(Math.min(3, Math.ceil(ev.ev.hearts / 3)))} ${ev.ev.title}`,
        pages: ev.ev.pages.slice(1),
        mood: 'surprised',
        choices: ev.ev.choices.map((c, i) => ({ id: `event:${idx}:${i}`, text: c.text, kind: 'event' as const })),
      });
    }

    let text = this.scriptedLine(p, r, rec, first);
    // rumors: share something heard about someone else
    let rumor: string | undefined;
    if (rand() < 0.25) {
      const mine = this.rumors.heardBy(npcId).filter((x) => x.who !== p.name);
      if (mine.length) {
        rumor = mine[Math.floor(rand() * mine.length)]!.text;
        text +=
          ' ' +
          (v
            ? fill(pickOne(v.rumorIn, rand), { rumor })
            : `I heard that ${rumor.charAt(0).toLowerCase()}${rumor.slice(1)}`);
      }
    }
    // what their friends and rivals think of you
    else if (rand() < 0.2) {
      const day = this.host.clock.day();
      const said = standingLine(npcId, day, (o) => hearts(p.data.friends[o]?.pts ?? 0));
      if (said) text += ' ' + said;
    }
    // otherwise, now and then, talk about the neighbours or the kingdom's news
    else if (rand() < 0.3) {
      const g = this.gossip(r.def, rand);
      if (g) text += ' ' + g;
    }
    return this.message(p, r, rec, text, rumor ? { rumor } : {});
  }

  /** a neighbour, the kingdom's latest news, or what the settlement is short of today */
  private gossip(def: NpcDef, rand: () => number): string | null {
    const c = this.host.clock;
    const roll = rand();
    const day = c.day();
    // fresh news first: their own, then the village's
    const mine = tieNewsOn(def.id, day) ?? (roll < 0.35 ? tieGossipOn(def.id, day) : null);
    if (mine) return mine;
    if (roll < 0.5) return neighbourLine(def.id, c.hour(), c.weather(), rand(), day);
    const civ = civOf(this.host.seed);
    if (roll < 0.8 && civ) {
      const realm = def.realm as RealmId | undefined;
      const news = realm
        ? civ.kingdoms[realm].chronicle[0]
        : REALM_IDS.map((k) => civ.kingdoms[k].chronicle[0])
            .filter((n): n is NonNullable<typeof n> => !!n)
            .sort((a, b) => b.day - a.day)[0];
      if (news) return `${realm ? 'Have you heard?' : 'Travellers from over the sea say'} ${news.text}`;
    }
    if (def.site) {
      const e = localEconomy(this.host.seed, def.site, c.day());
      if (e) return `We're short of ${e.short} today; the shops here will pay well for them.`;
    }
    return null;
  }

  private ask(p: PlayerRef, r: Runner, rec: FriendRec, what: string): DialogueMsg {
    const v = voiceOf(r.def.id);
    const rand = this.host.rand;
    const menu: DialogueChoice[] = [
      { id: 'ask:about', text: 'Tell me about yourself.', kind: 'ask' },
      { id: 'ask:town', text: 'Tell me about this settlement.', kind: 'ask' },
      { id: 'ask:qubitman', text: 'Who is QubitMan?', kind: 'ask' },
      { id: 'ask:rumor', text: 'Heard any rumors?', kind: 'ask' },
      { id: 'ask:folk', text: 'Who are your neighbours?', kind: 'ask' },
      { id: 'back', text: "That's all.", kind: 'back' },
    ].filter((c) => c.id !== `ask:${what}`) as DialogueChoice[];
    let text = v ? pickOne(v.again, rand) : 'What would you like to know?';
    if (v) {
      if (what === 'about') text = v.about[tierOf(rec.pts)];
      else if (what === 'town') text = v.town;
      else if (what === 'qubitman') text = pickOne(v.qubitman, rand);
      else if (what === 'rumor') {
        const mine = this.rumors.heardBy(r.def.id).filter((x) => x.who !== p.name);
        text = mine.length
          ? fill(pickOne(v.rumorIn, rand), { rumor: mine[Math.floor(rand() * mine.length)]!.text })
          : v.noRumor;
      }
    }
    if (what === 'folk') text = neighboursText(r.def.id, this.host.clock.day());
    if (what === 'about' && tierOf(rec.pts) < 2)
      text +=
        tierOf(rec.pts) === 0
          ? '\n\n(Become better friends to learn more.)'
          : '\n\n(There is more to their story. Keep being a friend.)';
    return this.message(p, r, rec, text, { choices: menu });
  }

  private questTopic(p: PlayerRef, r: Runner, rec: FriendRec, id: string): DialogueMsg {
    const d = questDef(id, this.host.seed);
    const v = voiceOf(r.def.id);
    const back: DialogueChoice = { id: 'back', text: 'Maybe later.', kind: 'back' };
    if (!d || d.giver !== r.def.id) return this.message(p, r, rec, v ? pickOne(v.again, this.host.rand) : '…');
    const st = p.data.quests[id];
    const list = (prog: number[]) => d.objectives.map((o, i) => `• ${objectiveText(o, prog[i] ?? 0)}`).join('\n');
    if (!st) {
      if (!offerable(r.def.id, p.data.quests).some((x) => x.id === id))
        return this.message(p, r, rec, 'Not yet. Come back later.');
      const reward = `Reward: ${d.rewards.coins} coins${(d.rewards.items ?? []).map((s) => `, ${s.n} ${ITEMS[s.id]?.name}`).join('')}${d.rewards.recipe ? ', a recipe' : ''}`;
      return this.message(p, r, rec, d.lines.offer || d.summary, {
        pages: [`${list([])}\n\n${reward}`],
        choices: [{ id: `accept:${id}`, text: "I'll do it!", kind: 'accept' }, back],
      });
    }
    if (st.state === 'done') return this.message(p, r, rec, v ? pickOne(v.thanks, this.host.rand) : 'Thanks again!');
    if (questComplete(d, st))
      return this.message(p, r, rec, `${list(st.progress)}\n\nAll done! Ready to hand it over?`, {
        choices: [{ id: `turnin:${id}`, text: 'Here you go.', kind: 'turnin' }, back],
      });
    return this.message(p, r, rec, `${d.lines.progress || d.summary}\n\n${list(st.progress)}`, {
      choices: [{ id: 'back', text: "I'm on it.", kind: 'back' }],
    });
  }

  /** word of a kindness (or a slight) reaches the resident's friends, family and rivals */
  private spill(p: PlayerRef, npcId: string, delta: number): void {
    for (const s of tieSpill(npcId, this.host.clock.day(), delta)) {
      if (!NPC_BY_ID[s.npc]) continue;
      const o = this.friend(p, s.npc);
      o.pts = Math.max(0, Math.min(400, o.pts + s.delta));
    }
    p.dirty('friends');
  }

  private eventChoice(p: PlayerRef, r: Runner, rec: FriendRec, topic: string): DialogueMsg {
    const [, a, b] = topic.split(':');
    const idx = Number(a),
      ci = Number(b);
    const ev = pendingEvent(r.def.id, rec.pts, p.data.events ?? []);
    if (!ev || Number(ev.id.split(':')[1]) !== idx)
      return this.message(p, r, rec, voiceOf(r.def.id) ? pickOne(voiceOf(r.def.id)!.again, this.host.rand) : '…');
    const c = ev.ev.choices[ci];
    if (!c) return this.message(p, r, rec, '…');
    (p.data.events ??= []).push(ev.id);
    rec.pts = Math.min(400, rec.pts + c.pts);
    this.spill(p, r.def.id, c.pts);
    p.dirty('friends', 'quests');
    return this.message(p, r, rec, c.reply, { mood: 'happy', gift: undefined });
  }

  /** QUEST with a villager: accept an offer or hand in a finished job. */
  quest(p: PlayerRef, msg: QuestMsg): DialogueMsg | null {
    if (!msg || typeof msg.npcId !== 'string' || typeof msg.quest !== 'string') return null;
    const r = this.runnerFor(p, msg.npcId);
    if (!r) return null;
    const rec = this.friend(p, msg.npcId);
    const v = voiceOf(msg.npcId);
    const rand = this.host.rand;
    p.data.quests ??= {};
    this.freeze(r, p);
    const d = questDef(msg.quest, this.host.seed);
    if (!d || d.giver !== msg.npcId) return this.message(p, r, rec, "I don't know anything about that.");
    const today = this.host.clock.day();
    if (msg.action === 'accept') {
      if (d.daily)
        return this.message(
          p,
          r,
          rec,
          'Take it from the request board in the plaza, would you? Orla likes things done properly.',
        );
      const res = acceptQuest(p, msg.quest, today, this.host.seed);
      if (!res.ok) return this.message(p, r, rec, res.text);
      const st = p.data.quests[msg.quest]!;
      return this.message(
        p,
        r,
        rec,
        `${v ? pickOne(v.accept, rand) : 'Thank you!'}\n\n${d.objectives.map((o, i) => `• ${objectiveText(o, st.progress[i] ?? 0)}`).join('\n')}`,
        { mood: 'happy' },
      );
    }
    if (msg.action === 'turnin') {
      const res = turnInQuest(p, msg.quest, this.host.seed, today);
      if (!res.ok) return this.message(p, r, rec, res.text);
      return this.message(
        p,
        r,
        rec,
        `${d.lines.done || (v ? pickOne(v.thanks, rand) : 'Thank you!')}\n\n(Received: ${res.text})`,
        { mood: 'happy' },
      );
    }
    return null;
  }

  gift(p: PlayerRef, npcId: string, slot: number): DialogueMsg | null {
    const r = this.runnerFor(p, npcId);
    if (!r) return null;
    const day = this.host.clock.day();
    const rec = this.friend(p, npcId);
    const stack = Number.isInteger(slot) ? p.data.inv[slot] : null;
    if (!stack) {
      p.toast('Nothing to give.', 'bad');
      return this.message(p, r, rec, this.scriptedLine(p, r, rec, false), { gift: { taste: 'neutral', delta: 0 } });
    }
    this.freeze(r, p);
    if (rec.gifted === day)
      return this.message(p, r, rec, pickOne(r.def.lines.gift.again, this.host.rand), {
        gift: { taste: 'neutral', delta: 0 },
      });
    const taste = giftTaste(r.def, stack.id);
    const delta = GIFT_POINTS[taste];
    const itemName = ITEMS[stack.id]?.name ?? stack.id;
    stack.n -= 1;
    if (stack.n <= 0) p.data.inv[slot] = null;
    rec.pts = Math.max(0, Math.min(400, rec.pts + delta));
    this.spill(p, npcId, delta);
    rec.gifted = day;
    rec.lastGift = stack.id;
    p.dirty('inv', 'friends');
    p.data.quests ??= {};
    questEvent(p, { type: 'gift', target: npcId, n: 1 }, this.host.seed);
    syncQuests(p, this.host.seed);
    if (taste === 'love') {
      this.rumor('gift_love', p.name, r.def.name);
      p.data.deeds.gift_love = { day, what: r.def.name.split(' ')[0]! };
    }
    const pool = [
      ...r.def.lines.gift[taste],
      ...(GIFT_EXTRA[npcId]?.[taste] ?? []).map((t) => fill(t, { item: itemName.toLowerCase() })),
    ];
    const text = pickOne(pool, this.host.rand);
    return this.message(p, r, rec, text, {
      gift: { taste, delta },
      mood: taste === 'love' || taste === 'like' ? 'happy' : taste === 'hate' ? 'sad' : 'neutral',
    });
  }

  async chat(p: PlayerRef, msg: DialogueChatMsg): Promise<DialogueMsg | null> {
    if (!this.ai.enabled || !msg || typeof msg.npcId !== 'string') return null;
    const r = this.runnerFor(p, msg.npcId);
    if (!r) return null;
    const rec = this.friend(p, msg.npcId);
    const c = this.host.clock;
    this.freeze(r, p);
    const ai = await this.ai.reply(p.accountId, r.def, msg.text, {
      season: SEASONS[c.season()] ?? 'Spring',
      weather: c.weather(),
      hour: c.hour(),
      hearts: hearts(rec.pts),
      doing: this.blockAt(r.def, c.hour(), c.weather()).doing,
    });
    // any failure (disabled, rate limited, timeout, bad output) falls back to the scripted line
    return this.message(p, r, rec, ai ?? this.scriptedLine(p, r, rec, false));
  }

  // ───────────────────────── shops ─────────────────────────

  private canBuyKind(def: NpcDef, itemId: string): boolean {
    const kind = ITEMS[itemId]?.kind;
    const b = def.shop?.buys;
    return !!kind && !!b && (b.includes('all') || b.includes(kind));
  }

  /** price factor in a kingdom shop: standing, the season's diplomacy for foreign goods and festival cheer (1 elsewhere) */
  private realmFactor(p: PlayerRef | null, def: NpcDef, itemId: string): number {
    const realm = def.realm as RealmId | undefined;
    if (!realm) return 1;
    const day = this.host.clock.day();
    const origin = REALM_IDS.find((r) => r !== realm && KINGDOMS[r].economy.exports.includes(itemId));
    const trade = origin ? tradeModifier(this.host.seed, day, origin, realm) : 1;
    const rep = repPriceMultiplier(p?.data.rep?.[realm] ?? 0);
    // the kingdom's state: its decree, wars, prosperity and granaries (shared civ.ts)
    const civ = civPriceFactor(civOf(this.host.seed)?.kingdoms[realm], ITEMS[itemId]?.kind === 'food');
    // the settlement's own trade: what it makes is cheap, what it wants and today's shortage are dear
    const local = def.site ? localPriceFactor(localEconomy(this.host.seed, def.site, day), ITEMS[itemId]?.kind) : 1;
    return trade * rep * civ * local * (festivalOn(realm, day) ? 0.9 : 1);
  }

  private unitSell(def: NpcDef, itemId: string, extraSupply = 0, p: PlayerRef | null = null): number {
    const f = def.realm ? 1 / Math.max(0.7, this.realmFactor(p, def, itemId)) : 1;
    return Math.max(
      1,
      Math.floor(sellPrice(itemId, this.supply(itemId) + extraSupply) * (def.shop?.buyBonus ?? 1) * f),
    );
  }

  /** a realm resident only sells their better wares to those who stand well with their people */
  private standingOk(p: PlayerRef, def: NpcDef, s: ShopStock): boolean {
    return (
      !s.standing || !def.race || ((p.data.rep as Record<string, number | undefined>)[def.race] ?? 0) >= s.standing
    );
  }

  private view(p: PlayerRef, def: NpcDef): ShopViewMsg {
    const season = this.host.clock.season();
    const shop = def.shop;
    const sell: Record<number, number> = {};
    if (shop)
      p.data.inv.forEach((s, i) => {
        if (s && this.canBuyKind(def, s.id)) sell[i] = this.unitSell(def, s.id, 0, p);
      });
    const local = def.realm && def.site ? localEconomy(this.host.seed, def.site, this.host.clock.day()) : null;
    return {
      npcId: def.id,
      name: shop?.name ?? def.name,
      coins: p.data.coins,
      sell,
      note: local?.note,
      stock: (shop?.stock ?? [])
        .filter((s) => !s.seasons || s.seasons.includes(season))
        .filter((s) => this.standingOk(p, def, s))
        .map((s) => ({
          item: s.item,
          price: Math.max(1, Math.round(buyPrice(s.item, s.markup) * this.realmFactor(p, def, s.item))),
        })),
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
      else if (hearts(rec.pts) < 4)
        p.toast(`${def.name} will teach you once you are better friends (4 hearts).`, 'bad');
      else if (p.data.recipes.has(recipe.id)) p.toast('You already know that.', 'info');
      else {
        p.data.recipes.add(recipe.id);
        p.dirty('recipes');
        p.toast(`${def.name} taught you a recipe: ${ITEMS[recipe.out.id]?.name ?? recipe.id}!`, 'good');
      }
      return this.view(p, def);
    }
    if (!def.shop) return null;
    if (!shopOpen(def, this.host.clock.hour())) {
      p.toast(voiceOf(def.id)?.closed ?? 'The shop is closed.', 'info');
      return null;
    }
    if (msg.action === 'open') {
      this.freeze(r, p);
      return this.view(p, def);
    }
    const n = msg.n === undefined ? 1 : msg.n;
    if (!Number.isInteger(n) || n < 1 || n > 99) return this.view(p, def);
    if (msg.action === 'buy') {
      const season = this.host.clock.season();
      const entry = def.shop.stock.find(
        (s) => s.item === msg.item && (!s.seasons || s.seasons.includes(season)) && this.standingOk(p, def, s),
      );
      if (!entry) {
        p.toast('Not for sale right now.', 'bad');
        return this.view(p, def);
      }
      const cost =
        Math.max(1, Math.round(buyPrice(entry.item, entry.markup) * this.realmFactor(p, def, entry.item))) * n;
      if (p.data.coins < cost) {
        p.toast('You cannot afford that.', 'bad');
        return this.view(p, def);
      }
      const stack = { id: entry.item, n };
      if (!canAdd(p.data.inv, stack)) {
        p.toast('Your pack is full.', 'bad');
        return this.view(p, def);
      }
      addStack(p.data.inv, stack);
      p.data.coins -= cost;
      p.dirty('inv', 'coins');
      p.toast(`Bought ${n} ${ITEMS[entry.item]!.name} for ${cost}.`, 'good', stack);
      if (def.realm) gainRep(p, def.realm as RealmId, Math.max(1, Math.floor(cost / 30)), true);
      if (def.realm) recordCiv(this.host.seed, def.realm as RealmId, 'trade', cost);
      if (p.data.quests) syncQuests(p, this.host.seed);
      return this.view(p, def);
    }
    if (msg.action === 'sell') {
      const stack = Number.isInteger(msg.slot) ? p.data.inv[msg.slot as number] : null;
      if (!stack || stack.n < n) {
        p.toast('You do not have that many.', 'bad');
        return this.view(p, def);
      }
      if (!this.canBuyKind(def, stack.id)) {
        p.toast(`${def.name} is not interested in that.`, 'bad');
        return this.view(p, def);
      }
      let total = 0;
      for (let i = 0; i < n; i++) total += this.unitSell(def, stack.id, i, p); // price slides as the market saturates
      const id = stack.id;
      stack.n -= n;
      if (stack.n <= 0) p.data.inv[msg.slot as number] = null;
      p.data.coins += total;
      this.market[id] = (this.market[id] ?? 0) + n;
      this.marketDirty = true;
      p.dirty('inv', 'coins');
      p.toast(`Sold ${n} ${ITEMS[id]!.name} for ${total}.`, 'good');
      // a realm people welcomes their enemies' tokens: standing as well as coin
      if (def.race && isRace(def.race) && RACES[def.race].token === id) gainStanding(p, def.race, STANDING.token * n);
      if (def.realm) gainRep(p, def.realm as RealmId, Math.max(1, Math.floor(total / 40)), true);
      if (def.realm) recordCiv(this.host.seed, def.realm as RealmId, 'trade', total);
      if (p.data.quests) {
        questEvent(p, { type: 'sell', target: id, n }, this.host.seed);
        syncQuests(p, this.host.seed);
        if (p.data.deeds) p.data.deeds.sell = { day: this.host.clock.day(), what: ITEMS[id]!.name };
      }
      return this.view(p, def);
    }
    return this.view(p, def);
  }
}

const pickOne = (a: readonly string[], rand: () => number): string => a[Math.floor(rand() * a.length)]!;

export function createVillage(host: VillageHost, opts?: VillageOptions): Village {
  return new Village(host, opts);
}
