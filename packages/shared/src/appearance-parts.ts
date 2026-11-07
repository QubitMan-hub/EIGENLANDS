/** Additive catalog selections: zero retains the saved legacy appearance. */
export const PART_COUNTS = { hair: 50, eyes: 50, mouths: 50, tops: 50, pants: 55, shorts: 50, boots: 50 } as const;
export type PartKind = keyof typeof PART_COUNTS;
export type AppearanceParts = Record<PartKind, number>;
export function validParts(value: unknown): AppearanceParts {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const result = {} as AppearanceParts;
  for (const key of Object.keys(PART_COUNTS) as PartKind[]) {
    const v = input[key];
    result[key] = typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= PART_COUNTS[key] ? v : 0;
  }
  if (result.shorts) result.pants = 0;
  return result;
}
export function partsKey(value: unknown): string {
  const p =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        })()
      : value;
  const parts = validParts(p);
  return Object.values(parts).some(Boolean) ? JSON.stringify(parts) : '';
}
