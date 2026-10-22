/** The fixed 48-colour master palette. All art is drawn from these values only. */
export const PALETTE = [
  // neutrals (cool violet shadows -> warm paper white)
  '#0d0b17', '#1c1a2e', '#2e2c45', '#4a4964', '#6f6e8a', '#9d9db4', '#cfcfdc', '#f7f4ec',
  // greens (teal shade -> sunlit yellow-green)
  '#10282a', '#163d34', '#1f5a3a', '#2f7a3e', '#4f9a3f', '#7cb649', '#b0d266', '#e2ec9e',
  // earth (plum-brown -> cream)
  '#2a1a20', '#472a28', '#6c4231', '#93603b', '#b9834b', '#d7a861', '#edcb88', '#f8e9c0',
  // water (ink blue -> foam)
  '#0e1838', '#152f5c', '#1c4c88', '#2a70b0', '#3d96cf', '#66bfe2', '#a2dded', '#e0f7f5',
  // warm (wine -> butter)
  '#3a1320', '#691d2d', '#9e2d39', '#cf4b45', '#ea7a4b', '#f5a654', '#fad26a', '#fdf1a4',
  // quantum (signature)
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
