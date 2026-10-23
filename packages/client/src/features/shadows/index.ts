import {
  ENEMY_BY_KIND, EXTRACT_RANGE, MSG34, RANK_LEVEL, SHADOW_RANKS, SPELL, STANCES, STANCE_INFO, extractChance, rankOf, shadowXpNeeded,
  type ShadowCmd, type ShadowEvent, type ShadowRec, type ShadowRosterMsg, type Stance,
} from '@eigenlands/shared';
import { keyLabel } from '../../input/keymap';
import { h } from '../../ui/dom';
import { iconSvg } from '../../ui/icons';
import type { ClientModule, ExtAction, P34Deps } from '../types';

const RANK_COLORS = ['#9a9ec0', '#7aa8ff', '#b07aff', '#ff7ad0', '#ffd36a'];

const CSS = `
#extract-bar{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);width:min(300px,70vw);z-index:31;pointer-events:none;text-align:center;
  font:600 12px system-ui,sans-serif;color:#e8dcff;text-shadow:0 1px 0 #000;opacity:0;transition:opacity .12s}
#extract-bar.on{opacity:1}
#extract-bar .eb-track{height:10px;margin-top:4px;background:#0b0c1acc;border:1px solid #a46aff99;border-radius:3px;overflow:hidden}
#extract-bar .eb-fill{height:100%;width:0;background:linear-gradient(90deg,#6a3ad0,#d49aff)}
.sh-win{display:grid;gap:10px;min-width:min(620px,90vw)}
.sh-top{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
.sh-stances{display:flex;gap:6px}
.sh-stances button{min-height:30px;padding:4px 10px;font-size:12px}
.sh-stances button.on{border-color:#d49aff;background:#2b1f4d}
.sh-list{display:grid;gap:8px;max-height:56vh;overflow:auto}
.sh-card{display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center;padding:8px;border:2px solid #3a3e5e;border-radius:6px;background:#12132a}
.sh-card.active{border-color:#8a5ad0;box-shadow:0 0 10px rgba(138,90,208,.35)}
.sh-crest{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:2px solid var(--c);background:radial-gradient(circle,#2a1f4d,#0b0c1a);color:var(--c)}
.sh-crest svg{width:22px;height:auto}
.sh-name{font-weight:700;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
.sh-rank{font-size:11px;color:var(--c)}
.sh-meta{font-size:11px;color:#9a9ec0}
.sh-xp{height:5px;margin-top:4px;background:#0b0c1a;border:1px solid #3a3e5e;border-radius:3px;overflow:hidden}
.sh-xp i{display:block;height:100%;background:linear-gradient(90deg,#6a3ad0,#d49aff)}
.sh-btns{display:grid;gap:4px}
.sh-btns button{min-height:28px;padding:2px 8px;font-size:12px}
.sh-empty{padding:18px;text-align:center;color:#9a9ec0}
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
  private hinted = false;

  constructor(private d: P34Deps) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    this.label = h('div', { class: 'eb-label' });
    this.fill = h('div', { class: 'eb-fill' });
    this.bar = h('div', { id: 'extract-bar' }, this.label, h('div', { class: 'eb-track' }, this.fill));
    document.body.append(this.bar);
  }

  private send(m: ShadowCmd): void { try { this.d.net().send(MSG34.SHADOW_CMD, m); } catch { /* not connected */ } }
  private key(a: ExtAction): string { const k = this.d.keys()[a]?.[0]; return k ? keyLabel(k) : '?'; }

  handlers(): Record<string, (m: any) => void> {
    return {
      [MSG34.SHADOW_ROSTER]: (m: ShadowRosterMsg) => { this.roster = m; if (this.d.wins.name === 'shadows') this.openWindow(true); },
      [MSG34.SHADOW_EV]: (m: ShadowEvent) => this.onEvent(m),
    };
  }

  private onEvent(m: ShadowEvent): void {
    const t = this.d.toasts;
    switch (m.kind) {
      case 'channel': this.channel = { start: performance.now(), until: performance.now() + m.secs * 1000, name: m.name, chance: m.chance }; break;
      case 'extracted': this.channel = null; t.add(`Extracted: ${m.rec.name} joins your shadow army.`, 'good'); this.d.sfx('levelup'); break;
      case 'failed': {
        this.channel = null;
        const why = { roll: 'The shadow slipped away.', moved: 'You moved: extraction broken.', gone: 'The residue faded.', full: 'Your roster is full. Release a shadow first.', level: `The Sigil wakes at level ${this.roster.unlock}.`, range: 'No residue within reach.' }[m.reason];
        t.add(why, m.reason === 'roll' ? 'bad' : 'info');
        break;
      }
      case 'level': t.add(`${this.nameOf(m.id)} reached level ${m.level}.`, 'info'); break;
      case 'evolved': t.add(`${this.nameOf(m.id)} evolved: ${SHADOW_RANKS[m.rank]}!`, 'good'); this.d.sfx('levelup'); break;
      case 'fallen': t.add(`${m.name} fell. It will re-form shortly.`, 'bad'); break;
      case 'reformed': t.add(`${this.nameOf(m.id)} re-formed.`, 'info'); break;
    }
  }

  private nameOf(id: string): string { return this.roster.roster.find((r) => r.id === id)?.name ?? 'A shadow'; }

  onState(s: any): void {
    const mine = this.d.myId();
    const list: ShadowClient['residues'] = [];
    s?.spells?.forEach?.((v: { kind: number; owner: string; x: number; y: number; dx: number; dy: number }) => {
      if (v.kind === SPELL.RESIDUE && v.owner === mine) list.push({ x: v.x, y: v.y, kind: v.dx, level: v.dy });
    });
    this.residues = list;
  }

  frame(now: number): void {
    const me = this.d.me();
    this.near = null;
    if (me) {
      let best = EXTRACT_RANGE, pick: ShadowClient['residues'][number] | null = null;
      for (const r of this.residues) { const dd = Math.hypot(r.x - me.x, r.y - me.y); if (dd <= best) { best = dd; pick = r; } }
      if (pick) this.near = { chance: extractChance(this.d.level(), pick.level, { kind: pick.kind }), name: ENEMY_BY_KIND[pick.kind]?.name ?? 'creature' };
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
        if (this.d.level() < this.roster.unlock) this.d.toasts.add(`The Shadow Sigil awakens at level ${this.roster.unlock}.`, 'info');
        else try { this.d.net().send(MSG34.EXTRACT, {}); } catch { /* offline */ }
      }
      return true;
    }
    if (a === 'shadows') { if (this.d.wins.name === 'shadows') this.d.wins.close(); else this.openWindow(false); return true; }
    return false;
  }

  debug(): Record<string, unknown> { return { shadows: this.roster.roster.length, summoned: this.roster.active.length, residues: this.residues.length }; }

  // ───────────────────────── roster window ─────────────────────────

  private openWindow(update: boolean): void {
    const el = this.buildWindow();
    if (update) this.d.wins.update('shadows', el);
    else this.d.wins.show('shadows', 'Companions & Echoes', el, { wide: true });
  }

  private buildWindow(): HTMLElement {
    const R = this.roster;
    const stances = h('div', { class: 'sh-stances' }, ...STANCES.map((s: Stance) => h('button', { class: R.stance === s ? 'on' : '', text: s[0]!.toUpperCase() + s.slice(1), title: STANCE_INFO[s], on: { click: () => this.send({ act: 'stance', stance: s }) } })));
    const top = h('div', { class: 'sh-top' },
      h('div', {}, h('b', { text: `Summoned ${R.active.length} / ${R.slots}` }), h('div', { class: 'small dim', text: `${this.key('extract')} extracts a fresh residue · target an enemy to focus it` })),
      stances,
    );
    const list = h('div', { class: 'sh-list' });
    if (!R.roster.length) {
      list.append(h('div', { class: 'sh-empty', text: this.d.level() < R.unlock ? `The Shadow Sigil awakens at level ${R.unlock}.` : `No shadows yet. Defeat creatures, then press ${this.key('extract')} beside the violet residue they leave.` }));
    }
    for (const rec of R.roster) list.append(this.card(rec, R.active.includes(rec.id), R));
    return h('div', { class: 'sh-win' }, top, list, h('div', { class: 'small dim', text: STANCE_INFO[R.stance] }), h('button', { text: 'Dismiss all', on: { click: () => this.send({ act: 'dismiss_all' }) } }));
  }

  private card(rec: ShadowRec, active: boolean, R: ShadowRosterMsg): HTMLElement {
    const rank = rankOf(rec.level), col = RANK_COLORS[rank]!;
    const def = ENEMY_BY_KIND[rec.kind];
    const need = shadowXpNeeded(rec.level);
    const next = RANK_LEVEL[rank + 1];
    const crest = h('div', { class: 'sh-crest', style: `--c:${col}` });
    crest.innerHTML = iconSvg(rank >= 3 ? 'spark' : rank >= 1 ? 'sword' : 'hex', 22);
    const xp = h('div', { class: 'sh-xp' }, h('i', { style: `width:${Math.min(100, (rec.xp / need) * 100)}%` }));
    const rename = () => { const n = window.prompt('Name this shadow', rec.name); if (n) this.send({ act: 'rename', id: rec.id, name: n }); };
    return h('div', { class: `sh-card${active ? ' active' : ''}` }, crest,
      h('div', {},
        h('div', { class: 'sh-name', style: `--c:${col}` }, h('span', { text: rec.name, title: 'Click to rename', on: { click: rename } }), h('span', { class: 'sh-rank', text: rec.contractUntil ? `Guild contract · ${Math.max(0, Math.ceil((rec.contractUntil - Date.now()) / 60000))} min` : `${SHADOW_RANKS[rank]} · Lv ${rec.level}` })),
        h('div', { class: 'sh-meta', text: `${def?.name ?? 'Creature'}${next ? ` · evolves at Lv ${next}` : ' · fully evolved'}` }),
        xp),
      h('div', { class: 'sh-btns' },
        active
          ? h('button', { text: 'Dismiss', on: { click: () => this.send({ act: 'dismiss', id: rec.id }) } })
          : h('button', { class: 'primary', text: 'Summon', disabled: R.active.length >= R.slots, on: { click: () => this.send({ act: 'summon', id: rec.id }) } }),
        h('button', { class: 'danger', text: 'Release', on: { click: () => { if (window.confirm(`Release ${rec.name} forever?`)) this.send({ act: 'release', id: rec.id }); } } })),
    );
  }
}
