import { CHAT_MAX, EMOTES, EMOTE_GLYPH, type ChatMsg, type Emote } from '@eigenlands/shared';
import { clear, h } from '../../ui/dom';
import { TABS, TAB_LABEL, type ChatModel, type SayCh, type Tab } from './model';

const CH_TAG: Record<ChatMsg['ch'], string> = { local: 'L', global: 'G', party: 'P', whisper: 'W', system: '•' };
const CH_NAME: Record<SayCh, string> = { local: 'Local', global: 'Global', party: 'Party', whisper: 'Whisper' };
const OPEN_KEY = 'eigen.chat.open';

export interface ChatPanelHooks {
  /** a line was submitted (already trimmed, maybe a /command) */
  submit(text: string): void;
  emote(e: Emote): void;
  /** the name in a line was clicked */
  nameClick(name: string): void;
  myName(): string;
}

const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Bottom-left chat: channel tabs with unread badges, timestamps, coloured channels, emote buttons, a channel pill for
 * plain lines and a collapsed mode (a small button with the unread count). Enter focuses (through the input action),
 * Esc stops typing without closing any open window, ↑/↓ recall sent lines.
 */
export class ChatPanel {
  readonly root = h('div', { id: 'chat', class: 'chat panel', data: { open: '1' } });
  readonly input = h('input', {
    class: 'chat-in',
    placeholder: 'Press Enter to chat · /help',
    maxLength: CHAT_MAX + 40,
  }) as HTMLInputElement;
  private log = h('div', { class: 'chat-log', id: 'chat-log' });
  private tabs = h('div', { class: 'chat-tabs', id: 'chat-tabs' });
  private pill = h('button', { class: 'chat-ch', title: 'Channel for plain lines (click to switch)' });
  private emotes = h('div', { class: 'chat-emotes' });
  private mini = h('button', { id: 'chat-mini', class: 'chat-mini', title: 'Chat (Enter)' });
  private tabBtns = new Map<Tab, HTMLButtonElement>();
  /** channel plain lines go to, and the whisper target when it is "whisper" */
  ch: SayCh = 'local';
  whisperTo = '';
  private renderedLen = -1;
  private renderedTab: Tab | null = null;
  private renderedFirst: ChatMsg | null = null;
  open: boolean;
  /** lines that arrived while the panel was collapsed */
  private unseen = 0;

  constructor(
    private model: ChatModel,
    private hooks: ChatPanelHooks,
  ) {
    this.log.setAttribute('role', 'log');
    this.log.setAttribute('aria-live', 'polite');
    this.log.setAttribute('aria-label', 'Chat messages');
    this.input.setAttribute('aria-label', 'Chat message');
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    for (const t of TABS) {
      const b = h(
        'button',
        { class: 'chat-tab', data: { tab: t }, on: { click: () => this.setTab(t) } },
        TAB_LABEL[t],
        h('span', { class: 'badge' }),
      );
      this.tabBtns.set(t, b);
      this.tabs.append(b);
    }
    const collapse = h('button', {
      class: 'chat-x',
      title: 'Hide chat',
      text: '–',
      on: { click: () => this.setOpen(false) },
    });
    collapse.setAttribute('aria-label', 'Hide chat');
    for (const e of EMOTES) {
      const b = h('button', {
        class: 'emote-btn',
        title: `/${e}`,
        text: EMOTE_GLYPH[e],
        data: { e },
        on: {
          click: () => {
            this.hooks.emote(e);
            this.emotes.hidden = true;
          },
        },
      });
      b.setAttribute('aria-label', `Emote: ${e}`);
      this.emotes.append(b);
    }
    this.emotes.hidden = true;
    const emoteBtn = h('button', {
      class: 'chat-emo',
      title: 'Emotes',
      text: '☺',
      on: {
        click: () => {
          this.emotes.hidden = !this.emotes.hidden;
        },
      },
    });
    emoteBtn.setAttribute('aria-label', 'Emotes');
    const send = h('button', { class: 'chat-send', title: 'Send', text: '➤', on: { click: () => this.submit(false) } });
    send.setAttribute('aria-label', 'Send');
    this.pill.addEventListener('click', () => this.cycleChannel());
    this.root.append(
      h('div', { class: 'chat-head' }, this.tabs, collapse),
      this.log,
      this.emotes,
      h('div', { class: 'chat-row' }, this.pill, this.input, emoteBtn, send),
    );
    this.mini.append(h('span', { text: '💬' }), h('span', { class: 'badge' }));
    this.mini.setAttribute('aria-label', 'Open chat');
    this.mini.addEventListener('click', () => {
      this.setOpen(true);
      this.focus();
    });

    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('focus', () => this.root.classList.add('typing'));
    this.input.addEventListener('blur', () => this.root.classList.remove('typing'));
    this.log.addEventListener('click', (e) => {
      const n = (e.target as HTMLElement).closest<HTMLElement>('.cn');
      if (n?.dataset.name) this.hooks.nameClick(n.dataset.name);
    });
    // clicks on the panel never reach the game (no accidental attacks)
    for (const el of [this.root, this.mini]) el.addEventListener('pointerdown', (e) => e.stopPropagation());

    let saved: string | null = null;
    try {
      saved = localStorage.getItem(OPEN_KEY);
    } catch {
      /* ignore */
    }
    this.open = saved === '1';
    this.root.hidden = true;
    this.mini.hidden = true;
    document.body.append(this.root, this.mini);
    this.updatePill();
  }

  show(): void {
    this.setOpen(this.open, false);
  }

  setOpen(on: boolean, persist = true): void {
    this.open = on;
    this.root.hidden = !on;
    this.mini.hidden = on;
    document.body.classList.toggle('chat-open', on);
    if (!on && document.activeElement === this.input) this.input.blur();
    if (persist)
      try {
        localStorage.setItem(OPEN_KEY, on ? '1' : '0');
      } catch {
        /* ignore */
      }
    if (on) {
      this.unseen = 0;
      this.renderedLen = -1;
      this.render();
    }
    this.badges();
  }

  get typing(): boolean {
    return document.activeElement === this.input;
  }

  focus(prefill?: string): void {
    if (!this.open) this.setOpen(true);
    if (prefill !== undefined) this.input.value = prefill;
    this.input.focus();
    const n = this.input.value.length;
    this.input.setSelectionRange(n, n);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submit(true);
      return;
    }
    if (e.key === 'Escape') {
      // stop typing only: the windows system and settings must not also see this Escape
      e.preventDefault();
      e.stopPropagation();
      if (!this.emotes.hidden) {
        this.emotes.hidden = true;
        return;
      }
      this.input.blur();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.input.value = this.model.prev(this.input.value);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.input.value = this.model.next();
      return;
    }
  }

  private submit(blurAfter: boolean): void {
    const text = this.input.value.trim();
    this.input.value = '';
    if (text) {
      this.model.pushHistory(text);
      this.hooks.submit(text);
    }
    if (blurAfter) this.input.blur();
    else this.input.focus();
  }

  setTab(t: Tab): void {
    this.model.setTab(t);
    if (t === 'local' || t === 'party' || t === 'global') this.setChannel(t);
    else if (t === 'whisper' && (this.whisperTo || this.model.lastWhisper))
      this.setChannel('whisper', this.whisperTo || this.model.lastWhisper);
    this.render();
  }

  setChannel(ch: SayCh, to?: string): void {
    this.ch = ch;
    if (to) this.whisperTo = to;
    this.updatePill();
  }

  private cycleChannel(): void {
    const order: SayCh[] = [
      'local',
      'party',
      'global',
      ...(this.whisperTo || this.model.lastWhisper ? ['whisper' as const] : []),
    ];
    const next = order[(order.indexOf(this.ch) + 1) % order.length]!;
    this.setChannel(next, next === 'whisper' ? this.whisperTo || this.model.lastWhisper : undefined);
    this.input.focus();
  }

  private updatePill(): void {
    this.pill.textContent = this.ch === 'whisper' ? `→ ${this.whisperTo}` : CH_NAME[this.ch];
    this.pill.className = `chat-ch ch-${this.ch}`;
    this.input.placeholder =
      this.ch === 'whisper' ? `Whisper to ${this.whisperTo}…` : `Say in ${CH_NAME[this.ch]} · Enter · /help`;
  }

  private line(m: ChatMsg): HTMLElement {
    const me = this.hooks.myName();
    const el = h(
      'div',
      { class: `cl ch-${m.ch}` },
      h('span', { class: 'ct', text: hhmm(m.t) }),
      h('span', { class: 'cc', text: CH_TAG[m.ch] }),
    );
    if (m.ch === 'system') {
      el.append(h('span', { class: 'cx', text: m.text }));
      return el;
    }
    const name = (n: string) =>
      h('b', { class: 'cn', text: n, data: { name: n }, title: n === me ? '' : `Whisper ${n}` });
    if (m.ch === 'whisper') {
      if (m.from === me && m.to) el.append(h('span', { class: 'cw', text: 'To ' }), name(m.to));
      else el.append(h('span', { class: 'cw', text: 'From ' }), name(m.from));
    } else el.append(name(m.from));
    el.append(h('span', { class: 'cx', text: `: ${m.text}` }));
    return el;
  }

  /** Re-draw the log (only appends when nothing else changed), keeping the scroll pinned to the bottom. */
  render(): void {
    if (this.open) {
      const vis = this.model.visible();
      const pinned = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 24;
      const canAppend =
        this.renderedTab === this.model.tab &&
        this.renderedLen >= 0 &&
        vis.length > this.renderedLen &&
        vis[0] === this.renderedFirst;
      if (canAppend) {
        for (const m of vis.slice(this.renderedLen)) this.log.append(this.line(m));
      } else if (!(
        this.renderedTab === this.model.tab &&
        vis.length === this.renderedLen &&
        vis[0] === this.renderedFirst
      )) {
        clear(this.log);
        for (const m of vis) this.log.append(this.line(m));
      }
      this.renderedLen = vis.length;
      this.renderedTab = this.model.tab;
      this.renderedFirst = vis[0] ?? null;
      if (pinned || !canAppend) this.log.scrollTop = this.log.scrollHeight;
    }
    this.badges();
  }

  private badges(): void {
    for (const [t, b] of this.tabBtns) {
      b.classList.toggle('on', this.model.tab === t);
      const n = this.model.unread[t];
      const badge = b.querySelector('.badge')!;
      badge.textContent = n ? (n > 99 ? '99+' : String(n)) : '';
    }
    this.mini.querySelector('.badge')!.textContent =
      !this.open && this.unseen ? (this.unseen > 99 ? '99+' : String(this.unseen)) : '';
  }

  arrived(m: ChatMsg): void {
    if (!this.open && m.ch !== 'system' && m.from !== this.hooks.myName()) this.unseen++;
    if (this.open) this.unseen = 0;
    this.render();
  }

  setVisible(on: boolean): void {
    if (!on) {
      this.root.hidden = true;
      this.mini.hidden = true;
      return;
    }
    this.setOpen(this.open, false);
  }
}
