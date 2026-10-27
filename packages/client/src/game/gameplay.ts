import { buildSettlement } from '../ui/settlement';
import { buildGuild } from '../ui/guild';
import type { EquipMsg } from '@eigenlands/shared';
import {
  BUILD_PIECES,
  isBuildPiece,
  CROPS,
  ITEMS,
  MSG,
  NPC_BY_ID,
  STATION_NAMES,
  dayNumber,
  gameHour,
  weatherForDay,
  type ChunkStore,
  type DialogueMsg,
  type FishBiteMsg,
  type PanelMsg,
  type ProfileMsg,
  type RhythmResultMsg,
  type RhythmStartMsg,
  type ShopViewMsg,
  type StationId,
  type Stack,
  type ToastMsg,
  type Template,
} from '@eigenlands/shared';
import type { Audio, Sfx } from '../audio';
import type { Input } from '../input/input';
import type { ServerClock } from '../net/interp';
import type { Net } from '../net/session';
import { MSG_TRAVEL, sanctuaryAt } from '@eigenlands/shared';
import { FIRST_STEPS, buildFirstSteps, controlText, binding } from '../ui/first-steps';
import { TUTORIAL, freshActs, type Acts } from '../ui/ui';
import { buildChest, buildShelter, buildSign } from '../ui/containers';
import { buildDialogue } from '../ui/dialogue';
import { Tooltip, h } from '../ui/dom';
import { buildForge } from '../ui/forge';
import { Hotbar } from '../ui/hotbar';
import { buildInventory } from '../ui/inventory';
import { buildJourney, type JourneyInfo } from '../ui/journey';
import { buildJournal } from '../ui/journal';
import { RhythmOverlay } from '../ui/rhythm';
import { buildShop } from '../ui/shop';
import { VillageOverlay, type NpcScreen } from '../ui/overlay';
import { buildBoard, buildLore } from '../ui/village';
import { buildTravel } from '../ui/travel';
import { buildStation } from '../ui/station';
import { Toasts } from '../ui/toast';
import { Moments } from '../ui/moments';
import { Windows } from '../ui/windows';
import { Profile } from './profile';
import { describeUse, fishingTarget, targetTile, type UseInfo } from './targeting';

export interface GameplayDeps {
  net: () => Net;
  ridingMount?: () => boolean;
  ridingCart?: () => boolean;
  /** a road caravan in trading reach */
  caravanNear?: () => { id: string; name: string } | null;
  clock: ServerClock;
  audio: Audio;
  input: Input;
  store: () => ChunkStore;
  season: () => number;
  portrait: (npcId: string) => string;
  selfPortrait: () => HTMLElement;
  /** nearest NPC to a world point (tile units) within `max` tiles */
  npcNear: (x: number, y: number, max: number) => { id: string; x: number; y: number } | null;
  player: () => { x: number; y: number; fx: number; fy: number };
  sfx: (s: Sfx) => void;
  features: () => { aiDialogue: boolean };
  /** Phase 2 village overlay: world seed, NPC screen positions, reduced motion (optional so other hosts can omit them) */
  guidance?: () => string | null;
  journey?: () => JourneyInfo | null;
  openBoard?: () => void;
  openParty?: () => void;
  trackQuest?: (id: string | null, map?: boolean) => void;
  trackedQuest?: () => string | null;
  seed?: () => number;
  npcScreens?: () => NpcScreen[];
  reduced?: () => boolean;
}

const REPEATABLE = new Set(['tool', 'till', 'water', 'refill', 'net', 'forage', 'harvest']);
const MINING = new Set(['stone', 'coal', 'copper_ore', 'iron_ore', 'silver_ore', 'gold_ore', 'qubit_crystal']);

/** Turns network messages into windows and player intent into messages. No rendering. */
export class Gameplay {
  readonly profile = new Profile();
  readonly tip = new Tooltip();
  readonly wins = new Windows();
  readonly toasts = new Toasts();
  readonly moments = new Moments();
  readonly hotbar: Hotbar;
  readonly rhythm: RhythmOverlay;
  readonly village: VillageOverlay;
  acts: Acts = freshActs();
  fishing: { id: string; tx: number; ty: number; bite: boolean; until: number } | null = null;
  private done = new Set<string>();
  private lastUse = 0;
  private dialogueMsg: DialogueMsg | null = null;
  private chestUi: { el: HTMLElement; setChest(c: import('@eigenlands/shared').Slot[]): void } | null = null;
  private chestAt: { tx: number; ty: number } | null = null;
  private bang: HTMLElement | null = null;
  private hotbarName = h('div', { id: 'hotbar-name' });
  private targetHint = h('div', { id: 'target-hint' });
  buildRotation = 0;
  private rotateBuild = h('button', {
    id: 'build-rotate',
    text: 'Rotate · 1',
    on: {
      click: () => {
        this.buildRotation = (this.buildRotation + 1) % 4;
        this.rotateBuild.textContent = `Rotate · ${this.buildRotation + 1}`;
      },
    },
  });
  private hotbarNameTimer = 0;
  private journey: ReturnType<typeof buildJourney> | null = null;
  private journeyAt = 0;
  private tutorialKey = '';
  private firstSteps: ReturnType<typeof buildFirstSteps>;

  constructor(private d: GameplayDeps) {
    this.toasts.moments = this.moments;
    this.rotateBuild.hidden = true;
    for (const type of ['keydown', 'keyup'])
      this.rotateBuild.addEventListener(type, (e) => {
        if ([' ', 'Enter'].includes((e as KeyboardEvent).key)) e.stopPropagation();
      });
    this.hotbar = new Hotbar(this.profile, this.tip);
    this.village = new VillageOverlay(this.profile);
    this.rhythm = new RhythmOverlay(
      () => d.clock,
      d.audio,
      (id, hits) => d.net().rhythmDone(id, hits),
    );
    document.body.append(this.hotbar.el, this.hotbarName, this.targetHint, this.rotateBuild);
    this.firstSteps = buildFirstSteps(
      () => ({ done: this.done, keys: this.d.input.keys }),
      () => {
        this.d.trackQuest?.('@arrival', true);
      },
    );

    this.hotbar.onSelect = () => {
      try {
        this.d.net().send(MSG.HOLD, { slot: this.hotbar.selected });
      } catch {
        /* not connected yet */
      }
      this.acts.selected = true;
      this.showHotbarName();
    };
    this.hotbar.onMove = (from, to) => this.d.net().invMove({ from, to });
    d.input.onHotbar = (i) => this.hotbar.select(i);
    d.input.onCycle = (dir) => {
      if (!this.blocking) this.hotbar.cycle(dir);
    };
    d.input.onPanel = (a) => {
      if (this.rhythm.open) return;
      if (a === 'inventory') this.toggleInventory();
      else if (a === 'journal') this.toggleJournal();
      else this.toggleFieldCraft();
    };
    this.profile.onChange((c) => {
      if (c.has('inv')) this.showHotbarNameSoft();
    });
  }

  onWelcome(identity: string, seed: number): void {
    const key = `eigen.onboarding:${identity}:${seed}`;
    if (key === this.tutorialKey) return;
    this.tutorialKey = key;
    this.done = new Set();
    this.acts = freshActs();
    try {
      const raw = localStorage.getItem(key);
      if (!raw)
        this.toasts.add(
          'New here? Journal → Quests has First steps to Hadamere, with controls and a route to town.',
          'info',
        );
      const saved = JSON.parse(raw ?? '[]');
      if (Array.isArray(saved))
        for (const id of saved)
          if (typeof id === 'string' && [...FIRST_STEPS, ...TUTORIAL].some((s) => s.id === id)) this.done.add(id);
    } catch {
      /* usable without storage */
    }
  }

  get blocking(): boolean {
    return this.wins.open || this.rhythm.open;
  }
  selected(): Stack | null {
    return this.profile.inv[this.hotbar.selected] ?? null;
  }

  // ───────── windows ─────────
  private inventoryActions() {
    const net = () => this.d.net();
    return {
      move: (from: number, to: number) => net().invMove({ from, to }),
      trash: (slot: number, n: number) => net().invTrash({ slot, n }),
      equip: (slot: number, as: EquipMsg['as']) => net().equip({ slot, as }),
      use: (slot: number) => {
        const p = this.d.player();
        net().use({ slot, tx: Math.floor(p.x), ty: Math.floor(p.y) });
      },
    };
  }

  toggleInventory(): void {
    if (this.wins.name === 'inv') {
      this.wins.close();
      return;
    }
    this.acts.openedPack = true;
    this.wins.show(
      'inv',
      'Pack',
      buildInventory(this.profile, this.tip, this.inventoryActions(), this.d.selfPortrait),
      { wide: true },
    );
  }
  toggleJournal(): void {
    if (this.wins.name === 'journal') {
      this.wins.close();
      return;
    }
    this.acts.journal = true;
    this.journey = this.d.journey
      ? buildJourney(this.d.journey, () => {
          this.wins.close();
          this.d.openBoard?.();
        })
      : null;
    this.wins.show(
      'journal',
      'Journal',
      buildJournal(
        this.profile,
        this.d.portrait,
        'quests',
        this.d.seed?.() ?? 0,
        () =>
          [FIRST_STEPS.every((s) => this.done.has(s.id)) ? this.tutorialHint() : null, this.d.guidance?.()]
            .filter(Boolean)
            .join('\n\n') || null,
        this.journey?.el,
        {
          keys: () => this.d.input.keys,
          firstSteps: this.firstSteps.el,
          track: (id, map) => this.d.trackQuest?.(id, map),
          tracked: () => this.d.trackedQuest?.() ?? null,
          travelMode: (mode) => this.d.net().send(MSG.TRAVEL_MODE, { mode }),
        },
      ),
      { wide: true },
    );
  }
  toggleFieldCraft(): void {
    if (this.wins.name === 'hand') {
      this.wins.close();
      return;
    }
    const p = this.d.player();
    this.wins.show(
      'hand',
      STATION_NAMES.hand,
      buildStation('hand', this.profile, this.tip, {
        craft: (recipe, n) =>
          this.d.net().craft({ station: 'hand', tx: Math.floor(p.x), ty: Math.floor(p.y), recipe, n }),
        experiment: (items) =>
          this.d.net().experiment({ station: 'hand', tx: Math.floor(p.x), ty: Math.floor(p.y), items }),
      }),
      { wide: true },
    );
  }

  // ───────── server messages ─────────
  onProfile(m: ProfileMsg): void {
    const before = new Map<string, number>();
    for (const s of this.profile.inv) if (s) before.set(s.id, (before.get(s.id) ?? 0) + s.n);
    const coins0 = this.profile.coins,
      recipes0 = this.profile.recipes.size,
      loaded = this.profile.loaded;
    this.profile.apply(m);
    if (Object.keys(this.profile.quests).length) this.acts.quest = true;
    if (!loaded) return;
    const gained = (id: string) => this.profile.count(id) > (before.get(id) ?? 0);
    for (const s of this.profile.inv) {
      if (!s || !gained(s.id)) continue;
      const k = ITEMS[s.id]?.kind;
      if (s.id === 'wood') this.acts.chopped = true;
      if (MINING.has(s.id)) this.acts.mined = true;
      if (k === 'crop') this.acts.harvested = true;
      if (k === 'fish') this.acts.fished = true;
    }
    if (this.profile.coins > coins0) this.d.sfx('coin');
    if (this.profile.recipes.size > recipes0) this.acts.crafted = true;
    if (this.profile.coins > coins0 && this.wins.name === 'shop') this.acts.sold = true;
  }

  onPanel(m: PanelMsg): void {
    const net = this.d.net();
    if (m.kind === 'station') {
      const st = (m.station ?? 'workbench') as StationId;
      if (st === 'forge') {
        const patterns = buildStation('forge', this.profile, this.tip, {
          craft: (recipe, n) => {
            net.craft({ station: st, tx: m.tx, ty: m.ty, recipe, n });
            this.acts.crafted = true;
          },
          gear: (action, ref, rune) =>
            net.gear({ action, station: st, tx: m.tx, ty: m.ty, ref, ...(rune !== undefined ? { rune } : {}) }),
        });
        const alloy = buildForge(this.profile, this.tip, {
          start: (template: Template, slots: number[]) => net.forgeStart({ tx: m.tx, ty: m.ty, template, slots }),
        });
        const book = h('details', {}, h('summary', { text: 'Weapon patterns' }), patterns);
        book.open = true;
        this.wins.show(
          'forge',
          STATION_NAMES.forge,
          h(
            'div',
            { class: 'forge-workshop' },
            book,
            h('details', {}, h('summary', { text: 'Interference forging · swords & tools' }), alloy),
          ),
          { wide: true },
        );
      } else {
        this.wins.show(
          `station:${st}`,
          STATION_NAMES[st] ?? 'Station',
          buildStation(st, this.profile, this.tip, {
            craft: (recipe, n) => {
              net.craft({ station: st, tx: m.tx, ty: m.ty, recipe, n });
              this.acts.crafted = true;
            },
            experiment: (items) => net.experiment({ station: st, tx: m.tx, ty: m.ty, items }),
            gear: (action, ref, rune) =>
              net.gear({ action, station: st, tx: m.tx, ty: m.ty, ref, ...(rune !== undefined ? { rune } : {}) }),
          }),
          { wide: true },
        );
      }
    } else if (m.kind === 'chest') {
      if (this.wins.name === 'chest' && this.chestAt?.tx === m.tx && this.chestAt?.ty === m.ty && this.chestUi) {
        this.chestUi.setChest(m.chest ?? []);
        return;
      }
      this.chestAt = { tx: m.tx, ty: m.ty };
      this.chestUi = buildChest(m, this.profile, this.tip, {
        put: (slot, n) => net.chest({ tx: m.tx, ty: m.ty, action: 'put', slot, n }),
        take: (slot, n) => net.chest({ tx: m.tx, ty: m.ty, action: 'take', slot, n }),
      });
      this.wins.show('chest', 'Chest', this.chestUi.el, {
        wide: true,
        onClose: () => {
          this.chestUi = null;
          this.chestAt = null;
        },
      });
    } else if (m.kind === 'shelter') {
      const render = () =>
        buildShelter(m, this.profile, {
          ranch: (action, id) => net.send('ranch', { action, id, tx: m.tx, ty: m.ty }),
          add: () => net.shelter({ tx: m.tx, ty: m.ty, action: 'add' }),
          feed: () => net.shelter({ tx: m.tx, ty: m.ty, action: 'feed' }),
          collect: () => net.shelter({ tx: m.tx, ty: m.ty, action: 'collect' }),
          buy: (species) => net.shelter({ tx: m.tx, ty: m.ty, action: 'buy', species }),
          care: () => net.shelter({ tx: m.tx, ty: m.ty, action: 'care' }),
          breed: (species) => net.shelter({ tx: m.tx, ty: m.ty, action: 'breed', species }),
        });
      if (this.wins.name === 'shelter') this.wins.update('shelter', render());
      else this.wins.show('shelter', m.shelter?.name ?? 'Shelter', render());
    } else if (m.kind === 'travel' && m.travel) {
      const here = m.travel.here.id;
      const body = buildTravel(m.travel, {
        go: (to) => {
          net.send(MSG_TRAVEL.GO, { from: here, to });
          this.wins.close();
        },
        bind: () => net.send(MSG_TRAVEL.GO, { from: here, bind: true }),
        rename: (kind, name) => net.send(MSG_TRAVEL.GO, { from: here, rename: { kind, name } }),
        feed: (kind) => net.send(MSG_TRAVEL.GO, { from: here, feed: kind }),
        stable: (kind) => net.send(MSG_TRAVEL.GO, { from: here, stable: kind }),
      });
      if (this.wins.name === 'travel') this.wins.update('travel', body);
      else {
        this.wins.show('travel', 'Waystone', body);
        // gamepads and keyboards land on the first journey they can take
        body.querySelector<HTMLButtonElement>('.travel-row button.primary')?.focus();
      }
    } else if (m.kind === 'lore' && m.lore) {
      this.acts.statue = true;
      this.wins.show('lore', m.lore.title, buildLore(m, this.d.portrait));
    } else if (m.kind === 'board' && m.board) {
      this.acts.board = true;
      const el = buildBoard(m, this.profile, this.d.portrait, {
        accept: (id) => net.send(MSG.QUEST, { npcId: 'board', quest: id, action: 'accept' }),
        turnin: (id) => net.send(MSG.QUEST, { npcId: 'board', quest: id, action: 'turnin' }),
      });
      if (this.wins.name === 'board') this.wins.update('board', el);
      else this.wins.show('board', 'Hadamere Request Board', el, { wide: true });
    } else if (m.kind === 'settlement' && m.settlement) {
      const body = buildSettlement(m, (action, extra = {}) =>
        net.send('settlement', { tx: m.tx, ty: m.ty, action, ...extra }),
      );
      if (this.wins.name === 'settlement') this.wins.update('settlement', body);
      else this.wins.show('settlement', 'Settlement charter', body, { wide: true });
    } else if (m.kind === 'journey' && m.journey) {
      const j = m.journey,
        body = h('div', { class: 'guild-ledger' }, h('p', { text: j.text }));
      for (const c of j.choices)
        body.append(
          h('button', {
            text: c.label,
            on: { click: () => net.send('guild_journey', { id: j.id, action: 'choose', choice: c.id }) },
          }),
        );
      this.wins.show('journey', j.title, body);
    } else if (m.kind === 'guild' && m.guild) {
      const el = buildGuild(
        m,
        (quest, action) => net.send(MSG.QUEST, { npcId: 'guild', quest, action, tx: m.tx, ty: m.ty }),
        {
          settlement: () => net.send('settlement', { tx: m.tx, ty: m.ty, action: 'inspect' }),
          classes: () => {
            this.wins.close();
            this.d.openBoard?.();
          },
          party: () => {
            this.wins.close();
            this.d.openParty?.();
          },
        },
      );
      if (this.wins.name === 'guild') this.wins.update('guild', el);
      else this.wins.show('guild', 'Adventurer Guild', el, { wide: true });
    } else if (m.kind === 'sign') this.wins.show('sign', 'Sign', buildSign(m));
  }

  onDialogue(m: DialogueMsg): void {
    this.acts.talked = true;
    this.dialogueMsg = m;
    const net = this.d.net();
    const el = buildDialogue(
      { ...m, canChat: m.canChat && this.d.features().aiDialogue },
      this.d.portrait(m.npcId),
      this.profile,
      this.tip,
      {
        talk: (id, topic) => net.send(MSG.TALK, { npcId: id, topic }),
        quest: (id, quest, action) => net.send(MSG.QUEST, { npcId: id, quest, action }),
        shop: (id) => net.shop({ npcId: id, action: 'open' }),
        gift: (id, slot) => net.gift(id, slot),
        learn: (id, recipe) => net.shop({ npcId: id, action: 'learn', item: recipe }),
        chat: (id, text) => net.chat({ npcId: id, text }),
        close: () => this.wins.close(),
      },
      {
        reduced: this.d.reduced?.() ?? false,
        interactKeys: this.d.input.keys.interact,
        text: (text) => text.replace(/\bE\b/g, binding(this.d.input.keys, 'interact')),
      },
    );
    if (this.wins.name === `dialogue:${m.npcId}`) this.wins.update(`dialogue:${m.npcId}`, el);
    else this.wins.show(`dialogue:${m.npcId}`, NPC_BY_ID[m.npcId]?.name ?? 'Villager', el);
  }

  onShopView(v: ShopViewMsg): void {
    const net = this.d.net();
    const el = buildShop(v, this.profile, this.tip, {
      buy: (item, n) => net.shop({ npcId: v.npcId, action: 'buy', item, n }),
      sell: (slot, n) => net.shop({ npcId: v.npcId, action: 'sell', slot, n }),
      job: () => net.shop({ npcId: v.npcId, action: 'job' }),
    });
    if (this.wins.name === 'shop') this.wins.update('shop', el);
    else this.wins.show('shop', v.name, el, { wide: true });
  }

  onRhythmStart(m: RhythmStartMsg): void {
    this.wins.close();
    this.fishing = null;
    this.clearBang();
    this.rhythm.start(m);
  }
  onRhythmResult(m: RhythmResultMsg): void {
    this.rhythm.result(m);
    if (m.kind === 'forge' && m.ok) this.acts.forged = true;
    if (m.kind === 'fish' && m.ok) this.acts.fished = true;
  }

  onFishCast(m: { id: string; tx: number; ty: number }): void {
    this.fishing = { id: m.id, tx: m.tx, ty: m.ty, bite: false, until: performance.now() + 30000 };
    this.d.sfx('splash');
    this.toasts.add(`Line cast… wait for a bite, then press ${binding(this.d.input.keys, 'interact')}!`, 'info');
  }
  onFishBite(m: FishBiteMsg): void {
    if (!this.fishing || this.fishing.id !== m.id) this.fishing = { id: m.id, tx: 0, ty: 0, bite: true, until: 0 };
    this.fishing.bite = true;
    this.fishing.until = performance.now() + m.windowMs;
    this.d.sfx('bite');
    this.clearBang();
    this.bang = h('div', { class: 'cast-bang', text: '!' });
    document.body.append(this.bang);
    setTimeout(() => this.clearBang(), m.windowMs);
  }
  private clearBang(): void {
    this.bang?.remove();
    this.bang = null;
  }

  onToast(m: ToastMsg): void {
    this.toasts.add(m.text, m.kind, m.item);
    if (m.kind === 'item') this.d.sfx('pickup');
  }

  // ───────── player intent ─────────
  /** Bound interaction key / touch USE. Returns true if something was sent. */
  interact(): boolean {
    if (this.blocking) return false;
    const net = this.d.net();
    const p = this.d.player();
    if (this.fishing?.bite && performance.now() < this.fishing.until + 150) {
      net.fishHook(this.fishing.id);
      this.fishing.bite = false;
      this.clearBang();
      return true;
    }
    const store = this.d.store();
    if (this.d.ridingMount?.()) {
      net.send('ranch', { action: 'dismount' });
      return true;
    }
    if (this.d.ridingCart?.()) {
      net.open(Math.floor(p.x), Math.floor(p.y));
      return true;
    }
    const caravan = this.d.caravanNear?.();
    if (caravan) {
      net.shop({ npcId: `caravan:${caravan.id}`, action: 'open' });
      return true;
    }
    const selection = this.selected();
    if (selection && ITEMS[selection.id]?.tool?.type === 'rod') {
      if (this.fishing) {
        this.toasts.add('Wait for the bite, then press ' + binding(this.d.input.keys, 'interact') + '.', 'info');
        return true;
      }
      const water = fishingTarget(
        p.x,
        p.y,
        (x, y) => store.getTile(x, y),
        this.d.input.mouseActive ? this.d.input.mouseTile : null,
      );
      if (water) {
        this.lastUse = performance.now();
        net.use({ slot: this.hotbar.selected, ...water });
        return true;
      }
    }
    const modifying = selection && (isBuildPiece(selection.id) || ITEMS[selection.id]?.tool?.type === 'pickaxe');
    const builtUnder = store.structureAt(Math.floor(p.x), Math.floor(p.y));
    if (!modifying && builtUnder?.data.stairs) {
      net.open(builtUnder.x, builtUnder.y);
      return true;
    }
    const under = store.objectAt(Math.floor(p.x), Math.floor(p.y));
    if (
      under &&
      (['stairs_up', 'stairs_down', 'dive_exit'].includes(under.sub) ||
        (under.sub === 'shrine_pillar' && under.data?.type === 'platform'))
    ) {
      net.open(under.x, under.y);
      return true;
    }
    const npc = this.d.npcNear(p.x + p.fx * 0.8, p.y + p.fy * 0.8, 1.9) ?? this.d.npcNear(p.x, p.y, 1.3);
    if (npc) {
      net.talk(npc.id);
      return true;
    }
    const mouse = this.d.input.mouseActive ? this.d.input.mouseTile : null;
    const t = targetTile(p.x, p.y, p.fx, p.fy, mouse);
    const sel = this.selected();
    const info = describeUse(
      sel,
      store.getTile(t.tx, t.ty),
      store.objectAt(t.tx, t.ty),
      this.d.season(),
      store.structureAt(t.tx, t.ty),
    );
    if (info?.kind === 'open') {
      net.open(t.tx, t.ty);
      return true;
    }
    if (!info || info.kind === 'none') {
      // nothing to do at the target: open a station / chest right next to us if there is one
      for (const reach of [0.9, 1.5]) {
        const tx = Math.floor(p.x + p.fx * reach),
          ty = Math.floor(p.y + p.fy * reach + 0.2);
        const o = store.objectAt(tx, ty);
        if (
          o &&
          (o.kind === 'station' ||
            o.kind === 'chest' ||
            o.kind === 'shelter' ||
            o.kind === 'sign' ||
            ['statue', 'guild_board', 'guild_noticeboard', 'bed', 'double_bed', 'canopy_bed', 'hammock'].includes(
              o.sub,
            ))
        ) {
          net.open(tx, ty);
          return true;
        }
      }
    }
    this.lastUse = performance.now();
    net.use({ slot: this.hotbar.selected, tx: t.tx, ty: t.ty, turn: this.buildRotation });
    if (info?.kind === 'till') this.acts.tilled = true;
    if (info?.kind === 'plant') this.acts.planted = true;
    if (info?.kind === 'water') this.acts.watered = true;
    return true;
  }

  /** While the interaction key is held: repeat tool swings at ~3/s. */
  holdUse(now: number): void {
    if (this.blocking || !this.d.input.interactHeld || now - this.lastUse < 320) return;
    const p = this.d.player();
    const store = this.d.store();
    const mouse = this.d.input.mouseActive ? this.d.input.mouseTile : null;
    const t = targetTile(p.x, p.y, p.fx, p.fy, mouse);
    const info = describeUse(
      this.selected(),
      store.getTile(t.tx, t.ty),
      store.objectAt(t.tx, t.ty),
      this.d.season(),
      store.structureAt(t.tx, t.ty),
    );
    if (info && REPEATABLE.has(info.kind) && info.ok) this.interact();
  }

  /** Prompt + target for the tile highlight. */
  prompt(): { info: UseInfo | null; tx: number; ty: number; label: string | null } {
    const p = this.d.player();
    const store = this.d.store();
    if (this.d.ridingMount?.())
      return {
        info: null,
        tx: Math.floor(p.x),
        ty: Math.floor(p.y),
        label: `${binding(this.d.input.keys, 'interact')}: Dismount`,
      };
    if (this.d.ridingCart?.())
      return {
        info: { kind: 'open', label: 'Step off the minecart', ok: true },
        tx: Math.floor(p.x),
        ty: Math.floor(p.y),
        label: `${binding(this.d.input.keys, 'interact')}: Step off · hold movement to ride`,
      };
    const wagon = this.d.caravanNear?.();
    if (wagon)
      return {
        info: { kind: 'talk', label: `Trade at the ${wagon.name}`, ok: true },
        tx: Math.floor(p.x),
        ty: Math.floor(p.y),
        label: `${binding(this.d.input.keys, 'interact')}: Trade at the ${wagon.name}`,
      };
    const npc = this.d.npcNear(p.x + p.fx * 0.8, p.y + p.fy * 0.8, 1.9) ?? this.d.npcNear(p.x, p.y, 1.3);
    const mouse = this.d.input.mouseActive ? this.d.input.mouseTile : null;
    const t = targetTile(p.x, p.y, p.fx, p.fy, mouse);
    if (this.fishing?.bite) return { info: null, ...t, label: `Press ${binding(this.d.input.keys, 'interact')} now!` };
    if (ITEMS[this.selected()?.id ?? '']?.tool?.type === 'rod') {
      const water = fishingTarget(p.x, p.y, (x, y) => store.getTile(x, y), mouse);
      if (water)
        return {
          info: { kind: 'cast', label: 'Cast your line', ok: true },
          ...water,
          label: `${binding(this.d.input.keys, 'interact')}: ${this.fishing ? 'Wait for a bite' : 'Cast your line'}`,
        };
    }
    if (npc)
      return {
        info: { kind: 'talk', label: `Talk to ${NPC_BY_ID[npc.id]?.name ?? 'villager'}`, ok: true },
        tx: Math.floor(npc.x),
        ty: Math.floor(npc.y),
        label: `${binding(this.d.input.keys, 'interact')}: Talk to ${NPC_BY_ID[npc.id]?.name ?? 'villager'}`,
      };
    const info = describeUse(
      this.selected(),
      store.getTile(t.tx, t.ty),
      store.objectAt(t.tx, t.ty),
      this.d.season(),
      store.structureAt(t.tx, t.ty),
    );
    return { info, ...t, label: info ? `${binding(this.d.input.keys, 'interact')}: ${info.label}` : null };
  }

  setHint(text: string | null, ok = true): void {
    const selected = this.selected();
    this.rotateBuild.hidden =
      this.blocking || !selected || !isBuildPiece(selected.id) || BUILD_PIECES[selected.id].layer === 'floor';
    this.targetHint.textContent = text ?? '';
    this.targetHint.style.color = ok ? '#f4f4ff' : '#f07a4a';
  }

  private showHotbarName(): void {
    this.hotbarName.textContent = this.hotbar.selectedName();
    this.hotbarName.style.opacity = '1';
    clearTimeout(this.hotbarNameTimer);
    this.hotbarNameTimer = window.setTimeout(() => {
      this.hotbarName.style.opacity = '0';
    }, 1800);
  }
  private showHotbarNameSoft(): void {
    if (this.hotbarName.style.opacity === '1') this.hotbarName.textContent = this.hotbar.selectedName();
  }

  /** Next tutorial hint, or null when done. */
  tutorialHint(): string | null {
    let changed = false;
    const town = sanctuaryAt(this.d.seed?.() ?? 0, this.d.player().x, this.d.player().y);
    if (town?.name === 'Hadamere') this.acts.arrived = true;
    for (const step of [...FIRST_STEPS, ...TUTORIAL])
      if (this.acts[step.id] && !this.done.has(step.id)) {
        this.done.add(step.id);
        changed = true;
      }
    if (changed && this.tutorialKey)
      try {
        localStorage.setItem(this.tutorialKey, JSON.stringify([...this.done]));
      } catch {
        /* progress stays usable in memory */
      }
    const step = [...FIRST_STEPS, ...TUTORIAL].find((step) => !this.done.has(step.id));
    return step ? controlText(step.text, this.d.input.keys) : null;
  }

  describeCrop(id: string): string {
    return CROPS[id]?.name ?? id;
  }

  /** Per-frame screen-space village overlay (quest markers, chatter bubbles). */
  frame(now: number): void {
    if (this.fishing) {
      const p = this.d.player();
      if (
        Math.hypot(p.x - this.fishing.tx - 0.5, p.y - this.fishing.ty - 0.5) > 6 ||
        (this.fishing.until > 0 && now > this.fishing.until + 350)
      ) {
        this.fishing = null;
        this.clearBang();
      }
    }

    if (this.wins.name === 'journal' && this.journey?.el.isConnected && now - this.journeyAt > 200) {
      this.journeyAt = now;
      this.journey.refresh();
    }
    if (this.wins.name === 'journal') this.firstSteps.refresh();
    const seed = this.d.seed?.() ?? 0;
    const sn = this.d.clock.serverNow(now);
    const p = this.d.player();
    this.village.frame(now, {
      npcs: this.d.npcScreens?.() ?? [],
      me: { x: p.x, y: p.y },
      hour: gameHour(sn),
      weather: weatherForDay(seed, dayNumber(sn)),
      seed,
      hidden: this.blocking || !this.profile.loaded,
      reduced: this.d.reduced?.() ?? false,
    });
  }
}
