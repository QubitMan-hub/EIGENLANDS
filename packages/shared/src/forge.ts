/**
 * Interference Forging. Every metal/part has a PHASE (shown as a colour). Combining materials makes their
 * phases interfere: in-phase materials reinforce (bonus stats), out-of-phase ones cancel (flaws shrink).
 * A short rhythm minigame at the anvil tunes the result.
 */
import { METALS } from './catalog/metals';
export type Stat = 'atk' | 'dur' | 'eff' | 'spd' | 'mag';
export type StatVec = Partial<Record<Stat, number>>;

export interface Material {
  id: string;
  grade: number;
  phase: number;
  main: StatVec;
  flaw: StatVec;
}

export const MATERIALS: Record<string, Material> = {
  copper_ingot: { id: 'copper_ingot', grade: 2, phase: 1, main: { atk: 4, eff: 4 }, flaw: { dur: -3 } },
  iron_ingot: { id: 'iron_ingot', grade: 3, phase: 5, main: { atk: 7, dur: 6, eff: 6 }, flaw: { spd: -3 } },
  silver_ingot: { id: 'silver_ingot', grade: 4, phase: 4, main: { spd: 5, mag: 6, eff: 5 }, flaw: { dur: -4 } },
  gold_ingot: { id: 'gold_ingot', grade: 3, phase: 2, main: { mag: 5, spd: 3 }, flaw: { atk: -4, dur: -3 } },
  qubit_crystal: { id: 'qubit_crystal', grade: 5, phase: 6, main: { atk: 8, mag: 10 }, flaw: { dur: -6, spd: -2 } },
  slime_gel: { id: 'slime_gel', grade: 2, phase: 4, main: { spd: 4, dur: 2 }, flaw: { atk: -2 } },
  hopper_tooth: { id: 'hopper_tooth', grade: 3, phase: 0, main: { atk: 6 }, flaw: { dur: -2 } },
  heartwood: { id: 'heartwood', grade: 3, phase: 3, main: { dur: 6, eff: 3 }, flaw: { atk: -2 } },
};

export type Template = 'sword' | 'axe' | 'pickaxe' | 'hoe';
export const TEMPLATES: Template[] = ['sword', 'axe', 'pickaxe', 'hoe'];

/** cos of the phase difference (phases are in 45-degree steps). */
export const interference = (a: number, b: number): number => Math.cos(((a - b) * Math.PI) / 4);

export interface ForgePreview {
  coherence: number; // -1 (cancel) .. +1 (reinforce)
  phase: number; // resulting phase 0..8 (fractional)
  stats: Record<Stat, number>;
  tier: number;
  note: string;
}

export interface ForgeResult extends ForgePreview {
  quality: number;
  qname: string;
  item: {
    id: Template;
    props: {
      tier: number;
      atk: number;
      phase: number;
      quality: number;
      qname: string;
      note: string;
      stats: Record<Stat, number>;
    };
  };
}

export const qualityName = (q: number): string =>
  q < 0.35 ? 'Rough' : q < 0.65 ? 'Fine' : q < 0.9 ? 'Superior' : 'Perfect';

export function preview(ids: string[], quality = 0.5): ForgePreview | null {
  if (ids.length < 2 || ids.length > 3) return null;
  const mats: Material[] = [];
  for (const id of ids) {
    const m = MATERIALS[id];
    if (!m) return null;
    mats.push(m);
  }
  let cs = 0,
    pairs = 0;
  for (let i = 0; i < mats.length; i++)
    for (let j = i + 1; j < mats.length; j++) {
      cs += interference(mats[i]!.phase, mats[j]!.phase);
      pairs++;
    }
  const C = cs / pairs;
  const kc = 1 + 0.35 * Math.max(0, C);
  const kd = 1 - 0.2 * Math.max(0, -C);
  const kf = 1 - 0.7 * Math.max(0, -C);
  const kq = 0.85 + 0.35 * quality;
  const stats: Record<Stat, number> = { atk: 0, dur: 0, eff: 0, spd: 0, mag: 0 };
  for (const s of Object.keys(stats) as Stat[]) {
    let pos = 0,
      neg = 0;
    for (const m of mats) {
      pos += m.main[s] ?? 0;
      neg += m.flaw[s] ?? 0;
    }
    stats[s] = Math.round(pos * kc * kd * kq + neg * kf);
  }
  let sx = 0,
    sy = 0,
    grade = 0;
  // weighting by grade breaks ties between exactly opposed phases in favour of the stronger metal
  for (const m of mats) {
    sx += m.grade * Math.cos((m.phase * Math.PI) / 4);
    sy += m.grade * Math.sin((m.phase * Math.PI) / 4);
    grade += m.grade;
  }
  const phase = ((Math.atan2(sy, sx) * 4) / Math.PI + 8) % 8;
  const avgGrade = grade / mats.length;
  const tier = Math.max(
    1,
    Math.min(8, Math.round(avgGrade * (0.9 + 0.12 * quality) + 0.3 * Math.max(0, C) - 0.15 * Math.max(0, -C))),
  );
  const note =
    C > 0.6
      ? 'In phase: the metals sing together.'
      : C < -0.6
        ? 'Out of phase: flaws cancel out.'
        : 'Mixed phases: an ordinary alloy.';
  return { coherence: C, phase, stats, tier, note };
}

export function forge(template: Template, ids: string[], accuracy: number): ForgeResult | null {
  const pv = preview(ids, accuracy);
  if (!pv) return null;
  const q = Math.max(0, Math.min(1, accuracy));
  const atk = Math.max(0, pv.stats.atk) + (template === 'sword' ? 3 : 0);
  const qname = qualityName(q);
  return {
    ...pv,
    quality: q,
    qname,
    item: {
      id: template,
      props: {
        tier: pv.tier,
        atk,
        phase: Math.round(pv.phase * 10) / 10,
        quality: q,
        qname,
        note: pv.note,
        stats: pv.stats,
      },
    },
  };
}

// The catalog's metals can be forged too: each ingot is a material with its own colour (phase) and strengths, so a
// smith can chase an alloy that sings (or cancels) and reach tool tiers beyond crystal (6 mithril, 7 adamant, 8 voidsteel).
const STRENGTH: Record<string, { main: StatVec; flaw: StatVec }> = {
  tin_ingot: { main: { eff: 3 }, flaw: { atk: -2, dur: -3 } },
  bronze_ingot: { main: { atk: 5, dur: 5, eff: 4 }, flaw: { spd: -2 } },
  steel_ingot: { main: { atk: 9, dur: 8, eff: 7 }, flaw: { spd: -3 } },
  mithril_ingot: { main: { atk: 10, spd: 9, mag: 8, eff: 8 }, flaw: { dur: -3 } },
  adamant_ingot: { main: { atk: 14, dur: 14, eff: 11 }, flaw: { spd: -5 } },
  voidsteel_ingot: { main: { atk: 18, mag: 14, eff: 12, spd: 6 }, flaw: { dur: -6 } },
  skysteel_ingot: { main: { atk: 8, spd: 9, eff: 7 }, flaw: { dur: -2 } },
  deepsteel_ingot: { main: { atk: 9, dur: 12, eff: 9 }, flaw: { spd: -4 } },
  stormiron_ingot: { main: { atk: 11, spd: 8, mag: 5 }, flaw: { dur: -3 } },
  tidesilver_ingot: { main: { mag: 9, eff: 9, spd: 5 }, flaw: { atk: -2 } },
  hellsteel_ingot: { main: { atk: 14, mag: 6, eff: 8 }, flaw: { dur: -4, spd: -2 } },
  moonsilver_ingot: { main: { mag: 11, spd: 9, eff: 7 }, flaw: { dur: -3 } },
};
for (const m of METALS) {
  const id = `${m.id}_ingot`,
    s = STRENGTH[id];
  if (s && !MATERIALS[id])
    MATERIALS[id] = { id, grade: Math.min(8, m.tier), phase: m.phase, main: s.main, flaw: s.flaw };
}
