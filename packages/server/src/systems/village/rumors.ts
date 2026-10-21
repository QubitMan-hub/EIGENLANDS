import { NPCS, RUMOR_TEMPLATES } from '@eigenlands/shared';

export interface Rumor { id: number; kind: string; who: string; what: string; text: string; day: number; heard: string[] }
export const MAX_RUMORS = 40;
/** NPCs who hear everything (town hall, inn). */
export const GOSSIPS = ['orla', 'maribel'];

export function renderRumor(kind: string, who: string, what: string): string {
  const tpl = RUMOR_TEMPLATES[kind] ?? '{who} did something worth talking about.';
  return tpl.replace(/\{who\}/g, who).replace(/\{what\}/g, what).replace(/\{npc\}/g, what);
}

export class RumorBook {
  list: Rumor[] = [];
  private seq = 1;

  load(v: unknown): void {
    if (!Array.isArray(v)) return;
    this.list = v.filter((r): r is Rumor => r && typeof r.id === 'number' && typeof r.text === 'string' && Array.isArray(r.heard)).slice(-MAX_RUMORS);
    this.seq = this.list.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  }

  add(kind: string, who: string, what: string, day: number): Rumor {
    const r: Rumor = { id: this.seq++, kind, who, what, text: renderRumor(kind, who, what), day, heard: [] };
    this.list.push(r);
    if (this.list.length > MAX_RUMORS) this.list.splice(0, this.list.length - MAX_RUMORS);
    return r;
  }

  heardBy(npc: string): Rumor[] { return this.list.filter((r) => r.heard.includes(npc)); }

  /** Gossips hear every rumor. Returns true if anything changed. */
  gossipHears(): boolean {
    let changed = false;
    for (const r of this.list) for (const g of GOSSIPS) if (!r.heard.includes(g)) { r.heard.push(g); changed = true; }
    return changed;
  }

  /** Two NPCs in earshot trade one rumor with probability 0.5. */
  exchange(a: string, b: string, rand: () => number): boolean {
    if (rand() >= 0.5) return false;
    const opts: Array<[Rumor, string]> = [];
    for (const r of this.list) {
      const ha = r.heard.includes(a), hb = r.heard.includes(b);
      if (ha && !hb) opts.push([r, b]);
      else if (hb && !ha) opts.push([r, a]);
    }
    if (!opts.length) return false;
    const [r, to] = opts[Math.floor(rand() * opts.length)]!;
    r.heard.push(to);
    return true;
  }

  /** Drop rumors older than `maxAgeDays`. */
  prune(day: number, maxAgeDays = 6): boolean {
    const n = this.list.length;
    this.list = this.list.filter((r) => day - r.day <= maxAgeDays);
    return this.list.length !== n;
  }
}

export const NPC_IDS = NPCS.map((n) => n.id);
