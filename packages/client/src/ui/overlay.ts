/**
 * Screen-space village overlay: quest markers over villagers (! offer, ? ready, ♥ heart event), ambient chatter bubbles
 * that follow what each villager is doing on their schedule, and contextual villager markers.
 */
import {
  NPC_BY_ID, barkFor, mulberry32, offerable, pendingEvent, questComplete, questDef, scheduleAt,
  type QuestDef, type Weather,
} from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { h } from './dom';
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
  private marks = new Map<string, HTMLElement>();
  private bubbles = new Map<string, { el: HTMLElement; until: number }>();
  private markState = new Map<string, Mark>();
  private lastMarks = 0;
  private nextBark = 0;
  private rand = mulberry32(Date.now() & 0xffff);

  constructor(private profile: Profile) {
    ensureP2Styles();
    this.layer.setAttribute('aria-hidden', 'true');
    document.body.append(this.layer);
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
  }
}
