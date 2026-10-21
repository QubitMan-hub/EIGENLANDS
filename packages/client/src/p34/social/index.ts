import type { ClientModule, P34Deps } from '../types';

/** Party frames, chat, emotes, trading (Phase 4). */
export class SocialClient implements ClientModule {
  constructor(readonly d: P34Deps) {}
  debug(): Record<string, unknown> { return {}; }
}
