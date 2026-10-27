import { cozyTown } from './cozy-town';
import { T } from './tiles';
import { furnish, type Building, type Town } from './town';

/** Each port lies wholly inside one shard. Hadamere remains the original home settlement. */
export const PORTS = [
  { id: 'lumenport', name: 'Lumenport', cx: 512, cy: 0, w: 112, h: 80, count: 22, style: 1 },
  { id: 'reedhaven', name: 'Reedhaven', cx: 0, cy: 512, w: 64, h: 48, count: 6, style: 3 },
  { id: 'brinewick', name: 'Brinewick', cx: -512, cy: 0, w: 64, h: 48, count: 6, style: 0 },
  { id: 'amberquay', name: 'Amberquay', cx: 0, cy: -512, w: 64, h: 48, count: 6, style: 2 },
] as const;
const NAMES = [
  'Mira Saltglass',
  'Cassian Reed',
  'Vela Dawnwake',
  'Oren Bell',
  'Sable Fen',
  'Ivo Marlin',
  'Nessa Coil',
  'Perrin Flint',
  'Ysra Quill',
  'Dorian Moss',
  'Faye Copper',
  'Silas Wren',
  'Tamsin Tide',
  'Bram Nacre',
  'Elowen Gale',
  'Cato Penn',
  'Runa Thistle',
  'Aster Vale',
  'Linnea Frost',
  'Garrick Loom',
  'Juniper Finch',
  'Theon Starling',
  'Adira Willow',
  'Fenwick Silt',
  'Cerys Pond',
  'Milo Kelp',
  'Zinnia Reed',
  'Harlan Brook',
  'Petra Wave',
  'Lucan Brine',
  'Esme Hook',
  'Rafi Gull',
  'Maelle Drift',
  'Toren Shell',
  'Anwen Copperleaf',
  'Leif Amber',
  'Sorrel Saffron',
  'Quinn Sail',
  'Dara Keel',
  'Eira Lark',
];
const JOBS = [
  'Harbour guard',
  'Sailmaker',
  'Fishmonger',
  'Cartographer',
  'Herbalist',
  'Shipwright',
  'Lantern keeper',
  'Potter',
  'Archivist',
  'Gardener',
  'Coppersmith',
  'Baker',
];
export const PORT_RESIDENTS = PORTS.flatMap((port, pi) => {
  const start = PORTS.slice(0, pi).reduce((n, p) => n + p.count, 0);
  return Array.from({ length: port.count }, (_, i) => ({
    id: `${port.id}_${i}`,
    name: NAMES[start + i]!,
    title: JOBS[(start + i) % JOBS.length]!,
    port: port.id,
    index: start + i,
    local: i,
  }));
});

/** Smooth island shelf beneath each new port; old home-land geography remains untouched. */
export function portElevation(x: number, y: number): number {
  let h = 0;
  for (const p of PORTS) {
    if (Math.abs(x - p.cx) > p.w || Math.abs(y - p.cy) > p.h) continue;
    const d = Math.hypot((x - p.cx) / (p.w * 0.8), (y - p.cy) / (p.h * 0.9));
    h = Math.max(h, 1.6 * Math.max(0, 1 - d ** 4));
  }
  return h;
}

/** Dredged water connects each quay to open sea instead of stranding boats in a decorative pool. */
export function portChannel(x: number, y: number): boolean {
  return PORTS.some(
    (p) => x >= p.cx + 8 && x < p.cx + 16 && y >= p.cy + (p.id === 'lumenport' ? 28 : 21) && y < p.cy + p.h * 1.3,
  );
}
const cache = new Map<number, Town[]>();
export function extraTowns(seed: number): Town[] {
  const old = cache.get(seed);
  if (old) return old;
  const towns = PORTS.map((p) => {
    const x0 = p.cx - p.w / 2,
      y0 = p.cy - p.h / 2;
    const t: Town = {
      name: p.name,
      cx: p.cx,
      cy: p.cy,
      x0,
      y0,
      x1: x0 + p.w - 1,
      y1: y0 + p.h - 1,
      buildings: [],
      objects: [],
      spots: {},
      tiles: new Map(),
    };
    const set = (x: number, y: number, tile: number) => {
      if (x >= x0 && x <= t.x1 && y >= y0 && y <= t.y1) t.tiles.set(x - x0 + (y - y0) * p.w, tile);
    };
    const rect = (x: number, y: number, w: number, h: number, tile: number) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, tile);
    };
    const obj = (x: number, y: number, kind: 'deco' | 'station' | 'sign' | 'furniture', sub: string) =>
      t.objects.push({ x, y, kind, sub });
    const spot = (name: string, x: number, y: number) => {
      t.spots[name] = { x, y };
    };
    // Courtyards connected by two streets and a central quay; house plans vary between ports.
    const city = p.id === 'lumenport',
      cols = city ? 6 : 3,
      rows = 2,
      step = city ? 16 : 17;
    const left = p.cx - Math.floor((cols * step) / 2) + 2;
    // Reclaimed, authored ground: procedural rivers must not flood between occupied houses.
    rect(left - 2, p.cy - 21, cols * step + 1, city ? 47 : 40, T.GRASS);
    rect(left - 1, p.cy - 2, cols * step - 1, 3, T.PATH);
    rect(p.cx - 1, p.cy - 23, 3, 45, T.PATH);
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col,
          x = left + col * step,
          y = p.cy + (row ? 7 : -17);
        const kind = i === 0 ? 'store' : i === 1 ? 'smithy' : i === 2 ? 'inn' : 'house';
        const b: Building = {
          id: `${p.id}.house${i}`,
          kind,
          x,
          y,
          w: 9 + (i % 2),
          h: 7,
          doorX: x + 4,
          doorY: y + 6,
          style: (p.style + (col % 2)) % 4,
        };
        t.buildings.push(b);
        rect(x - 1, y - 1, b.w + 2, b.h + 2, T.GRASS);
        rect(x, y, b.w, b.h, T.WALL);
        rect(x + 1, y + 1, b.w - 2, b.h - 2, T.FLOOR);
        set(b.doorX, b.doorY, T.FLOOR);
        const streetY = p.cy + (row ? 18 : 0);
        if (row) rect(left - 1, streetY, cols * step - 1, 2, T.PATH);
        for (let yy = Math.min(b.doorY + 1, streetY); yy <= Math.max(b.doorY + 1, streetY); yy++)
          set(b.doorX, yy, T.PATH);
        // Generic furnish() emits names such as smithy.work. Keep those local to the port,
        // otherwise merging settlement spots silently sends Hadamere's workers overseas.
        furnish(b, obj, (name, sx, sy) => spot(name.startsWith(`${p.id}.`) ? name : `${p.id}.${name}`, sx, sy));
        obj(x + b.w, y + 3, 'deco', col % 2 ? 'planter' : 'barrel');
      }
    // A walkable boardwalk at the harbour with unobstructed water beside it for boarding.
    const quayY = p.cy + (city ? 26 : 19);
    rect(p.cx - 18, quayY, 37, 2, T.PATH);
    rect(p.cx - 1, p.cy + 1, 3, quayY - p.cy, T.PATH);
    rect(p.cx + 5, quayY + 2, 3, 7, T.FLOOR);
    rect(p.cx + 8, quayY + 2, 8, 10, T.WATER);
    obj(p.cx - 14, quayY, 'deco', 'cart');
    obj(p.cx - 11, quayY, 'deco', 'crate');
    t.objects.push({
      x: p.cx + 3,
      y: quayY,
      kind: 'sign',
      sub: 'sign',
      data: {
        text: `${p.name} · Hadamere lies ${p.cx > 0 ? 'west' : p.cx < 0 ? 'east' : p.cy > 0 ? 'north' : 'south'} across the sea. Board your sloop beside the quay.`,
      },
    });
    PORT_RESIDENTS.filter((n) => n.port === p.id).forEach((n, i) => {
      const b = t.buildings[Math.floor(i / 2) % t.buildings.length]!;
      spot(`${n.id}.home`, b.doorX + (i % 2), b.doorY - 1);
      const wx = left + 4 + (i % cols) * step,
        wy = p.cy + (i % 2 ? 1 : -1);
      set(wx, wy, T.PATH);
      spot(`${n.id}.work`, wx, wy);
      spot(`${n.id}.quay`, p.cx - 9 + (i % 10) * 2, quayY + 1);
      if (i % 4 === 0) obj(wx - 2, wy - 1, 'deco', 'stall');
    });
    return cozyTown(t);
  });
  if (cache.size > 8) cache.clear();
  cache.set(seed, towns);
  return towns;
}
