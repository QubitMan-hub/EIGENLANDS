import { hash2 } from './rng';
import { T } from './tiles';
import { sampleClimate } from './worldgen';

export type BuildingKind = 'smithy' | 'hall' | 'inn' | 'store' | 'house' | 'farmhouse';
export interface Building {
  id: string;
  kind: BuildingKind;
  x: number; y: number; w: number; h: number;
  doorX: number; doorY: number;
  /** wall/roof style 0..3 (client art) */
  style: number;
}
export interface TownObject { x: number; y: number; kind: 'station' | 'deco' | 'sign' | 'furniture'; sub: string; data?: Record<string, unknown> }
export interface Spot { x: number; y: number }
export interface Town {
  name: string;
  cx: number; cy: number;
  x0: number; y0: number; x1: number; y1: number;
  buildings: Building[];
  objects: TownObject[];
  spots: Record<string, Spot>;
  tiles: Map<number, number>;
}

const W = 56, H = 38;
const cache = new Map<number, Town>();

/** Picks a flat, dry site 45-75 tiles from the spawn shrine (deterministic per seed). */
function pickSite(seed: number): { cx: number; cy: number } {
  for (let k = 0; k < 24; k++) {
    const ang = (k * 47 + 10) * (Math.PI / 180);
    const r = 52 + (k % 3) * 8;
    const cx = Math.round(Math.cos(ang) * r), cy = Math.round(Math.sin(ang) * r);
    let land = 0, total = 0;
    for (let y = cy - H / 2; y < cy + H / 2; y += 3) for (let x = cx - W / 2; x < cx + W / 2; x += 3) {
      total++;
      if (sampleClimate(seed, x, y).height > -0.12) land++;
    }
    if (land / total > 0.9) return { cx, cy };
  }
  return { cx: 60, cy: 8 };
}

interface Plan { id: string; kind: BuildingKind; dx: number; dy: number; w: number; h: number; door: number; style: number }
const PLAN: Plan[] = [
  { id: 'smithy', kind: 'smithy', dx: -25, dy: -16, w: 9, h: 6, door: 4, style: 0 },
  { id: 'hall', kind: 'hall', dx: -6, dy: -16, w: 11, h: 6, door: 5, style: 1 },
  { id: 'inn', kind: 'inn', dx: 9, dy: -16, w: 12, h: 6, door: 5, style: 2 },
  { id: 'carpenter', kind: 'house', dx: 22, dy: -16, w: 6, h: 5, door: 2, style: 3 },
  { id: 'store', kind: 'store', dx: -25, dy: -5, w: 10, h: 6, door: 5, style: 1 },
  { id: 'tailor', kind: 'house', dx: 15, dy: -5, w: 6, h: 5, door: 2, style: 2 },
  { id: 'scout', kind: 'house', dx: 22, dy: -5, w: 5, h: 5, door: 2, style: 0 },
  { id: 'herbalist', kind: 'house', dx: -25, dy: 7, w: 6, h: 5, door: 2, style: 3 },
  { id: 'fisher', kind: 'house', dx: -18, dy: 8, w: 6, h: 5, door: 2, style: 0 },
  { id: 'farmhouse', kind: 'farmhouse', dx: 8, dy: 8, w: 9, h: 6, door: 4, style: 2 },
];

export function townFor(seed: number): Town {
  const hit = cache.get(seed);
  if (hit) return hit;
  const { cx, cy } = pickSite(seed);
  const x0 = cx - W / 2, y0 = cy - H / 2;
  const t: Town = { name: 'Hadamere', cx, cy, x0, y0, x1: x0 + W - 1, y1: y0 + H - 1, buildings: [], objects: [], spots: {}, tiles: new Map() };
  const key = (x: number, y: number) => (x - x0) + (y - y0) * W;
  const inRect = (x: number, y: number) => x >= x0 && x <= t.x1 && y >= y0 && y <= t.y1;
  const set = (x: number, y: number, tile: number) => { if (inRect(x, y)) t.tiles.set(key(x, y), tile); };
  const get = (x: number, y: number) => t.tiles.get(key(x, y));
  const rect = (x: number, y: number, w: number, h: number, tile: number) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, tile); };
  const obj = (x: number, y: number, kind: TownObject['kind'], sub: string, data?: Record<string, unknown>) => t.objects.push({ x, y, kind, sub, ...(data ? { data } : {}) });
  const spot = (name: string, x: number, y: number) => { t.spots[name] = { x, y }; };

  // 1. meadow base with a feathered edge so the town merges into the wilds
  for (let y = y0; y <= t.y1; y++) for (let x = x0; x <= t.x1; x++) {
    const m = Math.min(x - x0, t.x1 - x, y - y0, t.y1 - y);
    if (m >= 4 || (m >= 1 && hash2(seed, x, y, 301) < m / 4)) set(x, y, T.GRASS);
  }

  // 2. roads: two E-W streets, a N-S avenue and the south road
  rect(cx - 27, cy - 8, 55, 2, T.PATH);
  rect(cx - 27, cy + 2, 55, 2, T.PATH);
  rect(cx - 1, cy - 9, 2, 28, T.PATH);
  rect(cx - 27, cy + 16, 55, 2, T.PATH);
  // plaza disc
  for (let y = -3; y <= 11; y++) for (let x = -7; x <= 7; x++) if (Math.hypot(x, (y - 4) * 1.1) <= 6.2) set(cx + x, cy + y, T.PATH);
  // the statue of QubitMan holds the middle of the square
  obj(cx, cy + 4, 'deco', 'statue');
  obj(cx, cy + 5, 'sign', 'plaque', { text: 'ALL HAIL QUBITMAN\n\nHe measured the world, and the world chose to be.\nErected by the grateful people of Hadamere.' });
  obj(cx - 6, cy + 7, 'deco', 'well');
  // the plaza notice board doubles as the daily request board (see quests.ts dailyRequests)
  obj(cx - 3, cy + 1, 'sign', 'board', { text: 'HADAMERE\nA friendly village on the edge of the Eigenlands.\nTraders: General Store (west) · Smithy (north-west) · The Crooked Spoon inn (north) · Town Hall (north).\nFarm plots by the farmhouse (east) are free to use. The pond is south.' });
  for (const [dx, dy] of [[-6, 3], [6, 3], [-6, 10], [6, 10]] as const) obj(cx + dx, cy + dy, 'deco', 'bench');
  obj(cx + 7, cy + 6, 'deco', 'planter'); obj(cx - 7, cy + 5, 'deco', 'planter');
  obj(cx - 10, cy + 1, 'deco', 'stall'); obj(cx + 10, cy + 1, 'deco', 'stall'); obj(cx + 12, cy + 5, 'deco', 'stall');
  obj(cx + 2, cy - 7, 'sign', 'signpost', { text: 'North: Town Hall · Smithy · Inn\nSouth: Plaza · Pond · Farm' });
  spot('plaza_a', cx - 4, cy + 5); spot('plaza_b', cx + 4, cy + 6); spot('plaza_c', cx, cy + 8); spot('plaza_d', cx + 3, cy + 2);

  // 3. fishing pond with a sandy rim
  const pcx = cx - 6, pcy = cy + 10;
  for (let y = -8; y <= 8; y++) for (let x = -10; x <= 10; x++) {
    const d = Math.hypot(x / 5, y / 3.4);
    if (d < 0.62) set(pcx + x, pcy + y, T.DEEP_WATER);
    else if (d < 1.0) set(pcx + x, pcy + y, T.WATER);
    else if (d < 1.28 && get(pcx + x, pcy + y) !== T.PATH) set(pcx + x, pcy + y, T.SAND);
  }
  spot('pond_south', pcx, pcy + 5); spot('pond_west', pcx - 6, pcy);

  // 4. fenced starter fields (public community garden next to the farmhouse)
  const fx = cx + 19, fy = cy + 6;
  rect(fx, fy, 8, 9, T.TILLED);
  for (let i = -1; i <= 8; i++) { set(fx + i, fy - 1, T.FENCE); set(fx + i, fy + 9, T.FENCE); }
  for (let j = -1; j <= 9; j++) { set(fx + 8, fy + j, T.FENCE); if (j !== 4 && j !== 5) set(fx - 1, fy + j, T.FENCE); }
  spot('field', fx + 3, fy + 4); spot('field_gate', fx - 2, fy + 4);

  // 5. buildings
  for (const p of PLAN) {
    const b: Building = { id: p.id, kind: p.kind, x: cx + p.dx, y: cy + p.dy, w: p.w, h: p.h, doorX: cx + p.dx + p.door, doorY: cy + p.dy + p.h - 1, style: p.style };
    t.buildings.push(b);
    rect(b.x, b.y, b.w, b.h, T.WALL);
    rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, T.FLOOR);
    for (let i = 0; i < b.w; i++) set(b.x + i, b.y + b.h - 1, T.FACE);
    set(b.doorX, b.doorY, T.DOOR);
    // path from the door to the nearest road, flowers along the facade
    for (let y = b.doorY + 1; y < b.doorY + 8; y++) { if (get(b.doorX, y) === T.PATH) break; set(b.doorX, y, T.PATH); }
    for (let i = 1; i < b.w - 1; i++) if (Math.abs(b.x + i - b.doorX) > 1 && get(b.x + i, b.y + b.h) !== T.PATH) set(b.x + i, b.y + b.h, T.FLOWERS);
    spot(`${b.id}.door`, b.doorX, b.doorY + 1);
    spot(`${b.id}.in`, b.doorX, b.doorY - 1);
    furnish(b, obj, spot);
  }

  // 6. lamps along the streets and a few decorative trees
  for (let x = cx - 24; x <= cx + 24; x += 8) { obj(x, cy - 9, 'furniture', 'lamp'); obj(x + 4, cy + 4, 'furniture', 'lamp'); }
  for (let y = y0; y <= t.y1; y++) for (let x = x0; x <= t.x1; x++) {
    if (get(x, y) !== T.GRASS || hash2(seed, x, y, 302) > 0.035) continue;
    let clear = true;
    for (let j = -2; j <= 2 && clear; j++) for (let i = -2; i <= 2; i++) { const g = get(x + i, y + j); if (g !== undefined && g !== T.GRASS && g !== T.FLOWERS) { clear = false; break; } }
    if (clear) set(x, y, T.TREE);
  }
  cache.set(seed, t);
  return t;
}

type ObjAdd = (x: number, y: number, kind: TownObject['kind'], sub: string) => void;
type SpotAdd = (name: string, x: number, y: number) => void;

function furnish(b: Building, rawObj: ObjAdd, spot: SpotAdd): void {
  const ix = b.x + 1, iy = b.y + 1, iw = b.w - 2;
  // keep the entrance corridor (door column +-1, bottom two interior rows) clear so people can walk in
  const reserved = (x: number, y: number) => Math.abs(x - b.doorX) <= 1 && y >= b.doorY - 2;
  const obj: ObjAdd = (x, y, kind, sub) => { if (!reserved(x, y)) rawObj(x, y, kind, sub); };
  const bed = () => { obj(ix, iy, 'deco', 'bed'); spot(`${b.id}.bed`, ix + 1, iy + 1); };
  const table = (x: number, y: number) => {
    if (reserved(x, y) || reserved(x - 1, y) || reserved(x + 1, y)) return;
    rawObj(x, y, 'deco', 'table'); rawObj(x - 1, y, 'deco', 'chair'); rawObj(x + 1, y, 'deco', 'chair');
  };
  switch (b.kind) {
    case 'smithy':
      obj(ix + 1, iy, 'station', 'forge'); obj(ix + 3, iy, 'station', 'furnace'); obj(ix + iw - 1, iy, 'station', 'workbench');
      obj(ix + iw - 2, iy, 'station', 'jeweler');
      obj(ix + iw - 1, iy + 2, 'deco', 'barrel');
      spot('smithy.work', ix + 2, iy + 1); break;
    case 'store':
      for (let i = 1; i < iw - 1; i++) obj(ix + i, iy + 2, 'deco', 'counter');
      for (let i = 0; i < iw; i += 2) obj(ix + i, iy, 'deco', 'shelf');
      spot('store.work', ix + Math.floor(iw / 2), iy + 1); break;
    case 'inn':
      obj(ix + 1, iy, 'station', 'cooking_pot'); obj(ix + 3, iy, 'deco', 'counter'); obj(ix + 4, iy, 'deco', 'counter');
      table(ix + 3, iy + 3); table(ix + 8, iy + 3); obj(ix + iw - 1, iy, 'deco', 'barrel');
      spot('inn.work', ix + 2, iy + 1); spot('inn.table', ix + 5, iy + 2); break;
    case 'hall':
      obj(ix + Math.floor(iw / 2), iy, 'deco', 'desk'); table(ix + 2, iy + 3); table(ix + iw - 3, iy + 3);
      for (let i = 1; i < iw; i += 3) obj(ix + i, iy, 'deco', 'shelf');
      spot('hall.work', ix + Math.floor(iw / 2), iy + 1); break;
    case 'farmhouse':
      bed(); table(ix + iw - 3, iy + 2); obj(ix + iw - 1, iy, 'deco', 'shelf');
      spot('farmhouse.work', ix + 4, iy + 2); break;
    default: {
      bed(); obj(ix + iw - 1, iy, 'deco', 'shelf'); table(ix + Math.floor(iw / 2), iy + 1);
      if (b.id === 'herbalist') obj(ix + iw - 1, iy + 1, 'station', 'alchemy');
      if (b.id === 'tailor') obj(ix + iw - 1, iy + 1, 'station', 'loom');
      if (b.id === 'carpenter') obj(ix + iw - 1, iy + 1, 'station', 'carpenter');
      spot(`${b.id}.work`, ix + 1, iy + 2);
    }
  }
}

/** Town tile override at (x,y), or null outside the town footprint. */
export function townTileAt(seed: number, x: number, y: number): number | null {
  // cheap reject: the site is within ~90 tiles of the origin
  if (x < -120 || x > 120 || y < -120 || y > 120) return null;
  const t = townFor(seed);
  if (x < t.x0 || x > t.x1 || y < t.y0 || y > t.y1) return null;
  return t.tiles.get((x - t.x0) + (y - t.y0) * W) ?? null;
}

export function buildingAt(seed: number, x: number, y: number): Building | null {
  const t = townFor(seed);
  if (x < t.x0 || x > t.x1 || y < t.y0 || y > t.y1) return null;
  for (const b of t.buildings) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  return null;
}
