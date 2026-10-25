import {
  EMOTES,
  LOCAL_CHAT_RANGE,
  MSG34,
  cleanChat,
  isSpammy,
  type ChatMsg,
  type ChatSendMsg,
  type Emote,
  type EmoteEvent,
  type EmoteMsg,
  type ReportMsg,
} from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { runtime34 } from '../runtime34';
import type { PartyBusMsg, PlayerBusMsg, SocialHub } from './hub';
import type { PartyRoom } from './partyroom';
import { deliver, nameArg, sys } from './util';

/** emote bubbles are shown to players this close (tiles) */
export const EMOTE_RANGE = 40;
const EMOTE_GAP_MS = 700;
const REPEAT_WINDOW_MS = 30_000;
const REPORT_CONTEXT = 10;
const MUTE_REFRESH_MS = 60_000;

type SendCh = ChatSendMsg['ch'];
const CHANNELS: ReadonlySet<string> = new Set<SendCh>(['local', 'global', 'party', 'whisper']);

/** Lowercase, squeeze spaces and repeated letters: "HELLO!!" and "hello !" count as the same line. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .replace(/(.)\1+/g, '$1');

/**
 * Chat for one shard: local (nearby, same shard), global (every shard, over the bus), party, whisper (any shard),
 * system lines, emotes and reports. Moderation: filter, spam check, repeated-line suppression, per-channel token
 * buckets kept per account (so a shard handoff does not reset them) and the admin mute flag.
 */
export class ChatRoom {
  private muteCheck = new Map<string, number>();

  constructor(
    private room: GameRoom,
    private hub: SocialHub,
    private party: PartyRoom,
  ) {}

  private send(p: ServerPlayer, msg: ChatMsg): void {
    deliver(this.hub, p, msg);
  }

  join(p: ServerPlayer, fresh: boolean): void {
    this.refreshMute(p);
    // a new session sees recent global chat; a shard handoff already has it
    if (fresh) for (const m of this.hub.globalLog) this.send(p, m);
  }

  leave(p: ServerPlayer): void {
    this.muteCheck.delete(p.accountId);
  }

  private refreshMute(p: ServerPlayer): void {
    this.muteCheck.set(p.accountId, Date.now());
    const lim = this.hub.limitsOf(p.accountId);
    runtime34()
      .repo34.mutedUntil(p.accountId)
      .then((t) => {
        lim.mutedUntil = t;
      })
      .catch(() => {});
  }

  /** Re-read the admin mute flag of each player now and then (a moderator may mute someone who is online). */
  tick(now: number): void {
    for (const p of this.room.players.values()) {
      const at = this.muteCheck.get(p.accountId) ?? 0;
      if (now - at > MUTE_REFRESH_MS) this.refreshMute(p);
    }
  }

  // ───────────────────────── sending ─────────────────────────

  async handle(p: ServerPlayer, m: ChatSendMsg): Promise<void> {
    if (typeof m.ch !== 'string' || !CHANNELS.has(m.ch)) return;
    const text = cleanChat(m.text);
    if (!text) return;
    const lim = this.hub.limitsOf(p.accountId);
    const now = Date.now();
    if (lim.mutedUntil > now) {
      const mins = Math.ceil((lim.mutedUntil - now) / 60_000);
      sys(
        this.hub,
        p,
        `You are muted for ${mins > 60 * 24 * 365 ? 'a long time' : `${mins} more minute${mins === 1 ? '' : 's'}`}.`,
      );
      return;
    }
    if (isSpammy(text)) {
      sys(this.hub, p, 'That looks like spam, so it was not sent.');
      return;
    }
    const ch = m.ch as SendCh;
    let to = '';
    let partyId = '';
    if (ch === 'whisper') {
      to = nameArg(m.to);
      if (!to) return;
      if (to.toLowerCase() === p.name.toLowerCase()) {
        sys(this.hub, p, "You can't whisper to yourself.");
        return;
      }
    } else if (ch === 'party') {
      partyId = this.party.partyOf(p.accountId);
      if (!partyId) {
        sys(this.hub, p, "You're not in a party. Invite someone with /invite name.");
        return;
      }
    }
    // repeated-line suppression (any channel)
    const n = norm(text) || text;
    lim.recent = lim.recent.filter((r) => now - r.t < REPEAT_WINDOW_MS);
    const last = lim.recent[lim.recent.length - 1];
    const repeats = lim.recent.filter((r) => r.norm === n).length;
    if ((last && last.norm === n && now - last.t < 10_000) || repeats >= 2) {
      this.warn(p, 'You just said that.');
      return;
    }
    if (!lim.buckets[ch].take(1, now)) {
      this.warn(
        p,
        ch === 'global'
          ? 'Global chat is limited to one message every 3 seconds.'
          : 'Slow down: you are sending messages too fast.',
      );
      return;
    }
    lim.recent.push({ norm: n, t: now });
    if (lim.recent.length > 8) lim.recent.shift();

    const msg: ChatMsg = { ch, from: p.name, fromId: p.accountId, text, t: now };
    if (ch === 'local') {
      for (const q of this.room.nearby(p.sim.x, p.sim.y, LOCAL_CHAT_RANGE)) this.send(q, msg);
    } else if (ch === 'global') {
      this.hub.bus.publish('chat:global', { msg });
    } else if (ch === 'party') {
      this.hub.bus.publish(`party:${partyId}`, { t: 'chat', msg } satisfies PartyBusMsg);
    } else {
      const t = await this.hub.dir.find(to);
      if (!t) {
        sys(this.hub, p, `${to} is not online.`);
        return;
      }
      if (t.accountId === p.accountId) {
        sys(this.hub, p, "You can't whisper to yourself.");
        return;
      }
      const w: ChatMsg = { ...msg, to: t.name };
      this.hub.bus.publish(`player:${t.accountId}`, { t: 'whisper', msg: w } satisfies PlayerBusMsg);
      this.send(p, w); // the sender's own copy ("To X: ...")
    }
  }

  /** Rate-limited system warnings (so spamming does not turn into a flood of warnings). */
  private warn(p: ServerPlayer, text: string): void {
    const lim = this.hub.limitsOf(p.accountId);
    const now = Date.now();
    if (now - lim.warnAt < 1500) return;
    lim.warnAt = now;
    sys(this.hub, p, text);
  }

  onGlobal(msg: ChatMsg): void {
    for (const q of this.room.players.values()) this.send(q, msg);
  }

  onPartyChat(partyId: string, msg: ChatMsg): void {
    this.party.onPartyChat(partyId, msg, (q, m) => this.send(q, m));
  }

  /** A whisper or system line for a player on this shard (from any shard). */
  onPlayerBus(p: ServerPlayer, m: PlayerBusMsg): void {
    if (m.t === 'whisper' && m.msg && typeof m.msg.text === 'string' && m.msg.ch === 'whisper') this.send(p, m.msg);
    else if (m.t === 'sys' && typeof m.text === 'string') sys(this.hub, p, m.text.slice(0, 200));
  }

  // ───────────────────────── reports and emotes ─────────────────────────

  async report(p: ServerPlayer, m: ReportMsg): Promise<void> {
    const name = nameArg(m.name);
    if (!name) return;
    const reason =
      (typeof m.reason === 'string' ? m.reason : '')
        // Deliberately remove protocol control characters.
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .trim()
        .slice(0, 200) || 'no reason given';
    const lim = this.hub.limitsOf(p.accountId);
    const now = Date.now();
    lim.reports = lim.reports.filter((t) => now - t < 60_000);
    if (lim.reports.length >= 3) {
      this.warn(p, 'You have sent several reports already. Please wait a minute.');
      return;
    }
    lim.reports.push(now);
    const repo = runtime34().repo34;
    const target = await repo.accountByName(name).catch(() => null);
    const context = lim.log
      .filter((l) => l.ch !== 'system')
      .slice(-REPORT_CONTEXT)
      .map((l) => ({ ch: l.ch, from: l.from, fromId: l.fromId, to: l.to, text: l.text, t: l.t }));
    try {
      await repo.report(p.accountId, target?.name ?? name, target?.accountId ?? null, reason, context);
      sys(this.hub, p, `Thanks. Your report about ${target?.name ?? name} was sent to the moderators.`);
    } catch (e) {
      console.error('report failed', e);
      sys(this.hub, p, 'Could not send the report right now. Please try again later.');
    }
  }

  emote(p: ServerPlayer, m: EmoteMsg): void {
    if (typeof m.e !== 'string' || !(EMOTES as readonly string[]).includes(m.e) || p.deadT > 0) return;
    const lim = this.hub.limitsOf(p.accountId);
    const now = Date.now();
    if (now - lim.emoteAt < EMOTE_GAP_MS) return;
    lim.emoteAt = now;
    const ev: EmoteEvent = { id: p.id, e: m.e as Emote };
    for (const q of this.room.nearby(p.sim.x, p.sim.y, EMOTE_RANGE)) {
      try {
        q.client.send(MSG34.EMOTE_EV, ev);
      } catch {
        /* gone */
      }
    }
  }
}
