import {
  MSG34, PARTY_MAX, type ChatMsg, type ClassId, type PartyInviteMsg, type PartyMember, type PartyMsg, type PartyStateMsg,
} from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import type { Invite, LiveInfo, PartyBusMsg, SocialHub } from './hub';
import { PARTY_ID_RE, PartyConflict, normalizeParty, type PartyMemberRec, type PartyRec } from './party';
import { nameArg, sys, sysMsg } from './util';

/** invites expire after this long */
export const INVITE_MS = 60_000;
/** party members within this many tiles of a kill share +50% of its XP */
export const SHARE_RANGE = 30;
export const SHARE_FRACTION = 0.5;

/**
 * One shard's view of parties: handles PARTY messages from its players, publishes their HP and position for party
 * frames on other shards, and pushes PARTY_STATE to its players on every change and at 2 Hz.
 */
export class PartyRoom {
  /** party id -> release of the hub watch (parties with a member on this shard) */
  private watches = new Map<string, () => void>();
  /** session id -> party id last sent ('' = told "no party") */
  private sent = new Map<string, string>();

  constructor(private room: GameRoom, private hub: SocialHub) {}

  private get reg() { return this.hub.parties; }

  partyOf(accountId: string): string { return this.reg.partyOf(accountId); }

  partyMates(accountId: string): string[] {
    const p = this.reg.partyRecOf(accountId);
    return p ? p.members.map((m) => m.accountId).filter((a) => a !== accountId) : [];
  }

  private cls(p: ServerPlayer): ClassId {
    try { return this.room.circuit?.classOf(p.id) ?? 'wanderer'; } catch { return 'wanderer'; }
  }

  private memberRec(p: ServerPlayer): PartyMemberRec {
    return { accountId: p.accountId, name: p.name, level: p.level, cls: this.cls(p), offlineSince: 0 };
  }

  // ───────────────────────── lifecycle ─────────────────────────

  async join(p: ServerPlayer): Promise<void> {
    const id = this.partyOf(p.accountId);
    if (id) {
      // back online (or arrived from another shard): refresh name/level/class and the online flag
      const me = this.memberRec(p);
      await this.reg.update(id, (cur) => {
        if (!cur) return undefined;
        const m = cur.members.find((x) => x.accountId === p.accountId);
        if (!m) return undefined;
        Object.assign(m, me);
        return normalizeParty(cur, Date.now());
      }).catch((e) => console.error('party join failed', e));
    }
    this.refreshWatches();
    this.sendState(p, true);
    for (const inv of this.hub.invitesFor(p.accountId)) this.sendInvite(p, inv);
  }

  async leave(p: ServerPlayer, reason: 'leave' | 'handoff' | 'kick'): Promise<void> {
    this.sent.delete(p.id);
    const id = this.partyOf(p.accountId);
    // a disconnect leaves the member listed as offline for a while (and hands leadership over);
    // a handoff or a second sign-in keeps them online
    if (id && reason === 'leave') {
      const now = Date.now();
      await this.reg.update(id, (cur) => {
        if (!cur) return undefined;
        const m = cur.members.find((x) => x.accountId === p.accountId);
        if (!m || m.offlineSince) return undefined;
        m.offlineSince = now; m.level = p.level;
        return normalizeParty(cur, now);
      }).catch((e) => console.error('party leave failed', e));
    }
    this.refreshWatches(p);
  }

  dispose(): void {
    for (const off of this.watches.values()) off();
    this.watches.clear();
  }

  /** Follow exactly the parties that have a member on this shard. */
  private refreshWatches(except?: ServerPlayer): void {
    const want = new Set<string>();
    for (const q of this.room.players.values()) {
      if (q === except) continue;
      const id = this.partyOf(q.accountId);
      if (id) want.add(id);
    }
    for (const [id, off] of this.watches) if (!want.has(id)) { off(); this.watches.delete(id); }
    for (const id of want) if (!this.watches.has(id)) this.watches.set(id, this.hub.watchParty(id));
  }

  /** The registry changed party `id` (here or on another process). */
  onPartyChanged(id: string): void {
    for (const q of this.room.players.values()) {
      const cur = this.partyOf(q.accountId);
      if (cur === id || this.sent.get(q.id) === id) this.sendState(q, true);
    }
    this.refreshWatches();
  }

  onPartyChat(partyId: string, msg: ChatMsg, deliver: (p: ServerPlayer, m: ChatMsg) => void): void {
    for (const q of this.room.players.values()) if (this.partyOf(q.accountId) === partyId) deliver(q, msg);
  }

  /** 2 Hz: publish our members' live data, then refresh every local member's party frames. */
  tick(now: number): void {
    const byParty = new Map<string, LiveInfo[]>();
    for (const q of this.room.players.values()) {
      const id = this.partyOf(q.accountId);
      if (!id) continue;
      let l = byParty.get(id);
      if (!l) { l = []; byParty.set(id, l); }
      l.push({ a: q.accountId, n: q.name, l: q.level, c: this.cls(q), hp: q.hp, mh: q.maxHp, x: q.sim.x, y: q.sim.y, s: this.room.shard, at: now });
    }
    for (const [id, list] of byParty) {
      for (const li of list) this.hub.live.set(li.a, li);
      this.hub.bus.publish(`party:${id}`, { t: 'live', list } satisfies PartyBusMsg);
    }
    for (const q of this.room.players.values()) if (this.partyOf(q.accountId) || this.sent.get(q.id)) this.sendState(q, false);
  }

  // ───────────────────────── state ─────────────────────────

  stateFor(p: ServerPlayer): PartyStateMsg {
    const rec = this.reg.partyRecOf(p.accountId);
    if (!rec) return { id: null };
    const now = Date.now();
    const members: PartyMember[] = rec.members.map((m) => {
      const local = this.room.playerByAccount(m.accountId);
      if (local) {
        return { accountId: m.accountId, name: local.name, level: local.level, cls: this.cls(local), hp: local.hp, maxHp: local.maxHp, x: local.sim.x, y: local.sim.y, shard: this.room.shard, online: true, sid: local.id };
      }
      const li = this.hub.live.get(m.accountId);
      return {
        accountId: m.accountId, name: li?.n ?? m.name, level: li?.l ?? m.level, cls: li?.c ?? m.cls,
        hp: li?.hp ?? 0, maxHp: li?.mh ?? 0, x: li?.x ?? 0, y: li?.y ?? 0, shard: li?.s ?? '',
        online: !m.offlineSince && (!li || now - li.at < 15_000), sid: '',
      };
    });
    return { id: rec.id, leader: rec.leader, members };
  }

  private sendState(p: ServerPlayer, force: boolean): void {
    const st = this.stateFor(p);
    const prev = this.sent.get(p.id);
    if (!st.id && !prev && !force) return;
    this.sent.set(p.id, st.id ?? '');
    try { p.client.send(MSG34.PARTY_STATE, st); } catch { /* gone */ }
  }

  private sendInvite(p: ServerPlayer, inv: Invite): void {
    const m: PartyInviteMsg = { partyId: inv.partyId, from: inv.from };
    try { p.client.send(MSG34.PARTY_INVITE, m); } catch { /* gone */ }
  }

  /** An invite arrived over the bus for a player on this shard. */
  receiveInvite(p: ServerPlayer, inv: Invite): void {
    if (!inv || typeof inv.partyId !== 'string' || !PARTY_ID_RE.test(inv.partyId) || typeof inv.from !== 'string' || typeof inv.fromId !== 'string') return;
    if (this.partyOf(p.accountId)) return;
    this.hub.addInvite(p.accountId, inv);
    this.sendInvite(p, inv);
  }

  // ───────────────────────── XP sharing ─────────────────────────

  /** Party members near the kill get +50% of its XP (the killer keeps full XP). */
  shareXp(x: number, y: number, xp: number, killer: ServerPlayer): void {
    if (xp <= 0) return;
    const mates = this.partyMates(killer.accountId);
    for (const a of mates) {
      const q = this.room.playerByAccount(a);
      if (!q || q === killer || q.deadT > 0) continue;
      if (Math.hypot(q.sim.x - x, q.sim.y - y) > SHARE_RANGE) continue;
      this.room.grantXp(q, xp * SHARE_FRACTION);
    }
  }

  // ───────────────────────── messages ─────────────────────────

  private partyNotice(id: string, text: string): void {
    this.hub.bus.publish(`party:${id}`, { t: 'chat', msg: sysMsg(text) } satisfies PartyBusMsg);
  }

  private tellAccount(accountId: string, text: string): void {
    this.hub.bus.publish(`player:${accountId}`, { t: 'sys', text });
  }

  async handle(p: ServerPlayer, m: PartyMsg): Promise<void> {
    switch (m.action) {
      case 'invite': return this.invite(p, nameArg(m.name));
      case 'accept': return this.accept(p, m.partyId);
      case 'decline': return this.decline(p, m.partyId);
      case 'leave': return this.leaveParty(p);
      case 'kick': return this.kick(p, m.accountId);
      case 'promote': return this.promote(p, m.accountId);
      default: return undefined;
    }
  }

  async invite(p: ServerPlayer, name: string): Promise<void> {
    if (!name) return;
    if (name.toLowerCase() === p.name.toLowerCase()) { sys(this.hub, p, "You can't invite yourself."); return; }
    const myParty = this.reg.partyRecOf(p.accountId);
    if (myParty) {
      if (myParty.leader !== p.accountId) { sys(this.hub, p, 'Only the party leader can invite.'); return; }
      if (myParty.members.length >= PARTY_MAX) { sys(this.hub, p, `Your party is full (${PARTY_MAX}).`); return; }
    }
    const t = await this.hub.dir.find(name);
    if (!t) { sys(this.hub, p, `${name} is not online.`); return; }
    if (t.accountId === p.accountId) { sys(this.hub, p, "You can't invite yourself."); return; }
    if (myParty?.members.some((x) => x.accountId === t.accountId)) { sys(this.hub, p, `${t.name} is already in your party.`); return; }
    if (this.partyOf(t.accountId)) { sys(this.hub, p, `${t.name} is already in a party.`); return; }
    const partyId = myParty?.id ?? this.hub.partyIdFor(p.accountId);
    const inv: Invite = { partyId, from: p.name, fromId: p.accountId, fromLevel: p.level, fromCls: this.cls(p), exp: Date.now() + INVITE_MS };
    this.hub.bus.publish(`player:${t.accountId}`, { t: 'pinvite', inv });
    sys(this.hub, p, `Invited ${t.name} to your party.`);
  }

  async accept(p: ServerPlayer, partyId: unknown): Promise<void> {
    if (typeof partyId !== 'string' || !PARTY_ID_RE.test(partyId)) return;
    const inv = this.hub.takeInvite(p.accountId, partyId);
    if (!inv) { sys(this.hub, p, 'That invite has expired.'); return; }
    if (this.partyOf(p.accountId)) { sys(this.hub, p, 'Leave your current party first.'); return; }
    if (this.reg.wasDeleted(partyId)) { sys(this.hub, p, 'That party has disbanded.'); return; }
    const me = this.memberRec(p);
    let outcome = 'ok' as 'ok' | 'full' | 'gone';
    try {
      const r = await this.reg.update(partyId, (cur) => {
        if (!cur) {
          if (inv.fromId === p.accountId) { outcome = 'gone'; return undefined; }
          return { id: partyId, v: 0, leader: inv.fromId, members: [{ accountId: inv.fromId, name: inv.from, level: inv.fromLevel, cls: inv.fromCls, offlineSince: 0 }, me] };
        }
        if (cur.members.some((x) => x.accountId === p.accountId)) return undefined;
        if (cur.members.length >= PARTY_MAX) { outcome = 'full'; return undefined; }
        return { ...cur, members: [...cur.members, me] };
      });
      if (outcome === 'full') { sys(this.hub, p, 'That party is full.'); return; }
      if (outcome === 'gone' || !r.party) { sys(this.hub, p, 'That party has disbanded.'); return; }
      if (r.changed) {
        if (!r.prev) this.hub.pendingParty.delete(inv.fromId);
        this.partyNotice(partyId, `${p.name} joined the party.`);
      }
    } catch (e) {
      if (e instanceof PartyConflict) sys(this.hub, p, e.accountId === p.accountId ? 'Leave your current party first.' : `${inv.from} is in another party now.`);
      else throw e;
    }
  }

  decline(p: ServerPlayer, partyId: unknown): void {
    if (typeof partyId !== 'string' || !PARTY_ID_RE.test(partyId)) return;
    const inv = this.hub.takeInvite(p.accountId, partyId);
    if (inv) this.tellAccount(inv.fromId, `${p.name} declined your party invite.`);
  }

  async leaveParty(p: ServerPlayer): Promise<void> {
    const id = this.partyOf(p.accountId);
    if (!id) { sys(this.hub, p, "You're not in a party."); return; }
    const r = await this.reg.update(id, (cur) => {
      if (!cur || !cur.members.some((x) => x.accountId === p.accountId)) return undefined;
      return normalizeParty({ ...cur, members: cur.members.filter((x) => x.accountId !== p.accountId) }, Date.now());
    });
    if (r.changed) {
      sys(this.hub, p, r.party ? 'You left the party.' : 'You left the party. It has disbanded.');
      if (r.party) this.partyNotice(id, `${p.name} left the party.`);
      else for (const m of r.prev?.members ?? []) if (m.accountId !== p.accountId) this.tellAccount(m.accountId, 'Your party has disbanded.');
    }
  }

  async kick(p: ServerPlayer, accountId: unknown): Promise<void> {
    if (typeof accountId !== 'string' || accountId.length > 64) return;
    const id = this.partyOf(p.accountId);
    if (!id) return;
    if (accountId === p.accountId) { await this.leaveParty(p); return; }
    let why = '';
    let name = '';
    const r = await this.reg.update(id, (cur) => {
      if (!cur) return undefined;
      if (cur.leader !== p.accountId) { why = 'Only the party leader can remove members.'; return undefined; }
      const t = cur.members.find((x) => x.accountId === accountId);
      if (!t) return undefined;
      name = t.name;
      return normalizeParty({ ...cur, members: cur.members.filter((x) => x.accountId !== accountId) }, Date.now());
    });
    if (why) { sys(this.hub, p, why); return; }
    if (!r.changed) return;
    this.tellAccount(accountId, 'You were removed from the party.');
    if (r.party) this.partyNotice(id, `${name} was removed from the party.`);
    else sys(this.hub, p, 'The party has disbanded.');
  }

  async promote(p: ServerPlayer, accountId: unknown): Promise<void> {
    if (typeof accountId !== 'string' || accountId.length > 64) return;
    const id = this.partyOf(p.accountId);
    if (!id || accountId === p.accountId) return;
    let why = '';
    let name = '';
    const r = await this.reg.update(id, (cur): PartyRec | undefined => {
      if (!cur) return undefined;
      if (cur.leader !== p.accountId) { why = 'Only the party leader can promote.'; return undefined; }
      const t = cur.members.find((x) => x.accountId === accountId);
      if (!t) return undefined;
      if (t.offlineSince) { why = `${t.name} is offline.`; return undefined; }
      name = t.name;
      return { ...cur, leader: accountId };
    });
    if (why) { sys(this.hub, p, why); return; }
    if (r.changed) this.partyNotice(id, `${name} now leads the party.`);
  }
}
