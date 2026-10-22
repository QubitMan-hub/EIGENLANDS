/**
 * Screen-space village overlay: quest markers over villagers (! offer, ? ready, ♥ heart event), ambient chatter bubbles
 * that follow what each villager is doing on their schedule, and the quest tracker under the clock.
 */
import {
  NPC_BY_ID, barkFor, isRequestId, mulberry32, objectiveText, offerable, pendingEvent, questComplete, questDef, scheduleAt,
  type QuestDef, type Weather,
} from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h } from './dom';
import { ensureP2Styles } from './p2style';

export interface NpcScreen { id: string; x: number; y: number; sx: number; sy: number; visible: boolean }
export interface OverlayCtx {
  npcs: NpcScreen[];
  me: { x: number; y: number };
  hour: number;
  weather: Weather;
  seed: number;
  hidden: boolean;
  reduced: boolean;
}

type Mark = 'offer' | 'ready' | 'event' | null;

export class VillageOverlay {
  readonly layer = h('div', { id: 'npcfx' });
  readonly tracker = h('div', { id: 'qtrack' });
  private marks = new Map<string, HTMLElement>();
  private bubbles = new Map<string, { el: HTMLElement; until: number }>();
  private markState = new Map<string, Mark>();
  private lastMarks = 0;
  private nextBark = 0;
  private rand = mulberry32(Date.now() & 0xffff);
  private trackerKey = '';
  private lastTracker = 0;

  constructor(private profile: Profile) {
    ensureP2Styles();
    this.layer.setAttribute('aria-hidden', 'true');
    this.tracker.setAttribute('aria-live', 'polite');
    document.body.append(this.layer, this.tracker);
  }

  /** Which marker a villager should wear for this player. */
  markFor(npcId: string, seed: number): Mark {
    const log = this.profile.quests;
    for (const [id, st] of Object.entries(log)) {
      if (st.state !== 'active') continue;
      const d = questDef(id, seed);
      if (d && d.giver === npcId && this.complete(d, st.progress)) return 'ready';
    }
    if (offerable(npcId, log).length) return 'offer';
    if (pendingEvent(npcId, this.profile.friends[npcId]?.pts ?? 0, this.profile.events)) return 'event';
    return null;
  }

  private complete(d: QuestDef, progress: number[]): boolean {
    return questComplete(d, { state: 'active', progress: d.objectives.map((o, i) => (o.type === 'deliver' ? this.profile.count(o.target) : progress[i] ?? 0)) });
  }

  frame(now: number, c: OverlayCtx): void {
    this.layer.hidden = c.hidden;
    this.layer.classList.toggle('reduced', c.reduced);
    if (now - this.lastMarks > 400) {
      this.lastMarks = now;
      for (const n of c.npcs) this.markState.set(n.id, this.markFor(n.id, c.seed));
    }
    const seen = new Set<string>();
    for (const n of c.npcs) {
      const dist = Math.hypot(n.x - c.me.x, n.y - c.me.y);
      const show = n.visible && dist < 16;
      // quest marker
      const m = show ? this.markState.get(n.id) ?? null : null;
      let el = this.marks.get(n.id);
      if (m) {
        if (!el) { el = h('div', { class: 'npc-mark' }); this.layer.append(el); this.marks.set(n.id, el); }
        el.className = `npc-mark ${m}`;
        el.textContent = m === 'offer' ? '!' : m === 'ready' ? '?' : '♥';
        el.title = m === 'offer' ? 'Has a task for you' : m === 'ready' ? 'Waiting for your report' : 'Wants to talk to you';
        el.style.left = `${n.sx}px`; el.style.top = `${n.sy - 4}px`;
        seen.add(n.id);
      }
      // chatter bubble follows the speaker
      const b = this.bubbles.get(n.id);
      if (b) {
        if (now > b.until || !show) { b.el.remove(); this.bubbles.delete(n.id); }
        else { b.el.style.left = `${n.sx}px`; b.el.style.top = `${n.sy - (m ? 26 : 4)}px`; b.el.classList.toggle('fade', now > b.until - 400); }
      }
    }
    for (const [id, el] of this.marks) if (!seen.has(id)) { el.remove(); this.marks.delete(id); }
    // a new bubble every few seconds from someone close by
    if (now > this.nextBark && !c.hidden) {
      this.nextBark = now + 5000 + this.rand() * 7000;
      const cands = c.npcs.filter((n) => n.visible && !this.bubbles.has(n.id) && Math.hypot(n.x - c.me.x, n.y - c.me.y) < 11);
      const n = cands[Math.floor(this.rand() * cands.length)];
      const def = n ? NPC_BY_ID[n.id] : undefined;
      if (n && def) {
        const doing = scheduleAt(def, c.hour, c.weather).doing;
        const text = barkFor(n.id, doing, c.weather, this.rand);
        if (text) {
          const el = h('div', { class: 'npc-bubble', text });
          el.style.left = `${n.sx}px`; el.style.top = `${n.sy}px`;
          this.layer.append(el);
          this.bubbles.set(n.id, { el, until: now + 3800 });
        }
      }
    }
    if (now - this.lastTracker > 500) { this.lastTracker = now; this.renderTracker(c.seed, c.hidden); }
  }

  /** Up to three tracked quests (finished ones first), or a pointer to the mayor for brand-new players. */
  renderTracker(seed: number, hidden: boolean): void {
    this.tracker.hidden = hidden;
    const log = this.profile.quests;
    const rows: Array<{ d: QuestDef; prog: number[]; ready: boolean }> = [];
    for (const [id, st] of Object.entries(log)) {
      if (st.state !== 'active') continue;
      const d = questDef(id, seed);
      if (!d) continue;
      const prog = d.objectives.map((o, i) => (o.type === 'deliver' ? Math.min(o.n, this.profile.count(o.target)) : st.progress[i] ?? 0));
      rows.push({ d, prog, ready: questComplete(d, { state: 'active', progress: prog }) });
    }
    rows.sort((a, b) => Number(b.ready) - Number(a.ready) || Number(isRequestId(a.d.id)) - Number(isRequestId(b.d.id)));
    const key = JSON.stringify(rows.slice(0, 3).map((r) => [r.d.id, r.prog])) + (log.welcome ? 1 : 0);
    if (key === this.trackerKey) return;
    this.trackerKey = key;
    clear(this.tracker);
    if (!log.welcome) {
      this.tracker.append(h('div', { class: 'qt' }, h('b', { text: 'Find Mayor Orla' }), h('div', { class: 'o', text: 'Follow the Hadamere arrow (top right) to the village and talk to the mayor. Villagers with a yellow ! have tasks.' })));
      return;
    }
    for (const r of rows.slice(0, 3)) {
      const giver = NPC_BY_ID[r.d.giver]?.name.split(' ')[0] ?? '';
      this.tracker.append(h('div', { class: `qt${r.ready ? ' ready' : ''}` },
        h('b', { text: `${r.ready ? '★ ' : ''}${r.d.title}` }),
        ...(r.ready ? [h('div', { class: 'w', text: `Return to ${r.d.daily ? 'the board or ' : ''}${giver}` })]
          : r.d.objectives.map((o, i) => h('div', { class: `o${r.prog[i]! >= o.n ? ' done' : ''}`, text: objectiveText(o, r.prog[i] ?? 0) })))));
    }
    if (rows.length > 3) this.tracker.append(h('div', { class: 'qt' }, h('div', { class: 'w', text: `+${rows.length - 3} more in your Journal (L)` })));
  }
}
