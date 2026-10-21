import type { ClientModule, P34Deps } from '../types';

/** Circuit Board UI, ability bar, resource bar, Lumen tutorial, Qubitpedia, spell rendering (Phase 3). */
export class CircuitClient implements ClientModule {
  constructor(readonly d: P34Deps) {}
  debug(): Record<string, unknown> { return {}; }
}
