import { KINGDOMS } from './kingdoms';
import { residentsOfSite, type Place, type ResidentPlan } from './realm-npcs';
import { REALM_SITES, type RealmSite } from './realms';
import { T } from './tiles';
import { furnish, type Building, type BuildingKind, type Town } from './town';

/**
 * Settlement generator for the six kingdoms (world revision 5): a walled capital with a palace and plaza, market towns,
 * villages, farms with tilled fields and walled frontier outposts. Every plot has a cross of streets on the royal
 * road axes, rows of doors-on-the-street buildings in the realm's architectural style, and per-resident schedule
 * spots. Plots lie wholly inside one shard.
 */
const cache = new Map<number, Town[]>();

interface Slot {
  place: Place | 'home';
  kind: BuildingKind;
  /** furnish() trade id for buildings that are kind 'house' but have a trade interior */
  trade?: string;
  w: number;
  h: number;
}
const PLACE_BUILDING: Partial<Record<Place, Omit<Slot, 'place'>>> = {
  barracks: { kind: 'house', trade: 'scout', w: 12, h: 8 },
  inn: { kind: 'inn', w: 13, h: 8 },
  store: { kind: 'store', w: 11, h: 8 },
  smithy: { kind: 'smithy', w: 11, h: 8 },
  herbalist: { kind: 'house', trade: 'herbalist', w: 10, h: 8 },
  library: { kind: 'house', trade: 'library', w: 12, h: 8 },
  hall: { kind: 'hall', w: 14, h: 9 },
  farmhouse: { kind: 'farmhouse', w: 12, h: 8 },
  house: { kind: 'house', w: 10, h: 8 },
};

const ROWS: Record<RealmSite['kind'], number> = { capital: 4, town: 3, village: 2, farm: 1, outpost: 1 };

export function realmTowns(seed: number): Town[] {
  const hit = cache.get(seed);
  if (hit) return hit;
  const towns = REALM_SITES.map((site) => build(site));
  if (cache.size > 6) cache.clear();
  cache.set(seed, towns);
  return towns;
}

function build(site: RealmSite): Town {
  const def = KINGDOMS[site.realm];
  const x0 = site.cx - site.w / 2,
    y0 = site.cy - site.h / 2,
    x1 = x0 + site.w - 1,
    y1 = y0 + site.h - 1;
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
    cx: site.cx,
    cy: site.cy,
    x0,
    y0,
    x1,
    y1,
    buildings: [],
    objects: [],
    spots: {},
    tiles: new Map(),
  };
  const set = (x: number, y: number, v: number) => {
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) t.tiles.set(x - x0 + (y - y0) * site.w, v);
  };
  const rect = (x: number, y: number, w: number, h: number, v: number) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, v);
  };
  const obj = (
    x: number,
    y: number,
    kind: 'deco' | 'station' | 'sign' | 'furniture',
    sub: string,
    data?: Record<string, unknown>,
  ) => {
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) t.objects.push({ x, y, kind, sub, data });
  };
  const spot = (n: string, x: number, y: number) => {
    t.spots[n] = { x, y };
  };
  const plans = residentsOfSite(site);
  const cx = site.cx,
    cy = site.cy;

  // ground, avenue and main street (the royal road enters along both axes)
  rect(x0, y0, site.w, site.h, T.GRASS);
  rect(cx - 1, y0, 3, site.h, T.PATH);
  rect(x0, cy - 1, site.w, 3, T.PATH);

  // buildings: a queue of what each plot needs, then ordinary homes to fill the rows
  const queue: Slot[] = [];
  const places = new Set(plans.map((p) => p.place));
  for (const pl of ['hall', 'barracks', 'inn', 'store', 'smithy', 'herbalist', 'library', 'farmhouse'] as Place[])
    if (places.has(pl) && PLACE_BUILDING[pl]) queue.push({ place: pl, ...PLACE_BUILDING[pl]! } as Slot);
  const rows = ROWS[site.kind];
  const homesWanted = site.kind === 'capital' ? 8 : site.kind === 'town' ? 5 : site.kind === 'village' ? 2 : 1;
  for (let i = 0; i < homesWanted; i++) queue.push({ place: 'home', ...PLACE_BUILDING.house! } as Slot);

  const pitch = 13;
  const topY = site.kind === 'capital' ? y0 + 34 : y0 + Math.max(4, Math.floor((site.h - rows * pitch) / 2));
  const placed: Array<{ b: Building; slot: Slot; shim: string }> = [];
  let qi = 0;
  const half = Math.floor((site.w - 6) / 2) - 3;
  for (let row = 0; row < rows && qi < queue.length; row++) {
    const streetY = topY + row * pitch + 9;
    rect(x0, streetY, site.w, 2, T.PATH);
    for (const side of [-1, 1]) {
      let cursor = side < 0 ? cx - 4 : cx + 4;
      let used = 0;
      while (qi < queue.length && used + queue[qi]!.w <= half) {
        const s = queue[qi]!;
        const bx = side < 0 ? cursor - s.w : cursor,
          by = streetY - s.h;
        const id = `${site.id}.b${placed.length}`;
        const b: Building = {
          id,
          kind: s.kind,
          x: bx,
          y: by,
          w: s.w,
          h: s.h,
          doorX: bx + Math.floor(s.w / 2),
          doorY: by + s.h - 1,
          style: def.style,
        };
        // yard, walls, floor, door
        rect(bx - 1, by - 1, s.w + 2, s.h + 1, T.GRASS);
        rect(bx, by, s.w, s.h, T.WALL);
        rect(bx + 1, by + 1, s.w - 2, s.h - 2, T.FLOOR);
        set(b.doorX, b.doorY, T.FLOOR);
        set(b.doorX, b.doorY + 1, T.PATH);
        t.buildings.push(b);
        placed.push({ b, slot: s, shim: s.trade ?? id });
        cursor += side < 0 ? -(s.w + 3) : s.w + 3;
        used += s.w + 3;
        qi++;
      }
    }
  }
  // any unplaced remainder (tiny plots): drop it, it only means fewer homes
  const work = new Map<string, { x: number; y: number }>();
  for (const p of placed) {
    const b = p.b;
    furnish(
      { ...b, id: p.shim },
      (x, y, kind, sub) => obj(x, y, kind, sub),
      (n, sx, sy) => {
        spot(`${site.id}.${n}`, sx, sy);
        if (n.endsWith('.work')) work.set(b.id, { x: sx, y: sy });
      },
    );
  }

  // plaza, well and market in front of the main street
  const plazaY = site.kind === 'capital' ? y0 + 24 : cy + 3;
  if (site.kind === 'capital' || site.kind === 'town') {
    rect(cx - 8, plazaY - 3, 17, 9, T.PATH);
    obj(cx, plazaY, 'deco', 'well');
    obj(cx - 5, plazaY + 1, 'deco', 'banner', { realm: site.realm });
    obj(cx + 5, plazaY + 1, 'deco', 'banner', { realm: site.realm });
    obj(cx - 6, plazaY - 2, 'deco', 'stall');
    obj(cx + 6, plazaY - 2, 'deco', 'stall');
  } else if (site.kind === 'village') {
    obj(cx + 4, cy + 3, 'deco', 'well');
    obj(cx - 4, cy + 3, 'deco', 'cart');
  }
  spot(`${site.id}.plaza`, cx, plazaY + 3);

  // the palace of a capital: a great hall on the plaza, with a throne-room spot and a royal banner line
  let throne = { x: cx, y: y0 + 18 };
  if (site.kind === 'capital') {
    const pw = 28,
      ph = 15,
      px = cx - 14,
      py = y0 + 6;
    const b: Building = {
      id: `${site.id}.palace`,
      kind: 'hall',
      x: px,
      y: py,
      w: pw,
      h: ph,
      doorX: cx,
      doorY: py + ph - 1,
      style: def.style,
    };
    rect(px - 1, py - 1, pw + 2, ph + 3, T.GRASS);
    rect(px, py, pw, ph, T.WALL);
    rect(px + 1, py + 1, pw - 2, ph - 2, T.FLOOR);
    set(cx - 1, b.doorY, T.FLOOR);
    set(cx, b.doorY, T.FLOOR);
    set(cx + 1, b.doorY, T.FLOOR);
    rect(cx - 1, b.doorY + 1, 3, plazaY - 3 - b.doorY, T.PATH);
    t.buildings.push(b);
    furnish(
      { ...b, id: 'palace' },
      (x, y, kind, sub) => obj(x, y, kind, sub),
      (n, sx, sy) => spot(`${site.id}.${n}`, sx, sy),
    );
    throne = { x: cx, y: py + 3 };
    for (const dx of [-9, -5, 5, 9]) obj(cx + dx, py + 2, 'deco', 'banner', { realm: site.realm });
    obj(throne.x, throne.y, 'deco', 'trophy');
  }

  // frontier walls: capital and outposts are enclosed, with gates where the roads cross
  const wallTile = T.WALL;
  const gates: Array<{ x: number; y: number }> = [];
  if (site.kind === 'capital' || site.kind === 'outpost' || site.kind === 'town') {
    const inset = site.kind === 'town' ? 2 : 1;
    const wx0 = x0 + inset,
      wy0 = y0 + inset,
      wx1 = x1 - inset,
      wy1 = y1 - inset;
    for (let x = wx0; x <= wx1; x++) for (const y of [wy0, wy1]) if (Math.abs(x - cx) > 1) set(x, y, wallTile);
    for (let y = wy0; y <= wy1; y++) for (const x of [wx0, wx1]) if (Math.abs(y - cy) > 1) set(x, y, wallTile);
    // corner towers
    for (const [x, y] of [
      [wx0, wy0],
      [wx1 - 3, wy0],
      [wx0, wy1 - 3],
      [wx1 - 3, wy1 - 3],
    ] as const)
      rect(x, y, 4, 4, wallTile);
    for (const [x, y] of [
      [cx, wy0 + 1],
      [cx, wy1 - 1],
      [wx0 + 1, cy],
      [wx1 - 1, cy],
    ] as const)
      gates.push({ x, y });
    for (const g of gates) obj(g.x + (g.x === cx ? 2 : 0), g.y + (g.y === cy ? 2 : 0), 'deco', 'street_lamp');
  }
  if (!gates.length)
    for (const g of [
      { x: cx, y: y0 + 3 },
      { x: cx, y: y1 - 3 },
      { x: x0 + 3, y: cy },
      { x: x1 - 3, y: cy },
    ])
      gates.push(g);

  // farms: tilled soil rows inside a fence, haybales and a scarecrow
  if (site.kind === 'farm' || site.kind === 'village') {
    const fy = site.kind === 'farm' ? cy + 4 : cy + 8;
    const fh = site.kind === 'farm' ? y1 - fy - 2 : Math.max(0, y1 - fy - 1);
    if (fh >= 4) {
      const free = (x: number, y: number) =>
        !t.buildings.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h + 1);
      const put = (x: number, y: number, v: number) => {
        if (free(x, y)) set(x, y, v);
      };
      for (let x = x0 + 4; x < x1 - 3; x++) {
        put(x, fy, T.FENCE);
        put(x, fy + fh, T.FENCE);
      }
      for (let y = fy; y <= fy + fh; y++) {
        put(x0 + 4, y, T.FENCE);
        put(x1 - 4, y, T.FENCE);
      }
      for (let y = fy + 1; y < fy + fh; y++)
        if ((y - fy) % 2) for (let x = x0 + 5; x < x1 - 4; x++) put(x, y, T.TILLED);
      put(cx, fy, T.GRASS);
      put(cx, fy + fh, T.GRASS);
      obj(x0 + 7, fy + 2, 'deco', 'scarecrow');
      obj(x1 - 8, fy + 1, 'deco', 'hay');
      spot(`${site.id}.field`, cx + 2, fy + 2);
    }
  }

  // banners, a sign by the road and the crest of the realm
  const sign = {
    text: `${name}. ${def.epithet}. ${def.motto}`,
  };
  obj(cx + 3, y1 - 5, 'sign', 'sign', sign);
  obj(cx - 3, y0 + 6, 'deco', 'banner', { realm: site.realm });
  obj(cx + 3, y0 + 6, 'deco', 'banner', { realm: site.realm });
  for (const dy of [-6, 6]) obj(cx + 3, cy + dy, 'deco', 'street_lamp');

  // resident spots: home by the door, work in the building (or a street post), the square, the walls
  const byPlace = new Map<Place | 'home', typeof placed>();
  for (const p of placed) {
    const k = p.slot.place;
    byPlace.set(k, [...(byPlace.get(k) ?? []), p]);
  }
  const homes = placed.filter(
    (p) => p.slot.place === 'home' || p.slot.place === 'house' || p.slot.place === 'farmhouse',
  );
  plans.forEach((r: ResidentPlan, i) => {
    const bld = (byPlace.get(r.place) ?? [])[0] ?? homes[i % Math.max(1, homes.length)] ?? placed[0];
    const home = homes.length ? homes[i % homes.length]!.b : bld?.b;
    if (home) spot(`${r.id}.home`, home.doorX + (i % 2), home.doorY - 1);
    else spot(`${r.id}.home`, cx + (i % 5) - 2, cy + 2);
    const w = bld ? work.get(bld.b.id) : undefined;
    spot(`${r.id}.work`, w?.x ?? (bld ? bld.b.doorX : cx), w?.y ?? (bld ? bld.b.doorY - 1 : cy + 2));
    spot(`${r.id}.square`, cx - 5 + (i % 11), plazaY + 2 + (i % 3));
    spot(`${r.id}.plaza`, cx - 5 + ((i * 3) % 11), plazaY + 1 + (i % 4));
    const g = gates[i % gates.length]!;
    spot(
      `${r.id}.gate`,
      g.x + (g.x === cx ? (i % 3) - 1 : i % 2 ? 2 : -2),
      g.y + (g.y === cy ? (i % 3) - 1 : i % 2 ? 2 : -2),
    );
    spot(`${r.id}.wall`, cx - 14 + ((i * 7) % 29), y0 + 4 + ((i * 5) % 3));
    spot(`${r.id}.throne`, throne.x + ((i % 5) - 2), throne.y + 2);
    // guards of a gate or an outpost sleep in their barracks
    if (r.role === 'guard' || r.role === 'archer' || r.role === 'soldier') {
      const bk = (byPlace.get('barracks') ?? [])[0]?.b ?? home;
      if (bk) spot(`${r.id}.home`, bk.doorX + (i % 3) - 1, bk.doorY - 1);
    }
    if (r.role === 'ruler') {
      const pal = t.buildings.find((b) => b.id.endsWith('.palace'));
      if (pal) spot(`${r.id}.home`, pal.x + 3, pal.y + 4);
    }
  });
  return t;
}
