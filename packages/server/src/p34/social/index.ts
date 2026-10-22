import {
  MSG34, type ChatMsg, type ChatSendMsg, type EmoteMsg, type PartyMsg, type ReportMsg, type TradeMsg,
} from '@eigenlands/shared';
import type { Enemy } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { runtime } from '../../rooms/runtime';
import { loadPlayerData } from '../../systems/profile';
import type { Bus } from '../bus';
import type { Carry, Module, PartyApi, Registrar } from '../types';
import { ChatRoom } from './chat';
import { hub, type HubRoom, type PlayerBusMsg, type SocialHub } from './hub';
import { PartyRoom } from './partyroom';
import { TradeRoom } from './trade';

/**
 * Parties, chat, emotes and trading (Phase 4). One instance per shard room; cross-shard and cross-process state
 * (parties, online directory, invites, global chat history, chat limits) lives in the process-wide `SocialHub` and
 * travels over the bus (`player:<accountId>`, `party:<id>`, `parties`, `chat:global`).
 */
export class SocialModule implements Module, PartyApi, HubRoom {
  readonly hub: SocialHub;
  readonly party: PartyRoom;
  readonly chat: ChatRoom;
  readonly trade: TradeRoom;
  /** account id -> [session id, unsubscribe] for `player:<accountId>` */
  private playerSubs = new Map<string, [string, () => void]>();
  private tickN = 0;
  private disposed = false;

  constructor(readonly room: GameRoom) {
    this.hub = hub();
    this.party = new PartyRoom(room, this.hub);
    this.chat = new ChatRoom(room, this.hub, this.party);
    this.trade = new TradeRoom(room, this.hub);
    this.hub.register(this);
  }

  get bus(): Bus { return this.hub.bus; }

  install(reg: Registrar): void {
    reg.on<PartyMsg>(MSG34.PARTY, 'party', (p, m) => this.party.handle(p, m));
    reg.on<ChatSendMsg>(MSG34.CHAT, 'chat', (p, m) => this.chat.handle(p, m));
    reg.on<ReportMsg>(MSG34.REPORT, 'chat', (p, m) => this.chat.report(p, m));
    reg.on<EmoteMsg>(MSG34.EMOTE, 'emote', (p, m) => this.chat.emote(p, m));
    reg.on<TradeMsg>(MSG34.TRADE, 'trade', (p, m) => this.trade.handle(p, m));
  }

  // ───────────────────────── PartyApi ─────────────────────────

  partyOf(accountId: string): string { return this.party.partyOf(accountId); }
  partyMates(accountId: string): string[] { return this.party.partyMates(accountId); }

  // ───────────────────────── lifecycle ─────────────────────────

  async join(p: ServerPlayer, carry: Carry | null): Promise<void> {
    // a trade of this account may have been saving while this session loaded: wait for it and reload the pack
    const busy = this.hub.tradeBusy.get(p.accountId);
    if (busy) await busy.catch(() => {});
    const end = this.hub.tradeEnd.get(p.accountId);
    if (end && Date.now() - end < 15_000) await this.reload(p);
    if (this.room.players.get(p.id) !== p) return;

    const prev = this.playerSubs.get(p.accountId);
    prev?.[1]();
    const off = this.bus.subscribe(`player:${p.accountId}`, (m) => this.onPlayerBus(p.accountId, m as PlayerBusMsg));
    this.playerSubs.set(p.accountId, [p.id, off]);
    this.hub.dir.add({ accountId: p.accountId, name: p.name, shard: this.room.shard, sid: p.id, at: Date.now() });
    this.chat.join(p, !carry);
    await this.party.join(p);
  }

  private async reload(p: ServerPlayer): Promise<void> {
    try {
      const ch = await runtime().repo.getCharacter(p.accountId);
      if (!ch || this.room.players.get(p.id) !== p) return;
      p.data = loadPlayerData(ch.data, this.room.wclock.season(), this.room.wclock.now());
      p.dirty('inv', 'coins', 'equip');
      p.sendFullProfile();
    } catch (e) { console.error('reload after trade failed', e); }
  }

  async leave(p: ServerPlayer, reason: 'leave' | 'handoff' | 'kick'): Promise<void> {
    await this.trade.leave(p);
    const sub = this.playerSubs.get(p.accountId);
    if (sub && sub[0] === p.id) { sub[1](); this.playerSubs.delete(p.accountId); }
    this.hub.dir.remove(p.accountId, p.id);
    this.chat.leave(p);
    await this.party.leave(p, reason);
  }

  private onPlayerBus(accountId: string, m: PlayerBusMsg): void {
    if (!m || typeof m !== 'object') return;
    const p = this.room.playerByAccount(accountId);
    if (!p) return;
    if (m.t === 'pinvite') this.party.receiveInvite(p, m.inv);
    else this.chat.onPlayerBus(p, m);
  }

  tick(now: number): void {
    this.tickN++;
    if (this.tickN % 10 === 0) this.party.tick(Date.now());
    if (this.tickN % 20 === 5) { this.trade.tick(Date.now()); this.chat.tick(Date.now()); }
    void now;
  }

  killed(e: Enemy, killer: ServerPlayer | undefined): void {
    if (!killer || !this.partyOf(killer.accountId)) return;
    this.party.shareXp(e.x, e.y, Math.round(e.def.xp * (e.night ? 1.5 : 1)), killer);
  }

  // ───────────────────────── hub fan-out ─────────────────────────

  onPartyChanged(id: string): void { if (!this.disposed) this.party.onPartyChanged(id); }
  onGlobalChat(msg: ChatMsg): void { if (!this.disposed) this.chat.onGlobal(msg); }
  onPartyChat(partyId: string, msg: ChatMsg): void { if (!this.disposed) this.chat.onPartyChat(partyId, msg); }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.hub.unregister(this);
    this.trade.dispose();
    this.party.dispose();
    for (const [, off] of this.playerSubs.values()) off();
    this.playerSubs.clear();
  }

  debug(): Record<string, unknown> { return { ...this.trade.debug() }; }
}
