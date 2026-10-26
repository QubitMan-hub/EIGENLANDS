/** Additive integration with the item expansion: no replacement of its foods, gear or material tables. */
import { COL as C, item, rec } from './kit';
item('guild_noticeboard', 'Adventurer Guild Board', 'furniture', {
  v: 240,
  g: 'sign',
  a: C.e4,
  b: C.q7,
  d: 'An original isometric guild ledger. Place in your hall to register, manage commissions and verify deeds.',
  place: { kind: 'furniture', sub: 'guild_noticeboard' },
});
rec(
  'carpenter',
  [
    ['wood', 16],
    ['plank', 4],
    ['qubit_crystal', 1],
  ],
  ['guild_noticeboard', 1],
  { lvl: 3, disc: 'woodworking' },
);
