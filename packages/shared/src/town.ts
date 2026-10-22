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

const W = 78, H = 54;
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
  // ── the wider village: a north row along its own street, side lanes and two shops flanking the plaza
  { id: 'bakery', kind: 'house', dx: -14, dy: -5, w: 6, h: 5, door: 3, style: 2 },
  { id: 'library', kind: 'house', dx: 8, dy: -5, w: 6, h: 5, door: 3, style: 1 },
  { id: 'cottage_n1', kind: 'house', dx: -36, dy: -24, w: 5, h: 5, door: 2, style: 0 },
  { id: 'cottage_n2', kind: 'house', dx: -28, dy: -24, w: 6, h: 5, door: 2, style: 3 },
  { id: 'cottage_n3', kind: 'house', dx: -19, dy: -24, w: 5, h: 5, door: 2, style: 2 },
  { id: 'cottage_n4', kind: 'house', dx: -11, dy: -24, w: 6, h: 5, door: 3, style: 1 },
  { id: 'cottage_n5', kind: 'house', dx: -3, dy: -24, w: 7, h: 5, door: 3, style: 0 },
  { id: 'cottage_n6', kind: 'house', dx: 7, dy: -24, w: 5, h: 5, door: 2, style: 3 },
  { id: 'cottage_n7', kind: 'house', dx: 15, dy: -24, w: 6, h: 5, door: 2, style: 2 },
  { id: 'cottage_n8', kind: 'house', dx: 24, dy: -24, w: 5, h: 5, door: 2, style: 1 },
  { id: 'cottage_n9', kind: 'house', dx: 32, dy: -24, w: 5, h: 5, door: 2, style: 0 },
  { id: 'cottage_w1', kind: 'house', dx: -36, dy: -16, w: 5, h: 5, door: 2, style: 2 },
  { id: 'cottage_w2', kind: 'house', dx: -36, dy: -5, w: 5, h: 5, door: 2, style: 3 },
  { id: 'cottage_w3', kind: 'house', dx: -36, dy: 6, w: 6, h: 5, door: 2, style: 1 },
  { id: 'cottage_e1', kind: 'house', dx: 31, dy: -16, w: 5, h: 5, door: 2, style: 3 },
  { id: 'cottage_e2', kind: 'house', dx: 31, dy: -5, w: 6, h: 5, door: 2, style: 0 },
  { id: 'cottage_e3', kind: 'house', dx: 32, dy: 6, w: 5, h: 5, door: 2, style: 2 },
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
  rect(cx - 37, cy - 8, 75, 2, T.PATH);
  rect(cx - 37, cy + 2, 75, 2, T.PATH);
  rect(cx - 1, cy - 19, 2, 38, T.PATH);
  rect(cx - 37, cy + 16, 75, 2, T.PATH);
  // the north street, and two side lanes joining everything together
  rect(cx - 37, cy - 18, 75, 2, T.PATH);
  rect(cx - 17, cy - 19, 2, 38, T.PATH);
  rect(cx + 16, cy - 19, 2, 38, T.PATH);
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
  const lamp = (x: number, y: number) => { if (t.objects.some((o) => o.x === x && o.y === y)) return; if (!t.buildings.some((b) => Math.abs(b.doorX - x) <= 1 && y > b.doorY && y <= b.doorY + 8)) obj(x, y, 'furniture', 'lamp'); };
  for (let x = cx - 36; x <= cx + 36; x += 8) { lamp(x, cy - 9); lamp(x + 4, cy + 4); lamp(x + 2, cy - 19); }
  dress(t, seed, get, set, obj, spot);
  for (let y = y0; y <= t.y1; y++) for (let x = x0; x <= t.x1; x++) {
    if (get(x, y) !== T.GRASS || hash2(seed, x, y, 302) > 0.035) continue;
    let clear = true;
    for (let j = -2; j <= 2 && clear; j++) for (let i = -2; i <= 2; i++) { const g = get(x + i, y + j); if (g !== undefined && g !== T.GRASS && g !== T.FLOWERS) { clear = false; break; } }
    if (clear) set(x, y, T.TREE);
  }
  cache.set(seed, t);
  return t;
}

/**
 * Village dressing: the small things that make streets feel lived in. Mailboxes and flower boxes at every door, a yard
 * prop beside most houses (woodpile, barrels, cart, haystack, laundry, hedge), street trees along the lanes, a bigger
 * market and trade-specific scenes (beehives by the herbalist, a scarecrow in the field, troughs at the farmhouse).
 * Everything lands on bare grass, never on a road, door or other object.
 */
function dress(t: Town, seed: number, get: (x: number, y: number) => number | undefined, set: (x: number, y: number, tile: number) => void, rawObj: ObjAdd, spot: SpotAdd): void {
  const { cx, cy } = t;
  const used = new Set<number>(t.objects.map((o) => o.x * 4096 + o.y));
  const free = (x: number, y: number) => { const g = get(x, y); return (g === T.GRASS || g === T.FLOWERS) && !used.has(x * 4096 + y); };
  const put = (x: number, y: number, kind: TownObject['kind'], sub: string): boolean => { if (!free(x, y)) return false; used.add(x * 4096 + y); rawObj(x, y, kind, sub); return true; };
  const byId = (id: string) => t.buildings.find((b) => b.id === id);
  const yardProps = ['woodpile', 'barrel', 'cart', 'hay', 'laundry', 'hedge', 'planter', 'crate', 'trough'] as const;

  for (const b of t.buildings) {
    put(b.doorX + 2, b.doorY + 1, 'deco', 'mailbox');
    const h = hash2(seed, b.x, b.y, 310);
    // yard props on the sides of the house, never in front of the door
    const spots: Array<[number, number]> = [[b.x - 1, b.y + b.h - 1], [b.x + b.w, b.y + b.h - 1], [b.x - 1, b.y + b.h - 2], [b.x + b.w, b.y + b.h - 2], [b.x + b.w - 1, b.y + b.h + 1]];
    const n = b.kind === 'house' ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const [x, y] = spots[(Math.floor(h * 7) + i * 2) % spots.length]!;
      const sub = yardProps[Math.floor(hash2(seed, x, y, 311) * yardProps.length)]!;
      put(x, y, 'deco', sub);
    }
    // a hedge row in front of the facade on both sides of the path
    for (const dx of [-2, -1, 1, 2]) if (hash2(seed, b.doorX + dx, b.doorY, 312) < 0.45) put(b.doorX + dx + (dx > 0 ? 1 : -1), b.doorY + 2, 'deco', 'hedge');
  }

  // street trees along the avenue and side lanes, lamps' neighbours
  for (let y = cy - 16; y <= cy + 15; y += 5) for (const dx of [-19, 19]) if (get(cx + dx, y) === T.GRASS) { set(cx + dx, y, T.TREE); used.add((cx + dx) * 4096 + y); }
  // benches at the lane crossings
  for (const [dx, dy] of [[-15, -6], [18, -6], [-15, 5], [18, 5], [-3, -17], [4, -17]] as const) put(cx + dx, cy + dy, 'deco', 'bench');
  // a second well on the east lane and a fountain-like trough pair
  put(cx + 14, cy + 4, 'deco', 'well');
  // market: more stalls around the plaza, plus barrels and crates
  for (const [dx, dy] of [[-12, 1], [-8, -2], [8, -2], [12, 1], [11, 8], [-11, 8]] as const) put(cx + dx, cy + dy, 'deco', 'stall');
  for (const [dx, dy] of [[-9, 4], [9, 4], [-13, 6], [13, 3]] as const) put(cx + dx, cy + dy, 'deco', dx % 2 ? 'barrel' : 'crate');
  // trade scenes
  const her = byId('herbalist'); if (her) { put(her.x - 1, her.y + 1, 'deco', 'beehive'); put(her.x - 1, her.y + 3, 'deco', 'beehive'); put(her.x - 2, her.y + 2, 'deco', 'planter'); }
  const tail = byId('tailor'); if (tail) { put(tail.x - 1, tail.y + 2, 'deco', 'laundry'); put(tail.x + tail.w, tail.y + 2, 'deco', 'laundry'); }
  const farm = byId('farmhouse'); if (farm) { put(farm.x + farm.w, farm.y + 1, 'deco', 'hay'); put(farm.x + farm.w, farm.y + 3, 'deco', 'trough'); put(farm.x - 1, farm.y + 1, 'deco', 'hay'); }
  const smi = byId('smithy'); if (smi) { put(smi.x + smi.w, smi.y + 1, 'deco', 'woodpile'); put(smi.x + smi.w, smi.y + 3, 'deco', 'barrel'); }
  const sto = byId('store'); if (sto) { put(sto.x + sto.w, sto.y + 2, 'deco', 'cart'); put(sto.x + sto.w, sto.y + 4, 'deco', 'crate'); }
  const inn = byId('inn'); if (inn) { put(inn.x - 1, inn.y + 4, 'deco', 'barrel'); put(inn.x + inn.w, inn.y + 4, 'deco', 'bench'); }
  put(cx + 22, cy + 5, 'deco', 'scarecrow'); put(cx + 17, cy + 12, 'deco', 'scarecrow');
  spot('market_a', cx - 10, cy + 3); spot('market_b', cx + 10, cy + 3); spot('lane_w', cx - 16, cy + 3); spot('lane_e', cx + 17, cy + 3);
  spot('north_street', cx, cy - 17); spot('well_east', cx + 14, cy + 5);
}

type ObjAdd = (x: number, y: number, kind: TownObject['kind'], sub: string) => void;
type SpotAdd = (name: string, x: number, y: number) => void;

/**
 * Every building gets a lived-in interior that fits its trade and its owner: stations and work surfaces where the
 * work happens, a hearth and bed for whoever lives there, storage along the walls, rugs, plants and lamps. Furniture
 * hugs the walls (back wall first, then the side walls) and the entrance corridor stays clear.
 */
function furnish(b: Building, rawObj: ObjAdd, spot: SpotAdd): void {
  const ix = b.x + 1, iy = b.y + 1, iw = b.w - 2, ih = b.h - 2;
  const right = ix + iw - 1, bottom = iy + ih - 1;
  const used = new Set<string>();
  // keep the entrance corridor (door column +-1, bottom two interior rows) clear so people can walk in
  const reserved = (x: number, y: number) => Math.abs(x - b.doorX) <= 1 && y >= b.doorY - 2;
  const inside = (x: number, y: number) => x >= ix && x <= right && y >= iy && y <= bottom;
  const free = (x: number, y: number) => inside(x, y) && !reserved(x, y) && !used.has(`${x},${y}`);
  const obj = (x: number, y: number, kind: TownObject['kind'], sub: string): boolean => {
    if (!free(x, y)) return false;
    used.add(`${x},${y}`); rawObj(x, y, kind, sub); return true;
  };
  const deco = (x: number, y: number, sub: string) => obj(x, y, 'deco', sub);
  // a rug is walkable: it may sit in the middle of the room (never in the corridor)
  const rug = (x: number, y: number) => { if (inside(x, y) && !reserved(x, y) && !used.has(`${x},${y}`)) { used.add(`${x},${y}`); rawObj(x, y, 'furniture', 'rug'); } };
  const bed = () => { if (deco(ix, iy, 'bed')) spot(`${b.id}.bed`, ix + 1, iy + 1); };
  const table = (x: number, y: number, seats = true) => {
    if (!free(x, y) || (seats && (!free(x - 1, y) || !free(x + 1, y)))) return;
    deco(x, y, 'table'); if (seats) { deco(x - 1, y, 'chair'); deco(x + 1, y, 'stool'); }
  };
  /** line the back wall from left to right with `subs` (cycled) */
  const backWall = (subs: string[], x0 = ix, x1 = right, step = 1) => { let k = 0; for (let x = x0; x <= x1; x += step) if (deco(x, iy, subs[k % subs.length]!)) k++; };
  const cozy = () => { deco(right, bottom, 'plant'); deco(ix, bottom, 'basket'); };
  const midX = ix + Math.floor(iw / 2), midY = iy + Math.floor(ih / 2);

  switch (b.kind) {
    case 'smithy':
      obj(ix + 1, iy, 'station', 'forge'); obj(ix + 3, iy, 'station', 'furnace'); obj(right, iy, 'station', 'workbench');
      obj(right - 1, iy, 'station', 'jeweler');
      deco(ix, iy, 'rack'); deco(ix + 2, iy, 'rack'); deco(right, iy + 2, 'barrel'); deco(right, iy + 1, 'crate'); deco(ix, iy + 2, 'barrel');
      spot('smithy.work', ix + 2, iy + 1); break;
    case 'store':
      for (let i = 1; i < iw - 1; i++) deco(ix + i, iy + 2, 'counter');
      backWall(['shelf', 'bookcase', 'shelf', 'basket']);
      deco(ix, iy + 1, 'barrel'); deco(right, iy + 1, 'crate'); deco(ix, bottom, 'crate'); deco(right, bottom, 'basket');
      spot('store.work', midX, iy + 1); break;
    case 'inn':
      obj(ix + 1, iy, 'station', 'cooking_pot'); deco(ix + 3, iy, 'counter'); deco(ix + 4, iy, 'counter'); deco(ix + 5, iy, 'counter');
      deco(ix + 7, iy, 'hearth'); deco(right, iy, 'barrel'); deco(right - 1, iy, 'barrel'); deco(ix, iy, 'shelf');
      table(ix + 3, iy + 3); table(ix + 8, iy + 3); rug(ix + 6, iy + 2); rug(ix + 5, iy + 2);
      deco(ix, bottom, 'candles'); deco(right, bottom, 'plant'); deco(right, iy + 2, 'stool');
      spot('inn.work', ix + 2, iy + 1); spot('inn.table', ix + 5, iy + 2); break;
    case 'hall':
      deco(midX, iy, 'desk'); table(ix + 2, iy + 3); table(right - 2, iy + 3);
      backWall(['bookcase', 'banner', 'shelf'], ix, midX - 1, 2); backWall(['shelf', 'banner', 'bookcase'], midX + 1, right, 2);
      rug(midX, iy + 1); rug(midX, iy + 2); rug(midX, iy + 3);
      deco(ix, bottom, 'candles'); deco(right, bottom, 'candles'); deco(ix, iy + 1, 'plant'); deco(right, iy + 1, 'plant');
      spot('hall.work', midX, iy + 1); break;
    case 'farmhouse':
      bed(); deco(ix + 2, iy, 'hearth'); table(right - 2, iy + 2); deco(right, iy, 'shelf'); deco(right - 1, iy, 'wardrobe');
      deco(ix, bottom, 'basket'); deco(right, bottom, 'crate'); deco(ix + 4, iy, 'barrel'); rug(ix + 3, iy + 2);
      spot('farmhouse.work', ix + 4, iy + 2); break;
    default: {
      bed();
      const trade: Record<string, () => void> = {
        herbalist: () => { obj(right, iy + 1, 'station', 'alchemy'); deco(right - 1, iy, 'cauldron'); deco(ix + 2, iy, 'plant'); deco(ix + 3, iy, 'shelf'); deco(right, iy, 'plant'); deco(right, bottom, 'plant'); },
        tailor: () => { obj(right, iy + 1, 'station', 'loom'); deco(right, iy, 'wardrobe'); deco(ix + 2, iy, 'basket'); rug(midX, midY); },
        carpenter: () => { obj(right, iy + 1, 'station', 'carpenter'); deco(right, iy, 'rack'); deco(ix + 2, iy, 'crate'); deco(right, bottom, 'barrel'); },
        bakery: () => { obj(right, iy + 1, 'station', 'cooking_pot'); deco(right, iy, 'stove'); deco(ix, iy + 1, 'counter'); deco(ix + 1, iy + 1, 'counter'); deco(ix + 2, iy, 'basket'); deco(ix + 3, iy, 'basket'); },
        library: () => { for (let x = ix + 1; x < right; x++) deco(x, iy, x % 2 ? 'bookcase' : 'shelf'); deco(right, iy, 'candles'); deco(right, iy + 1, 'desk'); rug(midX, midY); },
        fisher: () => { deco(right, iy, 'rack'); deco(ix + 2, iy, 'barrel'); deco(right, bottom, 'basket'); },
        scout: () => { deco(right, iy, 'rack'); deco(ix + 2, iy, 'banner'); deco(right, bottom, 'crate'); },
      };
      if (trade[b.id]) trade[b.id]!();
      else {
        // a home: hearth on the back wall, wardrobe and shelf, a rug before the fire, something green
        deco(ix + 2, iy, 'hearth'); deco(right, iy, 'wardrobe'); deco(right - 1, iy, 'shelf'); rug(ix + 2, iy + 1);
        cozy();
      }
      table(midX, Math.min(bottom - 1, iy + 2));
      deco(ix + 1, iy, 'lamp');
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
