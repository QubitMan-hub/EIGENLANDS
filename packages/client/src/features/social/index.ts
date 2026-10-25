import {
  EMOTES,
  EMOTE_GLYPH,
  MSG34,
  type ChatMsg,
  type ChatSendMsg,
  type Emote,
  type EmoteEvent,
  type PartyInviteMsg,
  type PartyMember,
  type PartyMsg,
  type PartyStateMsg,
  type TradeMsg,
  type TradeRequestMsg,
  type TradeStateMsg,
} from '@eigenlands/shared';
import type { ClientModule, ExtAction, P34Deps } from '../types';
import { ChatPanel } from './chatpanel';
import { ChatModel, HELP, parseCommand, type Cmd } from './model';
import { PartyFrames, Prompts, buildPartyWindow, type FrameGeo } from './partyui';
import { TradeWindow } from './tradeui';
import { EmoteBubbles, PlayerMenu } from './world';
import './social.css';

const INVITE_MS = 60_000;
const TRADE_REQ_MS = 30_000;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Phase 4 client: chat panel, party frames and party window, invite/trade prompts, the player context menu, emote
 * bubbles and the trade window. All server traffic goes through `d.net().send` with MSG34 messages.
 */
export class SocialClient implements ClientModule {
  readonly model = new ChatModel(storage());
  readonly chat: ChatPanel;
  private frames: PartyFrames;
  private prompts = new Prompts();
  private bubbles: EmoteBubbles;
  private menu: PlayerMenu;
  private party: PartyStateMsg | null = null;
  /** The existing private party message, also used by atlas navigation. Never persisted by the atlas. */
  get partyState(): PartyStateMsg | null {
    return this.party;
  }
  private partyWin: ReturnType<typeof buildPartyWindow> | null = null;
  private trade: TradeWindow | null = null;
  private tradeId: string | null = null;
  private players: any = null;
  private started = false;
  private lastFrames = 0;
  private lastWhisperTo = '';

  constructor(readonly d: P34Deps) {
    this.chat = new ChatPanel(this.model, {
      submit: (text) => this.submit(text),
      emote: (e) => this.emote(e),
      nameClick: (name) => {
        if (name !== this.myName()) this.chat.focus(`/w ${name.includes(' ') ? `"${name}"` : name} `);
      },
      myName: () => this.myName(),
    });
    this.frames = new PartyFrames(() => this.togglePartyWindow(true));
    this.bubbles = new EmoteBubbles(d);
    this.menu = new PlayerMenu({
      whisper: (n) => this.whisperTo(n),
      invite: (n) => this.partyMsg({ action: 'invite', name: n }),
      trade: (n) => this.tradeMsg({ action: 'request', name: n }),
      block: (n, id) => this.block(n, id),
      unblock: (n, id) => {
        this.model.unblock(n, id);
        this.model.note(`Unblocked ${n}.`);
        this.chat.render();
      },
      isBlocked: (n) => this.model.isBlocked(n),
    });
    // click/tap another player: context menu (captured before the game turns the click into an attack)
    window.addEventListener('pointerdown', (e) => this.onPointer(e), true);
    // test hook (like window.__eigen): lets e2e scripts find players on screen
    (window as unknown as { __eigenSocial?: SocialClient }).__eigenSocial = this;
  }

  private send(type: string, msg: unknown): void {
    try {
      this.d.net().send(type, msg);
    } catch {
      /* not connected yet */
    }
  }
  private partyMsg(m: PartyMsg): void {
    this.send(MSG34.PARTY, m);
  }
  private tradeMsg(m: TradeMsg): void {
    this.send(MSG34.TRADE, m);
  }

  private myName(): string {
    return this.players?.get?.(this.d.myId())?.name ?? '';
  }
  private myAccount(): string {
    const me = this.myName();
    return this.party?.members?.find((m) => m.sid === this.d.myId() || m.name === me)?.accountId ?? '';
  }
  private myShard(): string {
    return this.party?.members?.find((m) => m.accountId === this.myAccount())?.shard ?? '';
  }

  // ───────────────────────── module hooks ─────────────────────────

  handlers(): Record<string, (m: any) => void> {
    return {
      [MSG34.CHAT_MSG]: (m: ChatMsg) => this.onChat(m),
      [MSG34.PARTY_STATE]: (m: PartyStateMsg) => this.onParty(m),
      [MSG34.PARTY_INVITE]: (m: PartyInviteMsg) => this.onInvite(m),
      [MSG34.EMOTE_EV]: (m: EmoteEvent) => this.onEmote(m),
      [MSG34.TRADE_REQ]: (m: TradeRequestMsg) => this.onTradeReq(m),
      [MSG34.TRADE_STATE]: (m: TradeStateMsg) => this.onTrade(m),
    };
  }

  onState(s: any): void {
    this.players = s?.players ?? null;
  }

  onWelcome(): void {
    if (!this.started) {
      this.started = true;
      this.chat.setVisible(true);
      this.model.note(
        'Welcome! Press Enter to chat, P for your party. Click a player to whisper, invite or trade. /help lists commands.',
      );
      this.chat.render();
    }
    // a new shard: any trade window from the old one is gone (the server cancelled it)
    if (this.trade) this.closeTradeWindow();
  }

  action(a: ExtAction): boolean {
    if (a === 'chat') {
      this.chat.focus();
      return true;
    }
    if (a === 'party') {
      this.togglePartyWindow();
      return true;
    }
    return false;
  }

  frame(now: number): void {
    this.bubbles.frame(now);
    if (now - this.lastFrames > 100) {
      this.lastFrames = now;
      this.updateFrames();
    }
  }

  debug(): Record<string, unknown> {
    return {
      social: {
        chat: this.model.lines.length,
        lastChat: this.model.lines[this.model.lines.length - 1]?.text ?? null,
        party: this.party?.id ?? null,
        members: this.party?.members?.length ?? 0,
        trade: this.tradeId,
        coins: this.d.profile.coins,
        pack: this.d.profile.inv.reduce<Record<string, number>>((o, st) => {
          if (st) o[st.id] = (o[st.id] ?? 0) + st.n;
          return o;
        }, {}),
        bubbles: this.bubbles.count(),
        prompts: this.prompts.count(),
        typing: this.chat.typing,
      },
    };
  }

  // ───────────────────────── chat ─────────────────────────

  private known(): string[] {
    const out = new Set<string>();
    this.players?.forEach?.((p: any) => {
      if (p?.name) out.add(p.name);
    });
    for (const m of this.party?.members ?? []) out.add(m.name);
    for (const l of this.model.lines.slice(-60)) {
      if (l.from) out.add(l.from);
      if (l.to) out.add(l.to);
    }
    return [...out];
  }

  private onChat(m: ChatMsg): void {
    if (!m || typeof m.text !== 'string') return;
    if (this.model.add(m, this.myName())) {
      if (m.ch === 'whisper' && m.from === this.myName() && m.to) this.lastWhisperTo = m.to;
      this.chat.arrived(m);
      if (m.ch === 'whisper' && m.from !== this.myName() && !this.chat.open)
        this.d.toasts.add(`${m.from} whispers: ${m.text}`, 'info');
    }
  }

  private submit(text: string): void {
    const cmd = parseCommand(text, {
      ch: this.chat.ch,
      whisperTo: this.chat.whisperTo,
      lastWhisper: this.model.lastWhisper,
      known: this.known(),
    });
    this.run(cmd);
  }

  private run(c: Cmd): void {
    const note = (t: string) => {
      this.model.note(t);
      this.chat.render();
    };
    switch (c.k) {
      case 'none':
        return;
      case 'say': {
        if (c.ch === 'party' && !this.party?.id) {
          note("You're not in a party. Invite someone with /invite name.");
          return;
        }
        const m: ChatSendMsg = { ch: c.ch, text: c.text, ...(c.to ? { to: c.to } : {}) };
        this.send(MSG34.CHAT, m);
        if (c.ch === 'whisper' && c.to) {
          this.lastWhisperTo = c.to;
          this.chat.setChannel('whisper', c.to);
        }
        return;
      }
      case 'channel':
        this.chat.setChannel(c.ch);
        return;
      case 'invite':
        this.partyMsg({ action: 'invite', name: c.name });
        return;
      case 'trade':
        this.tradeMsg({ action: 'request', name: c.name });
        return;
      case 'leave':
        this.partyMsg({ action: 'leave' });
        return;
      case 'kick':
      case 'promote': {
        const m = this.party?.members?.find((x) => x.name.toLowerCase() === c.name.toLowerCase());
        if (!m) {
          note(`${c.name} is not in your party.`);
          return;
        }
        this.partyMsg({ action: c.k, accountId: m.accountId });
        return;
      }
      case 'mute':
        this.model.mute(c.name, this.idOf(c.name));
        note(`Muted ${c.name}: you will not see their chat. /unmute ${c.name} to undo.`);
        return;
      case 'unmute':
        note(this.model.unmute(c.name, this.idOf(c.name)) ? `Unmuted ${c.name}.` : `${c.name} was not muted.`);
        return;
      case 'block':
        this.block(c.name, this.idOf(c.name));
        return;
      case 'unblock':
        note(this.model.unblock(c.name, this.idOf(c.name)) ? `Unblocked ${c.name}.` : `${c.name} was not blocked.`);
        return;
      case 'report':
        this.send(MSG34.REPORT, { name: c.name, reason: c.reason });
        return;
      case 'emote':
        this.emote(c.e);
        return;
      case 'help':
        if (c.topic === 'emotes') note(`Emotes: ${EMOTES.map((e) => `/${e} ${EMOTE_GLYPH[e]}`).join('  ')}`);
        else for (const l of HELP) note(l);
        return;
      case 'clear':
        this.model.clear();
        this.chat.render();
        return;
      case 'error':
        note(c.text);
        return;
    }
  }

  /** account id for a name when we have seen it (chat lines, party): lets a block survive a rename */
  private idOf(name: string): string {
    const n = name.toLowerCase();
    const pm = this.party?.members?.find((m) => m.name.toLowerCase() === n);
    if (pm) return pm.accountId;
    for (let i = this.model.lines.length - 1; i >= 0; i--) {
      const l = this.model.lines[i]!;
      if (l.from.toLowerCase() === n && l.fromId) return l.fromId;
    }
    return '';
  }

  private block(name: string, id: string): void {
    this.model.block(name, id || this.idOf(name));
    this.model.note(
      `Blocked ${name}: their chat, emotes, invites and trade requests are hidden. /unblock ${name} to undo.`,
    );
    this.chat.render();
  }

  private whisperTo(name: string): void {
    this.chat.setChannel('whisper', name);
    this.chat.focus('');
  }

  private emote(e: Emote): void {
    this.send(MSG34.EMOTE, { e });
  }

  private onEmote(m: EmoteEvent): void {
    if (!m || typeof m.id !== 'string' || !(EMOTES as readonly string[]).includes(m.e)) return;
    const name = this.players?.get?.(m.id)?.name ?? '';
    if (name && name !== this.myName() && this.model.isBlocked(name)) return;
    this.bubbles.show(m.id, m.e);
  }

  // ───────────────────────── party ─────────────────────────

  private onParty(m: PartyStateMsg): void {
    const had = this.party?.id ?? null;
    this.party = m?.id ? m : null;
    if (had && !this.party) {
      if (this.chat.ch === 'party') this.chat.setChannel('local');
    }
    if (!had && this.party) this.model.note('You are in a party. /p talks to the party; P opens the party window.');
    this.partyWin?.update(this.party, this.myAccount(), this.myShard());
    this.updateFrames();
  }

  private onInvite(m: PartyInviteMsg): void {
    if (!m || typeof m.partyId !== 'string' || typeof m.from !== 'string') return;
    if (this.model.isBlocked(m.from)) {
      this.partyMsg({ action: 'decline', partyId: m.partyId });
      return;
    }
    this.d.sfx('coin');
    this.prompts.add(`party:${m.partyId}`, {
      kind: 'party',
      ms: INVITE_MS,
      text: `${m.from} invites you to a party.`,
      accept: () => this.partyMsg({ action: 'accept', partyId: m.partyId }),
      decline: () => this.partyMsg({ action: 'decline', partyId: m.partyId }),
    });
  }

  togglePartyWindow(forceOpen = false): void {
    if (this.d.wins.name === 'party' && !forceOpen) {
      this.d.wins.close();
      return;
    }
    if (this.d.wins.name === 'party') return;
    const w = buildPartyWindow({
      invite: (name) => this.partyMsg({ action: 'invite', name }),
      leave: () => this.partyMsg({ action: 'leave' }),
      kick: (m) => {
        if (confirm(`Remove ${m.name} from the party?`)) this.partyMsg({ action: 'kick', accountId: m.accountId });
      },
      promote: (m) => this.partyMsg({ action: 'promote', accountId: m.accountId }),
      whisper: (name) => {
        this.d.wins.close();
        this.whisperTo(name);
      },
    });
    this.partyWin = w;
    w.update(this.party, this.myAccount(), this.myShard());
    this.d.wins.show('party', 'Party', w.el, {
      onClose: () => {
        this.partyWin = null;
      },
    });
  }

  private geo(m: PartyMember): FrameGeo {
    const me = this.d.me();
    if (!me) return { angle: null, dist: null, visible: false };
    const local = m.sid ? this.d.entityPos(m.sid) : null;
    const pos = local ?? (m.maxHp ? { x: m.x, y: m.y } : null);
    if (!pos) return { angle: null, dist: null, visible: false };
    const dist = Math.hypot(pos.x - me.x, pos.y - me.y);
    const a = this.d.toScreen(me.x, me.y),
      b = this.d.toScreen(pos.x, pos.y);
    const visible = !!local && b.x > 0 && b.y > 0 && b.x < window.innerWidth && b.y < window.innerHeight;
    if (visible || dist < 1) return { angle: null, dist, visible: true };
    return { angle: Math.atan2(b.y - a.y, b.x - a.x), dist, visible: false };
  }

  private updateFrames(): void {
    if (!this.started) return;
    this.frames.update(this.party, this.myAccount(), this.myShard(), (m) => this.geo(m));
  }

  // ───────────────────────── trade ─────────────────────────

  private onTradeReq(m: TradeRequestMsg): void {
    if (!m || typeof m.id !== 'string' || typeof m.from !== 'string') return;
    if (this.model.isBlocked(m.from)) {
      this.tradeMsg({ action: 'decline', id: m.id });
      return;
    }
    this.prompts.add(`trade:${m.id}`, {
      kind: 'trade',
      ms: TRADE_REQ_MS,
      text: `${m.from} wants to trade with you.`,
      accept: () => this.tradeMsg({ action: 'accept', id: m.id }),
      decline: () => this.tradeMsg({ action: 'decline', id: m.id }),
    });
  }

  private onTrade(m: TradeStateMsg): void {
    if (!m) return;
    if (!m.id) {
      const was = this.tradeId;
      this.tradeId = null;
      if (this.trade) this.closeTradeWindow();
      if (was) {
        const r = m.reason ?? 'cancelled';
        if (r === 'done') this.d.toasts.add('Trade complete!', 'good');
        else this.d.toasts.add(r === 'cancelled' ? 'Trade cancelled.' : r, 'bad');
      }
      return;
    }
    this.tradeId = m.id;
    if (!this.trade || this.d.wins.name !== 'trade') {
      this.closeTradeWindow();
      const w = new TradeWindow(this.d.profile, this.d.tip, {
        offer: (items, coins) => this.tradeMsg({ action: 'offer', items, coins }),
        confirm: () => this.tradeMsg({ action: 'confirm' }),
        cancel: () => this.tradeMsg({ action: 'cancel' }),
      });
      this.trade = w;
      this.d.wins.show('trade', `Trade with ${m.other ?? '…'}`, w.el, {
        wide: true,
        // closing the window (Esc, ✕, another window) cancels the trade
        onClose: () => {
          if (this.trade === w) {
            this.trade = null;
            w.destroy();
            if (this.tradeId) this.tradeMsg({ action: 'cancel' });
          }
        },
      });
    }
    this.trade.set(m);
  }

  private closeTradeWindow(): void {
    const w = this.trade;
    this.trade = null;
    w?.destroy();
    if (this.d.wins.name === 'trade') this.d.wins.close();
  }

  // ───────────────────────── clicking players ─────────────────────────

  /** Screen position (CSS px) of another player's body by name (e2e/tests). */
  screenOf(name: string): { x: number; y: number } | null {
    let out: { x: number; y: number } | null = null;
    const S = Math.abs(this.d.toScreen(1, 0).x - this.d.toScreen(0, 0).x) / 16 || 1;
    this.players?.forEach?.((p: any, id: string) => {
      if (p?.name !== name || id === this.d.myId()) return;
      const pos = this.d.entityPos(id);
      if (pos) {
        const s = this.d.toScreen(pos.x, pos.y);
        out = { x: s.x, y: s.y - 12 * S };
      }
    });
    return out;
  }

  /** Another player under a screen point (session id + name), using their projected sprite box. */
  playerAt(x: number, y: number): { id: string; name: string } | null {
    if (!this.players?.forEach) return null;
    const S = Math.abs(this.d.toScreen(1, 0).x - this.d.toScreen(0, 0).x) / 16 || 1;
    let best: { id: string; name: string } | null = null,
      bestD = Infinity;
    const me = this.d.myId();
    this.players.forEach((p: any, id: string) => {
      if (id === me) return;
      const pos = this.d.entityPos(id);
      if (!pos) return;
      const s = this.d.toScreen(pos.x, pos.y);
      const dx = x - s.x,
        dy = y - (s.y - 13 * S);
      if (Math.abs(dx) > 10 * S || Math.abs(dy) > 17 * S) return;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) {
        bestD = dd;
        best = { id, name: p.name ?? '' };
      }
    });
    return best;
  }

  private onPointer(e: PointerEvent): void {
    const t = e.target as HTMLElement | null;
    if (!t || t.id !== 'game' || e.button !== 0 || this.d.wins.open) return;
    const hit = this.playerAt(e.clientX, e.clientY);
    if (!hit || !hit.name) return;
    // ours: the game must not also read this as an attack
    e.stopImmediatePropagation();
    e.preventDefault();
    // first click selects the player (heals and threads can aim at them); clicking the selected player opens the menu
    if (this.d.target()?.id !== hit.id) {
      this.d.setTarget(hit.id);
      return;
    }
    this.menu.show(hit.name, '', e.clientX, e.clientY);
  }
}
