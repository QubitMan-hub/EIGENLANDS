/** The crypt plane (crypts.ts): ruin crypt interiors live this many tiles away from the surface. */
export const CRYPT_OY = -200000;
const CRYPT_SPAN = 12000;
export const isCryptY = (y: number): boolean => y > CRYPT_OY - CRYPT_SPAN && y < CRYPT_OY + CRYPT_SPAN;
