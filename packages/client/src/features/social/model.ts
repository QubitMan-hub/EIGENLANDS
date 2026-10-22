/**
 * Chat model and slash-command parser (no DOM: unit tested). The chat panel renders what this keeps: the message
 * list, per-tab unread counts, the sent-line history and the client-side block and mute lists.
 */
import { CHAT_MAX, EMOTES, type ChatMsg, type Emote } from '@eigenlands/shared';

export type Tab = 'all' | 'local' | 'party' | 'global' | 'whisper';
export const TABS: Tab[] = ['all', 'local', 'party', 'global', 'whisper'];
export const TAB_LABEL: Record<Tab, string> = { all: 'All', local: 'Local', party: 'Party', global: 'Global', whisper: 'Whisper' };
export type SayCh = 'local' | 'global' | 'party' | 'whisper';

export type Cmd =
  | { k: 'say'; ch: SayCh; text: string; to?: string }
  | { k: 'channel'; ch: Exclude<SayCh, 'whisper'> }
  | { k: 'invite' | 'trade' | 'mute' | 'unmute' | 'block' | 'unblock' | 'kick' | 'promote'; name: string }
  | { k: 'leave' }
  | { k: 'report'; name: string; reason: string }
  | { k: 'emote'; e: Emote }
  | { k: 'help'; topic?: 'emotes' }
  | { k: 'clear' }
  | { k: 'error'; text: string }
  | { k: 'none' };

export interface ParseCtx {
  /** channel for plain lines */
  ch: SayCh;
  /** whisper target when `ch` is whisper */
  whisperTo?: string;
  /** who whispered us last (for /r) */
  lastWhisper?: string;
  /** names we know (players nearby, party, chat): lets multi-word names work without quotes */
  known?: string[];
}

export const HELP: string[] = [
  'Enter: chat · Esc: stop typing · ↑/↓: previous lines',
  '/l or /s text: local · /p text: party · /g text: global (1 per 3 s)',
  '/w name text: whisper · /r text: reply to the last whisper',
  '/invite name · /kick name · /promote name · /leave (party)',
  '/trade name · /emote name (or /wave /dance /cheer /sit /bow /laugh /heart /think)',
  '/mute name · /unmute name (hide their chat) · /block name · /unblock name (hide them entirely)',
  '/report name reason · /clear · /help',
];

const ALIASES: Record<string, string> = {
  w: 'w', whisper: 'w', tell: 'w', msg: 'w', t: 'w', r: 'r', reply: 'r',
  p: 'p', party: 'p', g: 'g', global: 'g', l: 'l', local: 'l', s: 'l', say: 'l',
  invite: 'invite', inv: 'invite', trade: 'trade', mute: 'mute', unmute: 'unmute', block: 'block', ignore: 'block',
  unblock: 'unblock', unignore: 'unblock', kick: 'kick', promote: 'promote', leave: 'leave', leaveparty: 'leave',
  report: 'report', emote: 'emote', e: 'emote', me: 'emote', emotes: 'emotes', help: 'help', '?': 'help', clear: 'clear',
};

/**
 * Split "name rest" where names may contain spaces: a quoted name, else the longest known name that starts the text,
 * else the first word.
 */
export function splitName(s: string, known: string[] = []): [string, string] {
  const t = s.trim();
  if (!t) return ['', ''];
  const q = /^"([^"]+)"\s*(.*)$/.exec(t);
  if (q) return [q[1]!.trim(), q[2]!.trim()];
  const low = t.toLowerCase();
  let best = '';
  for (const k of known) {
    const kl = k.toLowerCase();
    if (kl.length > best.length && low.startsWith(kl) && (low.length === kl.length || low[kl.length] === ' ')) best = k;
  }
  if (best) return [t.slice(0, best.length), t.slice(best.length).trim()];
  const i = t.indexOf(' ');
  return i < 0 ? [t, ''] : [t.slice(0, i), t.slice(i + 1).trim()];
}

/** Turn one typed line into a command. */
export function parseCommand(raw: string, ctx: ParseCtx): Cmd {
  const line = raw.trim();
  if (!line) return { k: 'none' };
  if (!line.startsWith('/') || line.startsWith('//')) {
    const text = (line.startsWith('//') ? line.slice(1) : line).slice(0, CHAT_MAX);
    if (ctx.ch === 'whisper') {
      if (!ctx.whisperTo) return { k: 'error', text: 'Who to? Use /w name message.' };
      return { k: 'say', ch: 'whisper', text, to: ctx.whisperTo };
    }
    return { k: 'say', ch: ctx.ch, text };
  }
  const sp = line.indexOf(' ');
  const word = (sp < 0 ? line.slice(1) : line.slice(1, sp)).toLowerCase();
  const rest = sp < 0 ? '' : line.slice(sp + 1).trim();
  if ((EMOTES as readonly string[]).includes(word)) return { k: 'emote', e: word as Emote };
  const cmd = ALIASES[word];
  const needName = (k: 'invite' | 'trade' | 'mute' | 'unmute' | 'block' | 'unblock' | 'kick' | 'promote'): Cmd => {
    const [name] = splitName(rest, ctx.known);
    return name ? { k, name } : { k: 'error', text: `Usage: /${word} name` };
  };
  switch (cmd) {
    case 'w': {
      const [to, text] = splitName(rest, ctx.known);
      if (!to || !text) return { k: 'error', text: 'Usage: /w name message' };
      return { k: 'say', ch: 'whisper', to, text: text.slice(0, CHAT_MAX) };
    }
    case 'r':
      if (!ctx.lastWhisper) return { k: 'error', text: 'Nobody has whispered you yet.' };
      if (!rest) return { k: 'error', text: 'Usage: /r message' };
      return { k: 'say', ch: 'whisper', to: ctx.lastWhisper, text: rest.slice(0, CHAT_MAX) };
    case 'p': case 'g': case 'l': {
      const ch = cmd === 'p' ? 'party' : cmd === 'g' ? 'global' : 'local';
      return rest ? { k: 'say', ch, text: rest.slice(0, CHAT_MAX) } : { k: 'channel', ch };
    }
    case 'invite': case 'trade': case 'mute': case 'unmute': case 'block': case 'unblock': case 'kick': case 'promote':
      return needName(cmd);
    case 'leave': return { k: 'leave' };
    case 'report': {
      const [name, reason] = splitName(rest, ctx.known);
      if (!name) return { k: 'error', text: 'Usage: /report name reason' };
      return { k: 'report', name, reason: reason || 'no reason given' };
    }
    case 'emote': {
      const e = rest.toLowerCase().split(/\s+/)[0] ?? '';
      if ((EMOTES as readonly string[]).includes(e)) return { k: 'emote', e: e as Emote };
      return { k: 'help', topic: 'emotes' };
    }
    case 'emotes': return { k: 'help', topic: 'emotes' };
    case 'help': return { k: 'help' };
    case 'clear': return { k: 'clear' };
    default: return { k: 'error', text: `Unknown command /${word}. Type /help for the list.` };
  }
}

/** Which tab a channel belongs to (system lines show everywhere). */
export const tabOf = (ch: ChatMsg['ch']): Tab | null => (ch === 'system' ? null : ch);
export const inTab = (m: ChatMsg, tab: Tab): boolean => tab === 'all' || m.ch === 'system' || m.ch === tab;

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const BLOCK_KEY = 'eigen.blocked';
const MUTE_KEY = 'eigen.muted';

function readList(s: Store | null, key: string): string[] {
  try {
    const v = JSON.parse(s?.getItem(key) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 500) : [];
  } catch { return []; }
}

export class ChatModel {
  lines: ChatMsg[] = [];
  readonly max: number;
  tab: Tab = 'all';
  unread: Record<Tab, number> = { all: 0, local: 0, party: 0, global: 0, whisper: 0 };
  /** name of the last player who whispered us (for /r) */
  lastWhisper = '';
  /** names/ids the player blocked (everything hidden) or muted (chat hidden); stored lowercase / as ids */
  blocked: Set<string>;
  muted: Set<string>;
  private history: string[] = [];
  private histPos = -1;
  private draft = '';
  private seen = new Set<string>();
  private seenOrder: string[] = [];

  constructor(private store: Store | null = null, max = 200) {
    this.max = max;
    this.blocked = new Set(readList(store, BLOCK_KEY));
    this.muted = new Set(readList(store, MUTE_KEY));
  }

  private save(): void {
    try { this.store?.setItem(BLOCK_KEY, JSON.stringify([...this.blocked])); this.store?.setItem(MUTE_KEY, JSON.stringify([...this.muted])); } catch { /* full or blocked storage */ }
  }

  isBlocked(name: string, id = ''): boolean { return this.blocked.has(name.toLowerCase()) || (!!id && this.blocked.has(`#${id}`)); }
  isMuted(name: string, id = ''): boolean { return this.isBlocked(name, id) || this.muted.has(name.toLowerCase()) || (!!id && this.muted.has(`#${id}`)); }

  /** Block by name (and account id when known, so a renamed player stays blocked). */
  block(name: string, id = ''): void { this.blocked.add(name.toLowerCase()); if (id) this.blocked.add(`#${id}`); this.save(); }
  unblock(name: string, id = ''): boolean {
    const had = this.blocked.delete(name.toLowerCase());
    if (id) this.blocked.delete(`#${id}`);
    this.save();
    return had;
  }
  mute(name: string, id = ''): void { this.muted.add(name.toLowerCase()); if (id) this.muted.add(`#${id}`); this.save(); }
  unmute(name: string, id = ''): boolean {
    const had = this.muted.delete(name.toLowerCase());
    if (id) this.muted.delete(`#${id}`);
    this.save();
    return had;
  }

  /** Add an incoming line. Returns false when it is hidden (blocked/muted sender) or a duplicate (replays). */
  add(m: ChatMsg, myName = ''): boolean {
    if (m.ch !== 'system' && m.from && m.from !== myName && this.isMuted(m.from, m.fromId)) return false;
    const key = `${m.t}|${m.fromId}|${m.ch}|${m.to ?? ''}|${m.text}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key); this.seenOrder.push(key);
    if (this.seenOrder.length > this.max * 2) this.seen.delete(this.seenOrder.shift()!);
    this.lines.push(m);
    if (this.lines.length > this.max) this.lines.splice(0, this.lines.length - this.max);
    if (m.ch === 'whisper' && m.from && m.from !== myName) this.lastWhisper = m.from;
    const own = m.from === myName;
    if (!own && m.ch !== 'system') {
      for (const t of TABS) if (t !== this.tab && t !== 'all' && inTab(m, t)) this.unread[t]++;
      if (this.tab !== 'all') this.unread.all++;
    }
    return true;
  }

  /** A local note (help, errors) shown as a system line. */
  note(text: string): void { this.add({ ch: 'system', from: '', fromId: '', text, t: Date.now() + Math.random() }); }

  visible(tab: Tab = this.tab): ChatMsg[] { return this.lines.filter((m) => inTab(m, tab)); }

  setTab(t: Tab): void { this.tab = t; this.unread[t] = 0; }
  totalUnread(): number { return TABS.filter((t) => t !== 'all').reduce((a, t) => a + this.unread[t], 0); }
  clear(): void { this.lines = []; for (const t of TABS) this.unread[t] = 0; }

  /** Remember a sent line for ↑/↓ recall. */
  pushHistory(text: string): void {
    const t = text.trim();
    if (t && this.history[this.history.length - 1] !== t) this.history.push(t);
    if (this.history.length > 50) this.history.shift();
    this.histPos = -1; this.draft = '';
  }
  /** ↑: older line (current input kept as a draft). */
  prev(current: string): string {
    if (!this.history.length) return current;
    if (this.histPos === -1) { this.draft = current; this.histPos = this.history.length; }
    this.histPos = Math.max(0, this.histPos - 1);
    return this.history[this.histPos]!;
  }
  /** ↓: newer line, then back to the draft. */
  next(): string {
    if (this.histPos === -1) return this.draft;
    this.histPos++;
    if (this.histPos >= this.history.length) { this.histPos = -1; return this.draft; }
    return this.history[this.histPos]!;
  }
}
