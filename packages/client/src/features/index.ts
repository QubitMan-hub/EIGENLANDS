import { AdventureClient } from './adventure';
import { CircuitClient } from './circuit';
import { ShadowClient } from './shadows';
import { ShardClient } from './shard';
import { SocialClient } from './social';
import type { ClientModule, P34Deps } from './types';

/** Phase 3/4 client: the Circuit Board, abilities and tutorial; parties, chat and trading; shard handoff and ghosts. */
export class P34Client {
  readonly circuit: CircuitClient;
  readonly social: SocialClient;
  readonly shard: ShardClient;
  readonly shadows: ShadowClient;
  readonly adventure: AdventureClient;
  private mods: ClientModule[];

  constructor(readonly d: P34Deps) {
    this.circuit = new CircuitClient(d);
    this.social = new SocialClient(d);
    this.shard = new ShardClient(d);
    this.shadows = new ShadowClient(d);
    this.adventure = new AdventureClient(d);
    this.mods = [this.shard, this.circuit, this.social, this.shadows, this.adventure];
    d.input.onAction = (a) => { for (const m of this.mods) if (m.action?.(a)) return; };
    d.input.onFire = (a) => { for (const m of this.mods) m.fire?.(a); };
  }

  handlers(): Record<string, (m: any) => void> {
    const out: Record<string, (m: any) => void> = {};
    for (const m of this.mods) Object.assign(out, m.handlers?.() ?? {});
    return out;
  }
  onState(s: any): void { for (const m of this.mods) m.onState?.(s); }
  onWelcome(): void { for (const m of this.mods) m.onWelcome?.(); }
  frame(now: number, dt: number): void { for (const m of this.mods) m.frame?.(now, dt); }
  get blocking(): boolean { return this.mods.some((m) => m.blocking?.() ?? false); }
  hint(): string | null { for (const m of this.mods) { const h = m.hint?.(); if (h) return h; } return null; }
  debug(): Record<string, unknown> { const o: Record<string, unknown> = {}; for (const m of this.mods) Object.assign(o, m.debug?.() ?? {}); return o; }
}
