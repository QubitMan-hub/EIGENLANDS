import {
  CHUNK_SIZE, GHOST_MARGIN, MSG, MSG34, handoffTarget, nearbyShards, regionBounds,
  type Ghost, type GhostsMsg, type HandoffMsg,
} from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { runtime } from '../../rooms/runtime';
import { runtime34 } from '../runtime34';
import type { Module, Registrar } from '../types';
import { signTicket } from './ticket';

/** How far (tiles) from a border a tile change is relayed to the neighbouring shard. */
const RELAY_MARGIN = 3 * CHUNK_SIZE;
/** Ghosts older than this are dropped (the neighbour stopped reporting them). */
const GHOST_TTL_MS = 600;
/** Ghosts are sent to players within this many tiles. */
const GHOST_VIEW = 80;

type ShardBusMsg =
  | { t: 'ghosts'; from: string; at: number; list: Ghost[] }
  | { t: 'tile'; x: number; y: number; tile: number };

/**
 * Shard plumbing: hands players to the neighbouring shard when they cross a border, shows players near a border to the
 * shard next door ("ghosts"), relays tile edits across borders and keeps one live session per account across shards.
 */
export class ShardModule implements Module {
  private handing = new Set<string>();
  private ghosts = new Map<string, { at: number; list: Ghost[] }>();
  private hadGhosts = new Set<string>();
  private accountSubs = new Map<string, () => void>();
  private unsub: () => void;
  private tickN = 0;

  constructor(private room: GameRoom) {
    this.unsub = runtime34().bus.subscribe(`shard:${room.shard}`, (m) => this.onBus(m as ShardBusMsg));
  }

  install(_reg: Registrar): void {}

  /** Called before a player joins: any other live session of this account (on any shard) is kicked. */
  claimAccount(accountId: string, sessionId: string): void {
    runtime34().bus.publish(`player:${accountId}`, { t: 'kick', sid: sessionId, room: this.room.roomId });
    const prev = this.room.playerByAccount(accountId);
    if (prev && prev.id !== sessionId) void this.kick(prev);
  }

  join(p: ServerPlayer): void {
    this.accountSubs.get(p.accountId)?.();
    this.accountSubs.set(p.accountId, runtime34().bus.subscribe(`player:${p.accountId}`, (m) => {
      const msg = m as { t?: string; sid?: string; room?: string };
      if (msg.t !== 'kick' || msg.room === this.room.roomId) return; // same-room duplicates are handled at join
      const cur = this.room.playerByAccount(p.accountId);
      if (cur && cur.id !== msg.sid) void this.kick(cur);
    }));
  }

  leave(p: ServerPlayer): void {
    if (this.room.playerByAccount(p.accountId) === p) { this.accountSubs.get(p.accountId)?.(); this.accountSubs.delete(p.accountId); }
    this.handing.delete(p.id);
    this.hadGhosts.delete(p.id);
  }

  private async kick(p: ServerPlayer): Promise<void> {
    if (this.handing.has(p.id)) return;
    this.handing.add(p.id);
    p.client.send(MSG.NOTICE, { text: 'Signed in from another place.' });
    await this.room.detach(p, 'kick');
    p.client.leave(4001);
  }

  tick(now: number): void {
    this.tickN++;
    if (this.room.unsharded) return;
    for (const p of [...this.room.players.values()]) {
      if (p.deadT > 0 || this.handing.has(p.id)) continue;
      const target = handoffTarget(this.room.region, p.sim.x, p.sim.y);
      if (target) void this.handoff(p, target);
    }
    if (this.tickN % 2 === 0) { this.publishGhosts(now); this.sendGhosts(now); }
  }

  /** Save the player and send them to `target`. */
  async handoff(p: ServerPlayer, target: string): Promise<void> {
    if (this.handing.has(p.id)) return;
    this.handing.add(p.id);
    p.queue.length = 0;
    try {
      const carry = await this.room.detach(p, 'handoff');
      const owner = await runtime34().locks.owner(target).catch(() => null);
      const m: HandoffMsg = { shard: target, ticket: signTicket(p.accountId, target, carry, runtime().config.sessionSecret), ...(owner ? { roomId: owner } : {}) };
      p.client.send(MSG34.HANDOFF, m);
      // the client leaves on its own; make sure the socket does not linger if it never does
      setTimeout(() => { try { p.client.leave(4002); } catch { /* already gone */ } }, 10_000);
    } catch (e) {
      console.error('handoff failed', e);
      p.client.leave(4003);
    }
  }

  // ───────────────────────── ghosts ─────────────────────────

  private publishGhosts(now: number): void {
    const out = new Map<string, Ghost[]>();
    const b = regionBounds(this.room.region);
    for (const p of this.room.players.values()) {
      if (this.handing.has(p.id)) continue;
      const x = p.sim.x, y = p.sim.y;
      if (x - b.x0 > GHOST_MARGIN && b.x1 - x > GHOST_MARGIN && y - b.y0 > GHOST_MARGIN && b.y1 - y > GHOST_MARGIN) continue;
      const s = p.state;
      const g: Ghost = { id: `g:${p.accountId}`, name: s.name, x, y, faceX: s.faceX, faceY: s.faceY, look: s.look, level: s.level, cls: s.cls, hp: s.hp, maxHp: s.maxHp, flags: s.flags };
      for (const n of nearbyShards(this.room.region, x, y)) { let l = out.get(n); if (!l) { l = []; out.set(n, l); } l.push(g); }
    }
    for (const [shard, list] of out) runtime34().bus.publish(`shard:${shard}`, { t: 'ghosts', from: this.room.shard, at: now, list });
  }

  private sendGhosts(now: number): void {
    for (const [k, v] of this.ghosts) if (now - v.at > GHOST_TTL_MS) this.ghosts.delete(k);
    const all: Ghost[] = [];
    for (const v of this.ghosts.values()) all.push(...v.list);
    for (const p of this.room.players.values()) {
      const list = all.filter((g) => Math.hypot(g.x - p.sim.x, g.y - p.sim.y) <= GHOST_VIEW && g.id !== `g:${p.accountId}`);
      if (!list.length && !this.hadGhosts.has(p.id)) continue;
      const m: GhostsMsg = { t: now, list };
      p.client.send(MSG34.GHOSTS, m);
      if (list.length) this.hadGhosts.add(p.id); else this.hadGhosts.delete(p.id);
    }
  }

  // ───────────────────────── tile relay ─────────────────────────

  tileChanged(x: number, y: number, tile: number): void {
    if (this.room.unsharded || !this.room.owns(x, y)) return;
    const b = regionBounds(this.room.region);
    if (x - b.x0 > RELAY_MARGIN && b.x1 - x > RELAY_MARGIN && y - b.y0 > RELAY_MARGIN && b.y1 - y > RELAY_MARGIN) return;
    for (const n of nearbyShards(this.room.region, x, y, RELAY_MARGIN)) runtime34().bus.publish(`shard:${n}`, { t: 'tile', x, y, tile });
  }

  private onBus(m: ShardBusMsg): void {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ghosts' && typeof m.from === 'string' && Array.isArray(m.list)) this.ghosts.set(m.from, { at: Date.now(), list: m.list });
    else if (m.t === 'tile' && Number.isInteger(m.x) && Number.isInteger(m.y) && Number.isInteger(m.tile)) this.room.applyForeignTile(m.x, m.y, m.tile);
  }

  async dispose(): Promise<void> {
    this.unsub();
    for (const off of this.accountSubs.values()) off();
    this.accountSubs.clear();
  }
}
