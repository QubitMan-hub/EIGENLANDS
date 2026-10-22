import { MSG34, type ChatMsg } from '@eigenlands/shared';
import type { ServerPlayer } from '../../rooms/player';
import type { SocialHub } from './hub';

/** lines kept per account for /report context */
const LOG_KEEP = 30;

/** Send a chat line to a player and remember it (report context). */
export function deliver(hub: SocialHub, p: ServerPlayer, msg: ChatMsg): void {
  try { p.client.send(MSG34.CHAT_MSG, msg); } catch { /* socket already gone */ }
  const log = hub.limitsOf(p.accountId).log;
  log.push(msg);
  if (log.length > LOG_KEEP) log.splice(0, log.length - LOG_KEEP);
}

export const sysMsg = (text: string): ChatMsg => ({ ch: 'system', from: '', fromId: '', text, t: Date.now() });

export function sys(hub: SocialHub, p: ServerPlayer, text: string): void { deliver(hub, p, sysMsg(text)); }

/** A display name from the client: printable, trimmed, bounded. '' when unusable. */
export function nameArg(v: unknown): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s.length > 0 && s.length <= 32 ? s : '';
}

export const dist = (a: ServerPlayer, b: ServerPlayer): number => Math.hypot(a.sim.x - b.sim.x, a.sim.y - b.sim.y);
