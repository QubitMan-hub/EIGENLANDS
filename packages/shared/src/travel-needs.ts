/** Private travel needs, driven only by online simulation seconds. */
export interface TravelNeeds {
  mode: 'cozy' | 'adventure';
  food: number;
  water: number;
}
export function validTravelNeeds(raw: unknown): TravelNeeds {
  const r = raw as Partial<TravelNeeds> | null;
  const meter = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 100);
  return { mode: r?.mode === 'adventure' ? 'adventure' : 'cozy', food: meter(r?.food), water: meter(r?.water) };
}
export function stepTravelNeeds(
  needs: TravelNeeds,
  seconds: number,
  ctx: { exerted: boolean; desert: boolean; paused: boolean },
): TravelNeeds {
  const n = validTravelNeeds(needs);
  if (n.mode === 'cozy' || ctx.paused || !Number.isFinite(seconds) || seconds <= 0) return n;
  const effort = ctx.exerted ? 1.25 : 1;
  return {
    ...n,
    food: Math.max(0, n.food - ((seconds * 100) / 1800) * effort),
    water: Math.max(0, n.water - ((seconds * 100) / 1200) * effort * (ctx.desert ? 1.5 : 1)),
  };
}
