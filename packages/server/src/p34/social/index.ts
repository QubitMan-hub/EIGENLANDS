import type { GameRoom } from '../../rooms/GameRoom';
import type { Module, PartyApi, Registrar } from '../types';

/** Parties, chat, emotes and trading (Phase 4). */
export class SocialModule implements Module, PartyApi {
  constructor(readonly room: GameRoom) {}
  install(_reg: Registrar): void {}
  partyOf(_accountId: string): string { return ''; }
  partyMates(_accountId: string): string[] { return []; }
}
