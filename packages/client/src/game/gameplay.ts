import {
  CROPS, ITEMS, MSG, NPC_BY_ID, STATION_NAMES, dayNumber, gameHour, weatherForDay, type ChunkStore, type DialogueMsg, type FishBiteMsg, type PanelMsg, type ProfileMsg, type RhythmResultMsg,
  type RhythmStartMsg, type ShopViewMsg, type StationId, type Stack, type ToastMsg, type Template,
} from '@eigenlands/shared';
import type { Audio, Sfx } from '../audio';
import type { Input } from '../input/input';
import type { ServerClock } from '../net/interp';
import type { Net } from '../net/session';
import { TUTORIAL, freshActs, type Acts } from '../ui/ui';
import { buildChest, buildShelter, buildSign } from '../ui/containers';
import { buildDialogue } from '../ui/dialogue';
import { Tooltip, h } from '../ui/dom';
import { buildForge } from '../ui/forge';
import { Hotbar } from '../ui/hotbar';
import { buildInventory } from '../ui/inventory';
import { buildJournal } from '../ui/journal';
import { RhythmOverlay } from '../ui/rhythm';
import { buildShop } from '../ui/shop';
import { VillageOverlay, type NpcScreen } from '../ui/overlay';
import { buildBoard, buildLore } from '../ui/village';
import { buildStation } from '../ui/station';
import { Toasts } from '../ui/toast';
import { Windows } from '../ui/windows';
import { Profile } from './profile';
import { describeUse, targetTile, type UseInfo } from './targeting';

export interface GameplayDeps {
  net: () => Net;
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
  seed?: () => number;
  npcScreens?: () => NpcScreen[];
  reduced?: () => boolean;
}

const REPEATABLE = new Set(['tool', 'till', 'water', 'net', 'forage', 'harvest']);
const MINING = new Set(['stone', 'coal', 'copper_ore', 'iron_ore', 'silver_ore', 'gold_ore', 'qubit_crystal']);

/** Turns network messages into windows and player intent into messages. No rendering. */
export class Gameplay {
  readonly profile = new Profile();
  readonly tip = new Tooltip();
  readonly wins = new Windows();
  readonly toasts = new Toasts();
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
  private hotbarNameTimer = 0;

  constructor(private d: GameplayDeps) {
    this.hotbar = new Hotbar(this.profile, this.tip);
    this.village = new VillageOverlay(this.profile);
    this.rhythm = new RhythmOverlay(() => d.clock, d.audio, (id, hits) => d.net().rhythmDone(id, hits));
    document.body.append(this.hotbar.el, this.hotbarName, this.targetHint);
    try { JSON.parse(localStorage.getItem('eigen.tutorial2') ?? '[]').forEach((i: string) => this.done.add(i)); } catch { /* fresh */ }

    this.hotbar.onSelect = () => { this.acts.selected = true; this.showHotbarName(); };
    this.hotbar.onMove = (from, to) => this.d.net().invMove({ from, to });
    d.input.onHotbar = (i) => this.hotbar.select(i);
    d.input.onCycle = (dir) => { if (!this.blocking) this.hotbar.cycle(dir); };
    d.input.onPanel = (a) => { if (this.rhythm.open) return; if (a === 'inventory') this.toggleInventory(); else if (a === 'journal') this.toggleJournal(); else this.toggleFieldCraft(); };
    this.profile.onChange((c) => { if (c.has('inv')) this.showHotbarNameSoft(); });
  }

  get blocking(): boolean { return this.wins.open || this.rhythm.open; }
  selected(): Stack | null { return this.profile.inv[this.hotbar.selected] ?? null; }

  // ───────── windows ─────────
  private inventoryActions() {
    const net = () => this.d.net();
    return {
      move: (from: number, to: number) => net().invMove({ from, to }),
      trash: (slot: number, n: number) => net().invTrash({ slot, n }),
      equip: (slot: number, as: 'ring1' | 'ring2' | 'outfit' | 'unequip_ring1' | 'unequip_ring2') => net().equip({ slot, as }),
      use: (slot: number) => { const p = this.d.player(); net().use({ slot, tx: Math.floor(p.x), ty: Math.floor(p.y) }); },
    };
  }

  toggleInventory(): void {
    if (this.wins.name === 'inv') { this.wins.close(); return; }
    this.acts.openedPack = true;
    this.wins.show('inv', 'Pack', buildInventory(this.profile, this.tip, this.inventoryActions(), this.d.selfPortrait), { wide: true });
  }
  toggleJournal(): void {
    if (this.wins.name === 'journal') { this.wins.close(); return; }
    this.acts.journal = true;
    this.wins.show('journal', 'Journal', buildJournal(this.profile, this.d.portrait, 'quests', this.d.seed?.() ?? 0), { wide: true });
  }
  toggleFieldCraft(): void {
    if (this.wins.name === 'hand') { this.wins.close(); return; }
    const p = this.d.player();
    this.wins.show('hand', STATION_NAMES.hand, buildStation('hand', this.profile, this.tip, {
      craft: (recipe, n) => this.d.net().craft({ station: 'hand', tx: Math.floor(p.x), ty: Math.floor(p.y), recipe, n }),
      experiment: (items) => this.d.net().experiment({ station: 'hand', tx: Math.floor(p.x), ty: Math.floor(p.y), items }),
    }), { wide: true });
  }

  // ───────── server messages ─────────
  onProfile(m: ProfileMsg): void {
    const before = new Map<string, number>();
    for (const s of this.profile.inv) if (s) before.set(s.id, (before.get(s.id) ?? 0) + s.n);
    const coins0 = this.profile.coins, recipes0 = this.profile.recipes.size, loaded = this.profile.loaded;
    this.profile.apply(m);
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
    if (Object.keys(this.profile.quests).length) this.acts.quest = true;
    if (this.profile.coins > coins0 && this.wins.name === 'shop') this.acts.sold = true;
  }

  onPanel(m: PanelMsg): void {
    const net = this.d.net();
    if (m.kind === 'station') {
      const st = (m.station ?? 'workbench') as StationId;
      if (st === 'forge') {
        this.wins.show('forge', STATION_NAMES.forge, buildForge(this.profile, this.tip, { start: (template: Template, slots: number[]) => net.forgeStart({ tx: m.tx, ty: m.ty, template, slots }) }), { wide: true });
      } else {
        this.wins.show(`station:${st}`, STATION_NAMES[st] ?? 'Station', buildStation(st, this.profile, this.tip, {
          craft: (recipe, n) => { net.craft({ station: st, tx: m.tx, ty: m.ty, recipe, n }); this.acts.crafted = true; },
          experiment: (items) => net.experiment({ station: st, tx: m.tx, ty: m.ty, items }),
        }), { wide: true });
      }
    } else if (m.kind === 'chest') {
      if (this.wins.name === 'chest' && this.chestAt?.tx === m.tx && this.chestAt?.ty === m.ty && this.chestUi) { this.chestUi.setChest(m.chest ?? []); return; }
      this.chestAt = { tx: m.tx, ty: m.ty };
      this.chestUi = buildChest(m, this.profile, this.tip, {
        put: (slot, n) => net.chest({ tx: m.tx, ty: m.ty, action: 'put', slot, n }),
        take: (slot, n) => net.chest({ tx: m.tx, ty: m.ty, action: 'take', slot, n }),
      });
      this.wins.show('chest', 'Chest', this.chestUi.el, { wide: true, onClose: () => { this.chestUi = null; this.chestAt = null; } });
    } else if (m.kind === 'shelter') {
      const render = () => buildShelter(m, this.profile, {
        add: () => net.shelter({ tx: m.tx, ty: m.ty, action: 'add' }), feed: () => net.shelter({ tx: m.tx, ty: m.ty, action: 'feed' }), collect: () => net.shelter({ tx: m.tx, ty: m.ty, action: 'collect' }),
      });
      if (this.wins.name === 'shelter') this.wins.update('shelter', render()); else this.wins.show('shelter', m.sub === 'coop' ? 'Chicken coop' : 'Barn', render());
    } else if (m.kind === 'lore' && m.lore) {
      this.acts.statue = true;
      this.wins.show('lore', m.lore.title, buildLore(m, this.d.portrait));
    } else if (m.kind === 'board' && m.board) {
      this.acts.board = true;
      const el = buildBoard(m, this.profile, this.d.portrait, {
        accept: (id) => net.send(MSG.QUEST, { npcId: 'board', quest: id, action: 'accept' }),
        turnin: (id) => net.send(MSG.QUEST, { npcId: 'board', quest: id, action: 'turnin' }),
      });
      if (this.wins.name === 'board') this.wins.update('board', el); else this.wins.show('board', 'Hadamere Request Board', el, { wide: true });
    } else if (m.kind === 'sign') this.wins.show('sign', 'Sign', buildSign(m));
  }

  onDialogue(m: DialogueMsg): void {
    this.acts.talked = true;
    this.dialogueMsg = m;
    const net = this.d.net();
    const el = buildDialogue({ ...m, canChat: m.canChat && this.d.features().aiDialogue }, this.d.portrait(m.npcId), this.profile, this.tip, {
      talk: (id, topic) => net.send(MSG.TALK, { npcId: id, topic }),
      quest: (id, quest, action) => { if (action === 'accept') this.acts.quest = true; net.send(MSG.QUEST, { npcId: id, quest, action }); },
      shop: (id) => net.shop({ npcId: id, action: 'open' }),
      gift: (id, slot) => net.gift(id, slot),
      learn: (id, recipe) => net.shop({ npcId: id, action: 'learn', item: recipe }),
      chat: (id, text) => net.chat({ npcId: id, text }),
      close: () => this.wins.close(),
    }, { reduced: this.d.reduced?.() ?? false });
    if (this.wins.name === `dialogue:${m.npcId}`) this.wins.update(`dialogue:${m.npcId}`, el);
    else this.wins.show(`dialogue:${m.npcId}`, NPC_BY_ID[m.npcId]?.name ?? 'Villager', el);
  }

  onShopView(v: ShopViewMsg): void {
    const net = this.d.net();
    const el = buildShop(v, this.profile, this.tip, { buy: (item, n) => net.shop({ npcId: v.npcId, action: 'buy', item, n }), sell: (slot, n) => net.shop({ npcId: v.npcId, action: 'sell', slot, n }) });
    if (this.wins.name === 'shop') this.wins.update('shop', el); else this.wins.show('shop', v.name, el, { wide: true });
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
    this.fishing = { id: m.id, tx: m.tx, ty: m.ty, bite: false, until: 0 };
    this.d.sfx('splash');
    this.toasts.add('Line cast… wait for a bite, then press E!', 'info');
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
  private clearBang(): void { this.bang?.remove(); this.bang = null; }

  onToast(m: ToastMsg): void {
    this.toasts.add(m.text, m.kind, m.item);
    if (m.kind === 'item') this.d.sfx('pickup');
  }

  // ───────── player intent ─────────
  /** E / click-use / touch USE. Returns true if something was sent. */
  interact(): boolean {
    if (this.blocking) return false;
    const net = this.d.net();
    const p = this.d.player();
    if (this.fishing?.bite && performance.now() < this.fishing.until + 150) { net.fishHook(this.fishing.id); this.fishing.bite = false; this.clearBang(); return true; }
    const npc = this.d.npcNear(p.x + p.fx * 0.8, p.y + p.fy * 0.8, 1.9) ?? this.d.npcNear(p.x, p.y, 1.3);
    if (npc) { net.talk(npc.id); return true; }
    const store = this.d.store();
    const mouse = this.d.input.mouseActive ? this.d.input.mouseTile : null;
    const t = targetTile(p.x, p.y, p.fx, p.fy, mouse);
    const sel = this.selected();
    const info = describeUse(sel, store.getTile(t.tx, t.ty), store.objectAt(t.tx, t.ty), this.d.season());
    if (info?.kind === 'open') { net.open(t.tx, t.ty); return true; }
    if (!info || info.kind === 'none') {
      // nothing to do at the target: open a station / chest right next to us if there is one
      for (const reach of [0.9, 1.5]) {
        const tx = Math.floor(p.x + p.fx * reach), ty = Math.floor(p.y + p.fy * reach + 0.2);
        const o = store.objectAt(tx, ty);
        if (o && (o.kind === 'station' || o.kind === 'chest' || o.kind === 'shelter' || o.kind === 'sign' || o.sub === 'statue')) { net.open(tx, ty); return true; }
      }
    }
    this.lastUse = performance.now();
    net.use({ slot: this.hotbar.selected, tx: t.tx, ty: t.ty });
    if (info?.kind === 'till') this.acts.tilled = true;
    if (info?.kind === 'plant') this.acts.planted = true;
    if (info?.kind === 'water') this.acts.watered = true;
    return true;
  }

  /** While E is held: repeat tool swings at ~3/s. */
  holdUse(now: number): void {
    if (this.blocking || !this.d.input.interactHeld || now - this.lastUse < 320) return;
    const p = this.d.player();
    const store = this.d.store();
    const mouse = this.d.input.mouseActive ? this.d.input.mouseTile : null;
    const t = targetTile(p.x, p.y, p.fx, p.fy, mouse);
    const info = describeUse(this.selected(), store.getTile(t.tx, t.ty), store.objectAt(t.tx, t.ty), this.d.season());
    if (info && REPEATABLE.has(info.kind) && info.ok) this.interact();
  }

  /** Prompt + target for the tile highlight. */
  prompt(): { info: UseInfo | null; tx: number; ty: number; label: string | null } {
    const p = this.d.player();
    const store = this.d.store();
    const npc = this.d.npcNear(p.x + p.fx * 0.8, p.y + p.fy * 0.8, 1.9) ?? this.d.npcNear(p.x, p.y, 1.3);
    const mouse = this.d.input.mouseActive ? this.d.input.mouseTile : null;
    const t = targetTile(p.x, p.y, p.fx, p.fy, mouse);
    if (this.fishing?.bite) return { info: null, ...t, label: 'Press E now!' };
    if (npc) return { info: { kind: 'talk', label: `Talk to ${NPC_BY_ID[npc.id]?.name ?? 'villager'}`, ok: true }, tx: Math.floor(npc.x), ty: Math.floor(npc.y), label: `E: Talk to ${NPC_BY_ID[npc.id]?.name ?? 'villager'}` };
    const info = describeUse(this.selected(), store.getTile(t.tx, t.ty), store.objectAt(t.tx, t.ty), this.d.season());
    return { info, ...t, label: info ? `E: ${info.label}` : null };
  }

  setHint(text: string | null, ok = true): void {
    this.targetHint.textContent = text ?? '';
    this.targetHint.style.color = ok ? '#f4f4ff' : '#f07a4a';
  }

  private showHotbarName(): void {
    this.hotbarName.textContent = this.hotbar.selectedName();
    this.hotbarName.style.opacity = '1';
    clearTimeout(this.hotbarNameTimer);
    this.hotbarNameTimer = window.setTimeout(() => { this.hotbarName.style.opacity = '0'; }, 1800);
  }
  private showHotbarNameSoft(): void { if (this.hotbarName.style.opacity === '1') this.hotbarName.textContent = this.hotbar.selectedName(); }

  /** Next tutorial hint, or null when done. */
  tutorialHint(): string | null {
    for (const step of TUTORIAL) {
      if (this.done.has(step.id)) continue;
      if (this.acts[step.id]) {
        this.done.add(step.id);
        try { localStorage.setItem('eigen.tutorial2', JSON.stringify([...this.done])); } catch { /* ignore */ }
        continue;
      }
      return step.text;
    }
    return null;
  }

  describeCrop(id: string): string { return CROPS[id]?.name ?? id; }

  /** Per-frame screen-space village overlay (quest markers, chatter bubbles, quest tracker). */
  frame(now: number): void {
    const seed = this.d.seed?.() ?? 0;
    const sn = this.d.clock.serverNow(now);
    const p = this.d.player();
    this.village.frame(now, {
      npcs: this.d.npcScreens?.() ?? [], me: { x: p.x, y: p.y }, hour: gameHour(sn), weather: weatherForDay(seed, dayNumber(sn)), seed,
      hidden: this.blocking || !this.profile.loaded, reduced: this.d.reduced?.() ?? false,
    });
  }
}
