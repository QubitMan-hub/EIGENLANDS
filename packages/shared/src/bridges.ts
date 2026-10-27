import { T } from './tiles';

/**
 * Bridge furniture: every deck tile (the plank FLOOR that settlements and the royal roads lay over rivers, canals,
 * moats and lakes) with open water or lava beside it gets a railing on that side, and a lantern post where the deck
 * meets land again. Pure and cosmetic: decks already carry their collision, so the client simply draws these.
 *
 * Sides: 0 toward -y, 1 toward +x, 2 toward +y, 3 toward -x.
 */
export interface BridgeRail {
  x: number;
  y: number;
  side: 0 | 1 | 2 | 3;
  /** the last deck tile before land along the rail: a lantern post stands here */
  end: boolean;
}
const SIDES: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const LIQUID = new Set<number>([T.WATER, T.DEEP_WATER, T.LAVA]);
const ROOM = new Set<number>([T.WALL, T.FACE, T.DOOR]);

export function bridgeRailsIn(
  tile: (x: number, y: number) => number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): BridgeRail[] {
  const out: BridgeRail[] = [];
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (tile(x, y) !== T.FLOOR) continue;
      for (let s = 0; s < 4; s++) {
        const [dx, dy] = SIDES[s]!;
        if (!LIQUID.has(tile(x + dx, y + dy))) continue;
        // a floor beside a wall or door is a room's edge (a waterside house), not a bridge
        if (ROOM.has(tile(x - dx, y - dy))) continue;
        // along the rail (perpendicular to the side): does the deck meet land on either hand?
        const ax = dy,
          ay = dx;
        const land = (k: number) => {
          const t = tile(x + ax * k, y + ay * k);
          return t !== T.FLOOR && !LIQUID.has(t);
        };
        out.push({ x, y, side: s as 0 | 1 | 2 | 3, end: land(1) || land(-1) });
      }
    }
  return out;
}
