import type { ClassId } from '@eigenlands/shared';
import type { GameRoom } from '../../rooms/GameRoom';
import type { CircuitApi, Module, Registrar } from '../types';

/** Circuit Board progression + abilities (Phase 3). */
export class CircuitModule implements Module, CircuitApi {
  constructor(readonly room: GameRoom) {}
  install(_reg: Registrar): void {}
  classOf(_sid: string): ClassId { return 'wanderer'; }
}
