import { Graphics } from 'pixi.js';
import {
  ATTUNE_REACH,
  MSG_TRAVEL,
  MSG_CIV,
  MSG_FEST,
  TOURNEY_BOUTS,
  type TourneyState,
  type CivSummary,
  waystonesNear,
  type TravelEvent,
  type WayKind,
  type Waystone,
} from '@eigenlands/shared';
import { isoX, isoY } from '../../game/iso';
import { keyLabel } from '../../input/keymap';
import { h } from '../../ui/dom';
import type { ClientModule, P34Deps } from '../types';
import { setCivSender, setCivState } from '../../game/civ-store';
import { CaravanViews } from './caravans';
import { SettlementViews } from './settlements';
import { RoadLife } from './roadlife';
import { BridgeViews } from './bridges';
import { VoyageCard } from '../../ui/voyage';

export interface AttunedStone {
  id: string;
  name: string;
  kind: WayKind;
  x: number;
  y: number;
}

const BEAM: Record<WayKind, number> = { waystone: 0x6fd0bd, gate: 0xb98ad6, harbor: 0x7cc8ff };

/**
 * Travel on the client: attunement banners, the channel ring and bar while a jump gathers, beacons over stones you
 * have not attuned yet (so the network is something you discover), and the attuned list the atlas charts.
 */
export class TravelClient implements ClientModule {
  private attuned = new Map<string, AttunedStone>();
  private home: string | null = null;
  private gfx = new Graphics();
  private channel: { until: number; seconds: number; to: string } | null = null;
  private arrive: { x: number; y: number; at: number } | null = null;
  private bar: HTMLElement;
  private fill: HTMLElement;
  private label: HTMLElement;
  private near: Waystone[] = [];
  private nearAt = 0;
  private nearest: Waystone | null = null;
  onChange: (list: AttunedStone[]) => void = () => {};
  readonly caravans: CaravanViews;
  readonly bridges: BridgeViews;
  readonly settlements: SettlementViews;
  readonly roadLife: RoadLife;
  private voyage: VoyageCard;

  constructor(private d: P34Deps) {
    this.gfx.zIndex = 9e8;
    this.d.fxLayer().addChild(this.gfx);
    this.caravans = new CaravanViews(d);
    this.settlements = new SettlementViews(d);
    this.roadLife = new RoadLife(d);
    setCivSender((type, msg) => {
      try {
        this.d.net().send(type, msg);
      } catch {
        /* offline */
      }
    });
    this.bridges = new BridgeViews(d);
    this.voyage = new VoyageCard(() => this.d.settings().reducedMotion);
    this.fill = h('i');
    this.label = h('span');
    this.bar = h('div', { id: 'travel-bar', class: 'cast-bar' }, this.label, h('b', {}, this.fill));
    this.bar.hidden = true;
    this.bar.setAttribute('role', 'status');
    document.body.append(this.bar);
    const st = document.createElement('style');
    st.textContent = `#travel-bar{position:fixed;left:50%;bottom:22%;transform:translateX(-50%);z-index:30;display:grid;gap:4px;
      min-width:min(320px,80vw);padding:8px 12px;background:var(--leather);color:var(--parch-hi);font-family:var(--pix);
      text-align:center;box-shadow:0 0 0 2px var(--walnut),inset 0 0 0 1px var(--brass-lo)}
      #travel-bar b{display:block;height:8px;background:#10191d;box-shadow:inset 0 0 0 1px var(--brass-lo)}
      #travel-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--verdigris),var(--verdigris-hi))}`;
    document.head.append(st);
  }

  list(): AttunedStone[] {
    return [...this.attuned.values()];
  }
  isAttuned(id: string): boolean {
    return this.attuned.has(id);
  }
  homeId(): string | null {
    return this.home;
  }

  handlers(): Record<string, (m: any) => void> {
    return {
      [MSG_TRAVEL.EV]: (m: TravelEvent) => this.on(m),
      // the living kingdoms' state rides along with the travel module (it is shown in the Journal and the world)
      [MSG_CIV.STATE]: (m: CivSummary) => setCivState(m),
      [MSG_FEST.TOURNEY]: (m: TourneyState) => this.bout(m),
    };
  }

  /** the herald's calls during a tournament bout */
  private bout(m: TourneyState): void {
    if (m.status !== 'fighting' || m.left <= 0) return;
    const foe = ['a foot soldier', 'a rider', 'the champion'][m.bout] ?? 'a challenger';
    this.d.toasts.add(`Bout ${m.bout + 1} of ${TOURNEY_BOUTS.length}: ${foe} enters the lists! (${m.left}s)`, 'info');
    this.d.sfx('bell');
  }

  private on(m: TravelEvent): void {
    const now = performance.now();
    switch (m.kind) {
      case 'state':
        this.attuned = new Map(m.attuned.map((s) => [s.id, s]));
        this.home = m.home;
        this.onChange(this.list());
        break;
      case 'attune': {
        const what = m.wayKind === 'gate' ? 'Realm Gate' : m.wayKind === 'harbor' ? 'Ferry' : 'Waystone';
        this.d.toasts.add(`${what} attuned: ${m.name}. ${m.reward}`, 'good');
        this.d.sfx('levelup');
        this.arrive = { x: m.x + 0.5, y: m.y + 0.5, at: now };
        break;
      }
      case 'channel':
        this.channel = { until: now + m.seconds * 1000, seconds: m.seconds, to: m.to };
        this.label.textContent = `Travelling to ${m.to}… hold still`;
        this.bar.hidden = false;
        if (m.voyage) {
          this.label.textContent = `Ferry to ${m.to}… hold still on deck`;
          this.voyage.show(m.voyage.from, m.voyage.to, m.seconds);
          this.d.sfx('bell');
        } else this.d.sfx('charge');
        break;
      case 'cancel':
        this.channel = null;
        this.bar.hidden = true;
        this.voyage.hide();
        this.d.toasts.add(m.why, 'bad');
        break;
      case 'arrive':
        this.channel = null;
        this.bar.hidden = true;
        this.voyage.hide();
        this.arrive = { x: m.x, y: m.y, at: now };
        this.d.toasts.add(`You step out at ${m.name}.`, 'info');
        this.d.sfx('pickup');
        break;
    }
  }

  /** The caravan in trading reach (the interact key opens its wagon shop). */
  caravanNear(): { id: string; name: string } | null {
    const c = this.caravans.reachable();
    return c ? { id: c.route.id, name: c.route.name } : null;
  }

  hint(): string | null {
    if (this.channel || this.d.wins.open) return null;
    // a caravan in reach is offered by the interaction prompt itself
    if (!this.nearest || this.caravanNear()) return null;
    const s = this.nearest;
    const k = this.d.keys().interact[0];
    const key = k ? keyLabel(k) : 'Use';
    const what = s.kind === 'gate' ? 'Realm Gate' : s.kind === 'harbor' ? 'Ferry' : 'waystone';
    return this.attuned.has(s.id)
      ? `${key}: travel from ${s.name}`
      : `A ${what} hums nearby: walk up to it to attune ${s.name}`;
  }

  frame(now: number, dt = 16): void {
    this.caravans.frame(dt);
    this.bridges.frame(now);
    this.settlements.frame(now, dt);
    this.roadLife.frame(now, dt);
    const me = this.d.me();
    const g = this.gfx;
    g.clear();
    if (this.channel) {
      const left = Math.max(0, this.channel.until - now);
      this.fill.style.width = `${Math.round(100 * (1 - left / (this.channel.seconds * 1000)))}%`;
    }
    if (!me) return;
    if (now - this.nearAt > 600) {
      this.nearAt = now;
      this.near = waystonesNear(this.d.store().seed, me.x, me.y, 90, this.d.store().generation);
    }
    const reduced = this.d.settings().reducedMotion;
    this.nearest = null;
    let best = Infinity;
    for (const s of this.near) {
      const dist = Math.hypot(s.x + 0.5 - me.x, s.y + 0.5 - me.y);
      if (dist < best && dist < ATTUNE_REACH + 1.5) {
        best = dist;
        this.nearest = s;
      }
      const sx = isoX(s.x + 0.5, s.y + 0.5),
        sy = isoY(s.x + 0.5, s.y + 0.5);
      const col = BEAM[s.kind];
      if (!this.attuned.has(s.id)) {
        // an unattuned stone sends up a thin beacon you can steer towards from far off
        const fade = Math.min(1, Math.max(0.3, 1 - dist / 90));
        const pulse = reduced ? 0.8 : 0.65 + 0.35 * Math.sin(now / 420 + s.x);
        g.rect(sx - 1, sy - 180, 2, 150).fill({ color: col, alpha: 0.22 * fade * pulse });
        g.rect(sx - 4, sy - 180, 8, 150).fill({ color: col, alpha: 0.07 * fade });
      } else if (dist < 14) {
        // attuned: a calm rune ring on the ground
        g.ellipse(sx, sy, 20, 10).stroke({ color: col, width: 1, alpha: 0.45 });
      }
    }
    // channel: a rune circle tightening around the traveller
    if (this.channel) {
      const k = 1 - Math.max(0, this.channel.until - now) / (this.channel.seconds * 1000);
      const mx = isoX(me.x, me.y),
        my = isoY(me.x, me.y);
      const r = 26 - 12 * k;
      g.ellipse(mx, my, r, r / 2).stroke({ color: 0x6fd0bd, width: 2, alpha: 0.5 + 0.5 * k });
      g.ellipse(mx, my, r + 6, (r + 6) / 2).stroke({ color: 0xb98ad6, width: 1, alpha: 0.6 * k });
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (reduced ? 0 : now / 300);
        g.rect(mx + Math.cos(a) * r - 1, my + Math.sin(a) * (r / 2) - 1 - k * 18, 2, 2).fill({
          color: 0xecfff8,
          alpha: 0.9,
        });
      }
      if (!reduced) g.rect(mx - 2, my - 60 * k, 4, 60 * k).fill({ color: 0x6fd0bd, alpha: 0.25 * k });
    }
    // arrival/attunement: a column of light that fades
    if (this.arrive) {
      const t = (now - this.arrive.at) / 900;
      if (t >= 1) this.arrive = null;
      else {
        const ax = isoX(this.arrive.x, this.arrive.y),
          ay = isoY(this.arrive.x, this.arrive.y);
        g.rect(ax - 6 * (1 - t), ay - 120, 12 * (1 - t), 120).fill({ color: 0xecfff8, alpha: 0.5 * (1 - t) });
        g.ellipse(ax, ay, 10 + 30 * t, 5 + 15 * t).stroke({ color: 0x6fd0bd, width: 2, alpha: 1 - t });
      }
    }
  }

  /** Stones within r tiles of the player, nearest first (tests and the atlas). */
  nearby(r: number): Waystone[] {
    const me = this.d.me();
    if (!me) return [];
    return waystonesNear(this.d.store().seed, me.x, me.y, r, this.d.store().generation).sort(
      (a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y),
    );
  }

  debug(): Record<string, unknown> {
    return {
      bridgeRails: this.bridges.count(),
      attuned: this.attuned.size,
      travelling: !!this.channel,
      nearStone: this.nearest?.id ?? null,
    };
  }
}
