import { KINGDOMS } from './kingdoms';
import { residentsOfSite, type Place, type ResidentPlan } from './realm-npcs';
import { REALM_IDS, REALM_SITES, type RealmId, type RealmSite } from './realms';
import { mulberry32 } from './rng';
import { T } from './tiles';
import { furnish, type Building, type BuildingKind, type Town } from './town';

/**
 * Settlement generator for the six kingdoms (world revision 5). Every plot is laid out from its own seeded random
 * stream, so no two cities share a plan: row streets of varying pitch and reach, lanes, parks, ponds, rivers or canals,
 * a plaza of changing size and position, partial or full walls and, in a capital, a castle that belongs to its kingdom
 * (moated Aurelion keep with a tourney ground, Sylvaris grove-palace, Khar-Dum fortress-hold, concentric Raijin
 * citadel, Thalassara island palace, Nethrakar obsidian citadel behind a lava moat).
 *
 * Doors always face south, so buildings stand on the north side of the street they open on. Style codes are
 * `4 + realm * 5 + variant` (0-2 common homes, 3 civic and merchant, 4 grand: palaces, keeps, halls and temples).
 */
const cache = new Map<number, Town[]>();

export function realmTowns(seed: number): Town[] {
  const hit = cache.get(seed);
  if (hit) return hit;
  const towns = REALM_SITES.map((site) => build(site, seed));
  if (cache.size > 6) cache.clear();
  cache.set(seed, towns);
  return towns;
}

// ───────────────────────── per-kingdom character ─────────────────────────

interface Profile {
  /** house footprints [w, h] to choose from */
  houses: Array<[number, number]>;
  /** probability that a home is a larger manor */
  manor: number;
  wall: 'stone' | 'hedge' | 'palisade' | 'canal' | 'obsidian';
  river: number;
  canals: boolean;
  /** density of trees and garden beds in yards and parks (0..1) */
  green: number;
  castle: RealmId;
}
const PROFILE: Record<RealmId, Profile> = {
  aurelion: {
    houses: [
      [10, 8],
      [12, 8],
      [11, 9],
      [13, 9],
    ],
    manor: 0.2,
    wall: 'stone',
    river: 0.5,
    canals: false,
    green: 0.3,
    castle: 'aurelion',
  },
  sylvaris: {
    houses: [
      [9, 7],
      [11, 7],
      [14, 6],
      [8, 8],
    ],
    manor: 0.1,
    wall: 'hedge',
    river: 0.7,
    canals: false,
    green: 0.9,
    castle: 'sylvaris',
  },
  khardum: {
    houses: [
      [8, 9],
      [9, 8],
      [10, 10],
      [12, 8],
    ],
    manor: 0.12,
    wall: 'stone',
    river: 0.1,
    canals: false,
    green: 0.05,
    castle: 'khardum',
  },
  raijin: {
    houses: [
      [9, 7],
      [10, 7],
      [8, 8],
      [12, 8],
    ],
    manor: 0.15,
    wall: 'palisade',
    river: 0.6,
    canals: false,
    green: 0.6,
    castle: 'raijin',
  },
  thalassara: {
    houses: [
      [9, 8],
      [10, 7],
      [12, 8],
      [11, 9],
    ],
    manor: 0.15,
    wall: 'canal',
    river: 0,
    canals: true,
    green: 0.35,
    castle: 'thalassara',
  },
  nethrakar: {
    houses: [
      [9, 9],
      [10, 8],
      [11, 10],
      [8, 8],
    ],
    manor: 0.2,
    wall: 'obsidian',
    river: 0.15,
    canals: false,
    green: 0.1,
    castle: 'nethrakar',
  },
};

// ───────────────────────── building slots ─────────────────────────

interface Slot {
  place: Place | 'home';
  kind: BuildingKind;
  /** furnish() trade id for buildings that are kind 'house' but have a trade interior */
  trade?: string;
  w: number;
  h: number;
  /** style variant 0..4 (see the file comment) */
  v: number;
}
const SERVICE: Partial<Record<Place, Omit<Slot, 'place' | 'v'> & { v: number }>> = {
  barracks: { kind: 'house', trade: 'scout', w: 13, h: 8, v: 3 },
  inn: { kind: 'inn', w: 14, h: 9, v: 3 },
  store: { kind: 'store', w: 12, h: 8, v: 3 },
  smithy: { kind: 'smithy', w: 12, h: 8, v: 3 },
  herbalist: { kind: 'house', trade: 'herbalist', w: 10, h: 8, v: 1 },
  library: { kind: 'house', trade: 'library', w: 13, h: 9, v: 4 },
  hall: { kind: 'hall', w: 15, h: 9, v: 4 },
  farmhouse: { kind: 'farmhouse', w: 12, h: 8, v: 0 },
  house: { kind: 'house', w: 10, h: 8, v: 1 },
};

// occupancy values
const FREE = 0,
  ROAD = 1,
  BLD = 2,
  RES = 3,
  WATER = 4;

function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function build(site: RealmSite, seed: number): Town {
  const def = KINGDOMS[site.realm];
  const prof = PROFILE[site.realm];
  const ri = REALM_IDS.indexOf(site.realm);
  const R = mulberry32((strHash(site.id) ^ Math.imul(seed, 2654435761)) >>> 0);
  const rnd = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
  const chance = (p: number) => R() < p;
  const pickOf = <X>(a: readonly X[]): X => a[Math.floor(R() * a.length)]!;
  const styleOf = (v: number) => 4 + ri * 5 + v;

  const W = site.w,
    H = site.h;
  const x0 = site.cx - W / 2,
    y0 = site.cy - H / 2,
    x1 = x0 + W - 1,
    y1 = y0 + H - 1;
  const cx = site.cx,
    cy = site.cy;
  const name =
    site.kind === 'capital'
      ? def.capital
      : site.kind === 'town'
        ? def.names.towns[site.ring as 'n']
        : site.kind === 'village'
          ? def.names.villages[site.ring as 'n']
          : def.names.seaward[site.ring as 'n'];
  const t: Town = {
    name,
    cx,
    cy,
    x0,
    y0,
    x1,
    y1,
    buildings: [],
    objects: [],
    spots: {},
    tiles: new Map(),
  };
  const inPlot = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const set = (x: number, y: number, v: number) => {
    if (inPlot(x, y)) t.tiles.set(x - x0 + (y - y0) * W, v);
  };
  const get = (x: number, y: number): number => (inPlot(x, y) ? (t.tiles.get(x - x0 + (y - y0) * W) ?? -1) : -1);
  const rect = (x: number, y: number, w: number, h: number, v: number) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, v);
  };
  const occ = new Uint8Array(W * H);
  const oAt = (x: number, y: number) => (inPlot(x, y) ? occ[x - x0 + (y - y0) * W]! : RES);
  const oSet = (x: number, y: number, v: number) => {
    if (inPlot(x, y)) occ[x - x0 + (y - y0) * W] = v;
  };
  const mark = (x: number, y: number, w: number, h: number, v: number) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) oSet(x + i, y + j, v);
  };
  const isFree = (x: number, y: number, w: number, h: number) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (oAt(x + i, y + j) !== FREE) return false;
    return true;
  };
  const obj = (
    x: number,
    y: number,
    kind: 'deco' | 'station' | 'sign' | 'furniture',
    sub: string,
    data?: Record<string, unknown>,
  ) => {
    if (inPlot(x, y)) t.objects.push({ x, y, kind, sub, data });
  };
  const spot = (n: string, x: number, y: number) => {
    t.spots[n] = { x, y };
  };
  const plans = residentsOfSite(site);
  const big = site.kind === 'capital' || site.kind === 'town';

  // ───── ground and the royal road
  rect(x0, y0, W, H, T.GRASS);
  const road = (x: number, y: number, w: number, h: number, v: number = T.PATH) => {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const o = oAt(x + i, y + j);
        if (o === FREE || o === ROAD) {
          set(x + i, y + j, v);
          oSet(x + i, y + j, ROAD);
        } else if (o === WATER) {
          set(x + i, y + j, T.FLOOR); // a bridge
          oSet(x + i, y + j, ROAD);
        }
      }
  };
  const solidTile = (v: number) => v === T.WALL || v === T.TREE || v === T.FENCE || v === T.WATER || v === T.LAVA;

  // ───── a river (or canals) across the plot, bridged wherever a road crosses it
  let riverX: number | null = null;
  const canalYs: number[] = [];
  const waterAt = (x: number, y: number) => oAt(x, y) === WATER;
  if (big && chance(prof.river * (site.kind === 'capital' ? 0.9 : 0.8))) {
    const sgn = chance(0.5) ? 1 : -1;
    const off = site.kind === 'capital' ? rnd(52, Math.floor(W / 2) - 22) : rnd(24, Math.floor(W / 2) - 12);
    const ph = R() * 6;
    riverX = cx + sgn * off;
    for (let y = y0 + 2; y <= y1 - 2; y++) {
      const bx = Math.round(riverX + Math.sin(y / 9 + ph) * 3);
      for (let dx = -1; dx <= 1; dx++) {
        set(bx + dx, y, T.WATER);
        oSet(bx + dx, y, WATER);
      }
      for (const dx of [-2, 2]) if (oAt(bx + dx, y) === FREE) set(bx + dx, y, T.SAND);
    }
  }
  if (prof.canals && big) {
    const n = site.kind === 'capital' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const y = cy + (i ? 1 : -1) * rnd(site.kind === 'capital' ? 26 : 18, site.kind === 'capital' ? 52 : 28);
      canalYs.push(y);
      const ph = R() * 6;
      for (let x = x0 + 2; x <= x1 - 2; x++) {
        const by = Math.round(y + Math.sin(x / 11 + ph) * 2);
        for (let dy = -1; dy <= 1; dy++) {
          set(x, by + dy, T.WATER);
          oSet(x, by + dy, WATER);
        }
        for (const dy of [-2, 2]) if (oAt(x, by + dy) === FREE) set(x, by + dy, T.SAND);
      }
    }
  }
  // the avenue (north-south) and the main street (east-west)
  road(cx - 1, y0, 3, H);
  road(x0, cy - 1, W, 3);

  // ───── walls: reserve the ring now so nothing is built across it
  const wallKind = prof.wall;
  let wi = site.kind === 'capital' ? 2 : site.kind === 'town' ? 3 : 2;
  const walled =
    site.kind === 'capital' ||
    site.kind === 'outpost' ||
    (site.kind === 'town' && wallKind !== 'canal' && chance(0.7)) ||
    (site.kind === 'town' && wallKind === 'canal');
  const sides = { n: true, s: true, e: true, w: true };
  if (site.kind === 'town' && walled && wallKind !== 'canal' && chance(0.45)) {
    // a town with an open flank
    const open = pickOf(['n', 's', 'e', 'w'] as const);
    sides[open] = false;
  }
  const wx0 = x0 + wi,
    wy0 = y0 + wi,
    wx1 = x1 - wi,
    wy1 = y1 - wi;
  const wallThick = wallKind === 'stone' && (site.kind === 'capital' || site.realm === 'khardum') ? 2 : 1;
  const wallTile = wallKind === 'hedge' ? T.TREE : wallKind === 'palisade' ? T.FENCE : T.WALL;
  const gates: Array<{ x: number; y: number }> = [];
  const keepOut = walled ? wi + wallThick + 3 : 3; // buildings stay this far in from the plot edge
  if (walled) {
    const moatTile = wallKind === 'canal' ? T.WATER : wallKind === 'obsidian' ? T.LAVA : null;
    const mw = wallKind === 'canal' ? 3 : 2;
    const ringCell = (x: number, y: number, v: number) => {
      if (oAt(x, y) === WATER) return;
      set(x, y, v);
      oSet(x, y, RES);
    };
    const gap = (x: number, y: number) =>
      (Math.abs(x - cx) <= 1 && (y <= wy0 + wallThick || y >= wy1 - wallThick)) ||
      (Math.abs(y - cy) <= 1 && (x <= wx0 + wallThick || x >= wx1 - wallThick));
    const wallCells: Array<[number, number]> = [];
    for (let x = wx0; x <= wx1; x++)
      for (let k = 0; k < wallThick; k++) {
        if (sides.n) wallCells.push([x, wy0 + k]);
        if (sides.s) wallCells.push([x, wy1 - k]);
      }
    for (let y = wy0; y <= wy1; y++)
      for (let k = 0; k < wallThick; k++) {
        if (sides.w) wallCells.push([wx0 + k, y]);
        if (sides.e) wallCells.push([wx1 - k, y]);
      }
    for (const [x, y] of wallCells) {
      if (gap(x, y)) {
        if (moatTile === null) {
          set(x, y, T.PATH);
          oSet(x, y, ROAD);
        }
        continue;
      }
      if (wallKind === 'canal') {
        // the city sits inside a ring of water instead of a wall
        ringCell(x, y, T.WATER);
        for (const [dx, dy] of [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ] as const)
          if (oAt(x + dx, y + dy) === FREE && !wallCells.some(([a, b]) => a === x + dx && b === y + dy))
            if (get(x + dx, y + dy) === T.GRASS) set(x + dx, y + dy, T.SAND);
      } else ringCell(x, y, wallTile);
    }
    if (moatTile !== null && wallKind === 'obsidian') {
      // lava moat outside the wall, bridged at the gates
      for (let x = wx0 - mw; x <= wx1 + mw; x++)
        for (let y = wy0 - mw; y <= wy1 + mw; y++) {
          const inside = x >= wx0 && x <= wx1 && y >= wy0 && y <= wy1;
          if (inside || !inPlot(x, y)) continue;
          if ((Math.abs(x - cx) <= 1 && (y < wy0 || y > wy1)) || (Math.abs(y - cy) <= 1 && (x < wx0 || x > wx1))) {
            set(x, y, T.PATH);
            oSet(x, y, ROAD);
          } else {
            set(x, y, moatTile);
            oSet(x, y, RES);
          }
        }
    }
    if (wallKind === 'canal')
      // bridges where the avenue and the main street cross the ring
      for (const [x, y] of [
        [cx, wy0],
        [cx, wy1],
        [wx0, cy],
        [wx1, cy],
      ] as const)
        for (let i = -1; i <= 1; i++)
          for (let k = 0; k < wallThick + 2; k++) {
            const px = x === cx ? x + i : x + (x === wx0 ? k - 1 : -k + 1),
              py = y === cy ? y + i : y + (y === wy0 ? k - 1 : -k + 1);
            if (get(px, py) === T.WATER) {
              set(px, py, T.FLOOR);
              oSet(px, py, ROAD);
            }
          }
    // a band behind the wall for patrols; buildings keep out
    const band = wi + wallThick + 2;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        if (
          (x < x0 + band || x > x1 - band || y < y0 + band || y > y1 - band) &&
          (oAt(x, y) === FREE || oAt(x, y) === WATER)
        )
          oSet(x, y, oAt(x, y) === WATER ? WATER : RES);
    for (const g of [
      { x: cx, y: wy0 + wallThick },
      { x: cx, y: wy1 - wallThick },
      { x: wx0 + wallThick, y: cy },
      { x: wx1 - wallThick, y: cy },
    ])
      gates.push(g);
  }

  // ───── towers (small square buildings with spire roofs) at corners and beside the gates
  const towers: Array<{ x: number; y: number }> = [];
  const placeTower = (tx: number, ty: number, size = 5) => {
    if (!inPlot(tx, ty) || !inPlot(tx + size - 1, ty + size - 1)) return;
    const b: Building = {
      id: `${site.id}.t${t.buildings.length}`,
      kind: 'tower',
      x: tx,
      y: ty,
      w: size,
      h: size,
      doorX: tx + Math.floor(size / 2),
      doorY: ty + size - 1,
      style: styleOf(4),
    };
    rect(tx, ty, size, size, T.WALL);
    rect(tx + 1, ty + 1, size - 2, size - 2, T.FLOOR);
    set(b.doorX, b.doorY, T.FLOOR);
    mark(tx - 1, ty - 1, size + 2, size + 3, RES);
    t.buildings.push(b);
    towers.push({ x: tx, y: ty });
  };
  if (walled && (site.kind === 'capital' || wallKind === 'stone' || wallKind === 'obsidian')) {
    const s = site.kind === 'capital' ? 6 : 5;
    for (const [tx, ty] of [
      [wx0 - 1, wy0 - 1],
      [wx1 - s + 2, wy0 - 1],
      [wx0 - 1, wy1 - s + 2],
      [wx1 - s + 2, wy1 - s + 2],
    ] as const)
      placeTower(tx, ty, s);
    if (site.kind !== 'outpost' || chance(0.6))
      for (const [tx, ty] of [
        [cx - 8, wy0 - 1],
        [cx + 4, wy0 - 1],
        [cx - 8, wy1 - 4],
        [cx + 4, wy1 - 4],
        [wx0 - 1, cy - 9],
        [wx0 - 1, cy + 4],
        [wx1 - 3, cy - 9],
        [wx1 - 3, cy + 4],
      ] as const)
        placeTower(tx, ty, 5);
  }

  // ───── castle (capitals) and fort (outposts)
  let throne = { x: cx, y: y0 + 20 };
  let plazaY = cy + 3;
  const buildingsAt = () => t.buildings.length;
  const addBuilding = (
    id: string,
    kind: BuildingKind,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    v: number,
    doorX = bx + Math.floor(bw / 2),
    furn?: string,
  ): Building => {
    const b: Building = { id, kind, x: bx, y: by, w: bw, h: bh, doorX, doorY: by + bh - 1, style: styleOf(v) };
    rect(bx - 1, by - 1, bw + 2, bh + 3, T.GRASS);
    rect(bx, by, bw, bh, T.WALL);
    rect(bx + 1, by + 1, bw - 2, bh - 2, T.FLOOR);
    set(b.doorX, b.doorY, T.FLOOR);
    mark(bx - 1, by - 1, bw + 2, bh + 1, BLD);
    t.buildings.push(b);
    if (furn)
      furnish(
        { ...b, id: furn },
        (x, y, k, sub) => obj(x, y, k, sub),
        (n, sx, sy) => spot(`${site.id}.${n}`, sx, sy),
      );
    return b;
  };

  if (site.kind === 'capital') {
    const cw = rnd(60, 76),
      cd = rnd(40, 48);
    const zx = cx - Math.floor(cw / 2),
      zy = y0 + (walled ? wi + wallThick + 4 : 5) + rnd(0, 4);
    const bailey = castle(prof.castle, zx, zy, cw, cd);
    plazaY = bailey + 8 + rnd(0, 4);
  } else if (site.kind === 'outpost') {
    fort();
  } else if (big) {
    plazaY = site.kind === 'town' ? cy + rnd(-12, 10) : cy;
  }

  /** The castle of a kingdom's capital. Returns the first free row south of its grounds. */
  function castle(kind: RealmId, zx: number, zy: number, cw: number, cd: number): number {
    const midX = zx + Math.floor(cw / 2);
    const zx1 = zx + cw - 1,
      zy1 = zy + cd - 1;
    mark(zx - 6, zy - 4, cw + 12, cd + 10, RES);
    const ringRoad = (v: number) => {
      // a lane around the grounds, linked to the avenue north and south
      for (let x = zx - 5; x <= zx1 + 5; x++)
        for (const y of [zy - 3, zy1 + 4]) {
          if (get(x, y) !== T.WATER && get(x, y) !== T.LAVA) {
            set(x, y, v);
            oSet(x, y, ROAD);
          }
        }
      for (let y = zy - 3; y <= zy1 + 4; y++)
        for (const x of [zx - 5, zx1 + 5]) {
          set(x, y, v);
          oSet(x, y, ROAD);
        }
    };
    ringRoad(T.PATH);
    // the avenue from the north gate reaches the ring
    for (let y = y0; y <= zy - 3; y++) road(cx - 1, y, 3, 1);
    const curtain = (thick: number, tile: number, gap = 3) => {
      for (let k = 0; k < thick; k++) {
        for (let x = zx + k; x <= zx1 - k; x++) {
          set(x, zy + k, tile);
          set(x, zy1 - k, Math.abs(x - midX) <= (gap - 1) / 2 ? T.PATH : tile);
        }
        for (let y = zy + k; y <= zy1 - k; y++) {
          set(zx + k, y, tile);
          set(zx1 - k, y, tile);
        }
      }
    };
    const moat = (tile: number, width: number) => {
      for (let x = zx - width; x <= zx1 + width; x++)
        for (let y = zy - width; y <= zy1 + width; y++) {
          const inner = x >= zx && x <= zx1 && y >= zy && y <= zy1;
          if (inner) continue;
          const bridge = Math.abs(x - midX) <= 1 && y > zy1;
          if (bridge) {
            set(x, y, T.FLOOR);
            oSet(x, y, ROAD);
          } else {
            set(x, y, tile);
            oSet(x, y, RES);
          }
        }
    };
    const courtyard = () => {
      // cobbles from the gate to the keep door, a fountain and banners
      rect(midX - 1, zy + 12, 3, zy1 - zy - 10, T.PATH);
      for (let x = zx + 3; x <= zx1 - 3; x++) for (let y = zy1 - 14; y <= zy1 - 3; y++) set(x, y, T.PATH);
    };
    const banners = (xs: number[], y: number) => {
      for (const dx of xs) obj(midX + dx, y, 'deco', 'banner', { realm: site.realm });
    };
    const keepFor = (kw: number, kh: number, v: number, ky: number): Building => {
      const kx = midX - Math.floor(kw / 2);
      const b = addBuilding(`${site.id}.palace`, 'hall', kx, ky, kw, kh, v, midX, 'palace');
      for (let i = -1; i <= 1; i++) set(midX + i, b.doorY, T.FLOOR);
      throne = { x: midX, y: ky + 3 };
      obj(throne.x, throne.y, 'deco', 'trophy');
      return b;
    };
    const wing = (id: string, wx: number, wy: number, ww: number, wh: number, v: number, fz: string) =>
      addBuilding(`${site.id}.${id}`, 'house', wx, wy, ww, wh, v, wx + Math.floor(ww / 2), fz);

    const keepW = Math.min(cw - 18, kind === 'khardum' ? 40 : 30);
    if (kind === 'aurelion') {
      moat(T.WATER, 3);
      curtain(1, T.WALL);
      for (const [tx, ty] of [
        [zx - 2, zy - 2],
        [zx1 - 3, zy - 2],
        [zx - 2, zy1 - 3],
        [zx1 - 3, zy1 - 3],
      ] as const)
        placeTower(tx, ty, 6);
      const k = keepFor(keepW, 15, 4, zy + 5);
      wing('hall1', zx + 5, zy + 9, 12, 9, 3, 'scout');
      wing('hall2', zx1 - 16, zy + 9, 12, 9, 3, 'library');
      courtyard();
      obj(midX, zy1 - 9, 'deco', 'well');
      banners([-9, -5, 5, 9], k.y + 1);
      for (const dx of [-14, 14]) obj(midX + dx, zy1 - 7, 'deco', 'statue');
      // a royal tourney ground beside the moat: a lists fence, stalls and benches
      const side = chance(0.5) ? -1 : 1;
      const tx0 = side < 0 ? zx - 32 : zx1 + 12,
        ty0 = zy + 8;
      if (inPlot(tx0, ty0) && inPlot(tx0 + 20, ty0 + 14) && !(riverX !== null && Math.abs(riverX - (tx0 + 10)) < 14)) {
        for (let x = tx0; x <= tx0 + 20; x++)
          for (const y of [ty0, ty0 + 14]) {
            set(x, y, T.FENCE);
            oSet(x, y, RES);
          }
        for (let y = ty0; y <= ty0 + 14; y++)
          for (const x of [tx0, tx0 + 20]) {
            set(x, y, T.FENCE);
            oSet(x, y, RES);
          }
        set(tx0 + 10, ty0 + 14, T.GRASS);
        rect(tx0 + 1, ty0 + 1, 19, 13, T.SAND);
        mark(tx0, ty0, 21, 15, RES);
        for (let i = 0; i < 4; i++)
          obj(tx0 + 3 + i * 4, ty0 - 1, 'deco', i % 2 ? 'banner' : 'stall', { realm: site.realm });
        for (let i = 0; i < 5; i++) obj(tx0 + 2 + i * 3, ty0 + 16, 'deco', 'bench');
      }
      return zy1 + 4;
    }
    if (kind === 'sylvaris') {
      // a palace inside a grove: tree ring, two ponds, spire-towers and shrines
      const gw = cw + 8,
        gd = cd + 6;
      for (let x = zx - 4; x <= zx - 4 + gw; x++)
        for (let y = zy - 3; y <= zy - 3 + gd; y++) {
          const edge = x < zx - 1 || x > zx1 + 1 || y < zy || y > zy1;
          const gateway = Math.abs(x - midX) <= 2 && y >= zy1;
          if (edge && !gateway && chance(0.68) && get(x, y) === T.GRASS) {
            set(x, y, T.TREE);
            oSet(x, y, RES);
          }
        }
      for (const sx of [-1, 1]) {
        for (let x = -7; x <= 7; x++)
          for (let y = -4; y <= 4; y++)
            if ((x * x) / 49 + (y * y) / 16 <= 1) {
              set(midX + sx * 24 + x, zy1 - 12 + y, T.WATER);
              oSet(midX + sx * 24 + x, zy1 - 12 + y, RES);
            }
        placeTower(midX + sx * 19 - 2, zy + 6, 5);
      }
      const k = keepFor(Math.min(keepW, 26), 14, 4, zy + 6);
      courtyard();
      obj(midX, zy1 - 8, 'deco', 'statue');
      for (const dx of [-10, -6, 6, 10]) obj(midX + dx, zy1 - 4, 'deco', 'shrine_altar');
      for (const dx of [-12, -4, 4, 12]) obj(midX + dx, k.y + k.h + 2, 'deco', 'hedge');
      banners([-8, 8], k.y + 1);
      return zy1 + 4;
    }
    if (kind === 'khardum') {
      // a mountain-hold: thick curtain wall, a huge keep, forge halls and a gate lit by braziers
      curtain(2, T.WALL, 5);
      for (const [tx, ty] of [
        [zx - 1, zy - 1],
        [zx1 - 4, zy - 1],
        [zx - 1, zy1 - 4],
        [zx1 - 4, zy1 - 4],
        [midX - 8, zy1 - 3],
        [midX + 4, zy1 - 3],
      ] as const)
        placeTower(tx, ty, 5);
      const k = keepFor(keepW, 16, 4, zy + 4);
      wing('forge1', zx + 4, zy + 8, 12, 9, 3, 'scout');
      wing('forge2', zx1 - 15, zy + 8, 12, 9, 3, 'library');
      courtyard();
      for (const dx of [-6, 6]) for (const dy of [-2, -8]) obj(midX + dx, zy1 + dy, 'deco', 'street_lamp');
      banners([-10, -6, 6, 10], k.y + 1);
      for (let i = 0; i < 5; i++) obj(zx + 6 + i * 3, zy1 - 6, 'deco', i % 2 ? 'woodpile' : 'barrel');
      return zy1 + 4;
    }
    if (kind === 'raijin') {
      // concentric citadel: palisade, stone inner wall, a pagoda keep, a garden pond and torii banners
      for (let x = zx - 4; x <= zx1 + 4; x++)
        for (const y of [zy - 3, zy1 + 3]) {
          if (Math.abs(x - midX) > 2 || y < zy1) set(x, y, T.FENCE);
          oSet(x, y, RES);
        }
      for (let y = zy - 3; y <= zy1 + 3; y++)
        for (const x of [zx - 4, zx1 + 4]) {
          set(x, y, T.FENCE);
          oSet(x, y, RES);
        }
      curtain(1, T.WALL, 5);
      for (const [tx, ty] of [
        [zx - 1, zy - 1],
        [zx1 - 4, zy - 1],
        [zx - 1, zy1 - 4],
        [zx1 - 4, zy1 - 4],
      ] as const)
        placeTower(tx, ty, 5);
      const k = keepFor(Math.min(keepW, 26), 14, 4, zy + 6);
      wing('dojo', zx + 5, zy + 14, 12, 9, 3, 'scout');
      wing('archive', zx1 - 16, zy + 14, 12, 9, 3, 'library');
      courtyard();
      for (let x = -4; x <= 4; x++)
        for (let y = -2; y <= 2; y++)
          if ((x * x) / 16 + (y * y) / 4 <= 1) {
            set(midX + 17 + x, zy1 - 8 + y, T.WATER);
            oSet(midX + 17 + x, zy1 - 8 + y, RES);
          }
      for (const dx of [-3, 3]) obj(midX + dx, zy1 + 1, 'deco', 'banner', { realm: site.realm });
      for (const dx of [-12, 12]) obj(midX + dx, zy1 - 6, 'deco', 'planter');
      banners([-7, 7], k.y + 1);
      return zy1 + 5;
    }
    if (kind === 'thalassara') {
      // a palace on an island: a wide moat, shell-white keep, harbour hall and piers
      moat(T.WATER, 5);
      const k = keepFor(Math.min(keepW, 28), 14, 4, zy + 5);
      wing('harbour', zx + 6, zy + 10, 13, 9, 3, 'scout');
      wing('tidehall', zx1 - 18, zy + 10, 13, 9, 3, 'library');
      placeTower(zx + 1, zy + 1, 5);
      placeTower(zx1 - 5, zy + 1, 5);
      courtyard();
      obj(midX, zy1 - 9, 'deco', 'well');
      banners([-8, 8], k.y + 1);
      for (const dx of [-12, 12]) obj(midX + dx, zy1 - 4, 'deco', 'statue');
      for (let i = 0; i < 4; i++) obj(zx + 2 + i * 9, zy1 + 6, 'deco', i % 2 ? 'barrel' : 'crate');
      return zy1 + 6;
    }
    // nethrakar: an obsidian citadel behind a lava moat, braziers and spiked towers
    moat(T.LAVA, 3);
    curtain(2, T.WALL, 5);
    for (const [tx, ty] of [
      [zx - 1, zy - 1],
      [zx1 - 5, zy - 1],
      [zx - 1, zy1 - 5],
      [zx1 - 5, zy1 - 5],
      [midX - 9, zy1 - 4],
      [midX + 4, zy1 - 4],
    ] as const)
      placeTower(tx, ty, 6);
    const k = keepFor(keepW, 15, 4, zy + 5);
    wing('barracks', zx + 6, zy + 11, 12, 9, 3, 'scout');
    wing('conclave', zx1 - 17, zy + 11, 12, 9, 3, 'library');
    courtyard();
    for (const dx of [-5, 5]) for (const dy of [-1, -6, -11]) set(midX + dx, zy1 + dy, T.TORCH);
    banners([-10, -6, 6, 10], k.y + 1);
    obj(midX, zy1 - 9, 'deco', 'statue');
    return zy1 + 4;
  }

  /** A frontier fort: curtain wall, a keep with barracks, a drill yard and a watch tower. */
  function fort(): void {
    const kw = rnd(15, 19),
      kh = rnd(9, 11);
    const ky = y0 + wi + wallThick + 6;
    const kx = cx - Math.floor(kw / 2);
    const b = addBuilding(`${site.id}.keep`, 'hall', kx, ky, kw, kh, 4, cx, 'scout');
    for (let i = -1; i <= 1; i++) set(cx + i, b.doorY, T.FLOOR);
    road(cx - 1, b.doorY + 1, 3, wy1 - b.doorY);
    const sideX = chance(0.5) ? x0 + wi + wallThick + 3 : x1 - wi - wallThick - 13;
    addBuilding(`${site.id}.mess`, 'house', sideX, ky + kh + 6, 12, 8, 2, sideX + 6, 'herbalist');
    obj(cx + 5, ky + kh + 4, 'deco', 'cart');
    obj(cx - 5, ky + kh + 4, 'deco', 'barrel');
    for (const dx of [-8, 8]) obj(cx + dx, ky + kh + 3, 'deco', 'trophy');
    mark(x0, y0, W, H, oAt(x0, y0) === WATER ? WATER : RES);
    road(cx - 1, y0, 3, H);
    road(x0, cy - 1, W, 3);
    plazaY = ky + kh + 7;
  }

  // ───── plaza
  const plaza = { x: cx - 9, y: plazaY - 3, w: 19, h: 9 };
  if (big) {
    const pw = rnd(15, 25),
      ph = rnd(8, 12);
    plaza.w = pw;
    plaza.h = ph;
    plaza.x = cx - Math.floor(pw / 2);
    plaza.y = plazaY - 3;
    for (let j = 0; j < ph; j++)
      for (let i = 0; i < pw; i++) {
        const o = oAt(plaza.x + i, plaza.y + j);
        if (o === FREE || o === ROAD) {
          set(plaza.x + i, plaza.y + j, T.PATH);
          oSet(plaza.x + i, plaza.y + j, ROAD);
        }
      }
    const px = plaza.x + Math.floor(pw / 2),
      py = plaza.y + Math.floor(ph / 2);
    const centre = pickOf(['well', 'statue', 'well', 'trophy']);
    obj(px, py, 'deco', centre);
    if (chance(0.5)) {
      obj(px - 4, py, 'deco', 'bench');
      obj(px + 4, py, 'deco', 'bench');
    }
    obj(plaza.x + 1, plaza.y + 1, 'deco', 'banner', { realm: site.realm });
    obj(plaza.x + pw - 2, plaza.y + 1, 'deco', 'banner', { realm: site.realm });
    const stalls = rnd(2, 6);
    for (let i = 0; i < stalls; i++)
      obj(
        plaza.x + 2 + Math.floor(((pw - 5) * i) / Math.max(1, stalls - 1)),
        plaza.y + ph - 2,
        'deco',
        pickOf(['stall', 'stall', 'cart', 'barrel']),
      );
    mark(plaza.x - 1, plaza.y - 1, pw + 2, ph + 2, ROAD);
  } else if (site.kind === 'village') {
    obj(cx + rnd(4, 8), cy + 3, 'deco', 'well');
    if (chance(0.7)) obj(cx - rnd(4, 8), cy + 3, 'deco', 'cart');
  }
  spot(`${site.id}.plaza`, cx, plazaY + 3);

  // ───── queue of buildings, services first
  const queue: Slot[] = [];
  const places = new Set(plans.map((p) => p.place));
  const SERVICES: Place[] = ['hall', 'barracks', 'inn', 'store', 'smithy', 'herbalist', 'library', 'farmhouse'];
  for (const pl of SERVICES) {
    const s = SERVICE[pl];
    if (!places.has(pl) || !s) continue;
    if ((pl === 'hall' || pl === 'library' || pl === 'barracks') && site.kind === 'capital' && pl !== 'barracks')
      continue;
    if (pl === 'barracks' && site.kind === 'capital') {
      queue.push({ place: pl, ...s, w: 14, h: 9 } as Slot);
      continue;
    }
    queue.push({ place: pl, ...s, w: s.w + rnd(-1, 2), h: s.h + rnd(0, 1) } as Slot);
  }
  if (site.kind === 'capital') {
    // civic extras: a cathedral-like hall, a guild hall and a granary
    queue.push({ place: 'hall', kind: 'hall', w: rnd(17, 21), h: rnd(10, 12), v: 4 });
    queue.push({ place: 'home', kind: 'hall', w: rnd(14, 17), h: 9, v: 3 });
    queue.push({ place: 'home', kind: 'house', w: rnd(14, 17), h: 8, v: 3 });
  }
  const homes =
    site.kind === 'capital'
      ? rnd(40, 50)
      : site.kind === 'town'
        ? rnd(22, 30)
        : site.kind === 'village'
          ? rnd(9, 13)
          : site.kind === 'farm'
            ? rnd(2, 4)
            : rnd(1, 3);
  for (let i = 0; i < homes; i++) {
    const manor = chance(prof.manor);
    const [bw, bh] = pickOf(prof.houses);
    queue.push({
      place: 'home',
      kind: site.kind === 'farm' && i === 0 ? 'farmhouse' : 'house',
      w: manor ? bw + rnd(3, 6) : bw + rnd(-1, 2),
      h: manor ? Math.min(11, bh + 2) : bh,
      v: manor ? 3 : pickOf([0, 0, 1, 2]),
    });
  }
  if (site.kind === 'town' || site.kind === 'village')
    for (let i = 0; i < (site.kind === 'town' ? 2 : 1); i++)
      queue.push({ place: 'home', kind: 'farmhouse', w: rnd(11, 13), h: 8, v: 2 });

  // ───── parks and ponds
  const parks =
    site.kind === 'capital' ? rnd(2, 4) : site.kind === 'town' ? rnd(1, 2) : site.kind === 'village' ? 1 : 0;
  for (let i = 0; i < parks; i++)
    for (let tries = 0; tries < 30; tries++) {
      const pw = rnd(10, 18),
        ph = rnd(7, 11);
      const px = rnd(x0 + keepOut, x1 - keepOut - pw),
        py = rnd(y0 + keepOut, y1 - keepOut - ph);
      if (!isFree(px - 1, py - 1, pw + 2, ph + 2)) continue;
      mark(px, py, pw, ph, RES);
      const pond = chance(0.5);
      for (let y = py; y < py + ph; y++)
        for (let x = px; x < px + pw; x++) {
          const dx = (x - (px + pw / 2)) / (pw / 2),
            dy = (y - (py + ph / 2)) / (ph / 2);
          if (pond && dx * dx + dy * dy < 0.22) set(x, y, T.WATER);
          else if (chance(prof.green * 0.28)) set(x, y, T.TREE);
          else if (chance(0.18 + prof.green * 0.2)) set(x, y, T.FLOWERS);
        }
      if (!pond) obj(px + Math.floor(pw / 2), py + Math.floor(ph / 2), 'deco', pickOf(['statue', 'bench', 'well']));
      break;
    }

  // ───── row streets and buildings
  interface Placed {
    b: Building;
    slot: Slot;
    shim: string;
  }
  const placed: Placed[] = [];
  const work = new Map<string, { x: number; y: number }>();
  let qi = 0;
  const reachX = Math.floor(W / 2) - keepOut;
  // candidate street rows: the main street (north side only) then rows spreading north and south
  const rows: number[] = [cy - 1];
  const pitch0 = rnd(13, 15);
  if (site.kind !== 'outpost' && site.kind !== 'farm') {
    let y = cy + 2 + pitch0 - 2 + rnd(0, 2);
    while (y < y1 - keepOut - 2) {
      rows.push(y);
      y += rnd(13, 15);
    }
    y = cy - 1 - rnd(13, 15);
    while (y > y0 + keepOut + 8) {
      rows.push(y);
      y -= rnd(13, 15);
    }
  } else if (site.kind === 'farm') rows.push(cy + 14);
  // services belong near the middle: order rows by distance from the main street
  rows.sort((a, b) => Math.abs(a - cy) - Math.abs(b - cy));
  const lanes: Array<{ x: number; y: number; to: number }> = [];

  for (const ry of rows) {
    if (qi >= queue.length) break;
    if (canalYs.some((c) => Math.abs(ry - c) < 7 || Math.abs(ry + 1 - c) < 7)) continue;
    if (ry + 1 > y1 - keepOut) continue;
    // lay the street outward from the avenue until something blocks it
    let L = cx,
      Rr = cx;
    const reach = Math.max(Math.min(reachX, 24), rnd(Math.floor(reachX * 0.6), reachX));
    if (ry !== cy - 1) {
      let skip = false;
      for (const x of [cx - 1, cx, cx + 1]) if (oAt(x, ry) !== ROAD) skip = true;
      if (skip) continue;
      for (let x = cx; x >= cx - reach; x--) {
        if ([0, 1].some((d) => oAt(x, ry + d) !== FREE && oAt(x, ry + d) !== ROAD && oAt(x, ry + d) !== WATER)) break;
        L = x;
      }
      for (let x = cx; x <= cx + reach; x++) {
        if ([0, 1].some((d) => oAt(x, ry + d) !== FREE && oAt(x, ry + d) !== ROAD && oAt(x, ry + d) !== WATER)) break;
        Rr = x;
      }
      if (Rr - L < 12) continue;
      road(L, ry, Rr - L + 1, 2);
    } else {
      L = Math.max(x0 + keepOut, cx - reach);
      Rr = Math.min(x1 - keepOut, cx + reach);
    }
    for (const side of [-1, 1]) {
      let cursor = side < 0 ? cx - 3 : cx + 3;
      const limit = side < 0 ? L : Rr;
      let guard = 0;
      while (qi < queue.length && guard++ < 40) {
        const s = queue[qi]!;
        const bx = side < 0 ? cursor - s.w : cursor;
        if (side < 0 ? bx < limit : bx + s.w - 1 > limit) break;
        const by = ry - s.h + (ry === cy - 1 ? 0 : 0);
        const streetOk = (() => {
          for (let x = bx; x < bx + s.w; x++) if (oAt(x, ry) !== ROAD || get(x, ry) === T.FLOOR) return false;
          return true;
        })();
        if (!streetOk || !isFree(bx - 1, by - 1, s.w + 2, s.h + 1) || by < y0 + keepOut - 2) {
          cursor += side < 0 ? -2 : 2;
          if (Math.abs(cursor - cx) > reachX) break;
          continue;
        }
        const id = `${site.id}.b${placed.length}`;
        const b = addBuilding(id, s.kind, bx, by, s.w, s.h, s.v);
        // the street cell below the door
        set(b.doorX, b.doorY + 1, T.PATH);
        placed.push({ b, slot: s, shim: s.trade ?? id });
        furnish(
          { ...b, id: s.trade ?? id },
          (x, y, kind, sub) => obj(x, y, kind, sub),
          (n, sx, sy) => {
            spot(`${site.id}.${n}`, sx, sy);
            if (n.endsWith('.work')) work.set(b.id, { x: sx, y: sy });
          },
        );
        // yard dressing
        if (chance(prof.green * 0.6)) {
          const gx = bx + rnd(0, s.w - 1);
          if (get(gx, by - 1) === T.GRASS && oAt(gx, by - 2) === FREE)
            set(gx, by - 1, chance(0.5) ? T.TREE : T.FLOWERS);
        }
        qi++;
        const gap = rnd(0, 3);
        cursor += side < 0 ? -(s.w + gap) : s.w + gap;
        if (chance(0.16)) {
          // a lane between buildings, linking this street to the next one north
          lanes.push({ x: side < 0 ? cursor + 2 : cursor - 2, y: ry, to: ry - rnd(11, 14) });
          cursor += side < 0 ? -3 : 3;
        }
      }
    }
  }
  for (const l of lanes) {
    for (let y = l.to + 1; y < l.y; y++) {
      if (oAt(l.x, y) === FREE || oAt(l.x, y) === ROAD) {
        set(l.x, y, T.PATH);
        set(l.x + 1, y, T.PATH);
        oSet(l.x, y, ROAD);
        oSet(l.x + 1, y, ROAD);
      }
    }
  }

  // ───── the outskirts: groves, gardens and rubble in the realm's own manner
  {
    const DECOR: Record<RealmId, Array<[number, number]>> = {
      aurelion: [
        [T.TREE, 0.05],
        [T.FLOWERS, 0.08],
      ],
      sylvaris: [
        [T.TREE, 0.16],
        [T.FLOWERS, 0.1],
      ],
      khardum: [
        [T.ROCK, 0.05],
        [T.GRASS_TALL, 0.03],
      ],
      raijin: [
        [T.TREE, 0.07],
        [T.FLOWERS, 0.09],
      ],
      thalassara: [
        [T.ROCK, 0.025],
        [T.FLOWERS, 0.05],
      ],
      nethrakar: [
        [T.ROCK, 0.05],
        [T.GRASS_TALL, 0.03],
      ],
    };
    const decor = DECOR[site.realm];
    for (let y = y0 + 2; y <= y1 - 2; y++)
      for (let x = x0 + 2; x <= x1 - 2; x++) {
        if (oAt(x, y) !== FREE || get(x, y) !== T.GRASS) continue;
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const o = oAt(x + dx, y + dy);
            if (o === ROAD || o === BLD) {
              near = true;
              break;
            }
          }
        if (near) continue;
        const roll = R();
        let acc = 0;
        for (const [tile, p] of decor) {
          acc += p;
          if (roll < acc) {
            set(x, y, tile);
            break;
          }
        }
      }
  }

  // ───── farms and village fields
  if (site.kind === 'farm' || site.kind === 'village') {
    const fy = site.kind === 'farm' ? cy + 5 : cy + rnd(10, 13);
    const fh = site.kind === 'farm' ? y1 - fy - 2 : Math.max(0, y1 - fy - 2);
    const fx0 = x0 + 4,
      fx1 = x1 - 4;
    if (fh >= 5) {
      const free = (x: number, y: number) => oAt(x, y) === FREE || oAt(x, y) === ROAD;
      const put = (x: number, y: number, v: number) => {
        if (
          free(x, y) &&
          !t.buildings.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h + 1)
        )
          set(x, y, v);
      };
      const split = site.kind === 'farm' ? Math.floor((fx0 + fx1) / 2) + rnd(-6, 6) : fx1 + 1;
      for (let x = fx0; x <= fx1; x++) {
        put(x, fy, T.FENCE);
        put(x, fy + fh, T.FENCE);
      }
      for (let y = fy; y <= fy + fh; y++) {
        put(fx0, y, T.FENCE);
        put(fx1, y, T.FENCE);
        if (site.kind === 'farm') put(split, y, T.FENCE);
      }
      for (let y = fy + 1; y < fy + fh; y++)
        if ((y - fy) % 2) for (let x = fx0 + 1; x < fx1; x++) if (x !== split) put(x, y, T.TILLED);
      for (const x of [cx, split + 1]) {
        put(x, fy, T.GRASS);
        put(x, fy + fh, T.GRASS);
      }
      for (let x = cx - 1; x <= cx + 1; x++) put(x, fy, T.PATH);
      obj(fx0 + 3, fy + 2, 'deco', 'scarecrow');
      obj(fx1 - 3, fy + 1, 'deco', 'hay');
      if (chance(0.6)) obj(fx0 + rnd(6, 14), fy + fh - 1, 'deco', 'beehive');
      spot(`${site.id}.field`, cx + 2, fy + 2);
    }
  }

  // ───── street furniture and trim
  const lampEvery = rnd(9, 13);
  for (let x = x0 + keepOut; x <= x1 - keepOut; x += lampEvery) {
    if (Math.abs(x - cx) < 3 || oAt(x, cy + 2) !== ROAD) continue;
    obj(x, cy + 2, 'deco', 'street_lamp');
    if (chance(0.4)) obj(x + 3, cy - 2, 'deco', pickOf(['bench', 'barrel', 'planter']));
  }
  for (let y = y0 + keepOut; y <= y1 - keepOut; y += lampEvery + 2)
    if (Math.abs(y - cy) > 3 && oAt(cx + 2, y) === ROAD) obj(cx + 2, y, 'deco', 'street_lamp');
  for (const g of gates) obj(g.x + (g.x === cx ? 2 : 0), g.y + (g.y === cy ? 2 : 0), 'deco', 'street_lamp');
  obj(cx + 3, Math.min(y1 - 2, cy + rnd(14, 22)), 'sign', 'sign', { text: `${name}. ${def.epithet}. ${def.motto}` });
  obj(cx - 3, y0 + 6, 'deco', 'banner', { realm: site.realm });
  obj(cx + 3, y0 + 6, 'deco', 'banner', { realm: site.realm });
  if (!gates.length)
    for (const g of [
      { x: cx, y: y0 + 3 },
      { x: cx, y: y1 - 3 },
      { x: x0 + 3, y: cy },
      { x: x1 - 3, y: cy },
    ])
      gates.push(g);

  // ───── resident spots
  const byPlace = new Map<Place | 'home', Placed[]>();
  for (const p of placed) byPlace.set(p.slot.place, [...(byPlace.get(p.slot.place) ?? []), p]);
  const homesPlaced = placed.filter((p) => p.slot.place === 'home' || p.slot.kind === 'farmhouse');
  const doorSpot = (b: Building, i: number) => ({ x: b.doorX + (i % 2), y: b.doorY - 1 });
  const wallSpots: Array<{ x: number; y: number }> = [];
  if (walled)
    for (let x = wx0 + 4; x <= wx1 - 4; x += 3)
      for (const y of [wy0 + wallThick + 1, wy1 - wallThick - 1])
        if (Math.abs(x - cx) > 3 && oAt(x, y) !== WATER && !solidTile(get(x, y))) wallSpots.push({ x, y });
  const walkable = (x: number, y: number) => get(x, y) !== -1 && !solidTile(get(x, y));
  plans.forEach((r: ResidentPlan, i) => {
    const bld = (byPlace.get(r.place) ?? [])[0] ?? homesPlaced[i % Math.max(1, homesPlaced.length)] ?? placed[0];
    const home = homesPlaced.length ? homesPlaced[i % homesPlaced.length]!.b : bld?.b;
    if (home) {
      const s = doorSpot(home, i);
      spot(`${r.id}.home`, s.x, s.y);
    } else spot(`${r.id}.home`, cx + (i % 5) - 2, cy + 2);
    const w = bld ? work.get(bld.b.id) : undefined;
    spot(`${r.id}.work`, w?.x ?? (bld ? bld.b.doorX : cx), w?.y ?? (bld ? bld.b.doorY - 1 : cy + 2));
    const sx = plaza.x + 1 + (i % Math.max(1, plaza.w - 2)),
      sy = plaza.y + 2 + (i % 3);
    spot(`${r.id}.square`, big ? sx : cx - 3 + (i % 7), big ? sy : cy + 3 + (i % 2));
    spot(
      `${r.id}.plaza`,
      big ? plaza.x + 1 + ((i * 3) % Math.max(1, plaza.w - 2)) : cx - 3 + ((i * 3) % 7),
      big ? plaza.y + 1 + (i % 4) : cy + 4,
    );
    const g = gates[i % gates.length]!;
    const gs = {
      x: g.x + (g.x === cx ? (i % 3) - 1 : i % 2 ? 2 : -2),
      y: g.y + (g.y === cy ? (i % 3) - 1 : i % 2 ? 2 : -2),
    };
    spot(`${r.id}.gate`, gs.x, gs.y);
    const ws = wallSpots.length ? wallSpots[(i * 7) % wallSpots.length]! : { x: cx - 14 + ((i * 7) % 29), y: y0 + 6 };
    spot(`${r.id}.wall`, ws.x, ws.y);
    spot(`${r.id}.throne`, throne.x + ((i % 5) - 2), throne.y + 2);
    if (r.role === 'guard' || r.role === 'archer' || r.role === 'soldier') {
      const bk = (byPlace.get('barracks') ?? [])[0]?.b ?? t.buildings.find((b) => b.id.endsWith('.keep')) ?? home;
      if (bk) spot(`${r.id}.home`, bk.doorX + (i % 3) - 1, bk.doorY - 1);
    }
    if (r.role === 'ruler') {
      const pal = t.buildings.find((b) => b.id.endsWith('.palace'));
      if (pal) spot(`${r.id}.home`, pal.x + 3, pal.y + 4);
    }
  });
  // a last safety net: any spot that landed on a solid tile slides to the nearest open one
  for (const [k, s] of Object.entries(t.spots)) {
    if (
      walkable(s.x, s.y) &&
      !t.objects.some((o) => o.x === s.x && o.y === s.y && o.kind === 'deco' && o.sub === 'well')
    )
      continue;
    let best: { x: number; y: number } | null = null;
    for (let r = 1; r < 8 && !best; r++)
      for (let dy = -r; dy <= r && !best; dy++)
        for (let dx = -r; dx <= r && !best; dx++)
          if (walkable(s.x + dx, s.y + dy) && get(s.x + dx, s.y + dy) !== T.WATER) best = { x: s.x + dx, y: s.y + dy };
    if (best) t.spots[k] = best;
  }
  void buildingsAt;
  return t;
}
