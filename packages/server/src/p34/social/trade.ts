import { randomUUID } from 'node:crypto';
import {
  MSG34, TRADE_MAX_ITEMS, TRADE_RANGE, addStack, cloneStack, sameStack,
  type Inventory, type Stack, type TradeMsg, type TradeOffer, type TradeRequestMsg, type TradeStateMsg,
} from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { runtime } from '../../rooms/runtime';
import { TokenBucket } from '../../rate';
import { cloneInv, validSlot } from '../../systems/helpers';
import { serializePlayerData } from '../../systems/profile';
import { runtime34 } from '../runtime34';
import type { SocialHub } from './hub';
import { dist, nameArg, sys } from './util';

/** trades are cancelled when the two players are farther apart than this (tiles) */
export const TRADE_CANCEL_RANGE = 8;
export const TRADE_IDLE_MS = 120_000;
export const TRADE_REQUEST_MS = 30_000;
/** Live-tunable (tests shrink it). Confirms arriving this soon after an offer changed are refused, so nobody can be
 * tricked into confirming an offer they have not seen. */
export const tradeTuning = { confirmDelayMs: 1000 };

interface Offered { slot: number; n: number; snap: Stack }
interface Side { p: ServerPlayer; items: Offered[]; coins: number; confirm: boolean }
interface Trade { id: string; a: Side; b: Side; at: number; changedAt: number; executing: Promise<void> | null; closed: boolean }
interface Req { id: string; from: ServerPlayer; to: ServerPlayer; exp: number }

type BucketKey = 'useBucket' | 'craftBucket' | 'socialBucket' | 'openBucket' | 'invBucket';
const FROZEN: BucketKey[] = ['useBucket', 'craftBucket', 'socialBucket', 'openBucket', 'invBucket'];

/** Does the pack still hold what was offered from `o.slot` (same item, same properties, at least `o.n`)? */
const stillThere = (inv: Inventory, o: Offered): boolean => {
  const s = inv[o.slot];
  return !!s && sameStack(s, o.snap) && s.n >= o.n;
};

/**
 * Player-to-player trading on one shard. Both players offer up to TRADE_MAX_ITEMS pack slots plus coins; any change
 * resets both confirmations; when both confirm, the swap is validated against the live packs, simulated on copies,
 * applied, and saved for BOTH characters in one DB transaction with an audit row. If the save fails, both players'
 * in-memory packs and coins are restored. While the save is in flight both players' inventory actions are frozen, so
 * nothing can be moved out of a pack that might be rolled back.
 */
export class TradeRoom {
  private trades = new Map<string, Trade>();
  /** account id -> active trade */
  private byAcct = new Map<string, Trade>();
  private reqs = new Map<string, Req>();

  constructor(private room: GameRoom, private hub: SocialHub) {}

  private present(p: ServerPlayer): boolean { return this.room.players.get(p.id) === p; }

  private sideOf(t: Trade, p: ServerPlayer): [Side, Side] | null {
    if (t.a.p === p) return [t.a, t.b];
    if (t.b.p === p) return [t.b, t.a];
    return null;
  }

  /** The trade `p` is in (null if none, or if it belongs to an older session of the same account). */
  tradeOf(p: ServerPlayer): Trade | null {
    const t = this.byAcct.get(p.accountId);
    return t && this.sideOf(t, p) ? t : null;
  }

  // ───────────────────────── messages ─────────────────────────

  async handle(p: ServerPlayer, m: TradeMsg): Promise<void> {
    switch (m.action) {
      case 'request': return this.request(p, nameArg(m.name));
      case 'accept': return this.accept(p, m.id);
      case 'decline': return this.decline(p, m.id);
      case 'offer': return this.offer(p, m.items, m.coins);
      case 'confirm': return this.confirm(p);
      case 'cancel': { const t = this.tradeOf(p); if (t && !t.executing) this.close(t, `${p.name} cancelled the trade.`); return; }
      default: return undefined;
    }
  }

  private request(p: ServerPlayer, name: string): void {
    if (!name) return;
    const q = this.room.playerByName(name);
    if (!q || q === p) {
      sys(this.hub, p, q === p ? "You can't trade with yourself." : `${name} is not nearby.`);
      return;
    }
    if (this.tradeOf(p)) { sys(this.hub, p, 'Finish your current trade first.'); return; }
    if (this.byAcct.has(q.accountId)) { sys(this.hub, p, `${q.name} is busy trading.`); return; }
    if (p.deadT > 0 || q.deadT > 0) return;
    if (dist(p, q) > TRADE_RANGE) { sys(this.hub, p, `${q.name} is too far away. Stand within ${TRADE_RANGE} tiles to trade.`); return; }
    // one outgoing request per player; a handful incoming
    for (const [id, r] of this.reqs) if (r.from.accountId === p.accountId) this.reqs.delete(id);
    if ([...this.reqs.values()].filter((r) => r.to === q).length >= 5) { sys(this.hub, p, `${q.name} has too many trade requests right now.`); return; }
    const id = `tr_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.reqs.set(id, { id, from: p, to: q, exp: Date.now() + TRADE_REQUEST_MS });
    const msg: TradeRequestMsg = { id, from: p.name };
    q.client.send(MSG34.TRADE_REQ, msg);
    sys(this.hub, p, `Trade request sent to ${q.name}.`);
  }

  private accept(p: ServerPlayer, id: unknown): void {
    if (typeof id !== 'string') return;
    const r = this.reqs.get(id);
    if (!r || r.to !== p) return;
    this.reqs.delete(id);
    const q = r.from;
    if (r.exp < Date.now() || !this.present(q)) { sys(this.hub, p, 'That trade request has expired.'); return; }
    if (this.tradeOf(p)) { sys(this.hub, p, 'Finish your current trade first.'); return; }
    if (this.byAcct.has(q.accountId)) { sys(this.hub, p, `${q.name} is busy trading.`); return; }
    if (dist(p, q) > TRADE_RANGE + 1) { sys(this.hub, p, `${q.name} is too far away to trade.`); return; }
    for (const [rid, x] of this.reqs) if (x.from === p || x.from === q || x.to === q) this.reqs.delete(rid);
    const now = Date.now();
    const t: Trade = {
      id: `tx_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      a: { p: q, items: [], coins: 0, confirm: false }, b: { p, items: [], coins: 0, confirm: false },
      at: now, changedAt: now, executing: null, closed: false,
    };
    this.trades.set(t.id, t);
    this.byAcct.set(q.accountId, t);
    this.byAcct.set(p.accountId, t);
    this.push(t);
  }

  private decline(p: ServerPlayer, id: unknown): void {
    if (typeof id !== 'string') return;
    const r = this.reqs.get(id);
    if (!r || r.to !== p) return;
    this.reqs.delete(id);
    if (this.present(r.from)) sys(this.hub, r.from, `${p.name} declined your trade request.`);
  }

  private offer(p: ServerPlayer, rawItems: unknown, rawCoins: unknown): void {
    const t = this.tradeOf(p);
    if (!t || t.executing) return;
    const [me] = this.sideOf(t, p)!;
    const items: Offered[] = [];
    const seen = new Set<number>();
    const bad = () => { this.push(t, p); };
    if (!Array.isArray(rawItems) || rawItems.length > TRADE_MAX_ITEMS) return bad();
    for (const it of rawItems as unknown[]) {
      const o = it as { slot?: unknown; n?: unknown } | null;
      if (!o || typeof o !== 'object' || !validSlot(o.slot) || seen.has(o.slot)) return bad();
      const s = p.data.inv[o.slot];
      if (!s || !Number.isInteger(o.n) || (o.n as number) < 1 || (o.n as number) > s.n) return bad();
      seen.add(o.slot);
      items.push({ slot: o.slot, n: o.n as number, snap: cloneStack(s) });
    }
    if (!Number.isInteger(rawCoins) || (rawCoins as number) < 0) return bad();
    const coins = rawCoins as number;
    if (coins > p.data.coins) { sys(this.hub, p, "You don't have that many coins."); return bad(); }
    const same = coins === me.coins && items.length === me.items.length
      && items.every((x, i) => x.slot === me.items[i]!.slot && x.n === me.items[i]!.n && sameStack(x.snap, me.items[i]!.snap));
    if (same) return bad();
    me.items = items; me.coins = coins;
    this.changed(t);
  }

  private changed(t: Trade): void {
    t.a.confirm = false; t.b.confirm = false;
    t.at = t.changedAt = Date.now();
    this.push(t);
  }

  private confirm(p: ServerPlayer): void {
    const t = this.tradeOf(p);
    if (!t || t.executing) return;
    const [me, them] = this.sideOf(t, p)!;
    if (!me.items.length && !me.coins && !them.items.length && !them.coins) { sys(this.hub, p, 'Add something to the trade first.'); return; }
    if (Date.now() - t.changedAt < tradeTuning.confirmDelayMs) {
      sys(this.hub, p, 'The offer just changed. Check it, then confirm again.');
      this.push(t, p);
      return;
    }
    me.confirm = true;
    t.at = Date.now();
    if (t.a.confirm && t.b.confirm) this.execute(t);
    else this.push(t);
  }

  // ───────────────────────── execution ─────────────────────────

  private execute(t: Trade): void {
    const accts = [t.a.p.accountId, t.b.p.accountId];
    const run = this.run(t).catch((e) => {
      console.error('trade failed', e);
      if (!t.closed) this.close(t, 'The trade failed. Nothing changed.');
    }).finally(() => {
      t.executing = null;
      for (const a of accts) { if (this.hub.tradeBusy.get(a) === run) this.hub.tradeBusy.delete(a); this.hub.tradeEnd.set(a, Date.now()); }
    });
    t.executing = run;
    for (const a of accts) this.hub.tradeBusy.set(a, run);
  }

  private async run(t: Trade): Promise<void> {
    const A = t.a, B = t.b;
    if (!this.present(A.p) || !this.present(B.p)) { this.close(t, 'The other player left.'); return; }
    if (dist(A.p, B.p) > TRADE_CANCEL_RANGE) { this.close(t, 'You moved too far apart.'); return; }
    // the offered stacks must still be exactly there
    if (!this.revalidate(t)) return;
    if (A.coins > A.p.data.coins || B.coins > B.p.data.coins) { this.unconfirm(t, 'Not enough coins.'); return; }

    const give = (s: Side): Stack[] => s.items.map((o) => ({ ...cloneStack(o.snap), n: o.n }));
    const aGives = give(A), bGives = give(B);
    const simulate = (s: Side, gets: Stack[]): Inventory | null => {
      const inv = cloneInv(s.p.data.inv);
      for (const o of s.items) { const st = inv[o.slot]!; st.n -= o.n; if (st.n <= 0) inv[o.slot] = null; }
      for (const g of gets) if (addStack(inv, cloneStack(g)) > 0) return null;
      return inv;
    };
    const simA = simulate(A, bGives), simB = simulate(B, aGives);
    if (!simA || !simB) { this.unconfirm(t, `${(!simA ? A : B).p.name}'s pack does not have room for this trade.`); return; }

    const before = { aInv: cloneInv(A.p.data.inv), bInv: cloneInv(B.p.data.inv), aCoins: A.p.data.coins, bCoins: B.p.data.coins };
    const thaw = [this.freeze(A.p), this.freeze(B.p)];
    const put = (p: ServerPlayer, inv: Inventory, coins: number) => {
      for (let i = 0; i < inv.length; i++) p.data.inv[i] = inv[i] ?? null;
      p.data.coins = coins;
      p.dirty('inv', 'coins');
    };
    put(A.p, simA, A.p.data.coins - A.coins + B.coins);
    put(B.p, simB, B.p.data.coins - B.coins + A.coins);
    try {
      await runtime34().repo34.commitTrade({
        a: A.p.accountId, b: B.p.accountId,
        aData: serializePlayerData(A.p.data), bData: serializePlayerData(B.p.data),
        aItems: aGives, bItems: bGives, aCoins: A.coins, bCoins: B.coins,
      });
    } catch (e) {
      console.error('trade commit failed; rolling back', e);
      put(A.p, before.aInv, before.aCoins);
      put(B.p, before.bInv, before.bCoins);
      for (const f of thaw) f();
      this.close(t, 'The trade could not be saved, so nothing changed. Please try again.');
      await this.settle(A.p, B.p);
      return;
    }
    for (const f of thaw) f();
    this.close(t, 'done');
    for (const [s, o] of [[A, B], [B, A]] as const) if (this.present(s.p)) sys(this.hub, s.p, `Trade with ${o.p.name} complete.`);
    await this.settle(A.p, B.p);
  }

  /**
   * Re-save both characters right after the trade (or its rollback), so an autosave that read the old data before
   * the trade and landed after the commit cannot leave a stale copy in the database.
   */
  private async settle(...ps: ServerPlayer[]): Promise<void> {
    const repo = runtime().repo;
    await Promise.all(ps.filter((p) => this.present(p)).map((p) => repo.saveCharacter({
      accountId: p.accountId, x: p.sim.x, y: p.sim.y, hp: Math.max(1, p.hp), level: p.level, xp: p.xp, data: serializePlayerData(p.data),
    }).catch((e) => console.error('trade settle save failed', e))));
  }

  /** Block every inventory-changing action of `p` until the returned function is called. */
  private freeze(p: ServerPlayer): () => void {
    const saved = FROZEN.map((k) => [k, p[k]] as const);
    for (const k of FROZEN) p[k] = new TokenBucket(0, 0);
    return () => { for (const [k, b] of saved) p[k] = b; };
  }

  private unconfirm(t: Trade, why: string): void {
    t.a.confirm = false; t.b.confirm = false;
    for (const s of [t.a, t.b]) if (this.present(s.p)) sys(this.hub, s.p, why);
    this.push(t);
  }

  /** Drop offered stacks that are no longer in the pack. Returns false (and tells both players) if anything changed. */
  private revalidate(t: Trade): boolean {
    let ok = true;
    for (const s of [t.a, t.b]) {
      const keep = s.items.filter((o) => stillThere(s.p.data.inv, o));
      let changed = keep.length !== s.items.length;
      s.items = keep;
      if (s.coins > s.p.data.coins) { s.coins = s.p.data.coins; changed = true; }
      if (changed) {
        ok = false;
        if (this.present(s.p)) sys(this.hub, s.p, 'Your offer changed because your pack changed.');
      }
    }
    if (!ok) this.changed(t);
    return ok;
  }

  // ───────────────────────── lifecycle ─────────────────────────

  private state(t: Trade, me: Side, them: Side): TradeStateMsg {
    const off = (s: Side): TradeOffer => ({ items: s.items.map((o) => ({ slot: o.slot, stack: { ...cloneStack(o.snap), n: o.n } })), coins: s.coins });
    return { id: t.id, other: them.p.name, mine: off(me), theirs: off(them), myConfirm: me.confirm, theirConfirm: them.confirm };
  }

  /** Send the trade window state to both players (or just `only`). */
  private push(t: Trade, only?: ServerPlayer): void {
    for (const [me, them] of [[t.a, t.b], [t.b, t.a]] as const) {
      if (only && me.p !== only) continue;
      try { me.p.client.send(MSG34.TRADE_STATE, this.state(t, me, them)); } catch { /* gone */ }
    }
  }

  private close(t: Trade, reason: string): void {
    if (t.closed) return;
    t.closed = true;
    this.trades.delete(t.id);
    for (const s of [t.a, t.b]) {
      if (this.byAcct.get(s.p.accountId) === t) this.byAcct.delete(s.p.accountId);
      const m: TradeStateMsg = { id: null, reason };
      try { s.p.client.send(MSG34.TRADE_STATE, m); } catch { /* gone */ }
    }
  }

  /** A player is leaving the shard (disconnect, handoff or second sign-in). */
  async leave(p: ServerPlayer): Promise<void> {
    for (const [id, r] of this.reqs) if (r.from === p || r.to === p) this.reqs.delete(id);
    const t = this.tradeOf(p);
    if (!t) return;
    // a trade that is being saved finishes (or rolls back) before the player is saved and removed
    if (t.executing) { await t.executing; return; }
    this.close(t, `${p.name} left.`);
  }

  /** 1 Hz: requests expire; trades cancel when apart, idle or when an offered stack disappears. */
  tick(now: number): void {
    for (const [id, r] of this.reqs) if (r.exp < now || !this.present(r.from) || !this.present(r.to)) this.reqs.delete(id);
    for (const t of [...this.trades.values()]) {
      if (t.executing) continue;
      if (!this.present(t.a.p) || !this.present(t.b.p)) { this.close(t, 'The other player left.'); continue; }
      if (dist(t.a.p, t.b.p) > TRADE_CANCEL_RANGE) { this.close(t, 'Trade cancelled: you moved too far apart.'); continue; }
      if (now - t.at > TRADE_IDLE_MS) { this.close(t, 'Trade cancelled: nothing happened for 2 minutes.'); continue; }
      this.revalidate(t);
    }
  }

  dispose(): void {
    for (const t of [...this.trades.values()]) if (!t.executing) this.close(t, 'cancelled');
  }

  debug(): { trades: number; reqs: number } { return { trades: this.trades.size, reqs: this.reqs.size }; }
}
