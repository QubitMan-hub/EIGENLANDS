import { MSG_CIV, type CivSummary, type RealmId } from '@eigenlands/shared';

/** The latest kingdom state from the server (master plan §16), for the Journal, settlements and shops. */
let state: CivSummary | null = null;
const listeners = new Set<() => void>();
let sender: ((type: string, msg: unknown) => void) | null = null;

export const civState = (): CivSummary | null => state;
export function setCivState(s: CivSummary): void {
  state = s;
  for (const l of listeners) l();
}
export function onCivChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function setCivSender(fn: (type: string, msg: unknown) => void): void {
  sender = fn;
}
/** Decide a kingdom's court intrigue (the server checks you are in that kingdom). */
export function chooseIntrigue(realm: RealmId, choice: 'a' | 'b'): void {
  sender?.(MSG_CIV.CHOOSE, { realm, choice });
}
