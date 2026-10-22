/** Shared fixtures for the Phase 4 (party, chat, trade) integration tests. */
import { matchMaker } from 'colyseus';
import { Client, type Room } from 'colyseus.js';
import { MSG, MSG34, type ChatMsg, type PartyStateMsg, type TradeStateMsg } from '@eigenlands/shared';
import type { App } from '../src/app';
import type { GameRoom } from '../src/rooms/GameRoom';
import type { ServerPlayer } from '../src/rooms/player';
import { TokenBucket } from '../src/rate';
import { tuning } from '../src/rooms/runtime';
import { tradeTuning } from '../src/p34/social/trade';
import { guest, resetDb, sleep, startApp, until, wsUrl } from './helpers';

export interface P4 {
  r: Room<any>;
  name: string;
  token: string;
  accountId: string;
  room: GameRoom;
  sp: ServerPlayer;
  chat: ChatMsg[];
  party: PartyStateMsg[];
  invites: Array<{ partyId: string; from: string }>;
  emotes: Array<{ id: string; e: string }>;
  trades: TradeStateMsg[];
  tradeReqs: Array<{ id: string; from: string }>;
  handoffs: any[];
  profiles: any[];
}

export async function bootP4(o: { cluster?: boolean } = {}): Promise<App> {
  await resetDb();
  tuning.toolCooldownMs = 0;
  tradeTuning.confirmDelayMs = 0;
  return startApp({ config: { devCommands: true }, ...(o.cluster ? { cluster: true } : {}) });
}

const big = () => new TokenBucket(10000, 10000);

/** Lift the per-message rate limits (functional tests send faster than humans; rate tests use the real ones). */
export function relaxP4(p: P4, chatToo = true): void {
  const room = p.room as unknown as { bucket(sid: string, n: string): TokenBucket; buckets: Map<string, Map<string, TokenBucket>> };
  for (const n of ['cast', 'board', 'party', 'chat', 'trade', 'emote']) room.bucket(p.sp.id, n);
  const m = room.buckets.get(p.sp.id)!;
  for (const n of [...m.keys()]) m.set(n, big());
  p.sp.useBucket = big(); p.sp.craftBucket = big(); p.sp.socialBucket = big(); p.sp.openBucket = big(); p.sp.invBucket = big();
  if (chatToo) {
    const lim = p.room.social.hub.limitsOf(p.accountId);
    lim.buckets = { local: big(), global: big(), party: big(), whisper: big() };
  }
}

/**
 * Join as a new guest. `pos` pre-creates the character there (so a sharded join lands inside its region);
 * `shard` joins that shard's room (omit for an unsharded room that simulates the whole world).
 */
export async function joinP4(app: App, name: string, o: { shard?: string; pos?: [number, number]; relax?: boolean; creds?: { token: string; accountId: string } } = {}): Promise<P4> {
  const g = o.creds ?? await guest(app);
  if (o.pos && !o.creds) await app.repo.createCharacter(g.accountId, name, o.pos[0], o.pos[1]);
  const client = new Client(wsUrl(app));
  const r = await client.joinOrCreate('world', { token: g.token, name, ...(o.shard ? { shard: o.shard } : {}) });
  const room = matchMaker.getLocalRoomById(r.roomId) as unknown as GameRoom;
  await until(() => room.players.has(r.sessionId), 5000);
  const sp = room.players.get(r.sessionId)!;
  const p: P4 = {
    r, name, token: g.token, accountId: g.accountId, room, sp,
    chat: [], party: [], invites: [], emotes: [], trades: [], tradeReqs: [], handoffs: [], profiles: [],
  };
  r.onMessage(MSG34.CHAT_MSG, (m) => p.chat.push(m));
  r.onMessage(MSG34.PARTY_STATE, (m) => p.party.push(m));
  r.onMessage(MSG34.PARTY_INVITE, (m) => p.invites.push(m));
  r.onMessage(MSG34.EMOTE_EV, (m) => p.emotes.push(m));
  r.onMessage(MSG34.TRADE_STATE, (m) => p.trades.push(m));
  r.onMessage(MSG34.TRADE_REQ, (m) => p.tradeReqs.push(m));
  r.onMessage(MSG34.HANDOFF, (m) => p.handoffs.push(m));
  r.onMessage(MSG.PROFILE, (m) => p.profiles.push(m));
  r.onMessage('*', () => {});
  // let the module's async join (mute lookup, party refresh) settle
  await sleep(60);
  if (o.relax !== false) relaxP4(p);
  return p;
}

export const lastParty = (p: P4): PartyStateMsg | undefined => p.party[p.party.length - 1];
export const lastTrade = (p: P4): TradeStateMsg | undefined => p.trades[p.trades.length - 1];
export const sysLines = (p: P4): string[] => p.chat.filter((c) => c.ch === 'system').map((c) => c.text);
export const hasSys = (p: P4, re: RegExp): boolean => sysLines(p).some((t) => re.test(t));
export const waitSys = (p: P4, re: RegExp, ms = 3000) => until(() => hasSys(p, re), ms);

export const dev = (p: P4, msg: Record<string, unknown>) => p.r.send(MSG.DEV, msg);

export async function tpP4(p: P4, x: number, y: number): Promise<void> {
  dev(p, { cmd: 'tp', x, y });
  await until(() => Math.abs(p.sp.sim.x - x) < 0.01 && Math.abs(p.sp.sim.y - y) < 0.01);
}

export const countOf = (p: P4, id: string): number => p.sp.data.inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
export const slotOfP4 = (p: P4, id: string): number => p.sp.data.inv.findIndex((s) => s?.id === id);

export async function giveP4(p: P4, id: string, n = 1): Promise<void> {
  const before = countOf(p, id);
  dev(p, { cmd: 'give', id, n });
  await until(() => countOf(p, id) >= before + n);
}

/** Put two players into a party (a invites b). */
export async function partyUp(a: P4, b: P4): Promise<string> {
  const n0 = b.invites.length;
  a.r.send(MSG34.PARTY, { action: 'invite', name: b.name });
  await until(() => b.invites.length > n0, 4000);
  const inv = b.invites[b.invites.length - 1]!;
  b.r.send(MSG34.PARTY, { action: 'accept', partyId: inv.partyId });
  await until(() => a.room.social.partyOf(b.accountId) === inv.partyId && a.room.social.partyOf(a.accountId) === inv.partyId, 4000);
  return inv.partyId;
}

export { sleep, until };
