import { DIFFICULTY_RULES, type Difficulty } from './survival';

/** Private travel needs, driven only by online simulation seconds. */
export interface TravelNeeds {
  mode: Difficulty;
  food: number;
  water: number;
  /** body temperature -100 (freezing) .. 100 (scorching); 0 comfortable */
  temp: number;
}
export function validTravelNeeds(raw: unknown): TravelNeeds {
  const r = raw as Partial<TravelNeeds> | null;
  const meter = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 100);
  const temp = typeof r?.temp === 'number' && Number.isFinite(r.temp) ? Math.max(-100, Math.min(100, r.temp)) : 0;
  const mode: Difficulty = r?.mode === 'adventure' || r?.mode === 'hardcore' ? r.mode : 'cozy';
  return { mode, food: meter(r?.food), water: meter(r?.water), temp };
}
export function stepTravelNeeds(
  needs: TravelNeeds,
  seconds: number,
  ctx: {
    exerted: boolean;
    desert: boolean;
    paused: boolean;
    /** fraction less hunger and thirst (gear, food) */ drain?: number;
  },
): TravelNeeds {
  const n = validTravelNeeds(needs);
  if (n.mode === 'cozy' || ctx.paused || !Number.isFinite(seconds) || seconds <= 0) return n;
  const effort =
    (ctx.exerted ? 1.25 : 1) * DIFFICULTY_RULES[n.mode].drain * (1 - Math.max(0, Math.min(0.6, ctx.drain ?? 0)));
  return {
    ...n,
    food: Math.max(0, n.food - ((seconds * 100) / 1800) * effort),
    water: Math.max(0, n.water - ((seconds * 100) / 1200) * effort * (ctx.desert ? 1.5 : 1)),
  };
}
