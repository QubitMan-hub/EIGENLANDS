import { GATE_RANKS, GATE_RANK_INFO, SPELL, isGateY } from '@eigenlands/shared';
import type { ClientModule, P34Deps } from '../types';

/** Dungeon gates: what the gate beside you is, and whether you are strong enough to step through. */
export class GatesClient implements ClientModule {
  private gates: Array<{ x: number; y: number; rank: number; exit: boolean }> = [];

  constructor(private d: P34Deps) {}

  onState(s: any): void {
    const list: GatesClient['gates'] = [];
    s?.spells?.forEach?.((v: { kind: number; x: number; y: number; hue: number; r: number }) => {
      if (v.kind === SPELL.GATE) list.push({ x: v.x, y: v.y, rank: v.hue, exit: v.r === 2 });
    });
    this.gates = list;
  }

  hint(): string | null {
    const me = this.d.me();
    if (!me || this.d.wins.open) return null;
    let near: GatesClient['gates'][number] | null = null,
      best = 4;
    for (const g of this.gates) {
      const d = Math.hypot(g.x - me.x, g.y - me.y);
      if (d < best) {
        best = d;
        near = g;
      }
    }
    if (!near) return null;
    if (near.exit)
      return isGateY(me.y) ? 'The way out of the gate: step into the pale rift to return to the world.' : null;
    const rank = GATE_RANKS[near.rank] ?? 'E',
      need = GATE_RANK_INFO[near.rank]?.level ?? 1;
    return this.d.level() >= need
      ? `${rank}-rank gate: step into the rift to enter its dungeon. Clear its master before dusk, or it breaks.`
      : `${rank}-rank gate: hunters below level ${need} are pushed back. Close it before dusk, or it breaks loose.`;
  }

  debug(): Record<string, unknown> {
    return { gates: this.gates.length };
  }
}
