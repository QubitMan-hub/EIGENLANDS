import { CLASSES, PALETTE, PARTY_MAX, type PartyMember, type PartyStateMsg } from '@eigenlands/shared';
import { clear, h } from '../../ui/dom';

export const classColor = (cls: string): string => PALETTE[CLASSES[cls as keyof typeof CLASSES]?.color ?? 6] ?? '#f4f4ff';
export const className = (cls: string): string => CLASSES[cls as keyof typeof CLASSES]?.name ?? 'Wanderer';

export interface FrameGeo {
  /** screen-space direction (radians) from me to the member, or null when on screen */
  angle: number | null;
  /** distance in tiles, or null when unknown */
  dist: number | null;
  /** on screen right now */
  visible: boolean;
}

/**
 * HUD party frames (left, under the player panel): name, level, class colour, HP bar, leader crown, offline state,
 * an "other region" badge and an arrow with the distance to members who are off-screen or on another shard.
 * Off-screen members on this shard also get a marker at the screen edge.
 */
export class PartyFrames {
  readonly root = h('div', { id: 'party-frames', class: 'party-frames' });
  private rows = new Map<string, { el: HTMLElement; fill: HTMLElement; lv: HTMLElement; name: HTMLElement; sub: HTMLElement; arrow: HTMLElement; dist: HTMLElement; region: HTMLElement; crown: HTMLElement; dot: HTMLElement; edge: HTMLElement }>();

  constructor(onClick: () => void) {
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Party');
    this.root.addEventListener('click', onClick);
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.append(this.root);
  }

  /** Rebuild the rows when membership changes; values update every call. */
  update(st: PartyStateMsg | null, myAccount: string, myShard: string, geo: (m: PartyMember) => FrameGeo): void {
    const others = (st?.members ?? []).filter((m) => m.accountId !== myAccount);
    this.root.hidden = !st?.id || !others.length;
    const keep = new Set(others.map((m) => m.accountId));
    for (const [id, r] of this.rows) if (!keep.has(id)) { r.el.remove(); r.edge.remove(); this.rows.delete(id); }
    others.forEach((m, i) => {
      let r = this.rows.get(m.accountId);
      if (!r) {
        const dot = h('span', { class: 'pf-dot' });
        const name = h('b', { class: 'pf-name' });
        const crown = h('span', { class: 'pf-crown', text: '♛', title: 'Party leader' });
        const lv = h('span', { class: 'pf-lv' });
        const fill = h('i');
        const region = h('span', { class: 'pf-region', text: 'other region' });
        const arrow = h('span', { class: 'pf-arrow', text: '➤' });
        const dist = h('span', { class: 'pf-dist' });
        const sub = h('div', { class: 'pf-sub' }, region, arrow, dist);
        const el = h('div', { class: 'pf', data: { a: m.accountId } }, h('div', { class: 'pf-top' }, dot, name, crown, lv), h('div', { class: 'pf-bar' }, fill), sub);
        const edge = h('div', { class: 'pf-edge', text: '➤' });
        edge.hidden = true;
        document.body.append(edge);
        r = { el, fill, lv, name, sub, arrow, dist, region, crown, dot, edge };
        this.rows.set(m.accountId, r);
      }
      if (this.root.children[i] !== r.el) this.root.insertBefore(r.el, this.root.children[i] ?? null);
      const col = classColor(m.cls);
      r.dot.style.background = col;
      r.name.textContent = m.name;
      r.name.style.color = col;
      r.crown.hidden = st!.leader !== m.accountId;
      r.lv.textContent = `Lv ${m.level}`;
      const pct = m.maxHp > 0 ? Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100)) : 0;
      r.fill.style.width = `${pct}%`;
      r.fill.classList.toggle('low', pct < 30);
      r.el.classList.toggle('offline', !m.online);
      r.el.title = `${m.name} · ${className(m.cls)} · ${m.online ? `${m.hp}/${m.maxHp} HP` : 'offline'}`;
      const other = m.online && !!m.shard && m.shard !== myShard;
      r.region.hidden = !other;
      const g = m.online ? geo(m) : { angle: null, dist: null, visible: false };
      r.arrow.hidden = g.angle === null;
      if (g.angle !== null) r.arrow.style.transform = `rotate(${g.angle}rad)`;
      r.dist.textContent = !m.online ? 'offline' : g.dist === null ? '' : g.visible ? 'nearby' : `${Math.round(g.dist)} m`;
      r.edge.hidden = !(m.online && !other && g.angle !== null && !g.visible && this.root.hidden === false);
      r.edge.style.color = col;
      if (!r.edge.hidden) {
        const W = window.innerWidth, H = window.innerHeight, pad = 22;
        const cx = W / 2, cy = H / 2, dx = Math.cos(g.angle!), dy = Math.sin(g.angle!);
        const t = Math.min(Math.abs((cx - pad) / (dx || 1e-6)), Math.abs((cy - pad) / (dy || 1e-6)));
        r.edge.style.left = `${cx + dx * t}px`;
        r.edge.style.top = `${cy + dy * t}px`;
        r.edge.style.transform = `translate(-50%, -50%) rotate(${g.angle}rad)`;
        r.edge.title = `${m.name} · ${Math.round(g.dist ?? 0)} m`;
      }
    });
  }

  hideAll(): void { this.root.hidden = true; for (const r of this.rows.values()) r.edge.hidden = true; }
}

export interface PromptOpts { text: string; ms: number; accept: () => void; decline: () => void; kind: 'party' | 'trade' }

/** Accept/decline prompts (party invites, trade requests) under the top HUD, with a countdown bar. */
export class Prompts {
  readonly root = h('div', { id: 'social-prompts', class: 'social-prompts' });
  constructor() {
    this.root.setAttribute('aria-live', 'assertive');
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.append(this.root);
  }

  add(key: string, o: PromptOpts): void {
    this.remove(key);
    let done = false;
    const close = () => { if (done) return; done = true; clearTimeout(timer); el.remove(); };
    const bar = h('i');
    const el = h('div', { class: `prompt panel ${o.kind}`, data: { key } },
      h('div', { class: 'prompt-text', text: o.text }),
      h('div', { class: 'prompt-btns' },
        h('button', { class: 'primary', text: 'Accept', on: { click: () => { close(); o.accept(); } } }),
        h('button', { text: 'Decline', on: { click: () => { close(); o.decline(); } } })),
      h('div', { class: 'prompt-time' }, bar));
    bar.style.animationDuration = `${o.ms}ms`;
    const timer = setTimeout(close, o.ms);
    (el as unknown as { _close: () => void })._close = close;
    this.root.append(el);
    while (this.root.children.length > 4) (this.root.firstElementChild as unknown as { _close: () => void })._close();
  }

  remove(key: string): void {
    for (const el of [...this.root.children]) if ((el as HTMLElement).dataset.key === key) (el as unknown as { _close: () => void })._close();
  }

  count(): number { return this.root.children.length; }
}

export interface PartyWinActs {
  invite(name: string): void;
  leave(): void;
  kick(m: PartyMember): void;
  promote(m: PartyMember): void;
  whisper(name: string): void;
}

/** The party window (P): members with actions for the leader, invite by name, leave. */
export function buildPartyWindow(acts: PartyWinActs): { el: HTMLElement; update: (st: PartyStateMsg | null, me: string, myShard: string) => void } {
  const list = h('div', { class: 'party-list' });
  const name = h('input', { placeholder: 'Character name', maxLength: 32 }) as HTMLInputElement;
  name.setAttribute('aria-label', 'Name to invite');
  name.autocomplete = 'off';
  const go = () => { const v = name.value.trim(); if (v) { acts.invite(v); name.value = ''; } };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  const inviteRow = h('div', { class: 'party-invite' }, name, h('button', { class: 'primary', text: 'Invite', on: { click: go } }));
  const leaveBtn = h('button', { class: 'danger', text: 'Leave party', on: { click: () => acts.leave() } });
  const note = h('p', { class: 'small dim' });
  const el = h('div', { class: 'party-win' }, list, inviteRow, note, h('div', { class: 'party-foot' }, leaveBtn));

  let sig = '';
  const update = (st: PartyStateMsg | null, me: string, myShard: string) => {
    const nsig = JSON.stringify([st?.id, st?.leader, me, myShard, (st?.members ?? []).map((m) => [m.accountId, m.name, m.level, m.cls, m.hp, m.maxHp, m.online, m.shard])]);
    if (nsig === sig) return;
    sig = nsig;
    clear(list);
    const members = st?.members ?? [];
    const leader = st?.leader ?? '';
    const iLead = !st?.id || leader === me;
    leaveBtn.hidden = !st?.id;
    inviteRow.hidden = !iLead || members.length >= PARTY_MAX;
    note.textContent = !st?.id
      ? 'You are not in a party. Invite someone by name, or click a player in the world. Party members share +50% XP from nearby kills, see each other on the HUD and get the Party chat channel.'
      : members.length >= PARTY_MAX ? `The party is full (${PARTY_MAX}).` : iLead ? 'Invite up to five players in total, from anywhere in the world.' : 'Only the leader can invite or remove members.';
    for (const m of members) {
      const col = classColor(m.cls);
      const status = !m.online ? 'offline' : m.shard && m.shard !== myShard ? 'other region' : m.maxHp ? `${m.hp}/${m.maxHp} HP` : '';
      const btns = h('div', { class: 'pm-btns' });
      if (m.accountId !== me) {
        btns.append(h('button', { text: 'Whisper', on: { click: () => acts.whisper(m.name) } }));
        if (leader === me) {
          if (m.online) btns.append(h('button', { text: 'Promote', on: { click: () => acts.promote(m) } }));
          btns.append(h('button', { class: 'danger', text: 'Kick', on: { click: () => acts.kick(m) } }));
        }
      }
      const pct = m.maxHp > 0 ? Math.round((m.hp / m.maxHp) * 100) : 0;
      list.append(h('div', { class: `pm${m.online ? '' : ' offline'}${m.accountId === me ? ' me' : ''}`, data: { a: m.accountId } },
        h('span', { class: 'pf-dot', style: `background:${col}` }),
        h('div', { class: 'pm-main' },
          h('div', {}, h('b', { text: m.name, style: `color:${col}` }), leader === m.accountId ? h('span', { class: 'pf-crown', text: ' ♛', title: 'Leader' }) : null, h('span', { class: 'dim', text: ` Lv ${m.level} ${className(m.cls)}${m.accountId === me ? ' (you)' : ''}` })),
          h('div', { class: 'pf-bar' }, h('i', { style: `width:${pct}%` })),
          h('div', { class: 'small dim', text: status })),
        btns));
    }
  };
  return { el, update };
}
