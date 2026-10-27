import {
  BOND_RANGE,
  COMPANION_BONDS,
  companionBond,
  ITEMS,
  ENEMY_BY_KIND,
  EXTRACT_RANGE,
  MSG34,
  RANK_LEVEL,
  SHADOW_RANKS,
  SPELL,
  STANCES,
  STANCE_INFO,
  extractChance,
  rankOf,
  shadowXpNeeded,
  type ShadowCmd,
  type ShadowEvent,
  type ShadowRec,
  type ShadowRosterMsg,
  type Stance,
} from '@eigenlands/shared';
import { keyLabel } from '../../input/keymap';
import { h } from '../../ui/dom';
import { companionPortrait } from '../../art/critters';
import { iconSvg } from '../../ui/icons';
import type { ClientModule, ExtAction, P34Deps } from '../types';

const RANK_COLORS = ['#9a9ec0', '#7aa8ff', '#b07aff', '#ff7ad0', '#ffd36a'];

const CSS = `
#extract-bar{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);width:min(300px,70vw);z-index:31;pointer-events:none;text-align:center;
  font:600 12px system-ui,sans-serif;color:#e8dcff;text-shadow:0 1px 0 #000;opacity:0;transition:opacity .12s}
#extract-bar.on{opacity:1}
#extract-bar .eb-track{height:10px;margin-top:4px;background:#0b0c1acc;border:1px solid #a46aff99;border-radius:3px;overflow:hidden}
#extract-bar .eb-fill{height:100%;width:0;background:linear-gradient(90deg,#6a3ad0,#d49aff)}
.sh-win{display:grid;gap:12px;min-width:0}
.sh-top{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
.sh-stances{display:flex;gap:6px;flex-wrap:wrap}
.sh-win button{min-height:44px;padding:6px 10px;font-size:13px}
.sh-stances button.on{border-color:#c3a471;background:#344039}
.sh-list,.sh-nearby{display:grid;gap:8px}
.sh-card,.sh-wild{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border-bottom:1px solid #59604f;background:#17201f}
.sh-card.active{border-left:3px solid #c3a471;padding-left:7px}
.sh-crest{width:44px;height:44px;display:grid;place-items:center;color:var(--c);background:#111916}
.sh-crest svg{width:22px;height:auto}
.sh-crest img{object-fit:none;object-position:left top;image-rendering:pixelated}
.sh-name{font-weight:700;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;overflow-wrap:anywhere}
.sh-name>button{padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left}
.sh-rank,.sh-meta{font-size:12px;color:#b9bfaa;line-height:1.5}
.sh-xp{height:4px;margin-top:6px;background:#111916;overflow:hidden}
.sh-xp i{display:block;height:100%;background:#b6a275}
.sh-btns{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.sh-empty{padding:12px 0;color:#b9bfaa}
.sh-guide summary{cursor:pointer;min-height:44px;align-content:center;color:#eadbb8;font-weight:700}
.sh-guide p{margin:6px 0;line-height:1.5}
.sh-guide ul{padding-left:20px;margin:8px 0}
.sh-nearby h3{margin:0;font-size:14px}
@media(max-width:620px){.sh-card,.sh-wild{grid-template-columns:44px minmax(0,1fr);gap:8px}.sh-btns,.sh-wild>button{grid-column:2;justify-self:start}.sh-btns{justify-content:flex-start}.sh-top{align-items:flex-start}}
`;

/** Shadow Army: extract defeated creatures with the Sigil, manage the roster, show prompts and the extraction channel. */
export class ShadowClient implements ClientModule {
  private roster: ShadowRosterMsg = { roster: [], active: [], slots: 0, stance: 'assist', unlock: 5 };
  private channel: { until: number; start: number; name: string; chance: number } | null = null;
  private bar: HTMLElement;
  private fill: HTMLElement;
  private label: HTMLElement;
  private residues: Array<{ x: number; y: number; kind: number; level: number }> = [];
  private near: { chance: number; name: string } | null = null;
  private wildlife: Array<{ id: string; kind: number; x: number; y: number; hp: number; maxHp: number; st: number }> =
    [];
  private windowKey = '';
  private nextRefresh = 0;

  constructor(private d: P34Deps) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    this.label = h('div', { class: 'eb-label' });
    this.fill = h('div', { class: 'eb-fill' });
    this.bar = h('div', { id: 'extract-bar' }, this.label, h('div', { class: 'eb-track' }, this.fill));
    document.body.append(this.bar);
    const button = h('button', {
      id: 'btn-companions',
      class: 'gatebtn',
      title: 'Companions & Echoes',
      on: { click: () => this.action('shadows') },
    });
    button.setAttribute('aria-label', 'Companions & Echoes');
    button.innerHTML = iconSvg('hex', 20);
    document.getElementById('hud-btns')?.append(button);
  }

  private send(m: ShadowCmd): void {
    try {
      this.d.net().send(MSG34.SHADOW_CMD, m);
    } catch {
      /* not connected */
    }
  }
  private key(a: ExtAction): string {
    const k = this.d.keys()[a]?.[0];
    return k ? keyLabel(k) : '?';
  }

  handlers(): Record<string, (m: any) => void> {
    return {
      [MSG34.SHADOW_ROSTER]: (m: ShadowRosterMsg) => {
        this.roster = m;
        if (this.d.wins.name === 'shadows') this.refreshWindow();
      },
      [MSG34.SHADOW_EV]: (m: ShadowEvent) => this.onEvent(m),
    };
  }

  private onEvent(m: ShadowEvent): void {
    const t = this.d.toasts;
    switch (m.kind) {
      case 'channel':
        this.channel = {
          start: performance.now(),
          until: performance.now() + m.secs * 1000,
          name: m.name,
          chance: m.chance,
        };
        break;
      case 'extracted':
        this.channel = null;
        t.add(`Extracted: ${m.rec.name} joins your shadow army.`, 'good');
        this.d.sfx('levelup');
        break;
      case 'failed': {
        this.channel = null;
        const why = {
          roll: 'The shadow slipped away.',
          moved: 'You moved: extraction broken.',
          gone: 'The residue faded.',
          full: 'Your roster is full. Release a shadow first.',
          level: `The Sigil wakes at level ${this.roster.unlock}.`,
          range: 'No residue within reach.',
        }[m.reason];
        t.add(why, m.reason === 'roll' ? 'bad' : 'info');
        break;
      }
      case 'level':
        t.add(`${this.nameOf(m.id)} reached level ${m.level}.`, 'info');
        break;
      case 'evolved':
        t.add(`${this.nameOf(m.id)} evolved: ${SHADOW_RANKS[m.rank]}!`, 'good');
        this.d.sfx('levelup');
        break;
      case 'fallen':
        t.add(`${m.name} fell. It will re-form shortly.`, 'bad');
        break;
      case 'reformed':
        t.add(`${this.nameOf(m.id)} re-formed.`, 'info');
        break;
    }
  }

  private nameOf(id: string): string {
    return this.roster.roster.find((r) => r.id === id)?.name ?? 'A shadow';
  }

  onState(s: any): void {
    const mine = this.d.myId();
    const list: ShadowClient['residues'] = [];
    s?.spells?.forEach?.((v: { kind: number; owner: string; x: number; y: number; dx: number; dy: number }) => {
      if (v.kind === SPELL.RESIDUE && v.owner === mine) list.push({ x: v.x, y: v.y, kind: v.dx, level: v.dy });
    });
    this.residues = list;
    this.wildlife = [];
    s?.enemies?.forEach?.((e: (typeof this.wildlife)[number]) => {
      if (e.hp > 0 && companionBond(e.kind))
        this.wildlife.push({ id: e.id, kind: e.kind, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, st: e.st });
    });
    if (this.d.wins.name === 'shadows') this.refreshWindow();
  }

  frame(now: number): void {
    if (this.d.wins.name === 'shadows' && now >= this.nextRefresh) {
      this.nextRefresh = now + 250;
      this.refreshWindow();
    }
    const me = this.d.me();
    this.near = null;
    if (me) {
      let best = EXTRACT_RANGE,
        pick: ShadowClient['residues'][number] | null = null;
      for (const r of this.residues) {
        const dd = Math.hypot(r.x - me.x, r.y - me.y);
        if (dd <= best) {
          best = dd;
          pick = r;
        }
      }
      if (pick)
        this.near = {
          chance: extractChance(this.d.level(), pick.level, { kind: pick.kind }),
          name: ENEMY_BY_KIND[pick.kind]?.name ?? 'creature',
        };
    }
    const c = this.channel;
    if (c && now > c.until + 600) this.channel = null;
    this.bar.classList.toggle('on', !!c);
    if (c) {
      this.label.textContent = `Extracting ${c.name}… ${Math.round(c.chance * 100)}%`;
      this.fill.style.width = `${Math.min(100, ((now - c.start) / (c.until - c.start)) * 100)}%`;
    }
  }

  hint(): string | null {
    if (this.channel || !this.near || this.d.wins.open) return null;
    return `${this.key('extract')}: extract the ${this.near.name}'s shadow (${Math.round(this.near.chance * 100)}% chance)`;
  }

  action(a: ExtAction): boolean {
    if (a === 'extract') {
      if (!this.d.wins.open && !this.d.dead()) {
        if (this.d.level() < this.roster.unlock)
          this.d.toasts.add(`The Shadow Sigil awakens at level ${this.roster.unlock}.`, 'info');
        else
          try {
            this.d.net().send(MSG34.EXTRACT, {});
          } catch {
            /* offline */
          }
      }
      return true;
    }
    if (a === 'shadows') {
      if (this.d.wins.name === 'shadows') this.d.wins.close();
      else this.openWindow(false);
      return true;
    }
    return false;
  }

  debug(): Record<string, unknown> {
    return { shadows: this.roster.roster.length, summoned: this.roster.active.length, residues: this.residues.length };
  }

  // ───────────────────────── roster window ─────────────────────────

  private candidates() {
    const me = this.d.me();
    return me
      ? this.wildlife
          .map((e) => ({ ...e, distance: Math.hypot(e.x - me.x, e.y - me.y) }))
          .filter((e) => e.distance <= 8)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 6)
      : [];
  }
  private foodCount(id: string): number {
    return this.d.profile.inv.reduce((n, s) => n + (s?.id === id ? s.n : 0), 0);
  }
  private refreshWindow(): void {
    const candidates = this.candidates().map((e) => [
      e.id,
      e.kind,
      Math.ceil(e.distance),
      e.hp === e.maxHp,
      e.st >= 2 && e.st <= 5,
    ]);
    const key = JSON.stringify([
      this.roster,
      this.d.level(),
      candidates,
      COMPANION_BONDS.map((b) => this.foodCount(b.food)),
    ]);
    if (key === this.windowKey) return;
    this.windowKey = key;
    this.openWindow(true);
  }
  private openWindow(update: boolean): void {
    const old = document.querySelector<HTMLElement>('.sh-win');
    const focus = old?.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.shControl
      : undefined;
    const expanded = old?.querySelector<HTMLDetailsElement>('.sh-guide')?.open ?? false;
    const scroll = old?.parentElement?.scrollTop ?? 0;
    const el = this.buildWindow();
    el.querySelector<HTMLDetailsElement>('.sh-guide')!.open = expanded;
    if (update) {
      this.d.wins.update('shadows', el);
      if (el.parentElement) el.parentElement.scrollTop = scroll;
      if (focus)
        Array.from(el.querySelectorAll<HTMLElement>('[data-sh-control]'))
          .find((e) => e.dataset.shControl === focus)
          ?.focus({ preventScroll: true });
    } else {
      this.windowKey = '';
      this.d.wins.show('shadows', 'Companions & Echoes', el, { wide: true });
    }
  }
  private portrait(kind: number): HTMLElement {
    const p = companionPortrait(kind),
      crest = h('div', { class: 'sh-crest' });
    if (p) crest.append(h('img', { src: p.url, alt: '', style: `width:${p.width}px;height:${p.height}px` }));
    return crest;
  }
  private wildlifeSection(): HTMLElement {
    const R = this.roster,
      candidates = this.candidates();
    const guide = h(
      'details',
      { class: 'sh-guide' },
      h('summary', { text: 'Wildlife bonds', data: { shControl: 'guide' } }),
      h('p', {
        text: `At level ${R.unlock}, offer forage to healthy, unprovoked wildlife within four tiles. Stay a few steps back, with no wall between you. One bond per species; bonds share active slots with echoes and escorts.`,
      }),
      h(
        'ul',
        {},
        ...COMPANION_BONDS.map((b) =>
          h('li', {
            text: `${b.name} (${ENEMY_BY_KIND[b.kind]?.name}): ${b.count} × ${ITEMS[b.food]?.name}. ${b.trait}: ${b.detail}${b.level ? ` Requires level ${b.level}` : ''}${b.boss ? ` and victory over ${b.boss.replace(/_/g, ' ')}` : ''}.`,
          }),
        ),
      ),
      h('p', {
        class: 'small dim',
        text: 'Bonds keep their natural appearance, gain nearby combat XP and grow through existing ranks. Your quantum bond reforms a fallen companion after 20 seconds. They rest ashore during sailing. Dismiss keeps the bond; Release removes it forever.',
      }),
    );
    const section = h('section', { class: 'sh-nearby' }, guide, h('h3', { text: 'Nearby wildlife' }));
    if (!candidates.length)
      section.append(
        h('div', {
          class: 'small dim',
          text: 'No suitable wildlife nearby. Look for boars, badgers or deer outside town.',
        }),
      );
    for (const e of candidates) {
      const b = companionBond(e.kind)!,
        owned = this.foodCount(b.food),
        already = R.roster.some((r) => r.bonded && r.kind === e.kind);
      const ready =
        this.d.level() >= R.unlock &&
        e.distance <= BOND_RANGE &&
        e.hp === e.maxHp &&
        !(e.st >= 2 && e.st <= 5) &&
        owned >= b.count &&
        !already &&
        R.active.length < R.slots &&
        R.roster.length < 16;
      section.append(
        h(
          'div',
          { class: 'sh-wild', data: { wildlife: e.id } },
          this.portrait(e.kind),
          h(
            'div',
            {},
            h('b', { text: b.name }),
            h('div', {
              class: 'sh-meta',
              text: `${ENEMY_BY_KIND[e.kind]?.name} · ${Math.ceil(e.distance)} tiles · ${owned} ${ITEMS[b.food]?.name} owned${already ? ' · already bonded' : e.hp < e.maxHp ? ' · injured' : ''}`,
            }),
          ),
          h('button', {
            text: `Offer ${b.count} × ${ITEMS[b.food]?.name}`,
            disabled: !ready,
            data: { shControl: `offer-${e.id}` },
            on: { click: () => this.send({ act: 'befriend', target: e.id }) },
          }),
        ),
      );
    }
    return section;
  }

  private buildWindow(): HTMLElement {
    const R = this.roster;
    const stances = h(
      'div',
      { class: 'sh-stances' },
      ...STANCES.map((s: Stance) =>
        h('button', {
          class: R.stance === s ? 'on' : '',
          text: s[0]!.toUpperCase() + s.slice(1),
          title: STANCE_INFO[s],
          data: { shControl: `stance-${s}` },
          on: { click: () => this.send({ act: 'stance', stance: s }) },
        }),
      ),
    );
    stances
      .querySelectorAll('button')
      .forEach((b, i) => b.setAttribute('aria-pressed', String(R.stance === STANCES[i])));
    const top = h(
      'div',
      { class: 'sh-top' },
      h(
        'div',
        {},
        h('b', { text: `Active ${R.active.length} / ${R.slots}` }),
        h('div', {
          class: 'small dim',
          text: `${this.key('extract')} extracts a fresh residue · target an enemy to focus it`,
        }),
      ),
      stances,
    );
    const list = h('div', { class: 'sh-list' });
    if (!R.roster.length) {
      list.append(
        h('div', {
          class: 'sh-empty',
          text:
            this.d.level() < R.unlock
              ? `The Shadow Sigil awakens at level ${R.unlock}.`
              : `No companions yet. Offer forage to wildlife below, or defeat a hostile and press ${this.key('extract')} beside its violet residue.`,
        }),
      );
    }
    for (const rec of R.roster) list.append(this.card(rec, R.active.includes(rec.id), R));
    return h(
      'div',
      { class: 'sh-win' },
      top,
      list,
      this.wildlifeSection(),
      h('div', { class: 'small dim', text: STANCE_INFO[R.stance] }),
      h('button', {
        text: 'Dismiss all',
        data: { shControl: 'dismiss-all' },
        on: { click: () => this.send({ act: 'dismiss_all' }) },
      }),
    );
  }

  private card(rec: ShadowRec, active: boolean, R: ShadowRosterMsg): HTMLElement {
    const rank = rankOf(rec.level),
      col = rec.bonded ? '#c3a471' : RANK_COLORS[rank]!;
    const bond = rec.bonded ? companionBond(rec.kind) : undefined;
    const def = ENEMY_BY_KIND[rec.kind];
    const need = shadowXpNeeded(rec.level);
    const next = RANK_LEVEL[rank + 1];
    const crest = bond ? this.portrait(rec.kind) : h('div', { class: 'sh-crest', style: `--c:${col}` });
    if (!bond) crest.innerHTML = iconSvg(rank >= 3 ? 'spark' : rank >= 1 ? 'sword' : 'hex', 22);
    const xp = h('div', { class: 'sh-xp' }, h('i', { style: `width:${Math.min(100, (rec.xp / need) * 100)}%` }));
    xp.setAttribute('role', 'progressbar');
    xp.setAttribute('aria-label', `${rec.name} experience`);
    xp.setAttribute('aria-valuenow', String(rec.xp));
    xp.setAttribute('aria-valuemin', '0');
    xp.setAttribute('aria-valuemax', String(need));
    const rename = () => {
      const n = window.prompt('Name this companion', rec.name);
      if (n) this.send({ act: 'rename', id: rec.id, name: n });
    };
    return h(
      'div',
      { class: `sh-card${active ? ' active' : ''}`, data: { companion: rec.id } },
      crest,
      h(
        'div',
        {},
        h(
          'div',
          { class: 'sh-name', style: `--c:${col}` },
          h('button', {
            text: rec.name,
            title: 'Rename companion',
            data: { shControl: `rename-${rec.id}` },
            on: { click: rename },
          }),
          h('span', {
            class: 'sh-rank',
            text: rec.contractUntil
              ? `Guild contract · ${Math.max(0, Math.ceil((rec.contractUntil - Date.now()) / 60000))} min`
              : `${SHADOW_RANKS[rank]} · Lv ${rec.level}`,
          }),
        ),
        h('div', {
          class: 'sh-meta',
          text: bond
            ? `${bond.trait}: ${bond.detail}`
            : `${def?.name ?? 'Creature'}${next ? ` · evolves at Lv ${next}` : ' · fully evolved'}`,
        }),
        xp,
      ),
      h(
        'div',
        { class: 'sh-btns' },
        active
          ? h('button', {
              text: 'Dismiss',
              data: { shControl: `dismiss-${rec.id}` },
              on: { click: () => this.send({ act: 'dismiss', id: rec.id }) },
            })
          : h('button', {
              class: 'primary',
              text: 'Summon',
              data: { shControl: `summon-${rec.id}` },
              disabled: R.active.length >= R.slots,
              on: { click: () => this.send({ act: 'summon', id: rec.id }) },
            }),
        h('button', {
          class: 'danger',
          text: 'Release',
          data: { shControl: `release-${rec.id}` },
          on: {
            click: () => {
              if (window.confirm(`Release ${rec.name} forever?`)) this.send({ act: 'release', id: rec.id });
            },
          },
        }),
      ),
    );
  }
}
