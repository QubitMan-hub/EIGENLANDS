/** The fixed 48-colour master palette. All art is drawn from these values only. */
export const PALETTE = [
  // neutrals (navy ink -> cool stone -> bone white); blue-grey like weathered rock, never pure black
  '#090a14', '#151d28', '#202e37', '#394a50', '#577277', '#819796', '#a8b5b2', '#ebede9',
  // greens (deep moss -> olive -> lime highlight -> pale straw-green)
  '#19332d', '#25562e', '#34692f', '#468232', '#5d953c', '#75a743', '#a8ca58', '#d0da91',
  // earth (plum-black soil -> cocoa -> clay -> warm tan -> parchment)
  '#241527', '#341c27', '#4d2b32', '#7a4841', '#ad7757', '#c09473', '#d7b594', '#e7d5b3',
  // water (night navy -> slate blue -> sea blue -> cyan foam)
  '#172038', '#253a5e', '#3c5e8b', '#4f8fba', '#5fa5c6', '#73bed3', '#a4dddb', '#d6f0ea',
  // warm (rust soil -> brick red -> ember -> amber -> butter)
  '#602c2c', '#884b2b', '#a53030', '#cf573c', '#da863e', '#de9e41', '#e8c170', '#f4e4ac',
  // quantum (signature; kept as small glowing accents: indigo -> violet -> lilac, magenta/pink, cyan glow)
  '#1e1d39', '#402751', '#61358a', '#8a52b8', '#b98ad6', '#c65197', '#df84a5', '#7fe3d3',
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
