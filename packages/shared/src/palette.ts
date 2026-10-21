/** The fixed 48-colour master palette. All art is drawn from these values only. */
export const PALETTE = [
  // neutrals
  '#0b0c1a', '#1a1c2e', '#2c2f4a', '#484c6e', '#6d7194', '#9a9ec0', '#c9cce6', '#f4f4ff',
  // greens
  '#0f2a1e', '#14402a', '#1f5e33', '#2f8040', '#4da64a', '#7bc95a', '#a9e07a', '#d4f2a0',
  // earth
  '#2a1810', '#45281a', '#6b3f26', '#8f5c36', '#b57f4a', '#d6a566', '#ecd08e', '#f8ecc0',
  // water
  '#0a1a3a', '#0f2f66', '#1650a0', '#2a7ad0', '#4aa6f0', '#7cd0ff', '#b4eaff', '#e0f8ff',
  // warm
  '#3a0f1c', '#6b1a2e', '#a02a3a', '#d44a4a', '#f07a4a', '#f8a84a', '#fcd45a', '#fff08a',
  // quantum
  '#2a1060', '#4a1a9a', '#7a3ad0', '#a46aff', '#d49aff', '#ff6ad0', '#ff9ae8', '#5af0d0',
] as const;

export const C = {
  ink: 0, night: 1, slate: 2, steel: 3, mist: 4, fog: 5, pale: 6, white: 7,
  g0: 8, g1: 9, g2: 10, g3: 11, g4: 12, g5: 13, g6: 14, g7: 15,
  e0: 16, e1: 17, e2: 18, e3: 19, e4: 20, e5: 21, e6: 22, e7: 23,
  w0: 24, w1: 25, w2: 26, w3: 27, w4: 28, w5: 29, w6: 30, w7: 31,
  r0: 32, r1: 33, r2: 34, r3: 35, r4: 36, r5: 37, r6: 38, r7: 39,
  q0: 40, q1: 41, q2: 42, q3: 43, q4: 44, q5: 45, q6: 46, q7: 47,
} as const;

export function paletteHex(i: number): string {
  return PALETTE[i]!;
}
