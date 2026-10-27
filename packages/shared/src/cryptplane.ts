/** The crypt plane (crypts.ts): ruin crypt interiors live this many tiles away from the surface. */
export const CRYPT_OY = -200000;
/** the second floor of every crypt (the Sunken Vault) lies on a plane of its own, further down */
export const CRYPT_DEEP_OY = -240000;
const CRYPT_SPAN = 12000;
export const isCryptDeepY = (y: number): boolean => y > CRYPT_DEEP_OY - CRYPT_SPAN && y < CRYPT_DEEP_OY + CRYPT_SPAN;
export const isCryptY = (y: number): boolean =>
  (y > CRYPT_OY - CRYPT_SPAN && y < CRYPT_OY + CRYPT_SPAN) || isCryptDeepY(y);
